import {transliterateGeez, GeezDiacriticify, geezSpecialChars} from './transcribe_geez.js';
import {transliterateGreek} from './transcribe_ancient_greek.js';
import {SanskritDiacriticify} from './transcribe_sanskrit.js';
import {AkkadianDiacriticify, akkadianSpecialChars} from './transcribe_akkadian.js';
import {OneWayCard, TwoWayCard, arrayBufferToBase64, prepareTextForPDF, testCharacterRendering, loadGentiumForCanvas, renderTextToCanvas} from './synapdeck_lib.js'
let outputDiv = document.getElementById("upload_output") as HTMLDivElement;
declare global {
    interface Window {
        jsPDF: any;
    }
}


// First, add this interface near your other type definitions
interface SpecialCharacterSet {
    [key: string]: string[];
}


// Add this after your imports (you'll need to make sure these are exported from their respective modules)
const specialCharacterSets: SpecialCharacterSet = {
    "Ge'ez": geezSpecialChars || [],
    "Akkadian": akkadianSpecialChars || [],
    // Add more as needed
    // "Sanskrit": sanskritSpecialChars || [], // if you have this
};



// Add this function to create the special characters panel
function createSpecialCharactersPanel(): void {
    const textInputSection = document.getElementById("textInputSection");
    if (!textInputSection) return;

    // Check if panel already exists
    let existingPanel = document.getElementById("specialCharsPanel");
    if (existingPanel) {
        existingPanel.remove();
    }

    // Create the panel container
    const panel = document.createElement("div");
    panel.id = "specialCharsPanel";
    panel.className = "special-chars-panel";
    
    const panelTitle = document.createElement("h4");
    panelTitle.textContent = "Special Characters";
    panelTitle.className = "special-chars-title";
    
    const charGrid = document.createElement("div");
    charGrid.id = "specialCharsGrid";
    charGrid.className = "special-chars-grid";
    
    panel.appendChild(panelTitle);
    panel.appendChild(charGrid);
    
    // Insert the panel after the textarea
    const textarea = document.getElementById("cardTextInput");
    if (textarea && textarea.parentNode) {
        textarea.parentNode.insertBefore(panel, textarea.nextSibling);
    }
}

// Add this function to update the special characters based on selected deck
function updateSpecialCharacters(deckName: string): void {
    const panel = document.getElementById("specialCharsPanel");
    const charGrid = document.getElementById("specialCharsGrid");
    
    if (!panel || !charGrid) return;

    // Clear existing characters
    charGrid.innerHTML = "";

    // Get characters for the selected deck
    const characters = specialCharacterSets[deckName];
    
    if (!characters || characters.length === 0) {
        panel.style.display = "none";
        return;
    }

    panel.style.display = "block";

    // Create buttons for each character
    characters.forEach(char => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "special-char-btn";
        button.style.fontSize = "30px";
        button.textContent = char;
        button.title = `Insert ${char}`;
        
        // Add click handler to insert character
        button.addEventListener("click", () => {
            insertCharacterAtCursor(char);
        });
        
        charGrid.appendChild(button);
    });
}

// Add this function to insert character at cursor position in textarea
function insertCharacterAtCursor(character: string): void {
    const textarea = document.getElementById("cardTextInput") as HTMLTextAreaElement;
    if (!textarea) return;

    const startPos = textarea.selectionStart;
    const endPos = textarea.selectionEnd;
    const textBefore = textarea.value.substring(0, startPos);
    const textAfter = textarea.value.substring(endPos);
    
    // Insert the character
    textarea.value = textBefore + character + textAfter;
    
    // Move cursor to after the inserted character
    const newCursorPos = startPos + character.length;
    textarea.setSelectionRange(newCursorPos, newCursorPos);
    
    // Focus back on textarea
    textarea.focus();
    
    // Trigger input event to update currentFileContent
    const inputEvent = new Event('input', { bubbles: true });
    textarea.dispatchEvent(inputEvent);
}


interface CreateSessionResponse {
    status: 'success' | 'error';
    session_id?: number;
    deck?: string;
    cards_count?: number;
    error?: string;
    details?: string; // Add details property
}

interface SubmitReviewResultsResponse {
    status: 'success' | 'error';
    processed_count?: number;
    updated_cards?: number[];
    review_timestamp?: string;
    session_id?: number;
    error?: string;
    details?: string;
}

// Add this variable to track the current session
let currentSessionId: number | null = null;


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
    due_now_count?: number;
    due_ahead_count?: number;
    deck?: string;
    checked_at?: string;
    review_ahead?: boolean;
    hours_ahead?: number;
    error?: string;
    details?: string;
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeTabSwitching);
} else {
    // DOM is already loaded, initialize immediately
    initializeTabSwitching();
}

// Update your initializeTabSwitching function to include the browser setup
function initializeTabSwitching() {
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
                console.log("Loaded " + button.id);
                
                // Initialize browse cards tab when it becomes active
                if (this.id === 'browse_cards') {
                    setupBrowseCardsTab();
                }
            }
        });
    });
    
    setupReviewAheadUI();
    setupCheckYourWorkTab();
}

let currentFileContent: string = "";
let currentDeck: string = "";
let uploadDeckDropdown = document.getElementById("upload_dropdownMenu") as HTMLSelectElement;

// Modify your existing deck dropdown event listener
if (uploadDeckDropdown) {
    uploadDeckDropdown.addEventListener('change', (event) => {
        const selectedValue = (event.target as HTMLSelectElement).value;
        currentDeck = selectedValue;

        console.log("Current deck is: <" + currentDeck + ">")
        
        // Update special characters panel
        const textRadio = document.getElementById('textInputRadio') as HTMLInputElement;
        if (textRadio && textRadio.checked) {
            updateSpecialCharacters(currentDeck);
        }
    });
}

let fileInput = document.getElementById("uploadTextFile") as HTMLInputElement;
let textInputBox = document.getElementById("cardTextInput") as HTMLTextAreaElement;
let uploadSubmitButton = document.getElementById("upload_submitBtn") as HTMLButtonElement;
let uploadCancelButton = document.getElementById("upload_cancel") as HTMLButtonElement;

// Handle file input
fileInput.addEventListener('change', (event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file && file.type === 'text/plain') { // Check file type for safety
        const reader = new FileReader();
        reader.onload = (e) => {
            if (currentDeck != "") {
                uploadSubmitButton.disabled = false;
                uploadCancelButton.disabled = false;
                const fileContent = e.target?.result as string;
                // Process the fileContent here
                currentFileContent = fileContent;
            }
        };
        reader.readAsText(file); // Read the file as text
    } else {
        console.warn('Please select a valid text file.');
    }
});

// Handle direct text input
textInputBox.addEventListener('input', (event) => {
    const textContent = (event.target as HTMLTextAreaElement).value;
    if (textContent.trim().length > 0) {
        uploadSubmitButton.disabled = false;
        uploadCancelButton.disabled = false;
        // Store the text content in the same variable for processing
        currentFileContent = textContent;
    } else {
        // Disable buttons if text area is empty
        uploadSubmitButton.disabled = true;
        uploadCancelButton.disabled = true;
        currentFileContent = "";
    }
});

// Optional: Also handle when radio buttons change to reset the content
const fileRadio = document.getElementById('fileInputRadio') as HTMLInputElement;
const textRadio = document.getElementById('textInputRadio') as HTMLInputElement;
const cardFormatDropdownDiv = document.getElementById("cardFormatSection") as HTMLDivElement;
const cardFormatDropdown = document.getElementById("card_format_dropdown") as HTMLSelectElement;

// Initialize visibility on page load
if (fileRadio.checked) {
    cardFormatDropdownDiv.style.display = "none";
}


