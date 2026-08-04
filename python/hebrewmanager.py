import os
import xml.etree.ElementTree as ET
from library import cantillationMarksCodePoints, leftoverHapaxes
import unicodedata


allOTBooks = ["Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy", "Joshua", "Judges", "Ruth", "1 Samuel", "2 Samuel", "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles", "Ezra", "Nehemiah", "Esther", "Job", "Psalms", "Proverbs", "Ecclesiastes", "Song of Songs", "Isaiah", "Jeremiah", "Lamentations", "Ezekiel", "Daniel", "Hosea", "Joel", "Amos", "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk", "Zephaniah", "Haggai", "Zechariah", "Malachi"]

textFolder = "../texts/"
hebrewXMLFolder = "../hebrew_text_files/"

def word_text(element):
    """Full text of a <w>/<k>/<q>, including tails after inline markers.
    <x> elements are editorial note references (content is a letter like
    'd'/'t'/'q', NOT part of the word), so their text is dropped while the word
    continues in their tail — e.g. <w>קֹ<x>d</x>רַח</w> is the single word קֹרַח.
    <s> (unusually sized letter) and any other inline text IS part of the word."""
    parts = [element.text or ""]
    for child in element:
        if child.tag != "x":
            parts.append(child.text or "")
        parts.append(child.tail or "")
    return "".join(parts)


def killCantillationMarks(word):
    if not word:  # empty/None <w>/<k>/<q> text
        return ""
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

    hapaxFile.close()
    if not thisBookHapaxLine:  # no curated hapax list for this book -> no colouring
        return []

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
                   cleanedWord = killCantillationMarks(word_text(element))
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
    leftoverHapaxList = list(leftoverHapaxes.get(book, {}).keys())
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


def process_word_elements(elements, book_name, masterHapaxList, matchToHapaxDict):
    """Turn a list of <w>/<k>/<q>/<pe>/<samekh> elements into a body string:
    cantillation stripped, qere/ketiv tagged, hapaxes coloured, whitespace
    normalized. Works on a whole verse's children or any slice of them (used by
    the Psalms superscription splitter)."""
    words = []
    i = 0
    n = len(elements)
    while i < n:
        element = elements[i]
        if element.tag == 'k':
            # A ketiv may be paired with one OR MORE qere words (e.g. Gen 30:11,
            # written בגד read as בָּא גָד). Consume all consecutive <k> then all
            # consecutive <q> so no qere word is dropped.
            ketivParts = []
            while i < n and elements[i].tag == 'k':
                ketivParts.append(word_text(elements[i]))
                i += 1
            qereParts = []
            while i < n and elements[i].tag == 'q':
                qereParts.append(word_text(elements[i]))
                i += 1
            ketiv = ' '.join(killCantillationMarks(p) for p in ketivParts)
            qere = ' '.join(killCantillationMarks(p) for p in qereParts)
            ketiv = colorHapaxes(ketiv, masterHapaxList, matchToHapaxDict, book_name)
            qere = colorHapaxes(qere, masterHapaxList, matchToHapaxDict, book_name)
            words.append(KQTagging(ketiv, qere))
        elif element.tag == 'q':
            # Lone qere (qere velo ketiv): read but never written -> show the qere.
            loneQere = killCantillationMarks(word_text(element))
            loneQere = colorHapaxes(loneQere, masterHapaxList, matchToHapaxDict, book_name)
            words.append(f'<span class="qereVeloKetiv">{loneQere}</span>')
            i += 1
        elif element.tag == 'w':
            cleanedWord = killCantillationMarks(word_text(element))
            if cleanedWord:
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
    # Collapse any embedded whitespace (some UXLC <w> texts carry a stray
    # newline, e.g. Jer 34:21) so one verse == one output line.
    return ' '.join(' '.join(words).split()).replace('־ ', '־')


