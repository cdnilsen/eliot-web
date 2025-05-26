import os


def getOneLineWords(line):
    line = " ".join(line.split(" ")[1:])

    line = line.replace("|", " ")
    punctuation = [".", ",", ";", "?", "!", "-", ":", "'", '"', "(", ")", "{", "}", "$", "[", "]"]

    line = line.replace("ṣ", "s").replace("ṡ", "s")

    for char in punctuation:
        line = line.replace(char, "")

    line = line.lower()

    wordList = line.split(" ")

    finishedWordList = []
    for word in wordList:
        word = word.strip()
        if word not in finishedWordList:
            finishedWordList.append(word)

    return finishedWordList

def getMetricalWordsOneLine(line):
    line = line.strip().lower()
    line = line.replace("/", "").replace("\\", "")
    punctuation = [".", ",", ";", "?", "!", "-", ":", "'", '"', "(", ")", "{", "}", "$", "[", "]"]

    line = line.replace("ṣ", "s").replace("ṡ", "s")
    
    for char in punctuation:
        line = line.replace(char, "")

    wordList = line.split(" ")

    finishedWordList = []
    for word in wordList:
        word = word.strip()
        if word not in finishedWordList and word != "":
            finishedWordList.append(word)
    
    return finishedWordList

def getWordsInOneFile(fileName, dictionary):
    file = open('../texts/' + fileName, "r", encoding="utf-8")
    fileLines = file.readlines()

    for line in fileLines:
        if line.strip() != "":
            allWords = getOneLineWords(line)
            for word in allWords:
                if word in dictionary:
                    dictionary.pop(word)

    file.close()

    return dictionary

def getAllWords(edition, dictionary):
    allFiles = os.listdir("../texts/")
    correctFiles = []
    for file in allFiles:
        if file.endswith(edition):
            correctFiles.append(file)

    dictionaryCopy = dictionary
    print(len(dictionaryCopy.keys()))
    for rightFile in correctFiles:
        dictionaryCopy = getWordsInOneFile(rightFile, dictionaryCopy)

        allKeys = list(dictionaryCopy.keys())
        print(str(len(allKeys)) + " hapaxes after processing " + rightFile.split(".")[0])

def checkWordsInMetrical(edition):
    metricalLines = open("../texts_in_progress/Psalms (metrical)." + edition, "r", encoding = "utf-8").readlines()

    allWordsMetrical = {}
    for line in metricalLines:
        if line.startswith(" "):
            words = getMetricalWordsOneLine(line)
            for word in words:
                if word not in allWordsMetrical:
                    allWordsMetrical[word] = False
    
    getAllWords(edition, allWordsMetrical)
            



def main(prompt):
    edition = input(prompt).strip().lower()
    if edition == "1":
        checkWordsInMetrical("First Edition.txt")
    elif edition == "2":
        checkWordsInMetrical("Second Edition.txt")
    elif edition == "q":
        return
    else:
        main("Which edition? (1/2) Press Q to quit. ")


main("Which edition? (1/2) ")