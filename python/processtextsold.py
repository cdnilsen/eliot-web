import os
#from python_dotenv import load_dotenv
import psycopg2
from library import bookToIDDict, cleanDiacritics

#load_dotenv('vars.env')
DATABASE_URL = os.environ.get('DATABASE_URL', 'postgresql://postgres:Cb4-D5B2BEEg6*GBBB*Fga*b5FE6CbfF@monorail.proxy.rlwy.net:14224/railway')


def clear_tables(connection):
    areYouSure = input("THIS WILL DELETE ALL YOUR DATA FROM ALL YOUR TABLES.\nIF YOU'RE SURE, TYPE 'YES' (ALL CAPS): ")
    if areYouSure != "YES":
        print("Aborting")
        return
    else:
        cursor = connection.cursor()

        executeStatement = ""
        whichTable = input("Which table would you like to clear?\n(1) all_verses\n(2) verses_to_words\n(3) words_mass\n(4) all of them\n: ")

        if whichTable == "1":
            executeStatement = "DELETE FROM all_verses;"
        elif whichTable == "2":
            executeStatement = "DELETE FROM verses_to_words;"
        elif whichTable == "3":
            executeStatement = "DELETE FROM words_mass;"
        elif whichTable == "4":
            executeStatement = "DELETE FROM all_verses; DELETE FROM verses_to_words; DELETE FROM words_mass;"

        try:
            cursor.execute(executeStatement)
            connection.commit()
            print("Tables cleared successfully")
        except Exception as e:
            connection.rollback()
            print(f"Error: {e}")
        finally:
            cursor.close()


def getAllTextNames():
    folder = '../texts/'
    texts = []
    for file in os.listdir(folder):
        if file.endswith('.txt'):
            texts.append(file)
    return texts


def getLineID(lineAddress):
    try:
        chapter, verse = lineAddress.split(".")
        while (len(chapter) < 3):
            chapter = "0" + chapter
        while (len(verse) < 3):
            verse = "0" + verse
        return chapter + verse
    except:
        return "999999"

def updateAllVerses(connection, verseObject):
    cursor = connection.cursor()
    try:
        cursor.execute("""
            INSERT INTO all_verses (verse_id, book, chapter, verse)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (verse_id) DO NOTHING
        """, (verseObject['address'], verseObject['book'], verseObject['chapter'], verseObject['verse']))
        
        cursor.execute(f"""
            UPDATE all_verses 
            SET {verseObject['column']} = %s
            WHERE verse_id = %s
        """, (verseObject['text'], verseObject['address']))
        
        connection.commit()
    except Exception as e:
        connection.rollback()
        print(f"Error in all_verses: {e}")
    finally:
        cursor.close()

def cleanWord(word):    
    smallCapDict = {
        "ᴏ": "o",
        "ʀ": "r",
        "ᴅ": "d"
    }

    if (word.startswith("OO") and word.upper() != word):
        word = "8" + word[2:]


    for smallCap in ["ᴏ", "ʀ", "ᴅ"]:
        word = word.replace(smallCap, smallCapDict[smallCap])

    word = word.lower()

    punctuation = ['.', ',', ';', ':', '!', '?', '(', ')', '[', ']', '{', '}', '"', "'", '“', '”', '‘', '’', '—', '–', '…', '•', '·', '«', '»', '„']

    for char in punctuation:
        word = word.replace(char, "")

    return word


def addOneWordMass(connection, cursor, word, count, verseObject):
    return

