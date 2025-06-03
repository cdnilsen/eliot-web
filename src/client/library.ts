export type stringToStringListDict = {
    [key: string]: string[]
}

export type stringToIntDict = {
    [key: string]: number
}

export type BookName = "Genesis" | "Exodus" | "Leviticus" | "Numbers" | "Deuteronomy" | 
    "Joshua" | "Judges" | "Ruth" | "1 Samuel" | "2 Samuel" | "1 Kings" | "2 Kings" | 
    "1 Chronicles" | "2 Chronicles" | "Ezra" | "Nehemiah" | "Esther" | "Job" | "Psalms (prose)" | 
    "Proverbs" | "Ecclesiastes" | "Song of Songs" | "Isaiah" | "Jeremiah" | "Lamentations" | 
    "Ezekiel" | "Daniel" | "Hosea" | "Joel" | "Amos" | "Obadiah" | "Jonah" | "Micah" | 
    "Nahum" | "Habakkuk" | "Zephaniah" | "Haggai" | "Zechariah" | "Malachi" | "Matthew" | 
    "Mark" | "Luke" | "John" | "Acts" | "Romans" | "1 Corinthians" | "2 Corinthians" | 
    "Galatians" | "Ephesians" | "Philippians" | "Colossians" | "1 Thessalonians" | 
    "2 Thessalonians" | "1 Timothy" | "2 Timothy" | "Titus" | "Philemon" | "Hebrews" | 
    "James" | "1 Peter" | "2 Peter" | "1 John" | "2 John" | "3 John" | "Jude" | "Revelation" | 
    "Family Religion" | "Milk for Babes" | "Lord's Day" | "Confession of Faith"; 

export const bookToIDDict: Record<BookName, string> = {
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
    "Revelation": "066",
    "Family Religion": "068",
    "Milk for Babes": "069",
    "Lord's Day": "070",
    "Confession of Faith": "071"
};

export const IDToBookDict: Record<string, string> = {
    "001": "Genesis",
    "002": "Exodus",
    "003": "Leviticus",
    "004": "Numbers",
    "005": "Deuteronomy",
    "006": "Joshua",
    "007": "Judges",
    "008": "Ruth",
    "009": "1 Samuel",
    "010": "2 Samuel",
    "011": "1 Kings",
    "012": "2 Kings",
    "013": "1 Chronicles",
    "014": "2 Chronicles",
    "015": "Ezra",
    "016": "Nehemiah",
    "017": "Esther",
    "018": "Job",
    "019": "Psalms (prose)",
    "020": "Proverbs",
    "021": "Ecclesiastes",
    "022": "Song of Songs",
    "023": "Isaiah",
    "024": "Jeremiah",
    "025": "Lamentations",
    "026": "Ezekiel",
    "027": "Daniel",
    "028": "Hosea",
    "029": "Joel",
    "030": "Amos",
    "031": "Obadiah",
    "032": "Jonah",
    "033": "Micah",
    "034": "Nahum",
    "035": "Habakkuk",
    "036": "Zephaniah",
    "037": "Haggai",
    "038": "Zechariah",
    "039": "Malachi",
    "040": "Matthew",
    "041": "Mark",
    "042": "Luke",
    "043": "John",
    "044": "Acts",
    "045": "Romans",
    "046": "1 Corinthians",
    "047": "2 Corinthians",
    "048": "Galatians",
    "049": "Ephesians",
    "050": "Philippians",
    "051": "Colossians",
    "052": "1 Thessalonians",
    "053": "2 Thessalonians",
    "054": "1 Timothy",
    "055": "2 Timothy",
    "056": "Titus",
    "057": "Philemon",
    "058": "Hebrews",
    "059": "James",
    "060": "1 Peter",
    "061": "2 Peter",
    "062": "1 John",
    "063": "2 John",
    "064": "3 John",
    "065": "Jude",
    "066": "Revelation",
    "068": "Family Religion",
    "069": "Milk for Babes",
    "070": "Lord's Day",
    "071": "Confession of Faith"
};

export let sectionToBookDict: stringToStringListDict = {
    "pentateuch": ["Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy"],
    "history": ["Joshua", "Judges", "Ruth", "1 Samuel", "2 Samuel", "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles", "Ezra", "Nehemiah", "Esther"],
    "wisdom": ["Job", "Psalms (prose)", "Proverbs", "Ecclesiastes", "Song of Songs"],
    "major_prophets": ["Isaiah", "Jeremiah", "Lamentations", "Ezekiel", "Daniel"],
    "minor_prophets": ["Hosea", "Joel", "Amos", "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk", "Zephaniah", "Haggai", "Zechariah", "Malachi"],
    "gospels_acts": ["Matthew", "Mark", "Luke", "John", "Acts"],
    "other_nt": ["Romans", "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians", "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians", "1 Timothy", "2 Timothy", "Titus", "Philemon", "Hebrews", "James", "1 Peter", "2 Peter", "1 John", "2 John", "3 John", "Jude", "Revelation"],
    "mishnaic": ["Family Religion", "Milk for Babes", "Lord's Day", "Confession of Faith"]
}

