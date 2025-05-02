readFile = open("../texts_in_progress/Lord's Day (Mayhew).txt", "r", encoding="utf-8")
topNum = int(input("Add lines up to: "))

lastNum = 0
for line in readFile.readlines():
    if line.strip() != "":
        address = line.split(" ")[0]
        sentenceNum = int(address.split(".")[0])
        lastNum = sentenceNum
readFile.close()

appendFile = open("../texts_in_progress/Lord's Day (Mayhew).txt", "a", encoding="utf-8")

newLines = []
for i in range(lastNum + 1, topNum + 1):
    newLines.append((str(i)) + ".M \n")
    newLines.append((str(i)) + ".E \n\n")

appendFile.writelines(newLines)
appendFile.close()