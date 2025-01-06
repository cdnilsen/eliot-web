import { sectionToBookDict, bookToChapterDict } from "./library.js"

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

function sortByAlphabet(results: WordMassResult[]) {
    return results;
}


function sortByFrequency(results: WordMassResult[]) {
    return results.sort((a, b) => b.counts.reduce((sum, val) => sum + val, 0) - a.counts.reduce((sum, val) => sum + val, 0));
}

function displayResults(results: WordMassResult[], diacritics: "lax" | "strict", sortAlphabetically: boolean) {
    let resultsContainer = document.getElementById("results-container") as HTMLDivElement;
    resultsContainer.innerHTML = ''; // Clear previous results

    if (sortAlphabetically) {
        results = sortByAlphabet(results);
    } else {
        results = sortByFrequency(results);
    }

    console.log(results[0])

    results.forEach(result => {
        let resultDiv = document.createElement("div");
        resultDiv.className = "result-item";
        resultDiv.innerHTML = `<strong>${result.headword}</strong> - Count: ${result.counts.join(', ')}`;
        resultsContainer.appendChild(resultDiv);
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

    displayResults(results, diacritics, sortAlphabetically);
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