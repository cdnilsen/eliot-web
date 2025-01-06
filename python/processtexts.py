import os
#from python_dotenv import load_dotenv
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
from library import bookToIDDict, cleanDiacritics, cleanWord
import time
import math

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



def addZeros(number):
    while (len(number) < 3):
        number = "0" + number
    return number

def getLineAddress(splitLine):

    object = {
        "chapter": "999",
        "verse": "999"
    }

    verseAddress = splitLine[0]

    if ("." in verseAddress):
        verseAddress = verseAddress.split(".")
        object["chapter"] = addZeros(verseAddress[0])
        object["verse"] = addZeros(verseAddress[1])

    return object

def processLine(line, editionIDHeader, chapterChoice):
    splitLine = line.split()
    splitText = splitLine[1:]
    lineText = " ".join(splitText)
    addressObject = getLineAddress(splitLine)

    if (chapterChoice != "all" and addZeros(chapterChoice) != addressObject["chapter"]):
        return False
    

    genericVerseAddress = "1" + editionIDHeader[1:] + addressObject["chapter"] + addressObject["verse"]
    thisVerseAddress = editionIDHeader + addressObject["chapter"] + addressObject["verse"]

    wordCountDict = {}
    wordList = []

    for word in splitText:
        word = cleanWord(word)
        wordList.append(word)
        if word in wordCountDict:
            wordCountDict[word] += 1
        else:
            wordCountDict[word] = 1
    
    lineObject = {
        "text": lineText,
        "words": wordList,
        "wordCount": wordCountDict,
        "genericVerseAddress": genericVerseAddress,
        "thisVerseAddress": thisVerseAddress
    }


    return lineObject

# Returns a 'Text Object' that has a verse-to-word dictionary and a word-to-verses dictionary.
def processText(textName, chapterChoice):
    splitText = textName.split(".")
    book = splitText[0]
    edition = splitText[1]
    bookID = bookToIDDict[book]
    file = open(f"../texts/{textName}", "r", encoding="utf-8")

    lines = file.readlines()
    totalLines = len(lines)

    isMass = edition in ["First Edition", "Second Edition", "Mayhew", "Zeroth Edition"]

    verseToWordObject = {

    }

    wordToVerseObject = {

    }

    verseToTextObject = {

    }

    editionIDDict = {
        'First Edition': '2',
        'Second Edition': '3',
        'Mayhew': '5',
        'Zeroth Edition': '7',
        'KJV': '4',
        'Grebrew': '8'
    }

    genericVerseIDHeader = "1" + bookID
    editionIDHeader = editionIDDict[edition] + bookID


    allLineObjects = []
    verseAddresses = []
    for line in lines:
        line = line.strip()
        #print(line)
        if (line != ""):
            lineObject = processLine(line, editionIDHeader, chapterChoice)
            if lineObject:
                allLineObjects.append(lineObject)
                #print(lineObject)

                thisLineText = lineObject["text"]
                thisLineAddress = lineObject["thisVerseAddress"]
                verseAddresses.append(thisLineAddress)
                verseToTextObject[thisLineAddress] = thisLineText

                verseToWordObject[thisLineAddress] = {}

                if (isMass):
                    for word in lineObject["words"]:
                        wordCount = lineObject["wordCount"][word]
                        if word not in wordToVerseObject:
                            wordToVerseObject[word] = {
                                thisLineAddress: wordCount
                            }
                        else:
                            wordToVerseObject[word][thisLineAddress] = wordCount

                        verseToWordObject[thisLineAddress][word] = wordCount

    textObject = {
        "allAddresses": verseAddresses,
        "verseToText": verseToTextObject,
        "verseToWord": verseToWordObject,
        "wordToVerse": wordToVerseObject
    }

    #print(textObject)

    return textObject


# Maybe a lot of this doesn't need to be spun off into functions but w/e...
def getAllTextNames():
    folder = '../texts/'
    texts = []
    for file in os.listdir(folder):
        if file.endswith('.txt'):
            texts.append(file)
    return texts

