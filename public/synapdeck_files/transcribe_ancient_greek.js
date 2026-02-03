/* GET IN LOSER WE'RE TRANSLITERATING ANCIENT GREEK */
/* Initial list of tokens. Uses NFD so accents can be treated as independent tokens.
 * Note: in NFD, diacritics below a character (class 220) sort before diacritics above
 * (class 230), but order within a class is preserved.
 *
 * This code handles Greek breathings, accents, and iota subscripts in various input formats.
 */
// Combining diacritics used in Greek
const acuteAccent = "\u0301"; // ́
const graveAccent = "\u0300"; // ̀
const circumflex = "\u0342"; // ͂
const roughBreathing = "\u0314"; // ̔
const smoothBreathing = "\u0313"; // ̓
const iotaSubscript = "\u0345"; // ͅ
const diaeresis = "\u0308"; // ̈
// Alternative representations for accents (ASCII-style)
const acuteAlt = "'";
const graveAlt = "`";
const circumflexAlt = "^";
const vowelTokens = [
    // Alpha
    { input: ["a"], internal: "vowel_alpha", output: "\u03b1" },
    // Epsilon
    { input: ["e"], internal: "vowel_epsilon", output: "\u03b5" },
    // Eta (long e)
    { input: ["ē", "e\u0304"], internal: "vowel_eta", output: "\u03b7" }, // ē or e with macron or ê
    // Iota
    { input: ["i"], internal: "vowel_iota", output: "\u03b9" },
    // Omicron
    { input: ["o"], internal: "vowel_omicron", output: "\u03bf" },
    // Omega (long o)
    { input: ["ō", "o\u0304"], internal: "vowel_omega", output: "\u03c9" }, // ō or o with macron or ô
    // Upsilon
    { input: ["u", "y"], internal: "vowel_upsilon", output: "\u03c5" },
];
// Diphthongs - these need to be checked before individual vowels
const diphthongTokens = [
    { input: ["ai"], internal: "diphthong_ai", output: "\u03b1\u03b9" },
    { input: ["ei"], internal: "diphthong_ei", output: "\u03b5\u03b9" },
    { input: ["oi"], internal: "diphthong_oi", output: "\u03bf\u03b9" },
    { input: ["ui", "yi"], internal: "diphthong_ui", output: "\u03c5\u03b9" },
    { input: ["au"], internal: "diphthong_au", output: "\u03b1\u03c5" },
    { input: ["eu"], internal: "diphthong_eu", output: "\u03b5\u03c5" },
    { input: ["ou"], internal: "diphthong_ou", output: "\u03bf\u03c5" },
    { input: ["ēu", "e\u0304u"], internal: "diphthong_eu_eta", output: "\u03b7\u03c5" },
    { input: ["ōu", "o\u0304u"], internal: "diphthong_ou_omega", output: "\u03c9\u03c5" },
];
const consonantTokens = [
    // Regular consonants
    { input: ["b"], internal: "consonant_beta", output: "\u03b2" },
    { input: ["g"], internal: "consonant_gamma", output: "\u03b3" },
    { input: ["d"], internal: "consonant_delta", output: "\u03b4" },
    { input: ["z"], internal: "consonant_zeta", output: "\u03b6" },
    { input: ["th"], internal: "consonant_theta", output: "\u03b8" },
    { input: ["k"], internal: "consonant_kappa", output: "\u03ba" },
    { input: ["l"], internal: "consonant_lambda", output: "\u03bb" },
    { input: ["m"], internal: "consonant_mu", output: "\u03bc" },
    { input: ["n"], internal: "consonant_nu", output: "\u03bd" },
    { input: ["x"], internal: "consonant_xi", output: "\u03be" },
    { input: ["p"], internal: "consonant_pi", output: "\u03c0" },
    // Rho - "rh" maps to rho with rough breathing at word-initial
    // Must come before plain "r" in token list
    { input: ["rh"], internal: "consonant_rho_rough", output: "\u03c1" + roughBreathing },
    { input: ["r"], internal: "consonant_rho", output: "\u03c1" },
    // Sigma (different forms handled in post-processing)
    { input: ["s"], internal: "consonant_sigma", output: "\u03c3" }, // medial sigma
    { input: ["t"], internal: "consonant_tau", output: "\u03c4" },
    { input: ["ph"], internal: "consonant_phi", output: "\u03c6" },
    { input: ["kh", "ch"], internal: "consonant_chi", output: "\u03c7" },
    { input: ["ps"], internal: "consonant_psi", output: "\u03c8" },
];
// Breathing and accent markers
const breathingTokens = [
    { input: [">", smoothBreathing], internal: "smooth_breathing", output: smoothBreathing },
    { input: ["<", roughBreathing], internal: "rough_breathing", output: roughBreathing },
];
const accentTokens = [
    { input: [acuteAlt, acuteAccent], internal: "acute", output: acuteAccent },
    { input: [graveAlt, graveAccent], internal: "grave", output: graveAccent },
    { input: [circumflexAlt, circumflex], internal: "circumflex", output: circumflex },
];
// Iota subscript marker
const subscriptTokens = [
    { input: ["|", iotaSubscript], internal: "iota_subscript", output: iotaSubscript },
];
// Diaeresis marker (for breaking diphthongs)
const diaeresisTokens = [
    { input: ["+", diaeresis], internal: "diaeresis", output: diaeresis },
];
// Punctuation
const punctuationTokens = [
    { input: ["."], internal: "period", output: "." },
    { input: [","], internal: "comma", output: "," },
    { input: [";"], internal: "semicolon", output: ";" },
    { input: [":"], internal: "colon", output: ":" },
    { input: ["?"], internal: "question", output: ";" }, // Greek question mark
    { input: ["!"], internal: "exclamation", output: "!" },
    { input: ["\n"], internal: "newline", output: "\n" },
];
// Special tokens
const specialTokens = [
    { input: [" "], internal: "space", output: " " },
    { input: ["-"], internal: "hyphen", output: "-" },
];
const tokens = [
    ...diphthongTokens, // Check diphthongs first!
    ...vowelTokens,
    ...consonantTokens,
    ...breathingTokens,
    ...accentTokens,
    ...subscriptTokens,
    ...diaeresisTokens,
    ...punctuationTokens,
    ...specialTokens,
];
const tokenInputs = [];
const inputToInternalToken = {};
for (const t of tokens) {
    for (const s of t.input) {
        tokenInputs.push(s);
        inputToInternalToken[s] = t.internal;
    }
}
// Create lookup tables
const internalVowelTokenToOutput = {};
for (const token of vowelTokens) {
    internalVowelTokenToOutput[token.internal] = token.output;
}
const internalDiphthongTokenToOutput = {};
for (const token of diphthongTokens) {
    internalDiphthongTokenToOutput[token.internal] = token.output;
}
const internalConsonantTokenToOutput = {};
for (const token of consonantTokens) {
    internalConsonantTokenToOutput[token.internal] = token.output;
}
const internalBreathingTokenToOutput = {};
for (const token of breathingTokens) {
    internalBreathingTokenToOutput[token.internal] = token.output;
}
const internalAccentTokenToOutput = {};
for (const token of accentTokens) {
    internalAccentTokenToOutput[token.internal] = token.output;
}
const internalSubscriptTokenToOutput = {};
for (const token of subscriptTokens) {
    internalSubscriptTokenToOutput[token.internal] = token.output;
}
const internalDiaeresisTokenToOutput = {};
for (const token of diaeresisTokens) {
    internalDiaeresisTokenToOutput[token.internal] = token.output;
}
const internalPunctuationTokenToOutput = {};
for (const token of punctuationTokens) {
    internalPunctuationTokenToOutput[token.internal] = token.output;
}
const internalSpecialTokenToOutput = {};
for (const token of specialTokens) {
    internalSpecialTokenToOutput[token.internal] = token.output;
}
function isVowelToken(s) {
    return internalVowelTokenToOutput[s] !== undefined;
}
function isDiphthongToken(s) {
    return internalDiphthongTokenToOutput[s] !== undefined;
}
function isConsonantToken(s) {
    return internalConsonantTokenToOutput[s] !== undefined;
}
function isBreathingToken(s) {
    return internalBreathingTokenToOutput[s] !== undefined;
}
function isAccentToken(s) {
    return internalAccentTokenToOutput[s] !== undefined;
}
function isSubscriptToken(s) {
    return internalSubscriptTokenToOutput[s] !== undefined;
}
function isDiaeresisToken(s) {
    return internalDiaeresisTokenToOutput[s] !== undefined;
}
function isPunctuationToken(s) {
    return internalPunctuationTokenToOutput[s] !== undefined;
}
function isSpecialToken(s) {
    return internalSpecialTokenToOutput[s] !== undefined;
}
function initialTokenize(str) {
    // Normalize to NFD for proper diacritic handling
    const normalized = str.normalize("NFD");
    const tokens = [];
    let i = 0;
    while (i < normalized.length) {
        let matched = false;
        // Try to match tokens, longest first
        const sortedInputs = [...tokenInputs].sort((a, b) => b.length - a.length);
        for (const input of sortedInputs) {
            if (normalized.substring(i, i + input.length) === input) {
                const internal = inputToInternalToken[input];
                if (internal) {
                    tokens.push({ kind: "token", token: internal });
                    i += input.length;
                    matched = true;
                    break;
                }
            }
        }
        if (!matched) {
            // Unparseable character
            tokens.push({ kind: "unparseable", value: normalized[i] });
            i++;
        }
    }
    return tokens;
}
function syllabify(tokens, flags) {
    const out = [];
    let i = 0;
    let isWordInitial = true;
    while (i < tokens.length) {
        const t = tokens[i];
        if (t.kind === "unparseable") {
            out.push({ kind: "unparseable", value: t.value });
            i++;
            isWordInitial = false;
            continue;
        }
        const token = t.token;
        // Handle punctuation and special tokens
        if (isPunctuationToken(token) || isSpecialToken(token)) {
            out.push({ kind: "punctuation_or_special", token });
            i++;
            if (token === "space" || isPunctuationToken(token)) {
                isWordInitial = true;
            }
            continue;
        }
        // Build a syllable
        const consonants = [];
        let vowelOrDiphthong = null;
        let breathing = null;
        let accent = null;
        let subscript = null;
        let diaeresis = null;
        // Collect initial consonants
        while (i < tokens.length) {
            const currentToken = tokens[i];
            if (currentToken.kind === "token" && isConsonantToken(currentToken.token)) {
                consonants.push(currentToken.token);
                i++;
            }
            else {
                break;
            }
        }
        // Check for breathing mark (for word-initial vowels or explicit marking)
        if (i < tokens.length) {
            const currentToken = tokens[i];
            if (currentToken.kind === "token" && isBreathingToken(currentToken.token)) {
                breathing = currentToken.token;
                i++;
            }
        }
        // Get vowel or diphthong
        if (i < tokens.length) {
            const currentToken = tokens[i];
            if (currentToken.kind === "token") {
                const tok = currentToken.token;
                if (isDiphthongToken(tok)) {
                    vowelOrDiphthong = tok;
                    i++;
                }
                else if (isVowelToken(tok)) {
                    vowelOrDiphthong = tok;
                    i++;
                }
            }
        }
        // Get diacritics (accent, subscript, diaeresis) in any order
        while (i < tokens.length) {
            const currentToken = tokens[i];
            if (currentToken.kind === "token") {
                const tok = currentToken.token;
                if (isAccentToken(tok) && accent === null) {
                    accent = tok;
                    i++;
                }
                else if (isSubscriptToken(tok) && subscript === null) {
                    subscript = tok;
                    i++;
                }
                else if (isDiaeresisToken(tok) && diaeresis === null) {
                    diaeresis = tok;
                    i++;
                }
                else {
                    break;
                }
            }
            else {
                break;
            }
        }
        if (consonants.length > 0 || vowelOrDiphthong !== null) {
            out.push({
                kind: "syllable",
                consonants,
                vowelOrDiphthong,
                breathing,
                accent,
                subscript,
                diaeresis,
                isWordInitial,
            });
            isWordInitial = false;
        }
    }
    return out;
}
// Convert a syllable to Greek Unicode
function stringifySyllable(syllable, nextSyllable) {
    if (syllable.kind === "syllable") {
        const { consonants, vowelOrDiphthong, breathing, accent, subscript, diaeresis, isWordInitial } = syllable;
        const parts = [];
        // Add consonants
        for (const c of consonants) {
            let consonantOutput = internalConsonantTokenToOutput[c];
            parts.push(consonantOutput);
        }
        // Add vowel/diphthong with diacritics
        if (vowelOrDiphthong !== null) {
            let vowelBase;
            if (isDiphthongToken(vowelOrDiphthong)) {
                vowelBase = internalDiphthongTokenToOutput[vowelOrDiphthong];
            }
            else {
                vowelBase = internalVowelTokenToOutput[vowelOrDiphthong];
            }
            // Determine where diacritics go
            const isDiphthongWithIotaOrUpsilon = vowelBase.length === 2 &&
                (vowelBase[1] === '\u03b9' || vowelBase[1] === '\u03c5'); // ι or υ
            if (isDiphthongWithIotaOrUpsilon) {
                // For diphthongs ending in ι or υ, diacritics go on the SECOND vowel
                parts.push(vowelBase[0]); // First vowel, plain
                parts.push(vowelBase[1]); // Second vowel
                // Add diacritics to second vowel
                if (breathing !== null && consonants.length === 0) {
                    parts.push(internalBreathingTokenToOutput[breathing]);
                }
                if (diaeresis !== null) {
                    parts.push(internalDiaeresisTokenToOutput[diaeresis]);
                }
                if (accent !== null) {
                    parts.push(internalAccentTokenToOutput[accent]);
                }
                if (subscript !== null) {
                    parts.push(internalSubscriptTokenToOutput[subscript]);
                }
            }
            else {
                // For single vowels and other diphthongs, diacritics go on FIRST vowel
                parts.push(vowelBase[0]);
                if (breathing !== null && consonants.length === 0) {
                    parts.push(internalBreathingTokenToOutput[breathing]);
                }
                if (diaeresis !== null) {
                    parts.push(internalDiaeresisTokenToOutput[diaeresis]);
                }
                if (accent !== null) {
                    parts.push(internalAccentTokenToOutput[accent]);
                }
                if (subscript !== null) {
                    parts.push(internalSubscriptTokenToOutput[subscript]);
                }
                // Add remaining characters (for diphthongs)
                parts.push(vowelBase.slice(1));
            }
        }
        // Handle final sigma: if this is sigma and next syllable starts with non-letter or is end
        let result = parts.join("");
        if (result.includes("\u03c3")) {
            // Check if this is the last syllable AND sigma is at the end
            const isFinal = (nextSyllable === null ||
                nextSyllable.kind !== "syllable") &&
                result.endsWith("\u03c3"); // Only if sigma is at the END
            if (isFinal) {
                // Only replace the final sigma, not all of them
                result = result.replace(/\u03c3$/g, "\u03c2"); // Replace only trailing σ with ς
            }
        }
        return result;
    }
    else if (syllable.kind === "punctuation_or_special") {
        const token = syllable.token;
        if (isPunctuationToken(token)) {
            return internalPunctuationTokenToOutput[token];
        }
        else if (isSpecialToken(token)) {
            return internalSpecialTokenToOutput[token];
        }
        else {
            const _exhaustivenessCheck = token;
            throw new Error("Logic error");
        }
    }
    else if (syllable.kind === "unparseable") {
        return syllable.value;
    }
    else {
        const _exhaustivenessCheck = syllable;
        throw new Error("Logic error");
    }
}
function stringifySyllableSequence(syllables) {
    const stringifiedSyllables = [];
    for (let i = 0; i < syllables.length; i++) {
        const syllable = syllables[i];
        const nextSyllable = i + 1 < syllables.length ? syllables[i + 1] : null;
        stringifiedSyllables.push(stringifySyllable(syllable, nextSyllable));
    }
    return stringifiedSyllables.join("");
}
function dealWithBreathings(str) {
    const normalized = str.normalize("NFD");
    const diphthongs = ["ai", "ei", "oi", "ui", "yi", "au", "eu", "ou", "ēu", "ōu", "Ai", "Ei", "Oi", "Ui", "Yi", "Au", "Eu", "Ou", "Ēu"];
    return normalized.split(" ").map(word => {
        // DON'T touch "rh" - the tokenizer already handles it!
        if (word.startsWith("<r")) {
            return "rh" + word.slice(2);
        }
        if (word.startsWith("<R")) {
            return "Rh" + word.slice(2);
        }
        if (word[0] === "h" || word[0] === "H") {
            return "<" + word.slice(1);
        }
        // Check if starts with diphthong, BUT NOT if there's a + after the diphthong (breaks it)
        const startsWithDiphthong = diphthongs.some(d => {
            const lower = word.toLowerCase();
            if (lower.startsWith(d)) {
                // Check if diaeresis marker follows - if so, it's NOT a diphthong
                return lower.charAt(d.length) !== '+';
            }
            return false;
        });
        // Check if word starts with a simple vowel
        const firstChar = word[0]?.toLowerCase();
        const startsWithVowel = firstChar && ["a", "e", "i", "o", "u", "y", "ē", "ō"].includes(firstChar);
        // Only auto-add smooth breathing to vowels (including diphthongs)
        if (startsWithVowel || startsWithDiphthong) {
            return ">" + word;
        }
        return word;
    }).join(" ");
}
function dealWithLongVowels(str) {
    str = str.replaceAll("e^", "ē^").replaceAll("o^", "ō^");
    return str.replaceAll("ê", "ē^").replaceAll("ô", "ō^");
}
function dealWithDiaeresis(str) {
    // Move + before vowel to after it, but add a marker between diphthong vowels first
    // This prevents "ai" from tokenizing as diphthong when it's really "a" + "ï"
    // Insert ~ between diphthong pairs that have + (to break diphthong matching)
    str = str.replace(/(a)\+(i)/gi, '$1%%$2+');
    str = str.replace(/(e)\+(i)/gi, '$1%%$2+');
    str = str.replace(/(o)\+(i)/gi, '$1%%$2+');
    str = str.replace(/(u)\+(i)/gi, '$1%%$2+');
    str = str.replace(/(y)\+(i)/gi, '$1%%$2+');
    str = str.replace(/(a)\+(u)/gi, '$1%%$2+');
    str = str.replace(/(e)\+(u)/gi, '$1%%$2+');
    str = str.replace(/(o)\+(u)/gi, '$1%%$2+');
    str = str.replace(/(ē)\+(u)/gi, '$1%%$2+');
    str = str.replace(/(ō)\+(u)/gi, '$1%%$2+');
    return str;
}
function dealWithIotaSubscripts(str) {
    // First convert = to |
    str = str.replaceAll("=", "|");
    // Then move any accent marks that come after | to before it
    // This matches: | followed by one or more accent marks
    str = str.replace(/\|([`'^]+)/g, '$1|');
    return str;
}
//Could add uppercase tokens and *probably* should, but...
function normalizeCase(str) {
    const capitalPositions = [];
    let normalized = "";
    for (let i = 0; i < str.length; i++) {
        const char = str[i];
        if (char === char.toUpperCase() && char !== char.toLowerCase()) {
            capitalPositions.push(i);
            normalized += char.toLowerCase();
        }
        else {
            normalized += char;
        }
    }
    return { normalized, capitalPositions };
}
function applyCapitalization(greek, originalCapitalPositions) {
    // Simple approach: capitalize first letter if first letter of input was capital
    if (originalCapitalPositions.length > 0 && originalCapitalPositions[0] === 0) {
        return greek.charAt(0).toUpperCase() + greek.slice(1);
    }
    return greek;
}
function transliterateGreekWithFlags(str, flags) {
    const { normalized, capitalPositions } = normalizeCase(str);
    str = dealWithLongVowels(normalized);
    str = dealWithDiaeresis(str);
    str = dealWithBreathings(str);
    str = dealWithIotaSubscripts(str); // Add this line!
    const tokens = initialTokenize(str);
    const syllables = syllabify(tokens, flags);
    let output = stringifySyllableSequence(syllables);
    output = output.replaceAll("%%", "");
    return applyCapitalization(output.normalize("NFC"), capitalPositions);
}
export function transliterateGreek(str) {
    return transliterateGreekWithFlags(str, { preserveWordBreaks: false });
}
//# sourceMappingURL=transcribe_ancient_greek.js.map