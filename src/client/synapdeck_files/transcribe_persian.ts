// ─────────────────────────────────────────────
//  Persian (Farsi) transliterator
//  Trie-based maximum-munch, following the same
//  architecture as the Hebrew / Syriac files.
// ─────────────────────────────────────────────

interface PersianToken {
    input: string[];
    output: string;
    isVowel?: boolean;
}

interface PersianTrieNode {
    token: string | null;
    children: { [key: string]: PersianTrieNode };
}

interface ParsedPersianToken {
    kind: "consonant" | "vowel" | "unparseable";
    output?: string;    // Unicode output character(s)
    value?:  string;    // raw text for unparseable tokens
}

// ── Combining vowel marks ──────────────────────────────────────────────────
const FATHA  = "\u064E";    // ◌َ  short a  (zabar / fatha)
const KASRA  = "\u0650";    // ◌ِ  short e  (zir / kasra)
const DAMMA  = "\u064F";    // ◌ُ  short o  (piš / damma)
const SHADDA = "\u0651";    // ◌ّ  tashdid (consonant doubling)

const ALEF        = "\u0627";   // ا  alef
const ALEF_MADDAH = "\u0622";   // آ  alef with maddah (word-initial long ā)

// ── Consonant table ────────────────────────────────────────────────────────
//
//  Digraphs (sh, ch, kh, gh, zh, th, dh) always beat bare single letters
//  via maximum-munch.
//
const persianConsonants: PersianToken[] = [
    // ء  Hamzeh  (glottal stop)
    { input: ["ʾ", "'"], output: "\u0621" },

    // ب  Ba
    { input: ["b"],       output: "\u0628" },

    // پ  Pe  (Persian)
    { input: ["p"],       output: "\u067E" },

    // ت  Te
    { input: ["t"],       output: "\u062A" },

    // ث  Se  (= /s/ in modern Persian)
    { input: ["ṯ", "th"], output: "\u062B" },

    // ج  Jim
    { input: ["j"],       output: "\u062C" },

    // چ  Che  (Persian; = /tʃ/)
    { input: ["č", "ch"], output: "\u0686" },

    // ح  He-ye jimi  (= /h/ in Persian)
    { input: ["ḥ", "H"],  output: "\u062D" },

    // خ  Khe  (= /x/)
    { input: ["x", "kh"], output: "\u062E" },

    // د  Dal
    { input: ["d"],       output: "\u062F" },

    // ذ  Zal  (= /z/ in modern Persian)
    { input: ["ẕ", "dh"], output: "\u0630" },

    // ر  Re
    { input: ["r"],       output: "\u0631" },

    // ز  Ze
    { input: ["z"],       output: "\u0632" },

    // ژ  Zhe  (Persian; = /ʒ/)
    { input: ["ž", "zh"], output: "\u0698" },

    // س  Sin
    { input: ["s"],       output: "\u0633" },

    // ش  Shin
    { input: ["š", "sh"], output: "\u0634" },

    // ص  Sad  (= /s/ in Persian)
    { input: ["ṣ", "S"],  output: "\u0635" },

    // ض  Zad  (= /z/ in Persian)
    { input: ["ḍ", "D"],  output: "\u0636" },

    // ط  Ta  (= /t/ in Persian)
    { input: ["ṭ", "T"],  output: "\u0637" },

    // ظ  Za  (= /z/ in Persian)
    { input: ["ẓ", "Z"],  output: "\u0638" },

    // ع  Ain
    { input: ["ʿ", "`"],  output: "\u0639" },

    // غ  Ghain
    { input: ["ġ", "gh"], output: "\u063A" },

    // ف  Fe
    { input: ["f"],       output: "\u0641" },

    // ق  Qaf
    { input: ["q"],       output: "\u0642" },

    // ک  Kaf  (Persian form U+06A9)
    { input: ["k"],       output: "\u06A9" },

    // گ  Gaf  (Persian)
    { input: ["g"],       output: "\u06AF" },

    // ل  Lam
    { input: ["l"],       output: "\u0644" },

    // م  Mim
    { input: ["m"],       output: "\u0645" },

    // ن  Nun
    { input: ["n"],       output: "\u0646" },

    // و  Vav  (consonantal; long ū handled as a vowel)
    { input: ["v", "w"],  output: "\u0648" },

    // ه  He
    { input: ["h"],       output: "\u0647" },

    // ی  Ye  (consonantal; long ī handled as a vowel)
    { input: ["y"],       output: "\u06CC" },
];

