import {transliterateGeez} from './transcribe_geez.js';
import {OneWayCard, TwoWayCard} from './synapdeck_lib.js'
let outputDiv = document.getElementById("upload_output") as HTMLDivElement;

/*
let inputBox = document.getElementById('userInput') as HTMLInputElement;
if (inputBox) {
    inputBox.addEventListener('input', function() {
        let target = inputBox.value;
        outputDiv.innerHTML = transliterateGeez(target);
    });
}
*/

// Add type definitions at the top of your file
interface NoteToProcess {
    deck: string;
    noteType: string;
    dataList: string[];
    processList: string[];
}

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
let deckDropdown = document.getElementById("upload_dropdownMenu") as HTMLSelectElement;

if (deckDropdown) {
    deckDropdown.addEventListener('change', (event) => {
        const selectedValue = (event.target as HTMLSelectElement).value;
        currentDeck = selectedValue;
    });
}

let fileInput = document.getElementById("uploadTextFile") as HTMLInputElement;
let submitButton = document.getElementById("upload_submitBtn") as HTMLButtonElement;
let cancelButton = document.getElementById("upload_cancel") as HTMLButtonElement;
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

// Add this new function to wipe the database before processing
async function wipeSynapdeckDatabase() {
    try {
        const response = await fetch('/wipe_synapdeck_database', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        const result = await response.json();
        console.log('Database wipe response:', result);
        return result.status === 'success';
    } catch (error) {
        console.error('Error wiping database:', error);
        return false;
    }
}

// Add delay function to avoid overwhelming the database
function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
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


// Modified submit button event listener
submitButton.addEventListener('click', async () => {
    console.log('Submit button clicked');
    
    // First, wipe the database
    console.log('Wiping database before processing...');
    const wipeSuccess = await wipeSynapdeckDatabase();
    if (!wipeSuccess) {
        console.error('Failed to wipe database, aborting');
        return;
    }
    
    let currentNoteType = "";
    let currentProcessList: string[] = [];
    const lines = currentFileContent.split('\n');
    
    // Collect all notes first
    const notesToProcess: NoteToProcess[] = [];
    
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        if (line.startsWith("$FORMAT:")) {
            line = line.replaceAll("$FORMAT:", "").trim();
            currentNoteType = line;
            console.log('Note type: "' + currentNoteType + '"');
        } else if (line.startsWith("$PROCESSING:")) {
            currentProcessList = [];
            line = line.replaceAll("$PROCESSING:", "").trim();
            let thisProcessList = line.split("/");
            for (let j = 0; j < thisProcessList.length; j++) {
                let thisProcess = thisProcessList[j].trim();
                currentProcessList.push(thisProcess.trim());
            }
        } else if (line.length > 0 && line.includes(" / ")) {
            line = line.replaceAll(" / ", " // "); // Necessary to deal with HTML tags in the fields
            let thisNoteFieldData = line.split("//");
            let thisNoteDataList: string[] = [];
            let thisNoteProcessList = [...currentProcessList]; // Create a copy
            
            for (let j = 0; j < thisNoteFieldData.length; j++) {
                let thisDatum = thisNoteFieldData[j].trim();
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
            
            // Add to collection instead of sending immediately
            notesToProcess.push({
                deck: currentDeck,
                noteType: currentNoteType,
                dataList: thisNoteDataList,
                processList: thisNoteProcessList
            });
        }
    }
    
    // Now process notes sequentially with delays to avoid deadlocks
    console.log(`Processing ${notesToProcess.length} notes sequentially...`);
    
    for (let i = 0; i < notesToProcess.length; i++) {
        const note = notesToProcess[i];
        console.log(`Processing note ${i + 1}/${notesToProcess.length}`);
        
        try {
            const result = await sendNoteToBackend(
                note.deck, 
                note.noteType, 
                note.dataList, 
                note.processList
            );
            
            if (result.status === 'success') {
                console.log(`✓ Note ${i + 1} processed successfully`);
            } else {
                console.error(`✗ Note ${i + 1} failed:`, result.error);
            }
            
            // Add a small delay between requests to avoid overwhelming the database
            if (i < notesToProcess.length - 1) {
                await delay(100); // 100ms delay between requests
            }
            
        } catch (error) {
            console.error(`✗ Note ${i + 1} error:`, error);
        }
    }
    
    console.log('All notes processed!');
});