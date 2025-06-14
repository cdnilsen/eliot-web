import { totalmem } from "os";
import { sectionToBookDict, bookToChapterDict, IDToBookDict, stringToStringListDict, StringToStringDict, allBookList, StringToIntDict, bookToIDDict, BookName } from "./library.js"

function cleanWord(word: string) {
    if (word.startsWith("OO")) {
        word = "8" + word.slice(2);
    }
    word = word.toLowerCase();
    word = word.replace("ᴏᴅ", "od");
    word = word.replace("ᴏʀᴅ", "ord")
    let punctuation = [".", ",", ";", ":", "!", "?", "(", ")", "[", "]", "{", "}", "<", ">", "\"", "'", "“", "”", "‘", "’", "—", "–", "…", "·"];
    for (let i=0; i < punctuation.length; i++) {
        word = word.replace(punctuation[i], "");
    }
    return word;
}


type WordMassResult = {
    headword: string;
    no_diacritics: string;
    verses: number[];
    counts: number[];
    editions: number;
}

async function sendWordSearch(searchString: string, searchType: string, diacritics: "lax" | "strict"): Promise<WordMassResult[]> {
    searchString = searchString.split('*').join('%');
    searchString = searchString.split('(').join('');
    searchString = searchString.split(')').join('?');
    
    const url = `/search_mass?pattern=${encodeURIComponent(searchString)}&searchType=${searchType}&diacritics=${diacritics}`;
    console.log('URL:', url);

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log("Here's the data from sendWordSearch on line 23-24");
        console.log(data);
        return data;
    } catch (error) {
        console.error('Error searching words:', error);
        return [];
    }
}

function sortByAlphabet(results: WordMassResult[], diacritics: "lax" | "strict"): WordMassResult[] {

    return [...results].sort((a, b) => {
        let aWord = a.headword;
        let bWord = b.headword;
        if (diacritics = "lax") {
            
            

        }
        let i = 0;
        
        while (i < aWord.length && i < bWord.length) {
            const aChar = aWord[i];
            const bChar = bWord[i];
            
            // If both characters are '8', move to next character
            if (aChar === '8' && bChar === '8') {
                i++;
                continue;
            }
            
            // If one is '8', it should come after everything
            if (aChar === '8') return 1;
            if (bChar === '8') return -1;
            
            // Regular character comparison
            if (aChar !== bChar) {
                return aChar.localeCompare(bChar);
            }
            
            i++;
        }
        
        // Handle different length strings
        return aWord.length - bWord.length;
    });
}

function sortByFrequency(results: WordMassResult[], diacritics: "lax" | "strict") {
    return results.sort((a, b) => {
        // First compare by total frequency
        const freqA = a.counts.reduce((sum, val) => sum + val, 0);
        const freqB = b.counts.reduce((sum, val) => sum + val, 0);
        
        // If frequencies are different, sort by that
        if (freqB !== freqA) {
            return freqB - freqA;
        }
        
        // If frequencies are equal, use alphabetical sorting
        return sortByAlphabet([a], diacritics)[0].headword.localeCompare(
            sortByAlphabet([b], diacritics)[0].headword
        );
    });
}

const sortCitationOrder = (arr: string[]): string[] => {
    return arr.sort((a, b) => {
        const [aPre, aPost] = a.split('.');
        const [bPre, bPost] = b.split('.');
        
        // First compare the numbers before the decimal
        const preCompare = parseInt(aPre) - parseInt(bPre);
        if (preCompare !== 0) return preCompare;
        
        // If those are equal, compare the numbers after the decimal
        return parseInt(aPost) - parseInt(bPost);
    });
};

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


