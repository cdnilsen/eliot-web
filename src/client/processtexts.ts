import { StringLiteral } from 'typescript';
import { stringToStringListDict, BookName, bookToIDDict, bookToChapterDict } from './library.js';
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
    verseAddress: string,
    lineText: string,
    isValid: boolean
}


function processLine(line: string, bookName: BookName, edition: Edition): LineObject {

    let object: LineObject = {
        verseAddress: "",
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
    object.verseAddress = getVerseID(bookName, chapterNum, verseNum, edition);
    object.isValid = true;

    return object;
}

type LineDict = {
    lines: StringToStringDict,
    addresses: string[],
    edition: Edition,
    bookName: BookName,
    allLinesValid: boolean
}

function getLinesFromFile(content: string, bookName: BookName, edition: Edition) {
    let rawLines = content.split("\n");
    let lineDict: LineDict = {
        lines: {},
        addresses: [],
        edition: edition,
        bookName: bookName,
        allLinesValid: true
    };

    for (let i=0; i < rawLines.length; i++) {
        let trimmedLine = rawLines[i].trim();
        let lineObject = processLine(trimmedLine, bookName, edition);
        if (lineObject.isValid) {
            lineDict.addresses.push(lineObject.verseAddress);
            lineDict.lines[lineObject.verseAddress] = lineObject.lineText;
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
    for (const verseID of dict.addresses) {
        try {
            const response = await fetch('/verses', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    verseID: parseInt(verseID),
                    text: dict.lines[verseID],
                    book: bookName,
                    edition: editionColumn
                })
            });
            
            const result = await response.json();
            if (result.status !== 'success') {
                console.error(`Error adding verse ${verseID}:`, result.error);
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

function displayFiles(files: string[]): FileCheckboxDict {
    const fileList = <HTMLDivElement>document.getElementById('fileList');
    if (!fileList) return {};
    

    let allObjects: FileCheckboxDict = {};
    for (let i=0; i<files.length; i++) {
        let fileObject = getFileCheckbox(files[i]);
        fileList.appendChild(fileObject.div);
        allObjects[files[i]] = fileObject;
    }
    return allObjects;
}

async function loadTextFiles() {
    try {
        const response = await fetch('/textfiles');
        const files = await response.json();
        let allFileObjects: FileCheckboxDict = displayFiles(files);
        return allFileObjects;
    } catch (error) {
        console.error('Error loading text files:', error);
    }
}

async function processSelectedFiles(allFileObjects: FileCheckboxDict) {
    let previewDiv = document.getElementById('preview');
    previewDiv!.innerHTML = "";

    for (const [filename, obj] of Object.entries(allFileObjects)) {
        if (obj.checkbox.checked && obj.contentDiv) {
            let edition = obj.edition;

            let bookName = filename.split(".")[0];
            if (!isBookName(bookName)) {
                console.log("Check book name in " + filename);
                continue;
            }
            const content = await processFile(filename);
            if (content) {
                let lineDict = getLinesFromFile(content, bookName, edition);
                if(lineDict.allLinesValid) {
                    addVerseToDatabase(lineDict);
                }
            }
        }
    }
}

async function main() {
    let allFileObjects: FileCheckboxDict = {};
    
    // Wait for DOM to load
    document.addEventListener('DOMContentLoaded', async () => {
        allFileObjects = await loadTextFiles() || {};
        
        // Add process button handler
        const processButton = document.getElementById('processFiles');
        if (processButton) {
            processButton.addEventListener('click', () => processSelectedFiles(allFileObjects));
        }
    });
}

main();