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


def process_xml_to_text(xml_content, book_name, reversify=None):
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
    
        # Resolve the reversification map for this book (identity if none).
        if reversify is None:
            reversify = REVERSIFY_MAPS.get(book_name)

        collected = []  # list of (kjv_chapter:int, kjv_verse:int, body:str)
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
                        # A ketiv may be paired with one OR MORE qere words
                        # (e.g. Gen 30:11, where the written בגד is read as the
                        # two words בָּא גָד). Consume every consecutive <k>, then
                        # every consecutive <q>, so no qere word is dropped.
                        ketivParts = []
                        while i < len(verse) and verse[i].tag == 'k':
                            ketivParts.append(verse[i].text)
                            i += 1
                        qereParts = []
                        while i < len(verse) and verse[i].tag == 'q':
                            qereParts.append(verse[i].text)
                            i += 1

                        ketiv = ' '.join(killCantillationMarks(p) for p in ketivParts)
                        qere = ' '.join(killCantillationMarks(p) for p in qereParts)

                        ketiv = colorHapaxes(ketiv, masterHapaxList, matchToHapaxDict, book_name)
                        qere = colorHapaxes(qere, masterHapaxList, matchToHapaxDict, book_name)

                        words.append(KQTagging(ketiv, qere))
                    elif element.tag == 'q':
                        # Lone qere (qere velo ketiv): read but never written. There
                        # is no consonantal form to show, so display the qere itself.
                        loneQere = killCantillationMarks(element.text)
                        loneQere = colorHapaxes(loneQere, masterHapaxList, matchToHapaxDict, book_name)
                        words.append(f'<span class="qereVeloKetiv">{loneQere}</span>')
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

                ch_i, v_i = int(chapter_num), int(verse_num)
                if reversify:
                    ch_i, v_i = reversify(ch_i, v_i)
                body = ' '.join(words)
                collected.append((ch_i, v_i, body))
            print("Completed chapter " + str(chapter_num))

        print("Should have completed processing XML?")

        # Sort so reversified verses (e.g. Hebrew 32:1 -> KJV 31:55) land in order.
        collected.sort(key=lambda t: (t[0], t[1]))
        output = [f"{ch}.{v} {body}".replace('־ ', '־') for ch, v, body in collected]

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


# ---------------------------------------------------------------------------
# Reversification: remap Masoretic (Tanakh) verse addresses onto KJV numbering
# so the Hebrew lines up with the other editions in all_verses.
#
# Each map is a function (chapter:int, verse:int) -> (chapter:int, verse:int).
# Genesis's only divergence is the 31/32 boundary: Hebrew 32:1 is KJV 31:55,
# and Hebrew 32:2-33 shift down to KJV 32:1-32 (verified against the XML and
# texts/Genesis.KJV.txt: Hebrew ch31=54/ch32=33 vs KJV ch31=55/ch32=32).
# Other books' split/merge cases are added here as they are pilot-verified.
# ---------------------------------------------------------------------------

def genesis_reversify(chapter, verse):
    if chapter == 32:
        return (31, 55) if verse == 1 else (32, verse - 1)
    return (chapter, verse)


REVERSIFY_MAPS = {
    "Genesis": genesis_reversify,
}


def generate_grebrew_file(book_name):
    """Parse the UXLC XML for `book_name`, reversify to KJV numbering, and write
    ../texts/{book_name}.Grebrew.txt (chapter.verse <hebrew html> per line)."""
    with open(f"../Hebrew XML/{book_name}.xml", 'r', encoding='utf-8') as f:
        xml_content = f.read()
    text = process_xml_to_text(xml_content, book_name)
    out_path = f"../texts/{book_name}.Grebrew.txt"
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(text + "\n")
    print(f"Wrote {out_path} ({len(text.splitlines())} verses)")
    return out_path


if __name__ == "__main__":
    # Diagnostics over every OT book (read-only). Guarded so the module can be
    # imported without side effects.
    for book in allOTBooks:
        main(book)