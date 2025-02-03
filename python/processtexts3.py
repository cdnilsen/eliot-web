# Run with:
# py -3.12 -m processtexts3.py

import os
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
from psycopg2.extras import execute_values
from library import bookToIDDict, cleanDiacritics, cleanWord
import time
import math
import asyncio

DATABASE_URL = os.environ.get('DATABASE_URL', 'postgresql://postgres:Cb4-D5B2BEEg6*GBBB*Fga*b5FE6CbfF@monorail.proxy.rlwy.net:14224/railway')

def clear_tables(connection):
    areYouSure = input("THIS WILL DELETE ALL YOUR DATA FROM ALL YOUR TABLES.\nIF YOU'RE SURE, TYPE 'YES' (ALL CAPS): ")
    if areYouSure != "YES":
        print("Aborting")
        return
    else:
        cursor = connection.cursor()

        executeStatement = ""
        whichTable = input("Which table would you like to clear?\n(1) all_verses\n(2) verses_to_words\n(3) words_mass\n(4) words_kjv\n(5) all of them\n: ")

        if whichTable == "1":
            executeStatement = "DELETE FROM all_verses;"
        elif whichTable == "2":
            executeStatement = "DELETE FROM verses_to_words;"
        elif whichTable == "3":
            executeStatement = "DELETE FROM words_mass;"
        elif whichTable == "4":
            executeStatement = "DELETE FROM words_kjv;"
        elif whichTable == "5":
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

def alphabetizeMass(words: list[str]) -> list[str]:
    def getOrdering(word: str) -> tuple:
        return tuple(999 if c == '8' else ord(c) for c in word)
    
    return sorted(words, key=getOrdering)


def addZeros(number):
    while (len(number) < 3):
        number = "0" + number
    return number

def getIDTail(bookID, object):
    chapter = addZeros(str(object["chapter"]))
    verse = addZeros(str(object["verse"]))

    return bookID + chapter + verse

def getVerseObject(line, bookID, edition):

    splitLine = line.split(" ")
    address = splitLine[0].strip()
    text = " ".join(splitLine[1:])

    editionDict = {
        "First Edition": "2",
        "Second Edition": "3",
        "Mayhew": "5",
        "Zeroth Edition": "7",
        "KJV": "4",
        "Grebrew": "8"
    }

    columnDict = {
        "First Edition": "first_edition",
        "Second Edition": "second_edition",
        "Mayhew": "mayhew",
        "Zeroth Edition": "zeroth_edition",
        "KJV": "kjv",
        "Grebrew": "grebrew"
    }

    editionID = editionDict[edition]

    object = {
        "chapter": 999,
        "verse": 999,
        "genericID": "1" + bookID + "999999",
        "specificID": editionID + bookID + "999999",
        "text": text,
        "words": [],
        "counts": [],
        "isMass": edition != "Grebrew" and edition != "KJV",
        "column": columnDict[edition]
    }

    if "." in address:
        splitAddress = address.split(".")
        object["chapter"] = int(splitAddress[0])
        object["verse"] = int(splitAddress[1])
        idTail = getIDTail(bookID, object)
        object["genericID"] = "1" + idTail
        object["specificID"] = editionID + idTail

    splitText = text.split(" ")
    if edition != "Grebrew" and edition != "KJV":
        wordToCountDict = {}
        for word in splitText:
            word = cleanWord(word)
            if word in wordToCountDict:
                wordToCountDict[word] += 1
            else:
                wordToCountDict[word] = 1
                object["words"].append(word)

        for word in object["words"]:
            object["counts"].append(wordToCountDict[word])

    return object

def updateAddresses(newAddresses, newCounts, oldAddressList, oldCountList):
    oldCountDictionary = {}
    for i in range(len(oldAddressList)):
        oldCountDictionary[oldAddressList[i]] = oldCountList[i]

    newCountDictionary = {}
    for i in range(len(newAddresses)):
        newCountDictionary[newAddresses[i]] = newCounts[i]



    object = {
        "addresses": [],
        "counts": [],
        "delete": []
    }
    return object


