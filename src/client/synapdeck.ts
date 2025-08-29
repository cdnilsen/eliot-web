import {transliterateGeez, GeezDiacriticify, geezSpecialChars} from './transcribe_geez.js';
import {transliterateGreek} from './transcribe_ancient_greek.js';
import {SanskritDiacriticify} from './transcribe_sanskrit.js';
import {AkkadianDiacriticify, akkadianSpecialChars} from './transcribe_akkadian.js';
import {OneWayCard, TwoWayCard, arrayBufferToBase64, prepareTextForPDF, testCharacterRendering, loadGentiumForCanvas, renderTextToCanvas} from './synapdeck_lib.js'
import {hebrewSpecialChars, transliterateHebrew} from './transcribe_hebrew.js'
let outputDiv = document.getElementById("upload_output") as HTMLDivElement;

interface CardFieldData {
    card_id: number;
    note_id: number;
    field_names: string[];
    field_values: string[];
    field_processing: string[];
    deck?: string;
    card_format?: string;
}

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
    "Hebrew": hebrewSpecialChars || []
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
function cleanFieldDatum(datum: string, process: string, isBackOfCard: boolean) {
    switch (process) {
        case "Ge'ez":
            return transliterateGeez(datum, isBackOfCard);
        case "Hebrew":
            return transliterateHebrew(datum, true)
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

    let targetField = card.field_values[targetIndex];
    let targetProcessing = card.field_processing[targetIndex];
    let processedField = cleanFieldDatum(targetField, targetProcessing, false);
    return processedField;
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

                if (reviewAheadNumCards) {
                    reviewAheadNumCards.addEventListener('change', function(e) {
                        if (cachedCardResults && cachedCardResults.status === 'success' && cachedCardResults.cards) {
                            const numCards = parseInt(reviewAheadNumCards.value);
                            const reviewAheadCheckbox = document.getElementById('reviewAheadCheckbox') as HTMLInputElement;
                            const reviewAheadHours = document.getElementById('reviewAheadHours') as HTMLSelectElement;
                            const currentReviewAhead = reviewAheadCheckbox?.checked || false;
                            const currentHoursAhead = currentReviewAhead ? parseInt(reviewAheadHours?.value || '24') : 0;
                            
                            updateSubmitButtonText(numCards, cachedCardResults.cards.length, currentReviewAhead, currentHoursAhead);
                        }
                    });
                }

                
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


let reviewSubmitButtonClicked: boolean = false;
if (reviewSubmitButton) {
    reviewSubmitButton.addEventListener('click', async () => {
        if (!selectedReviewDeck) {
            const outputDiv = document.getElementById("check_output") as HTMLDivElement;
            if (outputDiv) {
                outputDiv.innerHTML = `<p class="error">Please select a deck first.</p>`;
            }
            return;
        }

        if (reviewSubmitButtonClicked) {
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
            reviewSubmitButtonClicked = true;
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
        const selectedRadio = item.querySelector('input[type="radio"]:checked') as HTMLInputElement;
        
        
        if (cardId && selectedRadio) {
            results.push({
                cardId: cardId,
                result: selectedRadio.value
            });
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
            answerText = cleanFieldDatum(targetBack || '', targetProcessing || '', true);
        } else {
            // If question shows target (index 0), answer is native (index 1)  
            answerText = cleanFieldDatum(nativeBack || '', nativeProcessing || '', true);
        }

        // Process HTML in both question and answer
        const processedQuestion = processHTMLContent(questionText);
        const processedAnswer = processHTMLContent(answerText);

        console.log(`Card ${card.card_id}: Q="${processedQuestion}" A="${processedAnswer}"`);
        
        html += `
            <div class="answer-row" data-card-id="${card.card_id}">
                <div class="qa-cell">${index + 1}. ${processedQuestion} → ${processedAnswer}</div>
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
    const resetDeckBtn = document.createElement('button');
    resetDeckBtn.textContent = 'Reset This Deck';
    resetDeckBtn.addEventListener('click', async () => {
        const selectedDeck = checkDeckDropdown.value;
        if (selectedDeck) {
            await resetDeckCardsUnderReview(selectedDeck);
        }
    })
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
                            <option value="Ancient Greek">Ancient Greek</option>
                            <option value="Sanskrit">Sanskrit</option>
                            <option value="Akkadian">Akkadian</option>
                            <option value="Hebrew">Hebrew</option>
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
    if (card.field_values.length >= 3 && card.field_values[2].trim() != "") {
            targetIndex = 2;
        }
    
    // Flip the index for back side
    if (card.card_format === "Target to Native") {
        targetIndex = 1; 
        if (card.field_values.length >= 4 && card.field_values[3].trim() != "") {
            targetIndex = 3;
        }
    }

    
    let targetField = card.field_values[targetIndex];
    let targetProcessing = card.field_processing[targetIndex];
    
    let processedField = cleanFieldDatum(targetField, targetProcessing, true);
    return processedField;
}

// Setup action buttons for each card

// 2. Fixed setupCardActionButtons function with proper type assertions
function setupCardActionButtons(): void {
    const resultsDiv = document.getElementById('browse_results');
    if (!resultsDiv) {
        console.error('Browse results div not found');
        return;
    }

    // Use event delegation with proper typing
    resultsDiv.addEventListener('click', async (event: MouseEvent) => {
        const target = event.target as HTMLElement;
        
        // Handle edit button clicks
        if (target.classList.contains('edit-card-btn') || target.closest('.edit-card-btn')) {
            event.preventDefault();
            event.stopPropagation();
            
            const button = target.classList.contains('edit-card-btn') ? target : target.closest('.edit-card-btn') as HTMLElement;
            const cardId = button?.getAttribute('data-card-id');
            
            if (cardId) {
                console.log(`Edit button clicked for card ${cardId}`);
                await editCard(parseInt(cardId));
            } else {
                console.error('No card ID found for edit button');
            }
        }
        
        // Handle delete button clicks
        else if (target.classList.contains('delete-card-btn') || target.closest('.delete-card-btn')) {
            event.preventDefault();
            event.stopPropagation();
            
            const button = target.classList.contains('delete-card-btn') ? target : target.closest('.delete-card-btn') as HTMLElement;
            const cardId = button?.getAttribute('data-card-id');
            
            if (cardId) {
                console.log(`Delete button clicked for card ${cardId}`);
                await deleteCard(parseInt(cardId));
            } else {
                console.error('No card ID found for delete button');
            }
        }
    });

    // Log button count for debugging
    const editButtons = resultsDiv.querySelectorAll('.edit-card-btn');
    const deleteButtons = resultsDiv.querySelectorAll('.delete-card-btn');
    console.log(`Set up action handlers for ${editButtons.length} edit buttons and ${deleteButtons.length} delete buttons`);
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


async function editCard(cardId: number): Promise<void> {
    console.log(`✏️ Opening enhanced editor for card ${cardId}`);

    try {
        // Show loading state first
        showLoadingModal(`Loading card ${cardId}...`);

        // Get card field details
        const response = await fetch(`/card/${cardId}/fields`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await getCardFields(cardId);

        if (result.status === 'success' && result.card) {
            // Get full card details for deck and format info
            const fullCardResponse = await fetch(`/card/${cardId}`);
            const fullCardResult = await fullCardResponse.json();
            
            const cardData = {
                ...result.card,
                deck: fullCardResult.card?.deck || 'Unknown',
                card_format: fullCardResult.card?.card_format || 'Unknown'
            };
            
            // Close loading modal and show edit modal
            closeEditModal();
            showCardEditModal(cardId, cardData);
        } else {
            throw new Error(result.error || 'Failed to load card data');
        }

    } catch (error) {
        console.error('Error loading card for editing:', error);
        closeEditModal();
        showToast(`Failed to load card ${cardId}: ${error.message}`, 'error');
    }
}
// Add this loading modal function to your synapdeck.ts file

function showLoadingModal(message: string): void {
    // Remove any existing modal first
    const existingModal = document.getElementById('cardEditModal');
    if (existingModal) {
        existingModal.remove();
    }

    const modal = document.createElement('div');
    modal.id = 'cardEditModal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
    `;

    const content = document.createElement('div');
    content.style.cssText = `
        background: white;
        padding: 40px;
        border-radius: 12px;
        text-align: center;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
    `;
    content.innerHTML = `
        <div style="font-size: 18px; color: #333; margin-bottom: 20px;">${message}</div>
        <div style="width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #007bff; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto;"></div>
        <style>
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        </style>
    `;

    modal.appendChild(content);
    document.body.appendChild(modal);
}

// Add this toast notification function to your synapdeck.ts file

function showToast(message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info'): void {
    // Remove existing toast
    const existingToast = document.getElementById('edit-toast');
    if (existingToast) {
        existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.id = 'edit-toast';
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 16px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 600;
        font-size: 14px;
        z-index: 10001;
        animation: slideInRight 0.3s ease-out;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        max-width: 400px;
        word-wrap: break-word;
    `;

    // Set color based on type
    const colors = {
        success: '#28a745',
        error: '#dc3545',
        info: '#17a2b8',
        warning: '#ffc107'
    };
    toast.style.background = colors[type] || colors.info;

    toast.textContent = message;
    document.body.appendChild(toast);

    // Auto-remove after 4 seconds
    setTimeout(() => {
        toast.style.animation = 'slideOutRight 0.3s ease-in';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, 4000);

    // Add animations if they don't exist
    if (!document.getElementById('toast-animations')) {
        const style = document.createElement('style');
        style.id = 'toast-animations';
        style.textContent = `
            @keyframes slideInRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOutRight {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
}

// Add this individual field save function to your synapdeck.ts file

async function saveIndividualField(cardId: number, fieldIndex: number, textarea: HTMLTextAreaElement, saveBtn: HTMLButtonElement): Promise<void> {
    const newValue = textarea.value;
    const originalValue = textarea.dataset.originalValue || '';

    if (newValue === originalValue) {
        showToast('No changes to save', 'info');
        return;
    }

    // Show loading state
    saveBtn.disabled = true;
    saveBtn.textContent = '⏳ Saving...';
    saveBtn.style.background = '#ffc107';

    try {
        const response = await fetch(`/card/${cardId}/field/${fieldIndex}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                new_value: newValue
            })
        });

        const result = await response.json();

        if (result.status === 'success') {
            // Update the original value
            textarea.dataset.originalValue = newValue;
            
            // Reset button state
            saveBtn.disabled = true;
            saveBtn.textContent = '✅ Saved!';
            saveBtn.style.background = '#28a745';
            saveBtn.style.opacity = '0.8';

            // Reset after 2 seconds
            setTimeout(() => {
                saveBtn.textContent = '💾 Save Field';
                saveBtn.style.opacity = '0.6';
                saveBtn.style.background = '#6c757d';
            }, 2000);

            showToast(`Field ${fieldIndex + 1} saved successfully!`, 'success');
            
        } else {
            throw new Error(result.error || 'Save failed');
        }

    } catch (error) {
        console.error('Error saving field:', error);
        
        // Reset button state
        saveBtn.disabled = false;
        saveBtn.textContent = '❌ Failed';
        saveBtn.style.background = '#dc3545';

        setTimeout(() => {
            saveBtn.textContent = '💾 Save Field';
            saveBtn.style.background = '#28a745';
        }, 3000);

        showToast(`Failed to save field: ${error.message}`, 'error');
    }
}

// Add this main edit modal function to your synapdeck.ts file

// 1. Fixed showCardEditModal function with proper type assertions
function showCardEditModal(cardId: number, cardData: any): void {
    // Remove any existing modal
    const existingModal = document.getElementById('cardEditModal');
    if (existingModal) {
        existingModal.remove();
    }

    // Create modal backdrop
    const modal = document.createElement('div');
    modal.id = 'cardEditModal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
        animation: fadeIn 0.2s ease-out;
    `;

    // Create modal content
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: white;
        border-radius: 12px;
        width: 90%;
        max-width: 700px;
        max-height: 80vh;
        overflow: hidden;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
        animation: slideIn 0.3s ease-out;
    `;

    // Modal header
    const header = document.createElement('div');
    header.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px 24px;
        border-bottom: 1px solid #e1e5e9;
        background: #f8f9fa;
    `;
    
    const title = document.createElement('h2');
    title.textContent = `Edit Card ${cardId}`;
    title.style.cssText = `
        margin: 0;
        color: #333;
        font-size: 20px;
        font-weight: 600;
    `;
    
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '×';
    closeBtn.style.cssText = `
        background: none;
        border: none;
        font-size: 28px;
        cursor: pointer;
        color: #666;
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 6px;
        transition: all 0.2s;
    `;
    
    // Fixed hover handlers with proper this typing
    closeBtn.addEventListener('mouseover', function(this: HTMLButtonElement) {
        this.style.background = '#e9ecef';
    });
    closeBtn.addEventListener('mouseout', function(this: HTMLButtonElement) {
        this.style.background = 'none';
    });
    closeBtn.addEventListener('click', closeEditModal);

    header.appendChild(title);
    header.appendChild(closeBtn);

    // Modal body
    const body = document.createElement('div');
    body.style.cssText = `
        padding: 24px;
        max-height: 50vh;
        overflow-y: auto;
    `;

    // Create field editors
    const fieldsContainer = document.createElement('div');
    fieldsContainer.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 20px;
    `;

    // Add info section
    const infoSection = document.createElement('div');
    infoSection.style.cssText = `
        background: #f0f8ff;
        padding: 16px;
        border-radius: 8px;
        border: 1px solid #b8daff;
        margin-bottom: 20px;
    `;
    infoSection.innerHTML = `
        <div style="font-weight: 600; color: #0c5460; margin-bottom: 8px;">Card Information</div>
        <div style="font-size: 14px; color: #495057;">
            <strong>Deck:</strong> ${cardData.deck || 'Unknown'}<br>
            <strong>Format:</strong> ${cardData.card_format || 'Unknown'}<br>
            <strong>Card ID:</strong> ${cardId}
        </div>
    `;
    fieldsContainer.appendChild(infoSection);

    // Create editable fields
    cardData.field_values.forEach((value: string, index: number) => {
        const fieldContainer = document.createElement('div');
        fieldContainer.style.cssText = `
            border: 1px solid #dee2e6;
            border-radius: 8px;
            padding: 16px;
            background: white;
            transition: border-color 0.2s;
        `;
        
        // Fixed hover handlers
        fieldContainer.addEventListener('mouseover', function(this: HTMLDivElement) {
            this.style.borderColor = '#80bdff';
        });
        fieldContainer.addEventListener('mouseout', function(this: HTMLDivElement) {
            this.style.borderColor = '#dee2e6';
        });

        // Field label
        const label = document.createElement('div');
        label.style.cssText = `
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 12px;
        `;
        
        const fieldName = document.createElement('span');
        fieldName.textContent = cardData.field_names?.[index] || `Field ${index + 1}`;
        fieldName.style.cssText = `
            font-weight: 600;
            color: #333;
            font-size: 14px;
        `;
        
        const processing = document.createElement('span');
        processing.textContent = `(${cardData.field_processing?.[index] || 'None'})`;
        processing.style.cssText = `
            font-size: 12px;
            color: #6c757d;
            background: #e9ecef;
            padding: 2px 8px;
            border-radius: 12px;
        `;

        label.appendChild(fieldName);
        label.appendChild(processing);

        // Text area
        const textarea = document.createElement('textarea') as HTMLTextAreaElement;
        textarea.value = value || '';
        textarea.style.cssText = `
            width: 100%;
            min-height: 80px;
            padding: 12px;
            border: 1px solid #ced4da;
            border-radius: 6px;
            font-family: 'Gentium Plus', Georgia, serif;
            font-size: 16px;
            line-height: 1.5;
            resize: vertical;
            transition: border-color 0.2s, box-shadow 0.2s;
            box-sizing: border-box;
        `;
        
        // Fixed focus/blur handlers
        textarea.addEventListener('focus', function(this: HTMLTextAreaElement) {
            this.style.borderColor = '#80bdff';
            this.style.boxShadow = '0 0 0 3px rgba(0, 123, 255, 0.25)';
        });
        textarea.addEventListener('blur', function(this: HTMLTextAreaElement) {
            this.style.borderColor = '#ced4da';
            this.style.boxShadow = 'none';
        });

        // Store original value and field index for change detection
        textarea.dataset.originalValue = value || '';
        textarea.dataset.fieldIndex = index.toString();

        // Individual save button
        const saveBtn = document.createElement('button');
        saveBtn.textContent = '💾 Save Field';
        saveBtn.className = 'save-field-btn';
        saveBtn.style.cssText = `
            margin-top: 8px;
            padding: 8px 16px;
            background: #28a745;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 500;
            transition: all 0.2s;
            opacity: 0.6;
        `;
        saveBtn.disabled = true;

        // Auto-resize and change detection - Fixed with proper types
        textarea.addEventListener('input', function(this: HTMLTextAreaElement) {
            // Auto-resize
            this.style.height = 'auto';
            this.style.height = this.scrollHeight + 'px';
            
            // Change detection
            const hasChanged = this.value !== (this.dataset.originalValue || '');
            saveBtn.disabled = !hasChanged;
            saveBtn.style.opacity = hasChanged ? '1' : '0.6';
            saveBtn.style.background = hasChanged ? '#28a745' : '#6c757d';
        });

        saveBtn.addEventListener('click', () => saveIndividualField(cardId, index, textarea, saveBtn));

        fieldContainer.appendChild(label);
        fieldContainer.appendChild(textarea);
        fieldContainer.appendChild(saveBtn);
        fieldsContainer.appendChild(fieldContainer);

        // Initial resize
        setTimeout(() => {
            textarea.style.height = 'auto';
            textarea.style.height = textarea.scrollHeight + 'px';
        }, 100);
    });

    body.appendChild(fieldsContainer);

    // Modal footer
    const footer = document.createElement('div');
    footer.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px 24px;
        border-top: 1px solid #e1e5e9;
        background: #f8f9fa;
        gap: 12px;
    `;

    const saveAllBtn = document.createElement('button');
    saveAllBtn.textContent = '💾 Save All Changes';
    saveAllBtn.style.cssText = `
        padding: 12px 24px;
        background: #007bff;
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 16px;
        font-weight: 600;
        transition: all 0.2s;
        flex: 1;
    `;
    
    // Fixed hover handlers for save button
    saveAllBtn.addEventListener('mouseover', function(this: HTMLButtonElement) {
        this.style.background = '#0056b3';
    });
    saveAllBtn.addEventListener('mouseout', function(this: HTMLButtonElement) {
        this.style.background = '#007bff';
    });
    saveAllBtn.addEventListener('click', () => saveAllFields(cardId));

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = `
        padding: 12px 24px;
        background: #6c757d;
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 16px;
        font-weight: 500;
        transition: all 0.2s;
    `;
    
    // Fixed hover handlers for cancel button
    cancelBtn.addEventListener('mouseover', function(this: HTMLButtonElement) {
        this.style.background = '#545b62';
    });
    cancelBtn.addEventListener('mouseout', function(this: HTMLButtonElement) {
        this.style.background = '#6c757d';
    });
    cancelBtn.addEventListener('click', closeEditModal);

    footer.appendChild(cancelBtn);
    footer.appendChild(saveAllBtn);

    // Assemble modal
    modalContent.appendChild(header);
    modalContent.appendChild(body);
    modalContent.appendChild(footer);
    modal.appendChild(modalContent);

    // Add to page
    document.body.appendChild(modal);

    // Close on backdrop click - Fixed with proper type checking
    modal.addEventListener('click', (e: MouseEvent) => {
        if (e.target === modal) closeEditModal();
    });

    // Add animations if they don't exist
    addModalAnimations();

    console.log(`✅ Edit modal opened for card ${cardId}`);
}

// Add this close modal function to your synapdeck.ts file

function closeEditModal(): void {
    const modal = document.getElementById('cardEditModal');
    if (modal) {
        modal.style.animation = 'fadeOut 0.2s ease-in';
        setTimeout(() => {
            if (modal.parentNode) {
                modal.parentNode.removeChild(modal);
            }
        }, 200);
    }
}

// Also add the fadeOut animation to your existing animations
function addModalAnimations(): void {
    if (!document.getElementById('modal-animations')) {
        const style = document.createElement('style');
        style.id = 'modal-animations';
        style.textContent = `
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes slideIn {
                from { transform: translateY(-20px) scale(0.95); opacity: 0; }
                to { transform: translateY(0) scale(1); opacity: 1; }
            }
            @keyframes fadeOut {
                from { opacity: 1; }
                to { opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
}



// Call this once when your page loads
addModalAnimations();


// API function to get detailed card field data
async function getCardFields(cardId: number): Promise<any> {
    try {
        const response = await fetch(`/card/${cardId}/fields`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Error getting card fields:', error);
        return { 
            status: 'error', 
            error: 'Network error getting card fields' 
        };
    }
}

// API function to update a specific field
async function updateCardField(cardId: number, fieldIndex: number, newValue: string): Promise<any> {
    try {
        const response = await fetch(`/card/${cardId}/field/${fieldIndex}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                new_value: newValue
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Error updating card field:', error);
        return { 
            status: 'error', 
            error: 'Network error updating card field' 
        };
    }
}

// Save all changed fields
// Add this save all fields function to your synapdeck.ts file

async function saveAllFields(cardId: number): Promise<void> {
    const textareas = document.querySelectorAll('#cardEditModal textarea') as NodeListOf<HTMLTextAreaElement>;
    const changedFields: { [key: string]: string } = {};

    // Find changed fields
    textareas.forEach((textarea, index) => {
        const currentValue = textarea.value;
        const originalValue = textarea.dataset.originalValue || '';
        const fieldIndex = textarea.dataset.fieldIndex;
        
        if (currentValue !== originalValue && fieldIndex) {
            changedFields[fieldIndex] = currentValue;
        }
    });

    const changeCount = Object.keys(changedFields).length;
    
    if (changeCount === 0) {
        showToast('No changes to save', 'info');
        return;
    }

    if (!confirm(`Save changes to ${changeCount} field(s)?`)) {
        return;
    }

    // Show loading state
    const saveAllBtn = document.querySelector('#cardEditModal footer button:last-child') as HTMLButtonElement;
    if (!saveAllBtn) return;
    
    const originalText = saveAllBtn.textContent || '';
    saveAllBtn.textContent = '⏳ Saving all changes...';
    saveAllBtn.disabled = true;

    try {
        console.log(`🔄 Bulk updating card ${cardId} with changes:`, changedFields);
        
        // Use your bulk update endpoint
        const response = await fetch(`/card/${cardId}/fields/bulk`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                field_updates: changedFields
            })
        });

        const result = await response.json();
        
        console.log('📊 Bulk update response:', result);

        if (result.status === 'success') {
            // Update all the original values for changed textareas
            if (result.updated_fields) {
                result.updated_fields.forEach((field: any) => {
                    const textarea = document.querySelector(`#cardEditModal textarea[data-field-index="${field.field_index}"]`) as HTMLTextAreaElement;
                    if (textarea) {
                        textarea.dataset.originalValue = field.new_value;
                        
                        // Reset the individual save button for this field
                        const saveBtn = textarea.parentElement?.querySelector('.save-field-btn') as HTMLButtonElement;
                        if (saveBtn) {
                            saveBtn.disabled = true;
                            saveBtn.style.opacity = '0.6';
                            saveBtn.style.background = '#6c757d';
                        }
                    }
                });
            }

            showToast(`✅ Successfully saved ${result.updated_count} field(s)!`, 'success');
            
            // Close modal and refresh if needed
            setTimeout(() => {
                closeEditModal();
                
                // Refresh the card browser if the function exists
                if (typeof performCardSearch === 'function') {
                    performCardSearch(currentBrowsePage || 0);
                }
            }, 1500);
            
        } else {
            throw new Error(result.error || 'Bulk update failed');
        }

    } catch (error) {
        console.error('Error bulk saving fields:', error);
        showToast(`Failed to save fields: ${error.message}`, 'error');
    } finally {
        // Reset button
        saveAllBtn.textContent = originalText;
        saveAllBtn.disabled = false;
    }
}

// Helper function for HTML escaping
function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Make functions globally available
declare global {
    interface Window {
        closeEditModal: () => void;
        saveAllFields: (cardId: number) => Promise<void>;
    }
}

window.closeEditModal = closeEditModal;
window.saveAllFields = saveAllFields;

async function deleteCard(cardId: number): Promise<void> {
    // Enhanced confirmation dialog
    const confirmed = confirm(
        `⚠️ DELETE CARD ${cardId}\n\n` +
        `Are you absolutely sure you want to delete this card?\n\n` +
        `This action cannot be undone!`
    );
    
    if (!confirmed) {
        return;
    }

    try {
        const success = await deleteCardById(cardId);
        
        if (success) {
            // Remove the row from the table immediately for better UX - Fixed type assertion
            const cardRow = document.querySelector(`tr[data-card-id="${cardId}"]`) as HTMLTableRowElement;
            if (cardRow) {
                cardRow.style.transition = 'opacity 0.3s ease';
                cardRow.style.opacity = '0';
                setTimeout(() => {
                    cardRow.remove();
                    updateCardCount();
                }, 300);
            }
            
            showToast(`Card ${cardId} deleted successfully!`, 'success');
        } else {
            showToast(`Failed to delete card ${cardId}. Please try again.`, 'error');
        }
    } catch (error) {
        console.error('Error in deleteCard:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        showToast(`Error deleting card ${cardId}: ${errorMessage}`, 'error');
    }
}

// 4. Fixed helper function
function updateCardCount(): void {
    const remainingRows = document.querySelectorAll('.card-row').length;
    const infoDiv = document.getElementById('browse_results_info');
    if (infoDiv) {
        infoDiv.innerHTML = `<p class="results-info-text">Showing ${remainingRows} cards</p>`;
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
// Add this interface near your other interfaces in synapdeck.ts
interface BulkIntervalUpdateResponse {
    status: 'success' | 'error';
    updated_count?: number;
    total_cards?: number;
    average_old_interval?: number;
    average_new_interval?: number;
    multiplier_used?: number;
    operation_time?: string;
    error?: string;
    details?: string;
}