def getEditionList(matches):
    allEditions = ["First Edition", "Second Edition", "Mayhew", "Zeroth Edition", "KJV", "Grebrew"]
    activeEditions = []
    for match in matches:
        thisEdition = match.split('.')[1]
        if thisEdition not in allEditions:
            print(f"Unknown edition: {thisEdition}")
        else:
            activeEditions.append(thisEdition)
    return sorted(activeEditions, key=lambda x: allEditions.index(x))

def getEditionChoice(activeEditions, editionDict):
    editionPrompt = "Select the edition of the text you want to process:\n(0) all, "
    for i, edition in enumerate(activeEditions):
        editionPrompt += f"({i+1}) {edition}, "
        editionDict[str(i+1)] = edition

    editionPrompt += " all but Grebrew (9): "

    return input(editionPrompt).strip()

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
    if (numChapters == 1):
        return "all"
    
    chapterPromptString = "Process the following chapter (up to " + str(numChapters) + "), or press enter to process all chapters: "
    chapterChoice = input(chapterPromptString).strip()
    if chapterChoice == "":
        return "all"
    elif chapterChoice.isdigit() and int(chapterChoice) <= numChapters:
        return chapterChoice
    else:
        chapterPrompt(numChapters)

def getTextObjects():
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
        return getTextObjects()

    activeEditions = getEditionList(matches)
    editionDict = {}
    editionChoice = getEditionChoice(activeEditions, editionDict)

    textsToProcess = []
    finalEditionList = []
    if editionChoice == '0':
        for thisEdition in activeEditions:
            textsToProcess.append(bookName + "." + thisEdition + ".txt")
            finalEditionList.append(thisEdition)

    elif editionChoice == '9':
        for thisEdition in activeEditions:
            if thisEdition != "Grebrew":
                textsToProcess.append(bookName + "." + thisEdition + ".txt")
                finalEditionList.append(thisEdition)


    
    else:
        edition = editionDict[editionChoice]
        for thisEdition in activeEditions:
            if edition in thisEdition:
                textsToProcess.append(bookName + "." + thisEdition + ".txt")
                finalEditionList.append(thisEdition)

    numChapters = getNumChapters(bookName, activeEditions)
    chapterChoice = chapterPrompt(numChapters)

    
    allTextObjects = []
    for textName in textsToProcess:
        textObject = processText(textName, chapterChoice)
        allTextObjects.append(textObject)

    timeStart = time.time()

    output = {
        "textObjects": allTextObjects,
        "editions": finalEditionList,
        "timestamp": timeStart
    }
    return output


def getTextDict(textObjects):
    textDict = {}
    for textObject in textObjects:
        for verseAddress in textObject["allAddresses"]:
            text = textObject["verseToText"][verseAddress]
            genericVerseID = "1" + verseAddress[1:]
            if genericVerseID not in textDict:
                textDict[genericVerseID] = {
                    verseAddress: text
                }
            else:
                textDict[genericVerseID][verseAddress] = text
    return textDict


def getVerseInfo(verseID):
    thisBook = ""
    string = str(verseID)
    bookID = string[1:4]
    for book in list(bookToIDDict.keys()):
        if bookToIDDict[book] == bookID:
            thisBook = book
            break

    chapterID = int(string[4:7])
    verseID = int(string[7:])

    object = {
        "book": thisBook,
        "chapter": chapterID,
        "verse": verseID
    }

    return object

