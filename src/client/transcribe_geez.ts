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

const tokens = [
    // ሀ (ha) series
    {input: ["hä"], internal: "hä", output: "ሀ"},
    {input: ["hu"], internal: "hu", output: "ሁ"},
    {input: ["hi"], internal: "hi", output: "ሂ"},
    {input: ["ha"], internal: "ha", output: "ሃ"},
    {input: ["he"], internal: "he", output: "ሄ"},
    {input: ["h", "hə"], internal: "h", output: "ህ"},
    {input: ["ho"], internal: "ho", output: "ሆ"},

    // ለ (la) series
    {input: ["lä"], internal: "lä", output: "ለ"},
    {input: ["lu"], internal: "lu", output: "ሉ"},
    {input: ["li"], internal: "li", output: "ሊ"},
    {input: ["la"], internal: "la", output: "ላ"},
    {input: ["le"], internal: "le", output: "ሌ"},
    {input: ["l", "lə"], internal: "l", output: "ል"},
    {input: ["lo"], internal: "lo", output: "ሎ"},

    // ሐ (ḥa) series
    {input: ["ḥä"], internal: "ḥä", output: "ሐ"},
    {input: ["ḥu"], internal: "ḥu", output: "ሑ"},
    {input: ["ḥi"], internal: "ḥi", output: "ሒ"},
    {input: ["ḥa"], internal: "ḥa", output: "ሓ"},
    {input: ["ḥe"], internal: "ḥe", output: "ሔ"},
    {input: ["ḥ", "ḥə"], internal: "ḥ", output: "ሕ"},
    {input: ["ḥo"], internal: "ḥo", output: "ሖ"},

    // መ (ma) series
    {input: ["mä"], internal: "mä", output: "መ"},
    {input: ["mu"], internal: "mu", output: "ሙ"},
    {input: ["mi"], internal: "mi", output: "ሚ"},
    {input: ["ma"], internal: "ma", output: "ማ"},
    {input: ["me"], internal: "me", output: "ሜ"},
    {input: ["m", "mə"], internal: "m", output: "ም"},
    {input: ["mo"], internal: "mo", output: "ሞ"},

    // ሠ (śa) series
    {input: ["śä"], internal: "śä", output: "ሠ"},
    {input: ["śu"], internal: "śu", output: "ሡ"},
    {input: ["śi"], internal: "śi", output: "ሢ"},
    {input: ["śa"], internal: "śa", output: "ሣ"},
    {input: ["śe"], internal: "śe", output: "ሤ"},
    {input: ["ś", "śə"], internal: "ś", output: "ሥ"},
    {input: ["śo"], internal: "śo", output: "ሦ"},

    // ረ (ra) series
    {input: ["rä"], internal: "rä", output: "ረ"},
    {input: ["ru"], internal: "ru", output: "ሩ"},
    {input: ["ri"], internal: "ri", output: "ሪ"},
    {input: ["ra"], internal: "ra", output: "ራ"},
    {input: ["re"], internal: "re", output: "ሬ"},
    {input: ["r", "rə"], internal: "r", output: "ር"},
    {input: ["ro"], internal: "ro", output: "ሮ"},

    // ሰ (sa) series
    {input: ["sä"], internal: "sä", output: "ሰ"},
    {input: ["su"], internal: "su", output: "ሱ"},
    {input: ["si"], internal: "si", output: "ሲ"},
    {input: ["sa"], internal: "sa", output: "ሳ"},
    {input: ["se"], internal: "se", output: "ሴ"},
    {input: ["s", "sə"], internal: "s", output: "ስ"},
    {input: ["so"], internal: "so", output: "ሶ"},

    // ቀ (qa) series
    {input: ["qä"], internal: "qä", output: "ቀ"},
    {input: ["qu"], internal: "qu", output: "ቁ"},
    {input: ["qi"], internal: "qi", output: "ቂ"},
    {input: ["qa"], internal: "qa", output: "ቃ"},
    {input: ["qe"], internal: "qe", output: "ቄ"},
    {input: ["q", "qə"], internal: "q", output: "ቅ"},
    {input: ["qo"], internal: "qo", output: "ቆ"},

    // ቈ (qʷa) series - labialized
    {input: ["qʷä"], internal: "qʷä", output: "ቈ"},
    {input: ["qʷi"], internal: "qʷi", output: "ቊ"},
    {input: ["qʷa"], internal: "qʷa", output: "ቋ"},
    {input: ["qʷe"], internal: "qʷe", output: "ቌ"},
    {input: ["qʷ"], internal: "qʷ", output: "ቍ"},

    // በ (ba) series
    {input: ["bä"], internal: "bä", output: "በ"},
    {input: ["bu"], internal: "bu", output: "ቡ"},
    {input: ["bi"], internal: "bi", output: "ቢ"},
    {input: ["ba"], internal: "ba", output: "ባ"},
    {input: ["be"], internal: "be", output: "ቤ"},
    {input: ["b", "bə"], internal: "b", output: "ብ"},
    {input: ["bo"], internal: "bo", output: "ቦ"},

    // ተ (ta) series
    {input: ["tä"], internal: "tä", output: "ተ"},
    {input: ["tu"], internal: "tu", output: "ቱ"},
    {input: ["ti"], internal: "ti", output: "ቲ"},
    {input: ["ta"], internal: "ta", output: "ታ"},
    {input: ["te"], internal: "te", output: "ቴ"},
    {input: ["t", "tə"], internal: "t", output: "ት"},
    {input: ["to"], internal: "to", output: "ቶ"},

    // ኀ (ḫa) series
    {input: ["ḫä"], internal: "ḫä", output: "ኀ"},
    {input: ["ḫu"], internal: "ḫu", output: "ኁ"},
    {input: ["ḫi"], internal: "ḫi", output: "ኂ"},
    {input: ["ḫa"], internal: "ḫa", output: "ኃ"},
    {input: ["ḫe"], internal: "ḫe", output: "ኄ"},
    {input: ["ḫ", "ḫə"], internal: "ḫ", output: "ኅ"},
    {input: ["ḫo"], internal: "ḫo", output: "ኆ"},

    // ኈ (ḫʷa) series - labialized
    {input: ["ḫʷä"], internal: "ḫʷä", output: "ኈ"},
    {input: ["ḫʷi"], internal: "ḫʷi", output: "ኊ"},
    {input: ["ḫʷa"], internal: "ḫʷa", output: "ኋ"},
    {input: ["ḫʷe"], internal: "ḫʷe", output: "ኌ"},
    {input: ["ḫʷ"], internal: "ḫʷ", output: "ኍ"},

    // ነ (na) series
    {input: ["nä"], internal: "nä", output: "ነ"},
    {input: ["nu"], internal: "nu", output: "ኑ"},
    {input: ["ni"], internal: "ni", output: "ኒ"},
    {input: ["na"], internal: "na", output: "ና"},
    {input: ["ne"], internal: "ne", output: "ኔ"},
    {input: ["n", "nə"], internal: "n", output: "ን"},
    {input: ["no"], internal: "no", output: "ኖ"},

    // አ (ʾa) series
    {input: ["ʾä"], internal: "ʾä", output: "አ"},
    {input: ["ʾu"], internal: "ʾu", output: "ኡ"},
    {input: ["ʾi"], internal: "ʾi", output: "ኢ"},
    {input: ["ʾa"], internal: "ʾa", output: "ኣ"},
    {input: ["ʾe"], internal: "ʾe", output: "ኤ"},
    {input: ["ʾ", "ʾə"], internal: "ʾ", output: "እ"},
    {input: ["ʾo"], internal: "ʾo", output: "ኦ"},

    // ከ (ka) series
    {input: ["kä"], internal: "kä", output: "ከ"},
    {input: ["ku"], internal: "ku", output: "ኩ"},
    {input: ["ki"], internal: "ki", output: "ኪ"},
    {input: ["ka"], internal: "ka", output: "ካ"},
    {input: ["ke"], internal: "ke", output: "ኬ"},
    {input: ["k", "kə"], internal: "k", output: "ክ"},
    {input: ["ko"], internal: "ko", output: "ኮ"},

    // ኰ (kʷa) series - labialized
    {input: ["kʷä"], internal: "kʷä", output: "ኰ"},
    {input: ["kʷi"], internal: "kʷi", output: "ኲ"},
    {input: ["kʷa"], internal: "kʷa", output: "ኳ"},
    {input: ["kʷe"], internal: "kʷe", output: "ኴ"},
    {input: ["kʷ"], internal: "kʷ", output: "ኵ"},

    // ወ (wa) series
    {input: ["wä"], internal: "wä", output: "ወ"},
    {input: ["wu"], internal: "wu", output: "ዉ"},
    {input: ["wi"], internal: "wi", output: "ዊ"},
    {input: ["wa"], internal: "wa", output: "ዋ"},
    {input: ["we"], internal: "we", output: "ዌ"},
    {input: ["w", "wə"], internal: "w", output: "ው"},
    {input: ["wo"], internal: "wo", output: "ዎ"},

    // ዐ (ʿa) series
    {input: ["ʿä"], internal: "ʿä", output: "ዐ"},
    {input: ["ʿu"], internal: "ʿu", output: "ዑ"},
    {input: ["ʿi"], internal: "ʿi", output: "ዒ"},
    {input: ["ʿa"], internal: "ʿa", output: "ዓ"},
    {input: ["ʿe"], internal: "ʿe", output: "ዔ"},
    {input: ["ʿ", "ʿə"], internal: "ʿ", output: "ዕ"},
    {input: ["ʿo"], internal: "ʿo", output: "ዖ"},

    // ዘ (za) series
    {input: ["zä"], internal: "zä", output: "ዘ"},
    {input: ["zu"], internal: "zu", output: "ዙ"},
    {input: ["zi"], internal: "zi", output: "ዚ"},
    {input: ["za"], internal: "za", output: "ዛ"},
    {input: ["ze"], internal: "ze", output: "ዜ"},
    {input: ["z", "zə"], internal: "z", output: "ዝ"},
    {input: ["zo"], internal: "zo", output: "ዞ"},

    // የ (ya) series
    {input: ["yä"], internal: "yä", output: "የ"},
    {input: ["yu"], internal: "yu", output: "ዩ"},
    {input: ["yi"], internal: "yi", output: "ዪ"},
    {input: ["ya"], internal: "ya", output: "ያ"},
    {input: ["ye"], internal: "ye", output: "ዬ"},
    {input: ["y", "yə"], internal: "y", output: "ይ"},
    {input: ["yo"], internal: "yo", output: "ዮ"},

    // ደ (da) series
    {input: ["dä"], internal: "dä", output: "ደ"},
    {input: ["du"], internal: "du", output: "ዱ"},
    {input: ["di"], internal: "di", output: "ዲ"},
    {input: ["da"], internal: "da", output: "ዳ"},
    {input: ["de"], internal: "de", output: "ዴ"},
    {input: ["d", "də"], internal: "d", output: "ድ"},
    {input: ["do"], internal: "do", output: "ዶ"},

    // ገ (ga) series
    {input: ["gä"], internal: "gä", output: "ገ"},
    {input: ["gu"], internal: "gu", output: "ጉ"},
    {input: ["gi"], internal: "gi", output: "ጊ"},
    {input: ["ga"], internal: "ga", output: "ጋ"},
    {input: ["ge"], internal: "ge", output: "ጌ"},
    {input: ["g", "gə"], internal: "g", output: "ግ"},
    {input: ["go"], internal: "go", output: "ጎ"},

    // ጐ (gʷa) series - labialized
    {input: ["gʷä"], internal: "gʷä", output: "ጐ"},
    {input: ["gʷi"], internal: "gʷi", output: "ጒ"},
    {input: ["gʷa"], internal: "gʷa", output: "ጓ"},
    {input: ["gʷe"], internal: "gʷe", output: "ጔ"},
    {input: ["gʷ"], internal: "gʷ", output: "ጕ"},

    // ጠ (ṭa) series
    {input: ["ṭä"], internal: "ṭä", output: "ጠ"},
    {input: ["ṭu"], internal: "ṭu", output: "ጡ"},
    {input: ["ṭi"], internal: "ṭi", output: "ጢ"},
    {input: ["ṭa"], internal: "ṭa", output: "ጣ"},
    {input: ["ṭe"], internal: "ṭe", output: "ጤ"},
    {input: ["ṭ", "ṭə"], internal: "ṭ", output: "ጥ"},
    {input: ["ṭo"], internal: "ṭo", output: "ጦ"},

    // ጰ (ṗa) series
    {input: ["ṗä"], internal: "ṗä", output: "ጰ"},
    {input: ["ṗu"], internal: "ṗu", output: "ጱ"},
    {input: ["ṗi"], internal: "ṗi", output: "ጲ"},
    {input: ["ṗa"], internal: "ṗa", output: "ጳ"},
    {input: ["ṗe"], internal: "ṗe", output: "ጴ"},
    {input: ["ṗ"], internal: "ṗ", output: "ጵ"},
    {input: ["ṗo"], internal: "ṗo", output: "ጶ"},

    // ጸ (ṣa) series
    {input: ["ṣä"], internal: "ṣä", output: "ጸ"},
    {input: ["ṣu"], internal: "ṣu", output: "ጹ"},
    {input: ["ṣi"], internal: "ṣi", output: "ጺ"},
    {input: ["ṣa"], internal: "ṣa", output: "ጻ"},
    {input: ["ṣe"], internal: "ṣe", output: "ጼ"},
    {input: ["ṣ", "ṣə"], internal: "ṣ", output: "ጽ"},
    {input: ["ṣo"], internal: "ṣo", output: "ጾ"},

    // ፀ (ḍa) series
    {input: ["ḍä"], internal: "ḍä", output: "ፀ"},
    {input: ["ḍu"], internal: "ḍu", output: "ፁ"},
    {input: ["ḍi"], internal: "ḍi", output: "ፂ"},
    {input: ["ḍa"], internal: "ḍa", output: "ፃ"},
    {input: ["ḍe"], internal: "ḍe", output: "ፄ"},
    {input: ["ḍ"], internal: "ḍ", output: "ፅ"},
    {input: ["ḍo"], internal: "ḍo", output: "ፆ"},

    // ፈ (fa) series
    {input: ["fä"], internal: "fä", output: "ፈ"},
    {input: ["fu"], internal: "fu", output: "ፉ"},
    {input: ["fi"], internal: "fi", output: "ፊ"},
    {input: ["fa"], internal: "fa", output: "ፋ"},
    {input: ["fe"], internal: "fe", output: "ፌ"},
    {input: ["f", "fə"], internal: "f", output: "ፍ"},
    {input: ["fo"], internal: "fo", output: "ፎ"},

    // ፐ (pa) series
    {input: ["pä"], internal: "pä", output: "ፐ"},
    {input: ["pu"], internal: "pu", output: "ፑ"},
    {input: ["pi"], internal: "pi", output: "ፒ"},
    {input: ["pa"], internal: "pa", output: "ፓ"},
    {input: ["pe"], internal: "pe", output: "ፔ"},
    {input: ["p", "pə"], internal: "p", output: "ፕ"},
    {input: ["po"], internal: "po", output: "ፖ"}
];