// Modify your text radio button event listener to create the panel when text input is selected
if (fileRadio && textRadio && cardFormatDropdownDiv) {
    fileRadio.addEventListener('change', () => {
        if (fileRadio.checked) {
            // Clear text input and reset content
            textInputBox.value = "";
            currentFileContent = "";
            uploadSubmitButton.disabled = true;
            uploadCancelButton.disabled = true;
            // Hide dropdown when using file upload
            cardFormatDropdownDiv.style.display = "none";
            
            // Hide special characters panel
            const panel = document.getElementById("specialCharsPanel");
            if (panel) {
                panel.style.display = "none";
            }
        }
    });

    textRadio.addEventListener('change', () => {
        if (textRadio.checked) {
            // Clear file input and reset content
            fileInput.value = "";
            currentFileContent = "";
            uploadSubmitButton.disabled = true;
            uploadCancelButton.disabled = true;
            // Show dropdown when typing directly
            cardFormatDropdownDiv.style.display = "block";
            
            // Create and show special characters panel
            createSpecialCharactersPanel();
            if (currentDeck) {
                updateSpecialCharacters(currentDeck);
            }
        }
    });
    
    // Initialize the dropdown visibility and special chars panel based on current selection
    if (fileRadio.checked) {
        cardFormatDropdownDiv.style.display = "none";
    } else if (textRadio.checked) {
        cardFormatDropdownDiv.style.display = "block";
        createSpecialCharactersPanel();
        if (currentDeck) {
            updateSpecialCharacters(currentDeck);
        }
    }
}

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
async function sendNoteToBackend(deck: string, note_type: string, field_values: string[], field_processing: string[], createdTimestamp: string) {
    // Generate card configurations based on note type
    let card_configs: any[] = [];
    
    if (note_type === "Two-Way") {
        card_configs = TwoWayCard(field_values, field_processing);
    } else if (note_type === "One-Way") {
        card_configs = OneWayCard(field_values, field_processing);
    }
    
    const field_names = field_processing.map((_, index) => `field_${index + 1}`);
    
    const payload = {
        deck: deck,
        note_type: note_type,
        field_names: field_names,
        field_values: field_values,
        field_processing: field_processing,
        card_configs: card_configs,
        timeCreated: createdTimestamp
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


const timestampCreated = new Date(Date.now()).toISOString();
// Add event listener for the wipe database button
let wipeDatabaseButton = document.getElementById("wipeDatabaseButton");
if (wipeDatabaseButton) {
    wipeDatabaseButton.addEventListener('click', async () => {
        console.log('Wipe database button clicked');
        const wipeSuccess = await wipeSynapdeckDatabase();
        if (wipeSuccess) {
            console.log('✅ Database wiped successfully');
            alert('Database wiped successfully!');
        } else {
            console.error('❌ Failed to wipe database');
            alert('Failed to wipe database');
        }
    });
}

// Modified submit button event listener
uploadSubmitButton.addEventListener('click', async () => {
    console.log('Submit button clicked');
    
    let currentNoteType = "";
    const lines = currentFileContent.split('\n');

    let thisNoteProcessList: string[] = [];
    if (cardFormatDropdown && (currentDeck != "")) {
        console.log(cardFormatDropdown.value);
        if (cardFormatDropdown.value == "two-way") {
            currentNoteType = "Two-Way";
            thisNoteProcessList = [currentDeck, "", currentDeck, ""];
        } else if (cardFormatDropdown.value == "one-way-T2N") {
            currentNoteType = "One-Way";
            thisNoteProcessList = [currentDeck, ""];
        } else if (cardFormatDropdown.value == "one-way-N2T") {
            currentNoteType = "One-Way";
            thisNoteProcessList = ["", currentDeck];
        }
    }
    
    // Collect all notes first
    const notesToProcess: NoteToProcess[] = [];
    
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        if (line.length > 0 && line.includes(" / ")) {
            line = line.replaceAll(" / ", " // "); // Necessary to deal with HTML tags in the fields
            let thisNoteFieldData = line.split("//");
            let thisNoteDataList: string[] = [];
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
                note.processList,
                timestampCreated
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
    if (textInputBox) {
        textInputBox.value = "";
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
                actual_current_time: new Date().toISOString(), // Add this
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

async function createReviewSession(deckName: string, cardIds: number[], maxCards: number, reviewAheadHours: number = 0): Promise<CreateSessionResponse> {
    console.log(`📝 Creating review session for deck "${deckName}" with ${cardIds.length} cards`);
    
    try {
        const response = await fetch('/create_review_session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                deck: deckName,
                max_cards_requested: maxCards,
                review_ahead_hours: reviewAheadHours,
                card_ids: cardIds
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result: CreateSessionResponse = await response.json();
        console.log('Create session response:', result);
        
        return result;
    } catch (error) {
        console.error('Network error creating review session:', error);
        return { 
            status: 'error', 
            error: 'Network error creating review session',
            details: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}



// Function to group cards by due date with configurable precision
function groupCardsByDueDate(cards: CardDue[], groupByDateOnly = false) {
    const groupedCards = new Map();
    
    cards.forEach(card => {
        // Use either full timestamp or date-only based on parameter
        const groupKey = groupByDateOnly 
            ? card.time_due.split('T')[0]  // Extract just YYYY-MM-DD
            : card.time_due;               // Use full timestamp
        
        if (!groupedCards.has(groupKey)) {
            groupedCards.set(groupKey, []);
        }
        groupedCards.get(groupKey).push(card);
    });
    
    // Convert Map to array of arrays and sort by due date
    const sortedGroups: CardDue[][] = Array.from(groupedCards.entries())
        .sort(([dateA], [dateB]) => {
            return new Date(dateA).getTime() - new Date(dateB).getTime();
        })
        .map(([date, cards]) => cards);
    
    return sortedGroups;
}

function shuffleCardArray(cards: CardDue[]): CardDue[] {
    const shuffled = [...cards]; // Create a copy to avoid mutating original
  
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
  
    return shuffled;
}

type idToCardDict = {
    [key: string]: CardDue
}

function selectCardsFromGroup(
        candidateCards: CardDue[], 
        alreadySelected: Set<number>, 
        maxCards: number, 
        cardDict: idToCardDict
        ): CardDue[] {
    const selectedFromGroup: CardDue[] = [];
    const shuffledCandidates = shuffleCardArray(candidateCards);
    
    for (const card of shuffledCandidates) {
        // Stop if we've reached our limit
        if (alreadySelected.size >= maxCards) {
            break;
        }
        
        // Skip if this card is already selected
        if (alreadySelected.has(card.card_id)) {
            continue;
        }
        
        // Check if any peers of this card are already selected
        const hasPeerConflict = card.peers && card.peers.some(peerId => alreadySelected.has(peerId));
        
        if (!hasPeerConflict) {
            // This card is safe to add
            selectedFromGroup.push(card);
            alreadySelected.add(card.card_id);
            console.log(`✓ Added card ${card.card_id} (no peer conflicts)`);
        } else {
            console.log(`⚠ Skipped card ${card.card_id} (peer conflict with: ${card.peers?.filter(id => alreadySelected.has(id)) || []})`);
        }
    }    
    return selectedFromGroup;
}

function produceFinalCardList(cards: CardDue[], numCards: number): CardDue[] {
    console.log(`🎯 Producing review sheet: ${numCards} cards from ${cards.length} available`);

    // Create lookup dictionary for cards
    const cardDict: idToCardDict = {};
    for (const card of cards) {
        cardDict[card.card_id.toString()] = card;
    }
    
    // Group cards by due date (date only, not time)
    const sortedGroups: CardDue[][] = groupCardsByDueDate(cards, true); // true for date-only grouping
    console.log(`📅 Found ${sortedGroups.length} due date groups:`, 
        sortedGroups.map(group => `${group[0].time_due.split('T')[0]} (${group.length} cards)`));

    const finalCardList: CardDue[] = [];
    const selectedCardIds = new Set<number>();
    
    // Process each due date group in order (earliest first)
    for (let i = 0; i < sortedGroups.length && selectedCardIds.size < numCards; i++) {
        const group = sortedGroups[i];
        const remainingSlots = numCards - selectedCardIds.size;
        
        console.log(`\n📋 Processing group ${i + 1}/${sortedGroups.length}: ${group[0].time_due.split('T')[0]}`);
        console.log(`   Available in group: ${group.length}, Remaining slots: ${remainingSlots}`);
        
        const selectedFromGroup = selectCardsFromGroup(
            group, 
            selectedCardIds, 
            numCards, 
            cardDict
        );
        
        finalCardList.push(...selectedFromGroup);
        console.log(`   Selected ${selectedFromGroup.length} cards from this group`);
        
        // Log current progress
        console.log(`   📊 Progress: ${selectedCardIds.size}/${numCards} cards selected`);
    }
    
    console.log(`\n🎉 Final selection: ${finalCardList.length} cards`);
    console.log('Selected card IDs:', finalCardList.map(c => c.card_id));
    
    // Final shuffle of the selected cards to randomize order within the review session
    const shuffledFinalList = shuffleCardArray(finalCardList);
    
    console.log('🔀 Final shuffled order:', shuffledFinalList.map(c => c.card_id));
    
    return shuffledFinalList;
}

function generateReviewSheetHTML(cards: CardDue[], leftColumnWidth: string = "40%"): string {
    const today = new Date().toLocaleDateString();
    const rightColumnWidth = `calc(100% - ${leftColumnWidth})`;
    
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Card Review Sheet - ${today}</title>
            <style>
                @font-face {
                    font-family: 'GentiumPlus';
                    src: url('/Gentium/GentiumPlus-Regular.ttf') format('truetype');
                    font-weight: normal;
                    font-style: normal;
                    font-display: swap;
                }
                
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                
                body {
                    font-family: 'GentiumPlus', 'Gentium Plus', serif;
                    font-size: 14px;
                    line-height: 1.4;
                    color: #000;
                    background: white;
                    max-width: 8.5in;
                    margin: 0 auto;
                    padding: 0.5in;
                }
                
                .header {
                    text-align: center;
                    margin-bottom: 30px;
                    border-bottom: 2px solid #333;
                    padding-bottom: 20px;
                }
                
                .title {
                    font-size: 24px;
                    font-weight: bold;
                    margin-bottom: 8px;
                }
                
                .date {
                    font-size: 12px;
                    color: #666;
                    margin-bottom: 15px;
                }
                
                .summary {
                    font-size: 14px;
                    font-weight: bold;
                }
                
                .section-title {
                    font-size: 16px;
                    font-weight: bold;
                    margin: 20px 0 15px 0;
                    color: #333;
                }
                
                .two-column-container {
                    display: flex;
                    min-height: calc(100vh - 200px);
                    gap: 20px;
                }
                
                .left-column {
                    width: ${leftColumnWidth};
                    padding-right: 10px;
                }
                
                .right-column {
                    width: ${rightColumnWidth};
                    padding-left: 10px;
                }
                
                .card-item {
                    margin-bottom: 15px;
                    page-break-inside: avoid;
                    break-inside: avoid;
                    display: flex;
                    align-items: flex-start;
                    justify-content: flex-end;
                    text-align: right;
                }
                
                .card-question {
                    font-size: 14px;
                    font-weight: normal;
                    line-height: 1.4;
                    max-width: 100%;
                }
                
                .card-question strong {
                    font-weight: bold;
                }
                
                /* Removed answer-space styles */
                
                .controls {
                    position: fixed;
                    top: 10px;
                    right: 10px;
                    background: rgba(255, 255, 255, 0.95);
                    padding: 10px;
                    border-radius: 5px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    border: 1px solid #ddd;
                    z-index: 1000;
                }
                
                .btn {
                    background: #007cba;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    margin: 0 5px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                }
                
                .btn:hover {
                    background: #005a87;
                }
                
                .width-controls {
                    position: fixed;
                    top: 60px;
                    right: 10px;
                    background: rgba(255, 255, 255, 0.95);
                    padding: 10px;
                    border-radius: 5px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    border: 1px solid #ddd;
                    z-index: 1000;
                    font-size: 12px;
                }
                
                .width-controls label {
                    display: block;
                    margin-bottom: 5px;
                }
                
                .width-controls input {
                    width: 60px;
                    padding: 2px 4px;
                    margin-left: 5px;
                }
                
                @media print {
                    .controls, .width-controls {
                        display: none !important;
                    }
                    
                    body {
                        font-size: 11pt !important; /* Smaller font for more content */
                        line-height: 1.2 !important; /* Tighter line spacing */
                        max-width: none;
                        margin: 0;
                        padding: 0.3in !important; /* Smaller margins */
                    }
                    
                    /* Compact header */
                    .header {
                        margin-bottom: 15px !important; /* Reduced from 30px */
                        padding-bottom: 10px !important; /* Reduced from 20px */
                    }
                    
                    .title {
                        font-size: 18px !important; /* Smaller title */
                        margin-bottom: 4px !important;
                    }
                    
                    .date {
                        font-size: 10px !important;
                        margin-bottom: 8px !important;
                    }
                    
                    .summary {
                        font-size: 12px !important;
                    }
                    
                    .section-title {
                        font-size: 14px !important;
                        margin: 10px 0 8px 0 !important; /* Much tighter spacing */
                    }
                    
                    /* Optimize card spacing */
                    .card-item {
                        margin-bottom: 8px !important; /* Reduced from 15px */
                        page-break-inside: avoid;
                        break-inside: avoid;
                    }
                    
                    .card-question {
                        font-size: 11pt !important; /* Consistent with body */
                        line-height: 1.2 !important;
                    }
                    
                    .two-column-container {
                        min-height: auto;
                        gap: 15px !important; /* Smaller gap between columns */
                    }
                    
                    .left-column {
                        padding-right: 5px !important;
                    }
                    
                    .right-column {
                        padding-left: 5px !important;
                    }
                    
                    /* Force content to fill page height better */
                    .two-column-container {
                        display: flex;
                        flex-direction: row;
                        justify-content: space-between;
                    }
                    
                    /* Prevent orphaned content */
                    .left-column, .right-column {
                        orphans: 2;
                        widows: 2;
                    }
                }
                
                /* Responsive design for smaller screens */
                @media (max-width: 768px) {
                    .two-column-container {
                        flex-direction: column;
                    }
                    
                    .left-column, .right-column {
                        width: 100% !important;
                        padding: 0;
                    }
                    
                    .card-item {
                        justify-content: flex-start;
                        text-align: left;
                    }
                }
            </style>
        </head>
        <body>
            <div class="controls">
                <button class="btn" onclick="window.print()">📄 Save as PDF</button>
                <button class="btn" onclick="window.close()">✕ Close</button>
            </div>
            
            <div class="width-controls">
                <label>Left Column Width:
                    <input type="text" id="leftWidthInput" value="${leftColumnWidth}" onchange="updateColumnWidths()">
                </label>
                <small>e.g., 40%, 300px, 3in</small>
            </div>
            
            <div class="header">
                <div class="title">Card Review Sheet</div>
                <div class="date">Generated: ${today}</div>
                <div class="summary">Total Cards: ${cards.length}</div>
            </div>
            
            <div class="section-title">Cards Due for Review:</div>
            
            <div class="two-column-container">
                <div class="left-column">
                    ${cards.map((card, index) => generateCardHTML(card, index + 1)).join('')}
                </div>
                <div class="right-column">
                    <!-- Empty space for answers -->
                </div>
            </div>
            
            <script>
                // Ensure fonts are loaded before any operations
                document.fonts.ready.then(() => {
                    console.log('✅ All fonts loaded');
                });
                
                // Function to update column widths dynamically
                function updateColumnWidths() {
                    const leftWidthInput = document.getElementById('leftWidthInput');
                    const newLeftWidth = leftWidthInput.value;
                    const newRightWidth = \`calc(100% - \${newLeftWidth})\`;
                    
                    const leftColumn = document.querySelector('.left-column');
                    const rightColumn = document.querySelector('.right-column');
                    
                    if (leftColumn && rightColumn) {
                        leftColumn.style.width = newLeftWidth;
                        rightColumn.style.width = newRightWidth;
                    }
                }
                
                // Optional: Auto-focus for keyboard shortcuts
                window.addEventListener('load', () => {
                    window.focus();
                });
                
                // Keyboard shortcut for print
                document.addEventListener('keydown', (e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
                        e.preventDefault();
                        window.print();
                    }
                });
            </script>
        </body>
        </html>`;
}



// Updated generateCardHTML function to work with the two-column layout
function generateCardHTML(card: CardDue, cardNumber: number): string {
    const frontSideLine = generateCardFrontLine(card);
    // Function to safely process HTML while allowing specific tags
    function processHTMLContent(text: string): string {
        // First, handle your custom tags
        let processed = text
            .replace(/<ብ>/g, '<strong>')
            .replace(/<\/ብ>/g, '</strong>');
        
        // Define allowed HTML tags
        const allowedTags = ['b', 'strong', 'i', 'em', 'u', 'span', 'br'];
        
        // Split text into parts: HTML tags vs regular text
        const parts = processed.split(/(<\/?[^>]+>)/);
        
        const processedParts = parts.map(part => {
            if (part.match(/^<\/?[^>]+>$/)) {
                // This is an HTML tag
                const tagMatch = part.match(/^<\/?(\w+)(?:\s|>)/);
                const tagName = tagMatch ? tagMatch[1].toLowerCase() : '';
                
                if (allowedTags.includes(tagName)) {
                    // Keep allowed tags as-is
                    return part;
                } else {
                    // Escape disallowed tags
                    return part
                        .replace(/&/g, '&amp;')
                        .replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;');
                }
            } else {
                // This is regular text - only escape dangerous characters, not HTML entities
                return part
                    .replace(/&(?!(?:amp|lt|gt|quot|apos);)/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;');
            }
        });
        
        return processedParts.join('');
    }
    
    const processedText = processHTMLContent(frontSideLine);
    
    return `
        <div class="card-item">
            <div class="card-question">
                ${cardNumber}. ${processedText}
            </div>
        </div>
    `;
}


// Update your produceCardReviewSheetPDFViewer function to create a session
async function produceCardReviewSheetPDFViewer(cards: CardDue[]) {
    // Mark cards as under review in database
    const cardIds = cards.map(card => card.card_id);
    await markCardsUnderReview(cardIds);
    
    // Create a review session
    const reviewAheadCheckbox = document.getElementById('reviewAheadCheckbox') as HTMLInputElement;
    const reviewAheadHours = document.getElementById('reviewAheadHours') as HTMLSelectElement;
    const reviewAheadNumCards = document.getElementById("review_numCards") as HTMLInputElement;
    
    const maxCards = parseInt(reviewAheadNumCards.value);
    const hoursAhead = reviewAheadCheckbox?.checked ? parseInt(reviewAheadHours?.value || '24') : 0;
    
    console.log('🎯 Creating review session...');
    const sessionResult = await createReviewSession(selectedReviewDeck, cardIds, maxCards, hoursAhead);
    
    if (sessionResult.status === 'success' && sessionResult.session_id) {
        currentSessionId = sessionResult.session_id;
        console.log(`✅ Created session ${currentSessionId} for ${cardIds.length} cards`);
    } else {
        console.error('❌ Failed to create session:', sessionResult.error);
        // Continue anyway, but without session tracking
        currentSessionId = null;
    }
    
    // Store the order locally (with session info)
    const reviewOrder = cards.map((card, index) => ({
        cardId: card.card_id,
        questionNumber: index + 1,
        questionText: generateCardFrontLine(card)
    }));
    
    localStorage.setItem(`reviewOrder_${selectedReviewDeck}`, JSON.stringify({
        order: reviewOrder,
        timestamp: new Date().toISOString(),
        sessionId: currentSessionId // Store session ID
    }));

    try {
        // Generate the HTML (rest of your existing code)
        const htmlContent = generateReviewSheetHTML(cards);
        
        // Create blob and URL
        const blob = new Blob([htmlContent], { type: 'text/html' });
        const blobUrl = URL.createObjectURL(blob);
        
        // Open in new tab
        const pdfTab = window.open(blobUrl, '_blank');
        
        if (pdfTab) {
            // Add event listener to handle PDF generation when ready
            pdfTab.addEventListener('load', () => {
                setTimeout(() => {
                    pdfTab.focus();
                }, 1500);
            });
            
            // Update the tab title
            pdfTab.addEventListener('load', () => {
                if (pdfTab.document) {
                    pdfTab.document.title = `Card Review Sheet - ${new Date().toLocaleDateString()} (Session ${currentSessionId || 'N/A'})`;
                }
            });
        }
        
        // Clean up blob URL after a delay
        setTimeout(() => {
            URL.revokeObjectURL(blobUrl);
        }, 10000);
        
        console.log('✅ PDF view opened in new tab');
        
    } catch (error) {
        console.error('Error opening PDF view:', error);
        alert('Failed to open PDF view');
    }
}

function generateCardFrontLine(card: CardDue): string {
    let outputString = ""

    let allFields = card.field_values;
    let allProcessing = card.field_processing;

    if (allFields.length != allProcessing.length) {
        console.log("Field/processing array mismatch");
        console.log(card);
        return "ERROR";
    }

    let targetIndex = 0;
    //Change the name of this
    if (card.card_format == "Native to Target") {
        targetIndex = 1; 
    }
    console.log(card.card_format);
    console.log("Target index: " + targetIndex.toString());
    console.log(card.field_values);
    console.log(card.field_processing);
    let targetField = card.field_values[targetIndex];
    let targetProcessing = card.field_processing[targetIndex];

    console.log(targetField + " (" + card.card_format + ") is processed as " + targetProcessing);

    let processedField = cleanFieldDatum(targetField, targetProcessing);
    console.log(processedField);
    return processedField;
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

let reviewDeckDropdown = document.getElementById("review_dropdownMenu") as HTMLSelectElement;
let selectedReviewDeck: string = "";


// Updated dropdown event listener that caches but doesn't display
if (reviewDeckDropdown) {
    reviewDeckDropdown.addEventListener('change', async (event) => {
        const selectedValue = (event.target as HTMLSelectElement).value;
        selectedReviewDeck = selectedValue;
        
        // Clear the output div when deck changes
        const outputDiv = document.getElementById("check_output") as HTMLDivElement;
        if (outputDiv) {
            outputDiv.innerHTML = '';
        }
        
        if (selectedReviewDeck) {
            console.log(`Deck selected: ${selectedReviewDeck}, pre-loading card data...`);
            
            // Show brief loading indicator on submit button
            const submitButton = document.getElementById("review_submitBtn") as HTMLButtonElement;
            if (submitButton) {
                submitButton.textContent = 'Checking cards...';
                submitButton.disabled = true;
            }
            
            try {
                // Pre-load the card data silently
                //Man this is repetitive
                const reviewAheadNumCards = document.getElementById("review_numCards") as HTMLInputElement;

            
                let numCards = parseInt(reviewAheadNumCards.value)
                cachedCardResults = await checkAvailableCardsWithOptions(selectedReviewDeck);
                lastCheckedDeck = selectedReviewDeck;
                
                // Update submit button text based on results
                const reviewAheadCheckbox = document.getElementById('reviewAheadCheckbox') as HTMLInputElement;
                const reviewAheadHours = document.getElementById('reviewAheadHours') as HTMLSelectElement;
                const currentReviewAhead = reviewAheadCheckbox?.checked || false;
                const currentHoursAhead = currentReviewAhead ? parseInt(reviewAheadHours?.value || '24') : 0;
                
                if (cachedCardResults.status === 'success' && cachedCardResults.cards) {
                    updateSubmitButtonText(numCards, cachedCardResults.cards.length, currentReviewAhead, currentHoursAhead);
                } else {
                    updateSubmitButtonText(numCards, 0, currentReviewAhead, currentHoursAhead);
                }
                
                console.log(`Pre-loaded ${cachedCardResults.cards?.length || 0} cards for ${selectedReviewDeck}`);
            } catch (error) {
                console.error('Error pre-loading cards:', error);
                if (submitButton) {
                    submitButton.textContent = 'Error Loading Cards';
                    submitButton.disabled = true;
                }
            }
        } else {
            // Reset if no deck selected
            const submitButton = document.getElementById("review_submitBtn") as HTMLButtonElement;
            if (submitButton) {
                submitButton.textContent = 'Select Deck';
                submitButton.disabled = true;
            }
            cachedCardResults = null;
            lastCheckedDeck = "";
        }
    });
}

// Helper function to refresh the card cache
async function refreshCardCache(): Promise<void> {
    if (!selectedReviewDeck) return;
    
    const reviewAheadNumCards = document.getElementById("review_numCards") as HTMLInputElement;

    console.log('Refreshing card cache due to setting change...');
    let numCards = parseInt(reviewAheadNumCards.value)
    const submitButton = document.getElementById("review_submitBtn") as HTMLButtonElement;
    if (submitButton) {
        submitButton.textContent = 'Updating...';
        submitButton.disabled = true;
    }
    
    try {
        cachedCardResults = await checkAvailableCardsWithOptions(selectedReviewDeck);
        lastCheckedDeck = selectedReviewDeck;
        
        const reviewAheadCheckbox = document.getElementById('reviewAheadCheckbox') as HTMLInputElement;
        const reviewAheadHours = document.getElementById('reviewAheadHours') as HTMLSelectElement;
        const currentReviewAhead = reviewAheadCheckbox?.checked || false;
        const currentHoursAhead = currentReviewAhead ? parseInt(reviewAheadHours?.value || '24') : 0;
        
        if (cachedCardResults.status === 'success' && cachedCardResults.cards) {
            updateSubmitButtonText(numCards, cachedCardResults.cards.length, currentReviewAhead, currentHoursAhead);
        } else {
            updateSubmitButtonText(numCards, 0, currentReviewAhead, currentHoursAhead);
        }
    } catch (error) {
        console.error('Error refreshing card cache:', error);
        if (submitButton) {
            submitButton.textContent = 'Error';
            submitButton.disabled = true;
        }
    }
}

function setupReviewAheadUI(): void {
    const reviewAheadCheckbox = document.getElementById('reviewAheadCheckbox') as HTMLInputElement;
    const reviewAheadOptions = document.getElementById('reviewAheadOptions') as HTMLDivElement;
    
    if (reviewAheadCheckbox && reviewAheadOptions) {
        reviewAheadCheckbox.addEventListener('change', async function() {
            if (this.checked) {
                reviewAheadOptions.style.display = 'block';
            } else {
                reviewAheadOptions.style.display = 'none';
            }
            
            // Refresh cache and button text when review ahead setting changes
            if (selectedReviewDeck) {
                await refreshCardCache();
            }
        });
    }
    
    const reviewAheadHours = document.getElementById('reviewAheadHours') as HTMLSelectElement;
    if (reviewAheadHours) {
        reviewAheadHours.addEventListener('change', async function() {
            const reviewAheadCheckbox = document.getElementById('reviewAheadCheckbox') as HTMLInputElement;
            if (selectedReviewDeck && reviewAheadCheckbox?.checked) {
                await refreshCardCache();
            }
        });
    }
}

// Add a variable to store the cached card results
let cachedCardResults: CheckCardsResponse | null = null;
let lastCheckedDeck: string = "";
let reviewSubmitButton = document.getElementById("review_submitBtn");

function updateSubmitButtonText(numCards: number, totalCardCount: number, reviewAhead: boolean, hoursAhead: number): void {
    const submitButton = document.getElementById("review_submitBtn") as HTMLButtonElement;
    if (submitButton) {
        if (totalCardCount === 0) {
            const timeText = reviewAhead ? ` (${hoursAhead}h ahead)` : '';
            submitButton.textContent = `No Cards Available${timeText}`;
            submitButton.disabled = true;
        } else {
            const timeText = reviewAhead ? ` (${hoursAhead}h ahead)` : '';
            submitButton.textContent = `Review ${numCards} of ${totalCardCount} Card${totalCardCount !== 1 ? 's' : ''}${timeText}`;
            submitButton.disabled = false;
        }
    }
}

// Frontend function to mark cards as under review
async function markCardsUnderReview(cardIds: number[]): Promise<boolean> {
    try {
        const response = await fetch('/mark_cards_under_review', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                card_ids: cardIds 
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log('Mark cards under review response:', result);
        
        if (result.status === 'success') {
            console.log(`✅ Successfully marked ${result.updated_count} cards as under review`);
            return true;
        } else {
            console.error('❌ Error marking cards under review:', result.error);
            return false;
        }
    } catch (error) {
        console.error('❌ Network error marking cards under review:', error);
        return false;
    }
}

if (reviewSubmitButton) {
    reviewSubmitButton.addEventListener('click', async () => {
        if (!selectedReviewDeck) {
            const outputDiv = document.getElementById("check_output") as HTMLDivElement;
            if (outputDiv) {
                outputDiv.innerHTML = `<p class="error">Please select a deck first.</p>`;
            }
            return;
        }

        console.log(`Review submit clicked for deck: ${selectedReviewDeck}`);
        
        // Show loading state
        const outputDiv = document.getElementById("check_output") as HTMLDivElement;
        if (outputDiv) {
            outputDiv.innerHTML = `<p>Loading cards for ${selectedReviewDeck}...</p>`;
        }

        try {
            // Check if we need to refresh the cache (deck changed or review options changed)
            const reviewAheadCheckbox = document.getElementById('reviewAheadCheckbox') as HTMLInputElement;
            const reviewAheadHours = document.getElementById('reviewAheadHours') as HTMLSelectElement;
            const reviewAheadNumCards = document.getElementById("review_numCards") as HTMLInputElement;

            let numCards = parseInt(reviewAheadNumCards.value)
            
            const currentReviewAhead = reviewAheadCheckbox?.checked || false;
            const currentHoursAhead = currentReviewAhead ? parseInt(reviewAheadHours?.value || '24') : 0;
            
            // Generate a cache key to check if settings changed
            const cacheKey = `${selectedReviewDeck}-${currentReviewAhead}-${currentHoursAhead}`;
            const lastCacheKey = `${lastCheckedDeck}-${cachedCardResults?.review_ahead || false}-${cachedCardResults?.hours_ahead || 0}`;
            
            // Fetch fresh data if cache is invalid
            if (!cachedCardResults || cacheKey !== lastCacheKey) {
                console.log('Cache miss or settings changed, fetching fresh data...');
                cachedCardResults = await checkAvailableCardsWithOptions(selectedReviewDeck);
                lastCheckedDeck = selectedReviewDeck;
            } else {
                console.log('Using cached card data');
            }

            // Display the results
            if (cachedCardResults.status === 'success' && cachedCardResults.cards) {
                console.log("Should be showing review sheet...")
                let cardsToReview: CardDue[] = produceFinalCardList(cachedCardResults.cards, numCards);
                console.log(cardsToReview[0]);

                let doc = produceCardReviewSheetPDFViewer(cardsToReview);
                
                let idsUnderReview: number[] = []
                for (let i=0; i < cardsToReview.length; i++) {
                    let thisCardID = cardsToReview[i].card_id;
                    idsUnderReview.push(thisCardID);
                }
                markCardsUnderReview(idsUnderReview)

                // Update submit button text to show count
                updateSubmitButtonText(numCards, cachedCardResults.cards.length, currentReviewAhead, currentHoursAhead);
            } else {
                if (outputDiv) {
                    outputDiv.innerHTML = `<p class="error">Error: ${cachedCardResults.error}</p>`;
                }
                updateSubmitButtonText(numCards, 0, currentReviewAhead, currentHoursAhead);
            }
        } catch (error) {
            console.error('Error in review submit:', error);
            if (outputDiv) {
                outputDiv.innerHTML = `<p class="error">Network error occurred</p>`;
            }
        }
    });
}

// Frontend helper functions
async function resetDeckCardsUnderReview(deckName: string): Promise<boolean> {
    try {
        const response = await fetch('/reset_cards_under_review', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                deck: deckName 
            })
        });

        const result = await response.json();
        if (result.status === 'success') {
            console.log(`✅ Reset ${result.updated_count} cards in deck "${result.deck}"`);
            return true;
        } else {
            console.error('❌ Error resetting deck cards:', result.error);
            return false;
        }
    } catch (error) {
        console.error('❌ Network error:', error);
        return false;
    }
}

async function resetAllCardsUnderReview(): Promise<boolean> {
    try {
        const response = await fetch('/reset_cards_under_review', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                all: true 
            })
        });

        const result = await response.json();
        if (result.status === 'success') {
            console.log(`✅ Reset ${result.updated_count} cards across all decks`);
            return true;
        } else {
            console.error('❌ Error resetting all cards:', result.error);
            return false;
        }
    } catch (error) {
        console.error('❌ Network error:', error);
        return false;
    }
}


let resetCardReviews = document.getElementById("resetCardReview") as HTMLButtonElement;
if (resetCardReviews) {
    resetCardReviews.addEventListener('click', async () => {
        resetAllCardsUnderReview()
    });
}
// Usage examples:
// resetDeckCardsUnderReview("My Deck Name");  // Reset specific deck
// resetAllCardsUnderReview();                 // Reset all cards everywhere

// Add this interface near your other type definitions
interface CardsUnderReviewResponse {
    status: 'success' | 'error';
    cards?: any[]; // Use any[] since we're just passing raw DB data
    total_count?: number;
    deck?: string;
    error?: string;
}


// Function to fetch cards under review for a deck
async function getCardsUnderReview(deckName: string): Promise<CardsUnderReviewResponse> {
    try {
        const response = await fetch(`/cards_under_review/${encodeURIComponent(deckName)}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result: CardsUnderReviewResponse = await response.json();
        console.log('Cards under review response:', result);
        
        return result;
    } catch (error) {
        console.error('Error getting cards under review:', error);
        return { 
            status: 'error', 
            error: 'Network error getting cards under review' 
        };
    }
}


// In check your work - get cards in the exact review order
async function getCardsUnderReviewInOrder(deckName: string): Promise<CardDue[]> {
    // Get the saved order
    const orderData = localStorage.getItem(`reviewOrder_${deckName}`);
    if (!orderData) {
        // Fallback: just get cards under review (no guaranteed order)
        const result = await getCardsUnderReview(deckName);
        return result.status === 'success' ? result.cards?.map(convertToCardDue) || [] : [];
    }
    
    const { order } = JSON.parse(orderData);
    
    // Get all cards under review from database
    const result = await getCardsUnderReview(deckName);
    if (result.status !== 'success' || !result.cards) {
        return [];
    }
    
    const dbCards = result.cards.map(convertToCardDue);
    
    // Return cards in the exact order they were drawn
    return order.map((orderItem: any) => 
        dbCards.find(card => card.card_id === orderItem.cardId)
    ).filter(Boolean) as CardDue[];
}


// Function to convert raw DB data to CardDue interface
function convertToCardDue(rawCard: any): CardDue {
    return {
        card_id: rawCard.card_id,
        note_id: rawCard.note_id,
        deck: rawCard.deck,
        card_format: rawCard.card_format,
        field_names: rawCard.field_names || [],
        field_values: rawCard.field_values || [],
        field_processing: rawCard.field_processing || [],
        time_due: rawCard.time_due,
        interval: rawCard.interval,
        retrievability: rawCard.retrievability,
        peers: rawCard.peers || []
    };
}

// Debug version of getReviewResults
function getReviewResults(): { cardId: number, result: string }[] {
    console.log('getReviewResults called');
    
    const form = document.getElementById('reviewResultsForm') as HTMLFormElement;
    console.log('Found form:', form);
    
    if (!form) {
        console.error('Form not found!');
        return [];
    }
    
    const results: { cardId: number, result: string }[] = [];
    const answerItems = form.querySelectorAll('.answer-row');
    console.log(`Found ${answerItems.length} answer items`);
    
    answerItems.forEach((item, index) => {
        const cardIdAttr = item.getAttribute('data-card-id');
        const cardId = parseInt(cardIdAttr || '0');
        console.log(`Item ${index}: data-card-id="${cardIdAttr}", parsed cardId=${cardId}`);
        
        const selectedRadio = item.querySelector('input[type="radio"]:checked') as HTMLInputElement;
        console.log(`Item ${index}: selected radio:`, selectedRadio);
        
        if (selectedRadio) {
            console.log(`Item ${index}: radio value="${selectedRadio.value}"`);
        }
        
        if (cardId && selectedRadio) {
            results.push({
                cardId: cardId,
                result: selectedRadio.value
            });
            console.log(`Added result for card ${cardId}: ${selectedRadio.value}`);
        } else {
            console.warn(`Item ${index}: Missing cardId (${cardId}) or selectedRadio (${selectedRadio})`);
        }
    });
    
    console.log('Final results:', results);
    return results;
}


// Update your displayAnswerKey function to use the session ID
function displayAnswerKey(cards: CardDue[], deckName: string): void {
    const outputDiv = document.getElementById("check_output") as HTMLDivElement;
    if (!outputDiv) return;

    console.log(`Displaying answer key for ${cards.length} cards`);
    
    // Get session ID from localStorage if available
    const orderData = localStorage.getItem(`reviewOrder_${deckName}`);
    let sessionId: number | null = null;
    
    if (orderData) {
        try {
            const parsed = JSON.parse(orderData);
            sessionId = parsed.sessionId || null;
        } catch (e) {
            console.warn('Could not parse review order data');
        }
    }
    
    const answerKeyHTML = generateAnswerKey(cards);
    
    outputDiv.innerHTML = `
        <div class="check-work-header">
            <h2>Answer Key for "${deckName}"</h2>
            <p class="deck-info">Review your answers and select pass/hard/fail for each card</p>
            ${sessionId ? `<p class="session-info">Session ID: ${sessionId}</p>` : ''}
        </div>
        ${answerKeyHTML}
    `;
    
    // Add event listener to the submit button
    const completeReviewButton = document.getElementById('submitReviewResults');
    if (completeReviewButton) {
        console.log('Adding event listener to submit button');
        completeReviewButton.addEventListener('click', async () => {
            const results = getReviewResults();
            console.log('Review results:', results);
            
            if (results.length === 0) {
                alert('No review results to submit. Please grade at least one card.');
                return;
            }
            
            // Show loading state
            completeReviewButton.textContent = 'Submitting...';
            (completeReviewButton as HTMLButtonElement).disabled = true;
            
            try {
                // Submit the results to the backend WITH session ID
                const submitResult = await submitReviewResults(results, deckName, sessionId || undefined);
                
                if (submitResult.status === 'success') {
                    console.log(`✅ Successfully submitted ${submitResult.processed_count} review results`);
                    alert(`Review complete! Updated ${submitResult.processed_count} cards.`);
                    
                    // Clear the localStorage after successful submission
                    localStorage.removeItem(`reviewOrder_${deckName}`);
                    currentSessionId = null;
                    
                    // Clear the output after successful submission
                    outputDiv.innerHTML = `
                        <div class="success-message">
                            <h3>✅ Review Submitted Successfully!</h3>
                            <p>Updated ${submitResult.processed_count} cards in deck "${deckName}"</p>
                            <p>Session: ${sessionId || 'N/A'}</p>
                            <p>Review completed at: ${new Date(submitResult.review_timestamp || '').toLocaleString()}</p>
                        </div>
                    `;
                } else {
                    console.error('❌ Failed to submit review results:', submitResult.error);
                    alert(`Failed to submit review: ${submitResult.error}`);
                    
                    // Re-enable button on error
                    completeReviewButton.textContent = 'Submit Review Results';
                    (completeReviewButton as HTMLButtonElement).disabled = false;
                }
            } catch (error) {
                console.error('❌ Error submitting review results:', error);
                alert('Network error occurred while submitting review');
                
                // Re-enable button on error
                completeReviewButton.textContent = 'Submit Review Results';
                (completeReviewButton as HTMLButtonElement).disabled = false;
            }
        });
    } else {
        console.error('Submit button not found after adding to DOM');
    }
}

async function submitReviewResults(results: { cardId: number, result: string }[], deckName: string, sessionId?: number): Promise<SubmitReviewResultsResponse> {
    const reviewTimestamp = new Date().toISOString();
    
    console.log(`📤 Submitting ${results.length} review results for deck "${deckName}" (session: ${sessionId || 'none'})`);
    console.log('Results being submitted:', results);
    
    try {
        const response = await fetch('/submit_review_results', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                results: results,
                deck: deckName,
                session_id: sessionId, // Include session ID
                reviewedAt: reviewTimestamp
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result: SubmitReviewResultsResponse = await response.json();
        console.log('Submit review results response:', result);
        
        return result;
    } catch (error) {
        console.error('Network error submitting review results:', error);
        return { 
            status: 'error', 
            error: 'Network error submitting review results',
            details: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

function generateAnswerKey(cards: CardDue[]): string {
    console.log(`generateAnswerKey called with ${cards.length} cards`);
    
    if (cards.length === 0) {
        return '<p class="no-cards">No cards are currently under review for this deck.</p>';
    }

    let html = `
        <div class="answer-key">
            <h3>Answer Key (${cards.length} cards)</h3>
            <form id="reviewResultsForm">
                <div class="answer-table">
                    <div class="header-row">
                        <div class="qa-header">Question → Answer</div>
                        <div class="pass-header">Pass</div>
                        <div class="hard-header">Hard</div>
                        <div class="fail-header">Fail</div>
                    </div>
    `;

    cards.forEach((card, index) => {
        console.log(`Processing card ${index + 1}: ID ${card.card_id}`);
        
        const questionText = generateCardFrontLine(card);
        
        // Generate answer based on card format
        let targetBack = card.field_values[2];
        let targetProcessing = card.field_processing[2];
        // Safe trim check
        if (!targetBack || targetBack.trim() === '') {
            targetBack = card.field_values[0] || '';
            targetProcessing = card.field_processing[0] || '';
        }

        let answerText = '';
        let nativeBack = card.field_values[3] || '';  // Default to empty string if undefined
        let nativeProcessing = card.field_processing[3] || '';
        
        // Safe trim check
        if (!nativeBack || nativeBack.trim() === '') {
            nativeBack = card.field_values[1] || '';
            nativeProcessing = card.field_processing[1] || '';
        }

        

        if (card.card_format === "Native to Target") {
            // If question shows native (index 1), answer is target (index 0)
            answerText = cleanFieldDatum(targetBack || '', targetProcessing || '');
        } else {
            // If question shows target (index 0), answer is native (index 1)  
            answerText = cleanFieldDatum(nativeBack || '', nativeProcessing || '');
        }

        // Process HTML in both question and answer
        const processedQuestion = processHTMLContent(questionText);
        const processedAnswer = processHTMLContent(answerText);

        console.log(`Card ${card.card_id}: Q="${processedQuestion}" A="${processedAnswer}"`);

        html += `
            <div class="answer-row" data-card-id="${card.card_id}">
                <div class="qa-cell">${processedQuestion} → ${processedAnswer}</div>
                <div class="radio-cell">
                    <input type="radio" name="card_${card.card_id}" value="pass" checked>
                </div>
                <div class="radio-cell">
                    <input type="radio" name="card_${card.card_id}" value="hard">
                </div>
                <div class="radio-cell">
                    <input type="radio" name="card_${card.card_id}" value="fail">
                </div>
            </div>
        `;
    });

    html += `
                </div>
                <div class="submit-section">
                    <button type="button" id="submitReviewResults" class="submit-btn">
                        Submit Review Results
                    </button>
                </div>
            </form>
        </div>
    `;

    console.log('Generated HTML:', html.substring(0, 500) + '...');
    return html;
}

// Helper function to process HTML content (reuse from generateCardHTML)
function processHTMLContent(text: string): string {
    // First, handle your custom tags
    let processed = text
        .replace(/<ብ>/g, '<strong>')
        .replace(/<\/ብ>/g, '</strong>');
    
    // Define allowed HTML tags
    const allowedTags = ['b', 'strong', 'i', 'em', 'u', 'span', 'br'];
    
    // Split text into parts: HTML tags vs regular text
    const parts = processed.split(/(<\/?[^>]+>)/);
    
    const processedParts = parts.map(part => {
        if (part.match(/^<\/?[^>]+>$/)) {
            // This is an HTML tag
            const tagMatch = part.match(/^<\/?(\w+)(?:\s|>)/);
            const tagName = tagMatch ? tagMatch[1].toLowerCase() : '';
            
            if (allowedTags.includes(tagName)) {
                // Keep allowed tags as-is
                return part;
            } else {
                // Escape disallowed tags
                return part
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;');
            }
        } else {
            // This is regular text - only escape dangerous characters, not HTML entities
            return part
                .replace(/&(?!(?:amp|lt|gt|quot|apos);)/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
        }
    });
    
    return processedParts.join('');
}

// Set up the Check Your Work tab functionality
function setupCheckYourWorkTab(): void {
    const checkDeckDropdown = document.getElementById("check_dropdownMenu") as HTMLSelectElement;
    const checkSubmitButton = document.getElementById("check_submitBtn") as HTMLButtonElement;
    
    if (checkSubmitButton && checkDeckDropdown) {
        checkSubmitButton.addEventListener('click', async () => {
            const selectedDeck = checkDeckDropdown.value;
            if (!selectedDeck) {
                const outputDiv = document.getElementById("check_output") as HTMLDivElement;
                if (outputDiv) {
                    outputDiv.innerHTML = `<p class="error">Please select a deck first.</p>`;
                }
                return;
            }

            console.log(`Check your work for deck: ${selectedDeck}`);
            
            // Show loading state
            const outputDiv = document.getElementById("check_output") as HTMLDivElement;
            if (outputDiv) {
                outputDiv.innerHTML = `<p>Loading answer key for ${selectedDeck}...</p>`;
            }

            try {
                // Get cards in the correct order
                const cards = await getCardsUnderReviewInOrder(selectedDeck);
                
                console.log(`Found ${cards.length} cards under review for ${selectedDeck}`);
                
                if (cards.length > 0) {
                    // DON'T reset cards here - we want to show them!
                    // resetDeckCardsUnderReview(selectedDeck); // REMOVED THIS LINE
                    displayAnswerKey(cards, selectedDeck);
                } else {
                    if (outputDiv) {
                        outputDiv.innerHTML = `<p class="no-cards">No cards are currently under review for "${selectedDeck}". Complete a review session first.</p>`;
                    }
                }
            } catch (error) {
                console.error('Error in check your work:', error);
                if (outputDiv) {
                    outputDiv.innerHTML = `<p class="error">Network error occurred</p>`;
                }
            }
        });
    }
}


// Interfaces for card browsing (add these near your other interfaces)
interface BrowseCardsResponse {
    status: 'success' | 'error';
    cards?: CardDue[];
    total_count?: number;
    deck?: string;
    error?: string;
    filters_applied?: FiltersApplied;
}

interface CardBrowserFilters {
    deck?: string;
    searchTerm?: string;
    cardFormat?: string;
    sortBy?: string;
    sortDirection?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
}

// Add these variables for browser state management
let currentBrowsePage = 0;
let currentBrowseFilters: CardBrowserFilters = {};

// Browser API function
async function browseCards(filters: CardBrowserFilters = {}): Promise<BrowseCardsResponse> {
    try {
        const queryParams = new URLSearchParams();
        
        if (filters.deck) queryParams.append('deck', filters.deck);
        if (filters.searchTerm) queryParams.append('search_term', filters.searchTerm);
        if (filters.cardFormat) queryParams.append('card_format', filters.cardFormat);
        if (filters.sortBy) queryParams.append('sort_by', filters.sortBy);
        if (filters.sortDirection) queryParams.append('sort_direction', filters.sortDirection);
        if (filters.limit) queryParams.append('limit', filters.limit.toString());
        if (filters.offset) queryParams.append('offset', filters.offset.toString());

        const response = await fetch(`/browse_cards?${queryParams.toString()}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result: BrowseCardsResponse = await response.json();
        console.log('Browse cards response:', result);
        
        return result;
    } catch (error) {
        console.error('Error browsing cards:', error);
        return { 
            status: 'error', 
            error: 'Network error browsing cards' 
        };
    }
}

// Setup function for browse cards tab
function setupBrowseCardsTab(): void {
    const browseTab = document.getElementById('browse_mainDiv');
    if (!browseTab) return;

    // Only set up once
    if (browseTab.querySelector('.browse-controls')) {
        return;
    }

    // Create the browse cards UI with spreadsheet-like layout
    browseTab.innerHTML = `
        <h2>Browse Cards</h2>
        
        <div class="browse-controls">
            <div class="browse-filters">
                <div class="filter-row">
                    <div class="filter-group">
                        <label for="browse_deck_select">Deck:</label>
                        <select id="browse_deck_select">
                            <option value="">All Decks</option>
                            <option value="Ge'ez">Ge'ez</option>
                            <option value="Sanskrit">Sanskrit</option>
                            <option value="Akkadian">Akkadian</option>
                        </select>
                    </div>
                    
                    <div class="filter-group">
                        <label for="browse_search_input">Search:</label>
                        <input type="text" id="browse_search_input" placeholder="Search in card content...">
                    </div>
                    
                    <div class="filter-group">
                        <label for="browse_format_select">Card Format:</label>
                        <select id="browse_format_select">
                            <option value="">All Formats</option>
                            <option value="Target to Native">Target to Native</option>
                            <option value="Native to Target">Native to Target</option>
                        </select>
                    </div>
                    
                    <div class="filter-group">
                        <label for="browse_sort_select">Sort By:</label>
                        <select id="browse_sort_select">
                            <option value="card_id">Card ID</option>
                            <option value="time_due">Due Date</option>
                            <option value="interval">Interval</option>
                            <option value="retrievability">Retrievability</option>
                            <option value="created">Created Date</option>
                            <option value="deck">Deck</option>
                            <option value="card_format">Format</option>
                        </select>
                    </div>
                    
                    <div class="filter-group">
                        <label for="browse_direction_select">Direction:</label>
                        <select id="browse_direction_select">
                            <option value="asc">Ascending</option>
                            <option value="desc">Descending</option>
                        </select>
                    </div>
                    
                    <div class="filter-group">
                        <label for="browse_limit_input">Results per page:</label>
                        <select id="browse_limit_input">
                            <option value="25">25</option>
                            <option value="50" selected>50</option>
                            <option value="100">100</option>
                            <option value="200">200</option>
                        </select>
                    </div>
                </div>
                
                <div class="filter-actions">
                    <button id="browse_search_btn" class="btn">Search Cards</button>
                    <button id="browse_clear_btn" class="btn btn-secondary">Clear Filters</button>
                </div>
            </div>
        </div>
        
        <div id="browse_results_info" class="results-info"></div>
        <div id="browse_results" class="browse-results"></div>
        <div id="browse_pagination" class="pagination"></div>
    `;

    // Add event listeners
    const searchButton = document.getElementById('browse_search_btn') as HTMLButtonElement;
    const clearButton = document.getElementById('browse_clear_btn') as HTMLButtonElement;
    const searchInput = document.getElementById('browse_search_input') as HTMLInputElement;
    const sortSelect = document.getElementById('browse_sort_select') as HTMLSelectElement;
    const directionSelect = document.getElementById('browse_direction_select') as HTMLSelectElement;

    if (searchButton) {
        searchButton.addEventListener('click', () => performCardSearch());
    }

    if (clearButton) {
        clearButton.addEventListener('click', clearFilters);
    }

    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                performCardSearch();
            }
        });
    }

    // Add event listeners for sort changes
    if (sortSelect) {
        sortSelect.addEventListener('change', () => performCardSearch(0));
    }

    if (directionSelect) {
        directionSelect.addEventListener('change', () => performCardSearch(0));
    }

    // Load initial cards
    performCardSearch();
}



// Replace the displayBrowseResults function with this spreadsheet-style version
function displayBrowseResults(cards: CardDue[], totalCount: number): void {
    const resultsDiv = document.getElementById('browse_results') as HTMLDivElement;
    if (!resultsDiv) return;

    if (cards.length === 0) {
        resultsDiv.innerHTML = '<p class="no-results">No cards found matching your search criteria.</p>';
        return;
    }

    // Create spreadsheet-like table
    let html = `
        <div class="card-spreadsheet">
            <table class="card-table">
                <thead>
                    <tr>
                        <th class="sortable" data-sort="card_id">
                            ID 
                            <span class="sort-indicator">${getSortIndicator('card_id')}</span>
                        </th>
                        <th class="sortable" data-sort="deck">
                            Deck
                            <span class="sort-indicator">${getSortIndicator('deck')}</span>
                        </th>
                        <th class="card-content-col">Front</th>
                        <th class="card-content-col">Back</th>
                        <th class="sortable" data-sort="card_format">
                            Format
                            <span class="sort-indicator">${getSortIndicator('card_format')}</span>
                        </th>
                        <th class="sortable" data-sort="time_due">
                            Due Date
                            <span class="sort-indicator">${getSortIndicator('time_due')}</span>
                        </th>
                        <th class="sortable" data-sort="interval">
                            Interval
                            <span class="sort-indicator">${getSortIndicator('interval')}</span>
                        </th>
                        <th class="sortable" data-sort="retrievability">
                            Retrievability
                            <span class="sort-indicator">${getSortIndicator('retrievability')}</span>
                        </th>
                        <th class="actions-col">Actions</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    cards.forEach((card) => {
        const dueDate = new Date(card.time_due);
        const now = new Date();
        const isOverdue = dueDate < now;
        const dueDateClass = isOverdue ? 'overdue' : (dueDate <= new Date(now.getTime() + 24 * 60 * 60 * 1000) ? 'due-soon' : 'upcoming');

        // Generate preview of both sides of the card
        const frontText = generateCardFrontLine(card);
        const backText = generateCardBackLine(card);

        // Format due date for display
        const dueDateDisplay = dueDate.toLocaleDateString() + ' ' + dueDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        // Retrievability as percentage with color coding
        const retrievabilityPercent = (card.retrievability * 100).toFixed(1);
        const retrievabilityClass = getRetrievabilityClass(card.retrievability);

        html += `
            <tr class="card-row ${dueDateClass}" data-card-id="${card.card_id}">
                <td class="card-id-cell">
                    <span class="card-id-number">${card.card_id}</span>
                </td>
                <td class="deck-cell">
                    <span class="deck-badge">${card.deck}</span>
                </td>
                <td class="content-cell front-cell">
                    <div class="content-preview" title="${escapeHtml(frontText)}">
                        ${truncateText(processHTMLContent(frontText), 50)}
                    </div>
                </td>
                <td class="content-cell back-cell">
                    <div class="content-preview" title="${escapeHtml(backText)}">
                        ${truncateText(processHTMLContent(backText), 50)}
                    </div>
                </td>
                <td class="format-cell">
                    <span class="format-badge">${getFormatAbbreviation(card.card_format)}</span>
                </td>
                <td class="due-date-cell ${dueDateClass}">
                    <div class="due-date-display">
                        <div class="due-date">${dueDate.toLocaleDateString()}</div>
                        <div class="due-time">${dueDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                        ${isOverdue ? '<span class="overdue-badge">OVERDUE</span>' : ''}
                    </div>
                </td>
                <td class="interval-cell">
                    <span class="interval-badge">${card.interval}d</span>
                </td>
                <td class="retrievability-cell">
                    <div class="retrievability-display ${retrievabilityClass}">
                        <div class="retrievability-bar">
                            <div class="retrievability-fill" style="width: ${retrievabilityPercent}%"></div>
                        </div>
                        <span class="retrievability-text">${retrievabilityPercent}%</span>
                    </div>
                </td>
                <td class="actions-cell">
                    <div class="action-buttons">
                        <button class="btn btn-small edit-card-btn" data-card-id="${card.card_id}" title="Edit card">
                            ✏️
                        </button>
                        <button class="btn btn-small delete-card-btn" data-card-id="${card.card_id}" title="Delete card">
                            🗑️
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });
    
    html += `
                </tbody>
            </table>
        </div>
    `;
    
    resultsDiv.innerHTML = html;

    // Add event listeners to action buttons and sortable headers
    setupCardActionButtons();
    setupSortableHeaders();
}


// Helper functions for the spreadsheet display
function getSortIndicator(column: string): string {
    const currentSort = currentBrowseFilters.sortBy;
    const currentDirection = currentBrowseFilters.sortDirection;
    
    if (currentSort === column) {
        return currentDirection === 'asc' ? '↑' : '↓';
    }
    return '↕️';
}

function getRetrievabilityClass(retrievability: number): string {
    if (retrievability >= 0.9) return 'high';
    if (retrievability >= 0.7) return 'medium';
    if (retrievability >= 0.5) return 'low';
    return 'very-low';
}

function getFormatAbbreviation(format: string): string {
    switch (format) {
        case 'Target to Native': return 'T→N';
        case 'Native to Target': return 'N→T';
        default: return format.substring(0, 3);
    }
}

function truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Setup sortable headers
function setupSortableHeaders(): void {
    const sortableHeaders = document.querySelectorAll('.sortable');
    
    sortableHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const sortBy = header.getAttribute('data-sort');
            if (!sortBy) return;
            
            // Toggle direction if same column, otherwise default to asc
            let newDirection: 'asc' | 'desc' = 'asc';
            if (currentBrowseFilters.sortBy === sortBy && currentBrowseFilters.sortDirection === 'asc') {
                newDirection = 'desc';
            }
            
            // Update the sort select elements to match
            const sortSelect = document.getElementById('browse_sort_select') as HTMLSelectElement;
            const directionSelect = document.getElementById('browse_direction_select') as HTMLSelectElement;
            
            if (sortSelect) sortSelect.value = sortBy;
            if (directionSelect) directionSelect.value = newDirection;
            
            // Perform the search with new sorting
            performCardSearch(0);
        });
    });
}



