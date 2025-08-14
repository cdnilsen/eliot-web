/* ANCIENT GREEK TRANSLITERATOR - Token-Based Architecture */

interface Token {
    input: string[];
    internal: string;
    output: string;
}

interface ParsedToken {
    kind: "token";
    token: string;
}

interface UnparseableToken {
    kind: "unparseable";
    value: string;
}

type TokenOutput = ParsedToken | UnparseableToken;

interface Syllable {
    kind: "syllable";
    consonants: string[];
    vowel: string | null;
    diacritics: string[];
}

interface PunctuationOrSpecial {
    kind: "punctuation_or_special";
    token: string;
}

type SyllableOutput = Syllable | PunctuationOrSpecial | UnparseableToken;

interface TrieNode {
    token: string | null;
    children: { [key: string]: TrieNode };
}

const vowelTokens: Token[] = [
    // Regular vowels
    {input: ["a"], internal: "alpha_lower", output: "α"},
    {input: ["A"], internal: "alpha_upper", output: "Α"},
    {input: ["e"], internal: "epsilon_lower", output: "ε"},
    {input: ["E"], internal: "epsilon_upper", output: "Ε"},
    {input: ["ē", "j"], internal: "eta_lower", output: "η"},
    {input: ["Ē", "J"], internal: "eta_upper", output: "Η"},
    {input: ["i"], internal: "iota_lower", output: "ι"},
    {input: ["I"], internal: "iota_upper", output: "Ι"},
    {input: ["o"], internal: "omicron_lower", output: "ο"},
    {input: ["O"], internal: "omicron_upper", output: "Ο"},
    {input: ["u", "y"], internal: "upsilon_lower", output: "υ"},
    {input: ["U", "Y"], internal: "upsilon_upper", output: "Υ"},
    {input: ["ō", "w"], internal: "omega_lower", output: "ω"},
    {input: ["Ō", "W"], internal: "omega_upper", output: "Ω"},

    //Simple diphthongs
    {input: ["ai"], internal: "ai_lower", output: "αι"},
    {input: ["Ai"], internal: "ai_title", output: "Αι"},
    {input: ["AI"], internal: "ai_upper", output: "ΑΙ"},
    {input: ["au"], internal: "au_lower", output: "αυ"},
    {input: ["Au"], internal: "au_title", output: "Αυ"},
    {input: ["AU"], internal: "au_upper", output: "ΑΥ"},
    {input: ["ei"], internal: "ei_lower", output: "ει"},
    {input: ["Ei"], internal: "ei_title", output: "Ει"},
    {input: ["EI"], internal: "ei_upper", output: "ΕΙ"},
    {input: ["eu"], internal: "eu_lower", output: "ευ"},
    {input: ["Eu"], internal: "eu_title", output: "Ευ"},
    {input: ["EU"], internal: "eu_upper", output: "ΕΥ"},
    {input: ["ēu", "ju", "ēy", "jy"], internal: "etaupsilon_lower", output: "ηυ"},
    {input: ["Ēu", "Ju", "Ēy", "Jy"], internal: "etaupsilon_title", output: "Ηυ"},
    {input: ["ĒU", "JU", "ĒY", "JY"], internal: "etaupsilon_upper", output: "ΗΥ"},
    {input: ["oi"], internal: "oi_lower", output: "οι"},
    {input: ["Oi"], internal: "oi_title", output: "Οι"},
    {input: ["OI"], internal: "oi_upper", output: "ΟΙ"},
    {input: ["ou"], internal: "ou_lower", output: "ου"},
    {input: ["Ou"], internal: "ou_title", output: "Ου"},
    {input: ["OU"], internal: "ou_upper", output: "ΟΥ"},
    {input: ["ui", "yi"], internal: "ui_lower", output: "υι"},
    {input: ["Ui", "Yi"], internal: "ui_title", output: "Υι"},
    {input: ["UI", "YI"], internal: "ui_upper", output: "ΥΙ"}
];

