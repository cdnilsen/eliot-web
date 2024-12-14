//import { stringToStringListDict } from './library';

type CheckboxObject = {
    div: HTMLDivElement,
    checkbox: HTMLInputElement,
    contentDiv?: HTMLDivElement
}

type FileCheckboxDict = {
    [key: string]: CheckboxObject
}


function processWord(word: string) {
    

}

function processLine(line: string, verseID: string) {
    let splitLine = line.split(" ");
    let verseAddress = splitLine[0];
    let lineText = splitLine.slice(1).join(" ");

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

function getFileCheckbox(fileName: string): CheckboxObject {
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
        contentDiv: contentDiv
    };
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

async function loadTextFiles() {
    try {
        const response = await fetch('/textfiles');
        const files = await response.json();
        let allFileObjects: FileCheckboxDict = displayFiles(files);
        console.log("Files loaded: ", files);
        return allFileObjects;
    } catch (error) {
        console.error('Error loading text files:', error);
    }
}

async function processSelectedFiles(allFileObjects: FileCheckboxDict) {
    let previewDiv = document.getElementById('preview');

    for (const [filename, obj] of Object.entries(allFileObjects)) {
        if (obj.checkbox.checked && obj.contentDiv) {
            console.log(`Processing ${filename}...`);
            const content = await processFile(filename);
            if (content) {
                const firstLine = content.split('\n')[0];
                obj.contentDiv.textContent = processLine(firstLine, filename);
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