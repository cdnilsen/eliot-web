import {transliterateGeez} from './transcribe_geez.js';

let inputBox = document.getElementById('userInput') as HTMLInputElement;
let outputDiv = document.getElementById("output") as HTMLDivElement;

if (inputBox) {
    inputBox.addEventListener('input', function() {
        let target = inputBox.value;
        outputDiv.innerHTML = transliterateGeez(target);
    });
}

let fileInput = document.getElementById("uploadTextFile") as HTMLInputElement;
let submitButton = document.getElementById("submitBtn") as HTMLButtonElement;
let cancelButton = document.getElementById("cancel") as HTMLButtonElement;
fileInput.addEventListener('change', (event) => {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (file && file.type === 'text/plain') { // Check file type for safety
            submitButton.style.visibility = "visible";
            cancelButton.style.visibility = "visible";
            const reader = new FileReader();

            reader.onload = (e) => {
                const fileContent = e.target?.result as string;
                // Process the fileContent here
                console.log('File content:', fileContent);
                // Example: split into lines, parse data, etc.
                const lines = fileContent.split('\n');
                for (let i=0; i < lines.length; i ++) {
                    let line = lines[i];
                    let strippedLine = lines[i].trim();
                    console.log('"' + line + '"');
                    console.log('"' + strippedLine + '"')
                }
            };

            reader.readAsText(file); // Read the file as text
        } else {
            console.warn('Please select a valid text file.');
        }
    });