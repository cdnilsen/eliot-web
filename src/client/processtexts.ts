import { StringLiteral } from 'typescript';
import { stringToStringListDict, BookName, bookToIDDict, bookToChapterDict, sectionToBookDict, stringToIntDict } from './library.js';
import { get } from 'http';


type StringToStringDict = {
    [key: string]: string
}

type Edition = "first" | "second" | "mayhew" | "zeroth" | "kjv" | "grebrew";

type CheckboxObject = {
    div: HTMLDivElement,
    checkbox: HTMLInputElement,
    edition: Edition,
    contentDiv?: HTMLDivElement
}

type FileCheckboxDict = {
    [key: string]: CheckboxObject
}

let editionToShorthandDict: Record<Edition, string> = {
    "first": "α",
    "second": "β",
    "mayhew": "M",
    "zeroth": "א",
    "kjv": "E",
    "grebrew": "G"
}

let editionToNumberDict: Record<Edition, string> = {
    "first": "2",
    "second": "3",
    "mayhew": "4",
    "zeroth": "5",
    "kjv": "6",
    "grebrew": "7"
}

function print(text: string) {
    console.log(text);
}


type BookSectionDict = {
    [key: string]: stringToStringListDict
}

function getBookSection(bookName: string) {
    let allSections = Object.keys(sectionToBookDict);
    for (let i=0; i<allSections.length; i++) {
        if (sectionToBookDict[allSections[i]].includes(bookName)) {
            return allSections[i];
        }
    }
    console.log(bookName + " not found in sectionToBookDict");
    return "";
}

function assignFileToBook(fileName: string, dict: BookSectionDict) {
    let splitName = fileName.split(".");
    let bookName = splitName[0];
    let editionName = splitName[1];

    let sectionName = getBookSection(bookName);

    if (sectionName in dict) {
        let sectionDict = dict[sectionName];
        if (bookName in sectionDict) {
            sectionDict[bookName].push(editionName);
        } else {
            sectionDict[bookName] = [editionName];
        }
    } else {
        dict[sectionName] = { [bookName]: [editionName] };
    }
}

async function loadTextFiles() {
    try {
        let dict: BookSectionDict = {};
        const response = await fetch('/textfiles');
        const files = await response.json();
        for (let i=0; i < files.length; i++) { 
            let fileName = files[i];
            assignFileToBook(fileName, dict);
        }
        return dict;
    } catch (error) {
        console.error('Error loading text files:', error);
    }
}


function populateBookDropdown(dict: BookSectionDict, section: string) {
    let bookDropdown = document.getElementById('bookDropdown');
    if (bookDropdown) {
        bookDropdown.innerHTML = "";
        if (section in sectionToBookDict) {
            for (let i=0; i < sectionToBookDict[section].length; i++) {
                let book = sectionToBookDict[section][i];
                //console.log(book);
                let option = document.createElement('option');
                option.value = book;
                option.text = book;
                bookDropdown.appendChild(option);
            }
        }
    }
}

// Define a type for the section keys
type SectionKey = 'pentateuch' | 'history' | 'wisdom' | 'major_prophets' | 'minor_prophets' | 'gospels_acts' | 'other_nt';

function populateSectionDropdown(dict: BookSectionDict) {
    const dropdownValueDict: Record<SectionKey, string> = {
        "pentateuch": "Pentateuch",
        "history": "Historical Books",
        "wisdom": "Wisdom/Poetic Books",
        "major_prophets": "Major Prophets",
        "minor_prophets": "Minor Prophets",
        "gospels_acts": "Gospels and Acts",
        "other_nt": "Other New Testament Books"
    };

    const sectionOrder: SectionKey[] = ["pentateuch", "history", "wisdom", "major_prophets", "minor_prophets", "gospels_acts", "other_nt"];

    let sectionDropdown = document.getElementById('sectionDropdown');
    if (sectionDropdown) {
        sectionDropdown.innerHTML = "";
        for (let i = 0; i < sectionOrder.length; i++) {
            let thisSection = sectionOrder[i];
            if (thisSection in dict && thisSection in dropdownValueDict) {
                let sectionName = dropdownValueDict[thisSection];
                let option = document.createElement('option');
                option.value = thisSection;
                option.text = sectionName;
                sectionDropdown.appendChild(option);
                if (i == 0) {
                    populateBookDropdown(dict, sectionName);
                }
            }
        }
        sectionDropdown.addEventListener('change', (event) => {
            let section = (event.target as HTMLSelectElement).value as SectionKey;
            populateBookDropdown(dict, section);
        });
    }
}