const consonantTokens: Token[] = [
    {input: ["b"], internal: "beta_lower", output: "β"},
    {input: ["B"], internal: "beta_upper", output: "Β"},
    {input: ["g"], internal: "gamma_lower", output: "γ"},
    {input: ["G"], internal: "gamma_upper", output: "Γ"},
    {input: ["d"], internal: "delta_lower", output: "δ"},
    {input: ["D"], internal: "delta_upper", output: "Δ"},
    {input: ["z"], internal: "zeta_lower", output: "ζ"},
    {input: ["Z"], internal: "zeta_upper", output: "Ζ"},
    {input: ["th"], internal: "theta_lower", output: "θ"},
    {input: ["Th", "TH"], internal: "theta_upper", output: "Θ"},
    {input: ["k"], internal: "kappa_lower", output: "κ"},
    {input: ["K"], internal: "kappa_upper", output: "Κ"},
    {input: ["l"], internal: "lambda_lower", output: "λ"},
    {input: ["L"], internal: "lambda_upper", output: "Λ"},
    {input: ["m"], internal: "mu_lower", output: "μ"},
    {input: ["M"], internal: "mu_upper", output: "Μ"},
    {input: ["n"], internal: "nu_lower", output: "ν"},
    {input: ["N"], internal: "nu_upper", output: "Ν"},
    {input: ["x"], internal: "xi_lower", output: "ξ"},
    {input: ["X"], internal: "xi_upper", output: "Ξ"},
    {input: ["p"], internal: "pi_lower", output: "π"},
    {input: ["P"], internal: "pi_upper", output: "Π"},
    {input: ["r"], internal: "rho_lower", output: "ρ"},
    {input: ["R"], internal: "rho_upper", output: "Ρ"},
    {input: ["rh"], internal: "rough_rho_lower", output: "ῥ"},
    {input: ["Rh", "RH"], internal: "rough_rho_upper", output: "Ῥ"},
    {input: ["s"], internal: "sigma_lower", output: "σ"},
    {input: ["S"], internal: "sigma_upper", output: "Σ"},
    {input: ["t"], internal: "tau_lower", output: "τ"},
    {input: ["T"], internal: "tau_upper", output: "Τ"},
    {input: ["ph", "f"], internal: "phi_lower", output: "φ"},
    {input: ["Ph", "PH", "F"], internal: "phi_upper", output: "Φ"},
    {input: ["kh", "ch"], internal: "chi_lower", output: "χ"},
    {input: ["Kh", "KH", "Ch", "CH"], internal: "chi_upper", output: "Χ"},
    {input: ["ps"], internal: "psi_lower", output: "ψ"},
    {input: ["Ps", "PS"], internal: "psi_upper", output: "Ψ"},
    {input: ["v"], internal: "digamma_lower", output: "ϝ"},
    {input: ["V"], internal: "digamma_upper", output: "Ϝ"},
    {input: ["q"], internal: "qoppa_lower", output: "ϙ"},
    {input: ["Q"], internal: "qoppa_upper", output: "Ϙ"},
    {input: ["c"], internal: "kappa_alt_lower", output: "κ"}, // c as kappa alternative
    {input: ["C"], internal: "kappa_alt_upper", output: "Κ"}
];

const diacriticalTokens: Token[] = [
    // Breathing marks
    {input: ["("], internal: "rough_breathing", output: "\u0314"}, // combining rough breathing
    {input: [")"], internal: "smooth_breathing", output: "\u0313"}, // combining smooth breathing
    
    // Accents  
    {input: ["/", "'"], internal: "acute_accent", output: "\u0301"}, // combining acute
    {input: ["\\", "`"], internal: "grave_accent", output: "\u0300"}, // combining grave
    {input: ["^", "~"], internal: "circumflex_accent", output: "\u0342"}, // combining circumflex
    
    // Iota subscript
    {input: ["|", "="], internal: "iota_subscript", output: "\u0345"}, // combining iota subscript
];

const punctuationTokens: Token[] = [
    {input: ["."], internal: "period", output: "."},
    {input: [","], internal: "comma", output: ","},
    {input: [";"], internal: "semicolon", output: "·"},
    {input: ["?"], internal: "question", output: ";"},  // Greek question mark
    {input: [":"], internal: "colon", output: ":"},
    {input: ["\n"], internal: "newline", output: "\n"},
];

