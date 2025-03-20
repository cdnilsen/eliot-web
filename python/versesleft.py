import os


def getKJVVerseDict():
    verse_files = []
    verse_count_dict = {}

    texts_dir = os.path.join(os.path.dirname(__file__), '../texts/')
    for file_name in os.listdir(texts_dir):
        if file_name.endswith('KJV.txt'):
            book = file_name.replace(".KJV.txt", "")
            verse_files.append(book)
            verse_count_dict[book] = 0

            with open(os.path.join(texts_dir, file_name), 'r', encoding='utf-8') as f:
                count = sum(1 for line in f if line.strip())
                verse_count_dict[book] = count
                #print(book + ": " + str(count))
    return verse_count_dict
    
def getPercentage(numerator, denominator):
    quotient = numerator / denominator
    percent = round(quotient * 100, 2)
    return str(percent) + "%"


def main():
    KJV_verse_dict = getKJVVerseDict()

    allBooks = list(KJV_verse_dict.keys())
    #print(allBooks)

    whichEdition = input("First (1) or second (2) edition? ").strip()

    fileSuffix = "First Edition.txt"
    letter = "α"
    if whichEdition == "2":
        fileSuffix = "Second Edition.txt"
        letter = "β"

    

    editionToVerseCountDict = {}

    bookToDifferenceDict = {}
    totalDifference = 0
    for book in allBooks:
        fileName = book + "." + fileSuffix
        finishedFilePath = os.path.join(os.path.dirname(__file__), '../texts/', fileName)

        unfinishedFilePath = os.path.join(os.path.dirname(__file__), '../texts_in_progress/', fileName)

        kjvCount = KJV_verse_dict[book]
        if os.path.exists(finishedFilePath):
            with open(finishedFilePath, 'r', encoding='utf-8') as f:
                finishedCount = sum(1 for line in f if line.strip())
                editionToVerseCountDict[book] = finishedCount
        elif os.path.exists(unfinishedFilePath):
            with open(unfinishedFilePath, 'r', encoding='utf-8') as f:
                unfinishedCount = sum(1 for line in f if (line.startswith(letter) and len(line.strip().split(" ")) > 1))
                editionToVerseCountDict[book] = unfinishedCount
                difference = kjvCount - unfinishedCount
                #print(book + ": " + str(unfinishedCount) + "/" + str(kjvCount))
                bookToDifferenceDict[book] = difference

                totalDifference += difference
            
        else:
            print("No file for " + fileName)


    allUnfinishedBooks = list(bookToDifferenceDict.keys())

    allUnfinishedBooks.sort()

    for book in allUnfinishedBooks:
        thisDifference = bookToDifferenceDict[book]
        proportionalDifference = getPercentage(thisDifference, totalDifference)
        print(book + ": " + str(thisDifference) + " (" + proportionalDifference + ")")
    print(str(totalDifference) + " total verses left to go")


    

main()