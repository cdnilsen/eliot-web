//import { stringToStringListDict } from './library';


type CheckboxObject = {
    div: HTMLDivElement,
    checkbox: HTMLInputElement,
    edition: string,
    contentDiv?: HTMLDivElement
}

type FileCheckboxDict = {
    [key: string]: CheckboxObject
}

let editionToShorthandDict = {
    "first": "α",
    "second": "β",
    "mayew": "M",
    "zeroth": "א",
    "kjv": "E",
    "grebrew": "G"
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

function getEdition(fileName: string): string {
    let edition = "error";

    let endingToEditionDict = {
        "First Edition.txt": "first",
        "Second Edition.txt": "second",
        "Mayew.txt": "mayew",
        "Zeroth Edition.txt": "zeroth",
        "KJV.txt": "kjv",
        "Grebrew.txt": "grebrew"
    }

    let endingList = Object.keys(endingToEditionDict);

    for (let i=0; i<endingList.length; i++) {
        let ending = endingList[i];
        if (fileName.endsWith(ending)) {
            edition = endingToEditionDict[ending];
            return edition;
        }
    }
    return edition; // it shouldn't ever do this
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
            const content = await processFile(filename);
            if (content) {
                const firstLine = content.split('\n')[0];
                obj.contentDiv.textContent = processLine(firstLine, filename, shorthand);
                previewDiv!.appendChild(obj.contentDiv);
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