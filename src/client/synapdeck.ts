import {transliterateGeez, GeezDiacriticify, geezSpecialChars} from './synapdeck_files/transcribe_geez.js';
import {transliterateGreek} from './synapdeck_files/transcribe_ancient_greek.js';
import {transliterateCoptic} from './synapdeck_files/transcribe_coptic.js';
import {SanskritDiacriticify} from './synapdeck_files/transcribe_sanskrit.js';
import {AkkadianDiacriticify, akkadianSpecialChars} from './synapdeck_files/transcribe_akkadian.js';
import {OneWayCard, TwoWayCard, CardRelationships, ProcessedCard, processCard, arrayBufferToBase64, prepareTextForPDF, testCharacterRendering, loadGentiumForCanvas, renderTextToCanvas} from './synapdeck_files/synapdeck_lib.js'
import {postProcessSanskrit} from './synapdeck_files/transcribe_sanskrit.js';
import {hebrewSpecialChars, transliterateHebrew} from './synapdeck_files/transcribe_hebrew.js';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { createCardRelationshipGraph, CardNode, RelationshipLink } from './CardRelationshipGraph';

import { ReviewForecastOptions, updateDeckSelection, loadReviewForecast, createReviewForecastChart, setupReviewForecastTab } from './synapdeck_files/review_chart.js';
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
};

type charSetsType = {
    [key: string]: string[]
}

let specialCharSetsDict: charSetsType = {
    "Akkadian": akkadianSpecialChars,
    "Ancient Greek": [],
    "Coptic": ["ē", "ō", "š", "ḫ"],
    "Finnish": ["ä", "ö", "Ä", "Ö"],
    "Ge'ez": geezSpecialChars,
    "German": ["ä", "ö", "ü", "ß", "Ä", "Ö", "Ü"],
    "Gothic": ["þ", "ē", "ō", "ƕ", "á", "í", "ú", "ⁿ", "ⁱ"],
    "Hebrew": hebrewSpecialChars,
    "Hittite": ["ḫ", "š", "ā", "ē", "ī", "ū"],
    "Latin": ["ā", "ē", "ī", "ō", "ū", "Ā", "Ē", "Ī", "Ō", "Ū"],
    "Lithuanian": ["à", "á", "ã", "ą", "ą́", "ą̃", "č", "è", "é", "ẽ", "ę", "ę̃", "ę́", "ė", "ė̃", "ė́", "ì", "í", "ĩ", "į", "į́", "į̃", "l̃", "ó", "õ", "r̃", "ù", "ū", "ū̃", "ū́", "ų", "ų̃", "ų́", "š", "ỹ", "ý", "ž"],
    "Proto-Algonquian": ["θ", "č", "š", "·", "ʔ", "ẅ"],
    "Sanskrit": ["ā", "ī", "ū", "ṭ", "ḍ", "ṇ", "ṣ", "ś", "ñ", "ṅ", "ṛ", "ḷ", "ṝ", "ḹ", "ṃ", "ḥ", "◌́", "◌̀"],
    "Syriac": ["ā", "ē", "ê", "ḥ", "ṣ", "š", "ṭ", "ʾ", "ʿ"],    "Tocharian B": ["ā", "ä", "ṃ", "ñ", "ṅ", "ṣ", "ś"]
}

const SPREADSHEET_COLS: Record<string, string[]> = {
    'two-way': ['Target', 'Native', 'Target Back', 'Native Back', 'Coloring'],
    'one-way-N2T': ['Front', 'Back', 'Coloring']
};

// Pixel widths for each data column (excluding the row-number column)
const SPREADSHEET_COL_WIDTHS: Record<string, number[]> = {
    'two-way': [160, 160, 130, 130, 70],
    'one-way-N2T': [200, 200, 70]
};
let focusedSpreadsheetCell: HTMLTextAreaElement | null = null;

// Consolidate all global declarations
declare global {
    interface Window {
        Chart: any;
        loadReviewForecast: (chartData: ReviewForecastOptions) => Promise<void>;
        setupReviewForecastTab: () => void;
        createReviewForecastChart: (data: ReviewForecastData[], decks: string[], chartData: ReviewForecastOptions) => void;
        closeEditModal: () => void;
        saveAllFields: (cardId: number) => Promise<void>;
        performCardSearch: (page: number) => Promise<void>;
    }
}

window.createReviewForecastChart = createReviewForecastChart;

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

// Register the components you need
interface ReviewForecastData {
    date: string;
    [deck: string]: number | string;
}

interface ReviewForecastResponse {
    status: 'success' | 'error';
    forecast_data?: ReviewForecastData[];
    decks?: string[];
    date_range?: {
        start_date: string;
        end_date: string;
    };
    total_reviews?: number;
    error?: string;
}

// Color palette for decks
const DECK_COLORS = [
    '#ff4444', // Red for overdue cards (first color)
    '#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff7f', '#ff6b6b',
    '#4ecdc4', '#45b7d1', '#f9ca24', '#f0932b', '#eb4d4b', '#6c5ce7'
];


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


// Enhanced createSpecialCharactersPanel function
function createSpecialCharactersPanel(): void {
    console.log("Creating special characters panel...");
    
    const textInputSection = document.getElementById("textInputSection");
    if (!textInputSection) {
        console.error("textInputSection not found");
        return;
    }

    // Check if panel already exists
    let existingPanel = document.getElementById("specialCharsPanel");
    if (existingPanel) {
        existingPanel.remove();
    }

    // Create the panel container
    const panel = document.createElement("div");
    panel.id = "specialCharsPanel";
    panel.className = "special-chars-panel";
    panel.style.marginTop = "15px";
    panel.style.padding = "10px";
    panel.style.border = "1px solid #ddd";
    panel.style.borderRadius = "5px";
    panel.style.backgroundColor = "#f8f9fa";
    
    const panelTitle = document.createElement("h4");
    panelTitle.textContent = "Special Characters";
    panelTitle.className = "special-chars-title";
    panelTitle.style.margin = "0 0 10px 0";
    panelTitle.style.fontSize = "14px";
    panelTitle.style.fontWeight = "bold";
    
    const charGrid = document.createElement("div");
    charGrid.id = "specialCharsGrid";
    charGrid.className = "special-chars-grid";
    charGrid.style.display = "flex";
    charGrid.style.flexWrap = "wrap";
    charGrid.style.gap = "4px";
    
    panel.appendChild(panelTitle);
    panel.appendChild(charGrid);
    
    // Insert into whichever input section is currently active
    const spreadsheetRadio = document.getElementById('spreadsheetInputRadio') as HTMLInputElement;
    if (spreadsheetRadio?.checked) {
        const spreadsheetSection = document.getElementById('spreadsheetSection');
        if (spreadsheetSection) {
            spreadsheetSection.appendChild(panel);
            console.log("Panel appended to spreadsheetSection");
        }
    } else {
        const textarea = document.getElementById("cardTextInput");
        if (textarea && textarea.parentNode) {
            textarea.parentNode.insertBefore(panel, textarea.nextSibling);
            console.log("Panel inserted after textarea");
        } else {
            textInputSection.appendChild(panel);
        }
    }
}

// Enhanced updateSpecialCharacters function with better debugging
function updateSpecialCharacters(deckName: string): void {
    const panel = document.getElementById("specialCharsPanel");
    const charGrid = document.getElementById("specialCharsGrid");
    
    if (!panel || !charGrid) {
        return;
    }

    // Clear existing characters
    charGrid.innerHTML = "";

    // Get characters for the selected deck
    const characters = specialCharSetsDict[deckName];    
    if (!characters || characters.length === 0) {
        panel.style.display = "none";
        return;
    }

    panel.style.display = "block";

    // Create buttons for each character
    characters.forEach((char: string, index: number) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "special-char-btn";
        button.style.fontSize = "30px";
        button.style.margin = "2px";
        button.style.padding = "5px 8px";
        button.style.border = "1px solid #ccc";
        button.style.borderRadius = "4px";
        button.style.backgroundColor = "#f9f9f9";
        button.style.cursor = "pointer";
        button.textContent = char;
        button.title = `Insert ${char}`;
        
        // Add hover effect
        button.addEventListener("mouseover", () => {
            button.style.backgroundColor = "#e9e9e9";
        });
        button.addEventListener("mouseout", () => {
            button.style.backgroundColor = "#f9f9f9";
        });
        
        // Add click handler to insert character
        button.addEventListener("click", () => {
            insertCharacterAtCursor(char);
        });
        
        charGrid.appendChild(button);
    });
}

// ── Spreadsheet functions ──────────────────────────────────────────────────

function buildSpreadsheet(cardType: string): void {
    const container = document.getElementById('cardSpreadsheet');
    if (!container) return;

    const cols = SPREADSHEET_COLS[cardType] ?? SPREADSHEET_COLS['two-way'];

    container.innerHTML = '';

    const table = document.createElement('table');
    table.className = 'card-spreadsheet';
    table.id = 'spreadsheetTable';

    // Explicit column widths so the table doesn't stretch to fill the page
    const colWidths = SPREADSHEET_COL_WIDTHS[cardType] ?? SPREADSHEET_COL_WIDTHS['two-way'];
    const colgroup = document.createElement('colgroup');
    const colNum = document.createElement('col');
    colNum.style.width = '36px';
    colgroup.appendChild(colNum);
    colWidths.forEach(w => {
        const col = document.createElement('col');
        col.style.width = w + 'px';
        colgroup.appendChild(col);
    });
    table.appendChild(colgroup);

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');

    const thNum = document.createElement('th');
    thNum.className = 'row-number-header';
    thNum.textContent = '#';
    headerRow.appendChild(thNum);

    cols.forEach(col => {
        const th = document.createElement('th');
        th.textContent = col;
        headerRow.appendChild(th);
    });

    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    tbody.id = 'spreadsheetBody';
    table.appendChild(tbody);

    container.appendChild(table);

    for (let i = 0; i < 5; i++) {
        addSpreadsheetRow();
    }
}

