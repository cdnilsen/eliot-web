/**
 * Generates all Unicode characters between two hexadecimal code points
 * @param startHex - The starting hex code point (e.g., "0020" or "20")
 * @param endHex - The ending hex code point (e.g., "0030" or "30")
 * @returns An array of Unicode characters within the specified range
 */
function generateUnicodeRange(startHex: string, endHex: string, exceptions: string[]): string[] {
    // Convert hex strings to decimal numbers
    const start = parseInt(startHex, 16);
    const end = parseInt(endHex, 16);


    let exceptionsAsNums: number[] = [];
    for (let i=0; i < exceptions.length; i++) {
        let hex = parseInt(exceptions[i], 16);
        exceptionsAsNums.push(hex);
    }
    
    // Validate input
    if (isNaN(start) || isNaN(end)) {
      throw new Error("Invalid hexadecimal input");
    }
    
    if (start > end) {
      throw new Error("Start code point must be less than or equal to end code point");
    }
    
    if (start < 0 || end > 0x10FFFF) {
      throw new Error("Code points must be between 0x0000 and 0x10FFFF");
    }
    
    // Generate characters
    const characters: string[] = [];
    
    for (let codePoint = start; codePoint <= end; codePoint++) {
        if (exceptionsAsNums.includes(codePoint)) {
            continue;
        } else {
            characters.push(String.fromCodePoint(codePoint));
        }
    }
    
    return characters;
}
  
type UnicodeBlock = {
    start: string,
    end: string,
    exceptions: string[],
    additions: string[]
}

type UnicodeCharCollection = {
    name: string,
    blocks: UnicodeBlock[]
}

let CopticBlock1: UnicodeBlock = {
    start: "03E2",
    end: "03EF",
    exceptions: [],
    additions: []
}

let CopticBlock2: UnicodeBlock = {
    start: "2C80",
    end: "2CB1",
    exceptions: [],
    additions: []
}

let Coptic: UnicodeCharCollection = {
    name: "Coptic",
    blocks: [CopticBlock1, CopticBlock2]
}

let RussianBlock: UnicodeBlock = {
    start: "0401",
    end: "0451",
    exceptions: ["0450"],
    additions: []
}

let Russian: UnicodeCharCollection = {
    name: "Russian",
    blocks: [RussianBlock]
}

type StringToUnicodeCollection = {
    [key: string]: UnicodeCharCollection
}

type State = {
    language: UnicodeCharCollection,
    topExample: InputBlock
}


type InputBlock = {
    container: HTMLSpanElement,
    inputBox: HTMLInputElement,
    outputSpan: HTMLSpanElement
}

function createInputBlock(target: string, isColumn: boolean = true): InputBlock {
    let container = document.createElement("div");
    if (isColumn) {
        container.classList.add('column');
    } else {
        container.style.paddingBottom = "10px";
        container.style.textAlign = "center";
    }

    let inputBox = document.createElement("input");
    inputBox.type = "text";
    if (isColumn) {
        inputBox.style.width = "20px";
    }
    inputBox.placeholder = "";

    let arrowSpan = document.createElement("span");
    arrowSpan.textContent = "→";

    let foreignTextSpan = document.createElement("span");
    foreignTextSpan.textContent = target;

    container.appendChild(inputBox);
    container.appendChild(arrowSpan);
    container.appendChild(foreignTextSpan);

    let object: InputBlock = {
        container: container,
        inputBox: inputBox,
        outputSpan: foreignTextSpan
        
    }

    return object;
}


function getAllUnicodeChars(language: UnicodeCharCollection) {
    let blocks = language.blocks;
    let allChars: string[] = []

    for (let i=0; i < blocks.length; i++) {
        let block = blocks[i];
        let thisBlockChars = generateUnicodeRange(block.start, block.end, block.exceptions);
        for (let j=0; j < block.additions.length; j++) {
            let additionalChar = block.additions[j];
            let codePointNum = parseInt(additionalChar, 16);
            thisBlockChars.push(String.fromCodePoint(codePointNum));
        }

        for (let k=0; k < thisBlockChars.length; k++) {
            allChars.push(thisBlockChars[k])
        }
    }

    return allChars; 
}

function generateRegexBoxes(state: State): InputBlock[] {
    let language = state.language;

    let allTargetChars = getAllUnicodeChars(language);


    let outputList: InputBlock[] = []
    for (let i=0; i < allTargetChars.length; i++) {
        let char = allTargetChars[i];
        let inputBlock = createInputBlock(char);
        outputList.push(inputBlock);
    }

    return outputList;
}

function main() {
    let regexDropdown = document.getElementById("regex-options")!

    let dummyInputBlock = createInputBlock("");

    let state: State = {
        language: Coptic,
        topExample: dummyInputBlock
    }

    let options: StringToUnicodeCollection = {
        "Coptic": Coptic,
        "Russian": Russian
    }

    let optionNames = ["Coptic", "Russian"];

    for (let i = 0; i < optionNames.length; i++) {
        let unicode = options[optionNames[i]];
        let option = document.createElement("option");
        option.value = optionNames[i];
        option.label = unicode.name;
        option.textContent = unicode.name;
        regexDropdown.appendChild(option);
    }

    let submitButton = document.getElementById("submit-button")!;

    submitButton.addEventListener("click", () => {
        let selectedOption = (regexDropdown as HTMLSelectElement).value;
        state.language = options[selectedOption];
        //console.log(`Selected language: ${state.language.name}`);

        let exampleOutput = createInputBlock("", false);
        state.topExample = exampleOutput;
        let outputDiv = document.getElementById("regex-output")!;
        outputDiv.innerHTML = ""; // Clear previous content
        outputDiv.appendChild(exampleOutput.container);

        let allRegexBoxes = generateRegexBoxes(state);

        for (let i=0; i < allRegexBoxes.length; i++) {
            let thisRegexBox = allRegexBoxes[i];
            outputDiv.appendChild(thisRegexBox.container);
        }
    });


}

main();

