//import { stringToStringListDict } from './library';

type CheckboxObject = {
    div: HTMLDivElement,
    checkbox: HTMLInputElement
}

type FileCheckboxDict = {
    [key: string]: CheckboxObject
}




function processWord(word: string) {
    

}

function processLine(line: string, verseID: string) {
    let splitLine = line.split(" ");
    let verseAddress = splitLine[0];

}


async function loadTextFiles() {
    try {
        const response = await fetch('/textfiles');
        const files = await response.json();
        let allFileObjects: FileCheckboxDict = displayFiles(files);
        console.log(files);
    } catch (error) {
        console.error('Error loading text files:', error);
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
        

        console.log(`Processed ${filename}`);
        console.log(`Processed ${result.wordsProcessed} words`);
    } catch (error) {
        console.error('Error processing file:', error);
    }
}

function getFileCheckbox(fileName: string) {
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

    let object: CheckboxObject = {
        div: fileDiv,
        checkbox: fileCheckbox
    }

    return object;
}

function displayFiles(files: string[]): FileCheckboxDict {
    const fileList = <HTMLDivElement>document.getElementById('fileList');
    if (!fileList) return {};
    

    let allObjects: FileCheckboxDict = {};
    for (let i=0; i<files.length; i++) {
        console.log(typeof files[i]);
        let fileObject = getFileCheckbox(files[i]);
        fileList.appendChild(fileObject.div);
        allObjects[files[i]] = fileObject;
    }
    return allObjects;
}

function main() {
    // Called successfully.
    document.addEventListener('DOMContentLoaded', () => {
        loadTextFiles();
        
        const processButton = document.getElementById('processFiles');
        if (processButton) {
            processButton.addEventListener('click', loadTextFiles);
        }
    });
}

main();