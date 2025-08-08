import {transliterateGeez} from './transcribe_geez.js';
import {OneWayCard, TwoWayCard} from './synapdeck_lib.js'
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

document.addEventListener('DOMContentLoaded', function() {
    const buttons = document.querySelectorAll('.button-row button');
    const tabContents = document.querySelectorAll('.tab-content');
    
    buttons.forEach(button => {
        button.addEventListener('click', function() {
            // Remove active class from all buttons
            buttons.forEach(btn => btn.classList.remove('active'));
            
            // Hide all tab contents
            tabContents.forEach(content => content.classList.remove('active'));
            
            // Add active class to clicked button
            this.classList.add('active');
            
            // Show corresponding content
            const targetId = this.id.replace('_cards', '_mainDiv').replace('check_work', 'check_mainDiv');
            const targetDiv = document.getElementById(targetId);
            if (targetDiv) {
                targetDiv.classList.add('active');
            }
        });
    });
});


let currentFileContent: string = "";
let currentDeck: string = "";
let deckDropdown = document.getElementById("dropdownMenu") as HTMLSelectElement;

if (deckDropdown) {
    deckDropdown.addEventListener('change', (event) => {
        const selectedValue = (event.target as HTMLSelectElement).value;
        currentDeck = selectedValue;
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

// This will probably be later on...
function cleanFieldDatum(datum: string, process: string) {
    switch (process) {
        case "Ge'ez":
            return transliterateGeez(datum);
        default:
            return datum;
    }
}

// The program creates a 'pretracker' which gets handed off to the backend.
async function sendNoteToBackend(deck: string, note_type: string, field_values: string[], field_processing: string[]) {
    // Generate card configurations based on note type
    let card_configs: any[] = [];
    
    if (note_type === "Two-Way") {
        card_configs = TwoWayCard(deck, field_values, field_processing);
    } else if (note_type === "One-Way") {
        card_configs = OneWayCard(deck, field_values, field_processing);
    }
    
    const field_names = field_processing.map((_, index) => `field_${index + 1}`);
    
    const payload = {
        deck: deck,
        note_type: note_type,
        field_names: field_names,
        field_values: field_values,
        field_processing: field_processing,
        card_configs: card_configs
    };
    
    console.log('Sending payload:', JSON.stringify(payload, null, 2));
    
    try {
        const response = await fetch('/add_synapdeck_note', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });
        
        const result = await response.json();
        console.log('Server response:', result);
        
        if (result.status === 'success') {
            console.log(`Note ${result.note_id} with ${result.card_ids.length} cards created successfully`);
        } else {
            console.error('Error sending note:', result.error);
        }
        
        return result;
    } catch (error) {
        console.error('Network error sending note:', error);
        return { status: 'error', error: 'Network error' };
    }
}

submitButton.addEventListener('click', () => {
    // Example: perform submit action, e.g., process uploaded file or user input
    //console.log('Submit button clicked');
    // Hide buttons after submit

    let currentNoteType = "";
    let currentProcessList: string[] = [];
    const lines = currentFileContent.split('\n');
        for (let i=0; i < lines.length; i ++) {
            let line = lines[i].trim();
            if (line.startsWith("$FORMAT:")) {
                line = line.replaceAll("$FORMAT:", "").trim();
                currentNoteType = line;
                console.log('\"' + currentNoteType + '\"')
            } else if (line.startsWith("$PROCESSING:")) {
                currentProcessList = [];
                line = line.replaceAll("$PROCESSING:", "").trim();
                let thisProcessList = line.split("/");
                for (let i=0; i < thisProcessList.length; i++) {
                    let thisProcess = thisProcessList[i].trim();
                    currentProcessList.push(thisProcess.trim())
                }
            } else if (line.length > 0 && line.includes(" / ")) {
                line = line.replaceAll(" / ", " // ") //Necessary to deal with HTML tags in the fields
                let thisNoteFieldData = line.split("//");
                let thisNoteDataList: string[] = [];
                let thisNoteProcessList: string[] = currentProcessList;
                for (let i=0; i < thisNoteFieldData.length; i++) {
                    let thisDatum = thisNoteFieldData[i].trim();
                    thisNoteDataList.push(thisDatum);
                }
                if (thisNoteProcessList.length != thisNoteDataList.length) {
                    const maxLength = Math.max(thisNoteProcessList.length, thisNoteDataList.length);
                    while (thisNoteProcessList.length < maxLength) {
                        thisNoteProcessList.push("");
                    }
                    while (thisNoteDataList.length < maxLength) {
                        thisNoteDataList.push("");
                    }
                }
                sendNoteToBackend(currentDeck, currentNoteType, thisNoteDataList, currentProcessList);
            }
        }
    submitButton.style.visibility = "hidden";
    cancelButton.style.visibility = "hidden";
    // You can add further processing logic here
});