def addWordsMass(connection, wordList, countDict, verseObject):
    cursor = connection.cursor()
   
    try:
        existingWords = []
        newWords = []
        placeholders = ','.join(['%s'] * len(wordList))
        query = f"""
            SELECT headword
            FROM words_mass 
            WHERE headword IN ({placeholders})
        """
        cursor.execute(query, wordList)
        result = cursor.fetchall()

        for row in result:
            existingWords.append(row[0])
        
        for word in wordList:
            if word not in existingWords:
                newWords.append(word)
        
        if len(newWords) > 0:
            newWords = sorted(newWords)
            newWordsMass = [(word, [verseObject['local_address']], [countDict[word]], countDict[word], cleanDiacritics(word)) for word in newWords]
            cursor.executemany("""
                INSERT INTO words_mass (headword, verses, counts, total_count, no_diacritics)
                VALUES (%s, %s, %s, %s, %s)
               ON CONFLICT (headword) DO NOTHING
            """, newWordsMass)

        for word in wordList:  # Changed to iterate through wordList instead of existingWords
            cursor.execute("""
                SELECT verses, counts, total_count
                FROM words_mass
                WHERE headword = %s
            """, (word,))
            
            result = cursor.fetchone()
            if result:
                verses, counts, total_count = result
                verses.append(verseObject['local_address'])
                counts.append(countDict[word])
                total_count += countDict[word]
                
                cursor.execute("""
                    UPDATE words_mass
                    SET verses = %s, counts = %s, total_count = %s
                    WHERE headword = %s
                """, (verses, counts, total_count, word))

        connection.commit()

    except Exception as e:
        connection.rollback()
        print(f"Error checking words_mass: {e}")
    finally:
        cursor.close()
   
    return newWords



def deleteVerseFromOldWord(connection, headword, verseID):
    cursor = connection.cursor()
    print(f"Deleting verse {verseID} from old word {headword}")
    try:
        cursor.execute("""
            SELECT verses, counts, total_count
            FROM words_mass
            WHERE headword = %s
        """, (headword,))
        result = cursor.fetchone()
        if result:
            verses, counts, total_count = result
            verseIndex = verses.index(verseID)
            verseCount = counts[verseIndex]
            verses.pop(verseIndex)
            counts.pop(verseIndex)
            total_count -= verseCount
            print(verses)
            if (len(verses) > 0):
                cursor.execute("""
                    UPDATE words_mass
                    SET verses = %s, counts = %s, total_count = %s
                    WHERE headword = %s
                """, (verses, counts, total_count, headword))
            else:
                cursor.execute("""
                    DELETE FROM words_mass
                    WHERE headword = %s
                """, (headword,))  # Added comma to make it a tuple
            connection.commit()
    except Exception as e:
        connection.rollback()
        print(f"Error deleting verse from old word: {e}")
    finally:
        cursor.close()


# Seems to add the first verse twice for each word it comes across.
def updateWordsMass(connection, newWordList, wordCountDict, oldWords, oldWordDict, verseObject, newVerse):
    #print("Called updateWordsMass...")
    cursor = connection.cursor()
    try:
        wordsNoLongerInVerse = [word for word in oldWords if word not in newWordList]
        wordsToAdd = [word for word in newWordList if word not in oldWords]
                
        for word in wordsNoLongerInVerse:
            deleteVerseFromOldWord(connection, word, verseObject['local_address'])

        if wordsToAdd:
            placeholders = ','.join(['%s'] * len(wordsToAdd))
            cursor.execute(f"""
                SELECT headword, verses, counts, total_count
                FROM words_mass 
                WHERE headword IN ({placeholders})
            """, wordsToAdd)
            
            existing_words = cursor.fetchall()
            
            for row in existing_words:
                headword, verses, counts, total = row
                
                new_verses = verses
                new_counts = counts
                new_total = total

                # Create new arrays with appended values
                if (verseObject['local_address'] not in verses):
                    new_verses += [verseObject['local_address']]
                    new_counts += [wordCountDict[headword]]
                    new_total += wordCountDict[headword]

                else:
                    thisVerseIndex = verses.index(verseObject['local_address'])
                    if (new_counts[thisVerseIndex] != wordCountDict[headword]):
                        new_counts[thisVerseIndex] = wordCountDict[headword]
                        new_total = sum(new_counts)
                    
                
                cursor.execute("""
                    UPDATE words_mass
                    SET verses = %s,
                        counts = %s,
                        total_count = %s
                    WHERE headword = %s
                """, (new_verses, new_counts, new_total, headword))
                
                # Verify the update
                cursor.execute("SELECT verses, counts FROM words_mass WHERE headword = %s", (headword,))
                after_update = cursor.fetchone()

            # Insert completely new words
            new_words = [(word, [verseObject['local_address']], [wordCountDict[word]], 
                         wordCountDict[word], cleanDiacritics(word)) 
                        for word in wordsToAdd if word not in {row[0] for row in existing_words}]
            
            if new_words:
                cursor.executemany("""
                    INSERT INTO words_mass (headword, verses, counts, total_count, no_diacritics)
                    VALUES (%s, %s, %s, %s, %s)
                """, new_words)

        connection.commit()
    except Exception as e:
        connection.rollback()
        print(f"Error in updateWordsMass: {e}")
        raise e
    finally:
        cursor.close()




