import {transliterateGeez, GeezDiacriticify} from './synapdeck_files/transcribe_geez.js';
import {transliterateGreek} from './synapdeck_files/transcribe_ancient_greek.js';
import {transliterateCoptic} from './synapdeck_files/transcribe_coptic.js';
import {ProcessedCard, processCard, arrayBufferToBase64, prepareTextForPDF, testCharacterRendering, loadGentiumForCanvas, renderTextToCanvas} from './synapdeck_files/synapdeck_lib.js'
import {transliterateHebrew} from './synapdeck_files/transcribe_hebrew.js';
import {transliteratePersian} from './synapdeck_files/transcribe_persian.js';
import { initializeUploadTab } from './card_upload.js';
import { CardBrowserDeps, initializeBrowserTab, setupBrowseCardsTab, createCardRelationship } from './card_browser.js';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { createCardRelationshipGraph, CardNode, RelationshipLink } from './CardRelationshipGraph';

import { ReviewForecastData, ReviewForecastOptions, updateDeckSelection, loadReviewForecast, createReviewForecastChart, setupReviewForecastTab } from './synapdeck_files/review_chart.js';
import { addRetrievabilityManagementSection } from './synapdeck_files/retrievability.js';
import { setupStatsTab } from './synapdeck_files/stats_tab.js';

window.loadReviewForecast = loadReviewForecast;
window.setupReviewForecastTab = setupReviewForecastTab;

let deckNameList: string[] = [
    "Akkadian",
    "Ancient Greek",
    "Coptic",
    "Cuneiform",
    "Finnish",
    "Ge'ez",
    "German",
    "Gothic",
    "Hebrew",
    "Hittite",
    "Latin",
    "Lithuanian",
    "Persian",
    "Proto-Algonquian",
    "Russian",
    "Sanskrit",
    "Syriac",
    "Tocharian B"
]

const printFontSizes: { [key: string]: string } = {
    "Ancient Greek": "16px",
    "Hebrew": "18px",
    "Syriac": "18px",
    "Cuneiform": "18px",
    "Ge'ez": "14px",
    "Persian": "18px",
};


// Consolidate all global declarations
declare global {
    interface Window {
        Chart: any;
        loadReviewForecast: (chartData: ReviewForecastOptions) => Promise<void>;
        setupReviewForecastTab: () => void;
        createReviewForecastChart: (data: ReviewForecastData[], decks: string[], chartData: ReviewForecastOptions) => void;



    }
}

window.createReviewForecastChart = createReviewForecastChart;

initializeBrowserTab({ deckNameList, generateCardFrontLine, generateCardBackLine, cleanFieldDatum });

interface ShuffleDueDatesRequest {
    deck: string;
    days_span: number;
    base_date: string;
    include_overdue: boolean;
}

interface ShuffleDueDatesResponse {
    status: 'success' | 'error';
    updated_count?: number;
    total_cards_found?: number;
    deck?: string;
    days_span?: number;
    base_date?: string;
    date_range?: {
        start_date: string;
        end_date: string;
    };
    operation_time?: string;
    average_old_due_days?: number;
    average_new_due_days?: number;
    duration_seconds?: number;
    error?: string;
    details?: string;
}


type TextSegment = {
    text: string;
    shouldTranscribe: boolean;
    process: string;
  };
  
function parseTaggedText(input: string, otherProcess: string): TextSegment[] {
    const segments: TextSegment[] = [];
    let currentIndex = 0;

    // Regex to find <lang>, </lang>, <rom>, </rom> tags
    const tagRegex = /<(lang|rom)>|<\/(lang|rom)>/g;

    let match;
    let insideLang = false;
    let insideRom = false;
    let lastIndex = 0;

    while ((match = tagRegex.exec(input)) !== null) {
        const matchedText = match[0];
        const tagName = match[1] || match[2];
        const isClosing = matchedText.startsWith('</');
        
        // Add text before this tag
        if (match.index > lastIndex) {
        const textBefore = input.substring(lastIndex, match.index);
        if (textBefore) {
            // Text outside tags or inside current tag context
            const shouldTranscribe = insideRom ? false : true;
            segments.push({ text: textBefore, shouldTranscribe: shouldTranscribe, process: otherProcess });
        }
        }
        
        // Update state based on tag
        if (!isClosing) {
        if (tagName === 'lang') {
            insideLang = true;
            insideRom = false;
        } else if (tagName === 'rom') {
            insideRom = true;
            insideLang = false;
        }
        } else {
        if (tagName === 'lang') {
            insideLang = false;
        } else if (tagName === 'rom') {
            insideRom = false;
        }
        }
        
        lastIndex = match.index + matchedText.length;
    }

    // Add remaining text after last tag
    if (lastIndex < input.length) {
        const textAfter = input.substring(lastIndex);
        if (textAfter) {
        const shouldTranscribe = insideRom ? false : true;
        segments.push({ text: textAfter, shouldTranscribe: shouldTranscribe, process: otherProcess });
        }
    }

    return segments;
}


let colorCodingDictionary: Record<string, string[]> = {
    "mn": ["#000000", "#00ffff"],
    "m": ["#0000ff"],
    "f": ["#ff0000"],
    "n": ["#000000", "#00ff00"],
    "e": ["#ff00ff"],
    "1": ["#ffffff", "#ff0000"],
    "2": ["#000000", "#ffff00"],
    "3": ["#000000", "#00ff00"],
    "4": ["#ffffff", "#0000ff"]
}

function applyColorCoding(output: string, code: string): string {
    const colors = colorCodingDictionary[code];
    if (!colors) return output;
    const textColor = colors[0];
    const bgColor = colors[1];
    const style = [
        textColor ? `color: ${textColor};` : '',
        bgColor ? `background-color: ${bgColor};` : ''
    ].join(' ').trim();
    return `<span style="${style}">${output}</span>`;
}

function checkColorCoding(fieldValues: string[], targetIndex: number, cardFormat: string, processedText?: string): string {
    let colorCodingIndex = 4;
    /*
    if (cardFormat == "Target to Native") {
        colorCodingIndex = 2;
    }
    */

    let output = processedText || fieldValues[targetIndex];  // Use processed text if provided
    if (fieldValues.length < (colorCodingIndex - 1) || targetIndex == 3 || targetIndex == 1) {
        return output;
    } else {
        let colorCoding = fieldValues[colorCodingIndex];
        return applyColorCoding(output, colorCoding);  // Apply color coding to the processed text
    }  
}

function createDeckDropdowns() {
    let dropdownIDs: string[] = ["upload_dropdownMenu", "review_dropdownMenu", "check_dropdownMenu"];
    
    for (let i = 0; i < dropdownIDs.length; i++) {
        let id = dropdownIDs[i];
        let selectElement = document.getElementById(id) as HTMLSelectElement;
        
        if (!selectElement) {
            console.warn(`Dropdown element not found: ${id}`);
            continue;
        }
        
        // Clear existing options first (in case function runs multiple times)
        selectElement.innerHTML = '<option value="" disabled selected>(None)</option>';
        
        for (let j = 0; j < deckNameList.length; j++) {
            let deck = deckNameList[j];
            let option = document.createElement("option");
            option.value = deck;
            option.text = deck;
            selectElement.appendChild(option);
        }
    }
}

// Better approach: populate dropdowns when tabs become active
function populateDropdownForTab(dropdownId: string) {
    const selectElement = document.getElementById(dropdownId) as HTMLSelectElement;
    if (!selectElement) {
        console.warn(`Dropdown element not found: ${dropdownId}`);
        return;
    }
    
    // Check if already populated
    if (selectElement.children.length > 1) {
        return; // Already has options
    }
    
    // Clear and populate
    selectElement.innerHTML = '<option value="" disabled selected>Select a deck</option>';
    
    deckNameList.forEach(deck => {
        const option = document.createElement("option");
        option.value = deck;
        option.text = deck;
        selectElement.appendChild(option);
    });
}

createDeckDropdowns();
initializeUploadTab(createCardRelationship);


interface CardFieldData {
    card_id: number;
    note_id: number;
    field_names: string[];
    field_values: string[];
    field_processing: string[];
    deck?: string;
    card_format?: string;
}

interface AdjustIntervalsRequest {
    deck: string;
    days_back: number;
    shift_percentage: number;
    update_interval: boolean;
}

