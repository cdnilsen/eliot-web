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

    punctuation = [".", ",", ";", "?", "!", "-", ":", "'", '"', "(", ")", "{", "}", "$", "[", "]"]

    for char in punctuation:
        line = line.replace(char, "")

    line = line.lower()

    return line.split(" ")

def getAllLetters(word, numLetters):
    allSequences = []
    for i in range(len(word) - (numLetters - 1)):
        allSequences.append(word[i:i + numLetters])
    return allSequences


def main(edition, numLetters, ignoreDiacritics = False):
    alphabeticalOrByCount = input("Sort alphabetically (a) or by count (c)? ").strip().lower()

    if alphabeticalOrByCount != "a" and alphabeticalOrByCount != "c":
        return

    fileList = getFiles(edition)

    sequenceToCountDict = {}
    for file in fileList:
        lines = open('../texts/' + file, "r", encoding="utf-8").readlines()
        for line in lines:
            words = cleanLine(line)
            for word in words:
                word = word.strip()
                wordSequences = getAllLetters(word, numLetters)
                for sequence in wordSequences:
                    if sequence in sequenceToCountDict:
                        sequenceToCountDict[sequence] += 1
                    else:
                        sequenceToCountDict[sequence] = 1
        #print("Finished " + file) # This goes really fast, anyways

    allSequences = list(sequenceToCountDict.keys())

    if alphabeticalOrByCount == "a":
        allSequences.sort()
    else:
        allSequences.sort(key=lambda x: sequenceToCountDict[x], reverse=True)
    
    '''
    for i in range (50):
        print(allSequences[i] + ": " + str(sequenceToCountDict[allSequences[i]]))
    '''
    
    outputFile = open("letterSequenceOutput.txt", "w", encoding="utf-8")
    outputLines = []
    for sequence in allSequences:
        count = sequenceToCountDict[sequence]
        sequenceLine = sequence + ": " + str(count) + "\n"
        outputLines.append(sequenceLine)
    outputFile.writelines(outputLines)

    print("Found " + str(len(allSequences)) + " sequences")

main("First Edition", 3)