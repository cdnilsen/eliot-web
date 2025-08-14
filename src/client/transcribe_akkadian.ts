type S2SDict = {
    [key: string]: string
}

export function AkkadianDiacriticify(str: string, isASCII: boolean): string {
    if (isASCII) {
        let ASCII2DiacriticDict: S2SDict = {
            "aa": "ā",
            "A": "ā",
            "ee": "ē",
            "E": "ē",
            "ii": "ī",
            "I": "ī",
            "uu": "ū",
            "U": "ū",
            "c": "š",
            "S": "ṣ",
            "T": "ṭ",
            "H": "ḫ",
            "h": "ḫ",
            "'": "ʾ"
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