function chapterStringLengthManager(address: string) {
    if (address.length == 1) {
        return "00" + address;
    } else if (address.length == 2) {
        return "0" + address;
    } else {
        return address;
    }
}

type VerseAddress = {
    chapter: number,
    verse: number
}

type LineObject = {
    verseID: string,
    address: VerseAddress,
    lineText: string,
    isValid: boolean
}

// Update edition to column mapping
const editionToColumnDict: Record<EditionName, ColumnName> = {
    "First Edition": "first_edition",
    "Second Edition": "second_edition",
    "Mayhew": "mayhew",
    "Zeroth Edition": "zeroth_edition",
    "KJV": "kjv",
    "Grebrew": "grebrew"
};

const validEditions: EditionName[] = [
    "First Edition",
    "Second Edition",
    "Mayhew",
    "Zeroth Edition",
    "KJV",
    "Grebrew"
];


//OK, start in on the word processing
/*
function editionIDNumber(id: string, edition: EditionName): string {
    let strippedID = id.slice(1);
    return editionToNumberDict[edition] + strippedID;
}

function processWordsInVerse(verse: string) {

}



// Update type checking function
function isValidEdition(edition: string): edition is EditionName {
    return validEditions.includes(edition as EditionName);
}
*/


function cleanWord(word: string) {

    if (word.startsWith("OO")) {
        word = "8" + word.slice(2);
    }
    word = word.toLowerCase();
    word = word.replace("ᴏᴅ", "od");
    let punctuation = [".", ",", ";", ":", "!", "?", "(", ")", "[", "]", "{", "}", "<", ">", "\"", "'", "“", "”", "‘", "’", "—", "–", "…", "·"];
    for (let i=0; i < punctuation.length; i++) {
        word = word.replace(punctuation[i], "");
    }
    return word;
}

function getVerseWordDict(wordList: string[]) {
    let dict: stringToIntDict = {};

    for (let i=0; i < wordList.length; i++) {
        let word = cleanWord(wordList[i]);
        if (word in dict) {
            dict[word] += 1;
        } else {
            dict[word] = 1;
        }
    }
    return dict;
}


function reprocessID(id: string, column: string): string {
    const dict: { [key: string]: string } = {
        'first_edition': '2',
        'second_edition': '3',
        'mayhew': '4',
        'zeroth_edition': '5'
    };
    
    if ((column in dict) && (id.length > 0)) {
        let strippedID = id.slice(1);
        return dict[column] + strippedID;
    } else {
        return id;
    }
}


function isBookName(name: string): name is BookName {
    return name in bookToIDDict;
}


function processLine(line: string, columnName: ColumnName, bookName: string): LineObject {
    let object: LineObject = {
        verseID: "",
        address: {
            chapter: 0,
            verse: 0
        },
        lineText: "",
        isValid: false
    }

    // Early return if line is empty or book is invalid
    if (line.length == 0 || !isBookName(bookName)) {
        console.log("Error in " + bookName + " " + columnName + ": ");
        if (line.length == 0) {
            console.log("Empty line");
        } else {
            console.log("Invalid book name");
        }
        return object;
    }

    let shorthand = shorthandDict[columnName];

    let splitLine = line.split(" ");
    let address = splitLine[0];
    let lineText = splitLine.slice(1).join(" ").trim();

    if (!address.includes(".")) {
        console.log("Error in " + bookName + " " + shorthand + "." + address + ": address doesn't have a period");
        return object;
    }

    let splitAddress = address.split(".");
    let chapterNum = splitAddress[0];
    let verseNum = splitAddress[1];

    if (isNaN(parseInt(chapterNum)) || isNaN(parseInt(verseNum))) {
        console.log("Error in " + bookName + " " + shorthand + "." + address + ": chapter or verse is not a number");
        return object;
    }

    object.lineText = lineText;

    let IDLeadingDigit = "1";
    // Now TypeScript knows bookName is definitely of type BookName
    let id = IDLeadingDigit + bookToIDDict[bookName] + chapterStringLengthManager(chapterNum) + chapterStringLengthManager(verseNum);

    object.verseID = id;
    object.address = {
        chapter: parseInt(chapterNum),
        verse: parseInt(verseNum)
    }

    object.isValid = true;

    return object;
}

