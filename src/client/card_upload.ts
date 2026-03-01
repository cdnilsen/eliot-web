import {OneWayCard, TwoWayCard, CardRelationships} from './synapdeck_files/synapdeck_lib.js';
import {postProcessSanskrit} from './synapdeck_files/transcribe_sanskrit.js';
import {geezSpecialChars} from './synapdeck_files/transcribe_geez.js';
import {akkadianSpecialChars} from './synapdeck_files/transcribe_akkadian.js';
import {hebrewSpecialChars} from './synapdeck_files/transcribe_hebrew.js';
import {transliterateGreek} from './synapdeck_files/transcribe_ancient_greek.js';
import {transliterateCoptic} from './synapdeck_files/transcribe_coptic.js';
import {transliterateHebrew} from './synapdeck_files/transcribe_hebrew.js';
import {transliterateSyriac} from './synapdeck_files/transcribe_syriac.js';
import {transliterateGeez, GeezDiacriticify} from './synapdeck_files/transcribe_geez.js';
import {transliterateRussian} from './synapdeck_files/transcribe_russian.js';
import {getInitialDifficulty, getInitialStability, recalculateRetrievability} from './fsrs_client.js';

let transcriptionDecks: string[] = [
    "Ancient Greek",
    "Coptic",
    "Ge'ez",
    "Hebrew",
    "Russian",
    "Syriac"
]

function transcribeText(text: string, deck: string) {
    switch (deck) {
        case "Ancient Greek":
            return transliterateGreek(text);
        case "Coptic":
            return transliterateCoptic(text);
        case "Ge'ez":
            return transliterateGeez(text, true);
        case "Hebrew":
            return transliterateHebrew(text, true);
        case "Russian":
            return transliterateRussian(text);
        case "Syriac":
            return transliterateSyriac(text);
    }
}


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
    initialIntervalDays: number;
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

// The currently selected (but not necessarily editing) spreadsheet cell <td>
let selectedTd: HTMLTableDataCellElement | null = null;

// Range selection: anchor is where Shift+Arrow started, active is the moving end
let selectionAnchorTd: HTMLTableDataCellElement | null = null;
let selectionActiveTd: HTMLTableDataCellElement | null = null;

// Undo history
type GridSnapshot = string[][];
const historyStack: GridSnapshot[] = [];
let historyPointer = -1;
let cellValueAtEditStart: string | null = null;

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

    const tbody = row.closest('tbody') as HTMLTableSectionElement | null;
    const conflictCol = document.getElementById('conflictColumn');
    if (!tbody || !conflictCol) return;
    const rowIdx = Array.from(tbody.rows).indexOf(row);
    const indicator = conflictCol.children[rowIdx + 1] as HTMLElement | undefined; // +1 for header spacer
    if (!indicator) return;
    indicator.innerHTML = '';
    if (rowHasConflict) {
        const btn = document.createElement('span');
        btn.className = 'conflict-btn';
        btn.textContent = '!';
        btn.title = conflictMessages.join('\n');
        indicator.appendChild(btn);
    }
}

// ── Cell selection & edit-mode helpers ────────────────────────────────────

/**
 * Highlights a cell without entering text-edit mode.
 * The <td> itself receives keyboard focus so arrow keys / typing work.
 */
function selectCell(td: HTMLTableDataCellElement): void {
    if (selectedTd && selectedTd !== td) {
        // Commit any in-progress edit on the previously selected cell
        _exitEditMode(selectedTd, true);
        selectedTd.classList.remove('cell-selected');
    }
    _clearRangeHighlight();
    selectedTd = td;
    selectionAnchorTd = td;
    selectionActiveTd = td;
    td.classList.add('cell-selected');

    // Keep focusedSpreadsheetCell updated for the special-chars panel
    const ta = td.querySelector('textarea') as HTMLTextAreaElement | null;
    if (ta) focusedSpreadsheetCell = ta;

    td.focus();
}

/**
 * Unlocks the textarea and gives it focus so the user can type.
 * @param initialChar  When set, the textarea content is replaced with this
 *                     character (used when the user starts typing on a
 *                     selected-but-not-editing cell).
 */
function _enterEditMode(td: HTMLTableDataCellElement, initialChar?: string): void {
    selectCell(td); // ensure it's selected first
    const ta = td.querySelector('textarea') as HTMLTextAreaElement | null;
    if (!ta) return;

    cellValueAtEditStart = ta.value;
    ta.readOnly = false;
    ta.tabIndex = 0;
    td.classList.add('cell-editing');

    if (initialChar !== undefined) {
        ta.value = initialChar;
        ta.style.height = 'auto';
        ta.style.height = ta.scrollHeight + 'px';
        syncConflictColumnHeights();
    }

    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
    focusedSpreadsheetCell = ta;
}