def updateMassWord(connection, headwords, newHeadwordRawObject):
    cursor = connection.cursor()
    try:
        cursor.execute("SELECT * FROM words_mass WHERE headword = ANY(%s)", (headwords,))
        rows = cursor.fetchall()

        existingHeadwords = {}
        newHeadwords = []
        for row in rows:
            headword = row[0]
            oldObject = {
                "addresses": row[1],
                "counts": row[2],
                "lemma": row[3],
                "noDiacritics": row[4],
                "editionNum": row[5],
                "totalCount": row[6]
            }

            existingHeadwords[headword] = oldObject

        for newHeadword in newHeadwordRawObject:
            if newHeadword in existingHeadwords:
                oldObject = existingHeadwords[newHeadword]
                newObject = updateMassWordObject(connection, oldObject)
            else:
                newHeadwords.append(newHeadword)
                newObject = newHeadwordRawObject[newHeadword]

            newObject = updateMassWordObject(connection, oldObject)
            
        for headword in headwords:
            if headword not in existingHeadwords:
                newHeadwords.append(headword)

        print(newHeadwords)
        return rows
    except Exception as e:
        connection.rollback()
        print(f"Error updating words: {e}")

7866588508
def addRawText(connection, bookObject, updateKJV=False):
    cursor = connection.cursor()

    allEditions = [
        "First Edition",
        "Second Edition",
        "Mayhew",
        "Zeroth Edition",
        "KJV",
        "Grebrew"
    ]

    editionsPresent = []
    for edition in bookObject["editions"]:
        if edition in allEditions:
            editionsPresent.append(edition)

    genericIDList = bookObject["IDs"]
    rawTextDict = bookObject["dict"]
    book = bookObject["book"]

    oldDataList = []
    oldDataDict = {}

    cursor.execute("SELECT * FROM all_verses WHERE book = %s", (book,))
    rows = cursor.fetchall()
    for existingTuple in rows:
        stringID = str(existingTuple[0])
        oldDataList.append(stringID)
        oldDataDict[stringID] = existingTuple

    newDataList = []
    newDataDict = {}
    lastChapter = 0
    for genericID in genericIDList:
        subobject = rawTextDict[genericID]
        for edition in allEditions:
            if edition not in subobject:
                subobject[edition] = ""
        
        if len(genericID) == 10:
            chapter = int(genericID[4:7])
            verse = int(genericID[7:10])
            lastChapter = chapter
        else:
            chapter = lastChapter
            verse = 999
        tuple = (
            int(genericID),
            book,
            chapter,
            verse,
            subobject["First Edition"],
            subobject["Second Edition"],
            subobject["Mayhew"],
            subobject["Zeroth Edition"],
            subobject["KJV"],
            subobject["Grebrew"]
        )
        newDataList.append(genericID)
        newDataDict[genericID] = tuple
    

    idsToAdd = []
    idsToChange = []

    changeAnything = False
    changeMass = False
    for id in newDataList:
        if id in oldDataDict and id in newDataDict:
            oldTuple = oldDataDict[id]
            newTuple = newDataDict[id]
            for i in range(len(newTuple)):
                if newTuple[i] != oldTuple[i]:
                    idsToAdd.append(id)
                    if (i > 3 and i < 8):
                        changeMass = True
                    break
        elif id in newDataDict:
            idsToAdd.append(id)

    if len(idsToAdd) > 0:
        changeAnything = True
        data = []
        for id in idsToAdd:
            data.append(newDataDict[id])
        try:
            original_start_time = time.time()
            start_time = time.time()
            insert_query = """
            INSERT INTO all_verses (
                verse_id, book, chapter, verse, first_edition, 
                second_edition, mayhew, zeroth_edition, kjv, grebrew
            ) VALUES %s
            """
            execute_values(
            cursor, 
            insert_query, 
            data,
            page_size=50  # This handles batching internally in a more efficient way
            )
            final_end_time = time.time()
            print(f"Inserted {len(data)} rows in {final_end_time - start_time:.2f} seconds")
            connection.commit()
        except Exception as e:
            connection.rollback()
            print(f"Error inserting rows: {e}")

    # Now we need to deal with rows where the data has changed

    if len(idsToChange) > 0:
        try:
            for i in range(0, len(idsToChange), 50):
                batch_ids = idsToChange[i:i+50]
                batch_data = [newDataDict[id] for id in batch_ids]
                start_time = time.time()
                cursor.executemany("""
                    UPDATE all_verses 
                    SET book = %s, chapter = %s, verse = %s, 
                        first_edition = %s, second_edition = %s,
                        mayhew = %s, zeroth_edition = %s, 
                        kjv = %s, grebrew = %s
                    WHERE verse_id = %s
                """, [(t[1], t[2], t[3], t[4], t[5], t[6], t[7], t[8], t[9], t[0]) for t in batch_data])
                end_time = time.time()
                print(f"Updated rows {i}-{i+len(batch_ids)} in {end_time - start_time:.2f} seconds")
                connection.commit()
        except Exception as e:
            connection.rollback()
            print(f"Error updating rows: {e}")


    returnObject = {
            "changes": False,
            "additions": False,
            "idsToAdd": [],
            "idsToChange": [],
            "oldDict": {},
            "newDict": {},
            "updateKJVTable": updateKJV
    }
    
    changeAnything = changeAnything or changeMass
    if changeAnything:
        relevantIDs = idsToAdd + idsToChange
        returnObject = {
            "changes": True,
            "additions": changeMass,
            "idsToAdd": relevantIDs,
            "idsToChange": idsToChange,
            "oldDict": oldDataDict,
            "newDict": newDataDict,
            "updateKJVTable": updateKJV
        }
    
    return returnObject