// ── Vowel table ────────────────────────────────────────────────────────────
const persianVowels: PersianToken[] = [
    // Short vowels → combining diacritics (attach visually to the preceding consonant)
    { input: ["a"], output: FATHA,  isVowel: true },    // short a  ◌َ
    { input: ["e"], output: KASRA,  isVowel: true },    // short e  ◌ِ
    { input: ["o"], output: DAMMA,  isVowel: true },    // short o  ◌ُ

    // Long vowels → matres lectionis
    // ā / â → ا alef  (or آ alef-maddah when word-initial; resolved in renderer)
    { input: ["ā", "â"], output: ALEF,     isVowel: true },
    // ī → ی ye
    { input: ["ī"],      output: "\u06CC", isVowel: true },
    // ū → و vav
    { input: ["ū"],      output: "\u0648", isVowel: true },

    // Tashdid / shadda  (consonant doubling mark)
    { input: ["~"],      output: SHADDA,   isVowel: true },
];

// ── Lookup maps ────────────────────────────────────────────────────────────
const consonantInputToOutput: { [key: string]: string } = {};
const vowelInputToOutput:     { [key: string]: string } = {};

for (const c of persianConsonants) {
    for (const inp of c.input) consonantInputToOutput[inp] = c.output;
}
for (const v of persianVowels) {
    for (const inp of v.input) vowelInputToOutput[inp] = v.output;
}

// ── Trie ───────────────────────────────────────────────────────────────────
function persianTrieInsert(str: string, cursor: number, node: PersianTrieNode): void {
    if (cursor === str.length) { node.token = str; return; }
    const c = str[cursor];
    if (c === undefined) throw new Error("Logic error");
    if (!node.children[c]) node.children[c] = { token: null, children: {} };
    persianTrieInsert(str, cursor + 1, node.children[c]);
}

function buildPersianTrie(strs: string[]): PersianTrieNode {
    const root: PersianTrieNode = { token: null, children: {} };
    for (const s of strs) persianTrieInsert(s, 0, root);
    return root;
}

function getNextPersianToken(str: string, trie: PersianTrieNode, start: number): string | null {
    let longest: string | null = null;
    let node: PersianTrieNode | undefined = trie;
    for (let i = start; i < str.length; i++) {
        const c = str[i];
        if (c === undefined) throw new Error("Logic error");
        node = node.children[c];
        if (node === undefined) return longest;
        if (node.token !== null) longest = node.token;
    }
    return longest;
}

const persianConsonantTrie = buildPersianTrie(Object.keys(consonantInputToOutput));
const persianVowelTrie     = buildPersianTrie(Object.keys(vowelInputToOutput));

// ── Tokeniser ──────────────────────────────────────────────────────────────
function tokenizePersian(str: string): ParsedPersianToken[] {
    let cursor = 0;
    const tokens: ParsedPersianToken[] = [];

    while (cursor < str.length) {
        const conMatch = getNextPersianToken(str, persianConsonantTrie, cursor);
        const vowMatch = getNextPersianToken(str, persianVowelTrie,     cursor);

        let chosen: string | null = null;
        let kind: "consonant" | "vowel" = "consonant";

        if (conMatch && vowMatch) {
            // Prefer the longer match; consonant wins on a tie.
            if (conMatch.length >= vowMatch.length) {
                chosen = conMatch; kind = "consonant";
            } else {
                chosen = vowMatch; kind = "vowel";
            }
        } else if (conMatch) {
            chosen = conMatch; kind = "consonant";
        } else if (vowMatch) {
            chosen = vowMatch; kind = "vowel";
        }

        if (chosen === null) {
            tokens.push({ kind: "unparseable", value: str[cursor] });
            cursor++;
        } else {
            const output = kind === "consonant"
                ? consonantInputToOutput[chosen]
                : vowelInputToOutput[chosen];
            if (output === undefined) {
                throw new Error(`Logic error: "${chosen}" in trie but not in lookup map`);
            }
            tokens.push({ kind, output });
            cursor += chosen.length;
        }
    }

    return tokens;
}