type IDtoVerseAddressDict = {
    [key: string]: VerseAddress
}

type LineDict = {
    lines: StringToStringDict,
    ids: string[],
    addresses: IDtoVerseAddressDict,
    column: string,
    bookName: string,
    allLinesValid: boolean
}

function getLinesFromFile(content: string, bookName: string, column: ColumnName): LineDict {
    let rawLines = content.split("\n");
    let lineDict: LineDict = {
        lines: {},
        ids: [],
        addresses: {},
        column: column,
        bookName: bookName,
        allLinesValid: true
    };

    for (let i=0; i < rawLines.length; i++) {
        let trimmedLine = rawLines[i].trim();
        let lineObject = processLine(trimmedLine, column, bookName);
        if (lineObject.isValid) {
            let id = lineObject.verseID;
            lineDict.ids.push(id);
            lineDict.addresses[id] = lineObject.address;
            lineDict.lines[lineObject.verseID] = lineObject.lineText;
        } else {
            console.log("Error in " + bookName + " " + column + " at line " + i + ": " + trimmedLine);
        }
    }
    return lineDict;
}

// Add types for the editions and columns
type EditionName = "First Edition" | "Second Edition" | "Mayhew" | "Zeroth Edition" | "KJV" | "Grebrew";
type ColumnName = "first_edition" | "second_edition" | "mayhew" | "zeroth_edition" | "kjv" | "grebrew";

// Update shorthand dictionary with type
const shorthandDict: Record<ColumnName, string> = {
    "first_edition": "α",
    "second_edition": "β",
    "mayhew": "M",
    "zeroth_edition": "א",
    "kjv": "E",
    "grebrew": "G"
};

function processFile(fileContent: string, edition: EditionName, book: string): LineDict | undefined {
    if (!validEditions.includes(edition)) {
        console.log("Invalid edition: " + edition);
        return;
    }
    
    const column = editionToColumnDict[edition];
    console.log(edition);
    console.log(column);
    
    // Proceed with getLinesFromFile if needed
    let lineDict = getLinesFromFile(fileContent, book, column);
    if (lineDict) {
        return lineDict;
    }
}

async function fetchFile(filename: string) {
    try {
        const response = await fetch('/process-file', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ filename })
        });
        const result = await response.json();
        
        // Return the content instead of just word count
        return result.content;
    } catch (error) {
        console.error('Error processing file:', error);
    }
}

type WordCountDict = {
    words: string[],
    counts: number[]
}

async function checkVerseWordsCounts(verseID: number): Promise<WordCountDict> {
    try {
        const response = await fetch('/verse_words?verseID=' + verseID);
        if (!response.ok) {
            console.error(`Server error ${response.status} checking verse ${verseID}`);
            return {
                words: [],
                counts: []
            };
        }
        const result = await response.json();
        
        // Make sure we have a valid result with the expected structure
        if (!result || !result[0] || !Array.isArray(result[0].words) || !Array.isArray(result[0].counts)) {
            console.error(`Invalid response format for verse ${verseID}`);
            return {
                words: [],
                counts: []
            };
        }

        return {
            words: result[0].words,
            counts: result[0].counts
        };
    } catch (error) {
        console.error(`Error checking verse ${verseID}:`, error);
        return {
            words: [],
            counts: []
        };
    }
}

type WordChangeObject = {
    id: string,
    removeWords: string[],
    addWords: string[],
    addWordCounts: stringToIntDict,
    countChanges: string[],
    changeWordCounts: stringToIntDict,
    changeStuff: boolean
}

