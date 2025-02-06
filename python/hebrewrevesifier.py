dictionary = {
    "3": (9, 8),
    "4": (9, 8),
    "5": (13, 12),
    "6": (11, 10),
    "7": (18, 17),
    "8": (10, 9),
    "9": (21, 20),
    "12": (9, 8),
    "18": (51, 50),
    "19": (15, 14),
    "20": (10, 9),
    "21": (14, 13),
    "22": (32, 31),
    "30": (13, 12),
    "31": (25, 24),
    "34": (23, 22),
    "36": (13, 12),
    "38": (23, 22),
    "39": (14, 13),
    "40": (18, 17),
    "41": (14, 13),
    "42": (12, 11),
    "44": (27, 26),
    "45": (18, 17),
    "46": (12, 11),
    "47": (10, 9),
    "48": (15, 14),
    "49": (21, 20),
    "51": (21, 19),
    "52": (11, 9),
    "53": (7, 6),
    "54": (9, 7),
    "55": (24, 23),
    "56": (14, 13),
    "57": (12, 11),
    "58": (12, 11),
    "59": (18, 17),
    "60": (14, 12),
    "61": (9, 8),
    "62": (13, 12),
    "63": (12, 11),
    "64": (11, 10),
    "65": (14, 13),
    "67": (8, 7),
    "68": (36, 35),
    "69": (37, 36),
    "70": (6, 5),
    "75": (11, 10),
    "76": (13, 12),
    "77": (21, 20),
    "80": (20, 19),
    "81": (17, 16),
    "83": (19, 18),
    "84": (13, 12),
    "85": (14, 13),
    "88": (19, 18),
    "89": (53, 52),
    "92": (16, 15),
    "102": (29, 28),
    "108": (14, 13),
    "140": (14, 13),
    "142": (8, 7)
}

allDifferentPsalms = list(dictionary.keys())


firstVerseDict = {}
numVersesDict = {}
prosePsalmsLines = open("../texts/Psalms (prose).First Edition.txt", "r", encoding="utf-8").readlines()

for line in prosePsalmsLines:
    line = line.strip()
    if line != "":
        address = line.split(" ")[0].split(".")
        chapter = address[0]
        if chapter not in firstVerseDict:
            firstVerseDict[chapter] = int(address[1])
        numVersesDict[chapter] = int(address[1])
            #print(".".join(address))


print(numVersesDict)

for psalmNum in allDifferentPsalms:
    tuple = dictionary[psalmNum]
    extraVerses = tuple[0] - tuple[1]
    
    noZerothVerse = (firstVerseDict[psalmNum] != 0)

    if noZerothVerse:
        print(f'Psalm {psalmNum} doesn\'t have a "zeroth verse"')

    if extraVerses != 1:
        print(f"Psalm {psalmNum} has {tuple[0]} verses in the Tanakh, {tuple[1]} in the KJV")
