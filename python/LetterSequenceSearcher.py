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

    return line.split(" ")

def main(edition, numLetters, ignoreDiacritics = False):
    fileList = getFiles(edition)

    allWords = []

    for file in fileList:
        lines = open('../texts/' + file, "r", encoding="utf-8").readlines()
        for line in lines:
            words = cleanLine(line)
    

main("First Edition", 3)