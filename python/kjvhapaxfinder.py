import os

from library import bookToIDDict

def grabAllBooks():
    fileDirectory = os.listdir("../texts")
    rightFiles = []
    for file in fileDirectory:
        if file.endswith("KJV.txt"):
            rightFiles.append(file)

    return rightFiles



def cleanWord(word):
    punctuation = [".", ",", ";", "?", "!", "-", ":", "'", '"', "(", ")"]
    word = word.lower()

    singularPossessive = word.endswith("'s")
    pluralPossessive = word.endswith("s'")

    if singularPossessive or pluralPossessive:
        word = word[0:-2]
    for char in punctuation:
        word = word.replace(char, "")

    if singularPossessive:
        word = word + "'s"
    if pluralPossessive:
        word = word + "s'"

    return word


def getWordsFromLine(line):
    splitLine = line.split(" ")
    finalDict = {
        "address": splitLine[0],
        "words": []
    }
    for i in range(len(splitLine)):
        if i > 0:
            finalDict["words"].append(cleanWord(splitLine[i]))
    return finalDict

def processBook(fileAddress):
    thisBookDict = {}
    file = open("../texts/" + fileAddress, "r", encoding="utf-8")
    fileLines = file.readlines()
    for line in fileLines:
        line = line.strip()
        if line != "":
            thisLineDict = getWordsFromLine(line)
            address = thisLineDict["address"]
            words = thisLineDict["words"]
            thisBookDict[address] = words
    file.close()

    return thisBookDict

def getAllWordDicts():
    allBookDicts = {}
    allBookFiles = grabAllBooks()
    for book in allBookFiles:
        bookName = book.replace(".KJV.txt", "")
        allBookDicts[bookName] = processBook(book)

    return allBookDicts

def getAddressDict():
    output = {}
    allBookFiles = grabAllBooks()
    for bookFileName in allBookFiles:
        bookName = bookFileName.replace(".KJV.txt", "")
        output[bookName] = {}
        file = open("../texts/" + bookFileName, "r", encoding="utf-8")
        fileLines = file.readlines()
        for line in fileLines:
            if line.strip() != "":
                splitLine = line.split(" ")
                address = splitLine[0].strip()
                text = " ".join(splitLine[1:]).strip()
                output[bookName][address] = text
        file.close()
    return output

        

def getCountsAndAddresses(allBookDicts):
    wordToCountDict = {}
    wordToAddressDict = {}
    masterWordList = []
    for book in allBookDicts.keys():
        dict = allBookDicts[book]
        for address in dict.keys():
            fullAddress = book + " " + address

            thisAddressWords = {}
            thisAddressWordList = []

            allWords = dict[address]
            for word in allWords:
                if word not in thisAddressWords:
                    thisAddressWords[word] = 1
                    thisAddressWordList.append(word)
                else:
                    thisAddressWords[word] += 1

            for word in thisAddressWordList:
                #print(word)
                thisWordCount = thisAddressWords[word]
                if word not in wordToCountDict:
                    masterWordList.append(word)
                    wordToCountDict[word] = thisWordCount
                    wordToAddressDict[word] = [fullAddress]
                else:
                    wordToCountDict[word] += thisWordCount
                    wordToAddressDict[word].append(fullAddress)

    output = {
        "words": masterWordList,
        "counts": wordToCountDict,
        "addresses": wordToAddressDict
    }

    return output

def replaceEnding(word, countDict, wordSuffix, replacementSuffix):
    if word.endswith(wordSuffix):
        lemmaVersion = word[0:(len(word)-len(wordSuffix))] + replacementSuffix
        if lemmaVersion in countDict:
            print(f"{word} ({countDict[word]}) > {lemmaVersion} ({countDict[lemmaVersion]})")
            return lemmaVersion
        else:
            return ""
    else:
        return ""



def checkAllEndings(word, countDict):
    suffixTupleList = [
    ("ing", ""),
    ("es", ""),
    ("ed", ""),
    ("ies", "y"),
    ("ier", "y"),
    ("iest", "y"),
    ("er", ""),
    ("est", ""),
    ("'s", ""),
    ("s'", ""),
    ("s", ""),
    ("ily", "y"),
    ("ly", ""),
    ("eth", ""),
    ("ed", "e"),
    ("eth", "e"),
    ("es", "e"),
    ("est", "e"),
    ("ed", "e")
    ]

    outputDict = {
        "probableHapax": True,
        "possibleLemmata": []
    }

    for tuple in suffixTupleList:
        lemmaVersion = replaceEnding(word, countDict, tuple[0], tuple[1])
        if lemmaVersion != "":
            outputDict["probableHapax"] = False
            outputDict["possibleLemmata"].append(lemmaVersion)
    
    return outputDict

def wordSearch():
    wordToSearch = input("Search for a word in the KJV: ").strip()
    word = cleanWord(wordToSearch)
    allBookFiles = grabAllBooks()
    verseCount = 0
    wordAddresses = []
    addressToTextDict = {}

    allSuperstrings = {}

    for bookAddress in allBookFiles:
        bookName = bookAddress.replace(".KJV.txt", "")
        file = open("../texts/" + bookAddress, "r", encoding="utf-8")
        fileLines = file.readlines()
        for line in fileLines:
            line = line.strip()
            if line != "":
                thisLineDict = getWordsFromLine(line)
                wordIsInThisVerse = False
                for otherWord in thisLineDict["words"]:
                    if word in otherWord:
                        wordIsInThisVerse = True
                        if otherWord not in allSuperstrings:
                            allSuperstrings[otherWord] = 1
                        else:
                            allSuperstrings[otherWord] += 1

                if wordIsInThisVerse:
                    verseCount += 1
                    fullAddress = bookName + " " + thisLineDict["address"]
                    wordAddresses.append(fullAddress)
                    addressToTextDict[fullAddress] = " ".join(line.split(" ")[1:])

    print("\n")

    for address in wordAddresses:
        print(address)
        print(addressToTextDict[address])

    allMatches = list(allSuperstrings.keys())
    allMatches.sort()
    finalLine = "\nMatches:\n\t"
    for match in allMatches:
        finalLine += match + " (" + str(allSuperstrings[match]) + "), " 

    print(finalLine[0:-2])


