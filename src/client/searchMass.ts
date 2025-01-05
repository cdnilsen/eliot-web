import { sectionToBookDict, bookToChapterDict } from "./library.js"

type WordMassResult = {
    headword: string;
    verses: number[];
    counts: number[];
    editions: number;
}

async function wordSearch(searchString: string, searchSetting: number): Promise<WordMassResult[]> {
    searchString = searchString.split('*').join('%');
    searchString = searchString.split('(').join('');
    searchString = searchString.split(')').join('?');
    
    let searchType: string;
    if (searchSetting % 2 === 0) {
        searchType = 'exact';
    } else if (searchSetting % 3 === 0) {
        searchType = 'contains';
    } else if (searchSetting % 5 === 0) {
        searchType = 'starts';
    } else if (searchSetting % 7 === 0) {
        searchType = 'ends';
    } else {
        searchType = 'contains';  // default
    }

    console.log('searchSetting:', searchSetting);
    console.log('searchType:', searchType);
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

let submitButton = document.getElementById("submitButton");

submitButton?.addEventListener("click", async () => {
    let searchInput = document.getElementById("search_bar") as HTMLInputElement;
    let searchInputValue = searchInput.value;
    let searchDropdown = document.getElementById("searchWordDropdown") as HTMLSelectElement;
    let searchType = searchDropdown.value;
    let laxDiacritics = document.getElementById("diacriticsLax") as HTMLInputElement;
    
    // Set diacritics mode based on radio button
    const diacritics = laxDiacritics?.checked ? 'lax' : 'strict';

    const results = await wordSearch(searchInputValue, searchType, diacritics);
    console.log('Search results:', results);
});