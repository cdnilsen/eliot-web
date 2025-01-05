import express from "express"
import path from "path"
import { Pool } from "pg"

const app = express()
const port = process.env.PORT


// Numerical code for search settings: 2 = is exactly, 3 = contains, 5 = starts with, 7 = ends with. 11 = search in Massachuett, 13 = search in English (only Massachusett right now). 17 = clean the diacritics
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


