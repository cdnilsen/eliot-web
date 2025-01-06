import { sectionToBookDict, bookToChapterDict, IDToBookDict } from "./library.js"

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


function createTriangleObject(resultDiv: HTMLDivElement, result: WordMassResult) {
    let triangleSpan = document.createElement("span");
    triangleSpan.className = "triangle";
    triangleSpan.innerHTML = "▶";

    let object = {
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
    headwordSpan.innerHTML = `<strong>${result.headword} (${totalCount})</strong> `; 
    resultDiv.appendChild(headwordSpan);
    let triangleObject = createTriangleObject(resultDiv, result);
    resultDiv.appendChild(triangleObject.span);
    

    return resultDiv;
}

function displayAllResults(results: WordMassResult[], diacritics: "lax" | "strict", sortAlphabetically: boolean) {
    let resultsContainer = document.getElementById("results-container") as HTMLDivElement;
    resultsContainer.innerHTML = ''; // Clear previous results

    if (sortAlphabetically) {
        results = sortByAlphabet(results);
    } else {
        results = sortByFrequency(results);
    }

    console.log(results[0])

    results.forEach(result => {
        resultsContainer.appendChild(resultDiv(result));
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