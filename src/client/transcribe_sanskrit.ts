type S2SDict = {
    [key: string]: string
}
export function SanskritDiacriticify(str: string, isASCII: boolean): string {
    if (isASCII) {
        let ASCII2DiacriticDict: S2SDict = {
            "A": "ā",
            "I": "ī",
            "U": "ū",
            "n~": "ñ",
            "R": "ṛ",
            "L": "ḷ",
            "T": "ṭ",
            "D": "ḍ", 
            "S": "ṣ",
            "N": "ṇ",
            "z": "ç",
            "n*": "ṅ",
            "M": "ṃ",
            "H": "ḥ",
            "A'": "ā́",
            "a'": "á",
            "ā'": "ā́",
            "I'": "ī́",
            "i'": "í",
            "ī'": "ī́",
            "U'": "ū́",
            "u'": "ú",
            "R'": "ṛ́",
            "e'": "é",
            "o'": "ó",
            "L'": "ḷ́",
            "RR": "ṝ",
            "RR'": "ṝ́",
            "LL": "ḹ",
            "LL'": "ḹ́"
        }

        let allASCII = Object.keys(ASCII2DiacriticDict);
        allASCII.sort((a, b) => b.length - a.length);

        for (let i=0; i < allASCII.length; i++) {
            let c = allASCII[i];
            str = str.replaceAll(c, ASCII2DiacriticDict[c]);
        }
    }
    return str;
}

export let sanskritChars: string[] = [
    "á", "í", "ú", "ā", "ā́"
]