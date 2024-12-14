//import { stringToStringListDict } from './library';


function processWord(word: string) {
    word = word.toLowerCase();

}

function processLine(line: string, verseID: string) {
    let splitLine = line.split(" ");
    let verseAddress = splitLine[0];

}


async function loadTextFiles() {
    try {
        const response = await fetch('/textfiles');
        const files = await response.json();
        console.log('Called loadTextFiles()');
        for (const file of files) {
            processFile(file);
        }
        displayFiles(files);
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

function displayFiles(files: string[]) {
    const fileList = document.getElementById('fileList');
    if (!fileList) return;
    
    fileList.innerHTML = files.map(file => `
        <div>
            <input type="checkbox" id="${file}" value="${file}">
            <label for="${file}">${file}</label>
        </div>
    `).join('');
}

// Call this when page loads
//document.addEventListener('DOMContentLoaded', loadTextFiles);

console.log("is this thing on?");

function main() {
    console.log('main() called...');
    document.addEventListener('DOMContentLoaded', () => {
        loadTextFiles();
        
        const processButton = document.getElementById('processFiles');
        if (processButton) {
            console.log('button exists...');
            processButton.addEventListener('click', loadTextFiles);
        }
    });
}

main();