def processVerseWords(connection, wordList, wordCountDict, verseObject):
    cursor = connection.cursor()
    try:
        changeStuff = False
        newVerse = True

        cursor.execute("""
            SELECT words, counts 
            FROM verses_to_words 
            WHERE verse_id = %s
        """, (verseObject['local_address'],))
        
        result = cursor.fetchone()
        countList = [wordCountDict[w] for w in wordList]

        oldWords = []
        oldWordDict = {}
        if result:
            newVerse = False
            existing_words, existing_counts = result
            if existing_words != wordList or existing_counts != countList:
                changeStuff = True

                oldWords = existing_words
                oldWordDict = dict(zip(existing_words, existing_counts))
       
        if newVerse:
            #print("New verse!")
            addWordsMass(connection, wordList, wordCountDict, verseObject)
            cursor.execute("""
                INSERT INTO verses_to_words (verse_id, words, counts)
                VALUES (%s, %s, %s)
                ON CONFLICT (verse_id) DO UPDATE 
                SET words = EXCLUDED.words, counts = EXCLUDED.counts
            """, (verseObject['local_address'], wordList, countList))

        if changeStuff:
            print("Changing stuff in " + str(verseObject['local_address']))

            print("Old words: " + str(oldWords))
            print("New words: " + str(wordList))

            #print(oldWords != wordList)
            #print("Invoking updateWordsMass...")
            updateWordsMass(connection, wordList, wordCountDict, oldWords, oldWordDict, verseObject, newVerse)
            cursor.execute("""
                UPDATE verses_to_words
                SET words = %s, counts = %s
                WHERE verse_id = %s
            """, (wordList, countList, verseObject['local_address']))
       
        connection.commit()
    except Exception as e:
        connection.rollback()
        print(f"Error in verses_to_words: {e}")
    finally:
        cursor.close()


def processWordsKJV(connection, verseObject, i):
    return

def processWords(connection, verseObject, i):
    rawWords = verseObject['text'].split()

    wordList = []
    wordCountDict = {}

    for word in rawWords:
        cleanedWord = cleanWord(word.strip())
        if cleanedWord != "":
            if cleanedWord in wordCountDict:
                wordCountDict[cleanedWord] += 1
            else:
                wordCountDict[cleanedWord] = 1
                wordList.append(cleanedWord)

    wordList = sorted(wordList)

    processVerseWords(connection, wordList, wordCountDict, verseObject)

    #if i % 40 == 0:
        
        #print(wordList)
        #print(verseObject)

# Still lots of parameters but...
def processLine(connection, line, edition, i, numLines, chapterChoice, bookID, book, isMass):
    if line == "":
        return
    
    splitLine = line.split()
    verseAddress = splitLine[0]

    editionShorthandDict = {
        'First Edition': 'α',
        'Second Edition': 'β',
        'Mayhew': 'M',
        'Zeroth Edition': 'א',
        'KJV': 'E',
        'Grebrew': 'G'
    }

    editionIDDict = {
        'First Edition': '2',
        'Second Edition': '3',
        'Mayhew': '5',
        'Zeroth Edition': '7',
        'KJV': '4',
        'Grebrew': '8'
    }

    editionColumnDict = {
        'First Edition': 'first_edition',
        'Second Edition': 'second_edition',
        'Mayhew': 'mayhew',
        'Zeroth Edition': 'zeroth_edition',
        'KJV': 'kjv',
        'Grebrew': 'grebrew'
    }
    
    shorthand = editionShorthandDict[edition]
    
    if i == 0:
        print("\n")
    if i % 5 == 0:
        print(f"Processing line {i}/{str(numLines)} ({shorthand}.{verseAddress})")  
  

    chapter = "999"
    verse = "999"
    if ('.' in verseAddress):
        chapter = verseAddress.split(".")[0]
        verse = verseAddress.split(".")[1]

    if (chapterChoice != "all" and chapter != chapterChoice):
        return
    
    editionColumn = editionColumnDict[edition]  


    lineID = getLineID(verseAddress)

    allEditionHeader = "1" + bookID
    thisEditionHeader = editionIDDict[edition] + bookID
    

    rawWords = splitLine[1:]
    verseText = " ".join(rawWords)

    allEditionsAddress = allEditionHeader + lineID
    thisEditionAddress = thisEditionHeader + lineID

    verseObject = {
        'address': int(allEditionsAddress),
        'local_address': int(thisEditionAddress),
        'book': book,
        'chapter': int(chapter),
        'verse': int(verse),
        'text': verseText,
        'column': editionColumn
    }

    updateAllVerses(connection, verseObject)

    if (isMass):
        processWords(connection, verseObject, i)


    elif edition == 'KJV':
        processWordsKJV(connection, verseObject, i)

