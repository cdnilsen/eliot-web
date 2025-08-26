interface HebrewToken {
    input: string[];
    internal: string;
    output: string;
    isFinal?: boolean;
    isVowel?: boolean;
}

interface HebrewTrieNode {
    token: string | null;
    children: { [key: string]: HebrewTrieNode };
}

interface ParsedHebrewToken {
    kind: "consonant" | "vowel" | "unparseable";
    token?: string;
    value?: string;
    isFinal?: boolean;
}

// Hebrew consonants (including final forms)
const hebrewConsonants: HebrewToken[] = [
    // א (aleph)
    {input: ["ʾ", "'"], internal: "ʾ", output: "א"},
    
    // ב (bet)
    {input: ["b"], internal: "b", output: "ב"},
    
    // ג (gimel)
    {input: ["g"], internal: "g", output: "ג"},
    
    // ד (dalet)
    {input: ["d"], internal: "d", output: "ד"},
    
    // ה (he)
    {input: ["h"], internal: "h", output: "ה"},
    
    // ו (vav)
    {input: ["w"], internal: "w", output: "ו"},
    
    // ז (zayin)
    {input: ["z"], internal: "z", output: "ז"},
    
    // ח (chet)
    {input: ["H", "ḥ"], internal: "ḥ", output: "ח"},
    
    // ט (tet)
    {input: ["T", "ṭ"], internal: "ṭ", output: "ט"},
    
    // י (yod)
    {input: ["y"], internal: "y", output: "י"},
    
    // כ (kaf) and ך (final kaf)
    {input: ["k"], internal: "k", output: "כ"},
    {input: ["k"], internal: "k", output: "ך", isFinal: true},
    
    // ל (lamed)
    {input: ["l"], internal: "l", output: "ל"},
    
    // מ (mem) and ם (final mem)
    {input: ["m"], internal: "m", output: "מ"},
    {input: ["m"], internal: "m", output: "ם", isFinal: true},
    
    // נ (nun) and ן (final nun)
    {input: ["n"], internal: "n", output: "נ"},
    {input: ["n"], internal: "n", output: "ן", isFinal: true},
    
    // ס (samech)
    {input: ["s"], internal: "s", output: "ס"},
    
    // ע (ayin)
    {input: ["j", "ʿ", "`"], internal: "ʿ", output: "ע"},
    
    // פ (pe) and ף (final pe)
    {input: ["p", "f"], internal: "p", output: "פ"},
    {input: ["p", "f"], internal: "p", output: "ף", isFinal: true},
    
    // ץ (final tsadi)
    {input: ["ts", "tz", "ṣ", "S"], internal: "ṣ", output: "ץ", isFinal: true},
    // צ (tsadi)
    {input: ["ts", "tz", "ṣ", "S"], internal: "ṣ", output: "צ"},
    
    // ק (qof)
    {input: ["q"], internal: "q", output: "ק"},
    
    // ר (resh)
    {input: ["r"], internal: "r", output: "ר"},
    
    // ש (sin/shin)
    {input: ["c"], internal: "c", output: "ש"},

    {input: ["š", "sh"], internal: "š", output: "שׁ"},

    {input: ["C", "ś"], internal: "š", output: "שׂ"},
    
    // ת (tav)
    {input: ["t"], internal: "t", output: "ת"},
];

// Hebrew vowels (niqqud)
const hebrewVowels: HebrewToken[] = [
    // Qamatz (a)
    {input: ["A", "aa", "ā"], internal: "qamats", output: "ָ", isVowel: true},
    
    // Patach (a)
    {input: ["a"], internal: "patach", output: "ַ", isVowel: true},
    
    // Tsere (e)
    {input: ["ee", "ē"], internal: "tsere", output: "ֵ", isVowel: true},
    
    // Segol (e)
    {input: ["e"], internal: "segol", output: "ֶ", isVowel: true},
    
    // Hiriq (i)
    {input: ["i"], internal: "i", output: "ִ", isVowel: true},
    
    // Holam (o)
    {input: ["o"], internal: "o", output: "ֹ", isVowel: true},
    
    // Kamatz katan (o)
    {input: ["å"], internal: "o_short", output: "ָ", isVowel: true},
    
    // Kubuts (u)
    {input: ["u"], internal: "u", output: "ֻ", isVowel: true},
    
    // Shva (ə)
    {input: ["ə", "E", "è"], internal: "ə", output: "ְ", isVowel: true},

    // Hataf Patach (ă) - reduced 'a' sound
    {input: ["ă", "à"], internal: "hataf_patach", output: "ֲ", isVowel: true},
    
    // Hataf Segol (ĕ) - reduced 'e' sound  
    {input: ["ĕ", "è"], internal: "hataf_segol", output: "ֱ", isVowel: true},
    
    // Hataf Kamatz (ŏ) - reduced 'o' sound
    {input: ["ŏ", "ò"], internal: "hataf_kamatz", output: "ֳ", isVowel: true},
];

