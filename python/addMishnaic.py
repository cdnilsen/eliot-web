# oh man this is going to be a shitshow
# Run with:
# py -3.12 -m addMishnaic.py

import os
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
from psycopg2.extras import execute_values
from library import bookToIDDict, cleanDiacritics, cleanWord
import time
import math
import asyncio

DATABASE_URL = os.environ.get('DATABASE_URL', 'postgresql://postgres:Cb4-D5B2BEEg6*GBBB*Fga*b5FE6CbfF@monorail.proxy.rlwy.net:14224/railway')

textToIDDict = {
    "Family Religion": "068",
    "Milk for Babes": "069",
    "Lord's Day": "070"
}

textNames = [
    "Family Religion",
    "Milk for Babes",
    "Lord's Day"
]



def preprocessLine(line):
    line = line.strip()
    line = line.replace("|", " ")
    line = line.replace("ṣ", "s")
    line = line.replace("ṡ", "s")

    return line

def getIDTuple(document, ID, verseNumberDict):
    idDict = verseNumberDict[ID]

    chapter = int(ID[4:7])
    verse = int(ID[7:])

    textColumns = ["First Edition", "Second Edition", "Mayhew", "Zeroth Edition", "KJV", "Grebrew"]

    textColumnDict = {}

    for edition in textColumns:
        if edition in idDict:
            textColumnDict[edition] = verseNumberDict[ID][edition]["text"]
        else:
            textColumnDict[edition] = ""

    tuple = (
        int(ID),
        document,
        chapter,
        verse,
        textColumnDict["First Edition"],
        textColumnDict["Second Edition"],
        textColumnDict["Mayhew"],
        textColumnDict["Zeroth Edition"],
        textColumnDict["KJV"],
        textColumnDict["Grebrew"]
    )
    #print(tuple)

    return tuple


def getIDFromAddress(document, address):
    idNum = "1" + textToIDDict[document]
    try:
        pageNum = getEnoughZeros(address.split(".")[0])
        verseNum = getEnoughZeros(address.split(".")[1])
        idNum = idNum + pageNum + verseNum

        return idNum
    except:
        print("Whoops! Line 78")
        print(address)


def getWordsAndCountsInObject(verseObject):
    splitText = verseObject["text"].replace("|", "")
    splitText = splitText.split(" ")
    
    if verseObject["isMass"]:
        allWords = []
        wordToCountDict = {}
        for word in splitText:
            cleanedWord = cleanWord(word)
            if cleanedWord in wordToCountDict:
                wordToCountDict[cleanedWord] += 1
            else:
                wordToCountDict[cleanedWord] = 1
                allWords.append(cleanedWord)
        allWords.sort()
        for cleanedWord in allWords:
            count = wordToCountDict[cleanedWord]
            verseObject["words"].append(cleanedWord)
            verseObject["counts"].append(count)

        

    return verseObject

def getVerseObject(text, address, documentName, verseID, edition):
    editionDict = {
        "First Edition": "2",
        "Mayhew": "5",
        "KJV": "4"
    }

    columnDict = {
        "First Edition": "first_edition",
        "Mayhew": "mayhew",
        "KJV": "kjv"
    }

    object = {
        "chapter": int(address.split(".")[0]),
        "verse": int(address.split(".")[1]),
        "genericID": verseID, # already a string
        "specificID": editionDict[edition] + verseID[1:],
        "text": text,
        "words": [],
        "counts": [],
        "isMass": edition != "KJV",
        "column": columnDict[edition]
    }

    object = getWordsAndCountsInObject(object)

    return object
    

