import { totalmem } from "os";
import { sectionToBookDict, bookToChapterDict, IDToBookDict, stringToStringListDict, allBookList } from "./library.js"

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

function sortByAlphabet(results: WordKJVResult[]): WordKJVResult[] {
    return [...results].sort((a, b) => {
        return a.headword.localeCompare(b.headword);
    });
}

function sortByFrequency(results: WordKJVResult[]) {
    return results.sort((a, b) => 
        b.counts.reduce((sum, val) => sum + val, 0) - 
        a.counts.reduce((sum, val) => sum + val, 0)
    );
}

async function grabMatchingVerses(addresses: string[]) {
    try {
        const queryParams = new URLSearchParams({
            addresses: addresses.join(',')
        });
        
        const response = await fetch(`/matching_verses?${queryParams}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching matching verses:', error);
        throw error;
    }
}

function processTextInBox(text: string, headword: string): string {
    if (!text) return '';
    
    const words = text.split(' ');
    const finalWords = words.map(word => {
        // Remove punctuation for comparison but keep it for display
        const punctuation = word.match(/[.,;:!?()[\]{}<>"'""''—–…·]*$/)?.[0] || '';
        const cleanWord = word.slice(0, word.length - punctuation.length).toLowerCase();
        
        if (cleanWord === headword.toLowerCase()) {
            return `<span style="color:blue">${word.slice(0, -punctuation.length)}</span>${punctuation}`;
        }
        return word;
    });
    
    return finalWords.join(' ');
}

async function displayAllResults(results: WordKJVResult[], sortAlphabetically: boolean) {
    let resultsContainer = document.getElementById("results-container") as HTMLDivElement;
    let headlineContainer = document.getElementById("headline-container") as HTMLDivElement;
    headlineContainer.style.textAlign = 'center';

    // Clear previous results
    resultsContainer.innerHTML = ''; 
    headlineContainer.innerHTML = '';

    // Sort results based on user preference
    results = sortAlphabetically ? sortByAlphabet(results) : sortByFrequency(results);

    let totalWords = results.length;
    let totalVerses = results.reduce((sum, result) => sum + result.verses.length, 0);
    let allWordTokens = results.reduce((sum, result) => 
        sum + result.counts.reduce((a, b) => a + b, 0), 0
    );

    // Create headline
    let headlineString = `<i>Found <b>${allWordTokens}</b> tokens, representing <b>${totalWords}</b> separate headwords, across <b>${totalVerses}</b> verses.</i><br><br>`;
    let headlineSpan = document.createElement('span');
    headlineSpan.innerHTML = headlineString;
    headlineSpan.style.textAlign = 'center';
    headlineSpan.style.fontSize = '1.2em';
    headlineContainer.appendChild(headlineSpan);

    // Process each result
    for (const result of results) {
        const resultDiv = await createResultDiv(result);
        resultsContainer.appendChild(resultDiv);
    }
}

async function createResultDiv(result: WordKJVResult): Promise<HTMLDivElement> {
    const div = document.createElement('div');
    div.className = 'result-item';
    
    // Create headword span
    const headwordSpan = document.createElement('span');
    const totalCount = result.counts.reduce((sum, val) => sum + val, 0);
    headwordSpan.innerHTML = `<strong>${result.headword} (${totalCount})</strong> `;
    div.appendChild(headwordSpan);

    // Create and add triangle
    const triangleSpan = document.createElement('span');
    triangleSpan.className = 'triangle';
    triangleSpan.innerHTML = '▶';
    triangleSpan.style.cursor = 'pointer';
    div.appendChild(triangleSpan);

    // Create container for verse information
    const verseContainer = document.createElement('div');
    verseContainer.style.display = 'none';

    // Handle triangle click
    triangleSpan.onclick = async () => {
        const isExpanded = triangleSpan.innerHTML === '▼';
        triangleSpan.innerHTML = isExpanded ? '▶' : '▼';
        triangleSpan.style.color = isExpanded ? '' : 'blue';
        verseContainer.style.display = isExpanded ? 'none' : 'block';

        // Only load verse content if expanding and container is empty
        if (!isExpanded && !verseContainer.hasChildNodes()) {
            const verses = await grabMatchingVerses(result.verses.map(String));
            // Process and display verses here...
            // This would be similar to the Mass implementation
        }
    };

    div.appendChild(verseContainer);
    return div;
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