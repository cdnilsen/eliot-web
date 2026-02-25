import {OneWayCard, TwoWayCard, CardRelationships} from './synapdeck_files/synapdeck_lib.js';
import {postProcessSanskrit} from './synapdeck_files/transcribe_sanskrit.js';
import {geezSpecialChars} from './synapdeck_files/transcribe_geez.js';
import {akkadianSpecialChars} from './synapdeck_files/transcribe_akkadian.js';
import {hebrewSpecialChars} from './synapdeck_files/transcribe_hebrew.js';

// ── Types & interfaces ─────────────────────────────────────────────────────

type charSetsType = {
    [key: string]: string[]
}

interface ConflictCardInfo { card_id: number; note_id: number; field_values: string[]; }

interface NoteToProcess {
    deck: string;
    noteType: string;
    dataList: string[];
    processList: string[];
    relationships: CardRelationships;
}

type CreateCardRelFn = (
    cardAId: number,
    cardBId: number,
    relationship: 'peer' | 'dependent' | 'prereq',
    betweenNotes?: boolean
) => Promise<any>;

// ── Constants ──────────────────────────────────────────────────────────────

const specialCharSetsDict: charSetsType = {
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
    "Syriac": ["ā", "ē", "ê", "ḥ", "ṣ", "š", "ṭ", "ʾ", "ʿ"],
    "Tocharian B": ["ā", "ä", "ṃ", "ñ", "ṅ", "ṣ", "ś"]
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

// ── Module-level state ─────────────────────────────────────────────────────

export let currentDeck: string = "";
let focusedSpreadsheetCell: HTMLTextAreaElement | null = null;

// --- Conflict detection for the spreadsheet card editor ---
// deckFrontsCache[i] maps trimmed-lowercase field_values[i] → matching cards
let deckFrontsCache: Map<string, ConflictCardInfo[]>[] = [];

// Callback injected by synapdeck.ts so we can create card relationships
// without a circular import.
let _createCardRelationship: CreateCardRelFn | null = null;

// ── Conflict detection ─────────────────────────────────────────────────────

async function loadDeckFronts(deck: string): Promise<void> {
    deckFrontsCache = [];
    if (!deck) return;
    try {
        const response = await fetch(`/deck_fronts?deck=${encodeURIComponent(deck)}`);
        const data = await response.json();
        if (data.status !== 'success') return;
        const maps: Map<string, ConflictCardInfo[]>[] = [new Map(), new Map()];
        for (const card of data.cards as ConflictCardInfo[]) {
            for (const i of [0, 1] as const) {
                const v = ((card.field_values[i] as string) ?? '').trim().toLowerCase();
                if (!v) continue;
                if (!maps[i].has(v)) maps[i].set(v, []);
                maps[i].get(v)!.push(card);
            }
        }
        deckFrontsCache = maps;
        revalidateSpreadsheetConflicts();
    } catch (e) {
        console.error('Error loading deck fronts:', e);
    }
}

function revalidateSpreadsheetConflicts(): void {
    const tbody = document.getElementById('spreadsheetBody') as HTMLTableSectionElement | null;
    if (!tbody) return;
    Array.from(tbody.rows).forEach(row => checkRowConflicts(row as HTMLTableRowElement));
}

function checkRowConflicts(row: HTMLTableRowElement): void {
    const cardFormatEl = document.getElementById('card_format_dropdown') as HTMLSelectElement;
    const cardType = cardFormatEl?.value ?? 'two-way';
    const frontIndices: number[] = cardType === 'two-way' ? [0, 1] : [0];

    let rowHasConflict = false;
    const conflictMessages: string[] = [];

    for (const fieldIdx of frontIndices) {
        const ta = getSpreadsheetCellTextarea(row, fieldIdx);
        if (!ta) continue;
        const value = ta.value.trim();
        const td = ta.closest('td') as HTMLTableCellElement;
        td.classList.remove('cell-conflict');
        if (!value || deckFrontsCache.length === 0) continue;
        const matches = deckFrontsCache[fieldIdx]?.get(value.toLowerCase());
        if (matches && matches.length > 0) {
            td.classList.add('cell-conflict');
            rowHasConflict = true;
            for (const m of matches) {
                const fv = m.field_values;
                const front = ((fv[fieldIdx] as string) ?? '').trim();
                const back = ((fv[fieldIdx === 0 ? 1 : 0] as string) ?? '').trim();
                conflictMessages.push(`Card #${m.card_id}: "${front}" / "${back}"`);
            }
        }
    }

    const conflictTd = row.querySelector('.conflict-cell') as HTMLTableCellElement | null;
    if (!conflictTd) return;
    conflictTd.innerHTML = '';
    if (rowHasConflict) {
        const btn = document.createElement('span');
        btn.className = 'conflict-btn';
        btn.textContent = '!';
        btn.title = conflictMessages.join('\n');
        conflictTd.appendChild(btn);
    }
}

// ── Special characters panel ───────────────────────────────────────────────

function createSpecialCharactersPanel(): void {
    console.log("Creating special characters panel...");

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

    // Insert into spreadsheet section
    const spreadsheetSection = document.getElementById('spreadsheetSection');
    if (spreadsheetSection) {
        spreadsheetSection.appendChild(panel);
        console.log("Panel appended to spreadsheetSection");
    }
}

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
    characters.forEach((char: string) => {
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

        button.addEventListener("mouseover", () => {
            button.style.backgroundColor = "#e9e9e9";
        });
        button.addEventListener("mouseout", () => {
            button.style.backgroundColor = "#f9f9f9";
        });

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
    // Conflict indicator column
    const colConflict = document.createElement('col');
    colConflict.style.width = '28px';
    colgroup.appendChild(colConflict);
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

    const thConflict = document.createElement('th');
    thConflict.className = 'conflict-header';
    headerRow.appendChild(thConflict);

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

    const frontIndices: number[] = cardType === 'two-way' ? [0, 1] : [0];

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
        if (frontIndices.includes(colIdx)) {
            textarea.addEventListener('blur', () => {
                const trimmed = textarea.value.trim();
                if (textarea.value !== trimmed) textarea.value = trimmed;
                checkRowConflicts(tr);
            });
        }
        td.appendChild(textarea);
        tr.appendChild(td);
    });

    const conflictTd = document.createElement('td');
    conflictTd.className = 'conflict-cell';
    tr.appendChild(conflictTd);

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
        const cells = Array.from(row.cells).slice(1).filter(td => !td.classList.contains('conflict-cell')); // skip row-number and conflict-indicator cells
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

function insertCharacterAtCursor(character: string): void {
    if (character == "◌́") {
        character = "\u0301";
    } else if (character == "◌̀") {
        character = "\u0300";
    }

    const textarea: HTMLTextAreaElement | null = focusedSpreadsheetCell;
    if (!textarea) return;

    const startPos = textarea.selectionStart;
    const endPos = textarea.selectionEnd;
    const textBefore = textarea.value.substring(0, startPos);
    const textAfter = textarea.value.substring(endPos);

    textarea.value = textBefore + character + textAfter;

    const newCursorPos = startPos + character.length;
    textarea.setSelectionRange(newCursorPos, newCursorPos);

    textarea.focus();

    // Trigger input event (auto-grows cell in spreadsheet mode)
    const inputEvent = new Event('input', { bubbles: true });
    textarea.dispatchEvent(inputEvent);
}

// ── Backend functions ──────────────────────────────────────────────────────


function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function sendNoteToBackend(deck: string, note_type: string, field_values: string[], field_processing: string[], createdTimestamp: string) {
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
        timeCreated: createdTimestamp,
        timezone_offset_minutes: new Date().getTimezoneOffset()
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
            return {
                ...result,
                primary_field: field_values[0],
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
    if (!_createCardRelationship) {
        console.error('createCardRelationship callback not set');
        return;
    }

    for (const cardSet of cardsWithRelationships) {
        const { cardIds, deck, relationships } = cardSet;

        console.log(`🔗 Processing relationships for ${cardIds.length} cards in deck "${deck}"`);

        for (const cardId of cardIds) {
            for (const peerPrimary of relationships.peers) {
                try {
                    const peerResult = await findCardByPrimaryField(deck, peerPrimary);
                    if (peerResult && peerResult.card_id) {
                        console.log(`Creating peer relationship: ${cardId} <-> ${peerResult.card_id}`);
                        await _createCardRelationship(cardId, peerResult.card_id, 'peer', true);
                    } else {
                        console.warn(`Peer card not found: "${peerPrimary}" in deck "${deck}"`);
                    }
                } catch (error) {
                    console.error(`Error creating peer relationship for "${peerPrimary}":`, error);
                }
                await delay(50);
            }

            for (const prereqPrimary of relationships.prereqs) {
                try {
                    const prereqResult = await findCardByPrimaryField(deck, prereqPrimary);
                    if (prereqResult && prereqResult.card_id) {
                        console.log(`Creating prereq relationship: ${cardId} depends on ${prereqResult.card_id}`);
                        await _createCardRelationship(cardId, prereqResult.card_id, 'dependent', true);
                    } else {
                        console.warn(`Prereq card not found: "${prereqPrimary}" in deck "${deck}"`);
                    }
                } catch (error) {
                    console.error(`Error creating prereq relationship for "${prereqPrimary}":`, error);
                }
                await delay(50);
            }

            for (const depPrimary of relationships.dependents) {
                try {
                    const depResult = await findCardByPrimaryField(deck, depPrimary);
                    if (depResult && depResult.card_id) {
                        console.log(`Creating dependent relationship: ${depResult.card_id} depends on ${cardId}`);
                        await _createCardRelationship(depResult.card_id, cardId, 'dependent', true);
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

// ── Initialization ─────────────────────────────────────────────────────────

function initializeSpreadsheet(): void {
    const cardFormatDropdown = document.getElementById("card_format_dropdown") as HTMLSelectElement;
    buildSpreadsheet(cardFormatDropdown?.value ?? 'two-way');
    createSpecialCharactersPanel();

    const uploadDropdown = document.getElementById("upload_dropdownMenu") as HTMLSelectElement;
    if (uploadDropdown && uploadDropdown.value) {
        updateSpecialCharacters(uploadDropdown.value);
        loadDeckFronts(uploadDropdown.value);
        const submitBtn = document.getElementById('upload_submitBtn') as HTMLButtonElement | null;
        if (submitBtn) submitBtn.classList.remove('hidden');
    }
}

export function initializeUploadTab(createCardRelationshipFn: CreateCardRelFn): void {
    _createCardRelationship = createCardRelationshipFn;

    const timestampCreated = new Date(Date.now()).toISOString();

    let uploadDeckDropdown = document.getElementById("upload_dropdownMenu") as HTMLSelectElement;
    const cardFormatDropdown = document.getElementById("card_format_dropdown") as HTMLSelectElement;
    let uploadSubmitButton = document.getElementById("upload_submitBtn") as HTMLButtonElement;

    if (uploadDeckDropdown) {
        // Clone to remove any stale listeners
        const newUploadDropdown = uploadDeckDropdown.cloneNode(true) as HTMLSelectElement;
        if (uploadDeckDropdown.parentNode) {
            uploadDeckDropdown.parentNode.replaceChild(newUploadDropdown, uploadDeckDropdown);
            // Re-query after DOM replacement
            uploadSubmitButton = document.getElementById("upload_submitBtn") as HTMLButtonElement;
        }

        console.log("Upload deck dropdown event listener setup...");

        newUploadDropdown.addEventListener('change', (event) => {
            event.stopPropagation();
            event.preventDefault();

            const selectedValue = (event.target as HTMLSelectElement).value;
            currentDeck = selectedValue;

            console.log(`UPLOAD TAB: Deck changed to: "${currentDeck}"`);

            const uploadTab = document.getElementById('upload_mainDiv');
            const isUploadTabActive = uploadTab?.classList.contains('active');

            if (isUploadTabActive) {
                updateSpecialCharacters(currentDeck);
            }

            loadDeckFronts(currentDeck);

            if (uploadSubmitButton) uploadSubmitButton.classList.remove('hidden');
        });
    }

    const addSpreadsheetRowBtn = document.getElementById('addSpreadsheetRow');
    if (addSpreadsheetRowBtn) {
        addSpreadsheetRowBtn.addEventListener('click', () => {
            for (let i = 0; i < 5; i++) addSpreadsheetRow();
        });
    }

    if (cardFormatDropdown) {
        cardFormatDropdown.addEventListener('change', (event) => {
            const newType = (event.target as HTMLSelectElement).value;
            console.log('Card format changed:', newType);
            buildSpreadsheet(newType);
        });
    }

    const wipeDatabaseButton = document.getElementById("wipeDatabaseButton");
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

    if (uploadSubmitButton) {
        uploadSubmitButton.addEventListener('click', async () => {
            const notesToProcess: NoteToProcess[] = getNotesFromSpreadsheet();

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

                        const hasRelationships = note.relationships.peers.length > 0 ||
                                            note.relationships.prereqs.length > 0 ||
                                            note.relationships.dependents.length > 0;

                        if (hasRelationships) {
                            cardsWithRelationships.push({
                                cardIds: result.card_ids,
                                deck: note.deck,
                                primaryField: note.dataList[0],
                                relationships: note.relationships
                            });
                        }
                    } else {
                        console.error(`✗ Note ${i + 1} failed:`, result.error);
                    }

                    if (i < notesToProcess.length - 1) {
                        await delay(100);
                    }

                } catch (error) {
                    console.error(`✗ Note ${i + 1} error:`, error);
                }
            }

            if (cardsWithRelationships.length > 0) {
                console.log(`Processing relationships for ${cardsWithRelationships.length} card sets...`);
                await processAllRelationships(cardsWithRelationships);
            }

            buildSpreadsheet(cardFormatDropdown?.value ?? 'two-way');
            console.log('All notes processed!');
        });
    }

    // Initialize spreadsheet
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeSpreadsheet);
    } else {
        initializeSpreadsheet();
    }
}
