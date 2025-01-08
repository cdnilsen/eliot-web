import { totalmem } from "os";
import { sectionToBookDict, bookToChapterDict, IDToBookDict, stringToStringListDict, allBookList } from "./library.js"

type WordKJVResult = {
    headword: string;
    verses: number[];
    counts: number[];
}

async function sendWordSearch(searchString: string, searchType: string, diacritics: "lax" | "strict"): Promise<WordKJVResult[]> {
    //searchString = searchString.split('*').join('%');
    //searchString = searchString.split('(').join('');
    //searchString = searchString.split(')').join('?');
    
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
