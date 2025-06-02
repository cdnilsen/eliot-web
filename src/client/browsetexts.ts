import { sectionToBookDict, bookToChapterDict } from "./library.js"

//All courtesy of Claude
type HighlightedObject = {
    str1: string,
    str2: string
}


function refreshMayhewBox(book: string) {
    return "b"
}

function findLCS(str1: string, str2: string): string {
    if (!str1 || !str2) return '';
    
    const dp: number[][] = Array(str1.length + 1).fill(null)
        .map(() => Array(str2.length + 1).fill(0));
    
    for (let i = 1; i <= str1.length; i++) {
        for (let j = 1; j <= str2.length; j++) {
            if (str1[i - 1] === str2[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1] + 1;
            } else {
                dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
            }
        }
    }
    
    let lcs = '';
    let i = str1.length, j = str2.length;
    while (i > 0 && j > 0) {
        if (str1[i - 1] === str2[j - 1]) {
            lcs = str1[i - 1] + lcs;
            i--;
            j--;
        } else if (dp[i - 1][j] > dp[i][j - 1]) {
            i--;
        } else {
            j--;
        }
    }
    
    return lcs;
}


//Still a bit bugged, proofreading mode doesn't work, and case-mismatches are highlighted in 'ignore casing' mode.
function highlightDifferences(str1: string, str2: string, highlightCaseDiffs: boolean = false, proofreading: boolean = false): HighlightedObject {
    if (str1 === str2) {
        return { str1, str2 };
    }

    const lcs = findLCS(str1, str2);
    let result1 = '';
    let result2 = '';
    let i = 0, j = 0, k = 0;

    while (k < lcs.length) {
        // Handle non-LCS characters in str1
        while (i < str1.length && str1[i] !== lcs[k]) {
            // If we're ignoring case or highlighting case diffs, check for case matches
            if (j < str2.length && str1[i].toLowerCase() === str2[j].toLowerCase()) {
                if (str1[i] !== str2[j] && highlightCaseDiffs) {
                    // Only highlight if we're specifically highlighting case differences
                    result1 += `<span style="color: blue">${str1[i]}</span>`;
                    result2 += `<span style="color: blue">${str2[j]}</span>`;
                } else {
                    // Otherwise treat as matching
                    result1 += str1[i];
                    result2 += str2[j];
                }
                i++;
                j++;
            } else if (proofreading && j < str2.length) {
                // Check for potentially missing characters in proofreading mode
                let lookAhead = 1;
                while (j + lookAhead < str2.length && 
                       i < str1.length && 
                       str1[i] !== str2[j + lookAhead]) {
                    lookAhead++;
                }
                if (j + lookAhead < str2.length && 
                    i < str1.length && 
                    str1[i] === str2[j + lookAhead]) {
                    // Found a potential missing character
                    let missingChars = '';
                    for (let m = 0; m < lookAhead; m++) {
                        missingChars += `<sup><b><span style="color:#FF6666">${str2[j + m]}</span></b></sup>`;
                        j++;
                    }
                    result1 += missingChars + str1[i];
                    i++;
                } else {
                    result1 += `<span style="color: red">${str1[i]}</span>`;
                    i++;
                }
            } else {
                result1 += `<span style="color: red">${str1[i]}</span>`;
                i++;
            }
        }
        
        // Handle non-LCS characters in str2
        while (j < str2.length && str2[j] !== lcs[k]) {
            if (i < str1.length && str1[i].toLowerCase() === str2[j].toLowerCase()) {
                if (!highlightCaseDiffs) {
                    result2 += str2[j];
                } else {
                    result2 += `<span style="color: blue">${str2[j]}</span>`;
                }
            } else {
                result2 += `<span style="color: red">${str2[j]}</span>`;
            }
            j++;
        }
        
        // Add the matching character
        if (i < str1.length && j < str2.length) {
            if (str1[i] !== str2[j] && str1[i].toLowerCase() === str2[j].toLowerCase()) {
                if (highlightCaseDiffs) {
                    result1 += `<span style="color: blue">${str1[i]}</span>`;
                    result2 += `<span style="color: blue">${str2[j]}</span>`;
                } else {
                    result1 += str1[i];
                    result2 += str2[j];
                }
            } else {
                result1 += str1[i];
                result2 += str2[j];
            }
            i++;
            j++;
            k++;
        }
    }
    
    // Handle remaining characters
    while (i < str1.length) {
        if (j < str2.length && str1[i].toLowerCase() === str2[j].toLowerCase()) {
            if (str1[i] !== str2[j] && highlightCaseDiffs) {
                result1 += `<span style="color: blue">${str1[i]}</span>`;
                result2 += `<span style="color: blue">${str2[j]}</span>`;
            } else {
                result1 += str1[i];
                result2 += str2[j];
            }
            i++;
            j++;
        } else {
            result1 += `<span style="color: red">${str1[i]}</span>`;
            i++;
        }
    }
    while (j < str2.length) {
        result2 += `<span style="color: red">${str2[j]}</span>`;
        j++;
    }

    return { str1: result1, str2: result2 };
}
/*


function tagToSpan(tagName: string, text: string, color: string) {
    text = text.replaceAll('<' + tagName + '>', '<span style="color:' + color + '">')
    text = text.replaceAll('</' + tagName + '>', '</span>')
    return text
}

function processHebrewLine(rawHTML: string, showHapaxes: boolean) {
    let line = rawHTML.split("«")[1]
    if (showHapaxes) {
        line = tagToSpan('Ĥ', line, 'blue')
        line = tagToSpan('HK', line, '#ff00ff')
        line = line.replaceAll('<HK>', '<span class="ketiv" style="color:#FF00FF">').replaceAll('</HK>', '</span>')
    } else {
        line = line.replaceAll('<Ĥ>', '').replaceAll("</Ĥ>", "")
        line = line.replaceAll('<HK>', '<K>').replaceAll('</HK>', '</K>')
    }

    line = line.replaceAll('<K>', '<span class="ketiv" style="color:red">').replaceAll('</K>', '</span>')

    return line.trim()
}

function processGreekLine(text: string, showHapaxes: boolean) {
    if (!showHapaxes) {
        text = text.replaceAll('<span style="color:blue">', '').replaceAll('</span>', '');
    }
    return text.split("} ")[1].trim();
}

*/

