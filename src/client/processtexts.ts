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

function getLinesFromFile(content: string) {
    let lines = content.split("\n");
    for (let i=0; i < lines.length; i++) {
        lines[i] = lines[i].trim();
    }
    return lines;
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

function processLine(line: string, verseID: string, shorthand: string) {
    let splitLine = line.split(" ");
    let verseAddress = splitLine[0];
    let lineText = splitLine.slice(1).join(" ");

    lineText = colorSpan(shorthand, "#FF0000") + " " + lineText.replaceAll("8", "ꝏ̄");

    return lineText;

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
                let lines = getLinesFromFile(content);
                for (let i=0; i < lines.length; i++) {
                    obj.contentDiv.innerHTML += processLine(lines[i], filename, shorthand);
                    obj.contentDiv.innerHTML += "<br>";
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