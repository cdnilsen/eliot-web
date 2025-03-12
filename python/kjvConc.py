import os

def getAllFiles():
    files = []
    for file in os.listdir('../texts/'):
        if file.endswith('.KJV.txt') and os.path.isfile(os.path.join('../texts/', file)):
            files.append(file)
    return files


def cleanLine(line):
    line = " ".join(line.split(" ")[1:])

    punctuation = [".", ",", ";", "?", "!", "-", ":", "'", '"', "(", ")", "{", "}", "$", "[", "]"]

    for char in punctuation:
        line = line.replace(char, "")

    line = line.lower()

    return line.split(" ")

def processFile(fileAddress, wordToVerseDict):
    print(fileAddress)
    wordDict = {}
    with open('../texts/' + fileAddress, 'r', encoding="utf-8") as f:
        lines = f.readlines()
        for line in lines:
            cleanedLine = cleanLine(line)
            for word in cleanedLine:
                word = word.strip()
                if word in wordDict:
                    wordDict[word] += 1
                else:
                    wordDict[word] = 1
                    wordToVerseDict[word] = (fileAddress.replace(".KJV.txt", "") + " " + line)

    return wordDict


# Unused. Only about 200 pseudo-hapaxes with an obvious headword
def isHapax(word, dict):
    if dict[word] > 1:
        return "no"
    
    suffixes = ["ing", "eth", "es", "est", "s", "ed"]
    isHapax = "True"
    for suffix in suffixes:
        if word + suffix in dict:
            isHapax = suffix

    return isHapax

def main():
    allFiles = getAllFiles()
    finalDict = {}
    wordToVerseDict = {}
    for file in allFiles:
        fileDict = processFile(file, wordToVerseDict)
        wordsInFile = list(fileDict.keys())
        for word in wordsInFile:
            if word in finalDict:
                finalDict[word] += fileDict[word]
            else:
                finalDict[word] = fileDict[word]
    
    allWords = list(finalDict.keys())
    allWords.sort()
    print(len(allWords))

    kjvConcFile = open('kjvConc.txt', 'w', encoding="utf-8")

    wordLines = []
    for word in allWords:
        string = word + " (" + str(finalDict[word]) + ")"
        if finalDict[word] == 1:
            string += "\n\t" + wordToVerseDict[word]
            
        wordLines.append(string)

    kjvConcFile.write("\n".join(wordLines))
    kjvConcFile.close()
    '''
    for i in range(len(allWords)):
        if i % 100 == 0:
            print(allWords[i])
    '''

    
        



main()