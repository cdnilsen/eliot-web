import os


def checkEdition():
    whichEdition = input("First (1) or second (2) edition? ").strip()
    if whichEdition == "1":
        return ".First Edition.txt"
    elif whichEdition == "2":
        return ".Second Edition.txt"
    else:
        checkEdition()

def getNumVersesInKJV():
    files = []
    for file in os.listdir('../texts/'):
        if file.endswith('.KJV.txt') and os.path.isfile(os.path.join('../texts/', file)):
            files.append(file)

    count = 0
    for file in files:
        with open(os.path.join('../texts/', file), 'r', encoding = "utf-8") as f:
            for line in f:
                if line.strip() != "":
                    count += 1
    #print(count)
    #print("Number of files: " + str(len(files)))
    return count

def main():
    edition = checkEdition()

    matching_files = []
    for file in os.listdir('../texts/'):
        if file.endswith(edition) and os.path.isfile(os.path.join('../texts/', file)):
            matching_files.append(file)


    finishedVersesCount = 0
    for file in matching_files:
        with open(os.path.join('../texts/', file), 'r', encoding = "utf-8") as f:
            for line in f:
                if line.strip() != "":
                    finishedVersesCount += 1

    filesNotDone = []
    for file in os.listdir('../texts_in_progress/'):
        if file.endswith(edition) and os.path.isfile(os.path.join('../texts_in_progress/', file)):
            filesNotDone.append(file)

    startingLetter = "α"
    if edition == ".Second Edition.txt":
        startingLetter = "β"


    versesDoneInOtherFiles = 0
    for undoneFile in filesNotDone:
        with open(os.path.join('../texts_in_progress/', undoneFile), 'r', encoding = "utf-8") as f:
            for line in f:
                if line.startswith(startingLetter):
                    if len(line.strip().split()) > 1:
                        #print(line)
                        versesDoneInOtherFiles += 1

        

    
    totalVerses = getNumVersesInKJV()
    totalDone = versesDoneInOtherFiles + finishedVersesCount
    proportion = str(round((totalDone / totalVerses), 3) * 100) + "%"

    numToGo = totalVerses - totalDone

    print(f"{str(totalDone)}/{str(totalVerses)} ({proportion}) finished ({str(finishedVersesCount)} in finished transcripts, {str(versesDoneInOtherFiles)} in unfinished)\n")

    print(f"{str(numToGo)} to go")
    #print(matching_files)

main()

    