interface AdjustIntervalsResponse {
    status: 'success' | 'error';
    updated_count?: number;
    total_cards_found?: number;
    deck?: string;
    days_back?: number;
    shift_percentage?: number;
    update_interval?: boolean;
    operation_time?: string;
    average_old_interval?: number;
    average_new_interval?: number;
    duration_seconds?: number;
    error?: string;
    details?: string;
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

// Track session IDs per deck (deck name → session ID)
const currentSessionIds = new Map<string, number>();


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
    prereqs?: number[];
    dependents?: number[];
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

    const validTabIds = new Set(Array.from(buttons).map(b => b.id));
    const defaultTab = 'upload_cards';

    function activateTab(buttonId: string) {
        const btn = document.getElementById(buttonId);
        if (!btn) return;

        buttons.forEach(b => b.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));

        btn.classList.add('active');

        const targetId = buttonId.replace('_cards', '_mainDiv').replace('check_work', 'check_mainDiv');
        const targetDiv = document.getElementById(targetId);
        if (targetDiv) {
            targetDiv.classList.add('active');
            console.log("Loaded " + buttonId);

            if (buttonId === 'browse_cards') {
                setupBrowseCardsTab();
            } else if (buttonId === 'shuffle_cards') {
                setupShuffleCardsTab();
            } else if (buttonId === 'review_cards') {
                buildReviewDeckList();
            } else if (buttonId === 'check_work') {
                populateCheckWorkDropdown();
            } else if (buttonId === 'forecast_cards') {
                setupReviewForecastTab();
            } else if (buttonId === 'stats_cards') {
                setupStatsTab();
            }
        }
    }

    buttons.forEach(button => {
        button.addEventListener('click', function() {
            window.location.hash = button.id;
        });
    });

    window.addEventListener('hashchange', () => {
        const id = window.location.hash.slice(1);
        activateTab(validTabIds.has(id) ? id : defaultTab);
    });

    // Activate on initial load
    const initialId = window.location.hash.slice(1);
    activateTab(validTabIds.has(initialId) ? initialId : defaultTab);

    setupCheckYourWorkTab();
}

function transcribe(str: string, process: string = "", otherProcess: string = "", optionalBoolean: boolean = true): string {
    let rawSegments: TextSegment[] = parseTaggedText(str, otherProcess);
    
    const processors: Record<string, (text: string) => string> = {
        "Coptic": (text) => transliterateCoptic(text),
        "Ge'ez": (text) => transliterateGeez(text, optionalBoolean),
        "Ancient Greek": (text) => transliterateGreek(text),
        "Hebrew": (text) => transliterateHebrew(text, true),
        "Persian": (text) => transliteratePersian(text)
    };
    
    const processor = processors[process] || ((text: string) => text);
    
    let outputSegments: string[] = [];
    for (let i = 0; i < rawSegments.length; i++) {
        let segment = rawSegments[i];
        let outputSegment: string = segment.text;
        let segmentOtherProcess = segment.process;
        
        if (process === "Ancient Greek") {
            console.log(`Segment ${i}: shouldTranscribe=${segment.shouldTranscribe}, process="${segmentOtherProcess}", text="${segment.text}"`);
        }
        
        if (segment.shouldTranscribe) {
            outputSegment = processor(outputSegment);
        } else {
            let otherProcessor = processors[segmentOtherProcess] || ((text: string) => text);
            outputSegment = otherProcessor(outputSegment);
        }
        
        if (process === "Ancient Greek") {
            console.log(`Segment ${i} output: "${outputSegment}"`);
        }
        
        outputSegments.push(outputSegment);
    }
    
    return outputSegments.join("");
}

function cleanFieldDatum(card: CardDue, targetIndex: number, isBackOfCard: boolean) {
    //console.log("🐦 CANARY - cleanFieldDatum v2");
    let cardFormat = card.card_format;

    if (targetIndex >= card.field_values.length || targetIndex >= card.field_processing.length) {
        console.error(`Index ${targetIndex} out of bounds for card ${card.card_id}.`);
        return "(empty)";
    }

    let datum = card.field_values[targetIndex] ?? "";
    let process = card.field_processing[targetIndex];
    // Log the raw codepoints of the incoming string
    if (process === "Ancient Greek") {
        console.log("Raw datum:", datum);
        console.log("Codepoints:", [...datum].map(c => 
            `${c} U+${c.codePointAt(0)!.toString(16).padStart(4, '0')}`
        ).join(' '));
    }
    // ἄφρων / senseless, crazed / ἄφρων/ον (-ονος)
    // Process all languages uniformly — transliterateGreek handles already-Greek
    // text by normalizing to NFC, which fixes diacritic stripping on paste
    let output = transcribe(datum, process, card.deck, isBackOfCard);

    if (isBackOfCard) {
        output = checkColorCoding(card.field_values, targetIndex, cardFormat, output);
    }
    return output;
}

