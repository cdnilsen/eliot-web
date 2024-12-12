export type stringToStringListDict = {
    [key: string]: string[]
}

export let sectionToBookDict: stringToStringListDict = {
    "Pentateuch": ["Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy"],
    "Historical": ["Joshua", "Judges", "Ruth", "1 Samuel", "2 Samuel", "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles", "Ezra", "Nehemiah", "Esther"],
    "Wisdom": ["Job", "Proverbs", "Psalms", "Ecclesiastes", "Song of Songs"],
    "Major Prophets": ["Isaiah", "Jeremiah", "Lamentations", "Ezekiel", "Daniel"],
    "Minor Prophets": ["Hosea", "Joel", "Amos", "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk", "Zephaniah", "Haggai", "Zechariah", "Malachi"],
    "Gospels": ["Matthew", "Mark", "Luke", "John"],
    "Rest of NT": []
}