/**
 * Generates all Unicode characters between two hexadecimal code points
 * @param startHex - The starting hex code point (e.g., "0020" or "20")
 * @param endHex - The ending hex code point (e.g., "0030" or "30")
 * @returns An array of Unicode characters within the specified range
 */
function generateUnicodeRange(startHex: string, endHex: string): string[] {
    // Convert hex strings to decimal numbers
    const start = parseInt(startHex, 16);
    const end = parseInt(endHex, 16);
    
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
      characters.push(String.fromCodePoint(codePoint));
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
    start: "0E32",
    end: "0E3F",
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



function main() {
    let regexDropdown = document.getElementById("regex-options")!

    let options: StringToUnicodeCollection = {
        "Coptic": Coptic,
        "Russian": Russian
    }

    let optionNames = ["Coptic", "Russian"];

    for (let i = 0; i < optionNames.length; i++) {
        let unicode = options[optionNames[i]];
        let option = document.createElement("option");
        option.value = optionNames[i];
        option.textContent = unicode.name;
        regexDropdown.appendChild(option);
    }


}