type Edition = 'first_edition' | 'second_edition' | 'mayhew' | 'zeroth_edition' | 'kjv' | 'grebrew';

type Highlighting = "none" | "ignoreCasing" | "includeCasing" | "proofreading"
type Hapax = "none" | "strict" | "lax"

type EditionState = {
    editions: number,
    highlighting: Highlighting,
    hapaxes: Hapax,
    viewBrackets: boolean,
    isNT: boolean,
    book: string,
    chapter: number,
}

type Verse = {
    book: string;
    chapter: number;
    verse: number;
    first_edition?: string;
    second_edition?: string;
    mayhew?: string;
    zeroth_edition?: string;
    kjv?: string;
    grebrew?: string;
}

function refreshSectionDropdown() {
    let valuesList = ["pentateuch", "history", "wisdom", "major_prophets", "minor_prophets", "gospels_acts", "other_nt", "mishnaic"]
    let labelsList = ["Pentateuch", "Historical Books", "Wisdom/Poetry Books", "Major Prophets", "Minor Prophets", "Gospels/Acts", "Rest of New Testament", '"Mishnaic" publications']

    let sectionDropdown = <HTMLSelectElement>document.getElementById("sectionDropdown");

    sectionDropdown.innerHTML = "";
    for (let i=0; i < valuesList.length; i++) {
        let option = document.createElement("option");
        option.value = valuesList[i];
        option.innerHTML = labelsList[i];
        sectionDropdown.appendChild(option);
    }
}