/**
 * Returns the cell to "selected but not editing" state.
 * @param runConflictCheck  Pass true when the user has finished editing
 *                          (blur / Escape / arrow-out) so conflicts are re-checked.
 */
function _exitEditMode(td: HTMLTableDataCellElement, runConflictCheck = false): void {
    const ta = td.querySelector('textarea') as HTMLTextAreaElement | null;
    if (!ta) return;

    if (cellValueAtEditStart !== null && ta.value !== cellValueAtEditStart) {
        _pushSnapshot();
    }
    cellValueAtEditStart = null;
    ta.readOnly = true;
    ta.tabIndex = -1;
    td.classList.remove('cell-editing');

    if (runConflictCheck) {
        const tr = td.closest('tr') as HTMLTableRowElement | null;
        if (tr) {
            const cardFormatEl = document.getElementById('card_format_dropdown') as HTMLSelectElement;
            const cardType = cardFormatEl?.value ?? 'two-way';
            const frontIndices: number[] = cardType === 'two-way' ? [0, 1] : [0];
            // Determine which data-column index this td is
            const dataCells = Array.from(tr.cells)
                .slice(1) // skip row-number
                .filter(c => !c.classList.contains('initial-interval-cell'));
            const colIdx = dataCells.indexOf(td as HTMLTableCellElement);
            if (frontIndices.includes(colIdx)) {
                const trimmed = ta.value.trim();
                if (ta.value !== trimmed) ta.value = trimmed;
                checkRowConflicts(tr);
            }
        }
    }
}

/** Deselects any selected cell (e.g. when the user clicks outside the table). */
function _deselectAll(): void {
    if (selectedTd) {
        _exitEditMode(selectedTd, true);
        selectedTd.classList.remove('cell-selected');
        selectedTd = null;
    }
    _clearRangeHighlight();
    selectionAnchorTd = null;
    selectionActiveTd = null;
}

// ── Range selection helpers ────────────────────────────────────────────────

function _getCellCoords(td: HTMLTableDataCellElement): { row: number; col: number } | null {
    const tbody = document.getElementById('spreadsheetBody') as HTMLTableSectionElement | null;
    if (!tbody) return null;
    const row = td.closest('tr') as HTMLTableRowElement | null;
    if (!row) return null;
    const rowIdx = Array.from(tbody.rows).indexOf(row);
    const dataCells = Array.from(row.cells).slice(1).filter(c => !c.classList.contains('initial-interval-cell'));
    const colIdx = dataCells.indexOf(td as HTMLTableCellElement);
    if (rowIdx < 0 || colIdx < 0) return null;
    return { row: rowIdx, col: colIdx };
}

/** Returns all cells currently in the selection rectangle. */
function _getSelectionCells(): HTMLTableDataCellElement[] {
    const tbody = document.getElementById('spreadsheetBody') as HTMLTableSectionElement | null;
    if (!tbody || !selectionAnchorTd || !selectionActiveTd) {
        return selectedTd ? [selectedTd] : [];
    }
    const a = _getCellCoords(selectionAnchorTd);
    const b = _getCellCoords(selectionActiveTd);
    if (!a || !b) return selectedTd ? [selectedTd] : [];
    const minRow = Math.min(a.row, b.row), maxRow = Math.max(a.row, b.row);
    const minCol = Math.min(a.col, b.col), maxCol = Math.max(a.col, b.col);
    const cells: HTMLTableDataCellElement[] = [];
    Array.from(tbody.rows).forEach((row, rowIdx) => {
        if (rowIdx < minRow || rowIdx > maxRow) return;
        const dataCells = Array.from(row.cells).slice(1).filter(c => !c.classList.contains('initial-interval-cell'));
        dataCells.forEach((cell, colIdx) => {
            if (colIdx >= minCol && colIdx <= maxCol) cells.push(cell as HTMLTableDataCellElement);
        });
    });
    return cells;
}

function _clearRangeHighlight(): void {
    const tbody = document.getElementById('spreadsheetBody') as HTMLTableSectionElement | null;
    if (!tbody) return;
    tbody.querySelectorAll('td.cell-in-range').forEach(td => td.classList.remove('cell-in-range'));
}