// Perform card search function
async function performCardSearch(page: number = 0): Promise<void> {
    const deckSelect = document.getElementById('browse_deck_select') as HTMLSelectElement;
    const searchInput = document.getElementById('browse_search_input') as HTMLInputElement;
    const formatSelect = document.getElementById('browse_format_select') as HTMLSelectElement;
    const sortSelect = document.getElementById('browse_sort_select') as HTMLSelectElement;
    const directionSelect = document.getElementById('browse_direction_select') as HTMLSelectElement;
    const limitSelect = document.getElementById('browse_limit_input') as HTMLSelectElement;

    const limit = parseInt(limitSelect?.value || '50');
    const offset = page * limit;

    currentBrowseFilters = {
        deck: deckSelect?.value || undefined,
        searchTerm: searchInput?.value.trim() || undefined,
        cardFormat: formatSelect?.value || undefined,
        sortBy: sortSelect?.value || 'card_id',
        sortDirection: (directionSelect?.value as 'asc' | 'desc') || 'asc',
        limit: limit,
        offset: offset
    };

    currentBrowsePage = page;

    // Show loading state
    const resultsDiv = document.getElementById('browse_results') as HTMLDivElement;
    const infoDiv = document.getElementById('browse_results_info') as HTMLDivElement;
    
    if (resultsDiv) resultsDiv.innerHTML = '<p class="loading">Loading cards...</p>';
    if (infoDiv) infoDiv.innerHTML = '';

    try {
        const result = await browseCards(currentBrowseFilters);
        
        if (result.status === 'success' && result.cards) {
            displayBrowseResults(result.cards, result.total_count || 0);
            updatePagination(result.total_count || 0, limit, page);
            updateResultsInfo(result.total_count || 0, offset, limit, result.filters_applied);
        } else {
            if (resultsDiv) {
                resultsDiv.innerHTML = `<p class="error">Error: ${result.error}</p>`;
            }
        }
    } catch (error) {
        console.error('Error performing card search:', error);
        if (resultsDiv) {
            resultsDiv.innerHTML = '<p class="error">Network error occurred</p>';
        }
    }
}