//This has a bug where I have the gospels as options in the Pentateuch. Fix at some point?
function sectionListener(state: EditionState) {
    let sectionDropdown = <HTMLSelectElement>document.getElementById("sectionDropdown");
    let bookDropdown = <HTMLSelectElement>document.getElementById("bookDropdown");
    let chapterDropdown = <HTMLSelectElement>document.getElementById("chapterSelectionDropdown");
    let zerothContainer = document.getElementById("zerothContainer");
    
    sectionDropdown.addEventListener("change", function() {
        bookDropdown.innerHTML = "";
        chapterDropdown.innerHTML = "";
        let section = sectionDropdown.value;
        let book = bookDropdown.value;
        let chapter = 1;
        state.book = book;
        state.chapter = chapter;
        bookDropdown.hidden = false;

        let allBooks = sectionToBookDict[section];
        state.book = allBooks[0];
        for (let i=0; i < allBooks.length; i++) {
            let option = document.createElement("option");
            option.value = allBooks[i];
            option.innerHTML = allBooks[i];
            bookDropdown.appendChild(option);
        }
        zerothContainer!.hidden = (state.book != "Genesis");

        let numChapters = bookToChapterDict[state.book];
        console.log(numChapters)
        console.log("Line 262...")
        chapterDropdown.innerHTML = "";
        for (let i=1; i < numChapters + 1; i++) {
            let option = document.createElement("option");
            option.value = i.toString();
            option.innerHTML = i.toString();
            chapterDropdown.appendChild(option);
        }
        let currentSection = sectionDropdown.value;
        refreshSectionDropdown();
        sectionDropdown.value = currentSection;

        state.isNT = (currentSection == "gospels_acts" || currentSection == "other_nt");
    });

    bookDropdown.addEventListener("change", function() {
        let book = bookDropdown.value;
        state.book = book;
        let numChapters = bookToChapterDict[book];
        chapterDropdown.innerHTML = "";
        for (let i=1; i < numChapters + 1; i++) {
            let option = document.createElement("option");
            option.value = i.toString();
            option.innerHTML = i.toString();
            chapterDropdown.appendChild(option);
        }
        zerothContainer!.hidden = (state.book != "Genesis");

        let mayhewContainer = document.getElementById("mayhewContainer")!;
        let mayhewCheckbox = <HTMLInputElement>document.getElementById("useMayhew");

        //kludge kludge kludge
        if (book == "John" || book == "Psalms" || book == "Family Religion" || book == "Lord's Day") {
            mayhewContainer!.hidden = false;
        } else {
            mayhewContainer!.hidden = true;
            mayhewCheckbox.checked = false;
        }
    });

    chapterDropdown.addEventListener("change", function() {
        let chapter = parseInt(chapterDropdown.value);
        state.chapter = chapter;
    });
}

function editionNumberListener(state: EditionState) {
    let editionListenerIDs = ["useFirstEdition", "useSecondEdition", "useMayhew", "useZerothEdition", "useGrebrew"];
    let primesList = [2, 3, 5, 7, 11];
    
    type ContainerDictType = {
        [key: string]: string
    };
    
    type BookToContainerDictType = {
        [key: string]: string
    };
    
    const containerDict: ContainerDictType = {
        "useFirstEdition": "firstEditionContainer", 
        "useSecondEdition": "secondEditionContainer", 
        "useMayhew": "mayhewContainer", 
        "useZerothEdition": "zerothContainer", 
        "useGrebrew": "grebrewContainer"
    };

    const bookToContainerDict: BookToContainerDictType = {
        "Genesis": "useZerothEdition",
        "Psalms (prose)": "useMayhew",
        "John": "useMayhew",
        "Family Religion": "useMayhew"
    };

    for (let i=0; i < primesList.length; i++) {
        let docID = editionListenerIDs[i];
        let p = primesList[i];
        let checkbox = document.getElementById(docID) as HTMLInputElement;

        // testing this
        if (p == 5 || p == 7) {
            if (state.book in bookToContainerDict && docID in containerDict) {
                let containerID = containerDict[docID];
                let container = document.getElementById(containerID) as HTMLSpanElement;
                if (bookToContainerDict[state.book] != docID) {
                    checkbox.checked = false;
                    container.hidden = true;
                } else {
                    checkbox.checked = true;
                    container.hidden = false;
                }
            }
        }

        if (checkbox.checked) {
            state.editions = state.editions * p;
        }
        checkbox.addEventListener("change", function() {
            if (checkbox.checked) {
                state.editions = state.editions * p;
            } else {
                state.editions = state.editions / p;
            }
        });
    }
}