function _applyRangeHighlight(): void {
    _clearRangeHighlight();
    if (!selectionAnchorTd || !selectionActiveTd || selectionAnchorTd === selectionActiveTd) return;
    _getSelectionCells().forEach(td => {
        if (td !== selectionAnchorTd) td.classList.add('cell-in-range');
    });
}

/** Extends the active end of a shift-selection one step in the given direction. */
function _extendSelection(dir: 'up' | 'down' | 'left' | 'right'): void {
    const tbody = document.getElementById('spreadsheetBody') as HTMLTableSectionElement | null;
    if (!tbody || !selectionActiveTd) return;
    const active = _getCellCoords(selectionActiveTd);
    if (!active) return;
    let { row, col } = active;
    if (dir === 'up') row--; else if (dir === 'down') row++;
    else if (dir === 'left') col--; else col++;
    const rows = Array.from(tbody.rows) as HTMLTableRowElement[];
    if (row < 0 || row >= rows.length) return;
    const dataCells = Array.from(rows[row].cells).slice(1).filter(c => !c.classList.contains('initial-interval-cell'));
    if (col < 0 || col >= dataCells.length) return;
    selectionActiveTd = dataCells[col] as HTMLTableDataCellElement;
    _applyRangeHighlight();
}

// ── Undo history ───────────────────────────────────────────────────────────

function _captureGridSnapshot(): GridSnapshot {
    const tbody = document.getElementById('spreadsheetBody') as HTMLTableSectionElement | null;
    if (!tbody) return [];
    const cardFormatEl = document.getElementById('card_format_dropdown') as HTMLSelectElement;
    const cardType = cardFormatEl?.value ?? 'two-way';
    const numCols = (SPREADSHEET_COLS[cardType] ?? SPREADSHEET_COLS['two-way']).length;
    return Array.from(tbody.rows).map(row => {
        const values: string[] = [];
        for (let i = 1; i <= numCols; i++) {
            const ta = row.cells[i]?.querySelector('textarea') as HTMLTextAreaElement | null;
            values.push(ta ? ta.value : '');
        }
        return values;
    });
}

function _pushSnapshot(): void {
    const snapshot = _captureGridSnapshot();
    historyStack.splice(historyPointer + 1);
    historyStack.push(snapshot);
    historyPointer = historyStack.length - 1;
}

function _restoreSnapshot(idx: number): void {
    const snapshot = historyStack[idx];
    if (!snapshot) return;
    const tbody = document.getElementById('spreadsheetBody') as HTMLTableSectionElement | null;
    if (!tbody) return;
    const cardFormatEl = document.getElementById('card_format_dropdown') as HTMLSelectElement;
    const cardType = cardFormatEl?.value ?? 'two-way';
    const numCols = (SPREADSHEET_COLS[cardType] ?? SPREADSHEET_COLS['two-way']).length;
    while (tbody.rows.length < snapshot.length) addSpreadsheetRow();
    Array.from(tbody.rows).forEach((row, rowIdx) => {
        const rowValues = snapshot[rowIdx] ?? Array(numCols).fill('');
        for (let i = 0; i < numCols; i++) {
            const ta = row.cells[i + 1]?.querySelector('textarea') as HTMLTextAreaElement | null;
            if (ta) {
                ta.value = rowValues[i] ?? '';
                ta.style.height = 'auto';
                ta.style.height = ta.scrollHeight + 'px';
            }
        }
    });
    syncConflictColumnHeights();
    historyPointer = idx;
}

function _clearHistory(): void {
    historyStack.length = 0;
    historyPointer = -1;
    cellValueAtEditStart = null;
}

