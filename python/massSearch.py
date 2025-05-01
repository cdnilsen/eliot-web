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

def grabMassVerses(searchString):
    fileDirectory = os.listdir('../texts')
    rightFiles = []
    for file in fileDirectory:
        if not (file.endswith("KJV.txt") or file.endswith("Grebrew.txt")):
            rightFiles.append(file)
    
    matchingLines = []
    for file in rightFiles:
        openedFile = open("../texts/" + file, "r", encoding="utf-8")
        fileLines = openedFile.readlines()
        book = file.split(".")[0]
        edition = file.split(".")[1]
        for line in fileLines:
            line = line.strip()
            address = line.split(" ")[0]
            words = line.split(" ")[1:]
            lineAdded = False
            for word in words:
                if searchString in word:
                    matchingLines.append(book + " " + edition + ": " + line)
                    lineAdded = True
                if lineAdded:
                    continue
                    
    return matchingLines

def main():
    searchString = input("Search for a string in the Mass texts: ").strip().lower()

    allMatchingLines = grabMassVerses(searchString)
    for line in allMatchingLines:
        print(line)

main()