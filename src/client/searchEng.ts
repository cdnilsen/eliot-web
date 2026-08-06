import { totalmem } from "os";
import { sectionToBookDict, bookToChapterDict, IDToBookDict, stringToStringListDict, StringToStringDict, allBookList, StringToIntDict, bookToIDDict, BookName } from "./library.js"


type WordKJVResult = {
    headword: string;
    verses: number[];
    counts: number[];
    // Adding fields to match Mass search
    no_diacritics?: string; // Optional since English words don't need diacritics handling
    editions?: number;      // For consistency with Mass search
}

type VerseDisplayDict = {
    '2': string,  // First Edition
    '3': string,  // Second Edition
    '5': string,  // Mayhew
    '7': string,  // Zeroth Edition
    '4': string,  // KJV
    '8': string,  // Grebrew
    'book': string,
    'chapter': number,
    'verse': number,
    'genericID': string,
    'count': number
}

async function sendWordSearch(searchString: string, searchType: string, diacritics: "lax" | "strict"): Promise<WordKJVResult[]> {
    // Clean and prepare the search string similar to Mass search
    searchString = searchString.split('*').join('%');
    searchString = searchString.split('(').join('');
    searchString = searchString.split(')').join('?');
    
    const url = `/search_kjv?pattern=${encodeURIComponent(searchString)}&searchType=${searchType}`;
    console.log('URL:', url);

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error searching words:', error);
        return [];
    }
}

function killLeadingZeros(address: string) {
    let newString = ""
    let hitNonZero = false;
    for (let i=0; i < address.length; i++) {
        let char = address[i];
        if (hitNonZero || char != "0") {
            newString += char;
            hitNonZero = true
        }
    }
    return newString
}

function getVerseAddress(address: string): string {
    let rawChapter = address.slice(4, 7);
    let rawVerse = address.slice(7, 10);

    //Kludge but fixes an issue with 'verse zero'.
    let result = killLeadingZeros(rawChapter) + "." + killLeadingZeros(rawVerse);
    if (result.endsWith(".")) {
        result = result + "0";
    }
    return result;
}

function sortByAlphabet(results: WordKJVResult[]): WordKJVResult[] {
    return [...results].sort((a, b) => {
        return a.headword.localeCompare(b.headword);
    });
}

function sortByFrequency(results: WordKJVResult[]) {
    return results.sort((a, b) => {
        // First compare by total frequency
        const freqA = a.counts.reduce((sum, val) => sum + val, 0);
        const freqB = b.counts.reduce((sum, val) => sum + val, 0);
        
        // If frequencies are different, sort by that
        if (freqB !== freqA) {
            return freqB - freqA;
        }
        
        // If frequencies are equal, sort alphabetically
        return a.headword.localeCompare(b.headword);
    });
}
async function grabMatchingVerses(addresses: string[], retries = 2) {
    // Retry transient failures (e.g. a request that lost the race for a DB
    // connection under load) before giving up on this headword.
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const queryParams = new URLSearchParams({
                addresses: addresses.join(',')
            });

            const response = await fetch(`/matching_verses?${queryParams}`);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            if (attempt === retries) {
                console.error('Error fetching matching verses:', error);
                throw error;
            }
            await new Promise(resolve => setTimeout(resolve, 150 * (attempt + 1)));
        }
    }
}

function cleanWord(word: string) {
    word = word.toLowerCase();
    word = word.replace("ᴏᴅ", "od");
    let punctuation = [".", ",", ";", ":", "!", "?", "(", ")", "[", "]", "{", "}", "<", ">", "\"", "'", "“", "”", "‘", "’", "—", "–", "…", "·"];
    for (let i=0; i < punctuation.length; i++) {
        word = word.replace(punctuation[i], "");
    }
    return word;
}