// ── End range selection & undo history ────────────────────────────────────

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
    _deselectAll();
    _clearHistory();
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
    const colInterval = document.createElement('col');
    colInterval.style.width = '84px';
    colgroup.appendChild(colInterval);
    table.appendChild(colgroup);

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');

    const thNum = document.createElement('th');
    thNum.className = 'row-number-header';
    thNum.textContent = '#';
    headerRow.appendChild(thNum);

    cols.forEach((col, colIdx) => {
        const th = document.createElement('th');
        th.textContent = col;
        th.style.cursor = 'pointer';
        th.addEventListener('mousedown', (e) => {
            e.preventDefault();
            const tbody = document.getElementById('spreadsheetBody') as HTMLTableSectionElement | null;
            if (!tbody || tbody.rows.length === 0) return;
            const rows = Array.from(tbody.rows) as HTMLTableRowElement[];
            const firstCell = rows[0].cells[colIdx + 1] as HTMLTableDataCellElement | undefined;
            const lastCell = rows[rows.length - 1].cells[colIdx + 1] as HTMLTableDataCellElement | undefined;
            if (!firstCell || !lastCell) return;
            selectCell(firstCell);
            selectionActiveTd = lastCell;
            _applyRangeHighlight();
        });
        headerRow.appendChild(th);
    });

    const thInterval = document.createElement('th');
    thInterval.textContent = 'Initial Interval';
    thInterval.className = 'initial-interval-header';
    headerRow.appendChild(thInterval);

    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    tbody.id = 'spreadsheetBody';
    table.appendChild(tbody);

    container.appendChild(table);

    initConflictColumn();

    for (let i = 0; i < 5; i++) {
        addSpreadsheetRow();
    }
    syncConflictColumnHeights();
    _pushSnapshot(); // baseline empty state for undo
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
    tdNum.style.cursor = 'pointer';
    tdNum.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const dataCells = Array.from(tr.cells)
            .slice(1)
            .filter(c => !c.classList.contains('initial-interval-cell')) as HTMLTableDataCellElement[];
        if (dataCells.length === 0) return;
        selectCell(dataCells[0]);
        selectionActiveTd = dataCells[dataCells.length - 1];
        _applyRangeHighlight();
    });
    tr.appendChild(tdNum);

    cols.forEach((_col, colIdx) => {
        const td = document.createElement('td') as HTMLTableDataCellElement;

        // The td itself is the focus target while in "selected" mode.
        td.tabIndex = 0;

        const textarea = document.createElement('textarea');
        textarea.rows = 1;
        // Start locked — the td owns focus until the user double-clicks or types.
        textarea.readOnly = true;
        textarea.tabIndex = -1;

        // ── Textarea: resize on input ──────────────────────────────────────
        textarea.addEventListener('input', () => {
            textarea.style.height = 'auto';
            textarea.style.height = textarea.scrollHeight + 'px';
            syncConflictColumnHeights();
        });

        // ── Textarea: keyboard handling while editing ──────────────────────
        textarea.addEventListener('keydown', (e) => {
            // Escape → exit edit mode, keep cell selected
            if (e.key === 'Escape') {
                e.preventDefault();
                _exitEditMode(td, true);
                textarea.blur();
                td.focus();
                return;
            }

            // Enter → exit edit mode and advance to next row (Shift+Enter inserts a newline as normal)
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                _exitEditMode(td, true);
                td.focus();
                moveSpreadsheetFocusVertical(tr, colIdx, 1);
                return;
            }

            // Tab → exit edit, move horizontally
            if (e.key === 'Tab') {
                e.preventDefault();
                _exitEditMode(td, true);
                moveSpreadsheetFocusHorizontal(tr, colIdx, e.shiftKey ? -1 : 1);
                return;
            }

            // Arrow keys — navigate out when the cursor is at an edge
            const text = textarea.value;
            const pos = textarea.selectionStart ?? 0;
            if (e.key === 'ArrowUp') {
                const isFirstLine = text.lastIndexOf('\n', pos - 1) === -1;
                if (isFirstLine) {
                    e.preventDefault();
                    _exitEditMode(td, true);
                    moveSpreadsheetFocusVertical(tr, colIdx, -1);
                }
            } else if (e.key === 'ArrowDown') {
                const isLastLine = text.indexOf('\n', pos) === -1;
                if (isLastLine) {
                    e.preventDefault();
                    _exitEditMode(td, true);
                    moveSpreadsheetFocusVertical(tr, colIdx, 1);
                }
            } else if (e.key === 'ArrowLeft') {
                if (pos === 0 && textarea.selectionEnd === 0) {
                    e.preventDefault();
                    _exitEditMode(td, true);
                    moveSpreadsheetFocusHorizontal(tr, colIdx, -1);
                }
            } else if (e.key === 'ArrowRight') {
                if (pos === text.length && textarea.selectionEnd === text.length) {
                    e.preventDefault();
                    _exitEditMode(td, true);
                    moveSpreadsheetFocusHorizontal(tr, colIdx, 1);
                }
            }
        });

        // ── Textarea: when it loses focus, exit edit mode ──────────────────
        textarea.addEventListener('blur', () => {
            // Use a microtask so that if focus is moving to another cell's td
            // that selectCell/enterEditMode has a chance to fire first.
            setTimeout(() => {
                // Guard against a race condition: if the user types quickly after
                // pressing Enter, _enterEditMode may have already re-acquired the
                // textarea before this callback fires. In that case, don't exit.
                if (td.classList.contains('cell-editing') && document.activeElement !== textarea) {
                    _exitEditMode(td, true);
                    // Don't steal focus back — the new target already has it.
                }
            }, 0);
        });

        // ── TD: mousedown ──────────────────────────────────────────────────
        // Prevent the browser from natively focusing the textarea on a plain
        // click.  We take over focus management ourselves.  When the cell is
        // already in edit mode we let the event through so the browser can
        // position the text cursor at the click point.
        td.addEventListener('mousedown', (e) => {
            if (td.classList.contains('cell-editing')) {
                // Already editing — let the click reach the textarea so the
                // user can reposition their cursor naturally.
                return;
            }
            e.preventDefault();
            if (e.shiftKey && selectionAnchorTd) {
                // Extend selection rectangle to this cell
                selectionActiveTd = td;
                _applyRangeHighlight();
            } else {
                selectCell(td);
            }
        });

        // ── TD: double-click → enter edit mode ────────────────────────────
        td.addEventListener('dblclick', (e) => {
            e.preventDefault();
            _enterEditMode(td);
        });

        // ── TD: keyboard handling while selected (not editing) ─────────────
        td.addEventListener('keydown', (e) => {
            // Ignore if the textarea is already handling input
            if (td.classList.contains('cell-editing')) return;

            switch (e.key) {
                case 'Tab':
                    e.preventDefault();
                    moveSpreadsheetFocusHorizontal(tr, colIdx, e.shiftKey ? -1 : 1);
                    break;

                case 'Enter':
                case 'F2':
                    // Enter edit mode at end of current text
                    e.preventDefault();
                    _enterEditMode(td);
                    break;

                case 'Delete':
                case 'Backspace':
                    // Clear all selected cells without entering edit mode
                    e.preventDefault();
                    for (const cell of _getSelectionCells()) {
                        const ta = cell.querySelector('textarea') as HTMLTextAreaElement | null;
                        if (ta) {
                            ta.value = '';
                            ta.style.height = 'auto';
                            ta.style.height = ta.scrollHeight + 'px';
                        }
                    }
                    _pushSnapshot();
                    syncConflictColumnHeights();
                    break;

                case 'ArrowUp':
                    e.preventDefault();
                    if (e.shiftKey) {
                        _extendSelection('up');
                    } else {
                        moveSpreadsheetFocusVertical(tr, colIdx, -1);
                    }
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    if (e.shiftKey) {
                        _extendSelection('down');
                    } else {
                        moveSpreadsheetFocusVertical(tr, colIdx, 1);
                    }
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    if (e.shiftKey) {
                        _extendSelection('left');
                    } else {
                        moveSpreadsheetFocusHorizontal(tr, colIdx, -1);
                    }
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    if (e.shiftKey) {
                        _extendSelection('right');
                    } else {
                        moveSpreadsheetFocusHorizontal(tr, colIdx, 1);
                    }
                    break;

                case 'v':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        navigator.clipboard.readText().then(text => {
                            textarea.value = text;
                            textarea.style.height = 'auto';
                            textarea.style.height = textarea.scrollHeight + 'px';
                            _pushSnapshot();
                            syncConflictColumnHeights();
                        });
                    }
                    break;

                default:
                    // Any printable character collapses the range, overwrites the
                    // anchor cell content, and enters edit mode in one keystroke.
                    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
                        e.preventDefault();
                        _clearRangeHighlight();
                        selectionActiveTd = selectionAnchorTd;
                        _enterEditMode(td, e.key);
                    }
                    break;
            }
        });

        // ── TD: clicking elsewhere deselects ──────────────────────────────
        // (handled at document level — see initializeSpreadsheet)

        td.appendChild(textarea);
        tr.appendChild(td);
    });

    const intervalTd = document.createElement('td');
    intervalTd.className = 'initial-interval-cell';
    const intervalInput = document.createElement('input');
    intervalInput.type = 'number';
    intervalInput.min = '1';
    intervalInput.value = '1';
    intervalInput.className = 'initial-interval-input';
    intervalInput.addEventListener('blur', () => {
        const v = parseInt(intervalInput.value, 10);
        if (isNaN(v) || v < 1) intervalInput.value = '1';
    });
    intervalTd.appendChild(intervalInput);
    tr.appendChild(intervalTd);

    tbody.appendChild(tr);
    addConflictIndicator();
}