def grabRowText(queryString, connection, genericVerseID, textObject, activeColumns):
    versePrefixToColumnDict = {
        "2": "first_edition",
        "3": "second_edition",
        "5": "mayhew",
        "7": "zeroth_edition",
        "4": "kjv",
        "8": "grebrew"
    }

    IDNum = int(genericVerseID)
    cursor = connection.cursor()

    cursor.execute(queryString, (IDNum,))

    whichEditions = list(textObject.keys())


    newTextDict = {}
    for edition in whichEditions:
        newTextDict[versePrefixToColumnDict[edition[0]]] = textObject[edition]
    #print(newTextDict)
    row = cursor.fetchone()

    newVerse = False
    existingColumnToTextDict = {}
    if row:
        for i in range(len(row)):
            column = activeColumns[i]
            text = row[i]
            existingColumnToTextDict[column] = text
    
    else:
        newVerse = True
        for column in activeColumns:
            existingColumnToTextDict[column] = ""

    #print(existingColumnToTextDict)
    columnsToUpdate = []
    for column in activeColumns:
        if (existingColumnToTextDict[column] != newTextDict[column]):
            columnsToUpdate.append(column)

    if newVerse:
        verseInfo = getVerseInfo(genericVerseID)
        insertString = "INSERT INTO all_verses (verse_id, book, chapter, verse) VALUES (%s, %s, %s, %s);"
        cursor.execute(insertString, (IDNum, verseInfo["book"], verseInfo["chapter"], verseInfo["verse"]))

    if len(columnsToUpdate) > 0:
        for column in columnsToUpdate:
            updateString = f"UPDATE all_verses SET {column} = %s WHERE verse_id = %s;"
            cursor.execute(updateString, (newTextDict[column], IDNum))
            connection.commit()

    return columnsToUpdate

def grabExistingText(connection, verseGenerics, editions, textObjects):
    columns = []
    columnDict = {
        'First Edition': 'first_edition',
        'Second Edition': 'second_edition',
        'Mayhew': 'mayhew',
        'Zeroth Edition': 'zeroth_edition',
        'KJV': 'kjv',
        'Grebrew': 'grebrew'
    }

    queryString = "SELECT "
    for edition in editions:
        column = columnDict[edition]
        columns.append(column)
        queryString += column + ", "

    queryString = queryString[:-2] + " FROM all_verses WHERE verse_id = %s;"

    updateDict = {}
    updateTextTime = time.time()
    for i in range (len(verseGenerics)):
        verseID = verseGenerics[i]
        thisTextObject = textObjects[verseID]
        #print(thisTextObject)
        columnsNeedUpdating = grabRowText(queryString, connection, verseID, thisTextObject, columns)

        updateDict[verseID] = columnsNeedUpdating

        print(f"{i + 1}/{len(verseGenerics)} verse texts updated")

    updateTextSeconds = time.time() - updateTextTime
    updateTextMinutes = math.floor(updateTextSeconds / 60)
    secondsLeftOver = math.ceil(updateTextSeconds % 60)
    print(f"Finished updating all_verses ({updateTextMinutes} minutes, {secondsLeftOver} seconds)")

    return updateDict


def getVerseIDsForVocabUpdate(dict):
    versesToUpdate = list(dict.keys())

    allMassColumns = ["first_edition", "second_edition", "mayhew", "zeroth_edition"]
    columnToPrefixDict = {
        "first_edition": "2",
        "second_edition": "3",
        "mayhew": "5",
        "zeroth_edition": "7"
    }

    verseIDsToUpdate = {}
    for genericVerseID in versesToUpdate:
        verseIDsToUpdate[genericVerseID] = []
        columnsToUpdate = dict[genericVerseID]
        for column in columnsToUpdate:
            if column in allMassColumns:
                editionVerseID = columnToPrefixDict[column] + genericVerseID[1:]
                verseIDsToUpdate[genericVerseID].append(editionVerseID)

    return verseIDsToUpdate

def updateVerseToWord(connection, verse_id, word_dict):
    cursor = connection.cursor()
    
    # Convert word_dict into two arrays
    words = list(word_dict.keys())
    counts = [word_dict[word] for word in words]
    
    try:
        # First check if verse exists
        cursor.execute("SELECT 1 FROM verses_to_words WHERE verse_id = %s", (int(verse_id),))
        verse_exists = cursor.fetchone() is not None
        
        if verse_exists:
            # Update existing verse with explicit type casting
            cursor.execute("""
                UPDATE verses_to_words 
                SET words = %s::varchar[], counts = %s::int2[]
                WHERE verse_id = %s
            """, (words, counts, int(verse_id)))
        else:
            # Insert new verse with explicit type casting
            cursor.execute("""
                INSERT INTO verses_to_words (verse_id, words, counts)
                VALUES (%s, %s::varchar[], %s::int2[])
            """, (int(verse_id), words, counts))
            
        connection.commit()
        
    except Exception as e:
        connection.rollback()
        print(f"Error updating verse {verse_id}: {e}")
    finally:
        cursor.close()


