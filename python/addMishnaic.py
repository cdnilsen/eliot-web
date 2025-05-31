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
    "Milk for Babes"
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
            textColumnDict[edition] = verseNumberDict[ID][edition]
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

    return tuple


def getIDFromAddress(document, address):
    idNum = "1" + textToIDDict[document]
    try:
        pageNum = getEnoughZeros(address.split(".")[0])
        verseNum = getEnoughZeros(address.split(".")[1])
        idNum = idNum + pageNum + verseNum

        return idNum
    except:
        print(address)

    

def processTextToDict(documentName):
    if documentName == "Lord's Day":
        documentName = "Lord's Day.Mayhew"
    file = open("../texts/" + documentName + ".txt", "r", encoding="utf-8")
    
    if documentName == "Lord's Day.Mayhew":
        documentName = "Lord's Day"
    verseNumberDict = {}
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



            #verseNumber = address.split(".")[0] + "." + address.split(".")[1]
            try:
                verseNumber = getIDFromAddress(documentName, address)
                print("hmm")
                print(verseNumber)
            except:
                print(address)

            text = " ".join(line.split(" ")[1:]).strip()
            if edition != "":
                if verseNumber not in verseNumberDict:
                    verseNumberDict[verseNumber] = {}
                verseNumberDict[verseNumber][edition] = text

        except:
            continue

    return verseNumberDict


def getEnoughZeros(num):
    num = str(num)
    while len(num) < 3:
        num = "0" + num
    return num

def feedDocumentToDB(document, connection):
    cursor = connection.cursor()

    textDict = processTextToDict(document)
    print(textDict)
    allAddresses = list(textDict.keys())


    data = []
    for address in allAddresses:
        textEditions = list(textDict[address].keys())
        try:
            data.append(getIDTuple(document, address, textDict))
        except:
            print(address)
            print(textDict[address])


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
        
def main(documentList):
    connection = psycopg2.connect(DATABASE_URL)
    for document in documentList:
        feedDocumentToDB(document, connection)
    



documentList = ["Milk for Babes", "Family Religion", "Lord's Day"]

main(documentList)