async function checkAvailableCardsWithOptions(deckName: string): Promise<CheckCardsResponse> {
    const reviewAheadCheckbox = document.getElementById('reviewAheadCheckbox') as HTMLInputElement;
    const reviewAheadDropdown = document.getElementById('reviewAheadOptions') as HTMLInputElement;
    const reviewDaysAhead = document.getElementById('reviewDaysAhead') as HTMLSelectElement;
    
    let checkTime: Date;
    let targetDate: Date;

    if (reviewAheadCheckbox) {
        reviewAheadCheckbox.addEventListener('change', async () => {
            if (reviewAheadCheckbox.checked) {
                reviewAheadDropdown.style.display = "block";
            }
        });
    }
    
    if (reviewAheadCheckbox && reviewAheadCheckbox.checked) {
        const daysAhead = parseInt(reviewDaysAhead?.value || '1');
        targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + daysAhead);
        
        // Create end of target day in LOCAL timezone, then convert to UTC
        checkTime = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59, 999);
    } else {
        // Create end of today in LOCAL timezone, then convert to UTC  
        const today = new Date();
        checkTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
        targetDate = new Date();
    }

    const currentTime = new Date();
    console.log('DEBUG - Check time being used:', checkTime.toISOString());
    console.log('DEBUG - Current actual time:', currentTime.toISOString());
    console.log('DEBUG - Review ahead enabled:', reviewAheadCheckbox?.checked || false);
    console.log('DEBUG - Days ahead:', reviewAheadCheckbox?.checked ? parseInt(reviewDaysAhead?.value || '1') : 0);
    
    try {
        const response = await fetch('/check_cards_available', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                deck: deckName,
                current_time: checkTime.toISOString(),
                actual_current_time: new Date().toISOString(),
                review_ahead: reviewAheadCheckbox?.checked || false,
                days_ahead: reviewAheadCheckbox?.checked ? parseInt(reviewDaysAhead?.value || '1') : 0,
                target_date: targetDate.toISOString()
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result: CheckCardsResponse = await response.json();
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

// API function to shuffle due dates
async function shuffleDueDates(
    deck: string,
    daysSpan: number,
    baseDate?: string,
    includeOverdue: boolean = false
): Promise<ShuffleDueDatesResponse> {
    
    console.log(`🎲 Shuffling due dates for deck "${deck}": ${daysSpan} days from ${baseDate || 'today'}`);
    
    try {
        const response = await fetch('/shuffle_due_dates', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                deck: deck,
                days_span: daysSpan,
                base_date: baseDate,
                include_overdue: includeOverdue
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result: ShuffleDueDatesResponse = await response.json();
        console.log('Shuffle due dates response:', result);
        
        return result;
    } catch (error) {
        console.error('Error shuffling due dates:', error);
        return { 
            status: 'error', 
            error: 'Network error shuffling due dates' 
        };
    }
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
        
        // Check if any peers, prereqs, or dependents of this card are already selected
        const hasPeerConflict = card.peers && card.peers.some(peerId => alreadySelected.has(peerId));
        const hasPrereqConflict = card.prereqs && card.prereqs.some(prereqId => alreadySelected.has(prereqId));
        const hasDependentConflict = card.dependents && card.dependents.some(depId => alreadySelected.has(depId));

        if (!hasPeerConflict && !hasPrereqConflict && !hasDependentConflict) {
            // This card is safe to add
            selectedFromGroup.push(card);
            alreadySelected.add(card.card_id);
            console.log(`✓ Added card ${card.card_id} (no peer/prereq/dependent conflicts)`);
        } else {
            const conflictDetails = [
                ...(card.peers?.filter(id => alreadySelected.has(id)).map(id => `peer:${id}`) || []),
                ...(card.prereqs?.filter(id => alreadySelected.has(id)).map(id => `prereq:${id}`) || []),
                ...(card.dependents?.filter(id => alreadySelected.has(id)).map(id => `dependent:${id}`) || []),
            ];
            console.log(`⚠ Skipped card ${card.card_id} (conflicts with: ${conflictDetails.join(', ')})`);
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

// --- Multi-deck review functions ---

async function buildReviewDeckList(): Promise<void> {
    const container = document.getElementById('review_deck_list');
    if (!container) return;

    container.innerHTML = '<p>Loading card counts...</p>';

    const results = await Promise.all(
        deckNameList.map(async (deckName) => {
            const result = await checkAvailableCardsWithOptions(deckName);
            deckCardCache.set(deckName, result);
            return { deckName, result };
        })
    );

    const anyDue = results.some(({ result }) => (result.cards?.length || 0) > 0);

    const rows = results.map(({ deckName, result }) => {
        const dueCount = result.cards?.length || 0;
        const disabled = dueCount === 0 ? 'disabled' : '';
        const checked = dueCount > 0 ? 'checked' : '';
        return `
            <div class="deck-review-row" data-deck="${deckName}">
                <input type="checkbox" class="deck-review-check" ${checked} ${disabled}>
                <span class="deck-name">${deckName}</span>
                <input type="number" class="deck-card-count" value="${dueCount}" min="1" max="${dueCount}" ${disabled}>
                <span class="deck-due-label">/ ${dueCount} cards due</span>
            </div>`;
    }).join('');

    container.innerHTML = anyDue ? rows : '<p>No cards due across all decks.</p>';

    const submitButton = document.getElementById('review_submitBtn') as HTMLButtonElement;
    if (submitButton) {
        submitButton.textContent = anyDue ? 'Start Review' : 'No Cards Due';
        submitButton.disabled = !anyDue;
    }
}

async function produceMultiDeckReviewSheet(selections: { deckName: string, cards: CardDue[] }[]): Promise<void> {
    const reviewAheadCheckbox = document.getElementById('reviewAheadCheckbox') as HTMLInputElement;
    const reviewAheadHours = document.getElementById('reviewAheadHours') as HTMLSelectElement;
    const hoursAhead = reviewAheadCheckbox?.checked ? parseInt(reviewAheadHours?.value || '24') : 0;

    const deckData: { name: string, cards: CardDue[], sessionId: number | null }[] = [];

    for (const { deckName, cards } of selections) {
        const cardIds = cards.map(c => c.card_id);
        await markCardsUnderReview(cardIds);

        const sessionResult = await createReviewSession(deckName, cardIds, cards.length, hoursAhead);
        let sessionId: number | null = null;
        if (sessionResult.status === 'success' && sessionResult.session_id) {
            sessionId = sessionResult.session_id;
            currentSessionIds.set(deckName, sessionId);
            localStorage.setItem(`reviewSession_${deckName}`, JSON.stringify({
                sessionId,
                timestamp: new Date().toISOString()
            }));
            console.log(`✅ Created session ${sessionId} for deck "${deckName}" (${cardIds.length} cards)`);
        } else {
            console.error(`❌ Failed to create session for deck "${deckName}":`, sessionResult.error);
        }
        deckData.push({ name: deckName, cards, sessionId });
    }

    // Shuffle deck order for the PDF (cards within each deck stay in their order)
    for (let i = deckData.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deckData[i], deckData[j]] = [deckData[j], deckData[i]];
    }

    try {
        const htmlContent = generateMultiDeckReviewSheetHTML(deckData);
        const blob = new Blob([htmlContent], { type: 'text/html' });
        const blobUrl = URL.createObjectURL(blob);
        const pdfTab = window.open(blobUrl, '_blank');
        if (pdfTab) {
            pdfTab.addEventListener('load', () => setTimeout(() => pdfTab.focus(), 1500));
        }
        setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
        console.log('✅ Multi-deck PDF view opened in new tab');
    } catch (error) {
        console.error('Error opening PDF view:', error);
        alert('Failed to open PDF view');
    }
}

function generateMultiDeckReviewSheetHTML(
    decks: { name: string, cards: CardDue[], sessionId: number | null }[]
): string {
    const now = new Date();
    const today = now.toLocaleDateString();
    const timeStr = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const totalCards = decks.reduce((sum, d) => sum + d.cards.length, 0);
    const deckSummary = decks.map(d => `${d.name} (${d.cards.length})`).join(', ');
    const origin = window.location.origin;

    // Build per-deck font-size CSS overrides
    const fontOverrides = decks.map(d => {
        const fontSize = printFontSizes[d.name] ?? '11pt';
        return `.deck-section[data-deck="${d.name}"] .card-question { font-size: ${fontSize} !important; }`;
    }).join('\n');

    const deckSections = decks.map(d => `
        <div class="deck-section" data-deck="${d.name}">
            <div class="deck-section-header">
                <span class="deck-section-name">${d.name}</span>
                <span class="deck-section-count">${d.cards.length} cards${d.sessionId ? ` · Session ${d.sessionId}` : ''}</span>
            </div>
            <div class="two-column-container">
                ${d.cards.map((card, i) => generateCardHTML(card, i + 1)).join('')}
            </div>
        </div>`).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Review Sheet</title>
    <style>
        @font-face {
            font-family: 'GentiumPlus';
            src: url('${origin}/Gentium/GentiumPlus-Regular.ttf') format('truetype');
            font-weight: normal;
            font-style: normal;
            font-display: swap;
        }
        @font-face {
            font-family: 'GentiumPlus';
            src: url('${origin}/Santakku/Santakku.ttf') format('truetype');
            unicode-range: U+12000-1254F;
            font-display: swap;
        }
        @font-face {
            font-family: 'GentiumPlus';
            font-style: italic;
            src: url('${origin}/Santakku/Santakku.ttf') format('truetype');
            unicode-range: U+12000-1254F;
            font-display: swap;
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
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
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            margin-bottom: 20px;
            border-bottom: 2px solid #333;
            padding-bottom: 15px;
        }
        .header-left, .header-right { font-size: 11px; color: #666; flex-shrink: 0; padding-top: 6px; }
        .header-center { text-align: center; flex-grow: 1; }
        .title { font-size: 22px; font-weight: bold; margin-bottom: 4px; }
        .summary { font-size: 13px; font-weight: bold; }
        .deck-list { font-size: 11px; color: #555; margin-top: 3px; }
        .deck-section { margin-top: 24px; }
        .deck-section-header {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            border-bottom: 1px solid #999;
            margin-bottom: 10px;
            padding-bottom: 4px;
        }
        .deck-section-name { font-size: 16px; font-weight: bold; }
        .deck-section-count { font-size: 11px; color: #666; }
        .two-column-container {
            column-count: 2;
            column-gap: 60px;
            column-rule: 1px solid #ccc;
            column-fill: balance;
        }
        .card-item {
            margin-bottom: 15px;
            display: flex;
            align-items: flex-start;
            justify-content: flex-end;
            text-align: right;
        }
        .card-question { font-size: 11pt; font-weight: normal; line-height: 1.4; max-width: 100%; }
        .card-question strong { font-weight: bold; }
        ${fontOverrides}
        .controls {
            position: fixed; top: 10px; right: 10px;
            background: rgba(255,255,255,0.95); padding: 10px;
            border-radius: 5px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            border: 1px solid #ddd; z-index: 1000;
        }
        .btn {
            background: #007cba; color: white; border: none;
            padding: 8px 16px; margin: 0 5px; border-radius: 4px;
            cursor: pointer; font-size: 12px;
        }
        .btn:hover { background: #005a87; }
        @media print {
            .controls { display: none !important; }
            body { font-size: 11pt !important; max-width: none; margin: 0; padding: 0 0.4in 0.4in 0.4in !important; }
            .header { margin-bottom: 10px !important; padding-bottom: 8px !important; page-break-after: avoid; }
            .deck-section { margin-top: 16px; }
            .deck-section-header { page-break-after: avoid; }
            .two-column-container {
                column-count: 2 !important; column-gap: 60px !important;
                column-rule: 1px solid #ccc !important; column-fill: balance !important;
                height: auto !important;
            }
            .card-item { margin-bottom: 16px !important; display: block !important; text-align: left !important; page-break-inside: avoid; break-inside: avoid; }
            .card-question { line-height: 1.3 !important; text-align: left !important; display: inline !important; }
            @page { margin: 0.4in; }
        }
        @media (max-width: 768px) {
            .two-column-container { column-count: 1; }
            .card-item { text-align: left; }
        }
    </style>
</head>
<body>
    <div class="controls">
        <button class="btn" onclick="window.print()">📄 Save as PDF</button>
        <button class="btn" onclick="window.close()">✕ Close</button>
    </div>
    <div class="header">
        <div class="header-left">${today}</div>
        <div class="header-center">
            <div class="title">Review Sheet</div>
            <div class="summary">${totalCards} cards total</div>
            <div class="deck-list">${deckSummary}</div>
        </div>
        <div class="header-right">${timeStr}</div>
    </div>
    ${deckSections}
    <script>
        document.fonts.ready.then(() => console.log('✅ All fonts loaded'));
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'p') { e.preventDefault(); window.print(); }
        });
    <\/script>
</body>
</html>`;
}


function generateCardFrontLine(card: CardDue): string {
    let allFields = card.field_values;
    let allProcessing = card.field_processing;

    // More lenient handling
    if (!allFields || allFields.length === 0) {
        console.error("Card has no fields:", card);
        return "ERROR: No fields";
    }
    
    const maxIndex = Math.min(allFields.length, allProcessing.length);
    if (maxIndex === 0) {
        console.error("Card has processing/field mismatch:", card);
        return "ERROR: Mismatch";
    }

    let targetIndex = 0;
    
    if (card.card_format == "Native to Target") {
        targetIndex = 1; 
    } else if (card.card_format == "One Way") {
        // For One Way cards, find the field WITHOUT processing (that's the question)
        let foundQuestion = false;
        for (let i = 0; i < maxIndex; i++) {
            const processing = allProcessing[i];
            // Question is the field WITHOUT processing or with empty/null processing
            if (!processing || (typeof processing === 'string' && processing.trim() === "")) {
                targetIndex = i;
                foundQuestion = true;
                break;
            }
        }
        
        // If all fields have processing (shouldn't happen), use first field
        if (!foundQuestion) {
            console.warn("One Way card has processing on all fields, using field 0:", card);
            targetIndex = 0;
        }
    }
    
    // Safety check
    if (targetIndex >= maxIndex) {
        targetIndex = 0;
    }

    let processedField = cleanFieldDatum(card, targetIndex, false);
    return processedField;
}

// Generate the back side of a card
function generateCardBackLine(card: CardDue): string {
    if (!card.field_values || card.field_values.length === 0) {
        return "(no content)";
    }
    
    const maxIndex = Math.min(
        card.field_values.length, 
        card.field_processing ? card.field_processing.length : 0
    );
    
    if (maxIndex === 0) {
        return "(no content)";
    }
    
    let targetIndex = 0;
    
    if (card.card_format === "One Way") {
        // For One Way cards, the ANSWER is the field WITH processing
        let foundAnswer = false;
        for (let i = 0; i < maxIndex; i++) {
            const processing = card.field_processing[i];
            // Check for truthy processing value (not null, not empty string)
            if (processing && typeof processing === 'string' && processing.trim() !== "") {
                targetIndex = i;
                foundAnswer = true;
                break;
            }
        }
        
        // If no field has processing, use the field that's NOT used in front
        if (!foundAnswer) {
            console.warn("One Way card has no processing, guessing field 1:", card);
            targetIndex = Math.min(1, maxIndex - 1);
        }
    } else {
        // Original logic for Two-Way cards with ENHANCED null safety
        if (card.field_values.length >= 3) {
            const field2 = card.field_values[2];
            if (field2 && typeof field2 === 'string' && field2.trim() !== "") {
                targetIndex = 2;
            }
        }
        
        if (card.card_format === "Target to Native") {
            targetIndex = 1; 
            if (card.field_values.length >= 4) {
                const field3 = card.field_values[3];
                if (field3 && typeof field3 === 'string' && field3.trim() !== "") {
                    targetIndex = 3;
                }
            }
        }
    }
    
    // Safety check
    if (targetIndex >= maxIndex) {
        targetIndex = maxIndex - 1;
    }
    
    let processedField = cleanFieldDatum(card, targetIndex, true);
    return processedField;
}

// selectedReviewDeck is kept only for the "Review Difficult Cards" button.
let selectedReviewDeck: string = "";

// Per-deck card cache used by the multi-deck checklist.
const deckCardCache = new Map<string, CheckCardsResponse>();

// Helper function to refresh card counts when review-ahead settings change.
async function refreshCardCache(): Promise<void> {
    await buildReviewDeckList();
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

/** Set the review_numCards input to the total number of due cards. */
function setReviewNumCardsToTotal(totalCardCount: number): void {
    const reviewAheadNumCards = document.getElementById("review_numCards") as HTMLInputElement;
    if (reviewAheadNumCards) {
        reviewAheadNumCards.value = String(totalCardCount);
        reviewAheadNumCards.max = String(totalCardCount);
    }
}

function updateSubmitButtonText(numCards: number, totalCardCount: number, reviewAhead: boolean, daysAhead: number): void {
    const submitButton = document.getElementById("review_submitBtn") as HTMLButtonElement;
    if (submitButton) {
        if (totalCardCount === 0) {
            const dateText = reviewAhead ? ` (by ${getTargetDateString(daysAhead)})` : ' (today)';
            submitButton.textContent = `No Cards Available${dateText}`;
            submitButton.disabled = true;
        } else {
            const dateText = reviewAhead ? ` (by ${getTargetDateString(daysAhead)})` : ' (today)';
            submitButton.textContent = `Review ${numCards} of ${totalCardCount} Card${totalCardCount !== 1 ? 's' : ''}${dateText}`;
            submitButton.disabled = false;
        }
    }
}

// Helper function to get readable date string
function getTargetDateString(daysAhead: number): string {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysAhead);
    return targetDate.toLocaleDateString();
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
        const deckRows = document.querySelectorAll<HTMLDivElement>('.deck-review-row');
        const selections: { deckName: string, cards: CardDue[] }[] = [];

        for (const row of deckRows) {
            const checkbox = row.querySelector<HTMLInputElement>('.deck-review-check');
            if (!checkbox?.checked) continue;

            const deckName = row.dataset.deck!;
            const countInput = row.querySelector<HTMLInputElement>('.deck-card-count');
            const numCards = parseInt(countInput?.value || '0');

            const cached = deckCardCache.get(deckName);
            if (!cached?.cards || cached.cards.length === 0) continue;

            const cards = produceFinalCardList(cached.cards, numCards);
            if (cards.length > 0) {
                selections.push({ deckName, cards });
            }
        }

        if (selections.length === 0) {
            alert('No decks selected with due cards.');
            return;
        }

        await produceMultiDeckReviewSheet(selections);
    });
}

async function fetchTodaysHardFail(deck?: string): Promise<{status: string, cards: (CardDue & {grade: string, reviewed_at: string})[], count: number, error?: string}> {
    const url = deck ? `/todays_hard_fail?deck=${encodeURIComponent(deck)}` : '/todays_hard_fail';
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return response.json();
}


const reviewDifficultBtn = document.getElementById('reviewDifficultBtn');
if (reviewDifficultBtn) {
    reviewDifficultBtn.addEventListener('click', async () => {
        const outputDiv = document.getElementById('review_output') as HTMLDivElement;
        if (outputDiv) outputDiv.innerHTML = `<p>Loading...</p>`;
        try {
            const result = await fetchTodaysHardFail();
            if (result.status !== 'success') {
                if (outputDiv) outputDiv.innerHTML = `<p class="error">Error: ${result.error}</p>`;
                return;
            }
            if (result.cards.length === 0) {
                if (outputDiv) outputDiv.innerHTML = `<p>No hard or failed cards today across any deck.</p>`;
                return;
            }

            // Group cards by deck
            const byDeck = new Map<string, (CardDue & {grade: string, reviewed_at: string})[]>();
            for (const card of result.cards) {
                if (!byDeck.has(card.deck)) byDeck.set(card.deck, []);
                byDeck.get(card.deck)!.push(card);
            }

            // Store each deck's cards in localStorage for the Check Your Work tab
            const timestamp = new Date().toISOString();
            for (const [deckName, cards] of byDeck) {
                localStorage.setItem(`difficultReview_${deckName}`, JSON.stringify({ cards, timestamp }));
            }

            // Build multi-deck review sheet
            const deckData: { name: string, cards: CardDue[], sessionId: number | null }[] =
                Array.from(byDeck.entries()).map(([name, cards]) => ({ name, cards: cards as CardDue[], sessionId: null }));

            const htmlContent = generateMultiDeckReviewSheetHTML(deckData);
            const blob = new Blob([htmlContent], { type: 'text/html' });
            const blobUrl = URL.createObjectURL(blob);
            window.open(blobUrl, '_blank');
            setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);

            const deckSummary = Array.from(byDeck.entries()).map(([n, c]) => `${n} (${c.length})`).join(', ');
            if (outputDiv) outputDiv.innerHTML = `<p>Review sheet opened in new tab — ${result.cards.length} cards across: ${deckSummary}. Use the Check Your Work tab to grade them.</p>`;
            populateCheckWorkDropdown();
        } catch (err) {
            if (outputDiv) outputDiv.innerHTML = `<p class="error">Network error loading difficult cards.</p>`;
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
async function getCardsUnderReview(deckName: string, sessionId?: number | null): Promise<CardsUnderReviewResponse> {
    try {
        const url = `/cards_under_review/${encodeURIComponent(deckName)}`
                  + (sessionId ? `?session_id=${sessionId}` : '');
        const response = await fetch(url, {
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
    // Get session ID from localStorage
    const sessionData = localStorage.getItem(`reviewSession_${deckName}`);
    let sessionId: number | null = null;
    if (sessionData) {
        try {
            sessionId = JSON.parse(sessionData).sessionId ?? null;
        } catch (e) {
            console.warn('Could not parse reviewSession data');
        }
    }
    // Fetch cards from DB; server orders by position when sessionId is provided
    const result = await getCardsUnderReview(deckName, sessionId);
    return result.status === 'success' ? result.cards?.map(convertToCardDue) || [] : [];
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
function displayAnswerKey(cards: CardDue[], deckName: string, isDifficult: boolean = false): void {
    const outputDiv = document.getElementById("check_output") as HTMLDivElement;
    if (!outputDiv) return;

    console.log(`Displaying answer key for ${cards.length} cards`);

    // Get session ID from localStorage if available (not used for difficult reviews)
    let sessionId: number | null = null;
    if (!isDifficult) {
        const sessionData = localStorage.getItem(`reviewSession_${deckName}`);
        if (sessionData) {
            try {
                sessionId = JSON.parse(sessionData).sessionId ?? null;
            } catch (e) {
                console.warn('Could not parse reviewSession data');
            }
        }
    }

    const answerKeyHTML = generateAnswerKey(cards, deckName);

    outputDiv.innerHTML = `
        <div class="check-work-header">
            <h2>Answer Key for "${deckName}"${isDifficult ? ' <em>(Difficult Cards — practice only)</em>' : ''}</h2>
            <p class="deck-info">Review your answers and select pass/hard/fail for each card${isDifficult ? ' — grades will not be recorded' : ''}</p>
            ${sessionId ? `<p class="session-info">Session ID: ${sessionId}</p>` : ''}
        </div>
        ${answerKeyHTML}
    `;

    // Add event listener to the submit button
    const completeReviewButton = document.getElementById('submitReviewResults');
    if (completeReviewButton) {
        if (isDifficult) {
            completeReviewButton.textContent = 'Done (grades not recorded)';
            completeReviewButton.addEventListener('click', () => {
                localStorage.removeItem(`difficultReview_${deckName}`);
                populateCheckWorkDropdown();
                outputDiv.innerHTML = `
                    <div class="success-message">
                        <h3>✓ Done reviewing difficult cards for "${deckName}"</h3>
                        <p>No interval changes were made.</p>
                    </div>
                `;
            });
        } else {
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
                        localStorage.removeItem(`reviewSession_${deckName}`);
                        currentSessionIds.delete(deckName);
                        // Invalidate the card cache so a subsequent same-day session
                        // always fetches a fresh list (reflecting burials from this session).
                        cachedCardResults = null;
                        lastCheckedDeck = "";

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
        }
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

function generateAnswerKey(cards: CardDue[], deckName: string): string {
    console.log(`generateAnswerKey called with ${cards.length} cards`);
    
    if (cards.length === 0) {
        return '<p class="no-cards">No cards are currently under review for this deck.</p>';
    }

    const answerFontSize = printFontSizes[deckName];
    const answerFontStyle = answerFontSize ? ` style="font-size: ${answerFontSize}"` : "";

    let html = `
        <div class="answer-key"${answerFontStyle}>
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
        //console.log(`Processing card ${index + 1}: ID ${card.card_id}`);
        
        const questionText = generateCardFrontLine(card);
        
        let answerText = '';
        let answerIndex: number;
        let targetBackText = ''; // For Target to Native cards

        if (card.card_format === "Native to Target") {
            // If question shows native (index 1), answer is target (index 0 or 2)
            // Check if index 2 has content, otherwise use index 0
            if (card.field_values.length > 2 && card.field_values[2] && card.field_values[2].trim() !== '') {
                answerIndex = 2;
                // Show the base target form (field 0) below the answer
                targetBackText = cleanFieldDatum(card, 0, true);
            } else {
                answerIndex = 0;
            }
        } else {
            // Target to Native: question shows target (index 0 or 2), answer is native (index 1 or 3)
            // Check if index 3 has content, otherwise use index 1
            if (card.field_values.length > 3 && card.field_values[3] && card.field_values[3].trim() !== '') {
                answerIndex = 3;
            } else {
                answerIndex = 1;
            }
            
            // For Target to Native, get the target back field (same logic as answer for Native to Target)
            let targetBackIndex: number;
            if (card.field_values.length > 2 && card.field_values[2] && card.field_values[2].trim() !== '') {
                targetBackIndex = 2;
            } else {
                targetBackIndex = 0;
            }
            // Use back processing (true) to get proper color-coding
            targetBackText = cleanFieldDatum(card, targetBackIndex, true);
        }

        // Call cleanFieldDatum with the correct signature
        answerText = cleanFieldDatum(card, answerIndex, true);

        // Process HTML in both question and answer
        const processedQuestion = processHTMLContent(questionText);
        const processedAnswer = processHTMLContent(answerText);
        const processedTargetBack = targetBackText ? processHTMLContent(targetBackText) : '';

        console.log(`Card ${card.card_id}: Q="${processedQuestion}" A="${processedAnswer}"`);
        let questionNum = index + 1;
        
        html += `
            <div class="answer-row" data-card-id="${card.card_id}">
                <div class="qa-cell"${answerFontStyle}>
                    ${questionNum}. ${processedQuestion} → ${processedAnswer}
                    ${processedTargetBack ? `<br>${processedTargetBack}` : ''}
                </div>
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
    
    // Use a more careful approach that preserves spaces
    // Match HTML tags while capturing surrounding content
    const htmlTagRegex = /<\/?[^>]+>/g;
    
    let result = '';
    let lastIndex = 0;
    let match;
    
    while ((match = htmlTagRegex.exec(processed)) !== null) {
        // Add the text before this tag (preserving all spaces)
        const textBeforeTag = processed.substring(lastIndex, match.index);
        result += escapeTextContent(textBeforeTag);
        
        // Process the HTML tag itself
        const tag = match[0];
        const tagMatch = tag.match(/^<\/?(\w+)(?:\s|>)/);
        const tagName = tagMatch ? tagMatch[1].toLowerCase() : '';
        
        if (allowedTags.includes(tagName)) {
            // Keep allowed tags as-is
            result += tag;
        } else {
            // Escape disallowed tags
            result += escapeTextContent(tag);
        }
        
        lastIndex = match.index + match[0].length;
    }
    
    // Add any remaining text after the last tag
    const remainingText = processed.substring(lastIndex);
    result += escapeTextContent(remainingText);
    
    return result;
}

function escapeTextContent(text: string): string {
    if (!text) return '';
    
    return text
        // Only escape & if it's not part of an existing HTML entity
        .replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g, '&amp;')
        // Escape < and > that aren't part of tags (this function is only called on text content)
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// Replace your existing setupShuffleCardsTab function with this new version
function setupShuffleCardsTab(): void {    
    const shuffleTab = document.getElementById('shuffle_mainDiv');
    if (!shuffleTab) return;

    // Only set up once
    if (shuffleTab.querySelector('.date-shuffle-controls')) {
        return;
    }

    // Replace content with new date shuffle interface
    shuffleTab.innerHTML = `
        <h2>🎲 Shuffle Card Due Dates</h2>
        <p class="tab-description">
            Randomly redistribute the due dates of cards within a specified time period. 
            This helps spread out card reviews more evenly.
        </p>
        
        <div class="date-shuffle-controls">
            <div class="shuffle-form">
                <div class="form-group">
                    <label for="shuffleDeckSelect">
                        <strong>Select Deck:</strong>
                    </label>
                    <select id="shuffleDeckSelect" class="form-control">
                        <option value="">Choose a deck...</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label for="shuffleDaysSpan">
                        <strong>Time Span (days):</strong>
                    </label>
                    <input type="number" id="shuffleDaysSpan" class="form-control" 
                           min="1" max="365" value="7" placeholder="Number of days">
                    <small class="form-text">Cards will be randomly distributed across this many days</small>
                </div>
                
                <div class="form-group">
                    <label for="shuffleBaseDate">
                        <strong>Starting Date:</strong>
                    </label>
                    <input type="date" id="shuffleBaseDate" class="form-control">
                    <small class="form-text">Leave blank to start from today</small>
                </div>
                
                <div class="form-group">
                    <label class="checkbox-label">
                        <input type="checkbox" id="includeOverdueCards">
                        <strong>Include overdue cards</strong>
                    </label>
                    <small class="form-text">
                        If checked, includes cards that are already overdue in the shuffle
                    </small>
                </div>
                
                <div class="form-actions">
                    <button id="previewShuffleBtn" class="btn btn-secondary">
                        👁️ Preview Cards
                    </button>
                    <button id="executeDateShuffleBtn" class="btn btn-primary">
                        🎲 Shuffle Due Dates
                    </button>
                </div>
            </div>
        </div>
        
        <div id="shuffle_output" class="shuffle-output"></div>
        
        <div id="shufflePreviewModal" class="modal-overlay" style="display: none;">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>📋 Cards to be Shuffled</h3>
                    <button id="closePreviewModal" class="close-btn">×</button>
                </div>
                <div class="modal-body" id="previewModalBody">
                    <!-- Preview content will go here -->
                </div>
                <div class="modal-footer">
                    <button id="cancelShuffle" class="btn btn-secondary">Cancel</button>
                    <button id="confirmShuffle" class="btn btn-primary">🎲 Confirm Shuffle</button>
                </div>
            </div>
        </div>
    `;
    
    // Dynamically populate deck options
    const deckSelect = document.getElementById('shuffleDeckSelect') as HTMLSelectElement;
    if (deckSelect) {
        deckNameList.forEach(deckName => {
            const option = document.createElement('option');
            option.value = deckName;
            option.textContent = deckName;
            deckSelect.appendChild(option);
        });
    }
    
    // Add event listeners
    setupDateShuffleEventListeners();
}

// Event listener setup for date shuffle
function setupDateShuffleEventListeners(): void {
    const previewBtn = document.getElementById('previewShuffleBtn') as HTMLButtonElement;
    const executeBtn = document.getElementById('executeDateShuffleBtn') as HTMLButtonElement;
    const closeModalBtn = document.getElementById('closePreviewModal') as HTMLButtonElement;
    const cancelBtn = document.getElementById('cancelShuffle') as HTMLButtonElement;
    const confirmBtn = document.getElementById('confirmShuffle') as HTMLButtonElement;

    if (previewBtn && !previewBtn.dataset.initialized) {
        previewBtn.dataset.initialized = 'true';
        previewBtn.addEventListener('click', handlePreviewShuffle);
    }

    if (executeBtn && !executeBtn.dataset.initialized) {
        executeBtn.dataset.initialized = 'true';
        executeBtn.addEventListener('click', handleDirectShuffle);
    }

    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', closePreviewModal);
    }

    if (cancelBtn) {
        cancelBtn.addEventListener('click', closePreviewModal);
    }

    if (confirmBtn) {
        confirmBtn.addEventListener('click', handleConfirmedShuffle);
    }

    // Set default date to today
    const baseDateInput = document.getElementById('shuffleBaseDate') as HTMLInputElement;
    if (baseDateInput && !baseDateInput.value) {
        const today = new Date();
        baseDateInput.value = today.toISOString().split('T')[0];
    }
}


// Handle preview shuffle
async function handlePreviewShuffle(): Promise<void> {
    const params = getShuffleParameters();
    if (!params) return;

    try {
        // Get cards that would be affected (we'll need to add this endpoint)
        const cardsToShuffle = await getCardsInDateRange(
            params.deck, 
            params.base_date, 
            params.days_span, 
            params.include_overdue
        );

        if (cardsToShuffle.length === 0) {
            showShuffleMessage('No cards found in the specified date range.', 'info');
            return;
        }

        showPreviewModal(cardsToShuffle, params);
    } catch (error: unknown) {
        console.error('Error previewing shuffle:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        showShuffleMessage('Error loading preview: ' + message, 'error');
    }
}

// Handle direct shuffle (without preview)
async function handleDirectShuffle(): Promise<void> {
    const params = getShuffleParameters();
    if (!params) return;

    const confirmed = confirm(
        `SHUFFLE DUE DATES\n\n` +
        `Deck: ${params.deck}\n` +
        `Time span: ${params.days_span} days\n` +
        `Starting: ${new Date(params.base_date).toDateString()}\n` +
        `Include overdue: ${params.include_overdue ? 'Yes' : 'No'}\n\n` +
        `This will randomly redistribute due dates and cannot be undone!\n\n` +
        `Continue?`
    );

    if (!confirmed) return;

    await executeDateShuffle(params);
}


// Handle confirmed shuffle from modal
async function handleConfirmedShuffle(): Promise<void> {
    const params = getShuffleParameters();
    if (!params) return;

    closePreviewModal();
    await executeDateShuffle(params);
}

// Get shuffle parameters from form
function getShuffleParameters(): ShuffleDueDatesRequest | null {
    const deckSelect = document.getElementById('shuffleDeckSelect') as HTMLSelectElement;
    const daysSpanInput = document.getElementById('shuffleDaysSpan') as HTMLInputElement;
    const baseDateInput = document.getElementById('shuffleBaseDate') as HTMLInputElement;
    const includeOverdueCheckbox = document.getElementById('includeOverdueCards') as HTMLInputElement;

    const deck = deckSelect?.value?.trim();
    const daysSpan = parseInt(daysSpanInput?.value || '0');
    let baseDate = baseDateInput?.value;
    const includeOverdue = includeOverdueCheckbox?.checked || false;

    // Validation
    if (!deck) {
        showShuffleMessage('Please select a deck', 'error');
        return null;
    }

    if (daysSpan < 1 || daysSpan > 365) {
        showShuffleMessage('Days span must be between 1 and 365', 'error');
        return null;
    }

    // If no base date provided, use today's date
    if (!baseDate) {
        const today = new Date();
        baseDate = today.toISOString().split('T')[0];
    }

    return {
        deck,
        days_span: daysSpan,
        base_date: baseDate,
        include_overdue: includeOverdue
    };
}

// Execute the date shuffle
async function executeDateShuffle(params: ShuffleDueDatesRequest): Promise<void> {
    const executeBtn = document.getElementById('executeDateShuffleBtn') as HTMLButtonElement;
    const outputDiv = document.getElementById('shuffle_output') as HTMLDivElement;

    if (executeBtn) {
        executeBtn.textContent = '🎲 Shuffling...';
        executeBtn.disabled = true;
    }

    if (outputDiv) {
        outputDiv.innerHTML = '<p class="loading">Shuffling due dates...</p>';
    }

    try {
        const result = await shuffleDueDates(
            params.deck,
            params.days_span,
            params.base_date,
            params.include_overdue
        );

        if (result.status === 'success') {
            const successMessage = `
                <div class="success-message">
                    <h3>✅ Due Date Shuffle Complete!</h3>
                    <div class="shuffle-stats">
                        <p><strong>Deck:</strong> ${result.deck}</p>
                        <p><strong>Cards shuffled:</strong> ${result.updated_count} of ${result.total_cards_found} found</p>
                        <p><strong>Date range:</strong> ${new Date(result.date_range?.start_date || '').toDateString()} to ${new Date(result.date_range?.end_date || '').toDateString()}</p>
                        <p><strong>Duration:</strong> ${result.duration_seconds?.toFixed(2)} seconds</p>
                        ${result.average_old_due_days !== undefined && result.average_new_due_days !== undefined ? 
                            `<p><strong>Average days from start:</strong> ${result.average_old_due_days.toFixed(1)} → ${result.average_new_due_days.toFixed(1)}</p>` : ''}
                    </div>
                </div>
            `;
            if (outputDiv) outputDiv.innerHTML = successMessage;
        } else {
            if (outputDiv) {
                outputDiv.innerHTML = `
                    <div class="error-message">
                        <h3>❌ Shuffle Failed</h3>
                        <p>Error: ${result.error}</p>
                    </div>
                `;
            }
        }
    } catch (error) {
        console.error('Error executing shuffle:', error);
        if (outputDiv) {
            outputDiv.innerHTML = `
                <div class="error-message">
                    <h3>❌ Network Error</h3>
                    <p>Failed to shuffle due dates. Please try again.</p>
                </div>
            `;
        }
    } finally {
        if (executeBtn) {
            executeBtn.textContent = '🎲 Shuffle Due Dates';
            executeBtn.disabled = false;
        }
    }
}

// Show shuffle message
function showShuffleMessage(message: string, type: 'success' | 'error' | 'info' | 'warning'): void {
    const outputDiv = document.getElementById('shuffle_output') as HTMLDivElement;
    if (!outputDiv) return;

    const className = `${type}-message`;
    outputDiv.innerHTML = `<div class="${className}"><p>${message}</p></div>`;
}

// Mock function to get cards in date range (you'll need to implement the backend endpoint)
async function getCardsInDateRange(
    deck: string, 
    baseDate: string, 
    daysSpan: number, 
    includeOverdue: boolean
): Promise<any[]> {
    // This would need a corresponding backend endpoint
    // For now, return empty array
    return [];
}

// Show preview modal
function showPreviewModal(cards: any[], params: ShuffleDueDatesRequest): void {
    const modal = document.getElementById('shufflePreviewModal') as HTMLDivElement;
    const modalBody = document.getElementById('previewModalBody') as HTMLDivElement;
    
    if (!modal || !modalBody) return;

    const endDate = new Date(params.base_date || new Date());
    endDate.setDate(endDate.getDate() + params.days_span);

    modalBody.innerHTML = `
        <div class="preview-info">
            <h4>Shuffle Configuration</h4>
            <p><strong>Deck:</strong> ${params.deck}</p>
            <p><strong>Date range:</strong> ${new Date(params.base_date || '').toDateString()} to ${endDate.toDateString()}</p>
            <p><strong>Time span:</strong> ${params.days_span} days</p>
            <p><strong>Include overdue:</strong> ${params.include_overdue ? 'Yes' : 'No'}</p>
        </div>
        
        <div class="preview-cards">
            <h4>Cards to be shuffled (${cards.length})</h4>
            ${cards.length > 0 ? `
                <div class="card-list">
                    ${cards.slice(0, 10).map(card => `
                        <div class="preview-card-item">
                            <span class="card-id">Card ${card.card_id}</span>
                            <span class="current-due">Currently due: ${new Date(card.time_due).toLocaleDateString()}</span>
                        </div>
                    `).join('')}
                    ${cards.length > 10 ? `<p class="more-cards">...and ${cards.length - 10} more cards</p>` : ''}
                </div>
            ` : '<p>No cards found in the specified range.</p>'}
        </div>
    `;

    modal.style.display = 'flex';
}

// Close preview modal
function closePreviewModal(): void {
    const modal = document.getElementById('shufflePreviewModal') as HTMLDivElement;
    if (modal) {
        modal.style.display = 'none';
    }
}

async function handleBulkReduction(): Promise<void> {
    const multiplierInput = document.getElementById('bulkMultiplier') as HTMLInputElement;
    const bulkReduceBtn = document.getElementById('bulkReduceBtn') as HTMLButtonElement;
    const multiplier = parseFloat(multiplierInput.value);
    
    if (multiplier < 0.01 || multiplier > 1.0) {
        alert('Multiplier must be between 0.01 and 1.0');
        return;
    }
    
    const confirmed = confirm(
        `BULK INTERVAL REDUCTION\n\n` +
        `This will multiply ALL card intervals by ${multiplier} (${(multiplier * 100).toFixed(0)}%)\n\n` +
        `This affects your entire database and cannot be undone!\n\n` +
        `Continue?`
    );
    
    if (!confirmed) return;
    
    bulkReduceBtn.textContent = 'Processing...';
    bulkReduceBtn.disabled = true;
    
    try {
        const response = await fetch('/bulk_reduce_intervals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ interval_multiplier: multiplier })
        });
        
        const result = await response.json();
        const outputDiv = document.getElementById('shuffle_output');
        
        if (result.status === 'success' && outputDiv) {
            outputDiv.innerHTML = `
                <div class="success-message">
                    <h3>✅ Bulk Reduction Complete!</h3>
                    <p>Updated ${result.updated_count} cards</p>
                    <p>Average interval: ${result.average_old_interval}d → ${result.average_new_interval}d</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error reducing intervals:', error);
    } finally {
        bulkReduceBtn.textContent = 'Apply Bulk Reduction';
        bulkReduceBtn.disabled = false;
    }
}

// Populate the check-work dropdown with decks that have an active reviewSession in localStorage,
// plus any difficult-card review sessions.
function populateCheckWorkDropdown(): void {
    const dropdown = document.getElementById('check_dropdownMenu') as HTMLSelectElement;
    if (!dropdown) return;

    const regularDecks: string[] = [];
    const difficultDecks: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('reviewSession_')) {
            regularDecks.push(key.slice('reviewSession_'.length));
        } else if (key?.startsWith('difficultReview_')) {
            difficultDecks.push(key.slice('difficultReview_'.length));
        }
    }

    dropdown.innerHTML = '<option value="" disabled selected>Select a deck</option>';
    const anyActive = regularDecks.length > 0 || difficultDecks.length > 0;
    if (!anyActive) {
        const opt = document.createElement('option');
        opt.disabled = true;
        opt.textContent = '(No active review sessions)';
        dropdown.appendChild(opt);
    } else {
        regularDecks.sort().forEach(deckName => {
            const opt = document.createElement('option');
            opt.value = deckName;
            opt.textContent = deckName;
            dropdown.appendChild(opt);
        });
        difficultDecks.sort().forEach(deckName => {
            const opt = document.createElement('option');
            opt.value = `difficult:${deckName}`;
            opt.textContent = `${deckName} (Difficult)`;
            dropdown.appendChild(opt);
        });
    }
}

// Set up the Check Your Work tab functionality
function setupCheckYourWorkTab(): void {
    const checkDeckDropdown = document.getElementById("check_dropdownMenu") as HTMLSelectElement;
    const checkSubmitButton = document.getElementById("check_submitBtn") as HTMLButtonElement;

    if (checkSubmitButton && checkDeckDropdown) {
        checkSubmitButton.addEventListener('click', async () => {
            const selectedValue = checkDeckDropdown.value;
            if (!selectedValue) {
                const outputDiv = document.getElementById("check_output") as HTMLDivElement;
                if (outputDiv) {
                    outputDiv.innerHTML = `<p class="error">Please select a deck first.</p>`;
                }
                return;
            }

            const isDifficult = selectedValue.startsWith('difficult:');
            const selectedDeck = isDifficult ? selectedValue.slice('difficult:'.length) : selectedValue;

            console.log(`Check your work for deck: ${selectedDeck} (difficult: ${isDifficult})`);

            const outputDiv = document.getElementById("check_output") as HTMLDivElement;
            if (outputDiv) {
                outputDiv.innerHTML = `<p>Loading answer key for ${selectedDeck}...</p>`;
            }

            try {
                let cards: CardDue[];

                if (isDifficult) {
                    const stored = localStorage.getItem(`difficultReview_${selectedDeck}`);
                    if (!stored) {
                        if (outputDiv) outputDiv.innerHTML = `<p class="no-cards">No difficult review found for "${selectedDeck}".</p>`;
                        return;
                    }
                    cards = (JSON.parse(stored).cards as any[]).map(convertToCardDue);
                } else {
                    cards = await getCardsUnderReviewInOrder(selectedDeck);
                }

                console.log(`Found ${cards.length} cards for ${selectedDeck}`);

                if (cards.length > 0) {
                    displayAnswerKey(cards, selectedDeck, isDifficult);
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

// Main function to call the backend endpoint
async function adjustIntervalsByAge(
    deck: string, 
    daysBack: number, 
    shiftPercentage: number, 
    updateInterval: boolean
): Promise<AdjustIntervalsResponse> {
    
    console.log(`📊 Adjusting intervals for deck "${deck}": ${daysBack} days back, ${(shiftPercentage * 100).toFixed(1)}% shift`);
    
    try {
        const response = await fetch('/adjust_intervals_by_age', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                deck: deck,
                days_back: daysBack,
                shift_percentage: shiftPercentage,
                update_interval: updateInterval
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result: AdjustIntervalsResponse = await response.json();
        console.log('Interval adjustment response:', result);
        
        return result;
    } catch (error) {
        console.error('Error adjusting intervals:', error);
        return { 
            status: 'error', 
            error: 'Network error adjusting intervals' 
        };
    }
}

// Function to create and show an interval adjustment modal
function showIntervalAdjustmentModal(): void {
    // Remove any existing modal
    const existingModal = document.getElementById('intervalAdjustmentModal');
    if (existingModal) {
        existingModal.remove();
    }

    // Create modal backdrop
    const modal = document.createElement('div');
    modal.id = 'intervalAdjustmentModal';
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
        animation: fadeIn 0.3s ease-out;
    `;

    // Create modal content
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: white;
        border-radius: 12px;
        width: 90%;
        max-width: 500px;
        padding: 0;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
        animation: slideIn 0.3s ease-out;
    `;

    modalContent.innerHTML = `
        <div style="padding: 24px; border-bottom: 1px solid #e1e5e9;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <h2 style="margin: 0; color: #333; font-size: 20px;">📊 Adjust Intervals by Card Age</h2>
                <button id="closeIntervalModal" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #666;">×</button>
            </div>
        </div>
        
        <div style="padding: 24px;">
            <div style="margin-bottom: 20px;">
                <label for="adjustDeckSelect" style="display: block; margin-bottom: 8px; font-weight: 600; color: #333;">Deck:</label>
                <select id="adjustDeckSelect" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px;">
                    <option value="">Select a deck...</option>
                    <option value="Ge'ez">Ge'ez</option>
                    <option value="Ancient Greek">Ancient Greek</option>
                    <option value="Sanskrit">Sanskrit</option>
                    <option value="Akkadian">Akkadian</option>
                    <option value="Hebrew">Hebrew</option>
                    <option value="Tocharian B">Tocharian B</option>
                </select>
            </div>
            
            <div style="margin-bottom: 20px;">
                <label for="daysBackInput" style="display: block; margin-bottom: 8px; font-weight: 600; color: #333;">Target cards added within last:</label>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <input type="number" id="daysBackInput" min="1" max="365" value="30" style="flex: 1; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px;">
                    <span style="color: #666; font-size: 14px;">days</span>
                </div>
                <small style="color: #666; font-size: 12px;">Cards created within this many days will be affected</small>
            </div>
            
            <div style="margin-bottom: 20px;">
                <label for="shiftPercentageInput" style="display: block; margin-bottom: 8px; font-weight: 600; color: #333;">Interval adjustment:</label>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <input type="number" id="shiftPercentageInput" min="-100" max="100" value="0" step="1" style="flex: 1; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px;">
                    <span style="color: #666; font-size: 14px;">%</span>
                </div>
                <small style="color: #666; font-size: 12px;">
                    Positive values increase intervals (easier), negative values decrease intervals (harder)<br>
                    Each card gets a random adjustment between 0 and your value
                </small>
            </div>
            
            <div style="margin-bottom: 24px;">
                <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                    <input type="checkbox" id="updateIntervalCheckbox" checked style="transform: scale(1.2);">
                    <span style="font-weight: 600; color: #333;">Update stored interval values</span>
                </label>
                <small style="color: #666; font-size: 12px; margin-left: 32px;">
                    If unchecked, only due dates change (temporary adjustment)
                </small>
            </div>
            
            <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
                <div style="color: #6c757d; font-size: 13px;">
                    <strong>Example:</strong> 30 days, +15% adjustment will randomly increase intervals of cards created in the last 30 days by 0-15%, making them slightly easier.
                </div>
            </div>
        </div>
        
        <div style="padding: 20px 24px; border-top: 1px solid #e1e5e9; display: flex; gap: 12px; justify-content: flex-end;">
            <button id="cancelIntervalAdjust" style="padding: 10px 20px; background: #6c757d; color: white; border: none; border-radius: 6px; cursor: pointer;">Cancel</button>
            <button id="executeIntervalAdjust" style="padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">Adjust Intervals</button>
        </div>
    `;

    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    // Add event listeners
    const closeBtn = document.getElementById('closeIntervalModal') as HTMLButtonElement;
    const cancelBtn = document.getElementById('cancelIntervalAdjust') as HTMLButtonElement;
    const executeBtn = document.getElementById('executeIntervalAdjust') as HTMLButtonElement;

    const closeModal = () => {
        modal.style.animation = 'fadeOut 0.3s ease-in';
        setTimeout(() => modal.remove(), 300);
    };

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    if (executeBtn) {
        executeBtn.addEventListener('click', async () => {
            const deckSelect = document.getElementById('adjustDeckSelect') as HTMLSelectElement;
            const daysBackInput = document.getElementById('daysBackInput') as HTMLInputElement;
            const shiftInput = document.getElementById('shiftPercentageInput') as HTMLInputElement;
            const updateCheckbox = document.getElementById('updateIntervalCheckbox') as HTMLInputElement;

            const deck = deckSelect.value.trim();
            const daysBack = parseInt(daysBackInput.value);
            const shiftPercent = parseFloat(shiftInput.value) / 100; // Convert to decimal
            const updateInterval = updateCheckbox.checked;

            // Validation
            if (!deck) {
                alert('Please select a deck');
                return;
            }
            if (daysBack < 1 || daysBack > 365) {
                alert('Days back must be between 1 and 365');
                return;
            }
            if (shiftPercent < -1 || shiftPercent > 1) {
                alert('Adjustment percentage must be between -100% and +100%');
                return;
            }

            // Confirmation
            const actionType = updateInterval ? 'permanently adjust intervals' : 'temporarily adjust due dates';
            const direction = shiftPercent > 0 ? 'increase' : (shiftPercent < 0 ? 'decrease' : 'not change');
            
            const confirmed = confirm(
                `${actionType.toUpperCase()} FOR DECK "${deck}"\n\n` +
                `• Target: Cards created in last ${daysBack} days\n` +
                `• Adjustment: ${direction} intervals by up to ${Math.abs(shiftPercent * 100)}%\n` +
                `• Mode: ${updateInterval ? 'Permanent' : 'Temporary'}\n\n` +
                `Continue?`
            );

            if (!confirmed) return;

            // Show loading state
            executeBtn.textContent = 'Processing...';
            executeBtn.disabled = true;

            try {
                const result = await adjustIntervalsByAge(deck, daysBack, shiftPercent, updateInterval);
                
                if (result.status === 'success') {
                    const message = `Success! Updated ${result.updated_count} of ${result.total_cards_found} cards in "${deck}"\n\n` +
                        `Average interval: ${result.average_old_interval?.toFixed(1)}d → ${result.average_new_interval?.toFixed(1)}d\n` +
                        `Completed in ${result.duration_seconds?.toFixed(2)} seconds`;
                    
                    alert(message);
                    closeModal();
                } else {
                    alert(`Error: ${result.error}`);
                    executeBtn.textContent = 'Adjust Intervals';
                    executeBtn.disabled = false;
                }
            } catch (error) {
                console.error('Error executing interval adjustment:', error);
                alert('Network error occurred');
                executeBtn.textContent = 'Adjust Intervals';
                executeBtn.disabled = false;
            }
        });
    }
}

// Function to add the interval adjustment button to an existing tab
function addIntervalAdjustmentControls(): void {
    // Add to the "Check Your Work" tab alongside retrievability controls
    const checkTab = document.getElementById('check_mainDiv');
    if (!checkTab) return;

    // Find or create management section
    let managementSection = checkTab.querySelector('.retrievability-management, .management-section');
    if (!managementSection) {
        managementSection = document.createElement('div');
        managementSection.className = 'management-section';
        managementSection.innerHTML = `
            <div style="margin-top: 40px; border-top: 2px solid #dee2e6; padding-top: 20px;">
                <h3>🛠️ Card Management Tools</h3>
            </div>
        `;
        checkTab.appendChild(managementSection);
    }

    // Add interval adjustment section if it doesn't exist
    if (!managementSection.querySelector('.interval-adjustment-section')) {
        const intervalSection = document.createElement('div');
        intervalSection.className = 'interval-adjustment-section';
        intervalSection.innerHTML = `
            <div style="margin-top: 20px; padding: 20px; background: #f8f9fa; border-radius: 8px; border: 1px solid #dee2e6;">
                <h4>📊 Interval Adjustment by Age</h4>
                <p style="margin-bottom: 15px; color: #666;">
                    Adjust intervals for recently added cards to fine-tune their difficulty.
                </p>
                <button id="openIntervalAdjustmentBtn" class="btn" style="background: #17a2b8; color: white;">
                    📊 Adjust Intervals by Card Age
                </button>
            </div>
        `;
        managementSection.appendChild(intervalSection);

        // Add event listener
        const openBtn = document.getElementById('openIntervalAdjustmentBtn');
        if (openBtn) {
            openBtn.addEventListener('click', showIntervalAdjustmentModal);
        }
    }
}

// Initialize the interval adjustment feature
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addIntervalAdjustmentControls);
} else {
    addIntervalAdjustmentControls();
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

