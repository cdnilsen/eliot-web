import os
import math

file = open("../texts_in_progress/Family Religion.Unknown.txt", "r", encoding="utf-8")

lines = file.readlines()

lineList = []

for i in range(len(lines)):
    line = lines[i]
    n = str(math.floor(i / 3))
    if i % 3 == 0:
        lineList.append(line)
    elif i % 3 == 1:
        lineList.append(n + ".E " + line)
    else:
        lineList.append(n + ".M " + line)

file.close()

file = open("../texts/Family Religion.Unknown.txt", "w", encoding="utf-8")

file.writelines(lineList)