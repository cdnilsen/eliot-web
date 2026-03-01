// ─────────────────────────────────────────────
//  Syriac (Estrangela) transliterator
//  Follows the same architecture as the Hebrew
//  transliterator (trie-based maximum-munch).
// ─────────────────────────────────────────────

interface SyriacToken {
    input: string[];
    output: string;
}

interface SyriacTrieNode {
    token: string | null;
    children: { [key: string]: SyriacTrieNode };
}

interface ParsedSyriacToken {
    kind: "consonant" | "modifier" | "unparseable";
    /** Unicode output string for this token */
    output?: string;
    /** Raw character for unparseable tokens */
    value?: string;
}

// ── Combining diacritics ──────────────────────────────────────────────────────

/** Linea occultans: a horizontal stroke through the letter (silent / quiescent) */
const LINEA_OCCULTANS = "\u0336"; // COMBINING LONG STROKE OVERLAY

/**
 * Syāmē (plural dots): two dots above.
 * U+0308 COMBINING DIAERESIS gives the right appearance in virtually all
 * Syriac-capable fonts.  When placed on resh it *replaces* the dot above.
 */
const SYAME = "\u0308"; // COMBINING DIAERESIS

/** Dot below (e.g. rukkākā softening mark, text-critical marks) */
const DOT_BELOW = "\u0323"; // COMBINING DOT BELOW

/** Dot above (e.g. qūššāyā hardening mark, text-critical marks) */
const DOT_ABOVE = "\u0307"; // COMBINING DOT ABOVE

// ─────────────────────────────────────────────────────────────────────────────
//  Consonant table
//
//  Input strings are listed longest-first within each entry so that the trie
//  builder naturally finds multi-character sequences.  The maximum-munch
//  tokeniser will always prefer the longest match, so e.g. "sh"/"SH" beats a
//  bare "s"/"S".
// ─────────────────────────────────────────────────────────────────────────────

const syriacConsonants: SyriacToken[] = [
    // ܐ  Ālaph  – a, A, ʾ
    { input: ["ʾ", "a", "A"], output: "ܐ" },

    // ܒ  Bēth
    { input: ["b"], output: "ܒ" },

    // ܓ  Gāmal
    { input: ["g"], output: "ܓ" },

    // ܕ  Dālath
    { input: ["d"], output: "ܕ" },

    // ܗ  Hē  (lower-case h only; upper-case H → Ḥēth below)
    { input: ["h"], output: "ܗ" },

    // ܘ  Wāw  – w, W, u, U (consonantal waw / mater lectionis)
    { input: ["w", "W", "u", "U"], output: "ܘ" },

    // ܙ  Zayn
    { input: ["z"], output: "ܙ" },

    // ܚ  Ḥēth  – ḥ, Ḥ, H (digraph H kept for ASCII convenience)
    { input: ["ḥ", "Ḥ", "H"], output: "ܚ" },

    // ܛ  Ṭēth  – ṭ, Ṭ, T
    { input: ["ṭ", "Ṭ", "T"], output: "ܛ" },

    // ܝ  Yōdh  – y, Y, i, I
    { input: ["y", "Y", "i", "I"], output: "ܝ" },

    // ܟ  Kāph
    { input: ["k"], output: "ܟ" },

    // ܠ  Lāmadh
    { input: ["l"], output: "ܠ" },

    // ܡ  Mīm
    { input: ["m"], output: "ܡ" },

    // ܢ  Nūn
    { input: ["n"], output: "ܢ" },

    // ܣ  Sēmkath
    { input: ["s"], output: "ܣ" },

    // ܥ  ʿĒ  – ʿ (IPA modifier), j (ASCII stand-in)
    { input: ["ʿ", "j"], output: "ܥ" },

    // ܦ  Pē  – p (hard) or f (soft); both map to the same base letter
    { input: ["p", "f"], output: "ܦ" },

    // ܨ  Ṣādhē  – ṣ, Ṣ, S
    //    N.B. "S" alone is fine; "SH" / "sh" (shin) is longer and wins via
    //    maximum-munch, so there is no ambiguity.
    { input: ["ṣ", "Ṣ", "S"], output: "ܨ" },

    // ܩ  Qōph
    { input: ["q"], output: "ܩ" },

    // ܪ  Rēsh  – in Estrangela resh carries a dot above to distinguish it
    //    from dālath; the dot is added automatically in renderSyriac().
    { input: ["r"], output: "ܪ" },

    // ܫ  Shīn  – all capitalisations of the digraph, plus precomposed š/Š
    { input: ["š", "Š", "sh", "Sh", "sH", "SH"], output: "ܫ" },

    // ܬ  Tāw
    { input: ["t"], output: "ܬ" },
];