type AddressSpanObject = {
    outerSpan: HTMLSpanElement;
    innerSpan: HTMLSpanElement;
    table: HTMLTableElement;
    count: number;
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

function mouseoverAddressSpan(innerSpan: HTMLSpanElement, displayBox: HTMLTableElement, window: Window) {
    innerSpan.style.fontWeight = "bold";
    //innerSpan.style.color = "blue";
    innerSpan.style.borderBottom = '2px dotted black';

    // Get the position relative to the viewport
    const rect = innerSpan.getBoundingClientRect();
        
    // Position the tooltip relative to the viewport
    displayBox.style.display = "block";

    // Calculate position to ensure tooltip stays on screen
    const viewportWidth = window.innerWidth;
    const tooltipWidth = displayBox.offsetWidth;

    // Start with default position to the right
    let left = rect.right + 10;
        
    // If tooltip would go off right edge, position to the left instead
    if (left + tooltipWidth > viewportWidth - 20) {
        left = rect.left - tooltipWidth - 10;
    }
    
    // If tooltip would go off left edge, position below instead
    if (left < 20) {
        left = Math.max(20, rect.left);
    }

    displayBox.style.left = `${left}px`;
    displayBox.style.top = `${rect.top}px`;
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

function resultDiv(result: WordMassResult): HTMLDivElement {
    /* 
        The way it calculates the total count is correct, but there's a backend issue that results in many verses being counted multiple times. That will need to be fixed at some point but for the time being we'll kludge in a fix.
    */

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

function getResultObjectLax() {

}

function rearrangeAddress(addressList: number[]) {

    let numList = [] as number[];
    let rearrangedList = [] as string[];

    for (let i=0; i < addressList.length; i++) {
        let address = addressList[i].toString();
        let newAddress = "1" + address.slice(1) + address[0];
        numList.push(parseInt(newAddress));
    }
    numList = numList.sort((a, b) => b - a);

    for (let i=0; i < numList.length; i++) {
        let address = numList[i].toString().slice(1);
        rearrangedList.push(address);
    }
    console.log(rearrangedList);
    return rearrangedList;
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

function processTextInBox(text: string, headword: string, isMass: boolean) {
    if (isMass) {
        let splitText = text.split(" ");
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
            word = word.replaceAll("八", "8");

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

type VerseDisplayDict = {
    '2': string, // First Edition
    '3': string, // Second Edition
    '5': string, // Mayhew
    '7': string, // Zeroth Edition
    '4': string, // KJV
    '8': string, // Grebrew
    'book': string,
    'chapter': number,
    'verse': number,
    'genericID': string,
    'count': number
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
        td.innerHTML = processTextInBox(newDict[key], headword, (parseInt(key) % 4 != 0));
        verseRow.appendChild(td);
    });

    thead.appendChild(headerRow);
    tbody.appendChild(verseRow);
    table.appendChild(thead);
    table.appendChild(tbody);
    
    return table;
}

async function grabMatchingVerses(addresses: string[]) {
    // Remove the number conversion - just pass the strings directly
    try {
        const queryParams = new URLSearchParams({
            addresses: addresses.join(',')  // Keep as strings
        });
        
        const response = await fetch(`/matching_verses?${queryParams}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();

        try {
            return data;
        } catch (error) {
            console.error('Error parsing matching verses:', error);
            throw error;
        }
    } catch (error) {
        console.error('Error fetching matching verses:', error);
        throw error;
    }
}

async function getResultObjectStrict(result: WordMassResult) {
    let topDiv = resultDiv(result);

    let triangleObject = createTriangleObject();
    topDiv.appendChild(triangleObject.span);

    let allAddressNums = result.verses;
    let allAddresses: string[] = [];

    let totalTokens: number = 0;
    let addressToCountDict = {} as { [key: string]: number };
    for (let i = 0; i < allAddressNums.length; i++) {
        let addressNum = allAddressNums[i];
        let count = result.counts[i];
        let rawAddressString = addressNum.toString();
        let newAddressString = "1" + rawAddressString.slice(1) + rawAddressString[0];
        totalTokens += count;
        addressToCountDict[newAddressString] = count;
        allAddresses.push(newAddressString.slice(0, -1));
    }

    allAddresses.sort((a, b) => parseInt(b) - parseInt(a));

    let matchingVerseTextsRaw = await grabMatchingVerses(allAddresses);

    let matchingVerseTexts: VerseDisplaySuperdict = {};

    for (let i=0; i < matchingVerseTextsRaw.length; i++) {
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

    let editionDict = {
        '2': 'α',
        '3': 'β',
        '5': 'M',
        '7': 'א'
    }

    let bookDivs = getBookDivs(matchingVerseTexts, addressToCountDict, result.headword);
    let childContainerDiv = document.createElement("div");

    bookDivs.forEach(bookDiv => {   
        childContainerDiv.appendChild(bookDiv);
    })

    let object: WordObject = {
        parentDiv: topDiv,
        childContainer: childContainerDiv,
        triangle: triangleObject,
        verseBoxDict: matchingVerseTexts,
        numVerses: matchingVerseTextsRaw.length,
        numTokens: totalTokens
    }

    object.triangle.span.onclick = () => {
        object.triangle.isClicked = !object.triangle.isClicked;
        object.triangle.span.innerHTML = object.triangle.isClicked ? "▼" : "▶";
        if (object.triangle.isClicked) {
            object.triangle.span.style.color = "blue";
            object.parentDiv.appendChild(object.childContainer);
            console.log("Matching verse texts for " + result.headword);
            console.log(matchingVerseTexts);
        } else {
            object.triangle.span.style.color = "";
            object.parentDiv.removeChild(object.childContainer);
        }
        
    }

    return object;

    //console.log(addressBook);
}

async function displayAllResults(results: WordMassResult[], diacritics: "lax" | "strict", sortAlphabetically: boolean) {
    let citationContainer = document.getElementById("citation-column") as HTMLDivElement;
    let verseBoxContainer = document.getElementById("verse-box-column") as HTMLDivElement;
    let headlineContainer = document.getElementById("headline-container") as HTMLDivElement;
    headlineContainer.style.textAlign = 'center';

    // Clear previous results
    citationContainer.innerHTML = ''; 
    verseBoxContainer.innerHTML = '';
    headlineContainer.innerHTML = '';

    // Create all WordObjects first
    let allObjects: {result: WordMassResult, wordObj: WordObject}[] = [];
    await Promise.all(results.map(async result => {
        let wordObj = await getResultObjectStrict(result);
        allObjects.push({result, wordObj});
    }));

    // Sort based on user preference
    if (sortAlphabetically) {
        allObjects.sort((a, b) => {
            let aWord = a.result.headword;
            let bWord = b.result.headword;
            
            if (diacritics === "lax") {
                aWord = a.result.no_diacritics;
                bWord = b.result.no_diacritics;
            }
            
            let i = 0;
            while (i < aWord.length && i < bWord.length) {
                const aChar = aWord[i];
                const bChar = bWord[i];
                
                if (aChar === '8' && bChar === '8') {
                    i++;
                    continue;
                }
                
                if (aChar === '8') return 1;
                if (bChar === '8') return -1;
                
                if (aChar !== bChar) {
                    return aChar.localeCompare(bChar);
                }
                
                i++;
            }
            
            return aWord.length - bWord.length;
        });
    } else {
        allObjects.sort((a, b) => {
            const freqA = a.result.counts.reduce((sum, val) => sum + val, 0);
            const freqB = b.result.counts.reduce((sum, val) => sum + val, 0);
            
            if (freqB !== freqA) {
                return freqB - freqA;
            }
            
            // If frequencies are equal, use diacritics-aware alphabetical sorting
            let aWord = diacritics === "lax" ? a.result.no_diacritics : a.result.headword;
            let bWord = diacritics === "lax" ? b.result.no_diacritics : b.result.headword;
            
            let i = 0;
            while (i < aWord.length && i < bWord.length) {
                const aChar = aWord[i];
                const bChar = bWord[i];
                
                if (aChar === '8' && bChar === '8') {
                    i++;
                    continue;
                }
                
                if (aChar === '8') return 1;
                if (bChar === '8') return -1;
                
                if (aChar !== bChar) {
                    return aChar.localeCompare(bChar);
                }
                
                i++;
            }
            
            return aWord.length - bWord.length;
        });
    }

    // Calculate totals
    let totalWords = allObjects.length;
    let totalVerses = allObjects.reduce((sum, obj) => sum + obj.wordObj.numVerses, 0);
    let allWordTokens = allObjects.reduce((sum, obj) => sum + obj.wordObj.numTokens, 0);

    // Display headline
    let headlineString = `<i>Found <b>${allWordTokens}</b> tokens, representing <b>${totalWords}</b> separate headwords, across <b>${totalVerses}</b> verses.</i><br><br>`;
    let headlineSpan = document.createElement('span');
    headlineSpan.innerHTML = headlineString;
    headlineSpan.style.textAlign = 'center';
    headlineSpan.style.fontSize = '1.2em';
    headlineContainer.appendChild(headlineSpan);

    // Display results in sorted order
    allObjects.forEach(obj => {
        citationContainer.appendChild(obj.wordObj.parentDiv);
    });
}


async function search() {

    let searchInput = document.getElementById("search_bar") as HTMLInputElement;
    let searchInputValue = searchInput.value.trim();
    let searchDropdown = document.getElementById("searchWordDropdown") as HTMLSelectElement;
    let searchType = searchDropdown.value;
    let laxDiacritics = document.getElementById("diacriticsLax") as HTMLInputElement;

    let alphabeticalSorting = document.getElementById("sortAlph") as HTMLInputElement
    
    // Set diacritics mode based on radio button
    const diacritics = laxDiacritics?.checked ? 'lax' : 'strict';

    const sortAlphabetically = alphabeticalSorting?.checked ? true : false;

    const results = await sendWordSearch(searchInputValue, searchType, diacritics);
    console.log('Search results:', results);

    displayAllResults(results, diacritics, sortAlphabetically);
}


let submitButton = document.getElementById("submitButton");
submitButton?.addEventListener("click", async () => {
    await search();
});

document.addEventListener("keydown", async (event) => {
    if (event.key === "Enter") {
        await search();
    }
});