function getWordChanges(oldVerseDict: WordCountDict, newVerseDict: stringToIntDict, id: string): WordChangeObject {
    let object: WordChangeObject = {
        id: id,
        removeWords: [],
        addWords: [],
        addWordCounts: {},
        countChanges: [],
        changeWordCounts: {},
        changeStuff: false
    }

    let oldVerseWords = oldVerseDict.words;
    let newVerseWords = Object.keys(newVerseDict);
    for (let i=0; i < oldVerseWords.length; i++) {
        let word = oldVerseWords[i];
        if (word in newVerseDict) {
            if (oldVerseDict.counts[i] != newVerseDict[word]) {
                object.countChanges.push(word);
                object.changeWordCounts[word] = newVerseDict[word];
                object.changeStuff = true;
            }
        } else {
            object.removeWords.push(word);
            object.changeStuff = true;
        }
    }

    for (let j=0; j < newVerseWords.length; j++) {
        let word = newVerseWords[j];
        if (!(word in oldVerseDict.words)) {
            object.addWords.push(word);
            object.addWordCounts[word] = newVerseDict[word];
            object.changeStuff = true;
        }
    }

    return object;
}


async function addVersesToDatabase(dict: LineDict) {
    let editionColumn = dict.column;
    let bookName = dict.bookName;

    //console.log(editionColumn);
    //console.log(bookName);
    
    //Adds verses to the database
    for (const verseID of dict.ids) {
        let chapter = dict.addresses[verseID].chapter;
        let verse = dict.addresses[verseID].verse;
        let text = dict.lines[verseID];
        try {
            const response = await fetch('/verses', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    verseID: parseInt(verseID),
                    text: text,
                    book: bookName,
                    chapter: chapter,
                    verse: verse,
                    edition: editionColumn
                })
            });
            
            const result = await response.json();
            if (result.status !== 'success') {
                console.error(`Error adding verse ${verseID}:`, result.error);
            } else {
                //console.log("Added verse " + chapter.toString() + ":" + verse.toString() + " to " + editionColumn);
            }
        } catch (error) {
            console.error(`Error adding verse ${verseID}:`, error);
        }
    }
}

async function updateVerseToWordsTable(object: WordChangeObject) {

    //We should simplify this. If the verse has been changed, at all, just overwrite it on the backend.
    if (object.removeWords.length > 0) {
        let removeWords = object.removeWords;
        let verseID = object.id;
        try {
            const response = await fetch('/remove_mass_word', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    verseID: verseID,
                    words: removeWords
                })
            });
            const result = await response.json();
            if (result.status !== 'success') {
                console.error(`Error removing words from verse ${verseID}:`, result.error);
            } else {
                console.log("Removed words from verse " + verseID);
            }
        } catch (error) {
            console.error(`Error removing words from verse ${verseID}:`, error);
        }
    }

    if (object.addWords.length > 0) {
        const { id, addWords, addWordCounts } = object;
        try {
            const response = await fetch('/add_mass_word', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    verseID: parseInt(id),
                    words: addWords,
                    counts: addWords.map(word => addWordCounts[word] || 1) // Get count for each word
                })
            });

            const result = await response.json();
            if (result.status !== 'success') {
                console.error(`Error adding words to verse ${id}:`, result.error);
            } else {
                console.log("Added words to verse " + id);
            }
        } catch (error) {
            console.error(`Error adding words to verse ${id}:`, error);
        }
    }

    if (object.countChanges.length > 0) {
        const { id, countChanges, changeWordCounts } = object;
        
        
    }

}

async function updateWordTable(dict: LineDict) {
    let massColumns: string[] = ['first_edition', 'second_edition', 'mayhew', 'zeroth_edition'];
    let editionColumn = dict.column;
    if (massColumns.includes(editionColumn.trim())) {
        console.log(editionColumn + " in database");
        for (const verseID of dict.ids) {
            let existingCountDict = await checkVerseWordsCounts(parseInt(verseID));
            let newID = reprocessID(verseID, editionColumn);
            let chapter = dict.addresses[verseID].chapter;
            let verse = dict.addresses[verseID].verse;
            let text = dict.lines[verseID];

            let splitText = text.split(" ");
            console.log(splitText);

            let cleanedDict = getVerseWordDict(splitText);
            console.log(cleanedDict);

            let changedWords = getWordChanges(existingCountDict, cleanedDict, newID);

            if (changedWords.changeStuff) {
                await updateVerseToWordsTable(changedWords);
            }

            //console.log(newID + ": "+ text);
        }
    }

}

