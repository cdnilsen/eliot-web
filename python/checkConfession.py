file = open("../texts/Confession of Faith.txt", "r", encoding="utf-8")

lines = file.readlines()


def checkLine(line, textDict, addressCountDict):
    if line.strip() != "":
        address = line.split(" ")[0]

        text = " ".join(line.split(" ")[1:])
        lineNum = address[0:-2]
        language = address[-1]
        if lineNum not in textDict:
            textDict[lineNum] = {}
        textDict[lineNum][language] = text

        if lineNum not in addressCountDict:
            addressCountDict[lineNum] = 0
        addressCountDict[lineNum] += 1

def checkDict(textDict, addressCountDict):
    textKeys = list(textDict.keys())
    
    for textKey in textKeys:
        subdict = textDict[textKey]
        if "E" not in subdict:
            print(textKey + " missing English")
        elif "M" not in subdict:
            print(textKey + " missing Massachusett")
        
        if addressCountDict[textKey] != 2:
            print(f"{str(addressCountDict[textKey])} counts of {textKey}")


textDict = {}
addressCountDict = {}
for line in lines:
    checkLine(line, textDict, addressCountDict)

checkDict(textDict, addressCountDict)