// ── Renderer ───────────────────────────────────────────────────────────────
const COMBINING_MARKS = new Set([FATHA, KASRA, DAMMA, SHADDA]);

function renderPersian(tokens: ParsedPersianToken[]): string {
    let result = "";
    // Track whether the last rendered base character was an Arabic/Persian
    // letter (not a combining mark or whitespace).  Used to decide whether
    // a long ā should become آ (word-initial) instead of ا (post-consonantal).
    let lastWasLetter = false;

    for (const token of tokens) {
        if (token.kind === "unparseable") {
            result += token.value ?? "";
            lastWasLetter = false;
            continue;
        }

        const raw = token.output ?? "";

        if (token.kind === "consonant") {
            result += raw;
            lastWasLetter = true;
        } else {
            // Vowel: use آ for word-initial long ā, ا otherwise.
            if (raw === ALEF && !lastWasLetter) {
                result += ALEF_MADDAH;
            } else {
                result += raw;
            }
            // Combining marks don't change the letter-tracking state;
            // mater lectionis letters (ا ی و) do.
            if (!COMBINING_MARKS.has(raw)) {
                lastWasLetter = true;
            }
        }
    }

    return result;
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Transliterate a romanised Persian string into Persian/Arabic Unicode script.
 *
 * Consonant mapping:
 *   '/ʾ → ء    b → ب    p → پ    t → ت    th/ṯ → ث
 *   j → ج    ch/č → چ    H/ḥ → ح    kh/x → خ
 *   d → د    dh/ẕ → ذ    r → ر    z → ز    zh/ž → ژ
 *   s → س    sh/š → ش    S/ṣ → ص    D/ḍ → ض
 *   T/ṭ → ط    Z/ẓ → ظ    `/ʿ → ع    gh/ġ → غ
 *   f → ف    q → ق    k → ک    g → گ
 *   l → ل    m → م    n → ن    v/w → و    h → ه    y → ی
 *
 * Vowel mapping:
 *   a  → ◌َ  fatha   (short a; diacritic on preceding consonant)
 *   e  → ◌ِ  kasra   (short e; diacritic on preceding consonant)
 *   o  → ◌ُ  damma   (short o; diacritic on preceding consonant)
 *   ā / â → ا  alef (long a; آ when word-initial)
 *   ī  → ی  ye      (long i)
 *   ū  → و  vav     (long u)
 *   ~  → ◌ّ  shadda  (consonant doubling / tashdid)
 */
export function transliteratePersian(str: string): string {
    return renderPersian(tokenizePersian(str));
}

/**
 * Convert ASCII shorthand characters to the diacritics expected by
 * transliteratePersian().  Apply this before calling transliteratePersian()
 * when the user is typing in plain ASCII.
 *
 *   A → ā   (long a)
 *   I → ī   (long i)
 *   U → ū   (long u)
 *   ' → ʾ   (hamzeh)
 *   ` → ʿ   (ain)
 */
export function persianDiacriticify(str: string): string {
    const map: { [k: string]: string } = {
        "A": "ā",
        "I": "ī",
        "U": "ū",
        "'": "ʾ",
        "`": "ʿ",
    };
    for (const [ascii, diacritic] of Object.entries(map)) {
        str = str.replaceAll(ascii, diacritic);
    }
    return str;
}

/** Special input characters used by the Persian transliterator. */
export const persianSpecialChars: string[] = [
    "ā", "â", "ī", "ū",
    "ʾ", "ʿ",
    "ḥ", "ṯ", "ẕ", "ṣ", "ḍ", "ṭ", "ẓ", "ġ",
    "č", "š", "ž",
    "~",
];
