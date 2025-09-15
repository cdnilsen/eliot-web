interface Token {
    input: string[];
    internal: string;
    output: string;
}

interface TrieNode {
    token: string | null;
    children: { [key: string]: TrieNode };
}

interface ParsedToken {
    kind: "token" | "unparseable";
    token?: string;
    value?: string;
}

const russianTokens: Token[] = [
    // Vowels
    {input: ["a", "а"], internal: "a", output: "а"},
    {input: ["e", "е"], internal: "e", output: "е"},
    {input: ["ё", "jo", "yo"], internal: "ё", output: "ё"},
    {input: ["i", "и"], internal: "i", output: "и"},
    {input: ["o", "о"], internal: "o", output: "о"},
    {input: ["u", "у"], internal: "u", output: "у"},
    {input: ["y", "ы"], internal: "y", output: "ы"},
    {input: ["è", "ě", "э"], internal: "è", output: "э"},
    {input: ["ju", "yu", "ю"], internal: "ju", output: "ю"},
    {input: ["ja", "ya", "я"], internal: "ja", output: "я"},

    // Consonants
    {input: ["b", "б"], internal: "b", output: "б"},
    {input: ["v", "в"], internal: "v", output: "в"},
    {input: ["g", "г"], internal: "g", output: "г"},
    {input: ["d", "д"], internal: "d", output: "д"},
    {input: ["zh", "ž", "ж"], internal: "zh", output: "ж"},
    {input: ["z", "з"], internal: "z", output: "з"},
    {input: ["j", "й"], internal: "j", output: "й"},
    {input: ["k", "к"], internal: "k", output: "к"},
    {input: ["l", "л"], internal: "l", output: "л"},
    {input: ["m", "м"], internal: "m", output: "м"},
    {input: ["n", "н"], internal: "n", output: "н"},
    {input: ["p", "п"], internal: "p", output: "п"},
    {input: ["r", "р"], internal: "r", output: "р"},
    {input: ["s", "с"], internal: "s", output: "с"},
    {input: ["t", "т"], internal: "t", output: "т"},
    {input: ["f", "ф"], internal: "f", output: "ф"},
    {input: ["kh", "x", "х"], internal: "kh", output: "х"},
    {input: ["c", "ts", "ц"], internal: "c", output: "ц"},
    {input: ["ch", "č", "ч"], internal: "ch", output: "ч"},
    {input: ["sh", "š", "ш"], internal: "sh", output: "ш"},
    {input: ["shch", "šč", "щ"], internal: "shch", output: "щ"},

    // Soft and hard signs
    {input: ["'", "ʹ", "ь"], internal: "'", output: "ь"},
    {input: ["\"", "ʺ", "ъ"], internal: "\"", output: "ъ"},

    // Palatalized consonants (optional alternative forms)
    {input: ["bj", "б'"], internal: "bj", output: "бь"},
    {input: ["vj", "в'"], internal: "vj", output: "вь"},
    {input: ["gj", "г'"], internal: "gj", output: "гь"},
    {input: ["dj", "д'"], internal: "dj", output: "дь"},
    {input: ["kj", "к'"], internal: "kj", output: "кь"},
    {input: ["lj", "л'"], internal: "lj", output: "ль"},
    {input: ["mj", "м'"], internal: "mj", output: "мь"},
    {input: ["nj", "н'"], internal: "nj", output: "нь"},
    {input: ["pj", "п'"], internal: "pj", output: "пь"},
    {input: ["rj", "р'"], internal: "rj", output: "рь"},
    {input: ["sj", "с'"], internal: "sj", output: "сь"},
    {input: ["tj", "т'"], internal: "tj", output: "ть"},
    {input: ["fj", "ф'"], internal: "fj", output: "фь"},
    {input: ["zj", "з'"], internal: "zj", output: "зь"},

    // Common digraph alternatives
    {input: ["tch"], internal: "ch", output: "ч"},
    {input: ["sch"], internal: "shch", output: "щ"},
    {input: ["ck"], internal: "k", output: "к"},
    {input: ["ph"], internal: "f", output: "ф"},
    {input: ["th"], internal: "t", output: "т"}, // English speakers might use this

    // ISO 9 and scientific transliteration variants
    {input: ["ė"], internal: "è", output: "э"},
    {input: ["ǔ"], internal: "j", output: "й"},
    {input: ["ǧ"], internal: "g", output: "г"},
    {input: ["ǰ"], internal: "zh", output: "ж"},
    {input: ["ǯ"], internal: "z", output: "з"},
    {input: ["ǹ"], internal: "n", output: "н"},
    {input: ["ṡ"], internal: "s", output: "с"},
    {input: ["ṫ"], internal: "t", output: "т"},
    {input: ["ḟ"], internal: "f", output: "ф"},
    {input: ["ẋ"], internal: "kh", output: "х"},
    {input: ["ċ"], internal: "c", output: "ц"},
    {input: ["ċ̌"], internal: "ch", output: "ч"},
    {input: ["ṡ̌"], internal: "sh", output: "ш"},
    {input: ["ṡ̌ċ̌"], internal: "shch", output: "щ"},

    // Alternative representations for iotated vowels
    {input: ["ie"], internal: "je", output: "е"}, // Sometimes used for е after consonants
    {input: ["io"], internal: "jo", output: "ё"},
    {input: ["iu"], internal: "ju", output: "ю"},
    {input: ["ia"], internal: "ja", output: "я"},

    // Common endings and patterns
    {input: ["ij"], internal: "ij", output: "ий"},
    {input: ["yj"], internal: "yj", output: "ый"},
    {input: ["oj"], internal: "oj", output: "ой"},
    {input: ["ej"], internal: "ej", output: "ей"},
    {input: ["aj"], internal: "aj", output: "ай"}
];

