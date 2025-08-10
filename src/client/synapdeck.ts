import {transliterateGeez} from './transcribe_geez.js';
import {OneWayCard, TwoWayCard, arrayBufferToBase64, prepareTextForPDF, testCharacterRendering, loadGentiumForCanvas, renderTextToCanvas} from './synapdeck_lib.js'
let outputDiv = document.getElementById("upload_output") as HTMLDivElement;
declare global {
    interface Window {
        jsPDF: any;
    }
}

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
            }
        });
    });
    setupReviewAheadUI();
}


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


// Modified submit button event listener
uploadSubmitButton.addEventListener('click', async () => {
    console.log('Submit button clicked');

    const timestampCreated = new Date(Date.now()).toISOString();
    
    let wipeDatabaseCheckmark = document.getElementById("wipeDatabaseCheckbox");
    if (wipeDatabaseCheckmark && (wipeDatabaseCheckmark as HTMLInputElement).checked) {
        console.log('Wiping database before processing...');
        const wipeSuccess = await wipeSynapdeckDatabase();
        if (!wipeSuccess) {
            console.error('Failed to wipe database, aborting');
            return;
        }
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

function generateReviewSheetHTML(cards: CardDue[]): string {
    const today = new Date().toLocaleDateString();
    
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
                
                .card-item {
                    margin-bottom: 35px;
                    page-break-inside: avoid;
                    break-inside: avoid;
                }
                
                .card-question {
                    font-size: 14px;
                    margin-bottom: 15px;
                    font-weight: normal;
                    line-height: 1.5;
                }
                
                .card-question strong {
                    font-weight: bold;
                }
                
                .answer-lines {
                    margin-left: 20px;
                }
                
                .answer-line {
                    border-bottom: 1px solid #999;
                    height: 25px;
                    margin-bottom: 10px;
                    width: calc(100% - 20px);
                }
                
                .controls {
                    position: fixed;
                    top: 10px;
                    right: 10px;
                    background: rgba(255, 255, 255, 0.95);
                    padding: 10px;
                    border-radius: 5px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    border: 1px solid #ddd;
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
                
                @media print {
                    .controls {
                        display: none !important;
                    }
                    
                    body {
                        font-size: 12pt;
                        max-width: none;
                        margin: 0;
                        padding: 0.5in;
                    }
                    
                    .card-item {
                        page-break-inside: avoid;
                        break-inside: avoid;
                    }
                    
                    .answer-line {
                        border-bottom: 1px solid #333;
                    }
                }
            </style>
        </head>
        <body>
            <div class="controls">
                <button class="btn" onclick="window.print()">📄 Save as PDF</button>
                <button class="btn" onclick="window.close()">✕ Close</button>
            </div>
            
            <div class="header">
                <div class="title">Card Review Sheet</div>
                <div class="date">Generated: ${today}</div>
                <div class="summary">Total Cards: ${cards.length}</div>
            </div>
            
            <div class="section-title">Cards Due for Review:</div>
            
            <div class="cards-container">
                ${cards.map((card, index) => generateCardHTML(card, index + 1)).join('')}
            </div>
            
            <script>
                // Ensure fonts are loaded before any operations
                document.fonts.ready.then(() => {
                    console.log('✅ All fonts loaded');
                });
                
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
        
        // Create a more sophisticated approach that only escapes dangerous content
        // while preserving allowed HTML tags
        
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
                    .replace(/&(?!(?:amp|lt|gt|quot|apos);)/g, '&amp;') // Only escape & if not already an entity
                    .replace(/</g, '&lt;')  // Escape standalone < 
                    .replace(/>/g, '&gt;'); // Escape standalone >
            }
        });
        
        return processedParts.join('');
    }
    
    const processedText = processHTMLContent(frontSideLine);
    
    return `
        <div class="card-item">
            <div class="card-question">
                ${cardNumber}. ${processedText} :
            </div>
        </div>
    `;
}


// Most elegant: Direct PDF viewer integration
async function produceCardReviewSheetPDFViewer(cards: CardDue[]) {
    try {
        // Generate the HTML
        const htmlContent = generateReviewSheetHTML(cards);
        
        // Create blob and URL
        const blob = new Blob([htmlContent], { type: 'text/html' });
        const blobUrl = URL.createObjectURL(blob);
        
        // Open in new tab with specific dimensions for PDF-like viewing
        const pdfTab = window.open(blobUrl, '_blank');
        
        if (pdfTab) {
            // Add event listener to handle PDF generation when ready
            pdfTab.addEventListener('load', () => {
                // Wait for fonts and then focus
                setTimeout(() => {
                    pdfTab.focus();
                    
                    // Optional: Automatically open print dialog
                    // pdfTab.print();
                }, 1500);
            });
            
            // Update the tab title
            pdfTab.addEventListener('load', () => {
                if (pdfTab.document) {
                    pdfTab.document.title = 'Card Review Sheet - ' + new Date().toLocaleDateString();
                }
            });
        }
        
        if (pdfTab) {
            // Add event listener to handle PDF generation when ready
            pdfTab.addEventListener('load', () => {
                // Wait for fonts and then focus
                setTimeout(() => {
                    pdfTab.focus();
                    
                    // Optional: Automatically open print dialog
                    // pdfTab.print();
                }, 1500);
            });
            
            // Update the tab title
            pdfTab.addEventListener('load', () => {
                if (pdfTab.document) {
                    pdfTab.document.title = 'Card Review Sheet - ' + new Date().toLocaleDateString();
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

                let doc = produceCardReviewSheetPDFViewer(cardsToReview);

                
                
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