// Generate the back side of a card
function generateCardBackLine(card: CardDue): string {
    let targetIndex = 0;
    
    // Flip the index for back side
    if (card.card_format === "Native to Target") {
        targetIndex = 1; 
    }
    
    let targetField = card.field_values[targetIndex];
    let targetProcessing = card.field_processing[targetIndex];
    
    let processedField = cleanFieldDatum(targetField, targetProcessing);
    return processedField;
}

// Setup action buttons for each card
function setupCardActionButtons(): void {
    const editButtons = document.querySelectorAll('.edit-card-btn');
    const deleteButtons = document.querySelectorAll('.delete-card-btn');

    editButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const cardId = (e.target as HTMLElement).getAttribute('data-card-id');
            if (cardId) {
                editCard(parseInt(cardId));
            }
        });
    });

    deleteButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const cardId = (e.target as HTMLElement).getAttribute('data-card-id');
            if (cardId) {
                deleteCard(parseInt(cardId));
            }
        });
    });
}

// Update pagination controls
function updatePagination(totalCount: number, limit: number, currentPage: number): void {
    const paginationDiv = document.getElementById('browse_pagination') as HTMLDivElement;
    if (!paginationDiv) return;

    const totalPages = Math.ceil(totalCount / limit);
    
    if (totalPages <= 1) {
        paginationDiv.innerHTML = '';
        return;
    }

    let html = '<div class="pagination-controls">';
    
    // Previous button
    if (currentPage > 0) {
        html += `<button class="btn btn-pagination" onclick="performCardSearch(${currentPage - 1})">« Previous</button>`;
    }
    
    // Page numbers
    const startPage = Math.max(0, currentPage - 2);
    const endPage = Math.min(totalPages - 1, currentPage + 2);
    
    if (startPage > 0) {
        html += `<button class="btn btn-pagination" onclick="performCardSearch(0)">1</button>`;
        if (startPage > 1) {
            html += '<span class="pagination-ellipsis">...</span>';
        }
    }
    
    for (let i = startPage; i <= endPage; i++) {
        const isActive = i === currentPage ? 'active' : '';
        html += `<button class="btn btn-pagination ${isActive}" onclick="performCardSearch(${i})">${i + 1}</button>`;
    }
    
    if (endPage < totalPages - 1) {
        if (endPage < totalPages - 2) {
            html += '<span class="pagination-ellipsis">...</span>';
        }
        html += `<button class="btn btn-pagination" onclick="performCardSearch(${totalPages - 1})">${totalPages}</button>`;
    }
    
    // Next button
    if (currentPage < totalPages - 1) {
        html += `<button class="btn btn-pagination" onclick="performCardSearch(${currentPage + 1})">Next »</button>`;
    }
    
    html += '</div>';
    paginationDiv.innerHTML = html;
}