function initConflictColumn(): void {
    const section = document.getElementById('spreadsheetSection');
    const cardSpreadsheet = document.getElementById('cardSpreadsheet');
    if (!section || !cardSpreadsheet) return;

    let rowWrapper = document.getElementById('spreadsheetRowWrapper');
    if (!rowWrapper) {
        rowWrapper = document.createElement('div');
        rowWrapper.id = 'spreadsheetRowWrapper';
        section.insertBefore(rowWrapper, cardSpreadsheet);
        rowWrapper.appendChild(cardSpreadsheet);

        const conflictCol = document.createElement('div');
        conflictCol.id = 'conflictColumn';
        rowWrapper.appendChild(conflictCol);

        cardSpreadsheet.addEventListener('scroll', () => {
            conflictCol.scrollTop = cardSpreadsheet.scrollTop;
        });
    }

    const conflictCol = document.getElementById('conflictColumn');
    if (!conflictCol) return;
    conflictCol.innerHTML = '';

    const spacer = document.createElement('div');
    spacer.className = 'conflict-header-spacer';
    spacer.id = 'conflictHeaderSpacer';
    conflictCol.appendChild(spacer);
}

function addConflictIndicator(): void {
    const conflictCol = document.getElementById('conflictColumn');
    if (!conflictCol) return;
    const indicator = document.createElement('div');
    indicator.className = 'conflict-indicator';
    conflictCol.appendChild(indicator);
}