//Probably doesn't really need to  be its own function, but w/e
async function processTextIntoDB(dict: LineDict) {
    await addVersesToDatabase(dict);
    await updateWordTable(dict);
}


//ugly ugly ugly
async function processSelectedFiles(bookDict: BookSectionDict) {
    let book = (<HTMLSelectElement>document.getElementById('bookDropdown')).value;
    let keyList = Object.keys(bookDict);
    for (let i=0; i < keyList.length; i++) {
        let section = keyList[i];
        let bookList = Object.keys(bookDict[section]);
        for (let j=0; j < bookList.length; j++) {
            let thisBook = bookList[j];
            if (thisBook == book) {
                let editionList = bookDict[section][thisBook];
                for (let k=0; k < editionList.length; k++) {
                    let edition = editionList[k];
                    let bookFileName = thisBook + "." + edition + ".txt";
                    const response = await fetch('/textfiles');
                    const files = await response.json();
                    for (let l=0; l < files.length; l++) {
                        let fileName = files[l];
                        if (fileName == bookFileName) {
                            let content = await fetchFile(fileName);
                            if (content) {
                                let lineDict = processFile(content, edition as EditionName, book);
                                if (lineDict && lineDict.allLinesValid) {
                                    //console.log(lineDict);
                                    await processTextIntoDB(lineDict);
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

function main() {
    let currentBook: string = "";

    // Wait for DOM to load
    document.addEventListener('DOMContentLoaded', async () => {
        let bookDict = await loadTextFiles();
        console.log(bookDict);
        const processButton = document.getElementById('processFiles');
        if (processButton && bookDict) {
            populateSectionDropdown(bookDict);
            processButton.addEventListener('click', () => processSelectedFiles(bookDict));
        }
    });
}

main();


/*
function isBookName(name: string): name is BookName {
    return name in bookToIDDict;
}


function chapterStringLengthManager(address: string) {
    if (address.length == 1) {
        return "00" + address;
    } else if (address.length == 2) {
        return "0" + address;
    } else {
        return address;
    }
}

function getVerseID(bookName: BookName, chapterNum: string, verseNum: string, edition: Edition, prefixWithShorthand: boolean = false): string {

    let leadingDigit = "1";
    if (prefixWithShorthand) {
        leadingDigit = editionToNumberDict[edition];
    }

    let id = leadingDigit + bookToIDDict[bookName] + chapterStringLengthManager(chapterNum) + chapterStringLengthManager(verseNum);

    return id;
}


function processWord(word: string) {
    

}

function colorSpan(text: string, color: string) {
    return `<span style="color: ${color}">${text}</span>`;
}

type LineObject = {
    verseID: string,
    address: VerseAddress,
    lineText: string,
    isValid: boolean
}


function processLine(line: string, bookName: BookName, edition: Edition): LineObject {

    let object: LineObject = {
        verseID: "",
        address: {
            chapter: 0,
            verse: 0
        },
        lineText: "",
        isValid: false
    }

    if (line.length == 0) {
        return object;
    }

    let splitLine = line.split(" ");
    let address = splitLine[0];
    let lineText = splitLine.slice(1).join(" ").trim();

    if (!address.includes(".")) {
        let shorthand = editionToShorthandDict[edition];
        console.log("Error in " + bookName + " " + shorthand + "." + address + "\n" + lineText);
        return object;
    }
    
    let splitAddress = address.split(".");
    let chapterNum = splitAddress[0];
    let verseNum = splitAddress[1];

    if (isNaN(parseInt(chapterNum)) || isNaN(parseInt(verseNum))) {
        let shorthand = editionToShorthandDict[edition];
        console.log("Error in " + bookName + " " + shorthand + "." + address + "\n" + lineText);
        return object;
    }

    object.lineText = lineText;
    object.verseID = getVerseID(bookName, chapterNum, verseNum, edition);
    object.address = {
        chapter: parseInt(chapterNum),
        verse: parseInt(verseNum)
    }
    object.isValid = true;

    return object;
}

type VerseAddress = {
    chapter: number,
    verse: number
}

type IDtoVerseAddressDict = {
    [key: string]: VerseAddress
}

type LineDict = {
    lines: StringToStringDict,
    ids: string[],
    addresses: IDtoVerseAddressDict,
    edition: Edition,
    bookName: BookName,
    allLinesValid: boolean
}

function getLinesFromFile(content: string, bookName: BookName, edition: Edition) {
    let rawLines = content.split("\n");
    let lineDict: LineDict = {
        lines: {},
        ids: [],
        addresses: {},
        edition: edition,
        bookName: bookName,
        allLinesValid: true
    };

    for (let i=0; i < rawLines.length; i++) {
        let trimmedLine = rawLines[i].trim();
        let lineObject = processLine(trimmedLine, bookName, edition);
        if (lineObject.isValid) {
            let id = lineObject.verseID;
            lineDict.ids.push(id);
            lineDict.addresses[id] = lineObject.address;
            lineDict.lines[lineObject.verseID] = lineObject.lineText;
        } else {
            console.log("Error in " + bookName + " " + edition + " at line " + i + ": " + trimmedLine);
        }
    }
    return lineDict;
}

async function addVerseToDatabase(dict: LineDict) {
    let editionToColumnDict: Record<Edition, string> = {
        "first": "first_edition",
        "second": "second_edition",
        "mayhew": "mayhew",
        "zeroth": "zeroth_edition",
        "kjv": "kjv",
        "grebrew": "grebrew"
    }

    let editionColumn = editionToColumnDict[dict.edition];
    let bookName = dict.bookName;
    for (const verseID of dict.ids) {
        let chapter = dict.addresses[verseID].chapter;
        let verse = dict.addresses[verseID].verse;
        let text = dict.lines[verseID];
        try {
            const response = await fetch('/verses', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    verseID: parseInt(verseID),
                    text: text,
                    book: bookName,
                    chapter: chapter,
                    verse: verse,
                    edition: editionColumn
                })
            });
            
            const result = await response.json();
            if (result.status !== 'success') {
                console.error(`Error adding verse ${verseID}:`, result.error);
            } else {
                console.log("Added verse " + chapter.toString() + ":" + verse.toString() + " to " + editionColumn);
            }
        } catch (error) {
            console.error(`Error adding verse ${verseID}:`, error);
        }
    }
}



async function processFile(filename: string) {
    try {
        const response = await fetch('/process-file', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ filename })
        });
        const result = await response.json();
        
        // Return the content instead of just word count
        return result.content;
    } catch (error) {
        console.error('Error processing file:', error);
    }
}

function getEdition(fileName: string): Edition {
    const endingToEditionDict: Record<string, Edition> = {
        "First Edition.txt": "first",
        "Second Edition.txt": "second",
        "Mayhew.txt": "mayhew",
        "Zeroth Edition.txt": "zeroth",
        "KJV.txt": "kjv",
        "Grebrew.txt": "grebrew"
    }

    let endingList = Object.keys(endingToEditionDict);

    for (let i=0; i < endingList.length; i++) {
        let ending = endingList[i];
        if (fileName.endsWith(ending)) {
            return endingToEditionDict[ending];
        }
    }
    throw new Error(`Unknown edition for file: ${fileName}`); // Better error handling
}

function getFileCheckbox(fileName: string): CheckboxObject {

    let edition = getEdition(fileName);
    let fileDiv: HTMLDivElement = document.createElement('div');
    let fileCheckbox: HTMLInputElement = document.createElement('input');
    fileCheckbox.type = 'checkbox';
    fileCheckbox.id = fileName;
    fileCheckbox.value = fileName;
    fileCheckbox.checked = true;
    fileDiv.appendChild(fileCheckbox);
    
    let fileLabel: HTMLLabelElement = document.createElement('label');
    fileLabel.htmlFor = fileName;
    fileLabel.innerText = fileName;
    fileDiv.appendChild(fileLabel);

    // Add a div to show content
    let contentDiv: HTMLDivElement = document.createElement('div');
    contentDiv.style.marginLeft = '20px';

    return {
        div: fileDiv,
        checkbox: fileCheckbox,
        edition: edition,
        contentDiv: contentDiv
    };
}

function getAvailableSections(files: string[]) {
    let availableSections: string[] = [];
    let allSections = Object.keys(sectionToBookDict);

    for (let i=0; i<files.length; i++) {
        let fileName = files[i].split(".")[0];
        for (let j=0; j<allSections.length; j++) {
            let section = allSections[j];
            if (sectionToBookDict[section].includes(fileName) && !availableSections.includes(section)) {
                availableSections.push(section);
            }
        }
    }
    return availableSections;
}

function dropdownPopulator(availableSections: string[], currentBook: string, div: HTMLDivElement) {
    div.innerHTML = "";
    let sectionDropdown = document.createElement('select');
    sectionDropdown.id = "sectionDropdown";
    for (let i=0; i<availableSections.length; i++) {
        let option = document.createElement('option');
        option.value = availableSections[i];
        option.text = availableSections[i];
        sectionDropdown.appendChild(option);
    }

    let bookDropdown = document.createElement('select');
    bookDropdown.id = "bookDropdown";

    sectionDropdown.addEventListener('change', async (event) => {
        let section = (<HTMLSelectElement>event.target).value;
        let books = sectionToBookDict[section];
        bookDropdown.innerHTML = "";
        for (let i=0; i<books.length; i++) {
            let option = document.createElement('option');
            option.value = books[i];
            option.text = books[i];
            if (i==0) {
                currentBook = books[i];
            }
            bookDropdown.appendChild(option);
        }
        // Refresh file display when section changes
        const response = await fetch('/textfiles');
        const files = await response.json();
        const filesDiv = document.getElementById('filesDiv');
        if (filesDiv) filesDiv.remove();
        displayFiles(files, currentBook);
    });

    bookDropdown.addEventListener('change', async (event) => {
        currentBook = (<HTMLSelectElement>event.target).value;
        // Refresh file display when book changes
        const response = await fetch('/textfiles');
        const files = await response.json();
        const filesDiv = document.getElementById('filesDiv');
        if (filesDiv) filesDiv.remove();
        displayFiles(files, currentBook);
    });

    div.appendChild(sectionDropdown);
    div.appendChild(bookDropdown);
}


function displayFiles(files: string[], currentBook: string) {
    const fileList = <HTMLDivElement>document.getElementById('fileList');
    if (!fileList) return {};

    let availableSections = getAvailableSections(files);
    dropdownPopulator(availableSections, currentBook, fileList);
    
    // Create checkboxes for files matching the current book
    const filesDiv = document.createElement('div');
    filesDiv.id = 'filesDiv';
    files.forEach(filename => {
        if (filename.startsWith(currentBook + ".")) {
            const checkboxObj = getFileCheckbox(filename);
            allFileObjects[filename] = checkboxObj;
            filesDiv.appendChild(checkboxObj.div);
            if (checkboxObj.contentDiv) {
                filesDiv.appendChild(checkboxObj.contentDiv);
            }
        }
    });
    fileList.appendChild(filesDiv);
}

async function loadTextFiles(currentBook: string) {
    try {
        const response = await fetch('/textfiles');
        const files = await response.json();
        displayFiles(files, currentBook);
    } catch (error) {
        console.error('Error loading text files:', error);
    }
}

async function processSelectedFiles(currentBook: string) {
    if (!currentBook) {
        console.error("No book selected");
        return;
    }

    let previewDiv = document.getElementById('preview');
    if (previewDiv) previewDiv.innerHTML = "";

    // Get all files for current book
    const response = await fetch('/textfiles');
    const files = await response.json();
    
    for (const filename of files) {
        if (filename.startsWith(currentBook + ".")) {
            let edition = getEdition(filename);
            let bookName = currentBook;
            
            if (!isBookName(bookName)) {
                console.log("Check book name in " + filename);
                continue;
            }

            const content = await processFile(filename);
            if (content) {
                let lineDict = getLinesFromFile(content, bookName, edition);
                if(lineDict.allLinesValid) {
                    await addVerseToDatabase(lineDict);
                }
            }
        }
    }
}

let allFileObjects: FileCheckboxDict = {};


async function main() {

    let currentBook: string = "";
    
    // Wait for DOM to load
    document.addEventListener('DOMContentLoaded', async () => {
        loadTextFiles(currentBook) || {};
        
        // Add process button handler
        const processButton = document.getElementById('processFiles');
        if (processButton) {
            processButton.addEventListener('click', () => processSelectedFiles(currentBook));
        }
    });
}

main();
*/