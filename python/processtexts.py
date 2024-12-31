import os
from dotenv import load_dotenv
import psycopg2
from library import bookToIDDict

load_dotenv('vars.env')
DATABASE_URL = os.getenv('DATABASE_URL')

def clear_tables(connection):
    areYouSure = input("THIS WILL DELETE ALL YOUR DATA FROM ALL YOUR TABLES.\nIF YOU'RE SURE, TYPE 'YES' (ALL CAPS): ")
    if areYouSure != "YES":
        print("Aborting")
        return
    else:
        cursor = connection.cursor()
        try:
            cursor.execute("""
                DELETE FROM all_verses;
                DELETE FROM verses_to_words;
                DELETE FROM words_mass;
            """)
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
    #print(texts)
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
        
def processText(connection, textName):
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

    splitTextName = textName.split(".")
    book = splitTextName[0]
    edition = splitTextName[1]
    bookID = bookToIDDict[book]

    editionColumn = editionColumnDict[edition]   
    editionID = editionIDDict[edition]
    editionInt = int(editionID)

    isMass = (editionInt % 4 != 0)
    
    allEditionHeader = "1" + bookID
    thisEditionHeader = f"{editionID}{bookID}"

    file = open(f"../texts/{textName}", "r", encoding="utf-8")

    lines = file.readlines()
    totalLines = len(lines)
    for i in range(len(lines)):
        line = lines[i].strip()
        if line == "":
            continue

        splitLine = line.split()
        verseAddress = splitLine[0]

        chapter = "999"
        verse = "999"
        if ('.' in verseAddress):
            chapter = verseAddress.split(".")[0]
            verse = verseAddress.split(".")[1]

        lineID = getLineID(verseAddress)
        
        rawWords = splitLine[1:]
        verseText = " ".join(rawWords)

        allEditionsAddress = allEditionHeader + lineID
        thisEditionAddress = thisEditionHeader + lineID

        #print(allEditionsAddress)
        verseObject = {
            'address': int(allEditionsAddress),
            'book': book,
            'chapter': int(chapter),
            'verse': int(verse),
            
            'text': verseText,
            'column': editionColumn
        }

        updateAllVerses(connection, verseObject)

        if i % 10 == 0:
            print(f"{i}/{totalLines} lines processed")



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
    print(activeEditions)
    activeEditions = sorted(activeEditions, key=lambda x: allEditions.index(x))
    print(activeEditions)

    editionDict = {

    }

    editionPrompt = "Select the edition of the text you want to process:\n(0) all, "
    for i, edition in enumerate(activeEditions):
        editionPrompt += f"({i+1}) {edition}, "
        editionDict[str(i+1)] = edition
    editionPrompt = editionPrompt[:-2] + ": "

    editionChoice = input(editionPrompt).strip()

    #print(editionDict)

    textsToProcess = []
    if editionChoice == '0':
        for thisEdition in activeEditions:
            textsToProcess.append(bookName + "." + thisEdition + ".txt")
    else:
        edition = editionDict[editionChoice]
        for thisEdition in activeEditions:
            if edition in thisEdition:
                textsToProcess.append(bookName + "." + thisEdition + ".txt")

    print(textsToProcess)            

    for textName in textsToProcess:
        processText(connection, textName)
    
    

def main():
    try:
        connection = psycopg2.connect(DATABASE_URL)
        selectedText = getText(connection)
    except Exception as e:
        print(f"Connection failed: {e}")

main()