def cleanGhostWords(connection, validWords):
    """
    Removes any words from words_mass that don't exist in the current texts
    """
    cursor = connection.cursor()
    try:
        cursor.execute("SELECT headword FROM words_mass")
        db_words = set(row[0] for row in cursor.fetchall())
        
        # Find words in DB that don't exist in any current texts
        ghost_words = db_words - set(validWords)
        
        if ghost_words:
            print(f"Removing {len(ghost_words)} ghost words...")
            cursor.execute("DELETE FROM words_mass WHERE headword = ANY(%s)", (list(ghost_words),))
            connection.commit()
            
    except Exception as e:
        connection.rollback()
        print(f"Error cleaning ghost words: {e}")
    finally:
        cursor.close()

def updateWordToVerse(connection, word, verse_dict):
    """
    Updates the words_mass table for a given word, handling removals and edition updates
    """
    cursor = connection.cursor()
    no_diacritics = cleanDiacritics(word)
    
    try:
        # First check if word exists
        cursor.execute("SELECT verses, counts, editions FROM words_mass WHERE headword = %s", (word,))
        row = cursor.fetchone()
        
        current_verses = list(verse_dict.keys())
        current_counts = [verse_dict[verse] for verse in current_verses]
        current_verses = [int(verse) for verse in current_verses]
        
        # Calculate which editions this word appears in
        editions_present = set()
        for verse in current_verses:
            edition_num = int(str(verse)[0])
            if edition_num in [2, 3, 5, 7]:  # Mass editions only
                editions_present.add(edition_num)
        
        # Calculate editions number from the set of present editions
        editions = 1
        for ed in editions_present:
            editions *= ed
        
        if row:
            if not current_verses:
                # Word no longer exists in any verse - delete it
                cursor.execute("DELETE FROM words_mass WHERE headword = %s", (word,))
            else:
                cursor.execute("""
                    UPDATE words_mass 
                    SET verses = %s::int8[], 
                        counts = %s::int2[],
                        editions = %s,
                        total_count = %s,
                        no_diacritics = %s
                    WHERE headword = %s
                """, (current_verses, current_counts, editions, sum(current_counts), no_diacritics, word))
        elif current_verses:  # Only insert if the word actually appears somewhere
            cursor.execute("""
                INSERT INTO words_mass (headword, verses, counts, editions, total_count, no_diacritics)
                VALUES (%s, %s::int8[], %s::int2[], %s, %s, %s)
            """, (word, current_verses, current_counts, editions, sum(current_counts), no_diacritics))
            
        connection.commit()
        
    except Exception as e:
        connection.rollback()
        print(f"Error updating word {word}: {e}")
    finally:
        cursor.close()