function processTextInBox(text: string, headword: string, keyNum: number): string {
    //if (!text) return '';
    if (keyNum % 4 != 0) {
        text = text.replaceAll("8", "ꝏ̄").replaceAll("$", " ");
        text = text.replaceAll("{{", "<b>");
        text = text.replaceAll("}}", "</b>");

        text = text.replaceAll("{", "<i>");
        text = text.replaceAll("}", "</i>");
        
        return text;
    } else if (keyNum == 4) {
        const splitText = text.split(' ');
        let finalString = "";
        for (let i=0; i < splitText.length; i++) {
            let word = splitText[i];
            let punctuation = [".", ",", ";", ":", "!", "?", "(", ")", "[", "]", "{", "}", "<", ">", "\"", "'", "“", "”", "‘", "’", "—", "–", "…", "·"];
            if (cleanWord(word) == cleanWord(headword)) {
                let thisWordPunctuation = ""
                if (punctuation.includes(word.slice(-1))) {
                    thisWordPunctuation = word.slice(-1);
                    console.log(word);
                    word = word.slice(0, -1);
                    console.log(word);
                }
                word = '<span style="color:blue">' + word + '</span>';
                word += thisWordPunctuation;
            }
            word = word.replaceAll("8", "ꝏ̄");
            word = word.replaceAll("$", " ");

            word = word.replaceAll("{{", "<b>");
            word = word.replaceAll("}}", "</b>");

            word = word.replaceAll("{", "<i>");
            word = word.replaceAll("}", "</i>");

            finalString += word;
            if (i < splitText.length - 1) {
                finalString += " ";
            }
        }
        return finalString;
    } else {
        text = text.replaceAll("{{", "<b>");
        text = text.replaceAll("}}", "</b>");

        text = text.replaceAll("{", "<i>");
        text = text.replaceAll("}", "</i>");
        
        return text;
    }
}

function getResultDiv(result: WordKJVResult): HTMLDivElement {
    // See the function `resultDiv` in searchMass for details on this
    let totalCount = 0;
    
    let verseIDs: number[] = [];
    let countDict: StringToIntDict = {}

    for (let i=0; i < result.verses.length; i++) {
        let thisVerse = result.verses[i];
        let thisCount = result.counts[i];

        if (!(thisVerse in countDict)) {
            countDict[thisVerse] = thisCount;
            verseIDs.push(thisVerse);
        }
    }

    for (let j=0; j < verseIDs.length; j++) {
        totalCount += countDict[verseIDs[j]]
    }

    let resultDiv = document.createElement("div");
    resultDiv.className = "result-item";
    let headwordSpan = document.createElement("span");
    let formattedHeadword = result.headword.replaceAll("8", "ꝏ̄").replaceAll("$", " ");
    headwordSpan.innerHTML = `<strong>${formattedHeadword} (${totalCount})</strong> `; 
    resultDiv.appendChild(headwordSpan);

    return resultDiv;
}

type ResultEntry = { result: WordKJVResult; wordObj: WordObject };
type PageBucket = { label: string; items: ResultEntry[] };

function formatIndexLabel(label: string): string {
    const out = label.replaceAll("8", "ꝏ̄").replaceAll("$", " ");
    return out.trim().length ? out : "(blank)";
}

// The character index at which two sorted keys first differ — 0 when the first
// letters differ (the coarsest, most desirable cut point), larger for finer
// boundaries, largest for identical keys (the worst place to cut).
function diffLevel(a: string, b: string): number {
    const m = Math.min(a.length, b.length);
    for (let i = 0; i < m; i++) {
        if (a[i] !== b[i]) return i;
    }
    return a.length === b.length ? a.length + 1 : m;
}

// A short range label for a batch, e.g. "b–h" or "quta–qute" — the shared prefix
// of the first and last headword plus the first character where they diverge.
function batchLabel(items: ResultEntry[], getKey: (item: ResultEntry) => string): string {
    const MAX = 14;
    const f = getKey(items[0]);
    const l = getKey(items[items.length - 1]);
    if (f === l) return formatIndexLabel(f.slice(0, MAX));
    let c = 0;
    while (c < f.length && c < l.length && f[c] === l[c]) c++;
    const fp = formatIndexLabel(f.slice(0, Math.min(c + 1, MAX)));
    const lp = formatIndexLabel(l.slice(0, Math.min(c + 1, MAX)));
    return `${fp}–${lp}`;
}

