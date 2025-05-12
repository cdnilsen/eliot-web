
type ExampleVerse = {
    "zeroth": string,
    "first": string,
    "second": string,
    "mayhew": string,
    "kjv": string,
    "grebrew": string,
    "grebrewType": "greek" | "hebrew"
}

type S2NDict = {
    [key: string]: number
}

type S2SDict = {
    [key: string]: string
}

type S2BDict = {
    [key: string]: boolean
}

type columnPosition = "leftmost" | "rightmost" | "middle"

function createExampleVerseHeaderCell(headerText: string, position: columnPosition, width: number): HTMLTableCellElement {
    let cell: HTMLTableCellElement = document.createElement("th");
    cell.style.textAlign = "center";
    cell.style.width = width.toString() + "px";
    cell.style.textDecoration = "underline";
    cell.style.paddingLeft = "10px";
    cell.style.paddingRight = "10px";
    cell.style.borderLeft = "2px solid red";
    if (position == "leftmost") { 
        cell.style.borderLeft = "2px solid black";
    }
    if (position == "rightmost") { 
        cell.style.borderRight = "2 px solid black";
    }
    cell.style.borderTop = "2px solid black";

    cell.textContent = headerText;

    return cell;
}

function createExampleVerseTextCell(headerText: string, position: columnPosition, width: number, isHebrew: boolean): HTMLTableCellElement {
    let cell: HTMLTableCellElement = document.createElement("td");
    cell.style.textAlign = "left";
    if (isHebrew) {
        cell.style.textAlign = "right"
    }
    cell.style.width = width.toString() + "px";
    cell.style.verticalAlign = "top";
    cell.style.paddingLeft = "10px";
    cell.style.paddingRight = "10px";
    cell.style.borderLeft = "2px solid rgba(255, 0, 0, 0.4)";
    if (position == "leftmost") { 
        cell.style.borderLeft = "2px solid black";
    }
    if (position == "rightmost") { 
        cell.style.borderRight = "2 px solid black";
    }
    cell.style.borderBottom = "2px solid black";

    cell.textContent = headerText;

    return cell;
}

function renderExampleVerseTable(text: ExampleVerse, widths: number[]) {
    let topTable: HTMLTableElement = document.createElement("table");
    topTable.style.paddingLeft = "100px";
    topTable.style.paddingRight = "100px";

    
    let headerTextDict: S2SDict = {
        "zeroth": "Zeroth Edition (א)",
        "first": "First Edition (α)",
        "second": "Second Edition (β)",
        "mayhew": "Mayhew (M)",
        "kjv": "KJV",
        "grebrew": "Hebrew"
    }
    if (text["grebrewType"] == "greek") {
        headerTextDict["grebrew"] = "Greek"
    }
    let allHeaderNames: string[] = ["zeroth", "first", "second", "mayhew", "kjv", "grebrew"];

    let columnExistenceDict: S2BDict = {}

    let leftmostColumn: string = ""
    let rightmostColumn: string = ""
    for (let i=0; i < allHeaderNames.length; i++) {
        let headerName = allHeaderNames[i];
        columnExistenceDict[headerName] = (text[headerName].length > 0)
        if (text[headerName].length > 0 && leftmostColumn == "") {
            leftmostColumn = headerName;
        }
        rightmostColumn = headerName;
    }

    let titleRow: HTMLTableRowElement = document.createElement('tr');
    for (let i=0; i < allHeaderNames.length; i++) {
        let headerName = allHeaderNames[i];
        let headerText = text[headerName];
        let position: columnPosition = "middle";
        if (headerName == leftmostColumn) {
            position = "leftmost";
        }
        if (headerName == rightmostColumn) { 
            position = "rightmost"
        }
        let cell = createExampleVerseHeaderCell(headerText, position, widths[i]);

        titleRow.appendChild(cell); 
    }

    let textRow: HTMLTableRowElement = document.createElement('tr');
    for (let i=0; i < allHeaderNames.length; i++) {
        let headerName = allHeaderNames[i];
        let headerText = text[headerName];
        let position: columnPosition = "middle";
        if (headerName == leftmostColumn) {
            position = "leftmost";
        }
        if (headerName == rightmostColumn) { 
            position = "rightmost"
        }
        let cell = createExampleVerseTextCell(headerText, position, widths[i], (headerTextDict[headerName] == "hebrew"));

        textRow.appendChild(cell); 
    }

    return topTable;
}
