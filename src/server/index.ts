import express from "express"
import path from "path"
import fs from 'fs'
import session from 'express-session'
import bcrypt from "bcrypt"

import client from './db'
import { wrapAsync } from './utils'
import { Request, Response, NextFunction } from 'express';


declare module 'express-session' {
    interface SessionData {
        authenticated?: boolean;
    }
}

const app = express()
const port = parseInt(process.env.PORT || '3000', 10);

app.listen(port, '0.0.0.0', () => {
    console.log(`Server is running on port ${port}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
});

// The hashed password - you should generate this and store in environment variables
const TEXT_PROCESSING_HASH = '$2b$10$Voh5WI17TJIGvtfRlbrAaOOtaZSNkgZvu5aXupMP2xYnKTWB5BNuu'; // Replace with actual hashed password

const SHAWNEE_HASH = '$2b$10$EDrdbxxX8OC6YJoxfjzyBOc/iQA/vi8Ln4aEvUV/ZU75VP4.ldH16';

// Add this before your routes, but after other middleware like express.static
app.use(express.urlencoded({ extended: true })); // For parsing form data
app.use(express.json()); // For parsing JSON data



app.use(session({
    secret: 'your-secret-key',  // Change this to something secure
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true
    }
}));


// Middleware to check authentication
function requireAuth(req: Request, res: Response, next: NextFunction) {
    if (req.session.authenticated) {
        next();
    } else {
        res.redirect('/login.html');
    }
}


// Login endpoint
app.post('/login', (req, res) => {
    const { password } = req.body;
    
    if (bcrypt.compareSync(password, TEXT_PROCESSING_HASH)) {
        req.session.authenticated = true;
        res.redirect('/processtexts.html');
    } else {
        res.redirect('/processtextslogin.html');
    }
});


// Logout route
app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        res.redirect('/processtextslogin.html');
    });
});

app.get('/processtextslogin.html', requireAuth, (req, res, next) => {
    next();
});

// Make sure these are at the top of your routes
app.use(express.static('public'));
app.use(express.static('.')); // This line is important for serving files from root directory


// Add this endpoint to get list of available text files
app.get('/textfiles', (req, res) => {
    const textFilesDir = path.join(__dirname, '..', 'texts');  // adjust path as needed
    try {
        const files = fs.readdirSync(textFilesDir)
            .filter(file => file.endsWith('.txt'));
        res.json(files);
    } catch (err) {
        res.status(500).json({ error: 'Error reading text files directory' });
    }
});

// Add endpoint to process a specific file
app.post('/process-file', express.json(), wrapAsync(async (req, res) => {
    const { filename } = req.body;
    const textFilesDir = path.join(__dirname, '..', 'texts');
    const filePath = path.join(textFilesDir, filename);
    
    try {
        // Just read and return the file content
        const content = fs.readFileSync(filePath, 'utf8');
        res.json({ 
            status: 'success',
            content: content    // Send the actual file content
        });
    } catch (err) {
        console.error('Error reading file:', err);  // Log the actual error
        res.status(500).json({ error: 'Error reading file', details: err.message });
    }
}));

// Add this helper function
function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}


//Rewrite this when you redesign the db.
app.post('/verses', express.json(), wrapAsync(async (req, res) => {
    const { verseID, text, book, chapter, verse, edition } = req.body;
    
    const validColumns = [
        'first_edition',
        'second_edition', 
        'mayhew',
        'zeroth_edition',
        'kjv',
        'grebrew'
    ];
    
    if (!validColumns.includes(edition)) {
        return res.status(400).json({ error: 'Invalid edition column' });
    }
    
    try {
        // Add delay before the insert
        await delay(150);
        
        const insert = await client.query(
            `INSERT INTO all_verses (verse_id, book, chapter, verse, ${edition}) 
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (verse_id) 
             DO UPDATE SET ${edition} = $5`,
            [verseID, book, chapter, verse, text]
        );
        res.json({ status: 'success', insert });
    } catch (err) {
        console.error('Error inserting verse into ' + edition + ':', err);
        res.status(500).json({ error: 'Error inserting verse', details: err.message });
    }
}));


type VerseWordResult = {
    words: string[];
    counts: number[];
}

type MassWordsTableResult = {
    verses: number[];
    counts: number[];
    editions: number;
}

type MassWordsEditionCountDict = {
    [key: string]: number;
}

type MassWordsCountDict = {
    [key: string]: MassWordsEditionCountDict;
}

type MassWordsCountObject = {
    counts: MassWordsCountDict,
    editions: number
}

type EditionKey = "first" | "second" | "mayhew" | "zeroth";

type MassEditionTable = {
    [K in EditionKey]: number[]
}

type stringToStringDict = {
    [key: string]: string;
}

function zipMassWordsLists(object: MassWordsTableResult): MassWordsCountObject {
    let result: MassWordsCountObject = {
        counts: {
            "first": {},
            "second": {},
            "mayhew": {},
            "zeroth": {}
        },
        editions: object.editions
    };

    const numToEditionTable: Record<string, EditionKey> = {
        "2": "first",
        "3": "second",
        "4": "mayhew",
        "5": "zeroth"
    }

    let editionTable: MassEditionTable = {
        "first": [],
        "second": [],
        "mayhew": [],
        "zeroth": []
    }

    for (let i = 0; i < object.verses.length; i++) {
        let verse = object.verses[i];
        let counts = object.counts[i];

        let verseEdition = numToEditionTable[verse.toString()[0]];
        if (verseEdition) {
            editionTable[verseEdition].push(verse);
            result.counts[verseEdition][verse.toString()] = counts;
        }
    }

    return result;
}

app.get('/verse_words', express.json(), wrapAsync(async (req, res) => {
    const { verseID } = req.query;
    const numericVerseID = parseInt(verseID as string, 10);
    
    try {
        const query = await client.query<VerseWordResult>(
            `SELECT words, counts 
             FROM verses_to_words 
             WHERE verseid = $1`,
            [numericVerseID]
        );
        
        if (query.rows.length === 0) {
            res.json([{ words: [], counts: [] }]);
        } else {
            res.json(query.rows);
        }
    } catch (err) {
        console.error('Error fetching verse words:', err);
        res.json([{ words: [], counts: [] }]);
    }
}));

app.post('/update_mass_word', express.json(), wrapAsync(async (req, res) => {
    const { verseID, words, counts } = req.body;
    const numericVerseID = parseInt(verseID as string, 10);
}));

app.post('/add_mass_word', express.json(), wrapAsync(async (req, res) => {
    const { verseID, words, counts } = req.body;
    const numericVerseID = parseInt(verseID as string, 10);
    const stringVerseID = verseID as string;
    
    try {
        const checkVerse = await client.query(
            'SELECT verseid FROM verses_to_words WHERE verseid = $1',
            [numericVerseID]
        );
        
        const verseExists = (checkVerse.rowCount ?? 0) > 0;

        if (!verseExists) {
            await client.query(
                'INSERT INTO verses_to_words (verseid, words, counts) VALUES ($1, $2, $3)',
                [
                    numericVerseID,
                    `{${words.map((w: string) => `"${w}"`).join(',')}}`,
                    `{${counts.map((c: number) => parseInt(c.toString())).join(',')}}`
                ]
            );
        } else {
            const currentArrays = await client.query<VerseWordResult>(
                'SELECT words, counts FROM verses_to_words WHERE verseid = $1',
                [numericVerseID]
            );
            
            let currentWords = currentArrays.rows[0].words;
            let currentCounts = currentArrays.rows[0].counts;

            words.forEach((word: string, index: number) => {
                const existingIndex = currentWords.indexOf(word);
                if (existingIndex === -1) {
                    currentWords.push(word);
                    currentCounts.push(parseInt(counts[index].toString()));
                } else {
                    currentCounts[existingIndex] += parseInt(counts[index].toString());
                }
            });

            await client.query(
                'UPDATE verses_to_words SET words = $1, counts = $2 WHERE verseid = $3',
                [
                    `{${currentWords.map((w: string) => `"${w}"`).join(',')}}`,
                    `{${currentCounts.join(',')}}`,
                    numericVerseID
                ]
            );

            const editionDict: Record<string, number> = {
                "2": 2,
                "3": 3,
                "4": 5,
                "5": 7
            };
            const editionNum = editionDict[stringVerseID[0]];
    
            // Process all words in parallel
            await Promise.all(words.map(async (word: string, index: number) => {
                const checkWord = await client.query(
                    'SELECT headword FROM words_mass WHERE headword = $1',
                    [word]
                );
    
                const wordExists = (checkWord.rowCount ?? 0) > 0;
                
                if (!wordExists) {
                    await client.query(
                        'INSERT INTO words_mass (headword, verses, counts, editions) VALUES ($1, $2, $3, $4)',
                        [
                            word,
                            `{${numericVerseID}}`,
                            `{${counts[index]}}`,
                            editionNum
                        ]
                    );
                } else {
                    // Update existing word entry
                    await client.query(
                        `UPDATE words_mass 
                         SET verses = array_append(verses, $1),
                             counts = array_append(counts, $2),
                             editions = editions | $3
                         WHERE headword = $4`,
                        [numericVerseID, counts[index], editionNum, word]
                    );
                }
            }));
    
            res.json({ status: 'success' });
        
        }
    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({ status: 'error', error: err.message });
    }
}));

app.post('/remove_mass_word', express.json(), wrapAsync(async (req, res) => {
    const { verseID, words } = req.body;
    const numericVerseID = parseInt(verseID as string, 10);
    
    try {
        const currentArrays = await client.query<VerseWordResult>(
            `SELECT words, counts 
             FROM verses_to_words 
             WHERE verseid = $1`,
            [numericVerseID]
        );
        
        if (currentArrays.rows.length === 0) {
            res.status(404).json({ 
                status: 'error', 
                error: 'Verse not found' 
            });
            return;
        }

        let currentWords = currentArrays.rows[0].words;
        let currentCounts = currentArrays.rows[0].counts;

        words.forEach((word: string) => {
            const index = currentWords.indexOf(word);
            if (index !== -1) {
                currentWords.splice(index, 1);
                currentCounts.splice(index, 1);
            }
        });

        await client.query(
            `UPDATE verses_to_words 
             SET words = $1, counts = $2 
             WHERE verseid = $3`,
            [
                `{${currentWords.map((w: string) => `"${w}"`).join(',')}}`,
                `{${currentCounts.join(',')}}`,
                numericVerseID
            ]
        );

        const MassTableResult = await client.query<MassWordsTableResult>(
            `SELECT verses, counts, editions
             FROM words_mass 
             WHERE word = $1`,
            [numericVerseID]
        );

        if (MassTableResult.rows.length > 0) {
            let existingResults = zipMassWordsLists(MassTableResult.rows[0])

            
        }
        

        res.json({ status: 'success' });
        
    } catch (err) {
        console.error('Error removing words:', err);
        res.status(500).json({ 
            status: 'error', 
            error: 'Error removing words', 
            details: err.message 
        });
    }
}));

app.post('/words_mass', express.json(), wrapAsync(async (req, res) => {
    const { wordDict } = req.body;
    
    try {

    } catch (err) {
    
    
    }
}));

app.get('/matching_verses', express.json(), wrapAsync(async (req, res) => {
    const { addresses } = req.query;
    
    if (!addresses) {
        return res.status(400).json({ status: 'error', error: 'addresses parameter is required' });
    }

    const addressArray = addresses.toString().split(',').map(Number);
    console.log(addressArray);

    try  {
        const query = await client.query(
            `SELECT first_edition, second_edition, mayhew, zeroth_edition, kjv, grebrew
             FROM all_verses 
             WHERE verse_id = ANY($1)`,
            [addresses]
        );
        res.json(query.rows);
    }
    
    catch (err) {
        console.error('Error:', err);
        res.status(500).json({ status: 'error', error: err.message });
    }
}));

app.get('/chapter/:bookID/:chapter', wrapAsync(async (req, res) => {
    const { bookID, chapter } = req.params;
    const { editions } = req.query; // comma-separated list of editions
    
    try {
        const query = await client.query(
            `SELECT book, chapter, verse, ${editions} 
             FROM all_verses 
             WHERE book = $1 AND chapter = $2
             ORDER BY verse`,
            [bookID, chapter]
        );
        
        res.json(query.rows);
    } catch (err) {
        console.error('Error fetching chapter:', err);
        res.status(500).json({ error: 'Error fetching chapter', details: err.message });
    }
}));
// Add these types near your other type definitions
type WordMassResult = {
    headword: string;
    verses: number[];
    counts: number[];
    editions: number;
}

// Add these endpoints after your existing endpoints but before the app.listen call

// Get all words with their verse information
app.get('/words_mass', wrapAsync(async (req, res) => {
    try {
        const query = await client.query<WordMassResult>(
            `SELECT headword, verses, counts, editions 
             FROM words_mass`
        );
        res.json(query.rows);
    } catch (err) {
        console.error('Error fetching words and verses:', err);
        res.status(500).json({ 
            error: 'Error fetching words and verses', 
            details: err.message 
        });
    }
}));

// Get verse information for a specific word
app.get('/words_mass/:word', wrapAsync(async (req, res) => {
    const { word } = req.params;
    
    try {
        const query = await client.query<WordMassResult>(
            `SELECT headword, verses, counts, editions 
             FROM words_mass 
             WHERE headword = $1`,
            [word]
        );
        
        if (query.rows.length === 0) {
            res.status(404).json({ 
                error: 'Word not found' 
            });
            return;
        }
        
        res.json(query.rows[0]);
    } catch (err) {
        console.error('Error fetching word verses:', err);
        res.status(500).json({ 
            error: 'Error fetching word verses', 
            details: err.message 
        });
    }
}));

// Search words with pattern matching
app.get('/search_mass', wrapAsync(async (req, res) => {
    const { pattern, searchType, diacritics } = req.query;
    
    if (!pattern || typeof pattern !== 'string') {
        res.status(400).json({ error: 'Search pattern is required' });
        return;
    }
    
    let searchPattern = pattern.split('*').join('%');
    searchPattern = searchPattern.split('(').join('');
    searchPattern = searchPattern.split(')').join('?');
    
    let queryString = `SELECT headword, verses, counts, editions FROM words_mass WHERE `;
    
    // Handle the search type
    switch (searchType) {
        case 'exact':
            queryString += diacritics === 'lax' 
                ? `LOWER(headword) = LOWER($1)` 
                : `headword = $1`;
            break;
        case 'contains':
            queryString += diacritics === 'lax' 
                ? `LOWER(headword) LIKE LOWER('%' || $1 || '%')` 
                : `headword LIKE '%' || $1 || '%'`;
            break;
        case 'starts':
            queryString += diacritics === 'lax' 
                ? `LOWER(headword) LIKE LOWER($1 || '%')` 
                : `headword LIKE $1 || '%'`;
            break;
        case 'ends':
            queryString += diacritics === 'lax' 
                ? `LOWER(headword) LIKE LOWER('%' || $1)` 
                : `headword LIKE '%' || $1`;
            break;
        default:
            queryString += diacritics === 'lax' 
                ? `LOWER(headword) LIKE LOWER('%' || $1 || '%')` 
                : `headword LIKE '%' || $1 || '%'`;
    }
    
    try {
        const query = await client.query(queryString, [searchPattern]);
        res.json(query.rows);
    } catch (err) {
        console.error('Error searching words:', err);
        res.status(500).json({ 
            error: 'Error searching words', 
            details: err.message 
        });
    }
}));