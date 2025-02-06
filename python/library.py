# /C:/Users/Campbell/Desktop/eliot-web/python/library.py

# Basic dictionary to export
bookToIDDict = {
    "Genesis": "001",
    "Exodus": "002",
    "Leviticus": "003",
    "Numbers": "004",
    "Deuteronomy": "005",
    "Joshua": "006",
    "Judges": "007",
    "Ruth": "008",
    "1 Samuel": "009",
    "2 Samuel": "010",
    "1 Kings": "011",
    "2 Kings": "012",
    "1 Chronicles": "013",
    "2 Chronicles": "014",
    "Ezra": "015",
    "Nehemiah": "016",
    "Esther": "017",
    "Job": "018",
    "Psalms (prose)": "019",
    "Proverbs": "020",
    "Ecclesiastes": "021",
    "Song of Songs": "022",
    "Isaiah": "023",
    "Jeremiah": "024",
    "Lamentations": "025",
    "Ezekiel": "026",
    "Daniel": "027",
    "Hosea": "028",
    "Joel": "029",
    "Amos": "030",
    "Obadiah": "031",
    "Jonah": "032",
    "Micah": "033",
    "Nahum": "034",
    "Habakkuk": "035",
    "Zephaniah": "036",
    "Haggai": "037",
    "Zechariah": "038",
    "Malachi": "039",
    "Matthew": "040",
    "Mark": "041",
    "Luke": "042",
    "John": "043",
    "Acts": "044",
    "Romans": "045",
    "1 Corinthians": "046",
    "2 Corinthians": "047",
    "Galatians": "048",
    "Ephesians": "049",
    "Philippians": "050",
    "Colossians": "051",
    "1 Thessalonians": "052",
    "2 Thessalonians": "053",
    "1 Timothy": "054",
    "2 Timothy": "055",
    "Titus": "056",
    "Philemon": "057",
    "Hebrews": "058",
    "James": "059",
    "1 Peter": "060",
    "2 Peter": "061",
    "1 John": "062",
    "2 John": "063",
    "3 John": "064",
    "Jude": "065",
    "Revelation": "066"
}

# Export the dictionary
def getBookIDs():
    return bookToIDDict


def handleEngma(word):
    labials = ["p", "b", "m", "P", "B", "M"]
    for i in range(len(word) - 1):
        thisChar = word[i]
        nextChar = word[i + 1]
        if (thisChar == "ŋ"):
            replacement = "n"
            if nextChar in labials:
                replacement = "m"
            word = word[:i] + replacement + word[i + 1:]
        elif (thisChar == "Ŋ"):
            replacement = "N"
            if nextChar in labials:
                replacement = "M"
            word = word[:i] + replacement + word[i + 1:]
        else:
            pass
    return word

def cleanDiacritics(word):
    diacriticDict = {
        "á": "a",
        "Á": "A",
        "à": "a",
        "À": "A",
        "â": "a",
        "Â": "A",
        "ä": "a",
        "Ä": "A",
        "ã": "aŋ",
        "Ã": "AŊ",
        "ā": "aŋ",
        "Ā": "AŊ",
        "é": "e",
        "É": "E",
        "è": "e",
        "È": "E",
        "ê": "e",
        "Ê": "E",
        "ë": "e",
        "Ë": "E",
        "ẽ": "eŋ",
        "Ẽ": "EŊ",
        "ē": "eŋ",
        "Ē": "EŊ",
        "í": "i",
        "Í": "I",
        "ì": "i",
        "Ì": "I",
        "î": "i",
        "Î": "I",
        "ï": "i",
        "Ï": "I",
        "ĩ": "iŋ",
        "Ĩ": "IŊ",
        "ī": "iŋ",
        "Ī": "IŊ",
        "ó": "o",
        "Ó": "O",
        "ò": "o",
        "Ò": "O",
        "ô": "o",
        "Ô": "O",
        "ö": "o",
        "Ö": "O",
        "õ": "oŋ",
        "Õ": "OŊ",
        "ō": "oŋ",
        "Ō": "OŊ",
        "ú": "u",
        "Ú": "U",
        "ù": "u",
        "Ù": "U",
        "û": "u",
        "Û": "U",
        "ü": "u",
        "Ü": "U",
        "ũ": "uŋ",
        "Ũ": "UŊ",
        "ū": "uŋ",
        "Ū": "UŊ",
        "ñ": "nn",
        "Ñ": "NN",
        "n⁻": "nn",
        "N⁻": "NN",
        "m̃": "mm",
        "M̃": "MM",
        "m⁻": "mm",
        "M⁻": "MM",
    }

    charList = ["á", "Á", "à", "À", "â", "Â", "ä", "Ä", "ã", "Ã", "ā", "Ā", "é", "É", "è", "È", "ê", "Ê", "ë", "Ë", "ẽ", "Ẽ", "ē", "Ē", "í", "Í", "ì", "Ì", "î", "Î", "ï", "Ï", "ĩ", "Ĩ", "ī", "Ī", "ó", "Ó", "ò", "Ò", "ô", "Ô", "ö", "Ö", "õ", "Õ", "ō", "Ō", "ú", "Ú", "ù", "Ù", "û", "Û", "ü", "Ü", "ũ", "Ũ", "ū", "Ū", "ñ", "Ñ", "n⁻", "N⁻", "m̃", "M̃", "m⁻", "M⁻"]

    for char in charList:
        word = word.replace(char, diacriticDict[char])

    if ("ŋ" in word or "Ŋ" in word):
        word = handleEngma(word)
    
        
    return word

def cleanWord(word):    
    smallCapDict = {
        "ᴏ": "o",
        "ʀ": "r",
        "ᴅ": "d"
    }

    if (word.startswith("OO") and word.upper() != word):
        word = "8" + word[2:]


    for smallCap in ["ᴏ", "ʀ", "ᴅ"]:
        word = word.replace(smallCap, smallCapDict[smallCap])

    word = word.lower()

    punctuation = ['.', ',', ';', ':', '!', '?', '(', ')', '[', ']', '{', '}', '"', "'", '“', '”', '‘', '’', '—', '–', '…', '•', '·', '«', '»', '„', '¶']

    for char in punctuation:
        word = word.replace(char, "")

    return word

cantillationMarksCodePoints = [
    "u0591",
    "u0592",
    "u0593",
    "u0594",
    "u0595",
    "u0596",
    "u0597",
    "u0598",
    "u0599",
    "u059a",
    "u059b",
    "u059c",
    "u059d",
    "u059e",
    "u059f",
    "u05a0",
    "u05a1",
    "u05a2",
    "u05a3",
    "u05a4",
    "u05a5",
    "u05a6",
    "u05a7",
    "u05a8",
    "u05a9",
    "u05aa",
    "u05ab",
    "u05ac",
    "u05ad",
    "u05ae",
    "u05af"
]

leftoverHapaxes = {
    "Genesis": {
        "וְקֹר": "קֹר",
        "בְּשָׁוֵה": "שָׁוֵה",
        "וְלוּז": "לוּז",
        "בְּכַר": "כַר",
        "חֹרִי": "חֹרִי"
    },
    "Exodus": {
    },
    "Leviticus": {
        "דְּוֺתָהּ": "דְּוֺת",
        "קֽ͏ַעֲקַע": "קֽ͏ַעֲקַע"
    },
    "Numbers": {

    },
    "Deuteronomy": {

    },
    "Joshua": {

    },
    "Judges": {

    },
    "Ruth": {
        "מֹֽדַעְתָּנוּ": "מֹֽדַעְתָּנוּ", 
        "בטרום": "טרום"
    }
}


reversificationDictionary = {
    
}