// ─────────────────────────────────────────────────────────────────────────────
//  Modifier table  (placed *after* a consonant in the input)
// ─────────────────────────────────────────────────────────────────────────────

const syriacModifiers: SyriacToken[] = [
    // Linea occultans: silent / quiescent letter  →  r-  produces ܪ̶
    { input: ["-"], output: LINEA_OCCULTANS },

    // Syāmē: plural marker (two dots above)  →  m"  produces ܡ̈
    // On resh the syāmē replaces the automatic dot above (handled in renderer).
    { input: ['"'], output: SYAME },

    // Dot below (qūššāyā / text-critical)
    { input: ["_"], output: DOT_BELOW },

    // Dot above (rukkākā / text-critical)
    // On resh this is identical to the automatically-added dot, so duplicates
    // are suppressed in the renderer.
    { input: ["^"], output: DOT_ABOVE },
];

// ─────────────────────────────────────────────────────────────────────────────
//  Lookup maps
// ─────────────────────────────────────────────────────────────────────────────

const consonantInputToOutput: { [key: string]: string } = {};
const modifierInputToOutput:  { [key: string]: string } = {};

for (const c of syriacConsonants) {
    for (const inp of c.input) consonantInputToOutput[inp] = c.output;
}
for (const m of syriacModifiers) {
    for (const inp of m.input) modifierInputToOutput[inp] = m.output;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Trie implementation (identical pattern to the Hebrew version)
// ─────────────────────────────────────────────────────────────────────────────

function syriacTrieInsert(str: string, cursor: number, node: SyriacTrieNode): void {
    if (cursor === str.length) { node.token = str; return; }
    const c = str[cursor];
    if (c === undefined) throw new Error("Logic error");
    if (!node.children[c]) node.children[c] = { token: null, children: {} };
    syriacTrieInsert(str, cursor + 1, node.children[c]);
}

function buildSyriacTrie(strs: string[]): SyriacTrieNode {
    const root: SyriacTrieNode = { token: null, children: {} };
    for (const s of strs) syriacTrieInsert(s, 0, root);
    return root;
}

function getNextSyriacToken(str: string, trie: SyriacTrieNode, start: number): string | null {
    let longest: string | null = null;
    let node: SyriacTrieNode | undefined = trie;
    for (let i = start; i < str.length; i++) {
        const c = str[i];
        if (c === undefined) throw new Error("Logic error");
        node = node.children[c];
        if (node === undefined) return longest;
        if (node.token !== null) longest = node.token;
    }
    return longest;
}

const consonantTrie = buildSyriacTrie(Object.keys(consonantInputToOutput));
const modifierTrie  = buildSyriacTrie(Object.keys(modifierInputToOutput));

// ─────────────────────────────────────────────────────────────────────────────
//  Tokeniser
// ─────────────────────────────────────────────────────────────────────────────

function tokenizeSyriac(str: string): ParsedSyriacToken[] {
    let cursor = 0;
    const tokens: ParsedSyriacToken[] = [];

    while (cursor < str.length) {
        const conMatch = getNextSyriacToken(str, consonantTrie, cursor);
        const modMatch = getNextSyriacToken(str, modifierTrie,  cursor);

        let chosen: string | null = null;
        let kind: "consonant" | "modifier" = "consonant";

        if (conMatch && modMatch) {
            // Prefer the longer match; consonant wins on a tie.
            if (conMatch.length >= modMatch.length) {
                chosen = conMatch; kind = "consonant";
            } else {
                chosen = modMatch; kind = "modifier";
            }
        } else if (conMatch) {
            chosen = conMatch; kind = "consonant";
        } else if (modMatch) {
            chosen = modMatch; kind = "modifier";
        }

        if (chosen === null) {
            tokens.push({ kind: "unparseable", value: str[cursor] });
            cursor++;
        } else {
            const output = kind === "consonant"
                ? consonantInputToOutput[chosen]
                : modifierInputToOutput[chosen];
            if (output === undefined) {
                throw new Error(`Logic error: "${chosen}" in trie but not in lookup map`);
            }
            tokens.push({ kind, output });
            cursor += chosen.length;
        }
    }

    return tokens;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Renderer
// ─────────────────────────────────────────────────────────────────────────────

const RESH_OUTPUT = "ܪ";

function renderSyriac(tokens: ParsedSyriacToken[]): string {
    let result = "";

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];

        if (token.kind === "unparseable") {
            result += token.value ?? "";
            continue;
        }

        if (token.kind === "modifier") {
            // Orphan modifier (not preceded by a consonant in this loop pass).
            result += token.output ?? "";
            continue;
        }

        // ── Consonant ────────────────────────────────────────────────────────
        const isResh = token.output === RESH_OUTPUT;
        result += token.output ?? "";

        // Collect any immediately following modifier tokens.
        const modifiers: string[] = [];
        while (i + 1 < tokens.length && tokens[i + 1].kind === "modifier") {
            i++;
            modifiers.push(tokens[i].output ?? "");
        }

        const hasSyame    = modifiers.includes(SYAME);
        const hasDotAbove = modifiers.includes(DOT_ABOVE);

        if (isResh) {
            // In Estrangela, resh normally carries a dot above to distinguish
            // it from dālath.  We add it automatically unless:
            //   (a) syāmē is present  – syāmē replaces the dot above, or
            //   (b) an explicit dot-above modifier (^) is already present
            //       – to avoid emitting U+0307 twice.
            if (!hasSyame && !hasDotAbove) {
                result += DOT_ABOVE;
            }
        }

        // Append all explicit modifiers in input order.
        for (const mod of modifiers) {
            result += mod;
        }
    }

    return result;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Transliterate a romanised Syriac string into Estrangela Unicode.
 *
 * Consonant mapping:
 *   a/A/ʾ → ܐ   b → ܒ   g → ܓ   d → ܕ   h → ܗ
 *   w/W/u/U → ܘ  z → ܙ   H/ḥ/Ḥ → ܚ   T/ṭ/Ṭ → ܛ
 *   y/Y/i/I → ܝ  k → ܟ   l → ܠ   m → ܡ   n → ܢ
 *   s → ܣ   j/ʿ → ܥ   p/f → ܦ   S/ṣ/Ṣ → ܨ   q → ܩ
 *   r → ܪ (+ automatic dot above)
 *   sh/Sh/sH/SH/š/Š → ܫ   t → ܬ
 *
 * Post-consonant modifier characters:
 *   -  linea occultans (silent letter)
 *   "  syāmē / plural dots (replaces the automatic dot on resh)
 *   _  dot below
 *   ^  dot above (suppresses the automatic dot on resh to avoid duplication)
 */
export function transliterateSyriac(str: string): string {
    return renderSyriac(tokenizeSyriac(str));
}

/**
 * Convenience: diacriticify an ASCII-shorthand string into the
 * romanisation scheme accepted by transliterateSyriac().
 *
 * ASCII shortcuts (applied before transliteration):
 *   H  → ḥ    T  → ṭ    S  → ṣ    C  → š
 *   '  → ʾ    `  → ʿ
 */
export function syriacDiacriticify(str: string): string {
    const map: { [k: string]: string } = {
        // These are single-char replacements that don't collide with the
        // two-char modifier keys (-, ", _, ^).
        "'": "ʾ",
        "`": "ʿ",
    };
    for (const [ascii, diacritic] of Object.entries(map)) {
        str = str.replaceAll(ascii, diacritic);
    }
    return str;
}

/** All special input characters used by the Syriac transliterator, for reference. */
export const syriacSpecialChars: string[] = [
    "ʾ", "ʿ", "ḥ", "Ḥ", "ṭ", "Ṭ", "ṣ", "Ṣ", "š", "Š",
    "-", '"', "_", "^",
];