// Break a sorted headword list into pages of ~target words. Each page is filled to
// roughly `target`, then its end is snapped to the coarsest letter boundary within a
// size window: sparse letters merge onto one page, a dense prefix is divided at its
// second/third letter, and — because every non-final page is at least minSize — a
// lone word never gets its own tab.
function buildBatches(items: ResultEntry[], getKey: (item: ResultEntry) => string, target: number): PageBucket[] {
    const n = items.length;
    const minSize = Math.max(2, Math.round(target * 0.5));
    const maxSize = Math.round(target * 1.5);
    const batches: ResultEntry[][] = [];

    let i = 0;
    while (i < n) {
        if (n - i <= maxSize) { batches.push(items.slice(i, n)); break; }
        const lo = i + minSize - 1;
        const hi = i + maxSize - 1;
        const targetEnd = i + target - 1;
        // Among the allowed cut positions, pick the coarsest boundary, breaking ties
        // toward the one nearest the target size.
        let best = hi, bestLevel = Infinity, bestDist = Infinity;
        for (let p = lo; p <= hi; p++) {
            const lvl = diffLevel(getKey(items[p]), getKey(items[p + 1]));
            const dist = Math.abs(p - targetEnd);
            if (lvl < bestLevel || (lvl === bestLevel && dist < bestDist)) {
                best = p; bestLevel = lvl; bestDist = dist;
            }
        }
        batches.push(items.slice(i, best + 1));
        i = best + 1;
    }

    // A short trailing page reads as overkill; fold it back into its predecessor.
    if (batches.length >= 2 && batches[batches.length - 1].length < minSize) {
        const tail = batches.pop() as ResultEntry[];
        const prev = batches[batches.length - 1];
        for (const it of tail) prev.push(it);
    }

    return batches.map(b => ({ label: batchLabel(b, getKey), items: b }));
}

function displayAllResults(results: WordKJVResult[], sortAlphabetically: boolean) {
    let citationContainer = document.getElementById("citation-column") as HTMLDivElement;
    let verseBoxContainer = document.getElementById("verse-box-column") as HTMLDivElement;
    let headlineContainer = document.getElementById("headline-container") as HTMLDivElement;
    headlineContainer.style.textAlign = 'center';

    // Clear previous results
    citationContainer.innerHTML = '';
    verseBoxContainer.innerHTML = '';
    headlineContainer.innerHTML = '';

    // Sort results based on user preference
    results = sortAlphabetically ? sortByAlphabet(results) : sortByFrequency(results);

    // Build every headword row synchronously. Each row's verses are fetched lazily
    // when the user expands it, so no network requests happen here — the search
    // renders instantly regardless of how many words match.
    let allObjects: ResultEntry[] = results.map(result => ({
        result,
        wordObj: getResultObjectStrict(result)
    }));

    let totalWords = allObjects.length;
    let totalVerses = allObjects.reduce((sum, obj) => sum + obj.wordObj.numVerses, 0);
    let allWordTokens = allObjects.reduce((sum, obj) => sum + obj.wordObj.numTokens, 0);

    // Create headline
    let headlineString = `<i>Found in <b>${totalVerses}</b> verses, representing <b>${totalWords}</b> separate tokens`;
    let headlineSpan = document.createElement('span');
    headlineSpan.innerHTML = headlineString;
    headlineSpan.style.textAlign = 'center';
    headlineSpan.style.fontSize = '1.2em';
    headlineContainer.appendChild(headlineSpan);

    // Alphabetical letter tabs (see buildAlphabeticalPages). Only shown when sorting
    // alphabetically and there's more than one page's worth of headwords.
    let pageIndexContainer = document.getElementById("page-index-container") as HTMLDivElement | null;
    if (pageIndexContainer) pageIndexContainer.innerHTML = '';

    const appendItems = (items: ResultEntry[]) => {
        let fragment = document.createDocumentFragment();
        items.forEach(obj => fragment.appendChild(obj.wordObj.parentDiv));
        citationContainer.appendChild(fragment);
    };

    const getKey = (obj: ResultEntry) => obj.result.headword || '';
    // Batch into ~50-word pages cut at letter boundaries (see buildBatches). Only
    // shown when sorting alphabetically; if it all fits in one batch, no tabs.
    const PAGE_SIZE = 50;
    const pages = sortAlphabetically ? buildBatches(allObjects, getKey, PAGE_SIZE) : [];

    if (pages.length > 1 && pageIndexContainer) {
        const container = pageIndexContainer;
        // Flexbox so the tab bar wraps onto multiple lines instead of running off
        // the side of the window when there are many batches.
        container.style.display = 'flex';
        container.style.flexWrap = 'wrap';
        container.style.justifyContent = 'center';
        container.style.gap = '2px 14px';
        const linkSpans: HTMLSpanElement[] = [];

        const showPage = (idx: number) => {
            citationContainer.innerHTML = '';
            verseBoxContainer.innerHTML = '';
            appendItems(pages[idx].items);
            linkSpans.forEach((span, i) => {
                span.style.fontWeight = i === idx ? 'bold' : 'normal';
                span.style.textDecoration = i === idx ? 'none' : 'underline';
            });
        };

        pages.forEach((page, idx) => {
            const link = document.createElement('span');
            link.textContent = `[${page.label}]`;
            link.style.cursor = 'pointer';
            link.style.color = 'blue';
            link.style.whiteSpace = 'nowrap';
            link.title = `${page.items.length} headword${page.items.length === 1 ? '' : 's'}`;
            link.addEventListener('click', () => showPage(idx));
            linkSpans.push(link);
            container.appendChild(link);
        });

        showPage(0);
    } else {
        appendItems(allObjects);
    }
}

