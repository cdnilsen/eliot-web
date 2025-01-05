// imports go here

async function wordSearch(searchString: string, searchSetting: number) {

    searchString = searchString.split('*').join('%');

    searchString = searchString.split('(').join('');
    searchString = searchString.split(')').join('?');
    console.log(searchString);

    let table: string = 'words_diacritics';

    let queryString = "SELECT * FROM " + table + " WHERE "

    let wordString = "word";
    if (searchSetting % 17 == 0) {
        wordString = "corresponding_word";
    }

    if (searchSetting % 2 == 0) { // is exactly
        queryString += wordString + " SIMILAR TO $1::text"
    } else if (searchSetting % 3 == 0) { // contains (placeholder)
        queryString += wordString + " SIMILAR TO '%'||$1||'%'"
    } else if (searchSetting % 5 == 0) { // starts with
        queryString +=wordString +  " SIMILAR TO $1||'%'"
    } else if (searchSetting % 7 == 0) { //  ends with
        queryString += wordString + " SIMILAR TO '%'||$1" 
    }

    //let allQuery = await pool.query(queryString, [searchString]);

    //return allQuery.rows;
}



let submitButton = document.getElementById("submitButton");

submitButton?.addEventListener("click", async () => {
    let searchSetting = 1;
    let searchInput = document.getElementById("search_bar") as HTMLInputElement;
    let searchInputValue = searchInput.value;
    let isExactly = document.getElementById("isExactly") as HTMLInputElement;
    let contains = document.getElementById("contains") as HTMLInputElement;
    let startsWith = document.getElementById("beginsWith") as HTMLInputElement;
    let endsWith = document.getElementById("endsWith") as HTMLInputElement;
    let laxDiacritics = document.getElementById("diacriticsLax") as HTMLInputElement;

    if (isExactly?.checked) {
        searchSetting *= 2;
    }
    if (contains?.checked) {
        searchSetting *= 3;
    }
    if (startsWith?.checked) {
        searchSetting *= 5;
    }
    if (endsWith?.checked) {
        searchSetting *= 7;
    }
    if (laxDiacritics?.checked) {
        searchSetting *= 17;
    }


    console.log(searchInputValue);
    console.log(searchSetting);
})