// Build lookup maps
const russianInputToInternal: { [key: string]: string } = {};
const russianInternalToOutput: { [key: string]: string } = {};

for (const token of russianTokens) {
    for (const inputForm of token.input) {
        russianInputToInternal[inputForm] = token.internal;
    }
    russianInternalToOutput[token.internal] = token.output;
}

// Build trie
const russianTrie = constructTrie([...Object.keys(russianInputToInternal)]);

// Trie implementation
function trieInsert(str: string, stringCursor: number, treeCursor: TrieNode): void {
    if (stringCursor === str.length) {
        treeCursor.token = str;
        return;
    }
    const nextChar = str[stringCursor];
    if (nextChar === undefined) throw new Error("Logic error");
    if (treeCursor.children[nextChar] === undefined) {
        treeCursor.children[nextChar] = { token: null, children: {} };
    }
    trieInsert(str, stringCursor + 1, treeCursor.children[nextChar]);
}

function constructTrie(strs: string[]): TrieNode {
    const root: TrieNode = { token: null, children: {} };
    for (const str of strs) {
        trieInsert(str, 0, root);
    }
    return root;
}

function getNextToken(str: string, trie: TrieNode, startingIndex: number): string | null {
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

function maximumMunchTokenizeRussian(str: string): ParsedToken[] {
    let strCursor = 0;
    const out: ParsedToken[] = [];
    while (strCursor < str.length) {
        const tokenStr = getNextToken(str, russianTrie, strCursor);
        if (tokenStr === null) {
            out.push({ kind: "unparseable", value: str[strCursor] });
            strCursor += 1;
        } else {
            const token = russianInputToInternal[tokenStr];
            if (token === undefined) {
                throw new Error(`Logic error: ${tokenStr} is in trie but is not a valid Russian token`);
            }
            out.push({ kind: "token", token: token });
            strCursor += tokenStr.length;
        }
    }
    return out;
}

function renderRussian(token: ParsedToken): string {
    if (token.kind === "unparseable") {
        return token.value || "";
    }
    
    const internal = token.token;
    if (!internal) return "";
    
    return russianInternalToOutput[internal] || "";
}

type S2SDict = {
    [key: string]: string
}

function preprocessLatin(str: string): string {
    // Handle common alternative spellings and normalize
    str = str.toLowerCase();
    
    const alts: S2SDict = {
        "w": "v",      // English speakers often use w instead of v
        "iy": "iy",    // Keep as is for now
        "ij": "ij",    // Keep as is for now
        "sh": "š", // German-style spelling
        "tsch": "ch",  // German-style spelling
        "cz": "ch",    // Polish-style spelling
        "sz": "sh",    // Polish-style spelling
        "rz": "zh",    // Polish-style spelling
        "dz": "z",     // Polish-style spelling
        "qu": "kv",    // Handle qu combinations
        "yi": "yi",    // Keep as is for now
        "ji": "yi"     // Alternative for ы
    };

    let allKeys = Object.keys(alts);
    for (let i = 0; i < allKeys.length; i++) {
        str = str.replaceAll(allKeys[i], alts[allKeys[i]]);
    }

    return str;
}

export function transliterateRussian(str: string): string {
    str = preprocessLatin(str);
    const tokens = maximumMunchTokenizeRussian(str);
    return tokens.map(token => renderRussian(token)).join("");
}

export let russianSpecialChars: string[] = ["ž", "š", "č", "ʹ", "ʺ", "ë", "è", "ě"];

export function RussianDiacriticify(str: string, isASCII: boolean): string {
    if (isASCII) {
        let ASCII2DiacriticDict: S2SDict = {
            "#": "ž",     // zh
            "$": "š",     // sh  
            "%": "č",     // ch
            "'": "ʹ",     // soft sign
            '"': "ʺ",     // hard sign
            "~": "ë",     // ё
            "`": "è",     // э
            "^": "ě",     // alternative э
            "@": "ǔ",     // alternative й
            "&": "ǧ",     // alternative г
            "*": "ǰ",     // alternative ж
            "+": "ǯ",     // alternative з
            "=": "ṡ",     // alternative с
            "|": "ṫ",     // alternative т
            "\\": "ḟ",    // alternative ф
            "/": "ẋ",     // alternative х
            "?": "ċ",     // alternative ц
            "<": "ṡ̌",    // alternative ш
            ">": "ṡ̌ċ̌"   // alternative щ
        };

        let allASCII = Object.keys(ASCII2DiacriticDict);

        for (let i = 0; i < allASCII.length; i++) {
            let c = allASCII[i];
            str = str.replaceAll(c, ASCII2DiacriticDict[c]);
        }
    }
    return str;
}

// Additional utility functions for Russian-specific features
export function handleRussianPhonemicChanges(str: string): string {
    // Handle common phonemic changes in Russian
    // This is optional and can be used for more sophisticated transliteration
    
    // Devoicing at word end (optional)
    str = str.replace(/b$/g, "p");
    str = str.replace(/d$/g, "t");
    str = str.replace(/g$/g, "k");
    str = str.replace(/z$/g, "s");
    str = str.replace(/v$/g, "f");
    str = str.replace(/zh$/g, "sh");
    
    return str;
}

export function preprocessRussianText(str: string, applyPhonemic: boolean = false): string {
    str = preprocessLatin(str);
    if (applyPhonemic) {
        str = handleRussianPhonemicChanges(str);
    }
    return str;
}