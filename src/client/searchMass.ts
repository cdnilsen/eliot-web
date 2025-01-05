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
    let searchSetting = 1;
    let searchInput = document.getElementById("search_bar") as HTMLInputElement;
    let searchInputValue = searchInput.value;
    let isExactly = document.getElementById("isExactly") as HTMLInputElement;
    let contains = document.getElementById("contains") as HTMLInputElement;
    let startsWith = document.getElementById("beginsWith") as HTMLInputElement;
    let endsWith = document.getElementById("endsWith") as HTMLInputElement;
    let laxDiacritics = document.getElementById("diacriticsLax") as HTMLInputElement;

    if (isExactly?.checked) {
        searchSetting *= 2;
    }
    if (contains?.checked) {
        searchSetting *= 3;
    }
    if (startsWith?.checked) {
        searchSetting *= 5;
    }
    if (endsWith?.checked) {
        searchSetting *= 7;
    }
    if (laxDiacritics?.checked) {
        searchSetting *= 17;
    }


    const results = await wordSearch(searchInputValue, searchSetting);
    console.log('Search results:', results);

})