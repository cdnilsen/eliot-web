import os
import xml.etree.ElementTree as ET
from library import cantillationMarksCodePoints, leftoverHapaxes
import unicodedata


allOTBooks = ["Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy", "Joshua", "Judges", "Ruth", "1 Samuel", "2 Samuel", "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles", "Ezra", "Nehemiah", "Esther", "Job", "Psalms", "Proverbs", "Ecclesiastes", "Song of Songs", "Isaiah", "Jeremiah", "Lamentations", "Ezekiel", "Daniel", "Hosea", "Joel", "Amos", "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk", "Zephaniah", "Haggai", "Zechariah", "Malachi"]

textFolder = "../texts/"
hebrewXMLFolder = "../hebrew_text_files/"

def killCantillationMarks(word):
    word = unicodedata.normalize('NFD', word)  # Decompose
    newWord = ""
    for char in word:
        unicodeChar = char.encode("unicode_escape").decode("utf-8")[1:]
        if unicodeChar not in cantillationMarksCodePoints:
            newWord += char
    return unicodedata.normalize('NFC', newWord)  # Recompose


def grabHapaxes(book):
    hapaxFile = open("OTHapaxList.txt", "r", encoding="utf-8")
    thisBookHapaxLine = ""
    for line in hapaxFile.readlines():
        if line.startswith(book):
            thisBookHapaxLine = line.split("|")[1].strip()
            break

    hapaxes = []
    splitHapaxLine = thisBookHapaxLine.split(",")
    for hapax in splitHapaxLine:
        hapaxes.append(killCantillationMarks(hapax))

    #print(f"Found {str(len(hapaxes))} hapaxes in {book}")

    return hapaxes


def checkWordsAgainstHapaxes(xml_content, book_name):
    root = ET.fromstring(xml_content)
    book = root.find('.//book')
    if book is None:
        return f"Book {book_name} not found in XML"
    
    allHapaxes = grabHapaxes(book_name)
    hapaxToMatchDict = {}
    for hapax in allHapaxes:
        hapaxToMatchDict[hapax] = []

    allWords = []
    for chapter in book.findall('c'):
        chapter_num = chapter.get('n')
        for verse in chapter.findall('v'):
            verse_num = verse.get('n')
            words = []
            i = 0
            while i < len(verse):
                element = verse[i]
                if element.tag == 'k' or element.tag == 'q' or element.tag == 'w':
                   cleanedWord = killCantillationMarks(element.text)
                   for hapax in allHapaxes:
                       if hapax in cleanedWord:
                           hapaxToMatchDict[hapax].append(cleanedWord)
                i += 1
        #print(f"Processed chapter {str(chapter_num)}")
    
    unmatchedHapaxes = 0
    for hapax in allHapaxes:
        numMatches = len(hapaxToMatchDict[hapax])
        if numMatches == 0:
            #print("NO match found for: ")
            #print(hapax)
            unmatchedHapaxes += 1
        if numMatches > 1:
            #print(f"{str(numMatches)} matches found for: ")
            #print(hapax)
            unmatchedHapaxes += 1

    if unmatchedHapaxes > 0:
        print(f"{str(unmatchedHapaxes)}/{str(len(allHapaxes))} hapaxes unmatched in {book_name}")

    return hapaxToMatchDict


def colorHapaxes(match, hapaxFormList, matchToHapaxDict, book):
    leftoverHapaxList = list(leftoverHapaxes[book].keys())
    if match in leftoverHapaxList:
        substring = leftoverHapaxes[book][match]
        return match.replace(substring, f'<span style="color:#0044FF">{substring}</span>')
    
    elif match not in hapaxFormList:
        return match
    else:
        hapax = matchToHapaxDict[match]
        return match.replace(hapax, f'<span style="color:#0044FF">{hapax}</span>')
    

def KQTagging(ketiv, qere):
    silentKetiv = (qere.strip() == "")
    ketivHasMaqaf = ketiv[-1] == "־"
    if ketivHasMaqaf:
        ketiv = ketiv[0:-1]
        if not silentKetiv:
            if qere[-1] == "־":
                qere = qere[0:-1]
    span = ""
    if (silentKetiv):
        span = f'<span class="silentKetiv">{ketiv}</span>'
    else:
        span = f'<span class="ketiv">{ketiv}<span class="qere">{qere}</span></span>'
    if ketivHasMaqaf:
        span = span + "־"
    return span