function highlightingListener(docID: string, setting: Highlighting, state: EditionState) {
    let button = <HTMLInputElement>document.getElementById(docID);
    if (button.checked) {
        state.highlighting = setting;
    }
    button.addEventListener("change", function() {
        if (button.checked) {
            state.highlighting = setting;
        }
    });
}

function hapaxListener(docID: string, setting: Hapax, state: EditionState) {
    let button = <HTMLInputElement>document.getElementById(docID);
    if (button.checked) {
        state.hapaxes = setting;
    }

    button.addEventListener("change", function() {
        if (button.checked) {
            state.hapaxes = setting;
        }
    });
}

function viewBracketsListener(state: EditionState) { 
    let checkbox = <HTMLInputElement>document.getElementById("viewUncertain")!;
    state.viewBrackets = checkbox.checked;
    
    checkbox.addEventListener("change", function () {
        state.viewBrackets = checkbox.checked;
        //fetchChapter(state); //Fix later
    });
}

function isMassachusett(edition: Edition) {
    return (edition == "first_edition" || edition == "second_edition" || edition == "mayhew" || edition == "zeroth_edition")
}

function processMassText(text: string, state: EditionState) {
    text = text.replaceAll('8', 'ꝏ̄').replaceAll("$", " ").replaceAll("ṡ", "s").replaceAll("ṣ", "s").replaceAll("{{", "<b>").replaceAll("}}", "</b>").replaceAll('{', '<i>').replaceAll('}', '</i>').replaceAll("八", "8");

    if (state.viewBrackets == false) {
        text = text.replaceAll("[", "").replaceAll("]", "")
    }

    return text
}

function processEnglishText(text: string, state: EditionState) {
    text = text.replaceAll("{{", "<b>").replaceAll("}}", "</b>").replaceAll('{', '<i>').replaceAll('}', '</i>').replaceAll("八", "8");

    return text
}

//bugged, presumably hapaxes aren't actually being changed?
function processText(text: string, state: EditionState, edition: Edition, isDummy: boolean) {

    console.log(edition)
    if (isDummy) {
        return text;
    }
    if (edition == "first_edition" || edition == "second_edition" || edition == "mayhew" || edition == "zeroth_edition") {
        return processMassText(text, state); //deal with hapaxes later
    }

    if (edition == "kjv") {
        return processEnglishText(text, state); 
    }

    if (edition == "grebrew" || edition == "kjv") {
        if (state.hapaxes == "none") {
            return text.replaceAll('<span style="color:blue">', '').replaceAll('</span>', '');
        } else {
            return text;
        }
    }
    
}

type EditionColumns = {
    right: Edition[],
    left: Edition[],
    rightWidth: number,
    leftWidth: number
}

function getColumnWidths(editions: Edition[], state: EditionState): EditionColumns {
    let leftHandSideEditions: Edition[] = []
    let rightHandSideEditions: Edition[] = []

    let secondEditionOnRight = false;
    if (editions.includes("zeroth_edition") && editions.includes("first_edition")) {
        leftHandSideEditions.push("zeroth_edition");
        secondEditionOnRight = true;
    }

    if (editions.includes("first_edition")) {
        leftHandSideEditions.push("first_edition");
    }
    
    if (editions.includes("second_edition") && !sectionToBookDict["mishnaic"].includes(state.book)) {
        if (secondEditionOnRight) {
            rightHandSideEditions.push("second_edition");
        } else {
            leftHandSideEditions.push("second_edition");
        }
    }

    if (editions.includes("mayhew")) {
        if (leftHandSideEditions.length < 2) {
            leftHandSideEditions.push("mayhew");
        } else {
            rightHandSideEditions.push("mayhew");
        }
    }

    if (editions.includes("kjv")) {
        rightHandSideEditions.push("kjv");
    }

    if (editions.includes("grebrew")) {
        rightHandSideEditions.push("grebrew");
    }

    let rightHandSideWidth = 45 / rightHandSideEditions.length;
    let leftHandSideWidth = 45 / leftHandSideEditions.length;

    let object: EditionColumns = {
        right: rightHandSideEditions,
        left: leftHandSideEditions,
        rightWidth: rightHandSideWidth,
        leftWidth: leftHandSideWidth
    }
    return object;
}

