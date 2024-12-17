import { StringLiteral } from 'typescript';
import { stringToStringListDict, BookName, bookToIDDict, bookToChapterDict, sectionToBookDict } from './library.js';
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
                    populateBookDropdown(dict, thisSection);
                }
            }
        }
        sectionDropdown.addEventListener('change', (event) => {
            let section = (event.target as HTMLSelectElement).value as SectionKey;
            populateBookDropdown(dict, section);
        });
    }
}

function processSelectedFiles() {
    let book = (<HTMLSelectElement>document.getElementById('bookDropdown')).value;
    console.log(book);

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
           processButton.addEventListener('click', () => processSelectedFiles());
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