function addSpreadsheetRow(): void {
    const tbody = document.getElementById('spreadsheetBody');
    if (!tbody) return;

    const cardFormatEl = document.getElementById('card_format_dropdown') as HTMLSelectElement;
    const cardType = cardFormatEl?.value ?? 'two-way';
    const cols = SPREADSHEET_COLS[cardType] ?? SPREADSHEET_COLS['two-way'];

    const rowNum = tbody.children.length + 1;
    const tr = document.createElement('tr');

    const tdNum = document.createElement('td');
    tdNum.className = 'row-number-cell';
    tdNum.textContent = String(rowNum);
    tr.appendChild(tdNum);

    cols.forEach((_col, colIdx) => {
        const td = document.createElement('td');
        const textarea = document.createElement('textarea');
        textarea.rows = 1;
        textarea.addEventListener('focus', () => {
            focusedSpreadsheetCell = textarea;
        });
        textarea.addEventListener('input', () => {
            textarea.style.height = 'auto';
            textarea.style.height = textarea.scrollHeight + 'px';
        });
        textarea.addEventListener('keydown', (e) => {
            const text = textarea.value;
            const pos = textarea.selectionStart ?? 0;
            if (e.key === 'ArrowUp') {
                const isFirstLine = text.lastIndexOf('\n', pos - 1) === -1;
                if (isFirstLine) { e.preventDefault(); moveSpreadsheetFocusVertical(tr, colIdx, -1); }
            } else if (e.key === 'ArrowDown') {
                const isLastLine = text.indexOf('\n', pos) === -1;
                if (isLastLine) { e.preventDefault(); moveSpreadsheetFocusVertical(tr, colIdx, 1); }
            } else if (e.key === 'ArrowLeft') {
                if (pos === 0 && textarea.selectionEnd === 0) { e.preventDefault(); moveSpreadsheetFocusHorizontal(tr, colIdx, -1); }
            } else if (e.key === 'ArrowRight') {
                if (pos === text.length && textarea.selectionEnd === text.length) { e.preventDefault(); moveSpreadsheetFocusHorizontal(tr, colIdx, 1); }
            }
        });
        td.appendChild(textarea);
        tr.appendChild(td);
    });

    tbody.appendChild(tr);
}

function getNotesFromSpreadsheet(): NoteToProcess[] {
    const tbody = document.getElementById('spreadsheetBody') as HTMLTableSectionElement | null;
    if (!tbody) return [];

    const cardFormatEl = document.getElementById('card_format_dropdown') as HTMLSelectElement;
    const cardType = cardFormatEl?.value ?? 'two-way';

    let noteType = '';
    let baseProcessList: string[] = [];
    if (cardType === 'two-way') {
        noteType = 'Two-Way';
        baseProcessList = [currentDeck, '', currentDeck, '', ''];
    } else if (cardType === 'one-way-N2T') {
        noteType = 'One-Way';
        baseProcessList = ['', currentDeck, ''];
    }

    const notes: NoteToProcess[] = [];

    Array.from(tbody.rows).forEach(row => {
        const cells = Array.from(row.cells).slice(1); // skip row-number cell
        const fieldValues = cells.map(td => {
            const ta = td.querySelector('textarea');
            return ta ? ta.value.trim() : '';
        });

        if (fieldValues.every(v => v === '')) return;

        let dataList = [...fieldValues];
        let processList = [...baseProcessList];

        if (noteType === 'Two-Way') {
            // Ensure exactly 5 fields: Target, Native, Target_Back, Native_Back, Coloring
            while (dataList.length < 5) { dataList.push(''); }
            // Auto-fill Target_Back and Native_Back if left blank
            if (dataList[2] === '') dataList[2] = dataList[0];
            if (dataList[3] === '') dataList[3] = dataList[1];
        } else if (noteType === 'One-Way') {
            // Ensure exactly 3 fields: Front, Back, Coloring
            while (dataList.length < 3) { dataList.push(''); }
        }

        if (currentDeck === 'Sanskrit') {
            for (let j = 0; j < dataList.length; j++) {
                if (processList[j] === 'Sanskrit') {
                    dataList[j] = postProcessSanskrit(dataList[j]);
                }
            }
        }

        notes.push({
            deck: currentDeck,
            noteType,
            dataList,
            processList,
            relationships: { peers: [], prereqs: [], dependents: [] }
        });
    });

    return notes;
}

function getSpreadsheetCellTextarea(row: HTMLTableRowElement, dataColIdx: number): HTMLTextAreaElement | null {
    const cell = row.cells[dataColIdx + 1]; // +1 to skip row-number cell
    return cell ? (cell.querySelector('textarea') as HTMLTextAreaElement | null) : null;
}

function moveSpreadsheetFocusVertical(currentRow: HTMLTableRowElement, dataColIdx: number, dir: -1 | 1): void {
    const tbody = document.getElementById('spreadsheetBody') as HTMLTableSectionElement | null;
    if (!tbody) return;
    const rows = Array.from(tbody.rows) as HTMLTableRowElement[];
    const rowIdx = rows.indexOf(currentRow);
    const targetRow = rows[rowIdx + dir];
    if (!targetRow) return;
    const target = getSpreadsheetCellTextarea(targetRow, dataColIdx);
    if (!target) return;
    target.focus();
    const pos = dir === 1 ? 0 : target.value.length;
    target.setSelectionRange(pos, pos);
}

function moveSpreadsheetFocusHorizontal(currentRow: HTMLTableRowElement, dataColIdx: number, dir: -1 | 1): void {
    const tbody = document.getElementById('spreadsheetBody') as HTMLTableSectionElement | null;
    if (!tbody) return;
    const rows = Array.from(tbody.rows) as HTMLTableRowElement[];
    const cardFormatEl = document.getElementById('card_format_dropdown') as HTMLSelectElement;
    const cardType = cardFormatEl?.value ?? 'two-way';
    const numCols = (SPREADSHEET_COLS[cardType] ?? SPREADSHEET_COLS['two-way']).length;
    const rowIdx = rows.indexOf(currentRow);

    let targetRow = currentRow;
    let targetColIdx = dataColIdx + dir;

    if (targetColIdx < 0) {
        if (rowIdx <= 0) return;
        targetRow = rows[rowIdx - 1];
        targetColIdx = numCols - 1;
    } else if (targetColIdx >= numCols) {
        if (rowIdx >= rows.length - 1) return;
        targetRow = rows[rowIdx + 1];
        targetColIdx = 0;
    }

    const target = getSpreadsheetCellTextarea(targetRow, targetColIdx);
    if (!target) return;
    target.focus();
    const pos = dir === -1 ? target.value.length : 0;
    target.setSelectionRange(pos, pos);
}

// ── End spreadsheet functions ──────────────────────────────────────────────