def processText(connection, textName, chapterChoice="all"):
    splitTextName = textName.split(".")
    book = splitTextName[0]
    edition = splitTextName[1]
    bookID = bookToIDDict[book]

    file = open(f"../texts/{textName}", "r", encoding="utf-8")

    lines = file.readlines()
    totalLines = len(lines)

    isMass = edition in ["First Edition", "Second Edition", "Mayhew", "Zeroth Edition"]
    for i in range(len(lines)):
        line = lines[i].strip()
        if line != "":
            processLine(connection, line, edition, i, totalLines, chapterChoice, bookID, book, isMass)
        


def getNumChapters(book, editions):
    highestChapter = 0
    for edition in editions:
        file = open(f"../texts/{book}.{edition}.txt", "r", encoding="utf-8")
        lines = file.readlines()
        for line in lines:
            line = line.strip()
            if line != "":
                header = line.split()[0]
                if "." in header:
                    chapter = header.split(".")[0]
                    if int(chapter) > highestChapter:
                        highestChapter = int(chapter)
    return highestChapter


def chapterPrompt(numChapters):
    chapterPromptString = "Process the following chapter (up to " + str(numChapters) + "), or press enter to process all chapters: "
    chapterChoice = input(chapterPromptString).strip()
    if chapterChoice == "":
        return "all"
    elif chapterChoice.isdigit() and int(chapterChoice) <= numChapters:
        return chapterChoice
    else:
        chapterPrompt(numChapters)



def getText(connection):
    texts = getAllTextNames()
    bookName = input("Enter the name of the book, or press (e) to exit: ").strip()

    if bookName == "e":
        return

    matches = []
    for text in texts:
        thisTextBook = text.split(".")[0]
        if bookName.lower() == thisTextBook.lower():
            matches.append(text)

    if len(matches) == 0:
        getText(connection)


    allEditions = ["First Edition", "Second Edition", "Mayhew", "Zeroth Edition", "KJV", "Grebrew"]
    activeEditions = []
    for match in matches:
        thisEdition = match.split('.')[1]
        if thisEdition not in allEditions:
            print(f"Unknown edition: {thisEdition}")
        else:
            activeEditions.append(thisEdition)
    activeEditions = sorted(activeEditions, key=lambda x: allEditions.index(x))

    editionDict = {}

    editionPrompt = "Select the edition of the text you want to process:\n(0) all, "
    for i, edition in enumerate(activeEditions):
        editionPrompt += f"({i+1}) {edition}, "
        editionDict[str(i+1)] = edition

    editionPrompt = editionPrompt[:-2] + ": "

    editionChoice = input(editionPrompt).strip()


    textsToProcess = []
    if editionChoice == '0':
        for thisEdition in activeEditions:
            textsToProcess.append(bookName + "." + thisEdition + ".txt")
    else:
        edition = editionDict[editionChoice]
        for thisEdition in activeEditions:
            if edition in thisEdition:
                textsToProcess.append(bookName + "." + thisEdition + ".txt")

    numChapters = getNumChapters(bookName, activeEditions)
    chapterChoice = chapterPrompt(numChapters)

    
    for textName in textsToProcess:
        processText(connection, textName, chapterChoice)
    
    

def main():
    try:
        connection = psycopg2.connect(DATABASE_URL)
        #clear_tables(connection)
        selectedText = getText(connection)
    except Exception as e:
        print(f"Connection failed: {e}")

main()