type TriangleObject = {
    span: HTMLSpanElement;
    isClicked: boolean;
}

function createTriangleObject(): TriangleObject {
    let triangleSpan = document.createElement("span");
    triangleSpan.className = "triangle";
    triangleSpan.innerHTML = "▶";
    triangleSpan.style.cursor = 'pointer';

    let object: TriangleObject = {
        span: triangleSpan,
        isClicked: false,
    }
    return object;
}

type VerseDisplaySuperdict = {
    [key: string]: VerseDisplayDict[]
}

type WordObject = {
    parentDiv: HTMLDivElement;
    childContainer: HTMLDivElement;
    triangle: TriangleObject;
    verseBoxDict: VerseDisplaySuperdict;
    numVerses: number;
    numTokens: number; 
}

type AddressSpanObject = {
    outerSpan: HTMLSpanElement;
    innerSpan: HTMLSpanElement;
    table: HTMLTableElement;
    count: number;
}

function getDisplayBox(rawDict: VerseDisplayDict, headword: string, isHebrew: boolean, bookName: string): HTMLTableElement {
    let dictKeys = Object.keys(rawDict) as (keyof VerseDisplayDict)[];

    console.log("HERE ARE DICTKEYS")
    console.log(dictKeys);
    let newDict: StringToStringDict = {};
    
    // Populate newDict with verse texts and calculate content lengths
    let maxLengths: { [key: string]: number } = {};
    for (let i = 0; i < dictKeys.length; i++) {
        let key = dictKeys[i];
        if (['2', '3', '4', '5', '7', '8'].includes(key) && rawDict[key]?.toString().trim()) {
            newDict[key] = rawDict[key].toString();
            // Calculate max word length in this text
            const words = newDict[key].split(/\s+/);
            const maxWordLength = Math.max(...words.map(w => w.length));
            maxLengths[key] = maxWordLength;
        }
    }

    let table = document.createElement('table');
    table.classList.add('display-box');

    let thead = document.createElement('thead');
    let headerRow = document.createElement('tr');

    let tbody = document.createElement('tbody');
    let verseRow = document.createElement('tr');

    let editionNumToTitleHTML: StringToStringDict = {
        '2': '<b><u>α</b></u>',
        '3': '<b><u>β</b></u>',
        '5': '<b><u>M</b></u>',
        '7': '<b><u>א</b></u>',
        '4': '<b><u>KJV</b></u>',
        '8': isHebrew ? '<b><u>Heb.</u></b>' : '<b><u>Grk.</u></b>'
    };

    // Not KJV if it's Mishnaic...
    let mishnaicTexts = ["Family Religion", "Milk for Babes", "Lord's Day", "Confession of Faith"];

    if (mishnaicTexts.includes(bookName)) {
        editionNumToTitleHTML['2'] = "<b><u>Mass.</b></u>"
        editionNumToTitleHTML['4'] = "<b><u>English</b></u>"
        editionNumToTitleHTML['5'] = "<b><u>Mayhew</b></u>"
    }

    const desiredOrder = ['7', '2', '3', '5', '4', '8'];
    const validKeys = Object.keys(newDict)
        .filter(key => newDict[key]?.toString().trim() !== '' && editionNumToTitleHTML[key])
        .sort((a, b) => desiredOrder.indexOf(a) - desiredOrder.indexOf(b));

    // Calculate appropriate column widths
    validKeys.forEach(key => {
        let th = document.createElement('th');
        th.innerHTML = editionNumToTitleHTML[key];
        headerRow.appendChild(th);
        
        let td = document.createElement('td');
        td.innerHTML = processTextInBox(newDict[key], headword, (parseInt(key)));
        verseRow.appendChild(td);
    });

    thead.appendChild(headerRow);
    tbody.appendChild(verseRow);
    table.appendChild(thead);
    table.appendChild(tbody);
    
    return table;
}

