import xml.etree.ElementTree as ET
import re
import unicodedata
import os


def normalize_hebrew(text: str) -> str:
    """
    Normalize Hebrew text by removing cantillation marks while preserving niqqud (vowel points).
    Also handles final forms and other normalizations.
    """
    # First, decompose the characters to separate base letters from diacritics
    decomposed = unicodedata.normalize('NFD', text)
    
    # Remove only cantillation marks, keeping niqqud
    # Cantillation marks: 0x0591-0x05AF
    # Keeping niqqud (0x05B0-0x05BC), dagesh/mapiq/shuruq (0x05BC), meteg (0x05BD), and rafe (0x05BF)
    cleaned = ''.join(c for c in decomposed if not (0x0591 <= ord(c) <= 0x05AF))
    
    # Normalize back to composed form
    normalized = unicodedata.normalize('NFC', cleaned)
    
    # Remove other special characters and whitespace
    normalized = re.sub(r'[\u0027\u2019\u05BE\u05C0\u05C3\u05C6\s]', '', normalized)
    
    # Handle final forms explicitly if needed
    final_forms = {
        'ך': 'כ',
        'ם': 'מ',
        'ן': 'נ',
        'ף': 'פ',
        'ץ': 'צ'
    }
    for final, regular in final_forms.items():
        normalized = normalized.replace(final, regular)
    
    return normalized


def extract_hebrew(text):
    text = text.strip()
    text = text[text.find(">")+1:text.find("<", text.find(">")+1)]
    return normalize_hebrew(text)

def fetchHapaxLine(book):
    path = '../eliotweb (old)/OTHapaxList.txt'
    lines = open(path, 'r', encoding='utf-8').readlines()

    for line in lines:
        if line.startswith(book):
            return line.strip().split('|')[1].strip()
        
    return None

def fetchHapaxes(book):
    line = fetchHapaxLine(book)
    allHapaxes = line.split(',')

    finalList = []
    for hapax in allHapaxes:
        finalList.append(normalize_hebrew(hapax))
    return finalList

def fetchHebrew(book):
    path = '../eliotweb (old)/Hebrew XML/' + book + '.xml'
    lines = open(path, 'r', encoding='utf-8').readlines()
    hapaxes = fetchHapaxes(book)
    originalHapaxList = len(hapaxes)
    foundHapaxCounter = 0
    foundHapaxes = []
    for rawLine in lines:
        line = rawLine.strip()
        tags = ["<w>", "<k>", "<q>"]
        for (i, tag) in enumerate(tags):
            if line.startswith(tag):
                line = extract_hebrew(rawLine)
                for hapax in hapaxes:
                    if hapax in line:
                        foundHapaxCounter += 1
                        foundHapaxes.append(hapax)

    if (len(hapaxes) != foundHapaxCounter):
        print("Found", foundHapaxCounter, "hapaxes in", book)
        print("Should have found", len(hapaxes), "hapaxes in", book)

        for hapax in hapaxes:
            if hapax not in foundHapaxes:
                print(hapax, "not found in", book)
                        


#fetchHebrew('Song of Songs')

allBooks = [
    "Genesis",
    "Exodus",
    "Leviticus",
    "Numbers",
    "Deuteronomy",
    "Joshua",
    "Judges",
    "Ruth",
    "1 Samuel",
    "2 Samuel",
    "1 Kings",
    "2 Kings",
    "1 Chronicles",
    "2 Chronicles",
    "Ezra",
    "Nehemiah",
    "Esther",
    "Job",
    "Psalms",
    "Proverbs",
    "Ecclesiastes",
    "Song of Songs",
    "Isaiah",
    "Jeremiah",
    "Lamentations",
    "Ezekiel",
    "Daniel",
    "Hosea",
    "Joel",
    "Amos",
    "Obadiah",
    "Jonah",
    "Micah",
    "Nahum",
    "Habakkuk",
    "Zephaniah",
    "Haggai",
    "Zechariah",
    "Malachi"
    ]

for book in allBooks:
    fetchHebrew(book)
    print("\n\n")