def processBookToDict(bookName):
    fileDirectory = os.listdir("../texts")
    rightFiles = []
    for file in fileDirectory:
        if file.startswith(bookName):
            rightFiles.append(file)

    if(len(rightFiles) == 0):
        print("No files found for " + bookName)
        return None

    massVerseObjects = []
    nonMassVerseObjects = []

    rawTextDict = {}
    genericIDList = []
    editions = []
    for file in rightFiles:
        bookID = bookToIDDict[file.split(".")[0]]
        edition = file.split(".")[1]
        editions.append(edition)
        with open(f"../texts/{file}", "r", encoding="utf-8") as file:
            for line in file.readlines():
                line = line.strip()
                if line == "":
                    continue
                thisVerseObject = getVerseObject(line, bookID, edition)
                genericID = thisVerseObject["genericID"]
                if genericID not in rawTextDict:
                    rawTextDict[genericID] = {}
                    genericIDList.append(genericID)
                
                rawTextDict[genericID][edition] = thisVerseObject["text"]
    
    object = {
        "book": bookName,
        "dict": rawTextDict,
        "IDs": genericIDList,
        "editions": editions
    }

    return object


def getWordsFromText(text):
    if text.strip() == "":
        return {
            "words": [],
            "counts": {}
        }
    
    splitText = text.split(" ")
    wordList = []
    countDict = {}
    for word in splitText:
        word = cleanWord(word)
        if word not in wordList:
            wordList.append(word)
            countDict[word] = 1
        else:
            countDict[word] += 1
    return {
        "words": wordList,
        "counts": countDict
    }


def getEditionTextDict(rowTuple):
    addressTail = str(rowTuple[0])[1:]
    return {
        "addresses": ["2" + addressTail, "3" + addressTail, "5" + addressTail, "7" + addressTail],
        "2" + addressTail: rowTuple[4],
        "3" + addressTail: rowTuple[5],
        "5" + addressTail: rowTuple[6],
        "7" + addressTail: rowTuple[7],
    }