// Build lookup maps
const geezInputToInternalToken: { [key: string]: string } = {};
const internalToOutput: { [key: string]: string } = {};

for (const token of tokens) {
    for (const inputForm of token.input) {
        geezInputToInternalToken[inputForm] = token.internal;
    }
    internalToOutput[token.internal] = token.output;
}

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

const geezTrie = constructTrie([...Object.keys(geezInputToInternalToken)]);

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

function maximumMunchTokenizeGeez(str: string, trie: TrieNode): ParsedToken[] {
    let strCursor = 0;
    const out: ParsedToken[] = [];
    while (strCursor < str.length) {
        const tokenStr = getNextToken(str, trie, strCursor);
        if (tokenStr === null) {
            out.push({ kind: "unparseable", value: str[strCursor] });
            strCursor += 1;
        } else {
            const token = geezInputToInternalToken[tokenStr];
            if (token === undefined) {
                throw new Error(`Logic error: ${tokenStr} is in trie but is not a valid geez token`);
            }
            out.push({ kind: "token", token: token });
            strCursor += tokenStr.length;
        }
    }
    return out;
}

function renderGeez(token: ParsedToken): string {
    if (token.kind === "unparseable") {
        return token.value || "";
    }
    
    const internal = token.token;
    if (!internal) return "";
    
    return internalToOutput[internal] || "";
}

export function transliterateGeez(str: string): string {
    const tokens = maximumMunchTokenizeGeez(str, geezTrie);
    return tokens.map(renderGeez).join("");
}