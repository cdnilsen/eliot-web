# Counts verses in each book by chapter


import os

def processLinesToFile(file):
    fileLines = open(file, "r", encoding="utf-8").readlines()
    outputDict = {}
    #print(fileLines[10])

    for i in range(len(fileLines) - 1):
        line = fileLines[i].strip()
        previousLine = ""
        lineIsTrouble = True
        if i > 0:
            previousLine = fileLines[i - 1]

        address = line.split(" ")[0]
        previousAddress= previousLine.split(" ")[0]
        if "." in address or "Epilogue" in address:
            lineIsTrouble = False

        if (lineIsTrouble):
            print("Problem in " + file)
            return outputDict

        isEpilogue = "Epilogue" in address
        isFirstLine = address.endswith(".0")

        if (address.endswith(".1") and not previousAddress.endswith(".0")):
            isFirstLine = True

        if not isEpilogue:
            try:    
                chapter = address.split(".")[0]
                if isFirstLine:
                    outputDict[chapter] = 1
                else:
                    outputDict[chapter] += 1
            except:
                print(address.split("."))
                print(line)
                print(file)

    return outputDict
        


def getFiles():
    fileDirectory = os.listdir("../texts")
    rightFiles = []

    fileDict = {}
    for file in fileDirectory:
        rightFiles.append(file)
    
    allEditions = ["First Edition", "Second Edition", "Mayhew", "Zeroth Edition", "KJV"]

    allBooks = []

    for file in rightFiles:
        book = file.split(".")[0]
        edition = file.split(".")[1]

        if book not in allBooks:
            allBooks.append(book)
        
        if book not in fileDict:
            fileDict[book] = {
                "Editions": {}
            }

            for possibleEdition in allEditions:
                fileDict[book][possibleEdition] = {}
                fileDict[book]["Editions"][possibleEdition] = False
            
        fileDict[book]["Editions"][edition] = True

        fileDict[book][edition] = processLinesToFile("../texts/" + file)

    bookToOffChaptersDict = {}
    for book in allBooks:
        bookToOffChaptersDict[book] = {}
        activeEditions = []
        for edition in allEditions:
            if fileDict[book]["Editions"][edition] == True:
                activeEditions.append(edition)

        for thisEdition in activeEditions:
            thisEditionDict = fileDict[book][thisEdition]
            allChapters = list(thisEditionDict.keys())
            #print(f"{book} ({thisEdition}): {str(allChapters)}")
            for otherEdition in activeEditions:
                otherEditionDict = fileDict[book][otherEdition]
                for chapter in allChapters:
                    wrongChapterString = f"{chapter}: {thisEdition}, {otherEdition}"
                    if chapter not in otherEditionDict:
                        if chapter not in bookToOffChaptersDict[book]:
                            bookToOffChaptersDict[book][chapter] = []
                            if thisEdition not in bookToOffChaptersDict[book][chapter]:
                                bookToOffChaptersDict[book][chapter].append(thisEdition)
                            if otherEdition not in bookToOffChaptersDict[book][chapter]:
                                bookToOffChaptersDict[book][chapter].append(otherEdition)
                        #print(f"Issue with {book} {thisEdition} chapter {chapter} not in {otherEdition}")
                    else:
                        numVersesThisEdition = thisEditionDict[chapter]
                        numVersesOtherEdition = otherEditionDict[chapter]
                        if (numVersesThisEdition != numVersesOtherEdition):
                            if chapter not in bookToOffChaptersDict[book]:
                                bookToOffChaptersDict[book][chapter] = []
                                if thisEdition not in bookToOffChaptersDict[book][chapter]:
                                    bookToOffChaptersDict[book][chapter].append(thisEdition)
                                if otherEdition not in bookToOffChaptersDict[book][chapter]:
                                    bookToOffChaptersDict[book][chapter].append(otherEdition)

                if thisEdition != otherEdition:
                    sameChapterCounts = (fileDict[book][thisEdition] == fileDict[book][otherEdition])
                    
    for book in allBooks:
        if len(bookToOffChaptersDict[book]) > 0:
            print(book + ": " + str(bookToOffChaptersDict[book]))


getFiles()