// Add this function to insert character at cursor position in textarea
function insertCharacterAtCursor(character: string): void {
    if (character == "◌́") {
        character = "\u0301";
    } else if (character == "◌̀") {
        character = "\u0300";
    }

    const spreadsheetRadio = document.getElementById('spreadsheetInputRadio') as HTMLInputElement;
    const isSpreadsheet = spreadsheetRadio?.checked;
    const textarea: HTMLTextAreaElement | null = isSpreadsheet
        ? focusedSpreadsheetCell
        : document.getElementById("cardTextInput") as HTMLTextAreaElement;
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

    // Focus back on the target
    textarea.focus();

    // Trigger input event (updates currentFileContent in text mode; auto-grows in spreadsheet mode)
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

// Track session IDs per deck (deck name → session ID)
const currentSessionIds = new Map<string, number>();


// Add type definitions at the top of your file
interface NoteToProcess {
    deck: string;
    noteType: string;
    dataList: string[];
    processList: string[];
    relationships: CardRelationships;
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

let currentFileContent: string = "";
let currentDeck: string = "";
let uploadDeckDropdown = document.getElementById("upload_dropdownMenu") as HTMLSelectElement;// Optional: Also handle when radio buttons change to reset the content

// Also fix the text radio button event listener to be more explicit
const textRadio = document.getElementById('textInputRadio') as HTMLInputElement;
const fileRadio = document.getElementById('fileInputRadio') as HTMLInputElement;
const cardFormatDropdownDiv = document.getElementById("cardFormatSection") as HTMLDivElement;
const cardFormatDropdown = document.getElementById("card_format_dropdown") as HTMLSelectElement;

// Initialize visibility on page load
if (fileRadio.checked) {
    cardFormatDropdownDiv.style.display = "none";
}

// Enhanced deck dropdown event listener with better debugging

// First, make sure we get the right dropdown element
if (uploadDeckDropdown) {
    // Remove the old event listener by cloning the element
    const newUploadDropdown = uploadDeckDropdown.cloneNode(true) as HTMLSelectElement;
    if (uploadDeckDropdown.parentNode) {
        uploadDeckDropdown.parentNode.replaceChild(newUploadDropdown, uploadDeckDropdown);
    }
    
    console.log("Upload deck dropdown event listener setup...");
    
    // Add the corrected event listener
    newUploadDropdown.addEventListener('change', (event) => {
        // Prevent this event from bubbling up and triggering other listeners
        event.stopPropagation();
        event.preventDefault();
        
        const selectedValue = (event.target as HTMLSelectElement).value;
        currentDeck = selectedValue;

        console.log(`UPLOAD TAB: Deck changed to: "${currentDeck}"`);
        
        // Only update special characters if we're in text input mode
        const textRadio = document.getElementById('textInputRadio') as HTMLInputElement;
        const uploadTab = document.getElementById('upload_mainDiv');
        const isUploadTabActive = uploadTab?.classList.contains('active');
        
        console.log(`Upload tab active: ${isUploadTabActive}, Text radio checked: ${textRadio?.checked}`);
        
        if (textRadio && textRadio.checked && isUploadTabActive) {
            console.log("Conditions met - updating special characters...");
            updateSpecialCharacters(currentDeck);
        } else {
            console.log("Conditions not met - skipping special characters update");
            console.log(`  Upload tab active: ${isUploadTabActive}`);
            console.log(`  Text radio checked: ${textRadio?.checked}`);
        }
    });
}

// Enhanced radio button event listeners with proper text input area management

if (textRadio) {
    textRadio.addEventListener('change', function() {
        if (this.checked) {
            console.log('Text input mode selected');
            document.getElementById("fileUploadSection")!.style.display = "none";

            // Show the card format dropdown
            cardFormatDropdownDiv.style.display = "block";

            // Show the text input section
            const textInputSection = document.getElementById("textInputSection");
            if (textInputSection) {
                textInputSection.style.display = "block";
            }

            // Show the textarea specifically
            const cardTextInput = document.getElementById("cardTextInput") as HTMLTextAreaElement;
            if (cardTextInput) {
                cardTextInput.style.display = "block";
                if (cardTextInput.parentElement) {
                    cardTextInput.parentElement.style.display = "block";
                }
            }

            // HIDE FILE INPUT SECTION
            const fileInputSection = document.getElementById("fileInputSection");
            if (fileInputSection) {
                fileInputSection.style.display = "none";
            }

            // Hide spreadsheet section
            const spreadsheetSection = document.getElementById("spreadsheetSection");
            if (spreadsheetSection) {
                spreadsheetSection.style.display = "none";
            }

            // Create special characters panel when switching to text mode
            createSpecialCharactersPanel();

            // Update special characters if a deck is already selected
            if (currentDeck) {
                console.log(`Updating special characters for already selected deck: ${currentDeck}`);
                updateSpecialCharacters(currentDeck);
            }
        }
    });
}

if (fileRadio) {
    fileRadio.addEventListener('change', function() {
        if (this.checked) {
            console.log('File input mode selected');
            document.getElementById("fileUploadSection")!.style.display = "block";

            // Hide the card format dropdown
            cardFormatDropdownDiv.style.display = "none";

            // Hide the text input section
            const textInputSection = document.getElementById("textInputSection");
            if (textInputSection) {
                textInputSection.style.display = "none";
            }

            // Hide the textarea specifically
            const cardTextInput = document.getElementById("cardTextInput") as HTMLTextAreaElement;
            if (cardTextInput) {
                cardTextInput.style.display = "none";
            }

            // Hide special characters panel when switching to file mode
            const specialCharsPanel = document.getElementById("specialCharsPanel");
            if (specialCharsPanel) {
                specialCharsPanel.style.display = "none";
            }

            // Hide spreadsheet section
            const spreadsheetSection = document.getElementById("spreadsheetSection");
            if (spreadsheetSection) {
                spreadsheetSection.style.display = "none";
            }

            // SHOW FILE INPUT SECTION
            const fileInputSection = document.getElementById("fileInputSection");
            if (fileInputSection) {
                fileInputSection.style.display = "block";
            }
        }
    });
}

const spreadsheetInputRadio = document.getElementById('spreadsheetInputRadio') as HTMLInputElement;
if (spreadsheetInputRadio) {
    spreadsheetInputRadio.addEventListener('change', function() {
        if (this.checked) {
            console.log('Spreadsheet input mode selected');

            // Hide other sections
            document.getElementById("fileUploadSection")!.style.display = "none";
            const textInputSection = document.getElementById("textInputSection");
            if (textInputSection) textInputSection.style.display = "none";
            const cardTextInput = document.getElementById("cardTextInput") as HTMLTextAreaElement;
            if (cardTextInput) cardTextInput.style.display = "none";

            // Show card format dropdown and spreadsheet section
            cardFormatDropdownDiv.style.display = "block";
            const spreadsheetSection = document.getElementById("spreadsheetSection");
            if (spreadsheetSection) spreadsheetSection.style.display = "block";

            // Build the spreadsheet if not already built
            const tbody = document.getElementById('spreadsheetBody');
            if (!tbody) {
                buildSpreadsheet(cardFormatDropdown?.value ?? 'two-way');
            }

            // Move special chars panel into the spreadsheet section and update
            createSpecialCharactersPanel();
            if (currentDeck) {
                updateSpecialCharacters(currentDeck);
            }
        }
    });
}

const addSpreadsheetRowBtn = document.getElementById('addSpreadsheetRow');
if (addSpreadsheetRowBtn) {
    addSpreadsheetRowBtn.addEventListener('click', () => {
        addSpreadsheetRow();
    });
}

// Initialize special characters panel on page load if text mode is selected
document.addEventListener('DOMContentLoaded', function() {
    const textRadio = document.getElementById('textInputRadio') as HTMLInputElement;
    
    if (textRadio && textRadio.checked) {
        console.log('Page loaded with text input mode - creating special characters panel');
        createSpecialCharactersPanel();
        
        // If a deck is pre-selected, update the characters
        const uploadDropdown = document.getElementById("upload_dropdownMenu") as HTMLSelectElement;
        if (uploadDropdown && uploadDropdown.value) {
            console.log(`Page loaded with pre-selected deck: ${uploadDropdown.value}`);
            updateSpecialCharacters(uploadDropdown.value);
        }
    }
});

// Also add this to the text input event listener to keep the panel updated
const cardTextInput = document.getElementById("cardTextInput") as HTMLTextAreaElement;
if (cardTextInput) {
    cardTextInput.addEventListener('input', function() {
        currentFileContent = this.value;
    });
}

function transcribe(str: string, process: string = "", otherProcess: string = "", optionalBoolean: boolean = true): string {
    let rawSegments: TextSegment[] = parseTaggedText(str, otherProcess);
    
    const processors: Record<string, (text: string) => string> = {
        "Coptic": (text) => transliterateCoptic(text),
        "Ge'ez": (text) => transliterateGeez(text, optionalBoolean),
        "Ancient Greek": (text) => transliterateGreek(text),
        "Hebrew": (text) => transliterateHebrew(text, true),
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

let uploadSubmitButton = document.getElementById("upload_submitBtn") as HTMLButtonElement;
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
async function sendNoteToBackend(deck: string, note_type: string, field_values: string[], field_processing: string[],  createdTimestamp: string) {
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
        // Don't include relationships here
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
            
            // Return both the result and the relationships for later processing
            return {
                ...result,
                primary_field: field_values[0], // Store the primary field for lookup
                deck: deck
            };
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
    //Let's just...do nothing here for now, for safety.
    /*
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
    */
}

if (cardFormatDropdown) {
    cardFormatDropdown.addEventListener('change', (event) => {
        const newType = (event.target as HTMLSelectElement).value;
        console.log('Card format changed:', newType);

        // Rebuild the spreadsheet when card type changes and spreadsheet mode is active
        const spreadsheetRadio = document.getElementById('spreadsheetInputRadio') as HTMLInputElement;
        if (spreadsheetRadio?.checked) {
            buildSpreadsheet(newType);
        }
    });
}

// Modified submit button event listener
uploadSubmitButton.addEventListener('click', async () => {
    let currentNoteType = "";
    const lines = currentFileContent.split('\n');

    //console.log(currentDeck);

    let thisNoteProcessList: string[] = [];
    if (cardFormatDropdown && (currentDeck != "")) {
        if (cardFormatDropdown.value == "two-way") {
            currentNoteType = "Two-Way";
            thisNoteProcessList = [currentDeck, "", currentDeck, ""];
        } else if (cardFormatDropdown.value == "one-way-N2T") {
            currentNoteType = "One-Way";
            thisNoteProcessList = ["", currentDeck];
        }
    }
    
    // Collect all notes — branch on input mode
    const isSpreadsheetMode = (document.getElementById('spreadsheetInputRadio') as HTMLInputElement)?.checked;
    let notesToProcess: NoteToProcess[];

    if (isSpreadsheetMode) {
        notesToProcess = getNotesFromSpreadsheet();
    } else {
        notesToProcess = [];
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trim();
            if (line.length == 0 || !line.includes(" / ")) {
                continue;
            }

            let cardData: ProcessedCard = processCard(line);
            let thisNoteDataList: string[] = cardData.fields;

            // CREATE A FRESH COPY for each card - don't modify the shared array!
            let thisCardProcessList: string[] = [...thisNoteProcessList];

            if (currentNoteType === "One-Way") {
                // One way cards should have exactly 2 fields
                if (thisNoteDataList.length > 2) {
                    console.warn(`One-Way card has ${thisNoteDataList.length} fields, truncating to 2`);
                    thisNoteDataList = thisNoteDataList.slice(0, 2);
                }
                if (thisCardProcessList.length > 2) {
                    thisCardProcessList = thisCardProcessList.slice(0, 2);
                }
            }

            if (thisCardProcessList.length != thisNoteDataList.length) {
                const maxLength = Math.max(thisCardProcessList.length, thisNoteDataList.length);

                // Extend processing list if needed
                while (thisCardProcessList.length < maxLength) {
                    thisCardProcessList.push("");
                }

                // Smart extension for data list
                while (thisNoteDataList.length < maxLength) {
                    if (currentNoteType === "Two-Way" && thisNoteDataList.length === 3 && maxLength === 4) {
                        thisNoteDataList.push(thisNoteDataList[1]);
                    } else {
                        thisNoteDataList.push("");
                    }
                }
            }

            if (currentDeck == "Sanskrit") {
                for (let j = 0; j < thisNoteDataList.length; j++) {
                    if (thisCardProcessList[j] == "Sanskrit") {
                        thisNoteDataList[j] = postProcessSanskrit(thisNoteDataList[j]);
                    }
                }
            }

            // Done here, not in cleanFieldDatum, to grandfather in existing Greek cards.
            notesToProcess.push({
                deck: currentDeck,
                noteType: currentNoteType,
                dataList: thisNoteDataList,
                processList: thisCardProcessList,  // Use the card-specific copy
                relationships: cardData.relationships
            });
        }
    }
    
    // Now process notes sequentially with delays to avoid deadlocks
    console.log(`Processing ${notesToProcess.length} notes sequentially...`);

    const cardsWithRelationships: Array<{
        cardIds: number[],
        deck: string,
        primaryField: string,
        relationships: CardRelationships
    }> = [];
    
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
                
                // Store for relationship processing if there are any relationships
                const hasRelationships = note.relationships.peers.length > 0 || 
                                    note.relationships.prereqs.length > 0 || 
                                    note.relationships.dependents.length > 0;
                
                if (hasRelationships) {
                    cardsWithRelationships.push({
                        cardIds: result.card_ids,
                        deck: note.deck,
                        primaryField: note.dataList[0], // First field is primary
                        relationships: note.relationships
                    });
                }
            } else {
                console.error(`✗ Note ${i + 1} failed:`, result.error);
            }
            
            // Add delay between requests
            if (i < notesToProcess.length - 1) {
                await delay(100);
            }
            
        } catch (error) {
            console.error(`✗ Note ${i + 1} error:`, error);
        }
    }

// Phase 2: Process relationships after all cards are created
    if (cardsWithRelationships.length > 0) {
        console.log(`Processing relationships for ${cardsWithRelationships.length} card sets...`);
        await processAllRelationships(cardsWithRelationships);
    }

    if (isSpreadsheetMode) {
        buildSpreadsheet(cardFormatDropdown?.value ?? 'two-way');
    } else {
        const textInput = document.getElementById("cardTextInput") as HTMLTextAreaElement;
        if (textInput) {
            textInput.value = "";
        }
        currentFileContent = "";
    }
    console.log('All notes processed!');
});

