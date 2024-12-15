import { sectionToBookDict, bookToChapterDict } from "./library.js"

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


type Highlighting = "none" | "ignoreCasing" | "includeCasing" | "proofreading"
type Hapax = "none" | "strict" | "lax"

type EditionState = {
    editions: number,
    highlighting: Highlighting,
    hapaxes: Hapax,
    book: string,
    chapter: number
}

function refreshSectionDropdown() {
    let valuesList = ["pentateuch", "history", "wisdom", "major_prophets", "minor-prophets", "gospels_acts", "other_nt", "mishnaic"]
    let labelsList = ["Pentateuch", "Historical Books", "Wisdom/Poetry Books", "Major Prophets", "Minor Prophets", "Gospels/Acts", "Rest of New Testament", '"Mishnaic" publications']

    let sectionDropdown = <HTMLSelectElement>document.getElementById("sectionDropdown");

    sectionDropdown.innerHTML = "";
    for (let i=0; i < valuesList.length; i++) {
        let option = document.createElement("option");
        option.value = valuesList[i];
        option.innerHTML = labelsList[i];
        sectionDropdown.appendChild(option);

        if (valuesList[i] == "mishnaic") {
            option.hidden = true;
        }
    }

}


//This has a bug where I have the gospels as options in the Pentateuch. Fix at some point?
function sectionListener(state: EditionState) {
    let sectionDropdown = <HTMLSelectElement>document.getElementById("sectionDropdown");
    let bookDropdown = <HTMLSelectElement>document.getElementById("bookDropdown");
    let chapterDropdown = <HTMLSelectElement>document.getElementById("chapterSelectionDropdown");
    
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

        let numChapters = bookToChapterDict[state.book];
        chapterDropdown.innerHTML = "";
        for (let i=1; i < numChapters + 1; i++) {
            let option = document.createElement("option");
            option.value = i.toString();
            option.innerHTML = i.toString();
            chapterDropdown.appendChild(option);
        }
        refreshSectionDropdown();
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
    });

    chapterDropdown.addEventListener("change", function() {
        let chapter = parseInt(chapterDropdown.value);
        state.chapter = chapter;
    });
}

function editionNumberListener(docID: string, p: number, state: EditionState) {
    let checkbox = <HTMLInputElement>document.getElementById(docID);

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

async function fetchChapter(state: EditionState) {
    try {
        let editionNumber = state.editions;
        let book = state.book;
        let chapter = state.chapter;

        const editionsToFetch: string[] = [];
        if (editionNumber % 2 === 0) editionsToFetch.push('first_edition');
        if (editionNumber % 3 === 0) editionsToFetch.push('second_edition');
        if (editionNumber % 5 === 0) editionsToFetch.push('mayhew');
        if (editionNumber % 7 === 0) editionsToFetch.push('zeroth_edition');
        if (editionNumber % 11 === 0) editionsToFetch.push('grebrew');


        // Convert editions array to comma-separated string for query parameter
        const editionsParam = editionsToFetch.join(',');
        const response = await fetch(`/chapter/${book}/${chapter}?editions=${editionsParam}`);
        const verses = await response.json();
        
        // Get the element where you want to display the text
        const displayDiv = document.getElementById('textColumns');
        if (!displayDiv) return;
        
        // Clear previous content
        displayDiv.innerHTML = '';
        
        // Display each verse
        verses.forEach(verse => {
            const verseDiv = document.createElement('div');
            editionsToFetch.forEach(edition => {
                if (verse[edition]) {
                    verseDiv.innerHTML += `<p>${edition}: ${verse[edition]}</p>`;
                }
            });
            displayDiv.appendChild(verseDiv);
        });
        
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
        book: "",
        chapter: 1
    };

    let editionListenerIDs = ["useFirstEdition", "useSecondEdition", "useMayhew", "useZerothEdition", "useGrebrew"]
    let primesList = [2, 3, 5, 7, 11]

    for (let i=0; i < primesList.length; i++) { 
        editionNumberListener(editionListenerIDs[i], primesList[i], editionState);
    }

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
}

main();