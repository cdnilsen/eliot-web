# This is a program to fetch the Hebrew from the old repository and turn it into, more or less, HTML. It is going to be frickin ugly.

import os
import unicodedata

sourceFolder = '../eliotweb (old)/Hebrew XML/'
allFiles = os.listdir(sourceFolder)



            
def normalizeWord(word):
    return unicodedata.normalize("NFKD", word).encode("ascii", "ignore").decode("utf-8").strip();

def grabHapaxes(book):
    hapaxDict = {}
    hapaxList = '../eliotweb (old)/OTHapaxList.txt'
    hapaxLines = open(hapaxList, 'r', encoding="utf-8").readlines()

    finalList = []
    for line in hapaxLines:
        splitLine = line.split("|")
        bookName = splitLine[0].strip()
    
        if bookName == book:
            rawHapaxes = splitLine[1].strip().split(",")
            for hapax in rawHapaxes:
                finalList.append(normalizeWord(hapax))

    return finalList
                

def splitXMLLine(line, hapaxDict, currentChapter, currentVerse):
    allTags = ["w", "q", "k"]
    line = line.strip()
    for tag in allTags:
        if "<" + tag + ">" in line:
            splitLine = line.split("<" + tag + ">")
            for word in splitLine:
                if "</" + tag + ">" in word:
                    splitWord = word.split("</" + tag + ">")
                    word = normalizeWord(splitWord[0])
                    if word in hapaxDict:
                        hapaxDict[word] = True
                        if (tag == "q"):
                            print(line)
                            print("Hapax qere at " + currentChapter + "." + currentVerse + ": " + word)
                        elif (tag == "k"):
                            print("Hapax ketiv at " + currentChapter + "." + currentVerse + ": " + word)
    if line.strip().startswith("<c n="):
        #print(line)
        currentChapter = line.strip()
        #print(currentChapter)
    if line.strip().startswith("<v n="):
        #print(line)
        currentVerse = line.strip()


def grabXML(book):
    hapaxList = grabHapaxes(book)
    hapaxDict = {}
    currentChapter = ""
    currentVerse = ""
    for hapax in hapaxList:
        hapaxDict[hapax] = False
    for file in allFiles:
        if book in file:
            xmlLines = open(sourceFolder + file, 'r', encoding="utf-8").readlines()
            for line in xmlLines:
                #print(line)
                splitXMLLine(line, hapaxDict, currentChapter, currentVerse)

    for hapax in hapaxDict:
        if hapaxDict[hapax] == False:
            print(hapax + " is not in the text!")
                

grabHapaxes("Song of Songs")
grabXML("Song of Songs")