function clickOnCiteSpan(object: AddressSpanObject) {
    let innerAddressSpans = document.getElementsByClassName('address-inner-span') as HTMLCollectionOf<HTMLSpanElement>;
    for (let i=0; i < innerAddressSpans.length; i++) {
        let thisSpan = innerAddressSpans[i];
        thisSpan.style.fontWeight = "normal";
        thisSpan.style.color = "";
        thisSpan.style.borderBottom = "1px dotted black";
    }

    let outerAddressSpans = document.getElementsByClassName('address-outer-span') as HTMLCollectionOf<HTMLSpanElement>
    for (let i=0; i < outerAddressSpans.length; i++) {
        let thisSpan = outerAddressSpans[i];
        thisSpan.classList.remove('active');
    }

    let outerSpan = object.innerSpan;
    outerSpan.classList.add("active");
    let triggeringSpan = object.innerSpan;
    triggeringSpan.style.fontWeight = "bold";
    triggeringSpan.style.borderBottom = "2px dotted blue";
    triggeringSpan.style.color = "blue";

    let verseBoxContainer = document.getElementById("verse-box-column") as HTMLDivElement;
    verseBoxContainer.innerHTML = "";
    //verseBoxContainer.innerHTML = 'HELLO';

    verseBoxContainer.appendChild(object.table);
}