// Add interface for filters applied
interface FiltersApplied {
    deck?: string;
    search_term?: string;
    card_format?: string;
    sort_by?: string;
    sort_direction?: string;
}

// Update results info
function updateResultsInfo(totalCount: number, offset: number, limit: number, filtersApplied?: FiltersApplied): void {
    const infoDiv = document.getElementById('browse_results_info') as HTMLDivElement;
    if (!infoDiv) return;

    const startIndex = offset + 1;
    const endIndex = Math.min(offset + limit, totalCount);
    
    let infoText = `Showing ${startIndex}-${endIndex} of ${totalCount} cards`;
    
    if (filtersApplied) {
        const activeFilters: string[] = [];
        if (filtersApplied.deck) activeFilters.push(`deck: ${filtersApplied.deck}`);
        if (filtersApplied.search_term) activeFilters.push(`search: "${filtersApplied.search_term}"`);
        if (filtersApplied.card_format) activeFilters.push(`format: ${filtersApplied.card_format}`);
        
        if (activeFilters.length > 0) {
            infoText += ` (filtered by ${activeFilters.join(', ')})`;
        }
    }
    
    infoDiv.innerHTML = `<p class="results-info-text">${infoText}</p>`;
}

// Clear all filters
function clearFilters(): void {
    const deckSelect = document.getElementById('browse_deck_select') as HTMLSelectElement;
    const searchInput = document.getElementById('browse_search_input') as HTMLInputElement;
    const formatSelect = document.getElementById('browse_format_select') as HTMLSelectElement;
    const sortSelect = document.getElementById('browse_sort_select') as HTMLSelectElement;
    const directionSelect = document.getElementById('browse_direction_select') as HTMLSelectElement;
    const limitSelect = document.getElementById('browse_limit_input') as HTMLSelectElement;

    if (deckSelect) deckSelect.value = '';
    if (searchInput) searchInput.value = '';
    if (formatSelect) formatSelect.value = '';
    if (sortSelect) sortSelect.value = 'card_id';
    if (directionSelect) directionSelect.value = 'asc';
    if (limitSelect) limitSelect.value = '50';

    // Perform search with cleared filters
    performCardSearch(0);
}

