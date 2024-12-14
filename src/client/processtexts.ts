import { StringLiteral } from 'typescript';
import { stringToStringListDict, BookName, bookToIDDict, bookToChapterDict } from './library.js';


type StringToStringDict = {
    [key: string]: string
}

type Edition = "first" | "second" | "mayew" | "zeroth" | "kjv" | "grebrew";

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
    "mayew": "M",
    "zeroth": "א",
    "kjv": "E",
    "grebrew": "G"
}

let editionToNumberDict: Record<Edition, string> = {
    "first": "2",
    "second": "3",
    "mayew": "4",
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

function getVerseID(bookName: BookName, verseAddress: string, edition: Edition, prefixWithShorthand: boolean = false): string {

    if (!verseAddress.includes(".")) {
        let editionShorthand = editionToShorthandDict[edition];
        console.log("Check verse address format in " + bookName + " " + editionShorthand + "." + verseAddress);	
    }

    let splitAddress = verseAddress.split(".");
    let chapterNum = splitAddress[0];
    let verseNum = splitAddress[1];

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

type lineObject = {
    verseAddress: string,
    lineText: string
}

function isProperAddress(address: string) {
    if (!address.includes(".")) {
        return false;
    }

    let splitAddress = address.split(".");
    let chapter = splitAddress[0];
    let verse = splitAddress[1];

    if (isNaN(parseInt(chapter)) || isNaN(parseInt(verse))) {
        return false;
    }

    return true;
}

function processLine(line: string, bookName: BookName, shorthand: string): lineObject {
    let splitLine = line.split(" ");
    let verseAddress = splitLine[0];
    let lineText = splitLine.slice(1).join(" ").trim();

    if (!isProperAddress(verseAddress)) {
        console.log("Error in " + bookName + " " + shorthand + "." + verseAddress + "\n" + lineText);
    }

    let object = {
        verseAddress: verseAddress,
        lineText: lineText
    }

    return object;

}

type LineDict = {
    lines: StringToStringDict,
    addresses: string[]
}

function getLinesFromFile(content: string, bookName: BookName, shorthand: string) {
    let rawLines = content.split("\n");
    let lineDict: LineDict = {
        lines: {},
        addresses: []
    };

    for (let i=0; i < rawLines.length; i++) {
        let trimmedLine = rawLines[i].trim();
        if (trimmedLine.length > 0) {
            let lineObject = processLine(trimmedLine, bookName, shorthand);
            lineDict.addresses.push(lineObject.verseAddress);
            lineDict.lines[lineObject.verseAddress] = lineObject.lineText;
        }
    }
    return lineDict;
}


function getLineList(dict: LineDict): string[] {
    let list: string[] = [];
    let addresses = dict.addresses;
    for (let i=0; i < addresses.length; i++) {
        let address = addresses[i];
        let line = dict.lines[address];
        list.push(line);
    }
    return list;
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
        "Mayew.txt": "mayew",
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
            let shorthand = editionToShorthandDict[obj.edition];

            let bookName = filename.split(".")[0];
            if (!isBookName(bookName)) {
                console.log("Check book name in " + filename);
                continue;
            }
            const content = await processFile(filename);
            if (content) {
                let lineDict = getLinesFromFile(content, bookName, shorthand);
                for (let i=0; i < lineDict.addresses.length; i++) {
                    let address = lineDict.addresses[i];
                    let line = lineDict.lines[address];
                    obj.contentDiv.innerHTML += address + ": " + line;
                    obj.contentDiv.innerHTML += "<br>";

                    previewDiv!.appendChild(obj.contentDiv);
                }
                /*
                const firstLine = content.split('\n')[0];
                obj.contentDiv.innerHTML = processLine(firstLine, filename, shorthand);
                previewDiv!.appendChild(obj.contentDiv);
                */
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