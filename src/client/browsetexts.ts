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

function createOption(name: string, value: string) {
    let option = document.createElement("option");
    option.value = value;
    option.innerHTML = name;
    return option
}


function addChapterSelection(book: string) {
    let numChapters: number = bookToChapterDict[book];
    let chapterSelection = document.getElementById("chapterSelectionDropdown");
    chapterSelection!.innerHTML = "";
    for (let i=1; i < numChapters + 1; i++) {
        let chapterOption = createOption(i.toString(), i.toString());
        chapterSelection!.appendChild(chapterOption);
    }
}


function grabBookList(sectionDropdown: HTMLSelectElement, section: string, book: string, chapter: string) {
    let bookSelection = <HTMLSelectElement>document.getElementById("bookDropdown");
    sectionDropdown!.innerHTML = ""
    sectionDropdown!.hidden = false;
    sectionDropdown!.style.visibility = "visible";

    let bookList: string[] = sectionToBookDict[section];

    //get rid of the blank option here later, somehow, as it causes console-side bugs
    let blankOption = createOption("", "");
    sectionDropdown!.appendChild(blankOption);
    for (let i=0; i < bookList.length; i++) {
        let thisOption = createOption(bookList[i], bookList[i]);
        sectionDropdown!.appendChild(thisOption);
    }

    sectionDropdown!.addEventListener("change", function() {
        addChapterSelection(bookSelection!.value);
    })
}



type Highlighting = "none" | "ignoreCasing" | "includeCasing" | "proofreading"
type Hapax = "none" | "strict" | "lax"


function main() {
    let section: string = ""
    let book: string = ""
    let chapter: string = ""
    let highlighting: Highlighting = "none"
    let hapaxes: Hapax = "none"
    let sectionDropdown = <HTMLSelectElement>document.getElementById("sectionDropdown");
    let bookDropdown = <HTMLSelectElement>document.getElementById("bookDropdown");
    let chapterDropdown = <HTMLSelectElement>document.getElementById("chapterSelectionDropdown");

    sectionDropdown!.addEventListener("change", function () {
        section = sectionDropdown.value;
        bookDropdown!.innerHTML = "";
        chapterDropdown!.innerHTML = "";
        grabBookList(section, book, chapter);
    })
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

function editionNumberListener(docID: string, p: number, state: EditionState) {
    let checkbox = <HTMLInputElement>document.getElementById(docID);

    if (checkbox.checked) {
        state.editions = state.editions * p;
        console.log(docID);
    }

    //this doesn't work for the radio buttons...
    checkbox.addEventListener("change", function() {
        if (checkbox.checked) {
            state.editions = state.editions * p;
        } else {
            state.editions = state.editions / p;
        }
        console.log(state.editions);
    });
}

function highlightingListener(docID: string, setting: Highlighting, state: EditionState) {
    let button = <HTMLInputElement>document.getElementById(docID);
    if (button.checked) {
        state.highlighting = setting;
    }
}

function hapaxListener(docID: string, setting: Hapax, state: EditionState) {
    let button = <HTMLInputElement>document.getElementById(docID);
    if (button.checked) {
        state.hapaxes = setting;
    }
}

function main() {
    let section: string = "";
    let book: string = "";
    let chapter: string = "";

    let highlighting: Highlighting = "none"
    let hapaxes: Hapax = "none"

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

    console.log(editionState);
}

main();