import {transliterateGeez} from './transcribe_geez.js';
import {Tracker} from './synapdeck_lib.js';
let outputDiv = document.getElementById("output") as HTMLDivElement;


/*
let inputBox = document.getElementById('userInput') as HTMLInputElement;
if (inputBox) {
    inputBox.addEventListener('input', function() {
        let target = inputBox.value;
        outputDiv.innerHTML = transliterateGeez(target);
    });
}
*/
let currentFileContent: string = "";
let currentDeck: string = "";
let deckDropdown = document.getElementById("dropdownMenu") as HTMLSelectElement;

if (deckDropdown) {
    deckDropdown.addEventListener('change', (event) => {
        const selectedValue = (event.target as HTMLSelectElement).value;
        currentDeck = selectedValue;
        // Optionally update outputDiv or perform other actions based on selection
        console.log(`Deck changed to: ${currentDeck}`);
    });
}

let fileInput = document.getElementById("uploadTextFile") as HTMLInputElement;
let submitButton = document.getElementById("submitBtn") as HTMLButtonElement;
let cancelButton = document.getElementById("cancel") as HTMLButtonElement;
fileInput.addEventListener('change', (event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file && file.type === 'text/plain') { // Check file type for safety
        const reader = new FileReader();
        reader.onload = (e) => {
            submitButton.style.visibility = "visible";
            cancelButton.style.visibility = "visible";
            const fileContent = e.target?.result as string;
            // Process the fileContent here
            currentFileContent = fileContent;
        };
        reader.readAsText(file); // Read the file as text
    } else {
        console.warn('Please select a valid text file.');
    }
});

submitButton.addEventListener('click', () => {
    // Example: perform submit action, e.g., process uploaded file or user input
    //console.log('Submit button clicked');
    // Hide buttons after submit

    let currentNoteType = "";
    let currentProcessing = "";
    const lines = currentFileContent.split('\n');
        for (let i=0; i < lines.length; i ++) {
            let line = lines[i].trim();
            if (line.startsWith("$FORMAT:")) {
                line = line.replaceAll("$FORMAT:", "").trim();
                currentNoteType = line
                console.log('\"' + currentNoteType + '\"')
            } else if (line.startsWith("$PROCESSING:")) {
                line = line.replaceAll("$PROCESSING:", "").trim();
                currentProcessing = line
                console.log('\"' + currentProcessing + '\"')
            } else if (line.length > 0) {
                console.log(line);
            }
        }
    submitButton.style.visibility = "hidden";
    cancelButton.style.visibility = "hidden";
    // You can add further processing logic here
});