async function findCardByPrimaryField(deck: string, primaryValue: string): Promise<{card_id: number} | null> {
    try {
        const response = await fetch('/find_card_by_primary_field', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                deck: deck,
                primary_field_value: primaryValue 
            })
        });
        
        const result = await response.json();
        return result.status === 'success' ? result : null;
    } catch (error) {
        console.error('Error finding card:', error);
        return null;
    }
}

async function processAllRelationships(cardsWithRelationships: Array<{
    cardIds: number[],
    deck: string,
    primaryField: string,
    relationships: CardRelationships
}>): Promise<void> {
    
    for (const cardSet of cardsWithRelationships) {
        const { cardIds, deck, relationships } = cardSet;
        
        console.log(`🔗 Processing relationships for ${cardIds.length} cards in deck "${deck}"`);
        
        // For each card created from this note
        for (const cardId of cardIds) {
            // Create peer relationships
            for (const peerPrimary of relationships.peers) {
                try {
                    const peerResult = await findCardByPrimaryField(deck, peerPrimary);
                    if (peerResult && peerResult.card_id) {
                        console.log(`Creating peer relationship: ${cardId} <-> ${peerResult.card_id}`);
                        await createCardRelationship(cardId, peerResult.card_id, 'peer', true); // between_notes = true
                    } else {
                        console.warn(`Peer card not found: "${peerPrimary}" in deck "${deck}"`);
                    }
                } catch (error) {
                    console.error(`Error creating peer relationship for "${peerPrimary}":`, error);
                }
                
                // Add small delay to avoid overwhelming the server
                await delay(50);
            }
            
            // Create prerequisite relationships (this card depends on prereqs)
            for (const prereqPrimary of relationships.prereqs) {
                try {
                    const prereqResult = await findCardByPrimaryField(deck, prereqPrimary);
                    if (prereqResult && prereqResult.card_id) {
                        console.log(`Creating prereq relationship: ${cardId} depends on ${prereqResult.card_id}`);
                        await createCardRelationship(cardId, prereqResult.card_id, 'dependent', true);
                    } else {
                        console.warn(`Prereq card not found: "${prereqPrimary}" in deck "${deck}"`);
                    }
                } catch (error) {
                    console.error(`Error creating prereq relationship for "${prereqPrimary}":`, error);
                }
                
                await delay(50);
            }
            
            // Create dependent relationships (dependents depend on this card)
            for (const depPrimary of relationships.dependents) {
                try {
                    const depResult = await findCardByPrimaryField(deck, depPrimary);
                    if (depResult && depResult.card_id) {
                        console.log(`Creating dependent relationship: ${depResult.card_id} depends on ${cardId}`);
                        await createCardRelationship(depResult.card_id, cardId, 'dependent', true);
                    } else {
                        console.warn(`Dependent card not found: "${depPrimary}" in deck "${deck}"`);
                    }
                } catch (error) {
                    console.error(`Error creating dependent relationship for "${depPrimary}":`, error);
                }
                
                await delay(50);
            }
        }
    }
    console.log('✅ Finished processing all relationships');
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
            src: url('/Gentium/GentiumPlus-Regular.ttf') format('truetype');
            font-weight: normal;
            font-style: normal;
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
                <div class="qa-cell">
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

    const deckOptions = deckNameList.map(deck => 
        `<option value="${deck}">${deck}</option>`
    ).join('');

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
                            ${deckOptions}
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
                            <option value="One Way">One Way</option>
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
                    <div class="content-preview" title="${escapeHtml(stripHtml(frontText))}">
                        ${truncateText(stripHtml(frontText), 50)}
                    </div>
                </td>
                <td class="content-cell back-cell">
                    <div class="content-preview" title="${escapeHtml(stripHtml(backText))}">
                        ${truncateText(stripHtml(backText), 50)}
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
                        <button class="btn btn-small edit-card-btn" data-card-id="${card.card_id}" title="Edit note">
                            ✏️
                        </button>
                        <button class="btn btn-small relationship-btn" data-card-id="${card.card_id}" title="Manage relationships">
                            🔗
                        </button>
                        <button class="btn btn-small history-btn" data-card-id="${card.card_id}" title="View history">
                            📜
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

function stripHtml(html: string): string {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || '';
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

        else if (target.classList.contains('relationship-btn') || target.closest('.relationship-btn')) {
            event.preventDefault();
            event.stopPropagation();
            
            const button = target.classList.contains('relationship-btn') ? target : target.closest('.relationship-btn') as HTMLElement;
            const cardId = button?.getAttribute('data-card-id');
            
            // Prevent rapid clicking
            if (button?.dataset.processing === 'true') {
                console.log('Button already processing, ignoring click');
                return;
            }
    
            if (cardId) {
                console.log(`Relationship button clicked for card ${cardId}`);
                button.dataset.processing = 'true';
                
                showCardRelationshipModal(parseInt(cardId)).finally(() => {
                    // Reset the processing flag after a delay
                    setTimeout(() => {
                        button.dataset.processing = 'false';
                    }, 1000);
                });
            } else {
                console.error('No card ID found for relationship button');
            }
        }

        else if (target.classList.contains('history-btn') || target.closest('.history-btn')) {
            event.preventDefault();
            event.stopPropagation();

            const button = target.classList.contains('history-btn') ? target : target.closest('.history-btn') as HTMLElement;
            const cardId = button?.getAttribute('data-card-id');

            if (button?.dataset.processing === 'true') {
                return;
            }

            if (cardId) {
                button.dataset.processing = 'true';

                showCardHistoryModal(parseInt(cardId)).finally(() => {
                    setTimeout(() => {
                        button.dataset.processing = 'false';
                    }, 1000);
                });
            }
        }
    });

    // Log button count for debugging
    const editButtons = resultsDiv.querySelectorAll('.edit-card-btn');
    const deleteButtons = resultsDiv.querySelectorAll('.delete-card-btn');
    console.log(`Set up action handlers for ${editButtons.length} edit buttons and ${deleteButtons.length} delete buttons`);
}

// Add these interfaces first
interface CreateCardRelationshipRequest {
    card_a_id: number;
    card_b_id: number;
    relationship: 'peer' | 'dependent' | 'prereq';
    between_notes?: boolean; // Add this
}

interface CreateCardRelationshipResponse {
    status: 'success' | 'error';
    card_a_id?: number;
    card_b_id?: number;
    relationship?: string;
    changes_made?: {
        card_a_changes: string[];
        card_b_changes: string[];
    };
    error?: string;
    details?: string;
}