def getWordAdditions(object):
    idList = []
    allWordList = []
    wordToVerseDict = {}
    verseToWordDict = {}
    for key in object["newDict"]:
        tuple = object["newDict"][key]
        #print(tuple)
        textDict = getEditionTextDict(tuple)
        editionAddresses = textDict["addresses"]

        for address in editionAddresses:
            text = textDict[address].strip()
            if text.strip() == "":
                continue
            idList.append(address)
            wordObject = getWordsFromText(text)
            verseToWordDict[address] = wordObject["counts"]
            for i in range(len(wordObject["words"])):
                word = wordObject["words"][i]
                if word.strip() == "":
                    continue
                count = wordObject["counts"][word]
                verseToWordDict[word] = count

                if word not in wordToVerseDict:
                    wordToVerseDict[word] = {
                        address: count
                    }
                    allWordList.append(word)
                else:
                    if address not in wordToVerseDict[word]:
                        wordToVerseDict[word][address] = count
                    else:
                        wordToVerseDict[word][address] += count
    object = {
        "ids": idList,
        "words": allWordList,
        "wordToVerse": wordToVerseDict,
        "verseToWord": verseToWordDict
    }

    return object


def processWordAdditions(connection, object):
    cursor = connection.cursor()

    # Add to verses_to_words
    allTuples = []
    for id in object["ids"]:
        thisIDDict = object["verseToWord"][id]
        wordList = alphabetizeMass(thisIDDict.keys())
        countList = []
        for word in wordList:
            countList.append(thisIDDict[word])
        tuple = (int(id), wordList, countList)
        allTuples.append(tuple)
    
    # Batch insert into verses_to_words
    insert_query = """
        INSERT INTO verses_to_words (verse_id, words, counts)
        VALUES %s
        ON CONFLICT (verse_id) 
        DO UPDATE SET 
            words = EXCLUDED.words,
            counts = EXCLUDED.counts
    """
    
    try:
        execute_values(cursor, insert_query, allTuples)
        connection.commit()
    except Exception as e:
        connection.rollback()
        raise Exception(f"Error inserting into verses_to_words: {str(e)}")

    # add to words_mass
    allWordsMassTuples = []
    for word in object["words"]:
        if word.strip() == "":
            continue
        noDiacritics = cleanDiacritics(word)
        if word not in object["wordToVerse"]:
            print("Problem with word: " + word + " at " + str(object["wordToVerse"][word]))
            continue
        verseDict = object["wordToVerse"][word]
        addresses = []
        counts = []
        for address in verseDict:
            addresses.append(int(address))
            counts.append(verseDict[address])
        lemma = "" # For now.
        noDiacritics = cleanDiacritics(word)
        editionNum = 1 # fix this later
        totalCount = sum(counts)

        tuple = (word, addresses, counts, lemma, noDiacritics, editionNum, totalCount)

        allWordsMassTuples.append(tuple)

    words_query = """
        INSERT INTO words_mass (headword, verses, counts, lemma, no_diacritics, editions, total_count)
        VALUES %s
        ON CONFLICT (headword)
        DO UPDATE SET 
            verses = words_mass.verses || EXCLUDED.verses,
            counts = words_mass.counts || EXCLUDED.counts,
            lemma = EXCLUDED.lemma,
            no_diacritics = EXCLUDED.no_diacritics,
            editions = EXCLUDED.editions,
            total_count = words_mass.total_count + EXCLUDED.total_count
    """
    
    try:
        execute_values(cursor, words_query, allWordsMassTuples)
        connection.commit()
    except Exception as e:
        connection.rollback()
        raise Exception(f"Error inserting into words_mass: {str(e)}")
    finally:
        cursor.close()
    
def main(book=""):
    connection = psycopg2.connect(DATABASE_URL)
    if book == "":
        book = input("Enter book name: ")

    startAddBookTime = time.time()
    bookObject = processBookToDict(book)
    if bookObject is None:
        return
    
    rawTextChangeObject = addRawText(connection, bookObject)
    endAddBookTime = time.time()
    print(f"Finished processing text in {book} in {endAddBookTime - startAddBookTime:.2f} seconds")

    startWordTime = time.time()
    wordAdditionObject = getWordAdditions(rawTextChangeObject)
    processWordAdditions(connection, wordAdditionObject)
    endWordTime = time.time()
    print(f"Finished processing words from {book} in {endWordTime - startWordTime:.2f} seconds")


    '''
    startProcessWordsTime = time.time()
    if rawTextChangeObject["changes"]:
        if rawTextChangeObject["additions"]:
            processWordAdditions(rawTextChangeObject)
        processWordChanges(connection, rawTextChangeObject)
    endProcessWordsTime = time.time()

    if rawTextChangeObject["changes"]:
        print(f"Total time for {book}: {endProcessWordsTime - startAddBookTime:.2f} seconds")
    '''