function getAddressSpan(countDict: { [key: string]: number }, rawAddress: string, bookName: string, textDict: VerseDisplayDict, headword: string): AddressSpanObject {
    console.log(countDict);
    let rawKeys = Object.keys(countDict);
    console.log("Here's the raw key list in getAddressSpan")
    console.log(rawKeys);
    console.log(rawAddress);
    let keys: string[] = [];

    for (let i=0; i < rawKeys.length; i++) {
        let key = rawKeys[i];
        if (key.slice(0, -1) == rawAddress) {
            keys.push(key);
        }
    }

    keys = keys.sort((a, b) => parseInt(b) - parseInt(a));
    console.log("here's the key list in getAddressSpan")
    console.log(keys);
    let address = getVerseAddress(rawAddress);

    console.log("here's address to count dict in getAddressSpan")
    console.log(countDict);

    let editionToPrefixDict: {[key: string]: string} = {
        '2': 'α',
        '3': 'β',
        '5': 'M',
        '7': 'א',
        '6': '',
        '10': 'αM',
        '14': 'αא',
        '15': 'βM',
        '35': 'אβ'
    }

    if (bookName == "John" || bookName == "Psalms (prose)") {
        editionToPrefixDict['6'] = 'αβ';
    }

    let isHebrew = false;
    const bookID = bookToIDDict[bookName as BookName];
    if (bookID) {
        isHebrew = (parseInt(bookID) < 40);
    }

    let editionNum = 1;
    let allCounts: number[] = [];
    let totalCount = 0;
    let notAllCountsSame: boolean = false;
    console.log("For loop in getAddressSpan")
    for (let i=0; i < keys.length; i++) {
        let key = keys[i];
        console.log(key);
        console.log(typeof key);
        editionNum *= parseInt(key.at(-1) ?? '0');
        console.log(countDict);
        let count = countDict[key];
        if (allCounts.length > 0) {
            if (allCounts[allCounts.length - 1] != count) {
                notAllCountsSame = true;
            }
        }
        allCounts.push(count);
        totalCount += count;
    }

    let spanInnerHTML = "";
    console.log("here's the editionNum")
    console.log(editionNum);
    if (editionNum.toString() in editionToPrefixDict) {
        spanInnerHTML += "<sup>"+ editionToPrefixDict[editionNum.toString()] + "</sup>";
    }
    spanInnerHTML += address;
    if (totalCount > 1) {
        spanInnerHTML += " (" + totalCount + ")";
    }

    if (notAllCountsSame) {
        let countString = "";
        for (let j=0; j < allCounts.length; j++) {
            countString += allCounts[j].toString() + "/";
        }
        countString = countString.slice(0, -1);
        spanInnerHTML += "<sup>" + countString + "</sup>";
    }

    let addressSpan = document.createElement("span");
    addressSpan.classList.add("address-outer-span");
    let addressInnerSpan = document.createElement("span");
    //addressSpan.classList.add("address-span-hello");
    addressInnerSpan.style.borderBottom = '1px dotted black';
    addressInnerSpan.classList.add("address-inner-span");
    addressInnerSpan.style.cursor = 'pointer';
    addressInnerSpan.innerHTML = spanInnerHTML;

    let displayBox = getDisplayBox(textDict, headword, isHebrew, bookName);
 
    addressSpan.addEventListener("mouseover", (event) => {
        addressInnerSpan.style.fontWeight = "bold";
        addressInnerSpan.style.borderBottom = '2px dotted black';
        //displayBox.style.display = "none";
        //mouseoverAddressSpan(addressInnerSpan, displayBox, window);
    });
    

    //fix this so it doesn't fire if you're looking at something else
    addressSpan.addEventListener("mouseleave", () => {
        if (!addressSpan.classList.contains("active")) {
            addressInnerSpan.style.fontWeight = "normal";
            addressInnerSpan.style.color = "";
            addressInnerSpan.style.borderBottom = '1px dotted black';
        }
        
    });

    let object: AddressSpanObject = {
        outerSpan: addressSpan,
        innerSpan: addressInnerSpan,
        table: displayBox,
        count: totalCount
    }

    object.outerSpan.addEventListener("click", () => {
        clickOnCiteSpan(object);
    });

    object.outerSpan.appendChild(object.innerSpan);
    //addressSpan.appendChild(displayBox);

    return object;
}

function getOneBookDiv(bookName: string, matchingVerseTexts: VerseDisplayDict[], genericIDs: string[], addressToCountDict: { [key: string]: number }, headword: string) {
    let bookDiv = document.createElement("div");
    bookDiv.className = "book-div";
    bookDiv.style.paddingBottom = "8px";
    let bookSpan = document.createElement("span");
    let totalCount = 0;

    for (let i=0; i < Object.keys(addressToCountDict).length; i++) {
        totalCount += addressToCountDict[Object.keys(addressToCountDict)[i]];
    }

    bookSpan.innerHTML = "&nbsp;&nbsp;&nbsp;&nbsp;<i>" + bookName + "</i> (" + totalCount + "): ";
    bookDiv.appendChild(bookSpan);

    let thisBookVerseDisplaySuperDict: {[key: string]: VerseDisplayDict} = {};

    for (let i=0; i < matchingVerseTexts.length; i++) {
        let dict = matchingVerseTexts[i];
        let generic = dict['genericID'];
        thisBookVerseDisplaySuperDict[generic] = dict;
    }

    for (let i=0; i < genericIDs.length; i++) {
        let generic = genericIDs[i];
        let thisGenericDict = thisBookVerseDisplaySuperDict[generic];
        let addressSpanObject = getAddressSpan(addressToCountDict, generic, bookName, thisGenericDict, headword);

        // Create a container for the address span and comma
        let container = document.createElement('span');
        container.appendChild(addressSpanObject.outerSpan);
        
        // Add comma after the span (not inside it) if not the last item
        if (i < genericIDs.length - 1) {
            let commaSpan = document.createElement('span');
            commaSpan.textContent = ', ';
            container.appendChild(commaSpan);
        }
        
        bookDiv.appendChild(container);
    }
    
    return bookDiv;
}