function syncConflictColumnHeights(): void {
    const tbody = document.getElementById('spreadsheetBody') as HTMLTableSectionElement | null;
    const conflictCol = document.getElementById('conflictColumn');
    if (!tbody || !conflictCol) return;

    const spacer = document.getElementById('conflictHeaderSpacer') as HTMLElement | null;
    const container = document.getElementById('cardSpreadsheet');
    if (spacer && container) {
        const containerRect = container.getBoundingClientRect();
        const tbodyRect = tbody.getBoundingClientRect();
        spacer.style.height = (tbodyRect.top - containerRect.top + container.scrollTop) + 'px';
    }

    const rows = Array.from(tbody.rows) as HTMLTableRowElement[];
    rows.forEach((row, i) => {
        const indicator = conflictCol.children[i + 1] as HTMLElement | undefined;
        if (indicator) indicator.style.height = row.offsetHeight + 'px';
    });
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
        const allCells = Array.from(row.cells).slice(1); // skip row-number cell
        const intervalCell = allCells.find(td => td.classList.contains('initial-interval-cell'));
        const dataCells = allCells.filter(td => !td.classList.contains('initial-interval-cell'));
        const fieldValues = dataCells.map(td => {
            const ta = td.querySelector('textarea');
            return ta ? ta.value.trim() : '';
        });
        const intervalInputEl = intervalCell?.querySelector('input') as HTMLInputElement | null;
        const noteInitialIntervalDays = Math.max(1, parseInt(intervalInputEl?.value ?? '1', 10) || 1);

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
            relationships: { peers: [], prereqs: [], dependents: [] },
            initialIntervalDays: noteInitialIntervalDays
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
    const targetCell = targetRow.cells[dataColIdx + 1] as HTMLTableDataCellElement | undefined;
    if (targetCell) selectCell(targetCell);
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

    const targetCell = targetRow.cells[targetColIdx + 1] as HTMLTableDataCellElement | undefined;
    if (targetCell) selectCell(targetCell);
}

// ── End spreadsheet functions ──────────────────────────────────────────────

// ── Transliteration ────────────────────────────────────────────────────────

/**
 * Transliterates plain-text segments while leaving HTML tags untouched.
 * The text is split on HTML tags; odd-indexed parts are tags and are
 * passed through unchanged.
 */
function transliterateIgnoringHtml(text: string, deck: string): string {
    const parts = text.split(/(<[^>]*>)/);
    return parts.map((part, i) => {
        if (i % 2 === 1) return part; // HTML tag — keep as-is
        const result = transcribeText(part, deck);
        return result !== undefined ? result : part;
    }).join('');
}