def getNumWords(connection):
    cursor = connection.cursor()
    cursor.execute("SELECT COUNT(*) FROM words_mass")
    count = cursor.fetchone()[0]
    return count


def addToKJV(connection, book):
    currentTime = time.time()
    file = book + ".KJV.txt"
    cursor = connection.cursor()
    fileLines = []
    try:
        fileLines = open(f"../texts/{file}", "r", encoding="utf-8").readlines()
    except:
        print("Error opening file for " + book)
        return {}
    
    bookID = "1" + bookToIDDict[book]


    dict = {}
    for line in fileLines:
        splitLine = line.split(" ")
        address = splitLine[0].strip()
        chapter = address.split(".")[0]
        verse = address.split(".")[1]
        addressID = int(bookID + addZeros(chapter) + addZeros(verse))
        for word in splitLine[1:]:
            word = cleanWord(word)
            if word not in dict:
                dict[word] = [addressID]
            else:
                dict[word].append(addressID)

    allTuples = []
    allWords = list(dict.keys())
    for word in allWords:
        tuple = (word, dict[word])
        allTuples.append(tuple)
    try:
        execute_values(
            cursor,
            """
            INSERT INTO words_kjv (word, verses) 
            VALUES %s
            ON CONFLICT (word) DO UPDATE 
            SET verses = (
                SELECT ARRAY(
                    SELECT DISTINCT UNNEST(
                        words_kjv.verses || EXCLUDED.verses
                    )
                    ORDER BY 1
                )
            )
            """,
            allTuples,
            template="(%s, %s)",
            page_size=100
        )
        connection.commit()
        endTime = time.time()
        print(f"Finished processing KJV for {book} in {endTime - currentTime:.2f} seconds")
        return dict
    except Exception as e:
        connection.rollback()
        print(f"Error inserting rows: {e}")
        return {}
    finally:
        cursor.close()



'''
allFilesInTextFolder = os.listdir("../texts")
for file in allFilesInTextFolder:
    fileLines = open(f"../texts/{file}", "r", encoding="utf-8").readlines()
    if fileLines[1].startswith("α") or fileLines[1].startswith("β"):
        print(file)
'''


allBookList = [
    "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy",
    "Joshua", "Judges", "Ruth", "1 Samuel", "2 Samuel", "1 Kings", "2 Kings",
    "1 Chronicles", "2 Chronicles", "Ezra", "Nehemiah", "Esther",
    "Job", "Psalms (prose)", "Proverbs", "Ecclesiastes", "Song of Songs",
    "Isaiah", "Jeremiah", "Lamentations", "Ezekiel", "Daniel",
    "Hosea", "Joel", "Amos", "Obadiah", "Jonah", "Micah", "Nahum",
    "Habakkuk", "Zephaniah", "Haggai", "Zechariah", "Malachi",
    "Matthew", "Mark", "Luke", "John", "Acts",
    "Romans", "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians",
    "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians",
    "1 Timothy", "2 Timothy", "Titus", "Philemon", "Hebrews",
    "James", "1 Peter", "2 Peter", "1 John", "2 John", "3 John", "Jude", "Revelation"
    ]

def addAllKJV(connection):
    totalWords = 0
    allWordsDict = {}
    for book in allBookList:
        thisBookDict = addToKJV(connection, book)
        for word in thisBookDict:
            if word not in allWordsDict:
                totalWords += 1
    print(f"Total words in KJV: {totalWords}")

def fullReset():
    outerStartTime = time.time()
    connection = psycopg2.connect(DATABASE_URL)
    clear_tables(connection)
    for book in allBookList:
        main(book)
        
    print(f"Total time for all books: {time.time() - outerStartTime:.2f} seconds")
    totalWords = getNumWords(connection)
    print(f"Total Massachusett headwords in database: {totalWords}")
    addAllKJV(connection)

#connection = psycopg2.connect(DATABASE_URL)
#clear_tables(connection)
#addAllKJV(connection)



main()