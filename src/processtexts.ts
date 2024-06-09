


type Verse = {
    firstText: string,
    secondText: string,
    otherText: string,
    kvjText: string,
    grebrewText: string,
    firstTextHapaxes: string[],
    secondTextHapaxes: string[],
    otherTextHapaxes: string[]
}

type RawBook = {
    verses: Verse[],
    addresses: string[]
}