// API functions
async function createCardRelationship(cardAId: number, cardBId: number, relationship: 'peer' | 'dependent' | 'prereq', betweenNotes?: boolean): Promise<CreateCardRelationshipResponse> {
    try {
        const response = await fetch('/create_card_relationship', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                card_a_id: cardAId,
                card_b_id: cardBId,
                relationship: relationship,
                between_notes: betweenNotes
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result: CreateCardRelationshipResponse = await response.json();
        console.log('Create relationship response:', result);
        
        return result;
    } catch (error) {
        console.error('Error creating card relationship:', error);
        return { 
            status: 'error', 
            error: 'Network error creating card relationship' 
        };
    }
}

async function removeCardRelationship(cardAId: number, cardBId: number, relationship: 'peer' | 'dependent' | 'prereq'): Promise<CreateCardRelationshipResponse> {
    try {
        const response = await fetch('/remove_card_relationship', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                card_a_id: cardAId,
                card_b_id: cardBId,
                relationship: relationship
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result: CreateCardRelationshipResponse = await response.json();
        return result;
    } catch (error) {
        console.error('Error removing card relationship:', error);
        return { 
            status: 'error', 
            error: 'Network error removing card relationship' 
        };
    }
}

// Main function to show the relationship modal
async function showCardRelationshipModal(cardId: number): Promise<void> {
    console.log(`Opening relationship manager for card ${cardId}`);

    // CRITICAL: Always clean up any existing modals first
    const existingModal = document.getElementById('cardRelationshipModal');
    if (existingModal) {
        console.log('Removing existing modal');
        existingModal.remove();
    }

    // Also clean up any loading modals
    const existingLoadingModal = document.getElementById('cardEditModal');
    if (existingLoadingModal) {
        existingLoadingModal.remove();
    }

    // Add a flag to prevent multiple simultaneous opens
    if ((window as any).relationshipModalOpening) {
        console.log('Modal already opening, ignoring duplicate request');
        return;
    }
    (window as any).relationshipModalOpening = true;

    try {
        // Show loading first
        showLoadingModal(`Loading relationships for card ${cardId}...`);

        // Get card details
        const response = await fetch(`/card/${cardId}`);
        const cardDetails = await response.json();
        
        if (cardDetails.status !== 'success') {
            throw new Error(cardDetails.error || 'Failed to load card details');
        }

        // Remove loading modal
        const loadingModal = document.getElementById('cardEditModal');
        if (loadingModal) {
            loadingModal.remove();
        }
        
        // Create the relationship modal
        showRelationshipModal(cardId, cardDetails.card);
        
    } catch (error: unknown) {
        console.error('Error loading card relationships:', error);
        closeRelationshipModal();
        const message = error instanceof Error ? error.message : 'Unknown error';
        showToast(`Failed to load relationships for card ${cardId}: ${message}`, 'error');
    } finally {
        // Reset the flag
        (window as any).relationshipModalOpening = false;
    }
}


// Function to create the relationship modal
function showRelationshipModal(cardId: number, cardData: any): void {
    // Double-check that no modal exists
    const existingModal = document.getElementById('cardRelationshipModal');
    if (existingModal) {
        console.log('Modal already exists, removing it first');
        existingModal.remove();
    }

    const modal = document.createElement('div');
    modal.id = 'cardRelationshipModal';
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

    // Create the modal content
    modal.innerHTML = `
        <div style="
            background: white;
            border-radius: 12px;
            width: 90%;
            max-width: 600px;
            max-height: 80vh;
            overflow: hidden;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
            animation: slideIn 0.3s ease-out;
        ">
            <!-- Modal Header -->
            <div style="
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 20px 24px;
                border-bottom: 1px solid #e1e5e9;
                background: #f8f9fa;
            ">
                <h2 style="margin: 0; color: #333; font-size: 20px; font-weight: 600;">
                    🔗 Manage Relationships - Card ${cardId}
                </h2>
                <button id="closeRelationshipModal_${cardId}" style="
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
                " onmouseover="this.style.background='#e9ecef'" onmouseout="this.style.background='none'">×</button>
            </div>

            <!-- Modal Body -->
            <div style="padding: 24px; max-height: 50vh; overflow-y: auto;">
                <!-- Card Info Section -->
                <div style="
                    background: #f0f8ff;
                    padding: 16px;
                    border-radius: 8px;
                    border: 1px solid #b8daff;
                    margin-bottom: 24px;
                ">
                    <div style="font-weight: 600; color: #0c5460; margin-bottom: 8px;">Card Information</div>
                    <div style="font-size: 14px; color: #495057;">
                        <strong>Deck:</strong> ${cardData.deck || 'Unknown'}<br>
                        <strong>Format:</strong> ${cardData.card_format || 'Unknown'}<br>
                        <strong>Card ID:</strong> ${cardId}<br>
                        <strong>Front:</strong> ${(() => {
                        const frontText = cleanFieldDatum(cardData, 0, false);
                        return frontText.substring(0, 60) + (frontText.length > 60 ? '...' : '');
                    })() || 'No content'}
                    </div>
                </div>

                <!-- Create New Relationship Section -->
                <div style="margin-bottom: 24px;">
                    <h3 style="color: #333; margin-bottom: 16px;">Create New Relationship</h3>
                    
                    <div style="margin-bottom: 16px;">
                        <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #333;">
                            Search for card to relate to:
                        </label>
                        <div style="position: relative;">
                            <input type="text" id="cardSearchInput_${cardId}" placeholder="Type to search for cards..." style="
                                width: 100%;
                                padding: 10px;
                                border: 1px solid #ced4da;
                                border-radius: 6px;
                                font-size: 14px;
                                box-sizing: border-box;
                            ">
                            <div id="cardSearchResults_${cardId}" style="
                                position: absolute;
                                top: 100%;
                                left: 0;
                                right: 0;
                                background: white;
                                border: 1px solid #ced4da;
                                border-top: none;
                                border-radius: 0 0 6px 6px;
                                max-height: 200px;
                                overflow-y: auto;
                                z-index: 1000;
                                display: none;
                                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                            "></div>
                        </div>
                    </div>

                    <div style="margin-bottom: 16px;">
                        <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #333;">
                            Relationship Type:
                        </label>
                        <select id="relationshipType_${cardId}" style="
                            width: 100%;
                            padding: 10px;
                            border: 1px solid #ced4da;
                            border-radius: 6px;
                            font-size: 14px;
                            box-sizing: border-box;
                        ">
                            <option value="peer">Peer (cards of similar difficulty)</option>
                            <option value="dependent">Dependent (this card depends on the other)</option>
                            <option value="prereq">Prerequisite (other card depends on this)</option>
                        </select>
                    </div>

                    <div style="margin-bottom: 16px;">
                        <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                            <input type="checkbox" id="relationshipBetweenNotes_${cardId}" checked style="
                                transform: scale(1.2);
                                cursor: pointer;
                            ">
                            <span style="font-weight: 600; color: #333;">Relationship between notes</span>
                        </label>
                        <small style="color: #666; font-size: 12px; margin-left: 32px;">
                            When checked, creates relationship between all cards in both notes
                        </small>
                    </div>

                    <button id="createRelationshipBtn_${cardId}" disabled style="
                        padding: 10px 20px;
                        background: #28a745;
                        color: white;
                        border: none;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: 600;
                        opacity: 0.5;
                        transition: all 0.2s;
                    ">Create Relationship</button>
                </div>

                <!-- Existing Relationships Section -->
                <div>
                    <h3 style="color: #333; margin-bottom: 16px;">Existing Relationships</h3>
                    <div id="relationshipsList_${cardId}" style="
                        background: #f8f9fa;
                        padding: 16px;
                        border-radius: 8px;
                        border: 1px solid #dee2e6;
                        min-height: 60px;
                    ">
                        <p style="color: #666; font-style: italic;">Loading relationships...</p>
                    </div>
                </div>
            </div>

            <!-- Modal Footer -->
            <div style="
                display: flex;
                justify-content: flex-end;
                align-items: center;
                padding: 20px 24px;
                border-top: 1px solid #e1e5e9;
                background: #f8f9fa;
                gap: 12px;
            ">
                <button id="closeRelationshipModalBtn_${cardId}" style="
                    padding: 10px 20px;
                    background: #6c757d;
                    color: white;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 500;
                    transition: all 0.2s;
                " onmouseover="this.style.background='#545b62'" onmouseout="this.style.background='#6c757d'">
                    Close
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    console.log(`Created relationship modal for card ${cardId}`);

    // Set up event listeners
    setupRelationshipModalEventListeners(cardId);
    loadExistingRelationships(cardId);
    addRemoveAllRelationshipsButton(cardId);
}

// Add this function to handle the card search functionality
function setupCardSearchFunctionality(cardId: number): void {
    const searchInput = document.getElementById(`cardSearchInput_${cardId}`) as HTMLInputElement;
    const searchResults = document.getElementById(`cardSearchResults_${cardId}`);
    const createBtn = document.getElementById(`createRelationshipBtn_${cardId}`) as HTMLButtonElement;
    
    if (!searchInput || !searchResults || !createBtn) return;

    let selectedCardId: number | null = null;
    let searchTimeout: NodeJS.Timeout;

    // Handle search input
    searchInput.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        const query = this.value.trim();
        
        if (query.length < 2) {
            searchResults.style.display = 'none';
            return;
        }

        searchTimeout = setTimeout(async () => {
            try {
                const results = await searchCardsForRelationship(query, cardId);
                displaySearchResults(results, cardId);
            } catch (error) {
                console.error('Search error:', error);
                searchResults.innerHTML = '<div style="padding: 8px; color: #dc3545;">Search error occurred</div>';
                searchResults.style.display = 'block';
            }
        }, 300);
    });

    // Handle Enter key
    searchInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            const firstResult = searchResults.querySelector('.search-result-item') as HTMLElement;
            if (firstResult) {
                firstResult.click();
            }
        }
    });

    // Hide results when clicking outside
    document.addEventListener('click', function(e) {
        if (!searchInput.contains(e.target as Node) && !searchResults.contains(e.target as Node)) {
            searchResults.style.display = 'none';
        }
    });
}

// Add this function to display search results
function displaySearchResults(cards: CardDue[], currentCardId: number): void {
    const searchResults = document.getElementById(`cardSearchResults_${currentCardId}`);
    if (!searchResults) return;

    if (cards.length === 0) {
        searchResults.innerHTML = '<div style="padding: 8px; color: #666; font-size: 12px;">No cards found</div>';
        searchResults.style.display = 'block';
        return;
    }

    const html = cards.map(card => {
        const frontText = cleanFieldDatum(card, 0, false) || 'No content';
        const backText = cleanFieldDatum(card, 1, true) || 'No content';
        
        return `
            <div class="search-result-item" data-card-id="${card.card_id}" style="padding: 8px; border-bottom: 1px solid #eee; cursor: pointer; font-size: 12px; transition: background 0.2s;">
                <div style="font-weight: 600; color: #333;">Card ${card.card_id} (${card.deck})</div>
                <div style="color: #666;">${frontText.substring(0, 60)}${frontText.length > 60 ? '...' : ''} → ${backText.substring(0, 60)}${backText.length > 60 ? '...' : ''}</div>
            </div>
        `;
    }).join('');

    searchResults.innerHTML = html;
    searchResults.style.display = 'block';

    // Add click handlers to search results
    searchResults.querySelectorAll('.search-result-item').forEach((item, index) => {
        item.addEventListener('mouseenter', function() {
            (item as HTMLElement).style.background = '#f0f8ff';
        });
        
        item.addEventListener('mouseleave', function() {
            (item as HTMLElement).style.background = 'white';
        });
        
        item.addEventListener('click', function() {
            selectCard(cards[index], currentCardId);
            searchResults.style.display = 'none';
        });
    });
}

// Add this function to handle card selection
function selectCard(card: CardDue, currentCardId: number): void {
    const searchInput = document.getElementById(`cardSearchInput_${currentCardId}`) as HTMLInputElement;
    const createBtn = document.getElementById(`createRelationshipBtn_${currentCardId}`) as HTMLButtonElement;
    
    if (!searchInput || !createBtn) return;

    // Show selected card in the input
    const frontText = cleanFieldDatum(card, 0, false) || 'No content';
    searchInput.value = `Card ${card.card_id}: ${frontText.substring(0, 40)}${frontText.length > 40 ? '...' : ''}`;
    searchInput.dataset.selectedCardId = card.card_id.toString();

    // Enable the create button
    createBtn.disabled = false;
    createBtn.style.opacity = '1';
    
    console.log(`Selected card ${card.card_id} for relationship`);
}

// Add this function to implement the search API call
async function searchCardsForRelationship(searchTerm: string, excludeCardId: number): Promise<CardDue[]> {
    try {
        const result = await browseCards({
            searchTerm: searchTerm,
            limit: 10,
            offset: 0
        });
        
        if (result.status === 'success' && result.cards) {
            // Exclude the current card from results
            return result.cards.filter(card => card.card_id !== excludeCardId);
        }
        return [];
    } catch (error) {
        console.error('Error searching cards for relationship:', error);
        return [];
    }
}

// Update the setupRelationshipModalEventListeners function to include search setup:
function setupRelationshipModalEventListeners(cardId: number): void {
    setTimeout(() => {
        const closeBtn = document.getElementById(`closeRelationshipModal_${cardId}`);
        const closeBtn2 = document.getElementById(`closeRelationshipModalBtn_${cardId}`);
        const modal = document.getElementById('cardRelationshipModal');
        const createBtn = document.getElementById(`createRelationshipBtn_${cardId}`) as HTMLButtonElement;
        const relationshipSelect = document.getElementById(`relationshipType_${cardId}`) as HTMLSelectElement;

        console.log('Setting up event listeners for card', cardId);

        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                closeRelationshipModal();
            });
        }

        if (closeBtn2) {
            closeBtn2.addEventListener('click', (e) => {
                e.preventDefault();
                closeRelationshipModal();
            });
        }

        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    closeRelationshipModal();
                }
            });
        }

        // Set up create relationship button
        if (createBtn) {
            createBtn.addEventListener('click', async () => {
                const searchInput = document.getElementById(`cardSearchInput_${cardId}`) as HTMLInputElement;
                const selectedCardId = parseInt(searchInput.dataset.selectedCardId || '0');
                const relationship = relationshipSelect.value as 'peer' | 'dependent' | 'prereq';

                if (!selectedCardId) {
                    showToast('Please select a card first', 'warning');
                    return;
                }

                createBtn.textContent = 'Creating...';
                createBtn.disabled = true;

                try {
                    const relationshipBetweenNotesCheckbox = document.getElementById(`relationshipBetweenNotes_${cardId}`) as HTMLInputElement;
                    const betweenNotes = relationshipBetweenNotesCheckbox.checked;

                    const result = await createCardRelationship(cardId, selectedCardId, relationship, betweenNotes);
                    
                    if (result.status === 'success') {
                        showToast(`${relationship} relationship created successfully!`, 'success');
                        
                        // Clear the form
                        searchInput.value = '';
                        searchInput.dataset.selectedCardId = '';
                        createBtn.disabled = true;
                        createBtn.style.opacity = '0.5';
                        
                        // Reload existing relationships
                        loadExistingRelationships(cardId);
                    } else {
                        throw new Error(result.error || 'Failed to create relationship');
                    }
                } catch (error) {
                    console.error('Error creating relationship:', error);
                    const message = error instanceof Error ? error.message : 'Unknown error';
                    showToast(`Failed to create relationship: ${message}`, 'error');
                } finally {
                    createBtn.textContent = 'Create Relationship';
                }
            });
        }

        // Set up search functionality
        setupCardSearchFunctionality(cardId);

        document.addEventListener('keydown', function escHandler(e) {
            if (e.key === 'Escape') {
                closeRelationshipModal();
                document.removeEventListener('keydown', escHandler);
            }
        });
    }, 100);
}

// Function to load existing relationships
async function loadExistingRelationships(cardId: number): Promise<void> {
    const relationshipsList = document.getElementById(`relationshipsList_${cardId}`);
    if (!relationshipsList) return;

    try {
        const response = await fetch(`/card/${cardId}`);
        const result = await response.json();
        
        if (result.status !== 'success') {
            throw new Error('Failed to load card details');
        }

        const card = result.card;
        let html = '';

        // Helper function to create relationship items with delete buttons
        const createRelationshipItems = (relationships: number[], type: 'peer' | 'dependent' | 'prereq', label: string) => {
            if (!relationships || relationships.length === 0) return '';
            
            let itemsHtml = `
                <div class="relationship-section" style="margin-bottom: 16px;">
                    <strong style="color: #333; display: block; margin-bottom: 8px;">${label}:</strong>
                    <div class="relationship-items" style="display: flex; flex-direction: column; gap: 8px;">
            `;
            
            relationships.forEach(relatedCardId => {
                itemsHtml += `
                    <div class="relationship-item" style="
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        padding: 8px 12px;
                        background: #f8f9fa;
                        border: 1px solid #dee2e6;
                        border-radius: 6px;
                    ">
                        <span style="color: #495057; font-weight: 500;">Card ${relatedCardId}</span>
                        <button 
                            class="remove-relationship-btn"
                            data-card-a-id="${cardId}"
                            data-card-b-id="${relatedCardId}"
                            data-relationship-type="${type}"
                            style="
                                background: #dc3545;
                                color: white;
                                border: none;
                                border-radius: 4px;
                                padding: 4px 8px;
                                font-size: 12px;
                                cursor: pointer;
                                transition: all 0.2s;
                            "
                            onmouseover="this.style.background='#c82333'"
                            onmouseout="this.style.background='#dc3545'"
                            title="Remove this relationship"
                        >
                            🗑️ Remove
                        </button>
                    </div>
                `;
            });
            
            itemsHtml += `
                    </div>
                </div>
            `;
            
            return itemsHtml;
        };

        // Create sections for each relationship type
        html += createRelationshipItems(card.peers, 'peer', 'Peers');
        html += createRelationshipItems(card.dependents, 'prereq', 'Dependents (this card is prerequisite of)');
        html += createRelationshipItems(card.prereqs, 'dependent', 'Prerequisites (this card depends on)');

        if (html === '') {
            html = `
                <div style="
                    text-align: center;
                    padding: 20px;
                    color: #6c757d;
                    font-style: italic;
                    background: #f8f9fa;
                    border-radius: 8px;
                    border: 1px dashed #dee2e6;
                ">
                    No relationships found for this card.
                </div>
            `;
        }

        relationshipsList.innerHTML = html;

        // Add event listeners to remove buttons
        setupRemoveRelationshipListeners(cardId);

    } catch (error) {
        console.error('Error loading relationships:', error);
        if (relationshipsList) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            relationshipsList.innerHTML = `
                <div style="
                    padding: 16px;
                    color: #dc3545;
                    background: #f8d7da;
                    border: 1px solid #f5c6cb;
                    border-radius: 6px;
                ">
                    Error: ${message}
                </div>
            `;
        }
    }
}


// Add this new function to handle remove relationship button clicks
function setupRemoveRelationshipListeners(cardId: number): void {
    const relationshipsList = document.getElementById(`relationshipsList_${cardId}`);
    if (!relationshipsList) return;

    // Use event delegation to handle button clicks
    relationshipsList.addEventListener('click', async (event: MouseEvent) => {
        const target = event.target as HTMLElement;
        
        if (target.classList.contains('remove-relationship-btn')) {
            event.preventDefault();
            event.stopPropagation();
            
            const cardAId = parseInt(target.getAttribute('data-card-a-id') || '0');
            const cardBId = parseInt(target.getAttribute('data-card-b-id') || '0');
            const relationshipType = target.getAttribute('data-relationship-type') as 'peer' | 'dependent' | 'prereq';
            
            if (!cardAId || !cardBId || !relationshipType) {
                console.error('Missing data attributes for remove button');
                return;
            }
            
            // Confirm deletion
            const confirmed = confirm(
                `Remove ${relationshipType} relationship between cards ${cardAId} and ${cardBId}?\n\n` +
                `This action cannot be undone.`
            );
            
            if (!confirmed) return;
            
            // Show loading state
            const originalText = target.textContent;
            target.textContent = '⏳ Removing...';
            (target as HTMLButtonElement).disabled = true;
            
            try {
                console.log(`Removing ${relationshipType} relationship: ${cardAId} -> ${cardBId}`);
                
                const result = await removeCardRelationship(cardAId, cardBId, relationshipType);
                
                if (result.status === 'success') {
                    showToast(`${relationshipType} relationship removed successfully!`, 'success');
                    
                    // Reload the relationships list to show updated state
                    await loadExistingRelationships(cardId);
                    
                } else {
                    throw new Error(result.error || 'Failed to remove relationship');
                }
                
            } catch (error) {
                console.error('Error removing relationship:', error);
                const message = error instanceof Error ? error.message : 'Unknown error';
                showToast(`Failed to remove relationship: ${message}`, 'error');
                
                // Reset button state on error
                target.textContent = originalText;
                (target as HTMLButtonElement).disabled = false;
            }
        }
    });
}

// Optional: Add a "Remove All Relationships" button to the modal
function addRemoveAllRelationshipsButton(cardId: number): void {
    const relationshipsList = document.getElementById(`relationshipsList_${cardId}`);
    if (!relationshipsList) return;

    // Check if the button already exists
    if (document.getElementById(`removeAllBtn_${cardId}`)) return;

    const removeAllSection = document.createElement('div');
    removeAllSection.style.cssText = `
        margin-top: 20px;
        padding-top: 16px;
        border-top: 1px solid #dee2e6;
        text-align: center;
    `;
    
    const removeAllBtn = document.createElement('button');
    removeAllBtn.id = `removeAllBtn_${cardId}`;
    removeAllBtn.textContent = '🗑️ Remove All Relationships';
    removeAllBtn.style.cssText = `
        background: #dc3545;
        color: white;
        border: none;
        border-radius: 6px;
        padding: 10px 20px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
    `;
    
    removeAllBtn.addEventListener('mouseover', function() {
        this.style.background = '#c82333';
    });
    
    removeAllBtn.addEventListener('mouseout', function() {
        this.style.background = '#dc3545';
    });
    
    removeAllBtn.addEventListener('click', async () => {
        const confirmed = confirm(
            `⚠️ REMOVE ALL RELATIONSHIPS\n\n` +
            `This will remove ALL peer, dependent, and prerequisite relationships for card ${cardId}.\n\n` +
            `This action cannot be undone!\n\n` +
            `Continue?`
        );
        
        if (!confirmed) return;
        
        // Get current relationships
        try {
            const response = await fetch(`/card/${cardId}`);
            const result = await response.json();
            
            if (result.status !== 'success') {
                throw new Error('Failed to get card data');
            }
            
            const card = result.card;
            const allRelationships: Array<{cardBId: number, type: 'peer' | 'dependent' | 'prereq'}> = [];
            
            // Collect all relationships
            if (card.peers) {
                card.peers.forEach((peerId: number) => {
                    allRelationships.push({cardBId: peerId, type: 'peer'});
                });
            }
            if (card.dependents) {
                card.dependents.forEach((depId: number) => {
                    allRelationships.push({cardBId: depId, type: 'dependent'});
                });
            }
            if (card.prereqs) {
                card.prereqs.forEach((prereqId: number) => {
                    allRelationships.push({cardBId: prereqId, type: 'prereq'});
                });
            }
            
            if (allRelationships.length === 0) {
                showToast('No relationships to remove', 'info');
                return;
            }
            
            // Show loading state
            removeAllBtn.textContent = `⏳ Removing ${allRelationships.length} relationships...`;
            removeAllBtn.disabled = true;
            
            // Remove all relationships
            let successCount = 0;
            for (const rel of allRelationships) {
                try {
                    const result = await removeCardRelationship(cardId, rel.cardBId, rel.type);
                    if (result.status === 'success') {
                        successCount++;
                    }
                    // Small delay to avoid overwhelming the server
                    await new Promise(resolve => setTimeout(resolve, 100));
                } catch (error) {
                    console.error(`Failed to remove ${rel.type} relationship with ${rel.cardBId}:`, error);
                }
            }
            
            showToast(`Successfully removed ${successCount} of ${allRelationships.length} relationships`, 'success');
            
            // Reload relationships
            await loadExistingRelationships(cardId);
            
        } catch (error) {
            console.error('Error removing all relationships:', error);
            const message = error instanceof Error ? error.message : 'Unknown error';
            showToast(`Failed to remove relationships: ${message}`, 'error');
        } finally {
            removeAllBtn.textContent = '🗑️ Remove All Relationships';
            removeAllBtn.disabled = false;
        }
    });
    
    removeAllSection.appendChild(removeAllBtn);
    relationshipsList.appendChild(removeAllSection);
}

// Function to close the modal
function closeRelationshipModal(): void {
    console.log('Closing relationship modal');
    
    // Clean up any existing modals
    const modal = document.getElementById('cardRelationshipModal');
    const loadingModal = document.getElementById('cardEditModal');
    
    if (modal) {
        modal.remove();
    }
    
    if (loadingModal) {
        loadingModal.remove();
    }
    
    // Reset the opening flag
    (window as any).relationshipModalOpening = false;
    
    console.log('Modal cleanup complete');
}


// Show card history modal with creation date and review timeline
async function showCardHistoryModal(cardId: number): Promise<void> {
    // Clean up any existing history modal
    const existingModal = document.getElementById('cardHistoryModal');
    if (existingModal) {
        existingModal.remove();
    }

    const existingLoadingModal = document.getElementById('cardEditModal');
    if (existingLoadingModal) {
        existingLoadingModal.remove();
    }

    if ((window as any).historyModalOpening) {
        return;
    }
    (window as any).historyModalOpening = true;

    try {
        showLoadingModal(`Loading history for card ${cardId}...`);

        const response = await fetch(`/card/${cardId}/history`);
        const data = await response.json();

        if (data.status !== 'success') {
            throw new Error(data.error || 'Failed to load card history');
        }

        // Remove loading modal
        const loadingModal = document.getElementById('cardEditModal');
        if (loadingModal) {
            loadingModal.remove();
        }

        // Build review rows
        const reviews = data.reviews || [];
        let reviewsHtml = '';
        let passCount = 0, hardCount = 0, failCount = 0;

        if (reviews.length === 0) {
            reviewsHtml = `<tr><td colspan="4" style="text-align: center; color: #888; padding: 20px;">No reviews yet</td></tr>`;
        } else {
            reviews.forEach((review: any, index: number) => {
                const grade = review.grade || '—';
                let gradeColor = '#888';
                let gradeLabel = grade;
                if (grade === 'pass') { gradeColor = '#28a745'; passCount++; }
                else if (grade === 'hard') { gradeColor = '#f0ad4e'; hardCount++; }
                else if (grade === 'fail') { gradeColor = '#dc3545'; failCount++; }

                const reviewDate = review.reviewed_at ? new Date(review.reviewed_at) : null;
                const dateStr = reviewDate
                    ? `${reviewDate.toLocaleDateString()} ${reviewDate.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}`
                    : '—';

                const intervalBefore = review.interval_before != null ? `${review.interval_before}d` : '—';
                const intervalAfter = review.interval_after != null ? `${review.interval_after}d` : '—';

                reviewsHtml += `
                    <tr style="border-bottom: 1px solid #eee;">
                        <td style="padding: 8px 10px; color: #555;">${index + 1}</td>
                        <td style="padding: 8px 10px;">${dateStr}</td>
                        <td style="padding: 8px 10px;">
                            <span style="color: ${gradeColor}; font-weight: 600; text-transform: capitalize;">${gradeLabel}</span>
                        </td>
                        <td style="padding: 8px 10px; color: #555;">${intervalBefore} → ${intervalAfter}</td>
                    </tr>`;
            });
        }

        // Summary line
        const totalReviews = passCount + hardCount + failCount;
        const summaryHtml = totalReviews > 0
            ? `<span style="color:#28a745; font-weight:600;">${passCount} pass</span> · <span style="color:#f0ad4e; font-weight:600;">${hardCount} hard</span> · <span style="color:#dc3545; font-weight:600;">${failCount} fail</span>`
            : 'No reviews';

        // Card info
        const createdDate = data.created ? new Date(data.created) : null;
        const createdStr = createdDate ? createdDate.toLocaleDateString() : '—';
        const stats = data.current_stats || {};
        const lastReviewed = stats.last_reviewed ? new Date(stats.last_reviewed).toLocaleDateString() : 'Never';
        const retrievPct = stats.retrievability != null ? `${(stats.retrievability * 100).toFixed(1)}%` : '—';

        // Create modal
        const modal = document.createElement('div');
        modal.id = 'cardHistoryModal';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.7); display: flex; justify-content: center;
            align-items: center; z-index: 10000; animation: fadeIn 0.2s ease-out;
        `;

        modal.innerHTML = `
            <div style="
                background: white; border-radius: 12px; width: 90%; max-width: 600px;
                max-height: 80vh; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.3);
                animation: slideIn 0.3s ease-out; display: flex; flex-direction: column;
            ">
                <!-- Header -->
                <div style="
                    display: flex; justify-content: space-between; align-items: center;
                    padding: 20px 24px; border-bottom: 1px solid #e1e5e9; background: #f8f9fa;
                ">
                    <h2 style="margin: 0; color: #333; font-size: 20px; font-weight: 600;">
                        📜 Card History - Card ${cardId}
                    </h2>
                    <button id="closeHistoryModal_${cardId}" style="
                        background: none; border: none; font-size: 28px; cursor: pointer;
                        color: #666; width: 40px; height: 40px; display: flex;
                        align-items: center; justify-content: center; border-radius: 6px;
                        transition: all 0.2s;
                    " onmouseover="this.style.background='#e9ecef'" onmouseout="this.style.background='none'">×</button>
                </div>

                <!-- Body -->
                <div style="padding: 20px 24px; overflow-y: auto; flex: 1;">
                    <!-- Card Info -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px;">
                        <div style="background: #f8f9fa; padding: 12px; border-radius: 8px;">
                            <div style="font-size: 12px; color: #888; margin-bottom: 4px;">Created</div>
                            <div style="font-weight: 600; color: #333;">${createdStr}</div>
                        </div>
                        <div style="background: #f8f9fa; padding: 12px; border-radius: 8px;">
                            <div style="font-size: 12px; color: #888; margin-bottom: 4px;">Last Reviewed</div>
                            <div style="font-weight: 600; color: #333;">${lastReviewed}</div>
                        </div>
                        <div style="background: #f8f9fa; padding: 12px; border-radius: 8px;">
                            <div style="font-size: 12px; color: #888; margin-bottom: 4px;">Interval</div>
                            <div style="font-weight: 600; color: #333;">${stats.interval != null ? stats.interval + 'd' : '—'}</div>
                        </div>
                        <div style="background: #f8f9fa; padding: 12px; border-radius: 8px;">
                            <div style="font-size: 12px; color: #888; margin-bottom: 4px;">Retrievability</div>
                            <div style="font-weight: 600; color: #333;">${retrievPct}</div>
                        </div>
                    </div>

                    <!-- Deck & Format -->
                    <div style="font-size: 13px; color: #666; margin-bottom: 16px;">
                        <strong>Deck:</strong> ${data.deck || '—'} &nbsp;·&nbsp; <strong>Format:</strong> ${data.card_format || '—'}
                    </div>

                    <!-- Summary -->
                    <div style="margin-bottom: 16px; padding: 10px 14px; background: #f0f4f8; border-radius: 8px; font-size: 14px;">
                        <strong>${totalReviews} review${totalReviews !== 1 ? 's' : ''}</strong> &nbsp;—&nbsp; ${summaryHtml}
                    </div>

                    <!-- Reviews Table -->
                    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                        <thead>
                            <tr style="border-bottom: 2px solid #dee2e6;">
                                <th style="padding: 8px 10px; text-align: left; color: #555; font-weight: 600;">#</th>
                                <th style="padding: 8px 10px; text-align: left; color: #555; font-weight: 600;">Date</th>
                                <th style="padding: 8px 10px; text-align: left; color: #555; font-weight: 600;">Grade</th>
                                <th style="padding: 8px 10px; text-align: left; color: #555; font-weight: 600;">Interval</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${reviewsHtml}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Close button handler
        const closeBtn = document.getElementById(`closeHistoryModal_${cardId}`);
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.style.animation = 'fadeOut 0.2s ease-in';
                setTimeout(() => modal.remove(), 200);
            });
        }

        // Click backdrop to close
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.animation = 'fadeOut 0.2s ease-in';
                setTimeout(() => modal.remove(), 200);
            }
        });

    } catch (error: unknown) {
        console.error('Error loading card history:', error);
        const loadingModal = document.getElementById('cardEditModal');
        if (loadingModal) loadingModal.remove();
        const message = error instanceof Error ? error.message : 'Unknown error';
        showToast(`Failed to load history for card ${cardId}: ${message}`, 'error');
    } finally {
        (window as any).historyModalOpening = false;
    }
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


// Replace your editCard function with this optimized version:
async function editCard(cardId: number): Promise<void> {
    console.log(`✏️ Opening enhanced editor for card ${cardId}`);

    // Prevent multiple modals from opening
    const existingModal = document.getElementById('cardEditModal');
    if (existingModal) {
        console.log('Modal already open, ignoring request');
        return;
    }

    try {
        // Show loading state immediately
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
            
            // Replace loading modal with edit modal (no flashing)
            replaceLoadingWithEditModal(cardId, cardData);
        } else {
            throw new Error(result.error || 'Failed to load card data');
        }

    } catch (error) {
        console.error('Error loading card for editing:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        closeEditModal();
        showToast(`Failed to load card ${cardId}: ${message}`, 'error');
    }
}

// New function to replace loading modal smoothly
function replaceLoadingWithEditModal(cardId: number, cardData: any): void {
    const existingModal = document.getElementById('cardEditModal');
    if (!existingModal) return;

    // Find the modal content div
    const modalContent = existingModal.querySelector('div');
    if (!modalContent) return;

    // Fade out current content
    modalContent.style.transition = 'opacity 0.2s ease';
    modalContent.style.opacity = '0';
    
    setTimeout(() => {
        // Remove existing modal and create new one
        existingModal.remove();
        showCardEditModal(cardId, cardData);
    }, 200);
}

// Optimized close function to prevent flashing
function closeEditModal(): void {
    const modal = document.getElementById('cardEditModal');
    if (modal && !modal.classList.contains('closing')) {
        modal.classList.add('closing');
        modal.style.animation = 'fadeOut 0.2s ease-in';
        setTimeout(() => {
            if (modal.parentNode) {
                modal.parentNode.removeChild(modal);
            }
        }, 200);
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

// Add this queue management for toasts
let toastQueue: Array<{message: string, type: 'success' | 'error' | 'info' | 'warning'}> = [];
let isShowingToast = false;

// Replace your showToast function with this improved version:
function showToast(message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info'): void {
    // Add to queue
    toastQueue.push({ message, type });
    
    // Process queue if not already showing
    if (!isShowingToast) {
        processToastQueue();
    }
}

function processToastQueue(): void {
    if (toastQueue.length === 0) {
        isShowingToast = false;
        return;
    }
    
    isShowingToast = true;
    const { message, type } = toastQueue.shift()!;
    
    // Remove existing toast immediately
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

    // Auto-remove and process next in queue
    setTimeout(() => {
        toast.style.animation = 'slideOutRight 0.3s ease-in';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
            // Process next toast in queue
            setTimeout(() => processToastQueue(), 100);
        }, 300);
    }, 2500); // Shortened duration to prevent buildup

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
        const message = error instanceof Error ? error.message : 'Unknown error';
        showToast(`Failed to save field: ${message}`, 'error');
    }
}


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
    title.textContent = `Edit Note`;
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
        <div style="font-weight: 600; color: #0c5460; margin-bottom: 8px;">Note Information</div>
        <div style="font-size: 14px; color: #495057;">
            <strong>Deck:</strong> ${cardData.deck || 'Unknown'}<br>
            <strong>Note ID:</strong> ${cardData.note_id ?? 'Unknown'}<br>
            <strong>Card ID:</strong> ${cardId}
        </div>
        <div style="font-size: 12px; color: #6c757d; margin-top: 6px;">Changes will be saved to all cards from this note.</div>
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

let reviewForecastChart: any = null;
let availableDecks: string[] = [];
let selectedDecks: string[] = [];
// Function to fetch forecast data from backend
async function fetchReviewForecast(decks?: string[], daysAhead: number = 14, startDate?: string): Promise<ReviewForecastResponse> {
    try {
        const params = new URLSearchParams();
        if (decks && decks.length > 0) {
            params.append('decks', decks.join(','));
        }
        params.append('days_ahead', daysAhead.toString());
        if (startDate) {
            params.append('start_date', startDate); // Add this line
        }

        const response = await fetch(`/review_forecast?${params.toString()}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result: ReviewForecastResponse = await response.json();
        return result;
    } catch (error) {
        console.error('Error fetching forecast data:', error);
        return {
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

function hasOverdueData(forecastData: ReviewForecastData[]): boolean {
    return forecastData.length > 0 && forecastData[0].date === 'Overdue';
}

// 5. Optional: Add a function to calculate overdue totals for display
function calculateOverdueTotals(forecastData: ReviewForecastData[], decks: string[]): { [deck: string]: number } {
    const totals: { [deck: string]: number } = {};
    
    if (hasOverdueData(forecastData)) {
        const overdueData = forecastData[0];
        decks.forEach(deck => {
            totals[deck] = overdueData[deck] as number || 0;
        });
    }
    
    return totals;
}

// 6. Optional: Update the forecast stats display to show overdue information
function updateForecastStats(forecastData: ReviewForecastData[], totalReviews: number, decks: string[]) {
    const statsEl = document.getElementById('forecastStats');
    if (!statsEl) return;
    
    let statsHTML = `<div class="forecast-summary">
        <h4>Forecast Summary</h4>
        <p><strong>Total Reviews:</strong> ${totalReviews}</p>
    `;
    
    if (hasOverdueData(forecastData)) {
        const overdueTotals = calculateOverdueTotals(forecastData, decks);
        const totalOverdue = Object.values(overdueTotals).reduce((sum, count) => sum + count, 0);
        
        if (totalOverdue > 0) {
            statsHTML += `
                <div class="overdue-summary" style="color: #ff4444; font-weight: bold; margin-top: 10px;">
                    <p>🔴 <strong>Overdue Cards:</strong> ${totalOverdue}</p>
                    <div style="font-size: 12px; margin-left: 20px;">
            `;
            
            Object.entries(overdueTotals).forEach(([deck, count]) => {
                if (count > 0) {
                    statsHTML += `<div>${deck}: ${count}</div>`;
                }
            });
            
            statsHTML += `
                    </div>
                </div>
            `;
        }
    }
    
    statsHTML += `</div>`;
    statsEl.innerHTML = statsHTML;
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
        const message = error instanceof Error ? error.message : 'Unknown error';
        showToast(`Failed to save fields: ${message}`, 'error');
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

window.closeEditModal = closeEditModal;
window.saveAllFields = saveAllFields;

// Replace your deleteCard function with this optimized version:
async function deleteCard(cardId: number): Promise<void> {
    // Prevent multiple delete operations on the same card
    const cardRow = document.querySelector(`tr[data-card-id="${cardId}"]`) as HTMLTableRowElement;
    if (!cardRow || cardRow.classList.contains('deleting')) {
        return;
    }

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
        // Mark as deleting to prevent double-clicks
        cardRow.classList.add('deleting');
        
        // Disable action buttons immediately
        const actionButtons = cardRow.querySelectorAll('.edit-card-btn, .delete-card-btn') as NodeListOf<HTMLButtonElement>;
        actionButtons.forEach(btn => {
            btn.disabled = true;
            btn.style.opacity = '0.5';
        });

        const success = await deleteCardById(cardId);
        
        if (success) {
            // Smooth fade out animation
            cardRow.style.transition = 'all 0.3s ease';
            cardRow.style.opacity = '0';
            cardRow.style.transform = 'scale(0.95)';
            
            setTimeout(() => {
                cardRow.remove();
                updateCardCount();
                showToast(`Card ${cardId} deleted successfully!`, 'success');
            }, 300);
            
        } else {
            // Re-enable buttons if delete failed
            cardRow.classList.remove('deleting');
            actionButtons.forEach(btn => {
                btn.disabled = false;
                btn.style.opacity = '1';
            });
            showToast(`Failed to delete card ${cardId}. Please try again.`, 'error');
        }
    } catch (error) {
        console.error('Error in deleteCard:', error);
        
        // Re-enable buttons on error
        cardRow.classList.remove('deleting');
        const actionButtons = cardRow.querySelectorAll('.edit-card-btn, .delete-card-btn') as NodeListOf<HTMLButtonElement>;
        actionButtons.forEach(btn => {
            btn.disabled = false;
            btn.style.opacity = '1';
        });
        
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