def writeHapaxesToFile(probableList, possibleList, countDict, addressDict, possibleHapaxObjects, textDict, onlyThisBook=""):
    file = open("kjvHapaxFile.txt", "w", encoding="utf-8")

    probableHeader = f"==PROBABLE hapaxes ({str(len(probableList))})==\n"
    allLines = [probableHeader]

    probableCount = 0
    possibleCount = 0
    for probableHapax in probableList:
        hapaxAddress = addressDict[probableHapax][0]
        splitAddress = hapaxAddress.split(" ")
        verse = splitAddress[-1]
        bookName = " ".join(splitAddress[0:-1]).strip()
        if (onlyThisBook == "" or onlyThisBook == bookName):
            thisHapaxText = textDict[bookName][verse]
            line1 = f"{probableHapax}: {hapaxAddress}\n"
            line2 = f"\t{thisHapaxText}\n\n"
            allLines.append(line1)
            allLines.append(line2)
            probableCount += 1
       

    possibleHeader = f"==POSSIBLE hapaxes ({str(len(possibleList))})==\n"
    allLines.append("\n")
    allLines.append(possibleHeader)

    #print(possibleHapaxObjects)

    for possibleHapax in possibleList:
        possibleLemmata = possibleHapaxObjects[possibleHapax]
        #print(object)
        
        hapaxAddress = addressDict[possibleHapax][0]
        splitAddress = hapaxAddress.split(" ")
        verse = splitAddress[-1]
        bookName = " ".join(splitAddress[0:-1]).strip()
        if (onlyThisBook == "" or onlyThisBook == bookName):
            thisHapaxText = textDict[bookName][verse]
            line1 = f"{possibleHapax}: {hapaxAddress}\n"
            line2 = f"\t{thisHapaxText}\n\n"
            allLines.append(line1)
            allLines.append(line2)
            possibleCount += 1

            for possibleLemma in possibleLemmata:
                thisLemmaLine = f"\t{possibleLemma} ({countDict[possibleLemma]}): "
                thisLemmaAddresses = addressDict[possibleLemma]
                addressesLine = "\t\t"
                if len(thisLemmaAddresses) < 10:
                    for i in range(len(thisLemmaAddresses)):
                        addressesLine += (thisLemmaAddresses[i])
                        if i < (len(thisLemmaAddresses) - 1):
                            addressesLine += ", "
                else:
                    allBooks = []
                    allBookDict = {}
                    for address in thisLemmaAddresses:
                        thisAddressBook = address.split(" ")[0]
                        if thisAddressBook not in allBookDict:
                            allBookDict[thisAddressBook] = 1
                            allBooks.append(thisAddressBook)
                        else:
                            allBookDict[thisAddressBook] += 1
                    for i in range(len(allBooks)):
                        thisBook = allBooks[i]
                        addressesLine += f"{thisBook} ({str(allBookDict[thisBook])})"
                        if i < (len(thisLemmaAddresses) - 1):
                            addressesLine += ", "
                
                allLines.append(thisLemmaLine + "\n")
                allLines.append(addressesLine + "\n")
                allLines.append("\n")
       
    print(str(probableCount) + " probable hapaxes")
    print(str(possibleCount) + " possible hapaxes")

    file.writelines(allLines)
    file.close()

def getHapaxes():
    chooseBook = input("Particular book? (n) or type: ")
    allBookDicts = getAllWordDicts()
    countsAndAddressDict = getCountsAndAddresses(allBookDicts)

    workingBooks = list(bookToIDDict.keys())
    onlyThisBook = ""
    if chooseBook in workingBooks:
        onlyThisBook = chooseBook

    textDict = getAddressDict()

    masterWordList = countsAndAddressDict["words"]
    countDict = countsAndAddressDict["counts"]
    addressDict = countsAndAddressDict["addresses"]

    probableHapaxes = []
    possibleHapaxes = []

    masterWordList.sort()

    probableHapaxObjects = {}
    possibleHapaxObjects = {}
    for word in masterWordList:
        if countDict[word] == 1:
            fullAddress = addressDict[word][0]
            wordObject = checkAllEndings(word, countDict)
            print(wordObject)
            if wordObject["probableHapax"]:
                probableHapaxes.append(word)
                probableHapaxObjects[word] = wordObject["possibleLemmata"]
            else:
                possibleHapaxes.append(word)
                possibleHapaxObjects[word] = wordObject["possibleLemmata"]

    probableHapaxes.sort()
    possibleHapaxes.sort()

    

    #print(possibleHapaxObjects)




    writeHapaxesToFile(probableHapaxes, possibleHapaxes, countDict, addressDict, possibleHapaxObjects, textDict, onlyThisBook)

    #acceptingObject = checkAllEndings("accepting", countDict)
    #print(acceptingObject)
    
    
            

    #print(str(len(masterWordList)) + " possible hapaxes")

def main(exit = False):

    doWhatString = "Run the hapax file (h) or search (s)? "
    if exit:
        doWhatString = "Run the hapax file (h), search (s) or exit (e)? "

    doWhat = input("Run the hapax file (h) or search (s)? ").lower().strip()

    if doWhat == "h":
        getHapaxes()
    elif doWhat == "s":
        wordSearch()
    else:
        main(doWhat == "e")

main()