const specialTokens: Token[] = [
    {input: [" "], internal: "space", output: " "},
    {input: ["-"], internal: "hyphen", output: "-"},
];

const tokens: Token[] = [...vowelTokens, ...consonantTokens, ...diacriticalTokens, ...punctuationTokens, ...specialTokens];
const tokenInputs: string[] = [];
const inputToInternalToken: { [key: string]: string } = {};

for (const t of tokens) {
  for (const s of t.input) {
    tokenInputs.push(s);
    inputToInternalToken[s] = t.internal;
  }
}

// Create lookup maps
const internalVowelTokenToOutput: { [key: string]: string } = {};
for (const token of vowelTokens) {
  internalVowelTokenToOutput[token.internal] = token.output;
}

const internalConsonantTokenToOutput: { [key: string]: string } = {};
for (const token of consonantTokens) {
  internalConsonantTokenToOutput[token.internal] = token.output;
}

const internalDiacriticalTokenToOutput: { [key: string]: string } = {};
for (const token of diacriticalTokens) {
  internalDiacriticalTokenToOutput[token.internal] = token.output;
}

const internalPunctuationTokenToOutput: { [key: string]: string } = {};
for (const token of punctuationTokens) {
  internalPunctuationTokenToOutput[token.internal] = token.output;
}

const internalSpecialTokenToOutput: { [key: string]: string } = {};
for (const token of specialTokens) {
  internalSpecialTokenToOutput[token.internal] = token.output;
}

// Type guard functions
function isVowelToken(s: string): boolean {
  return internalVowelTokenToOutput[s] !== undefined;
}

function isConsonantToken(s: string): boolean {
  return internalConsonantTokenToOutput[s] !== undefined;
}

function isDiacriticalToken(s: string): boolean {
  return internalDiacriticalTokenToOutput[s] !== undefined;
}

function isPunctuationToken(s: string): boolean {
  return internalPunctuationTokenToOutput[s] !== undefined;
}

function isSpecialToken(s: string): boolean {
  return internalSpecialTokenToOutput[s] !== undefined;
}