function transliterateSelectedCell(): void {
    if (!selectedTd || !currentDeck) return;

    const cells = _getSelectionCells();

    if (cells.length > 1) {
        // Multi-cell: transliterate each cell's full content
        for (const cell of cells) {
            const ta = cell.querySelector('textarea') as HTMLTextAreaElement | null;
            if (!ta) continue;
            ta.value = transliterateIgnoringHtml(ta.value, currentDeck);
            ta.style.height = 'auto';
            ta.style.height = ta.scrollHeight + 'px';
        }
        _pushSnapshot();
        syncConflictColumnHeights();
        return;
    }

    // Single cell
    const ta = selectedTd.querySelector('textarea') as HTMLTextAreaElement | null;
    if (!ta) return;

    const isEditing = selectedTd.classList.contains('cell-editing');
    const selStart = ta.selectionStart ?? 0;
    const selEnd = ta.selectionEnd ?? ta.value.length;
    const hasPartialSelection = isEditing && selStart !== selEnd;

    if (hasPartialSelection) {
        const before = ta.value.substring(0, selStart);
        const selected = ta.value.substring(selStart, selEnd);
        const after = ta.value.substring(selEnd);
        const transliterated = transliterateIgnoringHtml(selected, currentDeck);
        ta.value = before + transliterated + after;
        ta.setSelectionRange(selStart, selStart + transliterated.length);
    } else {
        ta.value = transliterateIgnoringHtml(ta.value, currentDeck);
    }

    // Snapshot only when not in edit mode; if editing, _exitEditMode will capture it
    if (!isEditing) _pushSnapshot();

    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 'px';
    syncConflictColumnHeights();
}

function updateTransliterateButtonVisibility(deck: string): void {
    const btn = document.getElementById('transliterateBtn');
    if (!btn) return;
    if (transcriptionDecks.includes(deck)) {
        btn.classList.remove('hidden');
    } else {
        btn.classList.add('hidden');
    }
}

// ── End transliteration ────────────────────────────────────────────────────