function getBookDivs(matchingVerseTexts: VerseDisplaySuperdict, addressToCountDict: { [key: string]: number }, headword: string) {
    let divArray: HTMLDivElement[] = [];
    let allBooks = Object.keys(matchingVerseTexts);

    allBooks.sort((a, b) => allBookList.indexOf(a) - allBookList.indexOf(b));

    let allEditionIDs = Object.keys(addressToCountDict);
    let bookToGenericListDict: {[key: string]: string[]} = {}



    let bookToCountDict: {[key: string]: StringToIntDict} = {};
    for (let i=0; i < allEditionIDs.length; i++) {
        let generic = allEditionIDs[i].slice(0, -1);
        console.log(generic);
        let bookNum = generic.slice(1, 4);
        let book = IDToBookDict[bookNum];
        if (!(book in bookToGenericListDict)) {
            bookToCountDict[book] = {};
            bookToGenericListDict[book] = [];
        }
        if (!bookToGenericListDict[book].includes(generic)) {
            bookToGenericListDict[book].push(generic);
        }
        bookToCountDict[book][allEditionIDs[i]] = addressToCountDict[allEditionIDs[i]];
    }



    allBooks.forEach(book => {
        let allTexts = matchingVerseTexts[book];
        allTexts = allTexts.sort((a, b) => {
            // First compare chapters
            if (a["chapter"] !== b["chapter"]) {
              return a["chapter"] - b["chapter"];
            }
            
            // If chapters are equal, compare verses
            return a["verse"] - b["verse"];
          });
        let thisBookGenerics = bookToGenericListDict[book];
        console.log(thisBookGenerics);
        let thisBookCountDictionary: StringToIntDict = {};
        let thisBookDiv = getOneBookDiv(book, allTexts, thisBookGenerics, bookToCountDict[book], headword);
        divArray.push(thisBookDiv);
    });

    return divArray;

}