def processTextToDict(documentName):

    # This is kludge but who cares
    if documentName == "Lord's Day":
        documentName = "Lord's Day.Mayhew"
    file = open("../texts/" + documentName + ".txt", "r", encoding="utf-8")
    
    if documentName == "Lord's Day.Mayhew":
        documentName = "Lord's Day"

    verseNumberDict = {}


    rawTextDict = {}
    genericIDList = []
    editions = []
    for line in file.readlines():
        if line.strip() == "":
            continue
        edition = ""
        try:
            address = line.split(" ")[0]
            if address.endswith("E"):
                edition = "KJV"
            elif address.endswith("M"):
                edition = "First Edition"
            elif address.endswith("μ"):
                edition = "Mayhew"

            try:
                verseNumber = getIDFromAddress(documentName, address)
            except:
                print("Error (line 162) at " + address)

            text = preprocessLine(" ".join(line.split(" ")[1:]).strip())
            
            if edition != "":
                if edition not in editions:
                    editions.append(edition)
                if verseNumber not in verseNumberDict:
                    verseNumberDict[verseNumber] = {}
                verseNumberDict[verseNumber][edition] = text

                thisVerseObject = getVerseObject(text, address, documentName, verseNumber, edition)
                genericID = thisVerseObject["genericID"]

                if genericID not in rawTextDict:
                    rawTextDict[genericID] = {}
                    genericIDList.append(genericID)
                
                rawTextDict[genericID][edition] = thisVerseObject
                #process word editions goes here
                

        except:
            continue

    object = {
        "book": documentName,
        "dict": rawTextDict,
        "IDs": genericIDList,
        "editions": editions
    }

    return object


def getEnoughZeros(num):
    num = str(num)
    while len(num) < 3:
        num = "0" + num
    return num


def addTextToAllVerses(data, connection, cursor):
    #print(data)
    try:
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

# The version in this program is starting to get away from the version in processtexts3.py, but w/e
def getMassWordTuples(verseToWordTupleList):
    allWordsMassTuples = []
    allWords = []
    wordToDataDict = {}
    for tuple in verseToWordTupleList:
        specificID = tuple[0]
        wordList = tuple[1]
        countList = tuple[2]

        for i in range(len(wordList)):
            word = wordList[i]
            count = countList[i]
            if word not in wordToDataDict:
                allWords.append(word)
                wordToDataDict[word] = {}

            wordToDataDict[word][str(specificID)] = count
    
    for word in allWords:

        allIDs = list(wordToDataDict[word].keys())
        idList = []
        countList = []
        for id in allIDs:
            idList.append(int(id))
            countList.append(wordToDataDict[word][id])
        

        lemma = "" # for now
        noDiacritics = cleanDiacritics(word)
        editionNum = 1 # fix later; probably doesn't work for these
        totalCount = sum(countList)

        # In processtexts3, looks like:
        '''
        ('negonne', [2001001005, 3001001005, 7001001005, 2001002005, 3001002005, 7001002005, 2001008005, 3001008005, 7001008005, 2001008013, 3001008013, 7001008013, 2001013004, 3001013004, 7001013004, 7001025025, 2001026001, 3001026001, 7001026001, 2001028019, 3001028019, 7001028019, 3001029026, 2001032021, 3001032021, 7001032021, 2001038028, 3001038028, 7001038028], [1, 1, 1, 1, 1, 1, 1, 1, 1, 3, 3, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], '', 'negonne', 1, 35)
        '''
        tuple = (word, idList, countList, lemma, noDiacritics, editionNum, totalCount)

        

        allWordsMassTuples.append(tuple)

    print(allWordsMassTuples[50])
    return allWordsMassTuples

def processWords(object, connection, cursor):
    verseToWordTuples = []
    allIDs = object["IDs"]

    for id in allIDs:
        superdict = object["dict"][id]
        editions = list(superdict.keys())
        for edition in editions:
            if edition != "KJV":
                thisDict = superdict[edition]
                wordList = thisDict["words"]
                countList = thisDict["counts"]
                specificID = thisDict["specificID"]

                tuple = (int(specificID), wordList, countList)
                verseToWordTuples.append(tuple)

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
        execute_values(cursor, insert_query, verseToWordTuples)
        connection.commit()
    except Exception as e:
        connection.rollback()
        raise Exception(f"Error inserting into verses_to_words: {str(e)}")

    # add to words_mass
    allWordsMassTuples =  getMassWordTuples(verseToWordTuples)

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

def processDocument(document, connection):
    cursor = connection.cursor()

    textDict = processTextToDict(document)
    allAddresses = textDict["IDs"]

    data = []
    for address in allAddresses:
        try:
            data.append(getIDTuple(document, address, textDict["dict"]))
        except:
            print(address)
            print("Hello! Line 203")
            print(textDict[address])

    # Add text to all_verses
    addTextToAllVerses(data, connection, cursor)

    # Add words
    processWords(textDict, connection, cursor)


        
def main(documentList):
    connection = psycopg2.connect(DATABASE_URL)
    for document in documentList:
        processDocument(document, connection)
    



documentList = ["Milk for Babes", "Family Religion", "Lord's Day"]

main(documentList)