function insertCharacterAtCursor(character: string): void {
    if (character == "◌́") {
        character = "\u0301";
    } else if (character == "◌̀") {
        character = "\u0300";
    }

    // If the focused cell isn't in edit mode, enter it first
    if (selectedTd && !selectedTd.classList.contains('cell-editing')) {
        _enterEditMode(selectedTd);
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

async function sendNoteToBackend(deck: string, note_type: string, field_values: string[], field_processing: string[], createdTimestamp: string, initialIntervalDays: number = 1) {
    let card_configs: any[] = [];

    if (note_type === "Two-Way") {
        card_configs = TwoWayCard(field_values, field_processing);
    } else if (note_type === "One-Way") {
        card_configs = OneWayCard(field_values, field_processing);
    }

    const field_names = field_processing.map((_, index) => `field_${index + 1}`);

    // For each card in the note, pick a random due-date offset in [1, initialIntervalDays].
    // This staggers new cards in medias res without changing their stored interval.
    const initialDueOffsets: number[] = Array.from({ length: card_configs.length }, () =>
        Math.floor(Math.random() * initialIntervalDays) + 1
    );

    // For custom intervals, compute initial FSRS stats based on a synthetic 'review 0'.
    // For interval = 1, leave null so the server treats cards as genuinely new.
    let initialStability: number | null = null;
    let initialDifficulty: number | null = null;
    let initialRetrievability: number | number[] = 1;

    if (initialIntervalDays > 1) {
        initialStability = getInitialStability(3);
        initialDifficulty = getInitialDifficulty(3);

        const now = new Date();
        initialRetrievability = initialDueOffsets.map(k =>
            recalculateRetrievability(
                new Date(now.getTime() - (initialIntervalDays - k) * 86400000),
                now,
                initialStability!
            )
        );
    }

    const payload = {
        deck: deck,
        note_type: note_type,
        field_names: field_names,
        field_values: field_values,
        field_processing: field_processing,
        card_configs: card_configs,
        timeCreated: createdTimestamp,
        timezone_offset_minutes: new Date().getTimezoneOffset(),
        initial_interval_days: initialIntervalDays,
        initial_due_offsets: initialDueOffsets,
        initialRetrievability: initialRetrievability,
        initialStability: initialStability,
        initialDifficulty: initialDifficulty
    };

    try {
        const response = await fetch('/add_synapdeck_note', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (result.status === 'success') {
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
    // adding a comment here to make it redeploy
    for (const cardSet of cardsWithRelationships) {
        const { cardIds, deck, relationships } = cardSet;
        for (const cardId of cardIds) {
            for (const peerPrimary of relationships.peers) {
                try {
                    const peerResult = await findCardByPrimaryField(deck, peerPrimary);
                    if (peerResult && peerResult.card_id) {
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
}

// ── Initialization ─────────────────────────────────────────────────────────

function initializeSpreadsheet(): void {
    const cardFormatDropdown = document.getElementById("card_format_dropdown") as HTMLSelectElement;
    buildSpreadsheet(cardFormatDropdown?.value ?? 'two-way');
    createSpecialCharactersPanel();

    const uploadDropdown = document.getElementById("upload_dropdownMenu") as HTMLSelectElement;
    if (uploadDropdown && uploadDropdown.value) {
        updateSpecialCharacters(uploadDropdown.value);
        updateTransliterateButtonVisibility(uploadDropdown.value);
        loadDeckFronts(uploadDropdown.value);
        const submitBtn = document.getElementById('upload_submitBtn') as HTMLButtonElement | null;
        if (submitBtn) submitBtn.classList.remove('hidden');
    }

    // Clicking outside any spreadsheet cell deselects the current cell.
    // Exception: clicks within #spreadsheetSection (transliterate button, special
    // chars panel, add-rows button, etc.) don't deselect — they act on the selection.
    document.addEventListener('mousedown', (e) => {
        if (!selectedTd) return;
        const table = document.getElementById('spreadsheetTable');
        if (table && !table.contains(e.target as Node)) {
            const section = document.getElementById('spreadsheetSection');
            if (section && section.contains(e.target as Node)) return;
            _deselectAll();
        }
    }, true /* capture so it fires before any cell handler */);
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

        newUploadDropdown.addEventListener('change', (event) => {
            event.stopPropagation();
            event.preventDefault();

            const selectedValue = (event.target as HTMLSelectElement).value;
            currentDeck = selectedValue;

            const uploadTab = document.getElementById('upload_mainDiv');
            const isUploadTabActive = uploadTab?.classList.contains('active');

            if (isUploadTabActive) {
                updateSpecialCharacters(currentDeck);
            }

            updateTransliterateButtonVisibility(currentDeck);
            loadDeckFronts(currentDeck);

            if (uploadSubmitButton) uploadSubmitButton.classList.remove('hidden');
        });
    }

    const transliterateBtn = document.getElementById('transliterateBtn');
    if (transliterateBtn) {
        transliterateBtn.addEventListener('click', () => transliterateSelectedCell());
    }

    document.addEventListener('keydown', (e) => {
        if (e.altKey && e.key.toLowerCase() === 't') {
            const btn = document.getElementById('transliterateBtn');
            if (btn && !btn.classList.contains('hidden')) {
                e.preventDefault();
                transliterateSelectedCell();
            }
        }

        if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key === 'z') {
            // Only intercept at the grid level when no cell is being actively edited
            if (selectedTd?.classList.contains('cell-editing')) return;
            if (historyPointer > 0) {
                e.preventDefault();
                _restoreSnapshot(historyPointer - 1);
            }
        }
    });

    const addSpreadsheetRowBtn = document.getElementById('addSpreadsheetRow');
    if (addSpreadsheetRowBtn) {
        addSpreadsheetRowBtn.addEventListener('click', () => {
            for (let i = 0; i < 5; i++) addSpreadsheetRow();
        });
    }

    if (cardFormatDropdown) {
        cardFormatDropdown.addEventListener('change', (event) => {
            const newType = (event.target as HTMLSelectElement).value;
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
            const cardsWithRelationships: Array<{
                cardIds: number[],
                deck: string,
                primaryField: string,
                relationships: CardRelationships
            }> = [];

            // One representative card_id per successfully created note (for peer-all)
            const createdRepresentativeIds: number[] = [];

            for (let i = 0; i < notesToProcess.length; i++) {
                const note = notesToProcess[i];
                try {
                    const result = await sendNoteToBackend(
                        note.deck,
                        note.noteType,
                        note.dataList,
                        note.processList,
                        timestampCreated,
                        note.initialIntervalDays
                    );

                    if (result.status === 'success') {
                        if (result.card_ids?.length > 0) {
                            createdRepresentativeIds.push(result.card_ids[0]);
                        }

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
                await processAllRelationships(cardsWithRelationships);
            }

            // Mark all created notes as peers of each other if the checkbox is checked
            const markAllPeersCheckbox = document.getElementById('markAllPeers') as HTMLInputElement | null;
            if (markAllPeersCheckbox?.checked && _createCardRelationship && createdRepresentativeIds.length > 1) {
                for (let i = 0; i < createdRepresentativeIds.length; i++) {
                    for (let j = i + 1; j < createdRepresentativeIds.length; j++) {
                        await _createCardRelationship(createdRepresentativeIds[i], createdRepresentativeIds[j], 'peer', true);
                    }
                }
            }

            buildSpreadsheet(cardFormatDropdown?.value ?? 'two-way');
            if (markAllPeersCheckbox) markAllPeersCheckbox.checked = false;
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