type S2SDict = {
    [key: string]: string;
};

// Build lookup maps
const hebrewConsonantInputToInternal: { [key: string]: string } = {};
const hebrewVowelInputToInternal: { [key: string]: string } = {};
const hebrewInternalToOutput: { [key: string]: string[] } = {};

for (const consonant of hebrewConsonants) {
    for (const inputForm of consonant.input) {
        hebrewConsonantInputToInternal[inputForm] = consonant.internal;
    }
    if (!hebrewInternalToOutput[consonant.internal]) {
        hebrewInternalToOutput[consonant.internal] = [];
    }
    hebrewInternalToOutput[consonant.internal].push(consonant.output);
}

for (const vowel of hebrewVowels) {
    for (const inputForm of vowel.input) {
        hebrewVowelInputToInternal[inputForm] = vowel.internal;
    }
    if (!hebrewInternalToOutput[vowel.internal]) {
        hebrewInternalToOutput[vowel.internal] = [];
    }
    hebrewInternalToOutput[vowel.internal].push(vowel.output);
}

// Build tries
function hebrewTrieInsert(str: string, stringCursor: number, treeCursor: HebrewTrieNode): void {
    if (stringCursor === str.length) {
        treeCursor.token = str;
        return;
    }
    const nextChar = str[stringCursor];
    if (nextChar === undefined) throw new Error("Logic error");
    if (treeCursor.children[nextChar] === undefined) {
        treeCursor.children[nextChar] = { token: null, children: {} };
    }
    hebrewTrieInsert(str, stringCursor + 1, treeCursor.children[nextChar]);
}

function constructHebrewTrie(strs: string[]): HebrewTrieNode {
    const root: HebrewTrieNode = { token: null, children: {} };
    for (const str of strs) {
        hebrewTrieInsert(str, 0, root);
    }
    return root;
}

function getNextHebrewToken(str: string, trie: HebrewTrieNode, startingIndex: number): string | null {
    let longestToken: string | null = null;
    let trieCursor = trie;
    for (let cursor = startingIndex; cursor < str.length; cursor++) {
        const c = str[cursor];
        if (c === undefined) {
            throw new Error("Logic error");
        }
        trieCursor = trieCursor.children[c];
        if (trieCursor === undefined) {
            return longestToken;
        }
        if (trieCursor.token !== null) {
            longestToken = trieCursor.token;
        }
    }
    return longestToken;
}

const hebrewConsonantTrie = constructHebrewTrie([...Object.keys(hebrewConsonantInputToInternal)]);
const hebrewVowelTrie = constructHebrewTrie([...Object.keys(hebrewVowelInputToInternal)]);

function preprocessHebrew(str: string): string {
    // Normalize common romanization variants
    str = str.toLowerCase();
    
    const alts: S2SDict = {
        "ḳ": "q",
        "ḵ": "kh",
        "ḥ": "ch",
        "ḫ": "kh",
        "ṭ": "t",
        "ṣ": "ts",
        "š": "sh",
        "ś": "s",
        "ʾ": "'",
        "ʿ": "'",
        "ā": "aa",
        "ē": "ee",
        "ī": "ii",
        "ō": "oo",
        "ū": "uu",
        "ě": "e",
        "ph": "f",
        "th": "t",
        "kh": "ch"  // Common for ח
    };

    for (const [from, to] of Object.entries(alts)) {
        str = str.replaceAll(from, to);
    }
    
    return str;
}

