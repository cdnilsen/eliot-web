export function AkkadianDiacriticify(str, isASCII) {
    if (isASCII) {
        let ASCII2DiacriticDict = {
            "aa": "ā",
            "A": "ā",
            "ee": "ē",
            "E": "ē",
            "ii": "ī",
            "I": "ī",
            "uu": "ū",
            "U": "ū",
            "a^": "â",
            "e^": "ê",
            "i^": "î",
            "u^": "û",
            "c": "š",
            "S": "ṣ",
            "T": "ṭ",
            "H": "ḫ",
            "h": "ḫ",
            "'": "ʾ"
        };
        let allASCII = Object.keys(ASCII2DiacriticDict);
        allASCII.sort((a, b) => b.length - a.length);
        for (let i = 0; i < allASCII.length; i++) {
            let c = allASCII[i];
            str = str.replaceAll(c, ASCII2DiacriticDict[c]);
        }
    }
    return str;
}
export let akkadianSpecialChars = [
    "ā", "ē", "ī", "ū", "â", "ê", "î", "û", "š", "ṣ", "ṭ", "ḫ", "ʾ"
];
//# sourceMappingURL=transcribe_akkadian.js.map