def updateAllVocab(connection, dict, textRecords):
    textObjects = textRecords["textObjects"]
    editions = textRecords["editions"]

    wordToVerseDict = {}
    verseToWordDict = {}
   
    for i in range(len(editions)):
        edition = editions[i]
        thisEditionTextObject = textObjects[i]
        
        thisAddressList = thisEditionTextObject["allAddresses"]
        thisVerseToWord = thisEditionTextObject["verseToWord"]
        thisWordToVerse = thisEditionTextObject["wordToVerse"]

        thisEditionAllWords = list(thisWordToVerse.keys()) 
        for verse_id, word_counts in thisVerseToWord.items():
            verseToWordDict[verse_id] = word_counts

        for word in thisEditionAllWords:
            if word not in wordToVerseDict:
                wordToVerseDict[word] = {}
            for address, count in thisWordToVerse[word].items():
                wordToVerseDict[word][address] = count

    addressList = list(verseToWordDict.keys())
    
    startUpdatingVerseTime = time.time()
    for i in range(len(addressList)):
        address = addressList[i]
        if address[0] in ["2", "3", "5", "7"]:
            updateVerseToWord(connection, address, verseToWordDict[address])

        if (i % 20 == 19):
            print(f"{i + 1}/{len(addressList)} addresses updated in verses_to_words")
    stopUpdatingVerseTime = time.time()
    updateVerseSeconds = stopUpdatingVerseTime - startUpdatingVerseTime
    updateVerseMinutes = math.floor(updateVerseSeconds / 60)
    secondsLeftOver = math.ceil(updateVerseSeconds % 60)


    print(f"Finished updating verses_to_words ({updateVerseMinutes} minutes, {secondsLeftOver} seconds)")


    startUpdatingWordTime = time.time()
    validWords = set()
    for textObject in textObjects:
        # Handle verse->word mapping
        for verse_id, word_counts in textObject["verseToWord"].items():
            verseToWordDict[verse_id] = word_counts
            validWords.update(word_counts.keys())
            
        # Handle word->verse mapping
        for word, verse_counts in textObject["wordToVerse"].items():
            if word not in wordToVerseDict:
                wordToVerseDict[word] = {}
            wordToVerseDict[word].update(verse_counts)


     # Update words_mass and clean up ghost words
    total_words = len(wordToVerseDict)
    for i, (word, verse_counts) in enumerate(wordToVerseDict.items(), 1):
        updateWordToVerse(connection, word, verse_counts)
        print(f"Updating word {i}/{total_words} ({word})")
    stopUpdatingWordTime = time.time()
    updateWordSeconds = stopUpdatingWordTime - startUpdatingWordTime
    updateWordMinutes = math.floor(updateWordSeconds / 60)
    secondsLeftOver = math.ceil(updateWordSeconds % 60)
    print(f"Finished updating words_mass ({updateWordMinutes} minutes, {secondsLeftOver} seconds)")
        
                
        

        
        
    '''
    genericVerseUpdateList = list(dict.keys())
    verseUpdateDict = getVerseIDsForVocabUpdate(dict) # E.g.: ['2063001001', '3063001001'...]
    #print(verseUpdateList)
    # print(dict)
    versesToUpdate = list(verseUpdateDict.keys())
    firstVerseToUpdate = genericVerseUpdateList[0]

    # print(textObjects[firstVerseToUpdate])

    firstVerseText = textObjects[firstVerseToUpdate]

    for genericVerse in genericVerseUpdateList:
        verseTexts = textObjects[genericVerse]
        #print(verseTexts)
        updateTheseVerses = verseUpdateDict[genericVerse]
        for specificVerse in updateTheseVerses:
            thisVerseText = verseTexts[specificVerse]
            updateVerseVocab(connection, int(specificVerse))
    '''
    
def writeWordsToTextFile(words):

    return



def main(clearTables=False):
    try:
        connection = psycopg2.connect(DATABASE_URL)
        if clearTables:
            clear_tables(connection)
        
        textRecords = getTextObjects()
        timestamp = textRecords["timestamp"]
        textObjects = getTextDict(textRecords["textObjects"])
        editions = textRecords["editions"]
        allVerseGenerics = list(textObjects.keys())

        #print(allVerseGenerics)
        vocabUpdateDict = grabExistingText(connection, allVerseGenerics, editions, textObjects)

        try:
            updateAllVocab(connection, vocabUpdateDict, textRecords)
            endTime = time.time()
            totalTime = endTime - timestamp
            totalMinutes = math.floor(totalTime / 60)
            secondsLeftOver = totalTime % 60
            print(f"Finished updating all vocab ({totalMinutes} minutes, {secondsLeftOver} seconds)")
        except Exception as e:
            print("Error in updateAllVocab:")
            import traceback
            print(traceback.format_exc())
            raise e
    except Exception as e:
        print(f"Connection failed: {e}")

#clear = True

def delete_by_book(table_name: str, book_value: str) -> None:
    try:
        # Connect to database using the existing DATABASE_URL
        conn = psycopg2.connect(DATABASE_URL)
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cur = conn.cursor()

        # Execute delete query
        delete_query = f"DELETE FROM {table_name} WHERE book = %s"
        cur.execute(delete_query, (book_value,))
        
        print(f"Deleted rows where book = {book_value}")

    except Exception as e:
        print(f"An error occurred: {e}")
    
    finally:
        # Close database connection
        if cur:
            cur.close()
        if conn:
            conn.close()


# Usage example:
#delete_by_book('all_verses', 'Luke')
main()
