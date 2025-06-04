import os

authors = {
    "Mayhew": [("Lord's Day.Mayhew.txt", "μ"), ("Psalms (prose).Mayhew.txt", "a"), ("John.Mayhew.txt", "a"), ("Family Religion.txt", "μ")],
    "Rawson": [("Confession of Faith.txt", "M"), ("Milk for Babes.txt", "M")],
    "Anonymous": [("Family Religion.txt", "M")]
}

from library import bookToIDDict, cleanDiacritics, cleanWord


def getWordsInText(author):
    
    wordsDiacritics = {}
    wordsNoDiacritics = {}

    allTuples = authors[author]
    for textTuple in allTuples:
        file = open("../texts/" + textTuple[0], "r", encoding="utf-8")
        fileLines = file.readlines()
        textName = textTuple[0]
        tag = textTuple[1]

        for line in fileLines:
            if line.strip() != "" and (not line.endswith("×")):
                splitLine = line.split(" ")
                address = splitLine[0].strip()
                if (tag == "a") or (address[-1] == tag):
                    for word in splitLine[1:]:
                        word = cleanWord(word);
                        wordsDiacritics[word] = True
                        noDiacritics = cleanDiacritics(word);
                        noDiacritics = noDiacritics.replace("8", "oo")
                        wordsNoDiacritics[noDiacritics] = True
        #print("Finished " + textName)

    object = {
        "diacritics": wordsDiacritics,
        "noDiacritics": wordsNoDiacritics
    }

    return object
                

def getAllEliotFiles():
    eliot_files = []
    editions = ["First Edition.txt", "Second Edition.txt", "Zeroth Edition.txt"]
    for filename in os.listdir("../texts/"):
        if any(filename.endswith(edition) for edition in editions):
            eliot_files.append(filename)
    return eliot_files


def getAllEliotWords():
    allEliotFiles = getAllEliotFiles()
    wordsNoDiacritics = {}
    wordsDiacritics = {}
    for file in allEliotFiles:
        fileLines = open("../texts/" + file, "r", encoding="utf-8");
        for line in fileLines:
            if line.strip() != "":
                splitLine = line.split(" ")[1:]
                for word in splitLine:
                    word = cleanWord(word)
                    noDiacritics = cleanDiacritics(word)
                    noDiacritics = noDiacritics.replace("8", "oo")
                    wordsDiacritics[word] = True
                    wordsNoDiacritics[noDiacritics] = True
                    
        #print("Done with " + file)

    object = {
        "diacritics": wordsDiacritics,
        "noDiacritics": wordsNoDiacritics
    }
    return object

def checkWordsAgainstEliot(author, eliotDict):
    allWordsAuthor = getWordsInText(author)
    wordsAuthorDiacritics = list(allWordsAuthor["diacritics"].keys());
    wordsAuthorNoDiacritics = list(allWordsAuthor["noDiacritics"].keys());
    #eliotWordsDiacritics = list(eliotDict["diacritics"].keys());
    #eliotWordsNoDiacritics = list(eliotDict["noDiacritics"].keys());

    #print(f"{str(len(eliotWordsDiacritics))} distinct words WITH diacritics found in Eliot")
    #print(f"{str(len(eliotWordsNoDiacritics))} distinct words WITHOUT diacritics found in Eliot")

    uniqueDiacriticWords = {}
    for word in wordsAuthorDiacritics:
        if (word not in eliotDict["diacritics"]):
            uniqueDiacriticWords[word] = True
    
    uniqueWordsNoDiacritics = {}
    for word in wordsAuthorNoDiacritics:
        if (word not in eliotDict["noDiacritics"]):
            uniqueWordsNoDiacritics[word] = True

    #print(f"{str(len(uniqueDiacriticWords))} unique words w/ diacritics found in {author}")
    #print(f"{str(len(uniqueWordsNoDiacritics))} unique words WITHOUT diacritics found in {author}")

    object = {
        "unique-diacritics": uniqueDiacriticWords,
        "unique-no-diacritics": uniqueWordsNoDiacritics
    }

    return object

def compareOtherAuthors(allObjects, thisAuthor, authors):
    allWordsDiacritics = list(allObjects[thisAuthor]["unique-diacritics"].keys())
    allWordsNoDiacritics = list(allObjects[thisAuthor]["unique-no-diacritics"].keys())

    
    nonUniqueObject = {
        "not-unique-diacritics": {},
        "not-unique-no-diacritics": {}
    }

    for otherAuthor in authors:
        if otherAuthor != thisAuthor:
            otherAuthorDiacritics = allObjects[otherAuthor]["unique-diacritics"];
            otherAuthorNoDiacritics = allObjects[otherAuthor]["unique-no-diacritics"];

            for word in allWordsDiacritics:
                if word in otherAuthorDiacritics:
                    nonUniqueObject["not-unique-diacritics"][word] = True
            
            for word in allWordsNoDiacritics:
                if word in otherAuthorNoDiacritics:
                    nonUniqueObject["not-unique-no-diacritics"][word] = True
    
    thisAuthorObject = {
        "unique-diacritics": [],
        "unique-no-diacritics": []
    }

    for word in allWordsDiacritics:
        if word not in nonUniqueObject["not-unique-diacritics"]:
            thisAuthorObject["unique-diacritics"].append(word)
    for word in allWordsNoDiacritics:
        if word not in nonUniqueObject["not-unique-no-diacritics"]:
            thisAuthorObject["unique-no-diacritics"].append(word)

    thisAuthorObject["unique-diacritics"].sort()
    thisAuthorObject["unique-no-diacritics"].sort()

    return thisAuthorObject


    #return thisAuthorObject



def main(authors):
    eliotDict = getAllEliotWords()
    print("Got all words in Eliot")

    allObjects = {}
    for author in authors:
        object = checkWordsAgainstEliot(author, eliotDict)
        allObjects[author] = object

    for thisAuthor in authors:
        authorCompare = compareOtherAuthors(allObjects, thisAuthor, authors)

        print(f"{str(len(authorCompare["unique-diacritics"]))} distinct words with diacritics found in {thisAuthor}")

        print(f"{str(len(authorCompare["unique-no-diacritics"]))} distinct words WITHOUT diacritics found in {thisAuthor}")

        hapaxFile = open("./hapaxLogs/" + thisAuthor + ".txt", "w", encoding="utf-8")
        diacriticLine = "let hapaxesWithDiacritics: string[] = ["
        for word in authorCompare["unique-diacritics"]:
            diacriticLine += word + ", "

        diacriticLine = diacriticLine[0:-2] + "]\n"
        
        noDiacriticLine = "let hapaxesNoDiacritics: string[] = ["
        for word in authorCompare["unique-no-diacritics"]:
            noDiacriticLine += word + ", "

        noDiacriticLine = noDiacriticLine[0:-2] + "]\n"

        hapaxFile.writelines([diacriticLine, noDiacriticLine])
        hapaxFile.close()

    


allAuthors = ["Anonymous", "Rawson", "Mayhew"]
main(allAuthors)

    
    

    