function maximumMunchTokenizeHebrew(str: string): ParsedHebrewToken[] {
    let strCursor = 0;
    const tokens: ParsedHebrewToken[] = [];
    
    while (strCursor < str.length) {
        // Try consonant first (usually longer matches)
        const consonantToken = getNextHebrewToken(str, hebrewConsonantTrie, strCursor);
        const vowelToken = getNextHebrewToken(str, hebrewVowelTrie, strCursor);
        
        // Choose the longer match, or consonant if equal length
        let chosenToken: string | null = null;
        let tokenType: "consonant" | "vowel" = "consonant";
        
        if (consonantToken && vowelToken) {
            if (consonantToken.length >= vowelToken.length) {
                chosenToken = consonantToken;
                tokenType = "consonant";
            } else {
                chosenToken = vowelToken;
                tokenType = "vowel";
            }
        } else if (consonantToken) {
            chosenToken = consonantToken;
            tokenType = "consonant";
        } else if (vowelToken) {
            chosenToken = vowelToken;
            tokenType = "vowel";
        }
        
        if (chosenToken === null) {
            tokens.push({ kind: "unparseable", value: str[strCursor] });
            strCursor += 1;
        } else {
            const internal = tokenType === "consonant" 
                ? hebrewConsonantInputToInternal[chosenToken]
                : hebrewVowelInputToInternal[chosenToken];
                
            if (internal === undefined) {
                throw new Error(`Logic error: ${chosenToken} is in trie but not in lookup map`);
            }
            
            tokens.push({ 
                kind: tokenType, 
                token: internal
            });
            strCursor += chosenToken.length;
        }
    }
    
    return tokens;
}

function renderHebrew(tokens: ParsedHebrewToken[], includeNiqqud: boolean, isEndOfWord?: boolean[]): string {
    let result = "";
    
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        
        if (token.kind === "unparseable") {
            result += token.value || "";
            continue;
        }
        
        const internal = token.token;
        if (!internal) continue;
        
        const outputs = hebrewInternalToOutput[internal];
        if (!outputs || outputs.length === 0) continue;
        
        if (token.kind === "consonant") {
            // Check if we should use final form
            const shouldUseFinal = isEndOfWord && isEndOfWord[i] && 
                                 ["k", "m", "n", "p", "ṣ"].includes(internal);
            
            if (shouldUseFinal && outputs.length > 1) {
                // Use final form (usually the second output)
                result += outputs[1];
            } else {
                // Use regular form (first output)
                result += outputs[0];
            }
        } else if (token.kind === "vowel" && includeNiqqud) {
            result += outputs[0];
        }
    }
    
    return result;
}

function determineWordBoundaries(tokens: ParsedHebrewToken[]): boolean[] {
    const isEndOfWord = new Array(tokens.length).fill(false);
    
    for (let i = 0; i < tokens.length; i++) {
        // Mark as end of word if:
        // 1. It's the last token
        // 2. Next token is unparseable (likely whitespace or punctuation)
        // 3. We hit a word boundary pattern
        
        if (i === tokens.length - 1) {
            isEndOfWord[i] = true;
        } else {
            const nextToken = tokens[i + 1];
            if (nextToken.kind === "unparseable" && 
                (nextToken.value === " " || nextToken.value === "\t" || 
                 nextToken.value === "\n" || /[^\w\u0590-\u05FF]/.test(nextToken.value || ""))) {
                isEndOfWord[i] = true;
            }
        }
    }
    
    return isEndOfWord;
}

export function transliterateHebrew(str: string, includeNiqqud: boolean = false): string {
    //const preprocessed = preprocessHebrew(str);
    const tokens = maximumMunchTokenizeHebrew(str);
    const wordBoundaries = determineWordBoundaries(tokens);
    return renderHebrew(tokens, includeNiqqud, wordBoundaries);
}

// Hebrew special characters for reference
export const hebrewSpecialChars: string[] = [
    "ā", "ē", "ī", "ō", "ū", "ă", "ĕ", "ŏ", "å", "ḥ", "ṭ", "ṣ", "š", "ś", "ʾ", "ʿ"
];

export function hebrewDiacriticify(str: string, isASCII: boolean): string {
    if (isASCII) {
        const ASCII2DiacriticDict: S2SDict = {
            "H": "ḥ",      // ח
            "T": "ṭ",      // ט  
            "S": "ṣ",      // צ
            "Q": "q",      // ק
            "K": "ḳ",      // alternative q
            "C": "sh",     // ש (common shorthand)
            "'": "ʾ",      // א
            "`": "ʿ",      // ע
            "A": "ā",      // long a
            "E": "ē",      // long e
            "I": "ī",      // long i  
            "O": "ō",      // long o
            "U": "ū",      // long u
        };

        for (const [ascii, diacritic] of Object.entries(ASCII2DiacriticDict)) {
            str = str.replaceAll(ascii, diacritic);
        }
    }
    return str;
}