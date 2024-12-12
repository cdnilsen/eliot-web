export type stringToStringDict = { 
    [key: string]: string 
};

export type stringToIntDict = {
    [key: string]: number
};

export type intToIntDict = {
    [key: number]: number
}

export type stringToStringListDict = {
    [key: string]: string[]
};

export type stringToIntListDict = {
    [key: string]: number[]
};

export type intToStringDict = {
    [key: number]: string
};

export type intToStringListDict = {
    [key: number]: string[]
};

export type intToIntListDict = {
    [key: number]: number[]
};

export function cleanPunctuation(word: string): string {
    return word.replace(/[\[.,\/#!%\^\*?;:{}=\_`~()\]]/g, '');
}

//This function is an attempt to deal with the macra and tildes that Eliot uses to represent a following nasal
function processEngma(word: string): string {

    let wordCopy = word;
    //These will need to be dealt with manually, but we'll need to do that later
    if (word.endsWith('ŋ')) {
        //let chapterString = chapter.toString();
        //let verseString = verse.toString();
        wordCopy = word.slice(0, -1);
        wordCopy = wordCopy + "Ŋ";
    }
    
    let labialEngmaClusters: string[] = ['ŋb', 'ŋp', 'ŋm', 'ŋf'];

    let replacementClusters: string[] = ['mb', 'mp', 'mm', 'mf'];

    for (let i = 0; i < 4; i++) {
        wordCopy = wordCopy.split(labialEngmaClusters[i]).join(replacementClusters[i]);
    }

    wordCopy = wordCopy.split('ŋ').join('n');

    return wordCopy;
}

export function cleanDiacriticsEngmaMarking(word: string): string {
    let charReplacementDict: stringToStringDict = {
        "á": "a",
        "é": "e",
        "í": "i",
        "ó": "o",
        "ú": "u",
        "à": "a",
        "è": "e",
        "ì": "i",
        "ò": "o",
        "ù": "u",
        "â": "a",
        "ê": "e",
        "î": "i",
        "ô": "o",
        "û": "u",
        "ä": "a",
        "ë": "e",
        "ï": "i",
        "ö": "o",
        "ü": "u",
        "ã": "aŋ",
        "õ": "oŋ",
        "ñ": "nn",
        "m̃": "mm",
        "ũ": "uŋ",
        "ẽ": "eŋ",
        "ĩ": "iŋ",
        "ā": "aŋ",
        "ē": "eŋ",
        "ī": "iŋ",
        "ō": "oŋ",
        "ū": "uŋ"
    };

    let cleanedWord = "";
    for (let i = 0; i < word.length; i++) {
        if (word[i] in charReplacementDict) {
            cleanedWord += charReplacementDict[word[i]];
        } else {
            cleanedWord += word[i];
        }
    }
    return processEngma(cleanedWord);
}

export function getIntersectionAndUnion(list1: any[], list2: any[]) {

    let set1 = new Set(list1);
    let set2 = new Set(list2);

    let intersection = [...set1].filter(item => set2.has(item));
    let list1Only = [...set1].filter(item => !set2.has(item));
    let list2Only = [...set2].filter(item => !set1.has(item));

    let finalDict = {
    intersection: intersection, 
    list1Only: list1Only,
    list2Only: list2Only };

    return finalDict;
}

export function laxifyWordData(wordList: string[], countDict: stringToIntDict) {

    let laxWordList: string[] = [];
    let laxCountDict: stringToIntDict = {};

    for (let i=0; i < wordList.length; i++) {
        let word = wordList[i];
        let count = countDict[word];

        let laxWord = cleanDiacriticsEngmaMarking(word);

        if (laxCountDict[laxWord] === undefined) {
            laxCountDict[laxWord] = count;
            laxWordList.push(laxWord);
        } else {
            laxCountDict[laxWord] += count;
        }
    }
    return {laxWordList: laxWordList, laxCountDict: laxCountDict};
}