// Build a headword's result row WITHOUT fetching its verses. The verse texts are
// only needed once the user expands the row, so they're fetched lazily on first
// click. This keeps the search itself instant no matter how many headwords match.
function getResultObjectStrict(result: WordKJVResult): WordObject {
    let topDiv = getResultDiv(result);

    let triangleObject = createTriangleObject();
    topDiv.appendChild(triangleObject.span);

    let allAddressNums = result.verses;
    let allAddresses: string[] = [];

    let totalTokens: number = 0;
    let addressToCountDict = {} as { [key: string]: number };
    let genericVerses = new Set<string>();
    for (let i = 0; i < allAddressNums.length; i++) {
        let addressNum = allAddressNums[i];
        let count = result.counts[i];
        let rawAddressString = addressNum.toString();
        let newAddressString = "1" + rawAddressString.slice(1) + rawAddressString[0];
        totalTokens += count;
        addressToCountDict[newAddressString] = count;
        let genericAddress = newAddressString.slice(0, -1);
        allAddresses.push(genericAddress);
        genericVerses.add(genericAddress);
    }

    allAddresses.sort((a, b) => parseInt(b) - parseInt(a));

    let childContainerDiv = document.createElement("div");

    let object: WordObject = {
        parentDiv: topDiv,
        childContainer: childContainerDiv,
        triangle: triangleObject,
        verseBoxDict: {},
        numVerses: genericVerses.size,
        numTokens: totalTokens
    }

    let versesLoaded = false;
    let loadingPromise: Promise<void> | null = null;

    async function loadVerses(): Promise<void> {
        if (versesLoaded) return;
        if (loadingPromise) return loadingPromise;

        loadingPromise = (async () => {
            let matchingVerseTextsRaw;
            try {
                matchingVerseTextsRaw = await grabMatchingVerses(allAddresses);
            } catch (err) {
                console.error(`Failed to load verses for "${result.headword}":`, err);
                childContainerDiv.innerHTML =
                    '<span style="color:red;">&nbsp;&nbsp;&nbsp;&nbsp;Could not load verses. Collapse and expand to retry.</span>';
                loadingPromise = null; // allow a retry on the next expand
                return;
            }

            let matchingVerseTexts: VerseDisplaySuperdict = {};
            for (let i = 0; i < matchingVerseTextsRaw.length; i++) {
                let thisMatchingVerse = matchingVerseTextsRaw[i];
                let subdict: VerseDisplayDict = {
                    '2': thisMatchingVerse['first_edition'],
                    '3': thisMatchingVerse['second_edition'],
                    '5': thisMatchingVerse['mayhew'],
                    '7': thisMatchingVerse['zeroth_edition'],
                    '4': thisMatchingVerse['kjv'],
                    '8': "",
                    //'8': thisMatchingVerse['grebrew'].replaceAll('<span style="color:blue">', "").replaceAll("</span>", ""),
                    'book': thisMatchingVerse['book'],
                    'chapter': thisMatchingVerse['chapter'],
                    'verse': thisMatchingVerse['verse'],
                    'genericID': thisMatchingVerse['verse_id'],
                    'count': addressToCountDict[thisMatchingVerse['verse_id']]
                };

                if (thisMatchingVerse['book'] in matchingVerseTexts) {
                    matchingVerseTexts[thisMatchingVerse['book']].push(subdict);
                } else {
                    matchingVerseTexts[thisMatchingVerse['book']] = [subdict];
                }
            }

            object.verseBoxDict = matchingVerseTexts;
            let bookDivs = getBookDivs(matchingVerseTexts, addressToCountDict, result.headword);
            childContainerDiv.innerHTML = '';
            bookDivs.forEach(bookDiv => {
                childContainerDiv.appendChild(bookDiv);
            });
            versesLoaded = true;
        })();

        return loadingPromise;
    }

    object.triangle.span.onclick = async () => {
        object.triangle.isClicked = !object.triangle.isClicked;
        object.triangle.span.innerHTML = object.triangle.isClicked ? "▼" : "▶";
        if (object.triangle.isClicked) {
            object.triangle.span.style.color = "blue";
            if (!versesLoaded) {
                childContainerDiv.innerHTML =
                    '<span style="color:gray;">&nbsp;&nbsp;&nbsp;&nbsp;Loading…</span>';
            }
            object.parentDiv.appendChild(object.childContainer);
            await loadVerses();
        } else {
            object.triangle.span.style.color = "";
            if (object.parentDiv.contains(object.childContainer)) {
                object.parentDiv.removeChild(object.childContainer);
            }
        }
    }

    return object;
}


async function processVerseList() {

}


async function search() {
    const searchInput = document.getElementById("search_bar") as HTMLInputElement;
    const searchInputValue = searchInput.value.trim();
    const searchDropdown = document.getElementById("searchWordDropdown") as HTMLSelectElement;
    const searchType = searchDropdown.value;
    const alphabeticalSorting = document.getElementById("sortAlph") as HTMLInputElement;
    
    const sortAlphabetically = alphabeticalSorting?.checked ?? false;

    const results = await sendWordSearch(searchInputValue, searchType, 'strict');
    console.log('Search results:', results);

    displayAllResults(results, sortAlphabetically);
}

// Event listeners
document.getElementById("submitButton")?.addEventListener("click", search);
document.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        search();
    }
});