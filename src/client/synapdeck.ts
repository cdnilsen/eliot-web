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
fileInput.addEventListener('change', (event) => {
        const file = (event.target as HTMLInputElement).files?.[0];

        if (file && file.type === 'text/plain') { // Check file type for safety
            const reader = new FileReader();

            reader.onload = (e) => {
                const fileContent = e.target?.result as string;
                // Process the fileContent here
                console.log('File content:', fileContent);
                // Example: split into lines, parse data, etc.
                const lines = fileContent.split('\n');
                console.log('Lines:', lines);
            };

            reader.readAsText(file); // Read the file as text
        } else {
            console.warn('Please select a valid text file.');
        }
    });