function createDummyVerse(editions: Edition[], isNT: boolean) {
    let verse: Verse = {
        book: "Genesis",
        chapter: 1,
        verse: 1
    }

    let editionToShorthandDict = {
        "first_edition": "α (1663)",
        "second_edition": "β (1685)",
        "mayhew": "M (1709)",
        "zeroth_edition": "\u05D0\u202A (1655)",
        "kjv": "KJV",
        "grebrew": "G"
    }

    if (isNT) {
        editionToShorthandDict["first_edition"] = "α (1661)"
    }

    for (let i=0; i < editions.length; i++) {
        if (editions[i] in editionToShorthandDict) {
            verse[editions[i]] = editionToShorthandDict[editions[i]];
        }
    }
    return verse;
}

// We'll need to create a proofreading version later...
function processHighlighting(verse: Verse, highlighting: Highlighting) {
    if ((verse.first_edition && verse.second_edition) && highlighting != "none") {
        let firstText = verse.first_edition;
        let secondText = verse.second_edition;
        let proofreading = (highlighting == "proofreading");
        let checkCasing = (proofreading || highlighting == "includeCasing");
        let result = highlightDifferences(firstText, secondText, checkCasing, proofreading);
        verse.first_edition = result.str1;
        verse.second_edition = result.str2;
    }
}
    
function createVerseRow(verse: Verse, editions: EditionColumns, cellType: string, state: EditionState, isDummy: boolean = false) {
    const row = document.createElement('tr');

    let highlighting = state.highlighting;
    if (!isDummy) {
        processHighlighting(verse, highlighting);
    }

    let leftSideEditions = editions.left;
    let rightSideEditions = editions.right;
    let leftWidth = editions.leftWidth;
    let rightWidth = editions.rightWidth;

    for (let i=0; i < leftSideEditions.length; i++) {
        let cell = document.createElement(cellType);
        cell.style.width = leftWidth.toString() + "%";
        const edition = leftSideEditions[i];
        let verseText = verse[edition];
        if (isDummy) {
            cell.style.textAlign = "center";
        } else if (verseText) {
            verseText = processText(verseText, state, edition, isDummy);
        }
        if (verseText && typeof verseText === 'string') {
            cell.innerHTML = verseText;
        }
        row.appendChild(cell);
    }

    // Add verse number
    let verseString = verse.chapter.toString() + ":" + verse.verse.toString();

    if (verse.verse == 999) {
        verseString = "Epilogue";
    }

    const verseNumCell = document.createElement(cellType);
    verseNumCell.className = 'verse-number';
    verseNumCell.style.width = '10%';
    if (isDummy) {
        verseString = "Verse";
    }
    verseNumCell.style.textAlign = "center";
    verseNumCell.textContent = verseString;
    row.appendChild(verseNumCell);

    //shouldn't this happen on the left side too
    for (let i=0; i < rightSideEditions.length; i++) {
        let cell = document.createElement(cellType);
        cell.style.width = rightWidth.toString() + "%";
        const edition = rightSideEditions[i];
        let verseText = verse[edition];
        if (isDummy) {
            cell.style.textAlign = "center";
        } else if (isMassachusett(edition) && verseText) {
            verseText = processMassText(verseText, state);
        } else if (verseText) {
            console.log(edition)
            if (edition == "kjv") {
                verseText = processEnglishText(verseText, state);
            }
        }
        if (verseText && typeof verseText === 'string') {
            cell.innerHTML = verseText;
        }
        row.appendChild(cell);
    }
    return row;
}


