import os

def getFiles(edition):
    fileDirectory = os.listdir('../texts')
    rightFiles = []
    for file in fileDirectory:
        if file.endswith(edition + ".txt"):
            rightFiles.append(file)
    
    return rightFiles

def cleanLine(line):
    line = " ".join(line.split(" ")[1:])

    line = line.replace("|", " ")
    punctuation = [".", ",", ";", "?", "!", "-", ":", "'", '"', "(", ")", "{", "}", "$", "[", "]"]

    for char in punctuation:
        line = line.replace(char, "")

    line = line.lower()

    return line.split(" ")

def getWordSequences(word):
    if len(word) < 4:
        dict = {
            word: 1
        }
        return dict
    
    dict = {}
    for i in range(len(word) - 2):
        sequence = word[i:i+3]
        if sequence not in dict:
            dict[sequence] = 1
        else:
            dict[sequence] += 1

    return dict

def getLineSequences(line):
    wordList = cleanLine(line)

    sequenceToTokenDict = {}
    sequenceToWordDict = {}

    for word in wordList:
        wordDict = getWordSequences(word)
        sequenceList = list(wordDict.keys())
        for sequence in sequenceList:
            if sequence in sequenceToTokenDict:
                sequenceToTokenDict[sequence] += wordDict[sequence]
            else:
                sequenceToTokenDict[sequence] = wordDict[sequence]
            if sequence in sequenceToWordDict:
                sequenceToWordDict[sequence].append(word)
            else:
                sequenceToWordDict[sequence] = [word]

    dict = {
        "counts": sequenceToTokenDict,
        "words": sequenceToWordDict
    }
    return dict
    

def getFileSequences(fileName):
    file = open('../texts/' + fileName, "r", encoding="utf-8")

    sequenceDict = {}

    for line in file.readlines():
        line = line.strip()
        if line != "":
            thisLineDict = getLineSequences(line)["counts"]
            allSequences = list(thisLineDict.keys())
            for sequence in allSequences:
                if sequence in sequenceDict:
                    sequenceDict[sequence] += thisLineDict[sequence]
                else:
                    sequenceDict[sequence] = thisLineDict[sequence]

    file.close()

    return sequenceDict

def getFullSequenceDict():
    allEditions = ["First Edition", "Second Edition", "Zeroth Edition", "Mayhew"]
    allSequenceDict = {}

    for edition in allEditions:
        for file in getFiles(edition):
            thisFileDict = getFileSequences(file)
            for sequence in thisFileDict:
                if sequence in allSequenceDict:
                    allSequenceDict[sequence] += thisFileDict[sequence]
                else:
                    allSequenceDict[sequence] = thisFileDict[sequence] # I should write a function for this...

    

    

    #print(f"{str(hapaxCount)} hapax sequences of {str(totalSequenceCount)} tokens of {str(len(allSequences))} sequences")

    return allSequenceDict


def grabOneKJVVerses(fileName, englishString):
    openedFile = open('../texts/' + fileName, 'r', encoding='utf-8')
    
    matchingLines = []

    fileLines = openedFile.readlines()
    for line in fileLines:
        address = line.split(" ")[0]
        words = cleanLine(line)
        for word in words:
            if word == "":
                continue
            if englishString in word:
                matchingLines.append(address)

    return matchingLines


def grabKJVVerses(englishString):
    allFiles = getFiles("KJV")

    dictOfMatches = {}
    for file in allFiles:
        book = file.split(".")[0].strip()
        matches = grabOneKJVVerses(file, englishString)
        if len(matches) > 0:
            dictOfMatches[book] = grabOneKJVVerses(file, englishString)

    return dictOfMatches

def grabMassVerses(book, verseList):
    fileDirectory = os.listdir('../texts')
    rightFiles = []
    for file in fileDirectory:
        if file.startswith(book) and not (file.endswith("KJV.txt") or file.endswith("Grebrew.txt")):
            rightFiles.append(file)
    
    matchingLines = []
    for file in rightFiles:
        openedFile = open("../texts/" + file, "r", encoding="utf-8")
        fileLines = openedFile.readlines()
        for line in fileLines:
            line = line.strip()
            address = line.split(" ")[0]
            if address in verseList:
                cleanedLine = " ".join(line.split(" ")[1:])
                matchingLines.append(cleanedLine)

    return matchingLines


def protoTagger():
    tagWhat = input("Tag an English string: ").lower().strip()

    matchingKJV = grabKJVVerses(tagWhat)
    massachusettSequenceDict = getFullSequenceDict()

    allSequences = list(massachusettSequenceDict.keys())
    allSequences.sort(key=lambda sequence: massachusettSequenceDict[sequence])

    hapaxCount = 0
    totalSequenceCount = 0
    for sequence in allSequences:
        count = massachusettSequenceDict[sequence]
        if count == 1:
            hapaxCount += 1
        totalSequenceCount += count

    matchingLineCountDict = {}
    sequenceToWordDict = {}
    matchingLineSequenceCount = 0
    for book in list(matchingKJV.keys()):
        verseList = matchingKJV[book]
        matchingLines = grabMassVerses(book, verseList)
        for line in matchingLines:
            lineSequenceDict = getLineSequences(line)
            lineSequences = list(lineSequenceDict["counts"].keys())
            for sequence in lineSequences:
                count = lineSequenceDict["counts"][sequence]
                matchingLineSequenceCount += count
                words = lineSequenceDict["words"][sequence]
                if sequence not in matchingLineCountDict:
                    matchingLineCountDict[sequence] = count
                    sequenceToWordDict[sequence] = words
                else:
                    matchingLineCountDict[sequence] += count
                    for word in words:
                        sequenceToWordDict[sequence].append(word)
        
    matchingLineSequences = list(matchingLineCountDict.keys())
    matchingLineSequences.sort()

    highestRatio = 0
    highestSequence = ""
    totalCountsTheseVerses = 0
    totalCountsAllVerses = 0
    words = []
    for sequence in matchingLineSequences:
        try:
            matchingVersesCount = matchingLineCountDict[sequence]
            allVersesCount = massachusettSequenceDict[sequence]
            backgroundRatio = allVersesCount / totalSequenceCount
            lineRatio = matchingVersesCount / matchingLineSequenceCount

            thisSequenceRatio = lineRatio / backgroundRatio

            if thisSequenceRatio > highestRatio:
                highestRatio = thisSequenceRatio
                highestSequence = sequence
                totalCountsTheseVerses = count
                totalCountsAllVerses = massachusettSequenceDict[sequence]
                words = sequenceToWordDict[sequence]
        except:
            print(sequenceToWordDict[sequence])
    print(words)

    tagString = f"Tag {highestSequence} as {tagWhat}? Ratio vs. background is {str(round(highestRatio, 2))} ({str(totalCountsTheseVerses)}/{str(totalCountsAllVerses)})\n"
    for word in words:
        tagString += word + "\n"

    tagString += "y/n: "

    tagInput = input(tagString)
    
    

protoTagger()