def process_xml_to_text(xml_content, book_name):
    """Parse the UXLC XML into an ordered list of (chapter, verse, body) tuples
    in the Masoretic (Hebrew) numbering, with cantillation stripped, qere/ketiv
    tagged, and hapaxes coloured. Reversification to KJV numbering happens later
    (generate_grebrew_file), not here."""
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
    
        collected = []  # list of (heb_chapter:int, heb_verse:int, body:str)
        for chapter in book.findall('c'):
            chapter_num = chapter.get('n')
            #print(chapter_num)
            for verse in chapter.findall('v'):
                verse_num = verse.get('n')
                body = process_word_elements(list(verse), book_name, masterHapaxList, matchToHapaxDict)
                collected.append((int(chapter_num), int(verse_num), body))
            #print("Completed chapter " + str(chapter_num))

        return collected
    
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
# For the great majority of OT books the ONLY difference is where chapter
# boundaries fall: the verse *sequence* is identical, so we flatten the Hebrew
# verses in canonical order and re-chapter them by the KJV chapter sizes. This
# covers books with identical numbering, pure boundary reshuffles (e.g. Genesis
# 31/32), and books whose chapter *count* differs (Joel, Malachi) — all in one
# mechanism, with counts matching KJV by construction.
#
# Books with an actual verse split/merge (Numbers, 1 Samuel, 1 Kings,
# 1 Chronicles, Nehemiah, Isaiah) or superscription shifts (Psalms) have
# different verse totals and are NOT handled here; they need per-verse logic.
# ---------------------------------------------------------------------------

# Books whose Masoretic and KJV verse *totals* differ (split/merge or Psalms).
# These are excluded from the flatten-by-KJV mechanism and handled separately.
COMPLEX_BOOKS = {
    "Numbers", "1 Samuel", "1 Kings", "1 Chronicles", "Nehemiah", "Isaiah", "Psalms",
}


def kjv_chapter_sizes(book_name):
    """Ordered list of KJV verse counts per chapter, from texts/{book}.KJV.txt."""
    file_book = "Psalms (prose)" if book_name == "Psalms" else book_name
    counts = {}
    with open(f"../texts/{file_book}.KJV.txt", 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or '.' not in line.split(' ')[0]:
                continue
            ch, vs = line.split(' ')[0].split('.')
            counts[int(ch)] = max(counts.get(int(ch), 0), int(vs))
    return [counts[ch] for ch in sorted(counts)]


def reindex_by_kjv(verses, kjv_sizes):
    """Flatten Hebrew `verses` (ordered (ch, v, body)) and relabel them by the
    KJV chapter sizes. Requires equal totals (pure boundary reshuffling)."""
    total = sum(kjv_sizes)
    if len(verses) != total:
        raise ValueError(f"verse count {len(verses)} != KJV total {total}; not a pure boundary shift")
    out = []
    it = iter(verses)
    for ch_idx, size in enumerate(kjv_sizes, start=1):
        for v in range(1, size + 1):
            _, _, body = next(it)
            out.append((ch_idx, v, body))
    return out


def generate_grebrew_file(book_name):
    """Parse the UXLC XML for `book_name`, reversify to KJV numbering, and write
    ../texts/{book_name}.Grebrew.txt (chapter.verse <hebrew html> per line)."""
    if book_name in COMPLEX_BOOKS:
        raise ValueError(f"{book_name} has a verse split/merge or superscription shift; handle separately")
    with open(f"../Hebrew XML/{book_name}.xml", 'r', encoding='utf-8') as f:
        xml_content = f.read()
    verses = process_xml_to_text(xml_content, book_name)
    verses = reindex_by_kjv(verses, kjv_chapter_sizes(book_name))
    out_path = f"../texts/{book_name}.Grebrew.txt"
    with open(out_path, 'w', encoding='utf-8') as f:
        for ch, v, body in verses:
            f.write(f"{ch}.{v} {body}\n")
    print(f"Wrote {out_path} ({len(verses)} verses)")
    return out_path


if __name__ == "__main__":
    # Diagnostics over every OT book (read-only). Guarded so the module can be
    # imported without side effects.
    for book in allOTBooks:
        main(book)