function createNavBar(state: EditionState) {
    const navBar = document.createElement('div');
    navBar.className = 'chapter-navigation';
    navBar.style.display = 'flex';
    navBar.style.justifyContent = 'space-between';
    navBar.style.width = '100%';
    navBar.style.padding = '10px 0';
    navBar.style.position = 'sticky';
    navBar.style.top = '0';
    navBar.style.backgroundColor = 'white';
    navBar.style.zIndex = '10';

    // Left navigation container
    const leftNav = document.createElement('div');
    leftNav.style.width = '45%';
    leftNav.style.textAlign = 'left';

    // Right navigation container
    const rightNav = document.createElement('div');
    rightNav.style.width = '45%';
    rightNav.style.textAlign = 'right';

    // Previous button - only show if not on first chapter
    if (state.chapter > 1) {
        const prevButton = document.createElement('button');
        prevButton.innerHTML = '← Previous Chapter';
        prevButton.style.padding = '5px 10px';
        prevButton.onclick = () => {
            state.chapter -= 1;
            if (state.chapter >= 1) {
                fetchChapter(state);
            } else {
                state.chapter = 1; // Reset if we went too low
                fetchChapter(state)
            }
        };
        leftNav.appendChild(prevButton);
    }

    // Next button - only show if not on last chapter
    if (state.chapter < bookToChapterDict[state.book]) {
        const nextButton = document.createElement('button');
        nextButton.innerHTML = 'Next Chapter →';
        nextButton.style.padding = '5px 10px';
        nextButton.onclick = () => {
            state.chapter += 1;
            if (state.chapter <= bookToChapterDict[state.book]) {
                fetchChapter(state);
            } else {
                state.chapter = bookToChapterDict[state.book]; // Reset if we went too high
                fetchChapter(state);
            }
        };
        rightNav.appendChild(nextButton);
    }

    // Add components to the navbar
    navBar.appendChild(leftNav);
    navBar.appendChild(rightNav);

    return navBar;
}

function createVerseGrid(verses: Verse[], editionsToFetch: Edition[], state: EditionState) {
    const displayDiv = document.getElementById('textColumns');
    if (!displayDiv) return;

    displayDiv.innerHTML = '';
    let navBar = createNavBar(state);
    displayDiv.appendChild(navBar);

    // Create container for the table
    const tableContainer = document.createElement('div');
    tableContainer.className = 'table-container';

    // Create table element
    const table = document.createElement('table');
    table.className = 'verse-table';

    const columnWidthObject = getColumnWidths(editionsToFetch, state);
    
    // Create a dummy verse object to get the shorthands.
    let dummyHeaderVerse = createDummyVerse(editionsToFetch, state.isNT);
    
    let headerRow = createVerseRow(dummyHeaderVerse, columnWidthObject, 'th', state, true);

    // Create separate thead element
    const thead = document.createElement('thead');
    thead.appendChild(headerRow);
    table.appendChild(thead);

    //get highlighting setting (and hapax settings, eventually)
    let highlighting = state.highlighting;

    // Create tbody for the verses
    const tbody = document.createElement('tbody');
    verses.forEach((verse: Verse) => {
        let row = createVerseRow(verse, columnWidthObject, 'td', state);

        tbody.appendChild(row);
    });
    table.appendChild(tbody);

    tableContainer.appendChild(table);
    displayDiv.appendChild(table);

    // Add CSS style
    const style = document.createElement('style');
    style.textContent = `
    .chapter-navigation {
        position: sticky;
        top: 0;
        background: white;
        padding: 10px;
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 20px;
        z-index: 3;  /* Increased z-index */
        border-bottom: 1px solid #ddd;
    }

    .chapter-navigation button {
        padding: 5px 15px;
        border: 1px solid #ddd;
        border-radius: 4px;
        background: white;
        cursor: pointer;
    }

    .chapter-navigation button:hover {
        background: #f5f5f5;
    }

    .chapter-navigation button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .chapter-indicator {
        font-weight: bold;
    }

    .table-container {
        max-height: calc(80vh - 50px);
        overflow-y: auto;
        position: relative;
    }

    .verse-table {
        width: 100%;
        border-collapse: collapse;
        margin: 1em 0;
    }

    .verse-table thead {
        position: sticky;
        top: 52px;  /* Height of navbar (including padding and border) */
        z-index: 2;
        background: white;  /* Ensure the header has a background */
    }

    .verse-table th {
        background-color: #f5f5f5;
        font-weight: bold;
        box-shadow: 0 2px 2px -1px rgba(0, 0, 0, 0.4);
    }

    .verse-table th, .verse-table td {
        padding: 8px;
        border: 1px solid #ddd;
        text-align: left;
    }

    .verse-number {
        font-weight: bold;
        text-align: right;
    }
    `;
    document.head.appendChild(style);
}