export let bookToChapterDict: stringToIntDict = {
    "Genesis": 50,
    "Exodus": 40,
    "Leviticus": 27,
    "Numbers": 36,
    "Deuteronomy": 34,
    "Joshua": 24,
    "Judges": 21,
    "Ruth": 4,
    "1 Samuel": 31,
    "2 Samuel": 24,
    "1 Kings": 22,
    "2 Kings": 25,
    "1 Chronicles": 29,
    "2 Chronicles": 36,
    "Ezra": 10,
    "Nehemiah": 13,
    "Esther": 10,
    "Job": 42,
    "Psalms (prose)": 150,
    "Proverbs": 31,
    "Ecclesiastes": 12,
    "Song of Songs": 8,
    "Isaiah": 66,
    "Jeremiah": 52,
    "Lamentations": 5,
    "Ezekiel": 48,
    "Daniel": 12,
    "Hosea": 14,
    "Joel": 3,
    "Amos": 9,
    "Obadiah": 1,
    "Jonah": 4,
    "Micah": 7,
    "Nahum": 3,
    "Habakkuk": 3,
    "Zephaniah": 3,
    "Haggai": 2,
    "Zechariah": 14,
    "Malachi": 4,
    "Matthew": 28,
    "Mark": 16,
    "Luke": 24,
    "John": 21,
    "Acts": 28,
    "Romans": 16,
    "1 Corinthians": 16,
    "2 Corinthians": 13,
    "Galatians": 6,
    "Ephesians": 6,
    "Philippians": 4,
    "Colossians": 4,
    "1 Thessalonians": 5,
    "2 Thessalonians": 3,
    "1 Timothy": 6,
    "2 Timothy": 4,
    "Titus": 3,
    "Philemon": 1,
    "Hebrews": 13,
    "James": 5,
    "1 Peter": 5,
    "2 Peter": 3,
    "1 John": 5,
    "2 John": 1,
    "3 John": 1,
    "Jude": 1,
    "Revelation": 22,
    "Milk for Babes": 13,
    "Family Religion": 27,
    "Lord's Day": 36,
    "Confession of Faith": 32
}

export const allBookList = [
    "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy",
    "Joshua", "Judges", "Ruth", "1 Samuel", "2 Samuel", "1 Kings", "2 Kings",
    "1 Chronicles", "2 Chronicles", "Ezra", "Nehemiah", "Esther",
    "Job", "Psalms (prose)", "Proverbs", "Ecclesiastes", "Song of Songs",
    "Isaiah", "Jeremiah", "Lamentations", "Ezekiel", "Daniel",
    "Hosea", "Joel", "Amos", "Obadiah", "Jonah", "Micah", "Nahum",
    "Habakkuk", "Zephaniah", "Haggai", "Zechariah", "Malachi",
    "Matthew", "Mark", "Luke", "John", "Acts",
    "Romans", "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians",
    "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians",
    "1 Timothy", "2 Timothy", "Titus", "Philemon", "Hebrews",
    "James", "1 Peter", "2 Peter", "1 John", "2 John", "3 John", "Jude", "Revelation",
    "Milk for Babes", "Family Religion", "Lord's Day", "Confession of Faith"
]

export type StringToStringDict = {
    [key: string]: string
}

export function reverseDictionary(dict: StringToStringDict): StringToStringDict {
    let reversedDict: StringToStringDict = {};
    for (let key in dict) {
        if (dict[key] in reversedDict) {
            console.error('Duplicate key in reverse dictionary:', dict[key]);
            return {};
        } else {
            reversedDict[dict[key]] = key;
        }
    }
    return reversedDict;
}

export type BookToShorthandDictType = {
    [bookName: string]: {
        [editionKey: string]: string
    }
}


export let bookToShorthandDict: BookToShorthandDictType = {
    "Family Religion": {
        "first_edition": "α (anonymous, 1714)",
        "mayhew": "Mayhew (early 1720s)",
        "kjv": "English"
    },
    "Lord's Day": {
        "mayhew": "Mayhew (1707)",
        "kjv": "English"
    },
    "Milk for Babes": {
        "first_edition": "α (Rawson, 1691)",
        "kjv": "English (John Cotton, 1657)"
    },
    "Confession of Faith": {
        "first_edition": "α (Rawson, 1699)",
        "kjv": "English (1680)"
    }
}

