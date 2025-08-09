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

// Interface for card data returned from backend
interface CardDue {
    card_id: number;
    note_id: number;
    deck: string;
    card_format: string;
    field_names: string[];
    field_values: string[];
    field_processing: string[];
    time_due: string;
    interval: number;
    retrievability: number;
    peers: number[];
}

interface CheckCardsResponse {
    status: 'success' | 'error';
    cards?: CardDue[];
    total_due?: number;
    deck?: string;
    error?: string;
    details?: string;
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
let uploadDeckDropdown = document.getElementById("upload_dropdownMenu") as HTMLSelectElement;

if (uploadDeckDropdown) {
    uploadDeckDropdown.addEventListener('change', (event) => {
        const selectedValue = (event.target as HTMLSelectElement).value;
        currentDeck = selectedValue;
    });
}

let fileInput = document.getElementById("uploadTextFile") as HTMLInputElement;
let uploadSubmitButton = document.getElementById("upload_submitBtn") as HTMLButtonElement;
let uploadCancelButton = document.getElementById("upload_cancel") as HTMLButtonElement;
fileInput.addEventListener('change', (event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file && file.type === 'text/plain') { // Check file type for safety
        const reader = new FileReader();
        reader.onload = (e) => {
            uploadSubmitButton.style.visibility = "visible";
            uploadCancelButton.style.visibility = "visible";
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
uploadSubmitButton.addEventListener('click', async () => {
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


async function checkAvailableCardsWithOptions(deckName: string): Promise<CheckCardsResponse> {
    const reviewAheadCheckbox = document.getElementById('reviewAheadCheckbox') as HTMLInputElement;
    const reviewAheadHours = document.getElementById('reviewAheadHours') as HTMLSelectElement;
    
    let checkTime: Date;
    
    if (reviewAheadCheckbox && reviewAheadCheckbox.checked) {
        // Review ahead - check cards due within the selected timeframe
        const hoursAhead = parseInt(reviewAheadHours?.value || '24');
        checkTime = new Date();
        checkTime.setHours(checkTime.getHours() + hoursAhead);
        console.log(`📚 Checking cards due within ${hoursAhead} hours`);
    } else {
        // Normal mode - only cards due now
        checkTime = new Date();
        console.log('📚 Checking cards due now');
    }
    
    try {
        const response = await fetch('/check_cards_available', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                deck: deckName,
                current_time: checkTime.toISOString(),
                review_ahead: reviewAheadCheckbox?.checked || false,
                hours_ahead: reviewAheadCheckbox?.checked ? parseInt(reviewAheadHours?.value || '24') : 0
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result: CheckCardsResponse = await response.json();
        console.log('Available cards response:', result);
        
        return result;
    } catch (error) {
        console.error('Error checking available cards:', error);
        return { 
            status: 'error', 
            error: 'Network error checking available cards' 
        };
    }
}

// Function to toggle the review ahead options visibility
function setupReviewAheadUI(): void {
    const reviewAheadCheckbox = document.getElementById('reviewAheadCheckbox') as HTMLInputElement;
    const reviewAheadOptions = document.getElementById('reviewAheadOptions') as HTMLDivElement;
    
    if (reviewAheadCheckbox && reviewAheadOptions) {
        reviewAheadCheckbox.addEventListener('change', function() {
            if (this.checked) {
                reviewAheadOptions.style.display = 'block';
            } else {
                reviewAheadOptions.style.display = 'none';
            }
        });
    }
}

// Enhanced display function that shows review ahead info
function displayAvailableCardsWithStatus(cards: CardDue[], reviewAhead: boolean = false, hoursAhead: number = 0): void {
    const outputDiv = document.getElementById("check_output") as HTMLDivElement;
    if (!outputDiv) return;

    if (cards.length === 0) {
        const message = reviewAhead 
            ? `No cards are due within the next ${hoursAhead} hours.`
            : 'No cards are currently due for review.';
        outputDiv.innerHTML = `<p>${message}</p>`;
        return;
    }

    const now = new Date();
    const dueNow = cards.filter(card => new Date(card.time_due) <= now);
    const dueAhead = cards.filter(card => new Date(card.time_due) > now);
    
    let html = `<h3>Cards for Review (${cards.length})</h3>`;
    
    if (reviewAhead && hoursAhead > 0) {
        html += `<p class="review-ahead-info">📚 Showing cards due within ${hoursAhead} hours</p>`;
        if (dueNow.length > 0) {
            html += `<p>🔴 ${dueNow.length} cards due now | ⏰ ${dueAhead.length} cards due ahead</p>`;
        }
    }
    
    html += '<div class="cards-list">';
    
    cards.forEach((card, index) => {
        const dueDate = new Date(card.time_due);
        const isOverdue = dueDate < now;
        const isDueSoon = dueDate <= new Date(now.getTime() + 2 * 60 * 60 * 1000); // due within 2 hours
        
        let statusClass = 'due-ahead';
        let statusText = 'Due ahead';
        
        if (isOverdue) {
            statusClass = 'overdue';
            statusText = 'Overdue';
        } else if (isDueSoon) {
            statusClass = 'due-soon';
            statusText = 'Due soon';
        }
        
        html += `
            <div class="card-item ${statusClass}" data-card-id="${card.card_id}">
                <div class="card-header">
                    <span class="card-id">Card #${card.card_id}</span>
                    <span class="card-format">${card.card_format || 'Standard'}</span>
                    <span class="due-time" title="${dueDate.toLocaleString()}">
                        ${statusText}: ${dueDate.toLocaleDateString()} ${dueDate.toLocaleTimeString()}
                    </span>
                </div>
                <div class="card-content">
                    ${card.field_values.map((value, i) => 
                        `<div class="field"><strong>${card.field_names[i] || `Field ${i+1}`}:</strong> ${value}</div>`
                    ).join('')}
                </div>
                <div class="card-stats">
                    <span>Interval: ${card.interval} days</span>
                    <span>Retrievability: ${(card.retrievability * 100).toFixed(1)}%</span>
                    ${!isOverdue ? `<span class="time-until">Due in: ${getTimeUntilDue(dueDate)}</span>` : ''}
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    outputDiv.innerHTML = html;
}

// Helper function to format time until due
function getTimeUntilDue(dueDate: Date): string {
    const now = new Date();
    const diffMs = dueDate.getTime() - now.getTime();
    
    if (diffMs <= 0) return 'Now';
    
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (diffHours > 24) {
        const diffDays = Math.floor(diffHours / 24);
        return `${diffDays}d ${diffHours % 24}h`;
    } else if (diffHours > 0) {
        return `${diffHours}h ${diffMinutes}m`;
    } else {
        return `${diffMinutes}m`;
    }
}

// Updated main function that uses the new options
async function checkAndDisplayCards(deckName: string): Promise<void> {
    const result = await checkAvailableCardsWithOptions(deckName);
    
    if (result.status === 'success' && result.cards) {
        const reviewAheadCheckbox = document.getElementById('reviewAheadCheckbox') as HTMLInputElement;
        const reviewAheadHours = document.getElementById('reviewAheadHours') as HTMLSelectElement;
        
        const isReviewAhead = reviewAheadCheckbox?.checked || false;
        const hoursAhead = isReviewAhead ? parseInt(reviewAheadHours?.value || '24') : 0;
        
        displayAvailableCardsWithStatus(result.cards, isReviewAhead, hoursAhead);
    } else {
        const outputDiv = document.getElementById("check_output") as HTMLDivElement;
        if (outputDiv) {
            outputDiv.innerHTML = `<p class="error">Error: ${result.error}</p>`;
        }
    }
}

async function checkAvailableCards(deckName: string): Promise<CheckCardsResponse> {
    try {
        const response = await fetch('/check_cards_available', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                deck: deckName,
                current_time: new Date().toISOString() // Send current time for due date comparison
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result: CheckCardsResponse = await response.json();
        console.log('Available cards response:', result);
        
        return result;
    } catch (error) {
        console.error('Error checking available cards:', error);
        return { 
            status: 'error', 
            error: 'Network error checking available cards' 
        };
    }
}
let reviewDeckDropdown = document.getElementById("review_dropdownMenu") as HTMLSelectElement;
let selectedReviewDeck: string = "";

if (reviewDeckDropdown) {
    reviewDeckDropdown.addEventListener('change', async (event) => {
        const selectedValue = (event.target as HTMLSelectElement).value;
        selectedReviewDeck = selectedValue;
        
        if (selectedReviewDeck) {
            console.log(`Checking cards for deck: ${selectedReviewDeck}`);
            // Use the enhanced function that handles review ahead options
            await checkAndDisplayCards(selectedReviewDeck);
        }
    });
}