// Kludgey fix, but (shrug emoji)
function fixEditionNumber(state: EditionState): number {
    let number = state.editions;
    if (number % 5 == 0) {
        if (state.book != "Psalms (prose)" && state.book != "John") {
            number = state.editions / 5;
        }
    }

    if (number % 7 == 0 && state.book != "Genesis") {
        number = state.editions / 7
    }

    if (sectionToBookDict["mishnaic"].includes(state.book) && number % 3 == 0) {
        number = state.editions / 3
    }

    return number;
}

async function fetchChapter(state: EditionState) {
    try {
        state.editions = fixEditionNumber(state);

        let editionNumber = state.editions;
        let book = state.book;
        let chapter = state.chapter;
        
        let editionsToFetch: Edition[] = [];
        if (editionNumber % 2 === 0) editionsToFetch.push('first_edition');
        if (editionNumber % 3 === 0) editionsToFetch.push('second_edition');
        if (editionNumber % 5 === 0) editionsToFetch.push('mayhew');
        if (editionNumber % 7 === 0) editionsToFetch.push('zeroth_edition');
        if (editionNumber % 11 === 0) editionsToFetch.push('grebrew');
        editionsToFetch.push('kjv');

        // Convert editions array to comma-separated string for query parameter
        const editionsParam = editionsToFetch.join(',');
        const response = await fetch(`/chapter/${book}/${chapter}?editions=${editionsParam}`);
        const verses: Verse[] = await response.json();
        
        createVerseGrid(verses, editionsToFetch, state);

        window.scrollTo({
            top: 0
        });

        editionNumberListener(state);
        
    } catch (error) {
        console.error('Error fetching chapter:', error);
    }
}

function submitButtonListener(state: EditionState) {
    let submitButton = <HTMLButtonElement>document.getElementById("submitBookQuery");
    submitButton.addEventListener("click", function() {
        fetchChapter(state);
    });
}

function main() {
    let editionState: EditionState = { 
        editions: 1,
        highlighting: "none",
        hapaxes: "none",
        isNT: false,
        book: "",
        viewBrackets: true,
        chapter: 1
    };
     
    editionNumberListener(editionState);
    

    let highlightingIDs = ["no_show", "include_casing", "exclude_casing", "proofreading"];
    let highlightingSettings: Highlighting[] = ["none", "includeCasing", "ignoreCasing", "proofreading"];
    
    for (let i=0; i < highlightingIDs.length; i++) {
        highlightingListener(highlightingIDs[i], highlightingSettings[i], editionState)
    }

    let hapaxIDs = ["dont_show", "hapaxes_strict", "hapaxes_lax"];
    let hapaxSettings: Hapax[] = ["none", "strict", "lax"]

    for (let i=0; i < hapaxIDs.length; i++) {
        hapaxListener(hapaxIDs[i], hapaxSettings[i], editionState)
    }

    sectionListener(editionState);

    submitButtonListener(editionState);

    viewBracketsListener(editionState);
}

main();