def process_xml_to_text(xml_content, book_name):
    try:
        hapaxes = grabHapaxes(book_name)

        #print(hapaxes) # works...
    
        root = ET.fromstring(xml_content)
        book = root.find('.//book')
        if book is None:
            return f"Book {book_name} not found in XML"
        
        output = []

        hapaxMatchDict = checkWordsAgainstHapaxes(xml_content, book_name)

        masterHapaxList = []
        matchToHapaxDict = {}
        for hapax in list(hapaxMatchDict.keys()):
            matches = hapaxMatchDict[hapax]
            if len(matches) == 1:
                match = matches[0]
                masterHapaxList.append(matches[0])
                matchToHapaxDict[match] = hapax
            elif len(matches) == 0:
                print("No matches found for:")
                print(hapax)
            else:
                print("More than one possible match for: ")
                print(hapax)
    
        for chapter in book.findall('c'):
            chapter_num = chapter.get('n')
            #print(chapter_num)
            for verse in chapter.findall('v'):
                verse_num = verse.get('n')
                words = []
                # Process each word element
                i = 0
                while i < len(verse):
                    element = verse[i]
                    if element.tag == 'k':
                        # Get the corresponding qere
                        qere = verse[i + 1].text if i + 1 < len(verse) and verse[i + 1].tag == 'q' else ''
                        ketiv = killCantillationMarks(element.text)
                        qere = killCantillationMarks(qere)

                        ketiv = colorHapaxes(ketiv, masterHapaxList, matchToHapaxDict, book_name)
                        qere = colorHapaxes(qere, masterHapaxList, matchToHapaxDict, book_name)

                        words.append(KQTagging(ketiv, qere))
                        i += 2  # Skip the next element (qere)
                    elif element.tag == 'q':
                        # Skip as it's handled with ketiv
                        i += 1
                    elif element.tag == 'w' and element.text:
                        cleanedWord = killCantillationMarks(element.text)
                        cleanedWord = colorHapaxes(cleanedWord, masterHapaxList, matchToHapaxDict, book_name)
                        words.append(cleanedWord)
                        i += 1
                    elif element.tag == 'pe':
                        words.append('<sup>פ</sup>')
                        i += 1
                    elif element.tag == 'samekh':
                        words.append('<sup>ס</sup>')
                        i += 1
                    else:
                        i += 1

                verse_text = f"{chapter_num}.{verse_num} {' '.join(words)}".replace('־ ', '־')
                output.append(verse_text)
            print("Completed chapter " + str(chapter_num))

        print("Should have completed processing XML?")

        return '\n'.join(output)
    
    except Exception as e:
        print(f"Error in process_xml_to_text: {str(e)}")
        print(f"Error type: {type(e)}")
        import traceback
        traceback.print_exc()
        raise

def find_consecutive_qeres(book_name, xml_content):
    root = ET.fromstring(xml_content)
    book = root.find('.//book')
    
    for chapter in book.findall('c'):
        chapter_num = chapter.get('n')
        for verse in chapter.findall('v'):
            verse_num = verse.get('n')
            for i in range(len(verse) - 2):
                if verse[i].tag == 'q' and verse[i+1].tag == 'q':
                    print(f"Found consecutive qeres in {book_name} {chapter_num}:{verse_num}")
                if verse[i].tag == 'q' and verse[i-1].tag not in ['k', 'q']:
                    print(f"Found orphaned qere in {book_name} {chapter_num}:{verse_num}")

def getChapterCountsTanakh(xml_content):
   root = ET.fromstring(xml_content)
   book = root.find('.//book')
   counts = {}
   
   for chapter in book.findall('c'):
       chapter_num = chapter.get('n')
       verse_count = len(chapter.findall('v'))
       counts[chapter_num] = verse_count
       
   return counts

def getChapterCountsKJV(book):
    if book == "Psalms":
        book = "Psalms (prose)"
    file = open(f"../texts/{book}.KJV.txt", "r", encoding="utf-8")
    fileLines = file.readlines()
    counts = {}
    
    currentChapter = 0
    currentVerse = 0
    for line in fileLines:
        if line.strip() != "":
            address = line.split(" ")[0].split(".")
            chapter = int(address[0])
            verse = int(address[1])

            if chapter > currentChapter and currentChapter != 0:
                counts[str(currentChapter)] = currentVerse
            
            currentChapter = chapter
            currentVerse = verse
    counts[str(currentChapter)] = currentVerse
    file.close()
    return counts

        
def compareCounts(book, xml_content):
    tanakhCountDict = getChapterCountsTanakh(xml_content)
    KJVCountDict = getChapterCountsKJV(book)

    #print(tanakhCountDict)
    #print(KJVCountDict)
    
    allChaptersTanakh = []
    allChaptersKJV = []
    for chapter in list(tanakhCountDict.keys()):
        allChaptersTanakh.append(int(chapter))
    for chapter in list(KJVCountDict.keys()):
        allChaptersKJV.append(int(chapter))

    allChaptersTanakh.sort()
    allChaptersKJV.sort()

    fixFile = False

    numChaptersTanakh = max(allChaptersTanakh)
    numChaptersKJV = max(allChaptersKJV)
    if numChaptersTanakh != numChaptersKJV:
        print(f"{book} has {numChaptersTanakh} chapters in the Tanakh, but {numChaptersKJV} in the KJV")
        fixFile = True



    for chapter in allChaptersTanakh:
        numVersesTanakh = tanakhCountDict[str(chapter)]
        numVersesKJV = KJVCountDict[str(chapter)]
        if numVersesTanakh != numVersesKJV:
            print(f"{book} {str(chapter)} has {str(numVersesTanakh)} verses in the Tanakh but {str(numVersesKJV)} in the KJV")
            fixFile = True

    return fixFile

def main(book_name):
    """Process XML for specified book and save to text file."""
    try:
        # Read XML file
        with open(f"../Hebrew XML/{book_name}.xml", 'r', encoding='utf-8') as f:
            xml_content = f.read()

        find_consecutive_qeres(book_name, xml_content)
        
        compareCounts(book_name, xml_content)
        return True
    
    except Exception as e:
        print(f"Error processing {book_name}: {str(e)}")
        return False
    
for book in allOTBooks:
    main(book)