// API functions for card management
async function deleteCardById(cardId: number): Promise<boolean> {
    try {
        const response = await fetch(`/card/${cardId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        
        if (result.status === 'success') {
            console.log(`✅ Successfully deleted card ${cardId}`);
            return true;
        } else {
            console.error('❌ Error deleting card:', result.error);
            return false;
        }
    } catch (error) {
        console.error('❌ Network error deleting card:', error);
        return false;
    }
}

// Placeholder functions for card actions (enhanced)
function editCard(cardId: number): void {
    // For now, show a simple prompt for editing
    const newContent = prompt(`Edit card ${cardId} content (feature coming soon!):`);
    if (newContent !== null) {
        alert(`Edit card ${cardId} with content: "${newContent}" - Full editing feature coming soon!`);
        // TODO: Implement full card editing modal/form
    }
}

async function deleteCard(cardId: number): Promise<void> {
    if (confirm(`Are you sure you want to delete card ${cardId}? This action cannot be undone.`)) {
        const success = await deleteCardById(cardId);
        
        if (success) {
            alert(`Card ${cardId} deleted successfully!`);
            // Refresh the current view
            performCardSearch(currentBrowsePage);
        } else {
            alert(`Failed to delete card ${cardId}. Please try again.`);
        }
    }
}

// Make performCardSearch available globally for pagination onclick handlers
declare global {
    interface Window {
        performCardSearch: (page: number) => Promise<void>;
    }
}

window.performCardSearch = performCardSearch;


// Interface for retrievability statistics
interface RetrievabilityStats {
    status: 'success' | 'error';
    deck_statistics?: Array<{
        deck: string;
        total_cards: number;
        avg_retrievability: number;
        min_retrievability: number;
        max_retrievability: number;
        cards_below_50_percent: number;
        cards_below_80_percent: number;
        cards_above_90_percent: number;
    }>;
    overall_statistics?: {
        total_cards: number;
        avg_retrievability: number;
        stddev_retrievability: number;
        min_retrievability: number;
        max_retrievability: number;
    };
    timestamp?: string;
    error?: string;
}


// Function to manually trigger retrievability update
async function triggerRetrievabilityUpdate(): Promise<boolean> {
    try {
        console.log('🔄 Triggering manual retrievability update...');
        
        const response = await fetch('/update_retrievability', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        
        if (result.status === 'success') {
            console.log(`✅ Retrievability update completed in ${result.duration_seconds.toFixed(2)} seconds`);
            return true;
        } else {
            console.error('❌ Error updating retrievability:', result.error);
            return false;
        }
    } catch (error) {
        console.error('❌ Network error updating retrievability:', error);
        return false;
    }
}

// Function to get retrievability statistics
async function getRetrievabilityStatistics(): Promise<RetrievabilityStats> {
    try {
        const response = await fetch('/retrievability_stats', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result: RetrievabilityStats = await response.json();
        console.log('📊 Retrieved retrievability statistics:', result);
        
        return result;
    } catch (error) {
        console.error('❌ Error getting retrievability statistics:', error);
        return { 
            status: 'error', 
            error: 'Network error getting retrievability statistics' 
        };
    }
}

// Function to display retrievability statistics in a nice format
function displayRetrievabilityStats(stats: RetrievabilityStats, containerId: string): void {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (stats.status === 'error') {
        container.innerHTML = `<p class="error">Error: ${stats.error}</p>`;
        return;
    }

    if (!stats.deck_statistics || !stats.overall_statistics) {
        container.innerHTML = '<p class="error">No statistics available</p>';
        return;
    }

    let html = `
        <div class="retrievability-stats">
            <h3>📊 Retrievability Statistics</h3>
            <p class="timestamp">Updated: ${new Date(stats.timestamp || '').toLocaleString()}</p>
            
            <div class="overall-stats">
                <h4>🌐 Overall Statistics</h4>
                <div class="stats-grid">
                    <div class="stat-item">
                        <span class="stat-label">Total Cards:</span>
                        <span class="stat-value">${stats.overall_statistics.total_cards}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Average Retrievability:</span>
                        <span class="stat-value">${(stats.overall_statistics.avg_retrievability * 100).toFixed(1)}%</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Range:</span>
                        <span class="stat-value">
                            ${(stats.overall_statistics.min_retrievability * 100).toFixed(1)}% - 
                            ${(stats.overall_statistics.max_retrievability * 100).toFixed(1)}%
                        </span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Standard Deviation:</span>
                        <span class="stat-value">${(stats.overall_statistics.stddev_retrievability * 100).toFixed(1)}%</span>
                    </div>
                </div>
            </div>
            
            <div class="deck-stats">
                <h4>🃏 Statistics by Deck</h4>
    `;

    stats.deck_statistics.forEach(deck => {
        const belowFiftyPercent = ((deck.cards_below_50_percent / deck.total_cards) * 100).toFixed(1);
        const belowEightyPercent = ((deck.cards_below_80_percent / deck.total_cards) * 100).toFixed(1);
        const aboveNinetyPercent = ((deck.cards_above_90_percent / deck.total_cards) * 100).toFixed(1);
        
        html += `
            <div class="deck-stat-item">
                <h5>${deck.deck}</h5>
                <div class="deck-stats-grid">
                    <div class="stat-row">
                        <span class="stat-label">Total Cards:</span>
                        <span class="stat-value">${deck.total_cards}</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">Average Retrievability:</span>
                        <span class="stat-value">${(deck.avg_retrievability * 100).toFixed(1)}%</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">Range:</span>
                        <span class="stat-value">
                            ${(deck.min_retrievability * 100).toFixed(1)}% - 
                            ${(deck.max_retrievability * 100).toFixed(1)}%
                        </span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">Cards < 50%:</span>
                        <span class="stat-value danger">${deck.cards_below_50_percent} (${belowFiftyPercent}%)</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">Cards < 80%:</span>
                        <span class="stat-value warning">${deck.cards_below_80_percent} (${belowEightyPercent}%)</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">Cards ≥ 90%:</span>
                        <span class="stat-value success">${deck.cards_above_90_percent} (${aboveNinetyPercent}%)</span>
                    </div>
                </div>
            </div>
        `;
    });

    html += `
            </div>
        </div>
    `;

    container.innerHTML = html;
}

// Add retrievability management section to one of your tabs
function addRetrievabilityManagementSection(): void {
    // You can add this to any existing tab or create a new one
    // For example, add it to the "Check Your Work" tab
    const checkTab = document.getElementById('check_mainDiv');
    if (!checkTab) return;

    // Add the section after existing content
    const retrievabilitySection = document.createElement('div');
    retrievabilitySection.className = 'retrievability-management';
    retrievabilitySection.innerHTML = `
        <div style="margin-top: 40px; border-top: 2px solid #dee2e6; padding-top: 20px;">
            <h3>📈 Retrievability Management</h3>
            <p>Monitor and update card retrievability values based on FSRS calculations.</p>
            
            <div class="retrievability-controls">
                <button id="updateRetrievabilityBtn" class="btn">🔄 Update All Retrievability</button>
                <button id="showRetrievabilityStatsBtn" class="btn btn-secondary">📊 Show Statistics</button>
            </div>
            
            <div id="retrievabilityStatsContainer" class="retrievability-stats-container"></div>
        </div>
    `;

    checkTab.appendChild(retrievabilitySection);

    // Add event listeners
    const updateBtn = document.getElementById('updateRetrievabilityBtn') as HTMLButtonElement;
    const statsBtn = document.getElementById('showRetrievabilityStatsBtn') as HTMLButtonElement;

    if (updateBtn) {
        updateBtn.addEventListener('click', async () => {
            updateBtn.textContent = '⏳ Updating...';
            updateBtn.disabled = true;

            const success = await triggerRetrievabilityUpdate();
            
            if (success) {
                updateBtn.textContent = '✅ Updated!';
                // Automatically show updated stats
                setTimeout(async () => {
                    const stats = await getRetrievabilityStatistics();
                    displayRetrievabilityStats(stats, 'retrievabilityStatsContainer');
                }, 1000);
            } else {
                updateBtn.textContent = '❌ Failed';
            }

            // Reset button after 3 seconds
            setTimeout(() => {
                updateBtn.textContent = '🔄 Update All Retrievability';
                updateBtn.disabled = false;
            }, 3000);
        });
    }

    if (statsBtn) {
        statsBtn.addEventListener('click', async () => {
            statsBtn.textContent = '⏳ Loading...';
            statsBtn.disabled = true;

            const stats = await getRetrievabilityStatistics();
            displayRetrievabilityStats(stats, 'retrievabilityStatsContainer');

            statsBtn.textContent = '📊 Show Statistics';
            statsBtn.disabled = false;
        });
    }
}

// Add this to your initialization code
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        // Your existing initialization code...
        addRetrievabilityManagementSection();
    });
} else {
    // DOM is already loaded
    addRetrievabilityManagementSection();
}