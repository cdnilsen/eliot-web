import os

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
        address = line.split(" ")[0]
        if "  " in line:
            print(book + " " + edition + " " + address)
        