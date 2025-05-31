import os
import math

englishFile = open("../texts_in_progress/Lord's Day (Mayhew).txt", "r", encoding="UTF-8")

massFile = open("../texts_in_progress/Lord's Day (for processing).txt", "r", encoding="UTF-8")


englishLines = englishFile.readlines()

massLines = massFile.readlines()



addressToEnglishTextDict = {}
addressToMassTextDict = {}
finalEnglishLines = []
finalMassLines = []
finalAddresses = []
for line in englishLines:
    if line.strip() != "" and line.strip() != "¶":
        address = line.split(" ")[0].strip()
        address = address[0:-2]
        finalAddresses.append(address)
        finalEnglishLines.append(line)

for line in massLines:
    if line.strip() != "" and line.strip() != "¶":  
        finalMassLines.append(line)

#print(len(finalEnglishLines))
#print(len(finalMassLines))
#print(len(finalAddresses))


outputLineList = []
for i in range(len(finalEnglishLines)):
    englishText = " ".join(finalEnglishLines[i].split(" ")[1:])
    englishLine = finalAddresses[i] + ".E " + englishText

    massLine = finalAddresses[i] + ".μ " + finalMassLines[i]

    outputLineList.append(massLine)

    outputLineList.append(englishLine)
    outputLineList.append("\n")


englishFile.close()
massFile.close()

outputFile = open("../texts/Lord's Day.Mayhew.txt", "w", encoding="utf-8")
outputFile.writelines(outputLineList)

outputFile.close()