// Trie implementation
function trieInsert(str: string, stringCursor: number, treeCursor: TrieNode): void {
  if (stringCursor === str.length) {
    treeCursor.token = str;
    return;
  }
  const nextChar = str[stringCursor];
  if (nextChar === undefined) throw new Error("Logic error");
  if (treeCursor.children[nextChar] == undefined) {
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

function maximumMunchTokenize(str: string, trie: TrieNode): TokenOutput[] {
 let strCursor = 0;
 const out: TokenOutput[] = [];
 while (strCursor < str.length) {
   const tokenStr = getNextToken(str, trie, strCursor);
   if (tokenStr === null) {
     out.push({ kind: "unparseable", value: str[strCursor] });
     strCursor += 1;
   }
   else {
     const token = inputToInternalToken[tokenStr];
     if (token === undefined) throw new Error(`Logic error: ${tokenStr} is in trie but is not a valid token`);
     out.push({ kind: "token", token: token });
     strCursor += tokenStr.length;
   }
 }
 
 // Handle word-initial h/H before vowels as rough breathing
 if (out.length >= 2 && 
     out[0].kind === "unparseable" && 
     (out[0].value === "h" || out[0].value === "H") && 
     out[1].kind === "token" && 
     isVowelToken(out[1].token)) {
   // Remove the h/H and add rough breathing after the vowel
   out.shift(); // Remove the h/H
   out.splice(1, 0, { kind: "token", token: "rough_breathing" }); // Insert rough breathing after vowel
 }
 // Handle word-initial vowels as smooth breathing
 else if(out.length >= 1 &&
   out[0].kind === "token" && 
   isVowelToken(out[0].token)) {
   // Add smooth breathing after the initial vowel
   out.splice(1, 0, { kind: "token", token: "smooth_breathing" }); // Insert smooth breathing after vowel
 }
 
 return out;
}

const greekTrie: TrieNode = constructTrie([...Object.keys(inputToInternalToken)]);

// Greek-specific preprocessing
function normalizeIotaSubscriptNotation(str: string): string {
  const iotaSubscriptPattern = /<([^>]+)>/g;
  return str.replace(iotaSubscriptPattern, (match, content) => {
    return content + '|';
  });
}

function normalizeAccentedLetters(str: string): string {
  const accentMap: { [key: string]: string } = {
    // Circumflex mappings
    'â': 'a^', 'ê': 'j^', 'î': 'i^', 'ô': 'w^', 'û': 'u^', 'ŷ': 'y^', 'ŵ': 'w^',
    'Â': 'A^', 'Ê': 'J^', 'Î': 'I^', 'Ô': 'W^', 'Û': 'U^', 'Ŷ': 'Y^', 'Ŵ': 'W^',

    //Tilde mappings
    'ã': 'a^', 'ẽ': 'j^', 'ĩ': 'i^', 'õ': 'w^', 'ũ': 'u^', 'ỹ': 'y^',
    'Ã': 'A^', 'Ẽ': 'J^', 'Ĩ': 'I^', 'Õ': 'W~', 'Ũ': 'U^', 'Ỹ': 'Y^', 
    
    // Acute mappings
    'á': 'a/', 'é': 'e/', 'í': 'i/', 'ó': 'o/', 'ú': 'u/', 'ý': 'y/', 'ẃ': 'w/',
    'Á': 'A/', 'É': 'E/', 'Í': 'I/', 'Ó': 'O/', 'Ú': 'U/', 'Ý': 'Y/', 'Ẃ': 'W/',
    
    // Grave mappings
    'à': 'a\\', 'è': 'e\\', 'ì': 'i\\', 'ò': 'o\\', 'ù': 'u\\', 'ỳ': 'y\\', 'ẁ': 'w\\',
    'À': 'A\\', 'È': 'E\\', 'Ì': 'I\\', 'Ò': 'O\\', 'Ù': 'U\\', 'Ỳ': 'Y\\', 'Ẁ': 'w\\',
    
    // Macron mappings
    'ā': 'a:', 'ē': 'j', 'ī': 'i:', 'ō': 'w', 'ū': 'u:', 'ȳ': 'y:',
    'Ā': 'A:', 'Ē': 'J', 'Ī': 'I:', 'Ō': 'W', 'Ū': 'U:', 'Ȳ': 'Y:',

  };
  
  let result = str;
  for (const [accented, normalized] of Object.entries(accentMap)) {
    result = result.replaceAll(accented, normalized);
  }
  return result;
}

function handleSpecialCircumflexCases(str: string): string {
  const specialMappings: { [key: string]: string } = {
    'e^': 'j^', 'E^': 'J^', 'e~': 'j~', 'E~': 'J~',   // epsilon-circumflex -> eta-circumflex  
    'o^': 'w^', 'O^': 'W^', 'o~': 'w~', 'O~': 'W~',  // omicron-circumflex -> omega-circumflex
  };
  
  let result = str;
  for (const [pattern, replacement] of Object.entries(specialMappings)) {
    result = result.replaceAll(pattern, replacement);
  }
  return result;
}

function initialTokenize(str: string): TokenOutput[] {
  str = normalizeAccentedLetters(str);
  str = str.normalize("NFD");
  str = normalizeIotaSubscriptNotation(str);
  str = handleSpecialCircumflexCases(str);
  return maximumMunchTokenize(str, greekTrie);
}

// Greek syllabification (simplified compared to Sanskrit)
function syllabifyGreek(tokens: TokenOutput[]): SyllableOutput[] {
  const out: SyllableOutput[] = [];
  let currentSyllable: { consonants: string[], vowel: string | null, diacritics: string[] } = { consonants: [], vowel: null, diacritics: [] };
  
  for (const tou of tokens) {
    if (tou.kind === "unparseable") {
      // Flush current syllable and add unparseable
      if (currentSyllable.consonants.length > 0 || currentSyllable.vowel !== null) {
        out.push({ kind: "syllable", ...currentSyllable });
        currentSyllable = { consonants: [], vowel: null, diacritics: [] };
      }
      out.push({ kind: "unparseable", value: tou.value });
      continue;
    }
    
    const token = tou.token;
    
    if (isConsonantToken(token)) {
      if (currentSyllable.vowel !== null) {
        // Consonant after vowel starts new syllable
        out.push({ kind: "syllable", ...currentSyllable });
        currentSyllable = { consonants: [token], vowel: null, diacritics: [] };
      } else {
        currentSyllable.consonants.push(token);
      }
    } else if (isVowelToken(token)) {
      if (currentSyllable.vowel !== null) {
        // Second vowel starts new syllable
        out.push({ kind: "syllable", ...currentSyllable });
        currentSyllable = { consonants: [], vowel: token, diacritics: [] };
      } else {
        currentSyllable.vowel = token;
      }
    } else if (isDiacriticalToken(token)) {
      currentSyllable.diacritics.push(token);
    } else if (isPunctuationToken(token) || isSpecialToken(token)) {
      // Flush current syllable
      if (currentSyllable.consonants.length > 0 || currentSyllable.vowel !== null) {
        out.push({ kind: "syllable", ...currentSyllable });
        currentSyllable = { consonants: [], vowel: null, diacritics: [] };
      }
      out.push({ kind: "punctuation_or_special", token: token });
    }
  }
  
  // Add final syllable
  if (currentSyllable.consonants.length > 0 || currentSyllable.vowel !== null) {
    out.push({ kind: "syllable", ...currentSyllable });
  }
  
  return out;
}

// Render syllables to Greek text
function renderGreekSyllable(syllable: SyllableOutput): string {
  if (syllable.kind === "syllable") {
    const parts: string[] = [];
    
    // Add consonants
    for (const c of syllable.consonants) {
      parts.push(internalConsonantTokenToOutput[c]);
    }
    
    // Add vowel
    if (syllable.vowel !== null) {
      parts.push(internalVowelTokenToOutput[syllable.vowel]);
    }
    
    // Add diacritics in proper order (iota subscript + breathing + accent)
    const iotaSubscripts = syllable.diacritics.filter(d => d === "iota_subscript");
    const breathings = syllable.diacritics.filter(d => d === "rough_breathing" || d === "smooth_breathing");
    const accents = syllable.diacritics.filter(d => d === "acute_accent" || d === "grave_accent" || d === "circumflex_accent");
    
    for (const d of iotaSubscripts) parts.push(internalDiacriticalTokenToOutput[d]);
    for (const d of breathings) parts.push(internalDiacriticalTokenToOutput[d]);
    for (const d of accents) parts.push(internalDiacriticalTokenToOutput[d]);
    
    return parts.join("");
  } else if (syllable.kind === "punctuation_or_special") {
    if (isPunctuationToken(syllable.token)) {
      return internalPunctuationTokenToOutput[syllable.token];
    } else {
      return internalSpecialTokenToOutput[syllable.token];
    }
  } else {
    return syllable.value;
  }
}

function applyFinalSigma(text: string): string {
  return text.replace(/σ(?=\s|$|[^\p{L}])/gu, 'ς');
}

// Main transliteration function
export function transliterateGreek(str: string, noDiacritics = true): string {
  const tokens = initialTokenize(str);
  const syllables = syllabifyGreek(tokens);
  const rendered = syllables.map(renderGreekSyllable).join("");
  return applyFinalSigma(rendered).normalize("NFC");
}


/*
// Test examples
const examples = [
  "logos",        // λογος -> λόγος
  "theós",        // θεός
  "kûbos",        // κῦβος  
  "<a>",          // ᾳ (alpha with iota subscript)
  "hê",           // ἡ̂ (eta with rough breathing and circumflex)
  "anthrōpos",    // ἄνθρωπος
];

console.log("Greek transliteration examples:");
for (const example of examples) {
  const result = transliterateGreek(example);
  console.log(`${example} -> ${result}`);
}
*/