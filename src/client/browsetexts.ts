import { sectionToBookDict, bookToChapterDict } from "./library.js"

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
    let chapterSelection = document.getElementById("chapterDropdown");
    chapterSelection!.innerHTML = "";
    for (let i=1; i < numChapters + 1; i++) {
        let chapterOption = createOption(i.toString(), i.toString());
        chapterSelection!.appendChild(chapterOption);
    }
}


function grabBookList(section: string) {
    let bookSelection = document.getElementById("bookDropdown");
    bookSelection!.innerHTML = ""
    bookSelection!.hidden = false;
    bookSelection!.style.visibility = "visible";

    let bookList: string[] = sectionToBookDict[section];
    let blankOption = createOption("", "");
    bookSelection!.appendChild(blankOption);
    for (let i=0; i < bookList.length; i++) {
        let thisOption = createOption(bookList[i], bookList[i]);
        bookSelection!.appendChild(thisOption);
    }

    bookSelection!.addEventListener("change", function() {
        addChapterSelection(bookSelection!.innerHTML);
    })
}

document.getElementById("sectionDropdown")!.addEventListener("change", function () {
    let selectedSection = (<HTMLSelectElement>document.getElementById("sectionDropdown")).value;
    grabBookList(selectedSection);
})