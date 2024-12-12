export type stringToStringListDict = {
    [key: string]: string[]
}

export let sectionToBookDict: stringToStringListDict = {
    "pentateuch": ["Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy"],
    "history": ["Joshua", "Judges", "Ruth", "1 Samuel", "2 Samuel", "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles", "Ezra", "Nehemiah", "Esther"],
    "wisdom": ["Job", "Proverbs", "Psalms", "Ecclesiastes", "Song of Songs"],
    "major_ prophets": ["Isaiah", "Jeremiah", "Lamentations", "Ezekiel", "Daniel"],
    "minor_prophets": ["Hosea", "Joel", "Amos", "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk", "Zephaniah", "Haggai", "Zechariah", "Malachi"],
    "gospels_acts": ["Matthew", "Mark", "Luke", "John"],
    "other_nt": ["Romans", "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians", "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians", "1 Timothy", "2 Timothy", "Titus", "Philemon", "Hebrews", "James", "1 Peter", "2 Peter", "1 John", "2 John", "3 John", "Jude", "Revelation"]
}