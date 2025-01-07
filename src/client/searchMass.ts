import { sectionToBookDict, bookToChapterDict, IDToBookDict, stringToStringListDict } from "./library.js"

type WordMassResult = {
    headword: string;
    verses: number[];
    counts: number[];
    editions: number;
}

async function sendWordSearch(searchString: string, searchType: string, diacritics: "lax" | "strict"): Promise<WordMassResult[]> {
    searchString = searchString.split('*').join('%');
    searchString = searchString.split('(').join('');
    searchString = searchString.split(')').join('?');
    
    console.log('URL:', `/search_mass?pattern=${encodeURIComponent(searchString)}&searchType=${searchType}`);

    try {
        const response = await fetch(`/search_mass?pattern=${encodeURIComponent(searchString)}&searchType=${searchType}`);
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

function sortByAlphabet(results: WordMassResult[]): WordMassResult[] {
    return [...results].sort((a, b) => {
        const aWord = a.headword;
        const bWord = b.headword;
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



function sortByFrequency(results: WordMassResult[]) {
    return results.sort((a, b) => b.counts.reduce((sum, val) => sum + val, 0) - a.counts.reduce((sum, val) => sum + val, 0));
}

type TriangleObject = {
    span: HTMLSpanElement;
    isClicked: boolean;
}

function createTriangleObject(): TriangleObject {
    let triangleSpan = document.createElement("span");
    triangleSpan.className = "triangle";
    triangleSpan.innerHTML = "▶";

    let object: TriangleObject = {
        span: triangleSpan,
        isClicked: false,
    }

    triangleSpan.onclick = () => {
        object.isClicked = !object.isClicked;
        triangleSpan.innerHTML = object.isClicked ? "▼" : "▶";
        if (object.isClicked) {
            triangleSpan.style.color = "blue";
        } else {
            triangleSpan.style.color = "";
        }
    }
    return object;
}

function resultDiv(result: WordMassResult): HTMLDivElement {

    let resultDiv = document.createElement("div");
    resultDiv.className = "result-item";
    let headwordSpan = document.createElement("span");
    let totalCount = result.counts.reduce((sum, val) => sum + val, 0);
    let formattedHeadword = result.headword.replaceAll("8", "ꝏ̄");
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
    return killLeadingZeros(rawChapter) + "." + killLeadingZeros(rawVerse)
}


type AddressBook = {
    [key: string]: {
        [key: string]: {
            [key: string]: number;
        }
    }
}

type WordObject = {
    div: HTMLDivElement;
    addressBook: AddressBook;
    triangle: TriangleObject;
}

function getResultObjectStrict(result: WordMassResult) {
    let topDiv = resultDiv(result);

    let triangleObject = createTriangleObject();
    topDiv.appendChild(triangleObject.span);

    let allAddressNums = result.verses;
    let allAddresses: string[] = [];

    let addressToCountDict = {} as { [key: string]: number };
    for (let i = 0; i < allAddressNums.length; i++) {
        let addressNum = allAddressNums[i];
        let count = result.counts[i];

        let rawAddressString = addressNum.toString();
        let newAddressString = "1" + rawAddressString.slice(1) + rawAddressString[0];
        addressToCountDict[newAddressString] = count;
        allAddresses.push(newAddressString);
    }

    allAddresses.sort((a, b) => parseInt(b) - parseInt(a));
    console.log(result.headword);
    console.log(allAddresses);
    //console.log(allAddresses[0]) // (e.g. '0430060275')
    //console.log(typeof allAddresses[0]) //(string)

    let allBooks: string[] = []
    let addressBook: AddressBook = {};

    let editionDict = {
        '2': 'α',
        '3': 'β',
        '5': 'M',
        '7': 'א'
    }

    for (let i=0; i < allAddresses.length; i++) {
        let address = allAddresses[i];
        let bookKey = address.slice(1, 4);
        let book = IDToBookDict[bookKey];

        //console.log(book)
        //console.log(addressToCountDict[allAddresses[i]])

        if (!allBooks.includes(book)) {
            allBooks.push(book);
            addressBook[book] = {};
        }
        let verse = getVerseAddress(allAddresses[i]);
        console.log(verse)

        let edition = allAddresses[i][10];

        if (verse in addressBook[book]) {
            addressBook[book][verse][edition] = addressToCountDict[allAddresses[i]];
        } else {
            addressBook[book][verse] = {
                [edition]: addressToCountDict[allAddresses[i]]
            }
        }
    }

    let object: WordObject = {
        div: topDiv,
        addressBook: addressBook,
        triangle: triangleObject
    }

    object.triangle.span.onclick = () => {
        console.log(object.addressBook);
    }

    //console.log(addressBook);
}

function displayAllResults(results: WordMassResult[], diacritics: "lax" | "strict", sortAlphabetically: boolean) {
    let resultsContainer = document.getElementById("results-container") as HTMLDivElement;
    resultsContainer.innerHTML = ''; // Clear previous results

    if (sortAlphabetically) {
        results = sortByAlphabet(results);
    } else {
        results = sortByFrequency(results);
    }

    //console.log(results[0])

    results.forEach(result => {
        getResultObjectStrict(result);
    });

}


async function search() {

    let searchInput = document.getElementById("search_bar") as HTMLInputElement;
    let searchInputValue = searchInput.value;
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