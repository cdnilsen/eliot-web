import express from "express"
import path from "path"
import fs from 'fs'
import session from 'express-session'
import bcrypt from "bcrypt"
import client from './db'
import { wrapAsync } from './utils'
import { Request, Response, NextFunction } from 'express';
import { rescheduleCards, getSchedulingStats } from './scheduler';
import { CronJob } from 'cron';

import multer from 'multer';
//import { convertUploadedFiles } from './anki-synapdeck-converter';


declare module 'express-session' {
    interface SessionData {
        authenticated?: boolean;
    }
}

// Add these interfaces at the top of the file
interface CardRow {
    card_id: number;
    last_reviewed?: Date | string | null;
    created: Date | string;
    stability: number | null;
    old_retrievability: number; // This is required since we select it with alias
    retrievability?: number; // This is optional for debug queries
    deck?: string;
    interval?: number;
}

// Add these interfaces for date shuffling
interface ShuffleDueDatesRequest {
    deck: string;
    days_span: number;
    base_date: string;
    include_overdue: boolean;
}

interface ShuffleDueDatesResponse {
    status: 'success' | 'error';
    updated_count?: number;
    total_cards_found?: number;
    deck?: string;
    days_span?: number;
    base_date?: string;
    date_range?: {
        start_date: string;
        end_date: string;
    };
    operation_time?: string;
    average_old_due_days?: number;
    average_new_due_days?: number;
    duration_seconds?: number;
    error?: string;
    details?: string;
}

// Add this interface to your backend index.ts
interface ReviewForecastRequest {
    decks?: string[];  // If empty/undefined, return all decks
    days_ahead?: number;  // Default to 14 days
    start_date?: string;  // ISO date string, defaults to today
}

interface ReviewForecastResponse {
    status: 'success' | 'error';
    forecast_data?: Array<{
        date: string;  // YYYY-MM-DD format
        [deck: string]: number | string;  // deck name -> count, plus the date
    }>;
    decks?: string[];  // List of deck names included
    date_range?: {
        start_date: string;
        end_date: string;
    };
    total_reviews?: number;
    error?: string;
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

//hello!

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

// Add this type definition at the top with your other types
type WordKJVResult = {
    headword: string;
    verses: number[];
    counts: number[];
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

    const cleanAddresses = addresses.toString().trim().split(',').map(str => str.trim());
    const addressArray = cleanAddresses.map(str => BigInt(str));

    try {
        // First, let's check if these IDs exist
        const checkQuery = await client.query(`
            SELECT verse_id 
            FROM all_verses 
            WHERE verse_id IN (${addressArray.map(String).join(',')})
        `);
        console.log("Existing verse IDs:", checkQuery.rows);

        // Then run the full query
        const queryText = `
            SELECT verse_id, first_edition, second_edition, mayhew, zeroth_edition, kjv, grebrew, book, chapter, verse
            FROM all_verses 
            WHERE verse_id = ANY($1::bigint[])
            ORDER BY verse_id`;
            
        const queryParams = [addressArray.map(String)];
        console.log("Final query params:", queryParams);

        const query = await client.query(queryText, queryParams);
        console.log("Final results length:", query.rows.length);
        console.log("Final results:", query.rows);

        res.json(query.rows);
    } catch (err) {
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

app.get('/search_mass', wrapAsync(async (req, res) => {
    const { pattern, searchType, diacritics } = req.query;
    console.log(diacritics);
    
    if (!pattern || typeof pattern !== 'string') {
        res.status(400).json({ error: 'Search pattern is required' });
        return;
    }
    
    let searchPattern = pattern.split('*').join('%');
    searchPattern = searchPattern.split('(').join('');
    searchPattern = searchPattern.split(')').join('?');
    
    const column = diacritics === 'lax' ? 'no_diacritics' : 'headword';
    const searchValue = diacritics === 'lax' ? 'LOWER($1)' : '$1';
    
    let queryString = `SELECT headword, verses, counts, editions`;
    if (diacritics === 'lax') {
        queryString += `, no_diacritics`;
    }
    queryString += ` FROM words_mass WHERE ${column}`;
    
    // Map search types to their SQL patterns
    const patterns = {
        'exact': ` = ${searchValue}`,
        'contains': ` LIKE '%' || ${searchValue} || '%'`,
        'starts': ` LIKE ${searchValue} || '%'`,
        'ends': ` LIKE '%' || ${searchValue}`
    } as const;
    
    const sqlPattern = patterns[searchType as keyof typeof patterns] ?? patterns.contains;
    queryString += sqlPattern;
    
    try {
        const query = await client.query(queryString, [searchPattern]);
        res.json(query.rows);
    } catch (err) {
        console.error('Error searching words:', err);
        res.status(500).json({ 
            error: 'Error searching words', 
            details: err instanceof Error ? err.message : 'Unknown error' 
        });
    }
}));

app.get('/search_kjv', wrapAsync(async (req, res) => {
    const { pattern, searchType } = req.query;
    
    if (!pattern || typeof pattern !== 'string') {
        res.status(400).json({ error: 'Search pattern is required' });
        return;
    }
    
    // Process the search pattern similar to Mass search
    let searchPattern = pattern.split('*').join('%');
    searchPattern = searchPattern.split('(').join('');
    searchPattern = searchPattern.split(')').join('?');
    
    let queryString = `
        SELECT 
            word as headword, 
            verses,
            array_fill(1, ARRAY[array_length(verses, 1)]) as counts  -- Create an array of 1s same length as verses
        FROM words_kjv 
        WHERE LOWER(word)`;
    
    // Map search types to their SQL patterns
    const patterns = {
        'exact': ` = LOWER($1)`,
        'contains': ` LIKE '%' || LOWER($1) || '%'`,
        'starts': ` LIKE LOWER($1) || '%'`,
        'ends': ` LIKE '%' || LOWER($1)`
    } as const;
    
    const sqlPattern = patterns[searchType as keyof typeof patterns] ?? patterns.contains;
    queryString += sqlPattern;
    
    try {
        const query = await client.query(queryString, [searchPattern]);
        
        // Add debugging logs
        console.log('Search pattern:', searchPattern);
        console.log('Search type:', searchType);
        console.log('Query:', queryString);
        console.log('Results count:', query.rows.length);
        
        res.json(query.rows);
    } catch (err) {
        console.error('Error searching KJV words:', err);
        res.status(500).json({ 
            error: 'Error searching words', 
            details: err instanceof Error ? err.message : 'Unknown error' 
        });
    }
}));

app.post('/add_synapdeck_note', express.json(), wrapAsync(async (req, res) => {
    const { 
        deck, 
        note_type, 
        field_names, 
        field_values, 
        field_processing, 
        card_configs,
        timeCreated,
        initial_interval_ms = 86400000, // Default to 24 hours (1 day) if not provided
        wipe_database = false // Add flag to control database wiping
    } = req.body;
    
    console.log('Raw request data:', JSON.stringify(req.body, null, 2));
    
    // Get a dedicated client for this transaction
    const transactionClient = await client.connect();

    const baseTime = new Date(timeCreated);
    const dueDate = new Date(baseTime.getTime() + initial_interval_ms);
    
    try {
        await transactionClient.query('BEGIN');
        console.log('Transaction started on dedicated connection');
        
        // ===== DEBUG: DATABASE WIPE SUBROUTINE (COMMENT OUT WHEN NOT NEEDED) =====
        if (wipe_database) {
            console.log('🧹 WIPING DATABASE FOR DEBUG...');
            
            // Delete in order to respect foreign key constraints
            await transactionClient.query('DELETE FROM cards');
            console.log('  ✓ Cleared cards table');
            
            await transactionClient.query('DELETE FROM notes');
            console.log('  ✓ Cleared notes table');
            
            // Reset auto-increment sequences if you're using them
            await transactionClient.query('ALTER SEQUENCE IF EXISTS notes_note_id_seq RESTART WITH 1');
            await transactionClient.query('ALTER SEQUENCE IF EXISTS cards_card_id_seq RESTART WITH 1');
            console.log('  ✓ Reset ID sequences');
            
            console.log('🧹 Database wipe complete!');
        }
        // ===== END DEBUG SUBROUTINE =====
        
        // Calculate due date and interval
        const intervalDays = Math.ceil(initial_interval_ms / (1000 * 60 * 60 * 24)); // Convert ms to days
        
        console.log(`Due date calculated: ${dueDate.toISOString()}, Interval: ${intervalDays} days`);
        
        // Format the data
        const fieldNamesArray = Array.isArray(field_names) ? field_names : [];
        const fieldValuesArray = Array.isArray(field_values) ? field_values : [];
        
        console.log('Inserting note...');
        const noteResult = await transactionClient.query(
            `INSERT INTO notes (deck, note_type, field_names, field_values, created_at) 
             VALUES ($1, $2, $3, $4, $5) 
             RETURNING note_id`,
            [deck, note_type, fieldNamesArray, fieldValuesArray, timeCreated]
        );
        
        console.log('Note insert result:', noteResult.rows);
        
        if (!noteResult.rows || noteResult.rows.length === 0) {
            throw new Error('Note insert returned no rows');
        }
        
        const noteId = noteResult.rows[0].note_id;
        console.log('Got note_id:', noteId);
        
        // Verify the note exists IN THE SAME TRANSACTION
        const verifyResult = await transactionClient.query(
            'SELECT note_id FROM notes WHERE note_id = $1', 
            [noteId]
        );
        console.log('Verification result:', verifyResult.rows);
        
        if (verifyResult.rows.length === 0) {
            throw new Error(`Note ${noteId} was not found after insert in same transaction`);
        }
        
        // Proceed with cards using the same connection
        const cardIds: number[] = [];
        
        if (card_configs && card_configs.length > 0) {
            console.log(`Proceeding with ${card_configs.length} cards for note_id ${noteId}`);
            
            for (let i = 0; i < card_configs.length; i++) {
                const config = card_configs[i];
                
                // Each card can have its own interval, or inherit from the note
                const cardIntervalMs = config.initial_interval_ms || initial_interval_ms;
                const cardDueDate = new Date(baseTime.getTime() + cardIntervalMs);  // ← Add this line
                const cardIntervalDays = Math.ceil(cardIntervalMs / (1000 * 60 * 60 * 24));
                console.log("Card interval: " + cardIntervalDays.toString())
                const cardResult = await transactionClient.query(
                    `INSERT INTO cards (note_id, deck, card_format, field_names, field_values, field_processing, time_due, interval, retrievability, created) 
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
                     RETURNING card_id`,
                    [
                        noteId,
                        deck,
                        config.card_format || null,
                        config.field_names || null,
                        config.field_values || null,
                        config.field_processing || null,
                        cardDueDate,
                        cardIntervalDays,
                        null,
                        timeCreated
                    ]
                );
                cardIds.push(cardResult.rows[0].card_id);
                console.log(`Inserted card ${cardResult.rows[0].card_id} with due date: ${cardDueDate.toISOString()}`);
            }
            
            // Update peers using the same connection
            for (let i = 0; i < cardIds.length; i++) {
                const peers = cardIds.filter((_, index) => index !== i);
                if (peers.length > 0) {
                    await transactionClient.query(
                        `UPDATE cards SET peers = $1 WHERE card_id = $2`,
                        [peers, cardIds[i]]
                    );
                }
            }
        }
        
        await transactionClient.query('COMMIT');
        console.log('Transaction committed successfully');
        
        res.json({ 
            status: 'success', 
            note_id: noteId,
            card_ids: cardIds,
            due_date: dueDate.toISOString(),
            interval_days: intervalDays,
            message: `Success: note ${noteId} with ${cardIds.length} cards, due ${dueDate.toISOString()}` 
        });
        
    } catch (err) {
        await transactionClient.query('ROLLBACK');
        console.error('Transaction rolled back:', err);
        res.status(500).json({ 
            status: 'error', 
            error: err.message,
            details: err instanceof Error ? err.message : 'Unknown error' 
        });
    } finally {
        // Always release the connection back to the pool
        transactionClient.release();
    }
}));

// Add a separate endpoint for wiping the database during debugging
app.post('/wipe_synapdeck_database', express.json(), wrapAsync(async (req, res) => {
    console.log('🧹 WIPING SYNAPDECK DATABASE FOR DEBUG...');
    
    const transactionClient = await client.connect();
    
    try {
        await transactionClient.query('BEGIN');
        
        // Delete in order to respect foreign key constraints
        await transactionClient.query('DELETE FROM cards');
        console.log('  ✓ Cleared cards table');
        
        await transactionClient.query('DELETE FROM notes');
        console.log('  ✓ Cleared notes table');
        
        // Reset auto-increment sequences if you're using them
        await transactionClient.query('ALTER SEQUENCE IF EXISTS notes_note_id_seq RESTART WITH 1');
        await transactionClient.query('ALTER SEQUENCE IF EXISTS cards_card_id_seq RESTART WITH 1');
        console.log('  ✓ Reset ID sequences');
        
        await transactionClient.query('COMMIT');
        console.log('🧹 Database wipe complete!');
        
        res.json({ 
            status: 'success', 
            message: 'Database wiped successfully' 
        });
        
    } catch (err) {
        await transactionClient.query('ROLLBACK');
        console.error('Database wipe failed:', err);
        res.status(500).json({ 
            status: 'error', 
            error: err.message 
        });
    } finally {
        transactionClient.release();
    }
}));


// Enhanced backend endpoint that handles review ahead
app.post('/check_cards_available', express.json(), wrapAsync(async (req, res) => {
    const { deck, current_time, actual_current_time, review_ahead, days_ahead, target_date } = req.body;
    
    if (!deck) {
        return res.status(400).json({ 
            status: 'error', 
            error: 'Deck name is required' 
        });
    }
    
    // Use provided times
    const checkTime = current_time ? new Date(current_time) : new Date();
    const actualCurrentTime = actual_current_time ? new Date(actual_current_time) : new Date();
    const targetDateTime = target_date ? new Date(target_date) : new Date();

    console.log('Testing simple query...');
    const testQuery = await client.query(
        'SELECT COUNT(*) as count FROM cards WHERE deck = $1',
        [deck]
    );
    console.log('Simple query result:', testQuery.rows);

    console.log('Request body:', req.body);
    console.log('Deck:', deck);
    console.log('Check time (midnight of target day):', checkTime.toISOString());
    console.log('Target date:', targetDateTime.toDateString());
    console.log('Actual current time:', actualCurrentTime.toISOString());
    
    const modeText = review_ahead ? 
        `cards due by midnight of ${targetDateTime.toDateString()} (${days_ahead || 1} days ahead)` : 
        'cards due by midnight today';
    console.log(`Checking cards for deck: ${deck} - Mode: ${modeText}`);
    
    try {
        const allCards = await client.query(
            `SELECT card_id, time_due, deck FROM cards WHERE deck = $1 ORDER BY time_due`, [deck]
        );
        
        console.log(`DEBUG: Found ${allCards.rows.length} total cards in deck "${deck}":`);
        allCards.rows.forEach(card => {
            console.log(`  Card ${card.card_id}: due ${card.time_due}`);
        });
        
        console.log(`DEBUG: Looking for cards where time_due <= ${checkTime.toISOString()}`);
        console.log(`DEBUG: Current actual time: ${actualCurrentTime.toISOString()}`);

        const query = await client.query(
            `SELECT 
                card_id,
                note_id,
                deck,
                card_format,
                field_names,
                field_values,
                field_processing,
                time_due,
                interval,
                retrievability,
                peers,
                CASE 
                    WHEN time_due <= $3 THEN 'due_now'
                    ELSE 'due_ahead'
                END as due_status
            FROM cards 
            WHERE deck = $1 
            AND time_due <= $2
            AND (is_buried = false OR is_buried IS NULL)  -- Exclude buried cards
            ORDER BY time_due ASC`,
            [deck, checkTime, actualCurrentTime]
        );
        
        const dueNow = query.rows.filter(card => card.due_status === 'due_now');
        const dueAhead = query.rows.filter(card => card.due_status === 'due_ahead');
        
        console.log(`Found ${query.rows.length} cards total (${dueNow.length} due now, ${dueAhead.length} due ahead by target date)`);
        
        res.json({
            status: 'success',
            cards: query.rows,
            total_due: query.rows.length,
            due_now_count: dueNow.length,
            due_ahead_count: dueAhead.length,
            deck: deck,
            checked_at: checkTime.toISOString(),
            target_date: targetDateTime.toISOString(),
            review_ahead: review_ahead || false,
            days_ahead: days_ahead || 0
        });
        
    } catch (err) {
        console.error('Error checking available cards:', err);
        res.status(500).json({
            status: 'error',
            error: 'Error checking available cards',
            details: err instanceof Error ? err.message : 'Unknown error'
        });
    }
}));

// Additional endpoint to get deck statistics
app.get('/deck_stats/:deckName', wrapAsync(async (req, res) => {
    const { deckName } = req.params;
    const now = new Date();
    
    try {
        // Get various statistics about the deck
        const totalCards = await client.query(
            'SELECT COUNT(*) as count FROM cards WHERE deck = $1',
            [deckName]
        );
        
        const dueNow = await client.query(
            'SELECT COUNT(*) as count FROM cards WHERE deck = $1 AND time_due <= $2',
            [deckName, now]
        );
        
        const dueToday = await client.query(
            'SELECT COUNT(*) as count FROM cards WHERE deck = $1 AND time_due <= $2',
            [deckName, new Date(now.getTime() + 24 * 60 * 60 * 1000)]
        );
        
        const averageInterval = await client.query(
            'SELECT AVG(interval) as avg_interval FROM cards WHERE deck = $1',
            [deckName]
        );
        
        res.json({
            status: 'success',
            deck: deckName,
            stats: {
                total_cards: parseInt(totalCards.rows[0].count),
                due_now: parseInt(dueNow.rows[0].count),
                due_today: parseInt(dueToday.rows[0].count),
                average_interval: parseFloat(averageInterval.rows[0].avg_interval || '0')
            }
        });
        
    } catch (err) {
        console.error('Error getting deck stats:', err);
        res.status(500).json({
            status: 'error',
            error: 'Error getting deck statistics',
            details: err instanceof Error ? err.message : 'Unknown error'
        });
    }
}));

// Add this interface near your other type definitions at the top
interface MarkCardsRequest {
    card_ids: number[];
}

interface MarkCardsResponse {
    status: 'success' | 'error';
    updated_count?: number;
    card_ids?: number[];
    error?: string;
}

// Add this endpoint after your existing endpoints but before the app.listen call
app.post('/mark_cards_under_review', express.json(), wrapAsync(async (req, res) => {
    const { card_ids }: MarkCardsRequest = req.body;
    
    if (!card_ids || !Array.isArray(card_ids) || card_ids.length === 0) {
        return res.json({
            status: 'error',
            error: 'No card IDs provided or invalid format'
        } as MarkCardsResponse);
    }
    
    // Validate that all card_ids are numbers
    const validCardIds = card_ids.filter(id => typeof id === 'number' && !isNaN(id));
    if (validCardIds.length !== card_ids.length) {
        return res.json({
            status: 'error',
            error: 'Invalid card IDs provided - must be numbers'
        } as MarkCardsResponse);
    }
    
    console.log(`📝 Marking ${validCardIds.length} cards as under review:`, validCardIds);
    
    const transactionClient = await client.connect();
    
    try {
        await transactionClient.query('BEGIN');
        
        // Create placeholders for the SQL query
        const placeholders = validCardIds.map((_, index) => `$${index + 1}`).join(',');
        const query = `UPDATE cards SET under_review = true WHERE card_id IN (${placeholders})`;
        
        // Execute the update query
        const result = await transactionClient.query(query, validCardIds);
        
        await buryPeerCards(validCardIds, transactionClient);

        const updatedCount = result.rowCount || 0;
        
        await transactionClient.query('COMMIT');
        
        console.log(`✅ Successfully marked ${updatedCount} cards as under review`);
        
        res.json({
            status: 'success',
            updated_count: updatedCount,
            card_ids: validCardIds
        } as MarkCardsResponse);
        
    } catch (error) {
        await transactionClient.query('ROLLBACK');
        console.error('❌ Error marking cards under review:', error);
        res.json({
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        } as MarkCardsResponse);
    } finally {
        transactionClient.release();
    }
}));



// Add interface for flexible reset options
interface ResetCardsRequest {
    deck?: string;  // Optional - if provided, reset only this deck
    all?: boolean;  // Optional - if true, reset all cards on the table
}

// Reset cards under review - either by deck or all cards
app.post('/reset_cards_under_review', express.json(), wrapAsync(async (req, res) => {
    const { deck, all }: ResetCardsRequest = req.body;
    
    // Validate parameters
    if (!deck && !all) {
        return res.json({
            status: 'error',
            error: 'Either "deck" name or "all: true" parameter is required'
        } as MarkCardsResponse);
    }
    
    if (deck && all) {
        return res.json({
            status: 'error',
            error: 'Cannot specify both "deck" and "all" parameters - choose one'
        } as MarkCardsResponse);
    }
    
    const resetScope = all ? 'all cards' : `deck "${deck}"`;
    console.log(`🔄 Resetting all cards under review in: ${resetScope}`);
    
    const transactionClient = await client.connect();
    
    try {
        await transactionClient.query('BEGIN');
        
        let cardIdsQuery;
        let updateQuery;
        let queryParams: any[];
        
        if (all) {
            // Reset all cards in the entire table
            cardIdsQuery = await transactionClient.query(
                'SELECT card_id, deck FROM cards WHERE under_review = true ORDER BY deck, card_id'
            );
            
            updateQuery = 'UPDATE cards SET under_review = false WHERE under_review = true';
            queryParams = [];
        } else {
            // Reset cards only in the specified deck
            cardIdsQuery = await transactionClient.query(
                'SELECT card_id FROM cards WHERE deck = $1 AND under_review = true',
                [deck]
            );
            
            updateQuery = 'UPDATE cards SET under_review = false WHERE deck = $1 AND under_review = true';
            queryParams = [deck];
        }
        
        const cardInfo = cardIdsQuery.rows;
        const cardIds = cardInfo.map(row => row.card_id);
        
        console.log(`Found ${cardIds.length} cards under review in ${resetScope}:`, cardIds);
        
        if (all && cardInfo.length > 0) {
            // Log deck breakdown when resetting all cards
            const deckCounts = cardInfo.reduce((acc: {[key: string]: number}, row) => {
                acc[row.deck] = (acc[row.deck] || 0) + 1;
                return acc;
            }, {});
            console.log('Cards by deck:', deckCounts);
        }
        
        // Execute the update
        const result = await transactionClient.query(updateQuery, queryParams);
        const updatedCount = result.rowCount || 0;
        
        await transactionClient.query('COMMIT');
        
        console.log(`🔄 Reset ${updatedCount} cards from under review in ${resetScope}`);
        
        res.json({
            status: 'success',
            updated_count: updatedCount,
            card_ids: cardIds,
            scope: all ? 'all' : 'deck',
            deck: deck || undefined
        } as MarkCardsResponse & { scope: string; deck?: string });
        
    } catch (error) {
        await transactionClient.query('ROLLBACK');
        console.error('❌ Error resetting cards under review:', error);
        res.json({
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        } as MarkCardsResponse);
    } finally {
        transactionClient.release();
    }
}));


// Add this interface near your other type definitions
interface CardsUnderReviewResponse {
    status: 'success' | 'error';
    cards?: any[]; // Use any[] since we're just passing raw DB data
    total_count?: number;
    deck?: string;
    error?: string;
}

// Add this endpoint to get cards under review for a specific deck
app.get('/cards_under_review/:deckName', wrapAsync(async (req, res) => {
    const { deckName } = req.params;
    
    if (!deckName) {
        return res.status(400).json({
            status: 'error',
            error: 'Deck name is required'
        } as CardsUnderReviewResponse);
    }
    
    console.log(`🔍 Getting cards under review for deck: ${deckName}`);
    
    try {
        const query = await client.query(
            `SELECT 
                card_id,
                note_id,
                deck,
                card_format,
                field_names,
                field_values,
                field_processing,
                time_due,
                interval,
                retrievability,
                peers,
                created
            FROM cards 
            WHERE deck = $1 AND under_review = true
            ORDER BY card_id ASC`,
            [deckName]
        );
        
        console.log(`Found ${query.rows.length} cards under review in deck "${deckName}"`);
        
        res.json({
            status: 'success',
            cards: query.rows,
            total_count: query.rows.length,
            deck: deckName
        } as CardsUnderReviewResponse);
        
    } catch (err) {
        console.error('Error getting cards under review:', err);
        res.status(500).json({
            status: 'error',
            error: 'Error getting cards under review',
            details: err instanceof Error ? err.message : 'Unknown error'
        } as CardsUnderReviewResponse);
    }
}));


// Get all review sessions for a deck
app.get('/review_sessions/:deckName', wrapAsync(async (req, res) => {
    const { deckName } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    
    try {
        const sessions = await client.query(
            `SELECT 
                session_id,
                deck,
                started_at,
                completed_at,
                max_cards_requested,
                cards_presented,
                cards_completed,
                pass_count,
                hard_count,
                fail_count,
                session_status,
                review_ahead_hours,
                notes
             FROM review_sessions 
             WHERE deck = $1
             ORDER BY started_at DESC
             LIMIT $2 OFFSET $3`,
            [deckName, limit, offset]
        );
        
        res.json({
            status: 'success',
            sessions: sessions.rows,
            deck: deckName
        });
        
    } catch (err) {
        console.error('Error fetching review sessions:', err);
        res.status(500).json({
            status: 'error',
            error: 'Error fetching review sessions',
            details: err instanceof Error ? err.message : 'Unknown error'
        });
    }
}));

// Get detailed information about a specific session
app.get('/review_session/:sessionId', wrapAsync(async (req, res) => {
    const { sessionId } = req.params;
    
    try {
        // Get session info
        const sessionQuery = await client.query(
            `SELECT * FROM review_sessions WHERE session_id = $1`,
            [sessionId]
        );
        
        if (sessionQuery.rows.length === 0) {
            return res.status(404).json({
                status: 'error',
                error: 'Session not found'
            });
        }
        
        // Get card reviews for this session
        const cardReviewsQuery = await client.query(
            `SELECT 
                scr.*,
                c.deck,
                c.card_format,
                c.field_values
             FROM session_card_reviews scr
             JOIN cards c ON scr.card_id = c.card_id
             WHERE scr.session_id = $1
             ORDER BY scr.presented_at`,
            [sessionId]
        );
        
        res.json({
            status: 'success',
            session: sessionQuery.rows[0],
            card_reviews: cardReviewsQuery.rows
        });
        
    } catch (err) {
        console.error('Error fetching session details:', err);
        res.status(500).json({
            status: 'error',
            error: 'Error fetching session details',
            details: err instanceof Error ? err.message : 'Unknown error'
        });
    }
}));

// Get session statistics for a deck
app.get('/deck_session_stats/:deckName', wrapAsync(async (req, res) => {
    const { deckName } = req.params;
    const { days = 30 } = req.query; // Default to last 30 days
    
    try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - parseInt(days as string));
        
        // Get session statistics
        const statsQuery = await client.query(
            `SELECT 
                COUNT(*) as total_sessions,
                COUNT(CASE WHEN session_status = 'completed' THEN 1 END) as completed_sessions,
                SUM(cards_completed) as total_cards_reviewed,
                SUM(pass_count) as total_pass,
                SUM(hard_count) as total_hard,
                SUM(fail_count) as total_fail,
                AVG(cards_completed) as avg_cards_per_session,
                MIN(started_at) as first_session,
                MAX(started_at) as last_session
             FROM review_sessions 
             WHERE deck = $1 AND started_at >= $2`,
            [deckName, cutoffDate]
        );
        
        // Get daily session counts
        const dailyStatsQuery = await client.query(
            `SELECT 
                DATE(started_at) as session_date,
                COUNT(*) as sessions_count,
                SUM(cards_completed) as cards_reviewed
             FROM review_sessions 
             WHERE deck = $1 AND started_at >= $2
             GROUP BY DATE(started_at)
             ORDER BY session_date DESC`,
            [deckName, cutoffDate]
        );
        
        const stats = statsQuery.rows[0];
        
        // Calculate pass rate
        const totalGraded = parseInt(stats.total_pass || 0) + parseInt(stats.total_hard || 0) + parseInt(stats.total_fail || 0);
        const passRate = totalGraded > 0 ? (parseInt(stats.total_pass || 0) / totalGraded * 100) : 0;
        
        res.json({
            status: 'success',
            deck: deckName,
            period_days: parseInt(days as string),
            stats: {
                ...stats,
                pass_rate_percent: Math.round(passRate * 100) / 100,
                total_graded: totalGraded
            },
            daily_breakdown: dailyStatsQuery.rows
        });
        
    } catch (err) {
        console.error('Error fetching deck session stats:', err);
        res.status(500).json({
            status: 'error',
            error: 'Error fetching deck session statistics',
            details: err instanceof Error ? err.message : 'Unknown error'
        });
    }
}));

// Add these interfaces near your other type definitions in index.ts
interface CreateSessionRequest {
    deck: string;
    max_cards_requested: number;
    review_ahead_hours?: number;
    card_ids: number[]; // The cards that will be presented
}

interface CreateSessionResponse {
    status: 'success' | 'error';
    session_id?: number;
    deck?: string;
    cards_count?: number;
    error?: string;
    details?: string;
}

// First, add these interfaces to your index.ts if you haven't already
interface ReviewResult {
    cardId: number;
    result: 'pass' | 'hard' | 'fail';
}

interface SubmitReviewResultsRequest {
    results: ReviewResult[];
    deck: string;
    session_id?: number; // Optional - will create a new session if not provided
    reviewedAt?: string;
}

interface SubmitReviewResultsResponse {
    status: 'success' | 'error';
    processed_count?: number;
    updated_cards?: number[];
    review_timestamp?: string;
    session_id?: number;
    error?: string;
    details?: string;
}


// Add this endpoint to your index.ts file (before the app.listen call)
app.post('/create_review_session', express.json(), wrapAsync(async (req, res) => {
    const { deck, max_cards_requested, review_ahead_hours = 0, card_ids }: CreateSessionRequest = req.body;
    
    if (!deck || !max_cards_requested || !card_ids || !Array.isArray(card_ids)) {
        return res.json({
            status: 'error',
            error: 'Missing required fields: deck, max_cards_requested, and card_ids array'
        } as CreateSessionResponse);
    }
    
    console.log(`📝 Creating review session for deck "${deck}" with ${card_ids.length} cards`);
    
    const transactionClient = await client.connect();
    
    try {
        await transactionClient.query('BEGIN');
        
        // Create the review session
        const sessionResult = await transactionClient.query(
            `INSERT INTO review_sessions (deck, max_cards_requested, review_ahead_hours, cards_presented, session_status)
             VALUES ($1, $2, $3, $4, 'in_progress')
             RETURNING session_id`,
            [deck, max_cards_requested, review_ahead_hours, card_ids.length]
        );
        
        const sessionId = sessionResult.rows[0].session_id;
        console.log(`Created session ${sessionId}`);
        
        // Get current card data and insert session_card_reviews records
        if (card_ids.length > 0) {
            const placeholders = card_ids.map((_, index) => `$${index + 1}`).join(',');
            const cardsData = await transactionClient.query(
                `SELECT card_id, interval, retrievability FROM cards WHERE card_id IN (${placeholders})`,
                card_ids
            );
            
            // Insert a record for each card presented
            for (const cardData of cardsData.rows) {
                await transactionClient.query(
                    `INSERT INTO session_card_reviews (session_id, card_id, interval_before, retrievability_before)
                     VALUES ($1, $2, $3, $4)`,
                    [sessionId, cardData.card_id, cardData.interval, cardData.retrievability]
                );
            }
            
            console.log(`Added ${cardsData.rows.length} cards to session ${sessionId}`);
        }
        
        await transactionClient.query('COMMIT');
        
        res.json({
            status: 'success',
            session_id: sessionId,
            deck: deck,
            cards_count: card_ids.length
        } as CreateSessionResponse);
        
    } catch (error) {
        await transactionClient.query('ROLLBACK');
        console.error('❌ Error creating review session:', error);
        res.json({
            status: 'error',
            error: 'Error creating review session',
            details: error instanceof Error ? error.message : 'Unknown error'
        } as CreateSessionResponse);
    } finally {
        transactionClient.release();
    }
}));

// Replace your current submit_review_results endpoint with this updated version:
app.post('/submit_review_results', express.json(), wrapAsync(async (req, res) => {
    console.log('🚀 NEW ENDPOINT CALLED - submit_review_results with FSRS');
    
    const { results, deck, session_id, reviewedAt }: SubmitReviewResultsRequest = req.body;
    
    console.log(`📝 Received ${results?.length || 0} review results for deck "${deck}" (session: ${session_id || 'none'})`);
    
    // Validation
    if (!results || !Array.isArray(results) || results.length === 0) {
        return res.json({
            status: 'error',
            error: 'No review results provided or invalid format'
        } as SubmitReviewResultsResponse);
    }
    
    if (!deck) {
        return res.json({
            status: 'error',
            error: 'Deck name is required'
        } as SubmitReviewResultsResponse);
    }
    
    const validResults = results.filter(result => 
        result.cardId && 
        typeof result.cardId === 'number' && 
        ['pass', 'hard', 'fail'].includes(result.result)
    );
    
    if (validResults.length !== results.length) {
        return res.json({
            status: 'error',
            error: 'Invalid review results format'
        } as SubmitReviewResultsResponse);
    }
    
    const reviewTimestamp = reviewedAt ? new Date(reviewedAt) : new Date();
    const transactionClient = await client.connect();
    
    try {
        await transactionClient.query('BEGIN');
        console.log('✅ Transaction started');
        
        // Get current card data for FSRS scheduling
        const cardIds = validResults.map(r => Number(r.cardId));
        console.log('🔍 Fetching card data for FSRS scheduling:', cardIds);
        
        const currentCardsQuery = await transactionClient.query(
            `SELECT card_id, time_due, interval, retrievability, stability, difficulty, deck
             FROM cards 
             WHERE deck = $1 AND card_id = ANY($2::int[])`,
            [deck, cardIds]
        );
        
        console.log(`📦 Found ${currentCardsQuery.rows.length} cards for FSRS scheduling`);
        
        if (currentCardsQuery.rows.length !== validResults.length) {
            throw new Error(`Expected ${validResults.length} cards, but found ${currentCardsQuery.rows.length} in database`);
        }
        
        // Prepare data for FSRS scheduler
        const cardsForScheduler = currentCardsQuery.rows.map(dbCard => {
            const reviewResult = validResults.find(r => r.cardId === dbCard.card_id);
            
            // Ensure we have a valid grade - this should never be undefined due to our validation above
            if (!reviewResult || !['pass', 'hard', 'fail'].includes(reviewResult.result)) {
                throw new Error(`Invalid or missing grade for card ${dbCard.card_id}`);
            }
            
            return {
                card_id: dbCard.card_id,
                deck: dbCard.deck,
                current_time_due: dbCard.time_due,
                current_interval: dbCard.interval,
                current_retrievability: dbCard.retrievability,
                current_stability: dbCard.stability,
                current_difficulty: dbCard.difficulty,
                grade: reviewResult.result as 'pass' | 'hard' | 'fail', // Type assertion since we validated above
                reviewed_at: reviewTimestamp
            };
        });
        
        // Call FSRS scheduler
        console.log('🔄 Calling FSRS scheduler...');
        const scheduledCards = await rescheduleCards(cardsForScheduler, reviewTimestamp);
        
        // Log scheduling statistics
        const stats = getSchedulingStats(scheduledCards);
        console.log('📊 FSRS Scheduling statistics:', stats);
        
        // Update cards with FSRS scheduling results
        const updatedCardIds: number[] = [];
        
        for (const scheduledCard of scheduledCards) {
            const updateResult = await transactionClient.query(
                `UPDATE cards 
                 SET time_due = $1, 
                     interval = $2, 
                     retrievability = $3,
                     stability = $4,
                     difficulty = $5,
                     under_review = false,
                     last_reviewed = $6
                 WHERE card_id = $7`,
                [
                    scheduledCard.new_time_due,
                    scheduledCard.new_interval,
                    scheduledCard.new_retrievability,
                    scheduledCard.new_stability,
                    scheduledCard.new_difficulty,
                    reviewTimestamp,
                    scheduledCard.card_id
                ]
            );
            
            if (updateResult.rowCount && updateResult.rowCount > 0) {
                updatedCardIds.push(scheduledCard.card_id);
                console.log(`✅ Updated card ${scheduledCard.card_id} with FSRS scheduling`);
            } else {
                console.log(`⚠️ Failed to update card ${scheduledCard.card_id}`);
            }
        }
        
        // Update session tracking if session_id provided
        let finalSessionId = session_id;
        
        if (session_id) {
            console.log(`📊 Updating session ${session_id}`);
            
            // Count grades
            const gradeCounts = validResults.reduce((acc, result) => {
                acc[result.result] = (acc[result.result] || 0) + 1;
                return acc;
            }, {} as { [key: string]: number });
            
            // Update the session
            await transactionClient.query(
                `UPDATE review_sessions 
                 SET completed_at = $1,
                     cards_completed = $2,
                     pass_count = $3,
                     hard_count = $4,
                     fail_count = $5,
                     session_status = 'completed'
                 WHERE session_id = $6`,
                [
                    reviewTimestamp,
                    validResults.length,
                    gradeCounts.pass || 0,
                    gradeCounts.hard || 0,
                    gradeCounts.fail || 0,
                    session_id
                ]
            );
            
            // Update session_card_reviews with FSRS results
            for (const result of validResults) {
                const scheduledCard = scheduledCards.find(sc => sc.card_id === result.cardId);
                if (scheduledCard) {
                    await transactionClient.query(
                        `UPDATE session_card_reviews 
                         SET reviewed_at = $1,
                             grade = $2,
                             interval_after = $3,
                             retrievability_after = $4
                         WHERE session_id = $5 AND card_id = $6`,
                        [
                            reviewTimestamp,
                            result.result,
                            scheduledCard.new_interval,
                            scheduledCard.new_retrievability,
                            session_id,
                            result.cardId
                        ]
                    );
                }
            }
            
            console.log(`✅ Updated session ${session_id} with FSRS results`);
        } else {
            // Create a minimal session record for these results (fallback)
            console.log(`📊 Creating minimal session record`);
            const newSessionResult = await transactionClient.query(
                `INSERT INTO review_sessions (deck, started_at, completed_at, max_cards_requested, cards_presented, cards_completed, session_status)
                 VALUES ($1, $2, $2, $3, $3, $3, 'completed')
                 RETURNING session_id`,
                [deck, reviewTimestamp, validResults.length]
            );
            finalSessionId = newSessionResult.rows[0].session_id;
            console.log(`✅ Created fallback session ${finalSessionId}`);
        }
        
        await transactionClient.query('COMMIT');
        console.log('✅ Transaction committed successfully with FSRS scheduling');
        
        res.json({
            status: 'success',
            processed_count: updatedCardIds.length,
            updated_cards: updatedCardIds,
            review_timestamp: reviewTimestamp.toISOString(),
            session_id: finalSessionId,
            deck: deck,
            scheduling_stats: stats,
            message: `Successfully applied FSRS scheduling to ${updatedCardIds.length} cards`
        } as SubmitReviewResultsResponse & { scheduling_stats: any[]; message: string });
        
    } catch (error) {
        await transactionClient.query('ROLLBACK');
        console.error('❌ Error processing review results with FSRS:', error);
        res.json({
            status: 'error',
            error: 'Error processing review results',
            details: error instanceof Error ? error.message : 'Unknown error occurred'
        } as SubmitReviewResultsResponse);
    } finally {
        transactionClient.release();
        console.log('🔄 Transaction client released');
    }
}));

// Add these complete endpoints to your index.ts file after your existing endpoints

interface BrowseCardsQuery {
    deck?: string;
    search_term?: string;
    card_format?: string;
    sort_by?: string;
    sort_direction?: 'asc' | 'desc';
    limit?: string;
    offset?: string;
}

// Enhanced card browsing endpoint with search, filtering, and pagination
app.get('/browse_cards', wrapAsync(async (req, res) => {
    const {
        deck,
        search_term,
        card_format,
        sort_by = 'card_id',
        sort_direction = 'asc',
        limit = '50',
        offset = '0'
    }: BrowseCardsQuery = req.query;

    const limitNum = Math.min(parseInt(limit) || 50, 200); // Cap at 200 for performance
    const offsetNum = parseInt(offset) || 0;

    console.log(`Browsing cards with filters:`, {
        deck,
        search_term,
        card_format,
        sort_by,
        sort_direction,
        limit: limitNum,
        offset: offsetNum
    });

    try {
        // Build WHERE clause conditions
        const conditions: string[] = [];
        const queryParams: any[] = [];
        let paramIndex = 1;

        // Deck filter
        if (deck && deck.trim()) {
            conditions.push(`deck = $${paramIndex}`);
            queryParams.push(deck.trim());
            paramIndex++;
        }

        // Card format filter
        if (card_format && card_format.trim()) {
            conditions.push(`card_format = $${paramIndex}`);
            queryParams.push(card_format.trim());
            paramIndex++;
        }

        // Search term filter (search in field_values array)
        if (search_term && search_term.trim()) {
            // Search across all field values using array operations
            conditions.push(`EXISTS (
                SELECT 1 FROM unnest(field_values) AS field_value 
                WHERE LOWER(field_value) LIKE LOWER($${paramIndex})
            )`);
            queryParams.push(`%${search_term.trim()}%`);
            paramIndex++;
        }

        // Build WHERE clause
        const whereClause = conditions.length > 0 
            ? `WHERE ${conditions.join(' AND ')}`
            : '';

        // Validate and sanitize sort parameters
        const validSortColumns = [
            'card_id', 
            'time_due', 
            'interval', 
            'retrievability', 
            'created',
            'deck',
            'card_format'
        ];
        
        const sortColumn = validSortColumns.includes(sort_by) ? sort_by : 'card_id';
        const sortDir = sort_direction === 'desc' ? 'DESC' : 'ASC';

        // Main query to get cards
        const cardsQuery = `
            SELECT 
                card_id,
                note_id,
                deck,
                card_format,
                field_names,
                field_values,
                field_processing,
                time_due,
                interval,
                retrievability,
                stability,
                difficulty,
                peers,
                under_review,
                last_reviewed,
                created
            FROM cards
            ${whereClause}
            ORDER BY ${sortColumn} ${sortDir}
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;

        // Count query for pagination
        const countQuery = `
            SELECT COUNT(*) as total_count
            FROM cards
            ${whereClause}
        `;

        // Add limit and offset to query params
        queryParams.push(limitNum, offsetNum);

        console.log('Cards query:', cardsQuery);
        console.log('Query params:', queryParams);

        // Execute both queries
        const [cardsResult, countResult] = await Promise.all([
            client.query(cardsQuery, queryParams),
            client.query(countQuery, queryParams.slice(0, -2)) // Remove limit and offset for count
        ]);

        const cards = cardsResult.rows;
        const totalCount = parseInt(countResult.rows[0].total_count) || 0;

        console.log(`Found ${cards.length} cards (${totalCount} total)`);

        // Return response
        res.json({
            status: 'success',
            cards: cards,
            total_count: totalCount,
            filters_applied: {
                deck: deck || undefined,
                search_term: search_term || undefined,
                card_format: card_format || undefined,
                sort_by: sortColumn,
                sort_direction: sortDir.toLowerCase()
            },
            pagination: {
                limit: limitNum,
                offset: offsetNum,
                total_pages: Math.ceil(totalCount / limitNum),
                current_page: Math.floor(offsetNum / limitNum)
            }
        });

    } catch (err) {
        console.error('Error browsing cards:', err);
        res.status(500).json({
            status: 'error',
            error: 'Error browsing cards',
            details: err instanceof Error ? err.message : 'Unknown error'
        });
    }
}));

// Get detailed information about a specific card
app.get('/card/:cardId', wrapAsync(async (req, res) => {
    const { cardId } = req.params;
    const cardIdNum = parseInt(cardId);

    if (isNaN(cardIdNum)) {
        return res.status(400).json({
            status: 'error',
            error: 'Invalid card ID'
        });
    }

    try {
        const query = await client.query(
            `SELECT 
                c.*,
                n.note_type,
                n.created_at as note_created_at
             FROM cards c
             LEFT JOIN notes n ON c.note_id = n.note_id
             WHERE c.card_id = $1`,
            [cardIdNum]
        );

        if (query.rows.length === 0) {
            return res.status(404).json({
                status: 'error',
                error: 'Card not found'
            });
        }

        res.json({
            status: 'success',
            card: query.rows[0]
        });

    } catch (err) {
        console.error('Error fetching card details:', err);
        res.status(500).json({
            status: 'error',
            error: 'Error fetching card details',
            details: err instanceof Error ? err.message : 'Unknown error'
        });
    }
}));

// Get statistics about all decks
app.get('/deck_statistics', wrapAsync(async (req, res) => {
    try {
        const query = await client.query(`
            SELECT 
                deck,
                COUNT(*) as total_cards,
                COUNT(CASE WHEN time_due <= NOW() THEN 1 END) as cards_due_now,
                COUNT(CASE WHEN time_due <= NOW() + INTERVAL '1 day' THEN 1 END) as cards_due_today,
                COUNT(CASE WHEN under_review = true THEN 1 END) as cards_under_review,
                AVG(interval) as avg_interval,
                AVG(retrievability) as avg_retrievability,
                MIN(created) as first_card_created,
                MAX(created) as last_card_created
            FROM cards
            GROUP BY deck
            ORDER BY deck
        `);

        const statistics = query.rows.map(row => ({
            ...row,
            total_cards: parseInt(row.total_cards),
            cards_due_now: parseInt(row.cards_due_now),
            cards_due_today: parseInt(row.cards_due_today),
            cards_under_review: parseInt(row.cards_under_review),
            avg_interval: parseFloat(row.avg_interval || '0').toFixed(1),
            avg_retrievability: parseFloat(row.avg_retrievability || '0').toFixed(3)
        }));

        res.json({
            status: 'success',
            deck_statistics: statistics
        });

    } catch (err) {
        console.error('Error fetching deck statistics:', err);
        res.status(500).json({
            status: 'error',
            error: 'Error fetching deck statistics',
            details: err instanceof Error ? err.message : 'Unknown error'
        });
    }
}));

// Update card endpoint (for editing functionality)
app.put('/card/:cardId', express.json(), wrapAsync(async (req, res) => {
    const { cardId } = req.params;
    const cardIdNum = parseInt(cardId);
    
    if (isNaN(cardIdNum)) {
        return res.status(400).json({
            status: 'error',
            error: 'Invalid card ID'
        });
    }

    const { 
        field_values, 
        field_processing, 
        card_format,
        time_due,
        interval,
        retrievability 
    } = req.body;

    // Validate required fields
    if (!field_values || !Array.isArray(field_values)) {
        return res.status(400).json({
            status: 'error',
            error: 'field_values is required and must be an array'
        });
    }

    const transactionClient = await client.connect();
    
    try {
        await transactionClient.query('BEGIN');
        
        // Check if card exists
        const existingCard = await transactionClient.query(
            'SELECT card_id, note_id FROM cards WHERE card_id = $1',
            [cardIdNum]
        );
        
        if (existingCard.rows.length === 0) {
            await transactionClient.query('ROLLBACK');
            return res.status(404).json({
                status: 'error',
                error: 'Card not found'
            });
        }

        // Build update query dynamically based on provided fields
        const updateFields: string[] = [];
        const updateValues: any[] = [];
        let paramIndex = 1;

        if (field_values) {
            updateFields.push(`field_values = $${paramIndex}`);
            updateValues.push(field_values);
            paramIndex++;
        }

        if (field_processing) {
            updateFields.push(`field_processing = $${paramIndex}`);
            updateValues.push(field_processing);
            paramIndex++;
        }

        if (card_format) {
            updateFields.push(`card_format = $${paramIndex}`);
            updateValues.push(card_format);
            paramIndex++;
        }

        if (time_due) {
            updateFields.push(`time_due = $${paramIndex}`);
            updateValues.push(new Date(time_due));
            paramIndex++;
        }

        if (interval !== undefined) {
            updateFields.push(`interval = $${paramIndex}`);
            updateValues.push(interval);
            paramIndex++;
        }

        if (retrievability !== undefined) {
            updateFields.push(`retrievability = $${paramIndex}`);
            updateValues.push(retrievability);
            paramIndex++;
        }

        if (updateFields.length === 0) {
            await transactionClient.query('ROLLBACK');
            return res.status(400).json({
                status: 'error',
                error: 'No valid fields provided for update'
            });
        }

        // Add card_id to the end of updateValues
        updateValues.push(cardIdNum);

        const updateQuery = `
            UPDATE cards 
            SET ${updateFields.join(', ')}
            WHERE card_id = $${paramIndex}
            RETURNING *
        `;

        const result = await transactionClient.query(updateQuery, updateValues);
        
        await transactionClient.query('COMMIT');
        
        res.json({
            status: 'success',
            card: result.rows[0],
            message: `Card ${cardIdNum} updated successfully`
        });
        
    } catch (err) {
        await transactionClient.query('ROLLBACK');
        console.error('Error updating card:', err);
        res.status(500).json({
            status: 'error',
            error: 'Error updating card',
            details: err instanceof Error ? err.message : 'Unknown error'
        });
    } finally {
        transactionClient.release();
    }
}));

// Delete card endpoint
app.delete('/card/:cardId', wrapAsync(async (req, res) => {
    const { cardId } = req.params;
    const cardIdNum = parseInt(cardId);
    
    if (isNaN(cardIdNum)) {
        return res.status(400).json({
            status: 'error',
            error: 'Invalid card ID'
        });
    }

    const transactionClient = await client.connect();
    
    try {
        await transactionClient.query('BEGIN');
        
        // Check if card exists and get its info
        const existingCard = await transactionClient.query(
            'SELECT card_id, note_id, deck, peers FROM cards WHERE card_id = $1',
            [cardIdNum]
        );
        
        if (existingCard.rows.length === 0) {
            await transactionClient.query('ROLLBACK');
            return res.status(404).json({
                status: 'error',
                error: 'Card not found'
            });
        }

        const card = existingCard.rows[0];
        
        // Remove this card from peers' peer lists
        if (card.peers && card.peers.length > 0) {
            for (const peerId of card.peers) {
                await transactionClient.query(
                    `UPDATE cards 
                     SET peers = array_remove(peers, $1) 
                     WHERE card_id = $2`,
                    [cardIdNum, peerId]
                );
            }
        }

        // Delete the card
        await transactionClient.query(
            'DELETE FROM cards WHERE card_id = $1',
            [cardIdNum]
        );
        
        // Check if this was the last card for the note
        const remainingCards = await transactionClient.query(
            'SELECT COUNT(*) as count FROM cards WHERE note_id = $1',
            [card.note_id]
        );
        
        let noteDeleted = false;
        if (parseInt(remainingCards.rows[0].count) === 0) {
            // Delete the note if no cards remain
            await transactionClient.query(
                'DELETE FROM notes WHERE note_id = $1',
                [card.note_id]
            );
            noteDeleted = true;
        }
        
        await transactionClient.query('COMMIT');
        
        res.json({
            status: 'success',
            message: `Card ${cardIdNum} deleted successfully`,
            note_deleted: noteDeleted,
            card_id: cardIdNum,
            note_id: card.note_id
        });
        
    } catch (err) {
        await transactionClient.query('ROLLBACK');
        console.error('Error deleting card:', err);
        res.status(500).json({
            status: 'error',
            error: 'Error deleting card',
            details: err instanceof Error ? err.message : 'Unknown error'
        });
    } finally {
        transactionClient.release();
    }
}));

// FSRS Retrievability calculation function
function calculateRetrievability(daysSinceLastReview: number, stability: number): number {
    // FSRS formula: R(t, S) = (1 + FACTOR × t/S)^DECAY
    const FACTOR = 19 / 81; // ≈ 0.2346
    const DECAY = -0.5;
    
    if (stability <= 0) {
        return 0; // Avoid division by zero
    }
    
    const retrievability = Math.pow(1 + FACTOR * (daysSinceLastReview / stability), DECAY);
    
    // Clamp between 0 and 1
    return Math.max(0, Math.min(1, retrievability));
}


// Function to update all card retrievabilities
async function updateAllCardRetrievabilities(): Promise<void> {
    console.log('🕛 Starting midnight retrievability update...');
    
    const transactionClient = await client.connect();
    
    try {
        await transactionClient.query('BEGIN');
        
        // Get ALL cards, including those with NULL stability (new cards)
        const cardsQuery = await transactionClient.query<CardRow>(`
            SELECT 
                card_id,
                last_reviewed,
                created,
                stability,
                retrievability as old_retrievability
            FROM cards
            ORDER BY card_id
        `);
        
        console.log(`📊 Found ${cardsQuery.rows.length} cards to update`);
        
        const now = new Date();
        let updateCount = 0;
        let significantChangeCount = 0;
        
        for (const card of cardsQuery.rows) {
            let newRetrievability: number;
            
            if (card.stability === null || card.stability === undefined) {
                // New card that has never been reviewed
                // For new cards, retrievability should decay from 1.0 based on time since creation
                const daysSinceCreation = Math.max(0, (now.getTime() - new Date(card.created).getTime()) / (1000 * 60 * 60 * 24));
                
                // Use a default "learning" stability for new cards (typically 1 day)
                const learningStability = 1.0;
                newRetrievability = calculateRetrievability(daysSinceCreation, learningStability);
                
                console.log(`📝 New card ${card.card_id}: ${daysSinceCreation.toFixed(2)} days old, retrievability: ${(newRetrievability * 100).toFixed(1)}%`);
            } else {
                // Reviewed card with established stability
                const referenceDate = card.last_reviewed ? new Date(card.last_reviewed) : new Date(card.created);
                const daysSinceReference = Math.max(0, (now.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24));
                
                newRetrievability = calculateRetrievability(daysSinceReference, card.stability);
                
                if (daysSinceReference > 0 && Math.abs(newRetrievability - card.old_retrievability) > 0.01) {
                    console.log(`🔄 Card ${card.card_id}: ${daysSinceReference.toFixed(2)} days, stability=${card.stability}, ${(card.old_retrievability * 100).toFixed(1)}% → ${(newRetrievability * 100).toFixed(1)}%`);
                }
            }
            
            // Check if there's a significant change
            const changePercent = Math.abs(newRetrievability - card.old_retrievability) * 100;
            if (changePercent > 1) {
                significantChangeCount++;
            }
            
            // Update the card's retrievability
            await transactionClient.query(
                'UPDATE cards SET retrievability = $1 WHERE card_id = $2',
                [newRetrievability, card.card_id]
            );
            
            updateCount++;
            
            if (updateCount % 1000 === 0) {
                console.log(`  📈 Updated ${updateCount}/${cardsQuery.rows.length} cards`);
            }
        }
        
        await transactionClient.query('COMMIT');
        
        console.log(`✅ Midnight retrievability update completed:`);
        console.log(`   📊 Total cards updated: ${updateCount}`);
        console.log(`   📉 Cards with significant change (>1%): ${significantChangeCount}`);
        console.log(`   ⏰ Completed at: ${now.toISOString()}`);
        
    } catch (error) {
        await transactionClient.query('ROLLBACK');
        console.error('❌ Error during midnight retrievability update:', error);
        throw error;
    } finally {
        transactionClient.release();
    }
}
// Function to get statistics about retrievability distribution
async function getRetrievabilityStats(): Promise<void> {
    try {
        const statsQuery = await client.query(`
            SELECT 
                deck,
                COUNT(*) as total_cards,
                AVG(retrievability) as avg_retrievability,
                MIN(retrievability) as min_retrievability,
                MAX(retrievability) as max_retrievability,
                COUNT(CASE WHEN retrievability < 0.5 THEN 1 END) as cards_below_50_percent,
                COUNT(CASE WHEN retrievability < 0.8 THEN 1 END) as cards_below_80_percent,
                COUNT(CASE WHEN retrievability >= 0.9 THEN 1 END) as cards_above_90_percent
            FROM cards
            GROUP BY deck
            ORDER BY deck
        `);
        
        console.log('\n📊 Current Retrievability Statistics by Deck:');
        console.log('─'.repeat(80));
        
        for (const row of statsQuery.rows) {
            console.log(`\n🃏 Deck: ${row.deck}`);
            console.log(`   Total Cards: ${row.total_cards}`);
            console.log(`   Average Retrievability: ${(row.avg_retrievability * 100).toFixed(1)}%`);
            console.log(`   Range: ${(row.min_retrievability * 100).toFixed(1)}% - ${(row.max_retrievability * 100).toFixed(1)}%`);
            console.log(`   Cards < 50%: ${row.cards_below_50_percent} (${((row.cards_below_50_percent / row.total_cards) * 100).toFixed(1)}%)`);
            console.log(`   Cards < 80%: ${row.cards_below_80_percent} (${((row.cards_below_80_percent / row.total_cards) * 100).toFixed(1)}%)`);
            console.log(`   Cards ≥ 90%: ${row.cards_above_90_percent} (${((row.cards_above_90_percent / row.total_cards) * 100).toFixed(1)}%)`);
        }
        
        // Overall statistics
        const overallQuery = await client.query(`
            SELECT 
                COUNT(*) as total_cards,
                AVG(retrievability) as avg_retrievability,
                STDDEV(retrievability) as stddev_retrievability
            FROM cards
        `);
        
        const overall = overallQuery.rows[0];
        console.log(`\n🌐 Overall Statistics:`);
        console.log(`   Total Cards: ${overall.total_cards}`);
        console.log(`   Average Retrievability: ${(overall.avg_retrievability * 100).toFixed(1)}%`);
        console.log(`   Standard Deviation: ${(overall.stddev_retrievability * 100).toFixed(1)}%`);
        console.log('─'.repeat(80));
        
    } catch (error) {
        console.error('❌ Error getting retrievability stats:', error);
    }
}

// Create cron job to run every day at midnight
const midnightRetrievabilityJob = new CronJob(
    '0 0 * * *', // Run at 00:00 (midnight) every day
    async () => {
        try {
            await updateAllCardRetrievabilities();
            await unburyDailyBuriedCards();
            
            // Show stats after update (optional - comment out if too verbose)
            // await getRetrievabilityStats();
            
        } catch (error) {
            console.error('❌ Midnight retrievability job failed:', error);
        }
    },
    null, // onComplete
    false, // start immediately? (false = don't start yet)
    'America/New_York' // timezone - adjust to your timezone
);

// Alternative cron job for testing - runs every 5 minutes (comment out for production)
const testRetrievabilityJob = new CronJob(
    '*/5 * * * *', // Run every 5 minutes
    async () => {
        console.log('🧪 Running test retrievability update...');
        try {
            await updateAllCardRetrievabilities();
        } catch (error) {
            console.error('❌ Test retrievability job failed:', error);
        }
    },
    null,
    false,
    'America/New_York'
);


// API endpoint to manually trigger retrievability update
app.post('/update_retrievability', express.json(), wrapAsync(async (req, res) => {
    console.log('🔄 Manual retrievability update triggered');
    
    try {
        const startTime = Date.now();
        await updateAllCardRetrievabilities();
        const endTime = Date.now();
        const duration = (endTime - startTime) / 1000;
        
        res.json({
            status: 'success',
            message: 'Retrievability update completed successfully',
            duration_seconds: duration,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Manual retrievability update failed:', error);
        res.status(500).json({
            status: 'error',
            error: 'Failed to update retrievability',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}));

// Debug endpoint to check card states and retrievability calculation
app.get('/debug_retrievability/:cardId?', wrapAsync(async (req, res) => {
    const { cardId } = req.params;
    
    try {
        let query;
        let params: any[] = [];
        
        if (cardId) {
            query = `
                SELECT 
                    card_id,
                    last_reviewed,
                    created,
                    stability,
                    retrievability,
                    deck,
                    interval
                FROM cards 
                WHERE card_id = $1
            `;
            params = [parseInt(cardId)];
        } else {
            query = `
                SELECT 
                    card_id,
                    last_reviewed,
                    created,
                    stability,
                    retrievability,
                    deck,
                    interval
                FROM cards 
                ORDER BY created DESC
                LIMIT 10
            `;
        }
        
        const result = await client.query<CardRow>(query, params);
        const now = new Date();
        
        const debugInfo = result.rows.map(card => {
            const referenceDate = card.last_reviewed ? new Date(card.last_reviewed) : new Date(card.created);
            const daysSinceReference = Math.max(0, (now.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24));
            
            let effectiveStability = card.stability;
            if (!effectiveStability || effectiveStability <= 0) {
                effectiveStability = 1.0;
            }
            
            const calculatedRetrievability = calculateRetrievability(daysSinceReference, effectiveStability);
            const storedRetrievability = card.retrievability || 1.0; // Default to 1.0 if undefined
            
            return {
                card_id: card.card_id,
                deck: card.deck,
                created: card.created,
                last_reviewed: card.last_reviewed,
                reference_date: referenceDate.toISOString(),
                days_since_reference: daysSinceReference.toFixed(2),
                stability: card.stability,
                effective_stability: effectiveStability,
                stored_retrievability: storedRetrievability,
                calculated_retrievability: calculatedRetrievability,
                retrievability_difference: (calculatedRetrievability - storedRetrievability).toFixed(4),
                interval: card.interval
            };
        });
        
        res.json({
            status: 'success',
            current_time: now.toISOString(),
            debug_info: debugInfo
        });
        
    } catch (error) {
        console.error('❌ Error in debug retrievability:', error);
        res.status(500).json({
            status: 'error',
            error: 'Failed to debug retrievability',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}));

app.get('/retrievability_stats', wrapAsync(async (req, res) => {
    try {
        // Get deck statistics
        const deckStatsQuery = await client.query(`
            SELECT 
                deck,
                COUNT(*) as total_cards,
                AVG(retrievability) as avg_retrievability,
                MIN(retrievability) as min_retrievability,
                MAX(retrievability) as max_retrievability,
                COUNT(CASE WHEN retrievability < 0.5 THEN 1 END) as cards_below_50_percent,
                COUNT(CASE WHEN retrievability < 0.8 THEN 1 END) as cards_below_80_percent,
                COUNT(CASE WHEN retrievability >= 0.9 THEN 1 END) as cards_above_90_percent
            FROM cards
            GROUP BY deck
            ORDER BY deck
        `);
        
        // Get overall statistics
        const overallQuery = await client.query(`
            SELECT 
                COUNT(*) as total_cards,
                AVG(retrievability) as avg_retrievability,
                STDDEV(retrievability) as stddev_retrievability,
                MIN(retrievability) as min_retrievability,
                MAX(retrievability) as max_retrievability
            FROM cards
        `);
        
        res.json({
            status: 'success',
            deck_statistics: deckStatsQuery.rows.map(row => ({
                ...row,
                total_cards: parseInt(row.total_cards),
                avg_retrievability: parseFloat(row.avg_retrievability || '0'),
                min_retrievability: parseFloat(row.min_retrievability || '0'),
                max_retrievability: parseFloat(row.max_retrievability || '0'),
                cards_below_50_percent: parseInt(row.cards_below_50_percent),
                cards_below_80_percent: parseInt(row.cards_below_80_percent),
                cards_above_90_percent: parseInt(row.cards_above_90_percent)
            })),
            overall_statistics: {
                ...overallQuery.rows[0],
                total_cards: parseInt(overallQuery.rows[0].total_cards),
                avg_retrievability: parseFloat(overallQuery.rows[0].avg_retrievability || '0'),
                stddev_retrievability: parseFloat(overallQuery.rows[0].stddev_retrievability || '0'),
                min_retrievability: parseFloat(overallQuery.rows[0].min_retrievability || '0'),
                max_retrievability: parseFloat(overallQuery.rows[0].max_retrievability || '0')
            },
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Error getting retrievability stats:', error);
        res.status(500).json({
            status: 'error',
            error: 'Failed to get retrievability statistics',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}));


// Function to start the retrievability update system
export function startRetrievabilityUpdateSystem(): void {
    console.log('🚀 Starting retrievability update system...');
    
    // Start the midnight job
    midnightRetrievabilityJob.start();
    console.log('✅ Midnight retrievability update job started (runs at 00:00 daily)');
    
    // For testing - uncomment the line below to run updates every 5 minutes
    // testRetrievabilityJob.start();
    // console.log('🧪 Test retrievability update job started (runs every 5 minutes)');
    
    // Run initial stats
    setTimeout(async () => {
        console.log('📊 Getting initial retrievability statistics...');
        await getRetrievabilityStats();
    }, 2000);
}

// Function to stop the retrievability update system (useful for graceful shutdown)
export function stopRetrievabilityUpdateSystem(): void {
    console.log('🛑 Stopping retrievability update system...');
    midnightRetrievabilityJob.stop();
    testRetrievabilityJob.stop();
    console.log('✅ Retrievability update system stopped');
}


// Get detailed field data for a specific card (for editing)
app.get('/card/:cardId/fields', wrapAsync(async (req, res) => {
    const { cardId } = req.params;
    const cardIdNum = parseInt(cardId);

    if (isNaN(cardIdNum)) {
        return res.status(400).json({
            status: 'error',
            error: 'Invalid card ID'
        });
    }

    try {
        const query = await client.query(
            `SELECT 
                card_id,
                note_id,
                field_names,
                field_values,
                field_processing
             FROM cards 
             WHERE card_id = $1`,
            [cardIdNum]
        );

        if (query.rows.length === 0) {
            return res.status(404).json({
                status: 'error',
                error: `Card ${cardIdNum} not found`
            });
        }

        const card = query.rows[0];

        res.json({
            status: 'success',
            card: {
                card_id: card.card_id,
                note_id: card.note_id,
                field_names: card.field_names || [],
                field_values: card.field_values || [],
                field_processing: card.field_processing || []
            }
        });

    } catch (err) {
        console.error('Error getting card fields:', err);
        res.status(500).json({
            status: 'error',
            error: `Database error: ${err instanceof Error ? err.message : 'Unknown error'}`
        });
    }
}));

// Update a specific field of a card
app.put('/card/:cardId/field/:fieldIndex', express.json(), wrapAsync(async (req, res) => {
    const { cardId, fieldIndex } = req.params;
    const { new_value } = req.body;
    
    const cardIdNum = parseInt(cardId);
    const fieldIndexNum = parseInt(fieldIndex);

    if (isNaN(cardIdNum) || isNaN(fieldIndexNum)) {
        return res.status(400).json({
            status: 'error',
            error: 'Invalid card ID or field index'
        });
    }

    if (new_value === undefined) {
        return res.status(400).json({
            status: 'error',
            error: 'new_value is required'
        });
    }

    const transactionClient = await client.connect();

    try {
        await transactionClient.query('BEGIN');

        // Get the current card data
        const cardQuery = await transactionClient.query(
            `SELECT field_values, field_names, field_processing, note_id
             FROM cards 
             WHERE card_id = $1`,
            [cardIdNum]
        );

        if (cardQuery.rows.length === 0) {
            await transactionClient.query('ROLLBACK');
            return res.status(404).json({
                status: 'error',
                error: `Card ${cardIdNum} not found`
            });
        }

        const card = cardQuery.rows[0];
        const fieldValues = [...(card.field_values || [])];
        const fieldNames = card.field_names || [];
        const fieldProcessing = card.field_processing || [];
        const noteId = card.note_id;

        // Validate field index
        if (fieldIndexNum < 0 || fieldIndexNum >= fieldValues.length) {
            await transactionClient.query('ROLLBACK');
            return res.status(400).json({
                status: 'error',
                error: `Invalid field index ${fieldIndexNum}. Card has ${fieldValues.length} fields.`
            });
        }

        // Store old value for response
        const oldValue = fieldValues[fieldIndexNum];

        // Update the field value
        fieldValues[fieldIndexNum] = new_value;

        // Update the card in database
        await transactionClient.query(
            `UPDATE cards 
             SET field_values = $1
             WHERE card_id = $2`,
            [fieldValues, cardIdNum]
        );

        // Also update the note if it exists
        try {
            await transactionClient.query(
                `UPDATE notes 
                 SET field_values = $1
                 WHERE note_id = $2`,
                [fieldValues, noteId]
            );
        } catch (noteUpdateError) {
            console.log(`Note ${noteId} might not exist, continuing...`);
        }

        await transactionClient.query('COMMIT');

        console.log(`✅ Updated card ${cardIdNum}, field ${fieldIndexNum}: '${oldValue}' → '${new_value}'`);

        res.json({
            status: 'success',
            card_id: cardIdNum,
            field_index: fieldIndexNum,
            old_value: oldValue,
            new_value: new_value
        });

    } catch (error) {
        await transactionClient.query('ROLLBACK');
        console.error('Error updating card field:', error);
        res.status(500).json({
            status: 'error',
            error: `Database error: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
    } finally {
        transactionClient.release();
    }
}));

// Bulk update multiple fields of a card at once
app.put('/card/:cardId/fields/bulk', express.json(), wrapAsync(async (req, res) => {
    const { cardId } = req.params;
    const { field_updates } = req.body; // {field_index: new_value}
    
    const cardIdNum = parseInt(cardId);

    if (isNaN(cardIdNum)) {
        return res.status(400).json({
            status: 'error',
            error: 'Invalid card ID'
        });
    }

    if (!field_updates || typeof field_updates !== 'object') {
        return res.status(400).json({
            status: 'error',
            error: 'No field updates provided'
        });
    }

    const transactionClient = await client.connect();

    try {
        await transactionClient.query('BEGIN');

        // Get current card data
        const cardQuery = await transactionClient.query(
            `SELECT field_values, note_id
             FROM cards 
             WHERE card_id = $1`,
            [cardIdNum]
        );

        if (cardQuery.rows.length === 0) {
            await transactionClient.query('ROLLBACK');
            return res.status(404).json({
                status: 'error',
                error: `Card ${cardIdNum} not found`
            });
        }

        const card = cardQuery.rows[0];
        const fieldValues = [...(card.field_values || [])];
        const noteId = card.note_id;

        // Apply updates
        const updatedFields: Array<{
            field_index: number;
            old_value: string;
            new_value: string;
        }> = [];

        for (const [fieldIndexStr, newValue] of Object.entries(field_updates)) {
            const fieldIndex = parseInt(fieldIndexStr);

            if (fieldIndex >= 0 && fieldIndex < fieldValues.length) {
                const oldValue = fieldValues[fieldIndex];
                fieldValues[fieldIndex] = newValue as string;
                updatedFields.push({
                    field_index: fieldIndex,
                    old_value: oldValue,
                    new_value: newValue as string
                });
            }
        }

        if (updatedFields.length === 0) {
            await transactionClient.query('ROLLBACK');
            return res.json({
                status: 'error',
                error: 'No valid field updates to apply'
            });
        }

        // Update database
        await transactionClient.query(
            `UPDATE cards 
             SET field_values = $1
             WHERE card_id = $2`,
            [fieldValues, cardIdNum]
        );

        // Also update the note
        try {
            await transactionClient.query(
                `UPDATE notes 
                 SET field_values = $1
                 WHERE note_id = $2`,
                [fieldValues, noteId]
            );
        } catch (noteUpdateError) {
            console.log(`Note ${noteId} might not exist, continuing...`);
        }

        await transactionClient.query('COMMIT');

        console.log(`✅ Bulk updated card ${cardIdNum}: ${updatedFields.length} fields`);

        res.json({
            status: 'success',
            card_id: cardIdNum,
            updated_fields: updatedFields,
            updated_count: updatedFields.length
        });

    } catch (error) {
        await transactionClient.query('ROLLBACK');
        console.error('Error bulk updating card fields:', error);
        res.status(500).json({
            status: 'error',
            error: `Database error: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
    } finally {
        transactionClient.release();
    }
}));

// Preview how card will look after field changes (useful for validation)
app.get('/card/:cardId/preview', wrapAsync(async (req, res) => {
    const { cardId } = req.params;
    const cardIdNum = parseInt(cardId);

    if (isNaN(cardIdNum)) {
        return res.status(400).json({
            status: 'error',
            error: 'Invalid card ID'
        });
    }

    try {
        // Get card data
        const query = await client.query(
            `SELECT deck, card_format, field_values, field_processing
             FROM cards 
             WHERE card_id = $1`,
            [cardIdNum]
        );

        if (query.rows.length === 0) {
            return res.status(404).json({
                status: 'error',
                error: `Card ${cardIdNum} not found`
            });
        }

        const [deck, cardFormat, fieldValues, fieldProcessing] = [
            query.rows[0].deck,
            query.rows[0].card_format,
            query.rows[0].field_values || [],
            query.rows[0].field_processing || []
        ];

        // Generate front and back text preview
        // This mirrors your frontend generateCardFrontLine logic
        const targetIndex = cardFormat === "Native to Target" ? 1 : 0;
        
        let frontText = "Error: Invalid field index";
        if (targetIndex < fieldValues.length) {
            frontText = fieldValues[targetIndex];
            // Apply processing if needed (you could implement cleanFieldDatum here)
        }

        // Generate back text
        const backIndex = cardFormat === "Native to Target" ? 0 : 1;
        let backText = "Error: Invalid field index";
        if (backIndex < fieldValues.length) {
            backText = fieldValues[backIndex];
        }

        res.json({
            status: 'success',
            card_id: cardIdNum,
            preview: {
                front_text: frontText,
                back_text: backText,
                card_format: cardFormat,
                deck: deck
            }
        });

    } catch (error) {
        console.error('Error generating card preview:', error);
        res.status(500).json({
            status: 'error',
            error: `Database error: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
    }
}));

// Add this near the end of your index.ts file, after the app.listen call
// Start the retrievability update system when the server starts
startRetrievabilityUpdateSystem();

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🔄 Graceful shutdown initiated...');
    stopRetrievabilityUpdateSystem();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🔄 Graceful shutdown initiated...');
    stopRetrievabilityUpdateSystem();
    process.exit(0);
});

// Add this enhanced bulk update endpoint to your index.ts file
// Replace your existing /card/:cardId/fields/bulk endpoint with this improved version

app.put('/card/:cardId/fields/bulk', express.json(), wrapAsync(async (req, res) => {
    const { cardId } = req.params;
    const { field_updates } = req.body; // {field_index: new_value}
    
    const cardIdNum = parseInt(cardId);

    if (isNaN(cardIdNum)) {
        return res.status(400).json({
            status: 'error',
            error: 'Invalid card ID'
        });
    }

    if (!field_updates || typeof field_updates !== 'object') {
        return res.status(400).json({
            status: 'error',
            error: 'No field updates provided'
        });
    }

    console.log(`🔄 Bulk updating card ${cardIdNum}:`, field_updates);

    const transactionClient = await client.connect();

    try {
        await transactionClient.query('BEGIN');

        // Get current card data
        const cardQuery = await transactionClient.query(
            `SELECT field_values, note_id, deck, card_format
             FROM cards 
             WHERE card_id = $1`,
            [cardIdNum]
        );

        if (cardQuery.rows.length === 0) {
            await transactionClient.query('ROLLBACK');
            return res.status(404).json({
                status: 'error',
                error: `Card ${cardIdNum} not found`
            });
        }

        const card = cardQuery.rows[0];
        const fieldValues = [...(card.field_values || [])];
        const noteId = card.note_id;

        // Apply updates and track changes
        const updatedFields: Array<{
            field_index: number;
            old_value: string;
            new_value: string;
        }> = [];

        let hasValidUpdates = false;

        for (const [fieldIndexStr, newValue] of Object.entries(field_updates)) {
            const fieldIndex = parseInt(fieldIndexStr);

            // Validate field index
            if (isNaN(fieldIndex) || fieldIndex < 0 || fieldIndex >= fieldValues.length) {
                console.warn(`Invalid field index ${fieldIndex} for card ${cardIdNum}`);
                continue;
            }

            const oldValue = fieldValues[fieldIndex];
            
            // Only update if value actually changed
            if (oldValue !== newValue) {
                fieldValues[fieldIndex] = newValue as string;
                updatedFields.push({
                    field_index: fieldIndex,
                    old_value: oldValue,
                    new_value: newValue as string
                });
                hasValidUpdates = true;
            }
        }

        if (!hasValidUpdates) {
            await transactionClient.query('ROLLBACK');
            return res.json({
                status: 'success',
                message: 'No changes to apply',
                card_id: cardIdNum,
                updated_fields: [],
                updated_count: 0
            });
        }

        // Update the card in database
        await transactionClient.query(
            `UPDATE cards 
             SET field_values = $1
             WHERE card_id = $2`,
            [fieldValues, cardIdNum]
        );

        // Also update the note if it exists
        try {
            await transactionClient.query(
                `UPDATE notes 
                 SET field_values = $1
                 WHERE note_id = $2`,
                [fieldValues, noteId]
            );
            console.log(`✅ Updated note ${noteId} for card ${cardIdNum}`);
        } catch (noteUpdateError) {
            console.log(`Note ${noteId} might not exist or failed to update, continuing...`);
        }

        await transactionClient.query('COMMIT');

        console.log(`✅ Bulk updated card ${cardIdNum}: ${updatedFields.length} fields changed`);
        updatedFields.forEach(field => {
            console.log(`  Field ${field.field_index}: '${field.old_value}' → '${field.new_value}'`);
        });

        res.json({
            status: 'success',
            card_id: cardIdNum,
            updated_fields: updatedFields,
            updated_count: updatedFields.length,
            deck: card.deck,
            card_format: card.card_format,
            message: `Successfully updated ${updatedFields.length} field(s)`
        });

    } catch (error) {
        await transactionClient.query('ROLLBACK');
        console.error('Error bulk updating card fields:', error);
        res.status(500).json({
            status: 'error',
            error: `Database error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            card_id: cardIdNum
        });
    } finally {
        transactionClient.release();
    }
}));

// OPTIONAL: Add a card validation endpoint for the edit modal
app.get('/card/:cardId/validate', wrapAsync(async (req, res) => {
    const { cardId } = req.params;
    const cardIdNum = parseInt(cardId);

    if (isNaN(cardIdNum)) {
        return res.status(400).json({
            status: 'error',
            error: 'Invalid card ID'
        });
    }

    try {
        // Check if card exists and get basic info
        const query = await client.query(
            `SELECT 
                card_id,
                deck,
                card_format,
                array_length(field_values, 1) as field_count,
                under_review,
                created
             FROM cards 
             WHERE card_id = $1`,
            [cardIdNum]
        );

        if (query.rows.length === 0) {
            return res.status(404).json({
                status: 'error',
                error: `Card ${cardIdNum} not found`
            });
        }

        const card = query.rows[0];

        res.json({
            status: 'success',
            card_info: {
                card_id: card.card_id,
                deck: card.deck,
                card_format: card.card_format,
                field_count: card.field_count || 0,
                under_review: card.under_review,
                created: card.created,
                editable: !card.under_review // Cards under review might need special handling
            }
        });

    } catch (error) {
        console.error('Error validating card:', error);
        res.status(500).json({
            status: 'error',
            error: `Database error: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
    }
}));

// OPTIONAL: Add an endpoint to get edit history for a card
app.get('/card/:cardId/edit_history', wrapAsync(async (req, res) => {
    const { cardId } = req.params;
    const { limit = 10 } = req.query;
    const cardIdNum = parseInt(cardId);

    if (isNaN(cardIdNum)) {
        return res.status(400).json({
            status: 'error',
            error: 'Invalid card ID'
        });
    }

    try {
        // This would require an edit_history table if you wanted to track changes
        // For now, just return basic modification info
        const query = await client.query(
            `SELECT 
                card_id,
                created,
                last_reviewed
             FROM cards 
             WHERE card_id = $1`,
            [cardIdNum]
        );

        if (query.rows.length === 0) {
            return res.status(404).json({
                status: 'error',
                error: `Card ${cardIdNum} not found`
            });
        }

        const card = query.rows[0];

        res.json({
            status: 'success',
            card_id: cardIdNum,
            history: {
                created: card.created,
                last_reviewed: card.last_reviewed,
                note: "Full edit history would require additional tracking table"
            }
        });

    } catch (error) {
        console.error('Error getting card edit history:', error);
        res.status(500).json({
            status: 'error',
            error: `Database error: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
    }
}));

// Add these interfaces near your other type definitions in index.ts
interface BulkIntervalUpdateRequest {
    interval_multiplier: number;
}

interface BulkIntervalUpdateResponse {
    status: 'success' | 'error';
    updated_count?: number;
    total_cards?: number;
    average_old_interval?: number;
    average_new_interval?: number;
    multiplier_used?: number;
    operation_time?: string;
    error?: string;
    details?: string;
}

// Add this endpoint to your index.ts file
app.post('/bulk_reduce_intervals', express.json(), wrapAsync(async (req, res) => {
    const { interval_multiplier }: BulkIntervalUpdateRequest = req.body;
    
    console.log('🔥 BULK INTERVAL REDUCTION REQUESTED');
    console.log(`🔥 Multiplier: ${interval_multiplier}`);
    
    // Validation
    if (interval_multiplier === undefined || interval_multiplier === null) {
        return res.json({
            status: 'error',
            error: 'interval_multiplier is required'
        } as BulkIntervalUpdateResponse);
    }
    
    if (typeof interval_multiplier !== 'number' || isNaN(interval_multiplier)) {
        return res.json({
            status: 'error',
            error: 'interval_multiplier must be a valid number'
        } as BulkIntervalUpdateResponse);
    }
    
    if (interval_multiplier <= 0 || interval_multiplier > 1) {
        return res.json({
            status: 'error',
            error: 'interval_multiplier must be between 0.01 and 1.0'
        } as BulkIntervalUpdateResponse);
    }
    
    const startTime = Date.now();
    const operationTime = new Date().toISOString();
    
    console.log(`🔥 Starting bulk interval reduction: ${(interval_multiplier * 100).toFixed(1)}% at ${operationTime}`);
    
    const transactionClient = await client.connect();
    
    try {
        await transactionClient.query('BEGIN');
        console.log('🔥 Transaction started for bulk interval reduction');
        
        // Get all cards with their current intervals
        const allCardsQuery = await transactionClient.query(`
            SELECT 
                card_id,
                time_due,
                interval,
                deck,
                created
            FROM cards
            ORDER BY card_id
        `);
        
        const allCards = allCardsQuery.rows;
        const totalCards = allCards.length;
        
        console.log(`🔥 Found ${totalCards} cards to update`);
        
        if (totalCards === 0) {
            await transactionClient.query('ROLLBACK');
            return res.json({
                status: 'success',
                updated_count: 0,
                total_cards: 0,
                average_old_interval: 0,
                average_new_interval: 0,
                multiplier_used: interval_multiplier,
                operation_time: operationTime
            } as BulkIntervalUpdateResponse);
        }
        
        // Calculate statistics before update
        const oldIntervals = allCards.map(card => card.interval);
        const averageOldInterval = oldIntervals.reduce((sum, interval) => sum + interval, 0) / totalCards;
        const averageNewInterval = averageOldInterval * interval_multiplier;
        
        console.log(`🔥 Average interval: ${averageOldInterval.toFixed(1)} days → ${averageNewInterval.toFixed(1)} days`);
        
        let updatedCount = 0;
        
        // Update each card
        for (let i = 0; i < allCards.length; i++) {
            const card = allCards[i];
            const oldInterval = card.interval;
            const newInterval = Math.max(1, Math.round(oldInterval * interval_multiplier)); // Minimum 1 day
            
            // Calculate new due date based on the new interval
            // Use the current time as the base, not the old due date
            const now = new Date();
            const newDueDate = new Date(now.getTime() + (newInterval * 24 * 60 * 60 * 1000));
            
            // Update the card
            await transactionClient.query(`
                UPDATE cards 
                SET interval = $1,
                    time_due = $2
                WHERE card_id = $3
            `, [newInterval, newDueDate, card.card_id]);
            
            updatedCount++;
            
            // Log every 1000 cards
            if (updatedCount % 1000 === 0) {
                console.log(`🔥 Updated ${updatedCount}/${totalCards} cards (${((updatedCount/totalCards)*100).toFixed(1)}%)`);
            }
            
            // Log some examples for the first few cards
            if (i < 5) {
                console.log(`🔥 Card ${card.card_id}: ${oldInterval}d → ${newInterval}d, due: ${newDueDate.toISOString()}`);
            }
        }
        
        await transactionClient.query('COMMIT');
        
        const endTime = Date.now();
        const durationSeconds = (endTime - startTime) / 1000;
        
        console.log(`🔥 BULK INTERVAL REDUCTION COMPLETED SUCCESSFULLY`);
        console.log(`🔥 Updated: ${updatedCount}/${totalCards} cards`);
        console.log(`🔥 Duration: ${durationSeconds.toFixed(2)} seconds`);
        console.log(`🔥 Average interval: ${averageOldInterval.toFixed(1)}d → ${averageNewInterval.toFixed(1)}d`);
        console.log(`🔥 Multiplier used: ${(interval_multiplier * 100).toFixed(1)}%`);
        
        res.json({
            status: 'success',
            updated_count: updatedCount,
            total_cards: totalCards,
            average_old_interval: parseFloat(averageOldInterval.toFixed(1)),
            average_new_interval: parseFloat(averageNewInterval.toFixed(1)),
            multiplier_used: interval_multiplier,
            operation_time: operationTime,
            duration_seconds: parseFloat(durationSeconds.toFixed(2))
        } as BulkIntervalUpdateResponse & { duration_seconds: number });
        
    } catch (error) {
        await transactionClient.query('ROLLBACK');
        console.error('🔥 ERROR in bulk interval reduction:', error);
        
        res.json({
            status: 'error',
            error: 'Failed to reduce intervals',
            details: error instanceof Error ? error.message : 'Unknown error occurred',
            operation_time: operationTime
        } as BulkIntervalUpdateResponse);
        
    } finally {
        transactionClient.release();
        console.log('🔥 Transaction client released');
    }
}));

// Add this function to your index.ts file
async function buryPeerCards(cardIds: number[], transactionClient: any): Promise<void> {
    console.log(`🔄 Burying peers for ${cardIds.length} cards under review`);
    
    try {
        // Get all peer relationships for the cards under review
        const peerQuery = await transactionClient.query(
            `SELECT card_id, peers 
             FROM cards 
             WHERE card_id = ANY($1::int[]) 
             AND peers IS NOT NULL 
             AND array_length(peers, 1) > 0`,
            [cardIds]
        );
        
        // Collect all unique peer IDs that need to be buried
        const peerIdsToUpdate = new Set<number>();
        
        peerQuery.rows.forEach((row: { card_id: number; peers: number[] | null }) => {
            if (row.peers && Array.isArray(row.peers)) {
                row.peers.forEach((peerId: number) => {
                    // Only bury peers that aren't themselves under review
                    if (!cardIds.includes(peerId)) {
                        peerIdsToUpdate.add(peerId);
                    }
                });
            }
        });
        
        const uniquePeerIds = Array.from(peerIdsToUpdate);
        
        if (uniquePeerIds.length > 0) {
            console.log(`📦 Burying ${uniquePeerIds.length} peer cards:`, uniquePeerIds);
            
            // Update all peer cards to be buried for today only
            await transactionClient.query(
                `UPDATE cards 
                 SET is_buried = true, 
                     is_only_buried_today = true
                 WHERE card_id = ANY($1::int[])`,
                [uniquePeerIds]
            );
            
            console.log(`✅ Successfully buried ${uniquePeerIds.length} peer cards`);
        } else {
            console.log(`ℹ️ No peer cards found to bury`);
        }
        
    } catch (error) {
        console.error('❌ Error burying peer cards:', error);
        throw error;
    }
}

// Add this function to handle midnight unburying
async function unburyDailyBuriedCards(): Promise<void> {
    console.log('🌅 Starting midnight unbury process...');
    
    const transactionClient = await client.connect();
    
    try {
        await transactionClient.query('BEGIN');
        
        // Get count of cards to unbury for logging
        const countQuery = await transactionClient.query(`
            SELECT COUNT(*) as count 
            FROM cards 
            WHERE is_only_buried_today = true
        `);
        
        const cardsToUnbury = parseInt(countQuery.rows[0].count) || 0;
        console.log(`📦 Found ${cardsToUnbury} cards to unbury`);
        
        if (cardsToUnbury > 0) {
            // Update cards that were buried only for today
            const unburyResult = await transactionClient.query(`
                UPDATE cards 
                SET is_buried = false, 
                    is_only_buried_today = false
                WHERE is_only_buried_today = true
                RETURNING card_id
            `);
            
            const unburiedCount = unburyResult.rowCount || 0;
            const unburiedIds = unburyResult.rows.map(row => row.card_id);
            
            console.log(`✅ Successfully unburied ${unburiedCount} cards`);
            if (unburiedIds.length <= 10) {
                console.log(`   Card IDs: ${unburiedIds.join(', ')}`);
            } else {
                console.log(`   Card IDs: ${unburiedIds.slice(0, 10).join(', ')}... (and ${unburiedIds.length - 10} more)`);
            }
        }
        
        await transactionClient.query('COMMIT');
        console.log('🌅 Midnight unbury process completed successfully');
        
    } catch (error) {
        await transactionClient.query('ROLLBACK');
        console.error('❌ Error during midnight unbury process:', error);
        throw error;
    } finally {
        transactionClient.release();
    }
}

// Add these interfaces near your other type definitions
interface AdjustIntervalsRequest {
    deck: string;
    days_back: number;
    shift_percentage: number; // between -1 and 1
    update_interval: boolean;
}

interface AdjustIntervalsResponse {
    status: 'success' | 'error';
    updated_count?: number;
    total_cards_found?: number;
    deck?: string;
    days_back?: number;
    shift_percentage?: number;
    update_interval?: boolean;
    operation_time?: string;
    average_old_interval?: number;
    average_new_interval?: number;
    error?: string;
    details?: string;
}

// Add this endpoint to your Express app
app.post('/adjust_intervals_by_age', express.json(), wrapAsync(async (req, res) => {
    const { deck, days_back, shift_percentage, update_interval }: AdjustIntervalsRequest = req.body;
    
    console.log(`📊 Interval adjustment requested for deck "${deck}"`);
    console.log(`📊 Parameters: ${days_back} days back, ${(shift_percentage * 100).toFixed(1)}% shift, update_interval: ${update_interval}`);
    
    // Validation
    if (!deck || typeof deck !== 'string') {
        return res.json({
            status: 'error',
            error: 'Deck name is required and must be a string'
        } as AdjustIntervalsResponse);
    }
    
    if (typeof days_back !== 'number' || days_back < 0) {
        return res.json({
            status: 'error',
            error: 'days_back must be a non-negative number'
        } as AdjustIntervalsResponse);
    }
    
    if (typeof shift_percentage !== 'number' || shift_percentage < -1 || shift_percentage > 1) {
        return res.json({
            status: 'error',
            error: 'shift_percentage must be a number between -1 and 1'
        } as AdjustIntervalsResponse);
    }
    
    if (typeof update_interval !== 'boolean') {
        return res.json({
            status: 'error',
            error: 'update_interval must be a boolean'
        } as AdjustIntervalsResponse);
    }
    
    const startTime = Date.now();
    const operationTime = new Date().toISOString();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days_back);
    
    console.log(`📊 Looking for cards created on or after: ${cutoffDate.toISOString()}`);
    
    const transactionClient = await client.connect();
    
    try {
        await transactionClient.query('BEGIN');
        console.log('📊 Transaction started for interval adjustment');
        
        // Find target cards based on deck and creation date
        const targetCardsQuery = await transactionClient.query(`
            SELECT 
                card_id,
                interval,
                time_due,
                last_reviewed,
                created,
                deck
            FROM cards
            WHERE deck = $1 
            AND created >= $2
            ORDER BY card_id
        `, [deck, cutoffDate]);
        
        const targetCards = targetCardsQuery.rows;
        const totalCards = targetCards.length;
        
        console.log(`📊 Found ${totalCards} cards matching criteria`);
        
        if (totalCards === 0) {
            await transactionClient.query('ROLLBACK');
            return res.json({
                status: 'success',
                updated_count: 0,
                total_cards_found: 0,
                deck: deck,
                days_back: days_back,
                shift_percentage: shift_percentage,
                update_interval: update_interval,
                operation_time: operationTime,
                message: 'No cards found matching the criteria'
            } as AdjustIntervalsResponse & { message: string });
        }
        
        // Calculate statistics before update
        const oldIntervals = targetCards.map(card => card.interval);
        const averageOldInterval = oldIntervals.reduce((sum, interval) => sum + interval, 0) / totalCards;
        
        let updatedCount = 0;
        let totalNewInterval = 0;
        
        // Process each card
        for (let i = 0; i < targetCards.length; i++) {
            const card = targetCards[i];
            
            // Generate random number in the appropriate range
            // If shift_percentage is positive: [0, shift_percentage]
            // If shift_percentage is negative: [shift_percentage, 0]
            const minRange = Math.min(0, shift_percentage);
            const maxRange = Math.max(0, shift_percentage);
            const randomMultiplier = Math.random() * (maxRange - minRange) + minRange;
            
            // Calculate new interval
            const oldInterval = card.interval;
            const newInterval = Math.max(1, Math.round(oldInterval * (1 + randomMultiplier)));
            totalNewInterval += newInterval;
            
            // Calculate new due date based on last review (or creation if never reviewed)
            const referenceDate = card.last_reviewed ? new Date(card.last_reviewed) : new Date(card.created);
            const newDueDate = new Date(referenceDate.getTime() + (newInterval * 24 * 60 * 60 * 1000));
            
            // Update the card
            if (update_interval) {
                // Update both due date and interval
                await transactionClient.query(`
                    UPDATE cards 
                    SET time_due = $1,
                        interval = $2
                    WHERE card_id = $3
                `, [newDueDate, newInterval, card.card_id]);
            } else {
                // Update only due date
                await transactionClient.query(`
                    UPDATE cards 
                    SET time_due = $1
                    WHERE card_id = $2
                `, [newDueDate, card.card_id]);
            }
            
            updatedCount++;
            
            // Log examples for first few cards
            if (i < 5) {
                console.log(`📊 Card ${card.card_id}: ${oldInterval}d → ${newInterval}d (${(randomMultiplier * 100).toFixed(1)}%), due: ${newDueDate.toISOString()}`);
            }
            
            // Progress logging
            if (updatedCount % 1000 === 0) {
                console.log(`📊 Updated ${updatedCount}/${totalCards} cards`);
            }
        }
        
        await transactionClient.query('COMMIT');
        
        const endTime = Date.now();
        const durationSeconds = (endTime - startTime) / 1000;
        const averageNewInterval = totalNewInterval / totalCards;
        
        console.log(`📊 INTERVAL ADJUSTMENT COMPLETED SUCCESSFULLY`);
        console.log(`📊 Deck: ${deck}`);
        console.log(`📊 Updated: ${updatedCount}/${totalCards} cards`);
        console.log(`📊 Duration: ${durationSeconds.toFixed(2)} seconds`);
        console.log(`📊 Average interval: ${averageOldInterval.toFixed(1)}d → ${averageNewInterval.toFixed(1)}d`);
        console.log(`📊 Shift range: ${(shift_percentage * 100).toFixed(1)}%`);
        console.log(`📊 Updated interval values: ${update_interval ? 'YES' : 'NO (due dates only)'}`);
        
        res.json({
            status: 'success',
            updated_count: updatedCount,
            total_cards_found: totalCards,
            deck: deck,
            days_back: days_back,
            shift_percentage: shift_percentage,
            update_interval: update_interval,
            operation_time: operationTime,
            average_old_interval: parseFloat(averageOldInterval.toFixed(1)),
            average_new_interval: parseFloat(averageNewInterval.toFixed(1)),
            duration_seconds: parseFloat(durationSeconds.toFixed(2))
        } as AdjustIntervalsResponse & { duration_seconds: number });
        
    } catch (error) {
        await transactionClient.query('ROLLBACK');
        console.error('📊 ERROR in interval adjustment:', error);
        
        res.json({
            status: 'error',
            error: 'Failed to adjust intervals',
            details: error instanceof Error ? error.message : 'Unknown error occurred',
            deck: deck,
            days_back: days_back,
            shift_percentage: shift_percentage,
            update_interval: update_interval,
            operation_time: operationTime
        } as AdjustIntervalsResponse);
        
    } finally {
        transactionClient.release();
        console.log('📊 Transaction client released');
    }
}));

// Add this endpoint after your existing endpoints
app.post('/shuffle_due_dates', express.json(), wrapAsync(async (req, res) => {
    const { deck, days_span, base_date, include_overdue }: ShuffleDueDatesRequest = req.body;
    
    console.log(`🎲 Due date shuffle requested for deck "${deck}"`);
    console.log(`🎲 Parameters: ${days_span} days span, base_date: ${base_date}, include_overdue: ${include_overdue}`);
    
    // Validation
    if (!deck || typeof deck !== 'string') {
        return res.json({
            status: 'error',
            error: 'Deck name is required and must be a string'
        } as ShuffleDueDatesResponse);
    }
    
    if (typeof days_span !== 'number' || days_span < 1 || days_span > 365) {
        return res.json({
            status: 'error',
            error: 'days_span must be a number between 1 and 365'
        } as ShuffleDueDatesResponse);
    }
    
    const startTime = Date.now();
    const operationTime = new Date().toISOString();
    
    // Set up date range
    const baseDate = new Date(base_date);
    const endDate = new Date(baseDate);
    endDate.setDate(endDate.getDate() + days_span);
    
    console.log(`🎲 Date range: ${baseDate.toISOString()} to ${endDate.toISOString()}`);
    
    const transactionClient = await client.connect();
    
    try {
        await transactionClient.query('BEGIN');
        console.log('🎲 Transaction started for due date shuffle');
        
        // Build query to find target cards
        let whereConditions = ['deck = $1'];
        let queryParams: any[] = [deck];
        let paramIndex = 2;
        
        if (include_overdue) {
            // Include all cards due up to the end date (including overdue)
            whereConditions.push(`time_due <= $${paramIndex}`);
            queryParams.push(endDate);
            paramIndex++;
        } else {
            // Only include cards due within the specified range
            whereConditions.push(`time_due >= $${paramIndex}`);
            whereConditions.push(`time_due <= $${paramIndex + 1}`);
            queryParams.push(baseDate);
            queryParams.push(endDate);
            paramIndex += 2;
        }
        
        const whereClause = whereConditions.join(' AND ');
        
        // Find target cards
        const targetCardsQuery = await transactionClient.query(`
            SELECT 
                card_id,
                time_due,
                interval,
                deck
            FROM cards
            WHERE ${whereClause}
            ORDER BY card_id
        `, queryParams);
        
        const targetCards = targetCardsQuery.rows;
        const totalCards = targetCards.length;
        
        console.log(`🎲 Found ${totalCards} cards to shuffle`);
        
        if (totalCards === 0) {
            await transactionClient.query('ROLLBACK');
            return res.json({
                status: 'success',
                updated_count: 0,
                total_cards_found: 0,
                deck: deck,
                days_span: days_span,
                base_date: baseDate.toISOString(),
                date_range: {
                    start_date: baseDate.toISOString(),
                    end_date: endDate.toISOString()
                },
                operation_time: operationTime,
                message: 'No cards found in the specified date range'
            } as ShuffleDueDatesResponse & { message: string });
        }
        
        // Calculate statistics before shuffle
        const oldDueDays = targetCards.map(card => {
            const dueDate = new Date(card.time_due);
            const diffTime = dueDate.getTime() - baseDate.getTime();
            return diffTime / (1000 * 60 * 60 * 24);
        });
        const averageOldDueDays = oldDueDays.reduce((sum, days) => sum + days, 0) / totalCards;
        
        let updatedCount = 0;
        let totalNewDueDays = 0;
        
        // Shuffle each card to a random date within the range
        for (let i = 0; i < targetCards.length; i++) {
            const card = targetCards[i];
            
            // Generate random number of days between 0 and days_span
            const randomDays = Math.random() * days_span;
            
            // Calculate new due date
            const newDueDate = new Date(baseDate);
            newDueDate.setTime(newDueDate.getTime() + (randomDays * 24 * 60 * 60 * 1000));
            
            // Update the card's due date (keep original interval)
            await transactionClient.query(`
                UPDATE cards 
                SET time_due = $1
                WHERE card_id = $2
            `, [newDueDate, card.card_id]);
            
            updatedCount++;
            totalNewDueDays += randomDays;
            
            // Log examples for first few cards
            if (i < 5) {
                const oldDueDate = new Date(card.time_due);
                console.log(`🎲 Card ${card.card_id}: ${oldDueDate.toLocaleDateString()} → ${newDueDate.toLocaleDateString()}`);
            }
            
            // Progress logging
            if (updatedCount % 1000 === 0) {
                console.log(`🎲 Shuffled ${updatedCount}/${totalCards} cards`);
            }
        }
        
        await transactionClient.query('COMMIT');
        
        const endTime = Date.now();
        const durationSeconds = (endTime - startTime) / 1000;
        const averageNewDueDays = totalNewDueDays / totalCards;
        
        console.log(`🎲 DUE DATE SHUFFLE COMPLETED SUCCESSFULLY`);
        console.log(`🎲 Deck: ${deck}`);
        console.log(`🎲 Shuffled: ${updatedCount}/${totalCards} cards`);
        console.log(`🎲 Duration: ${durationSeconds.toFixed(2)} seconds`);
        console.log(`🎲 Date range: ${baseDate.toDateString()} to ${endDate.toDateString()}`);
        console.log(`🎲 Average days from base: ${averageOldDueDays.toFixed(1)} → ${averageNewDueDays.toFixed(1)}`);
        
        res.json({
            status: 'success',
            updated_count: updatedCount,
            total_cards_found: totalCards,
            deck: deck,
            days_span: days_span,
            base_date: baseDate.toISOString(),
            date_range: {
                start_date: baseDate.toISOString(),
                end_date: endDate.toISOString()
            },
            operation_time: operationTime,
            average_old_due_days: parseFloat(averageOldDueDays.toFixed(1)),
            average_new_due_days: parseFloat(averageNewDueDays.toFixed(1)),
            duration_seconds: parseFloat(durationSeconds.toFixed(2))
        } as ShuffleDueDatesResponse & { duration_seconds: number });
        
    } catch (error) {
        await transactionClient.query('ROLLBACK');
        console.error('🎲 ERROR in due date shuffle:', error);
        
        res.json({
            status: 'error',
            error: 'Failed to shuffle due dates',
            details: error instanceof Error ? error.message : 'Unknown error occurred',
            deck: deck,
            days_span: days_span,
            base_date: baseDate.toISOString(),
            operation_time: operationTime
        } as ShuffleDueDatesResponse);
        
    } finally {
        transactionClient.release();
        console.log('🎲 Transaction client released');
    }
}));

// Replace your existing /review_forecast endpoint with this updated version
app.get('/review_forecast', wrapAsync(async (req, res) => {
    const { decks, days_ahead, start_date } = req.query;

    console.log('Review forecast requested:', { decks, days_ahead, start_date });

    // Parse parameters properly
    const daysAheadNum = days_ahead ? parseInt(days_ahead as string) : 14;
    const startDate = new Date(start_date as string || new Date());
    startDate.setHours(0, 0, 0, 0);
    
    // Parse deck list
    let targetDecks: string[] = [];
    if (decks && typeof decks === 'string') {
        targetDecks = decks.split(',').map(d => d.trim()).filter(d => d.length > 0);
    }
    
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + daysAheadNum);

    try {
        // Build deck filter
        let deckFilter = '';
        let deckParams: any[] = [];
        if (targetDecks.length > 0) {
            deckFilter = `AND deck = ANY($3::text[])`;
            deckParams = [targetDecks];
        }

        // Query for future cards (existing logic)
        const futureQuery = `
            SELECT 
                DATE(time_due) as due_date,
                deck,
                COUNT(*) as card_count
            FROM cards
            WHERE time_due >= $1 
            AND time_due < $2
            ${deckFilter}
            AND (is_buried = false OR is_buried IS NULL)
            GROUP BY DATE(time_due), deck
            ORDER BY due_date, deck
        `;

        // Query for overdue cards (NEW)
        const overdueQuery = `
            SELECT 
                deck,
                COUNT(*) as card_count
            FROM cards
            WHERE time_due < $1
            ${deckFilter}
            AND (is_buried = false OR is_buried IS NULL)
            GROUP BY deck
            ORDER BY deck
        `;

        const queryParams = [startDate, endDate, ...deckParams];
        const overdueParams = [startDate, ...deckParams];

        // Execute both queries
        const [futureResult, overdueResult] = await Promise.all([
            client.query(futureQuery, queryParams),
            client.query(overdueQuery, overdueParams)
        ]);

        // Get list of all decks involved
        const allDecksQuery = targetDecks.length > 0 
            ? `SELECT DISTINCT deck FROM cards WHERE deck = ANY($1::text[]) ORDER BY deck`
            : `SELECT DISTINCT deck FROM cards ORDER BY deck`;
        
        const allDecksParams = targetDecks.length > 0 ? [targetDecks] : [];
        const decksResult = await client.query(allDecksQuery, allDecksParams);
        const allDecks = decksResult.rows.map(row => row.deck);

        // Add "Overdue" as a special deck if there are any overdue cards
        const hasOverdueCards = overdueResult.rows.length > 0;
        const allDecksWithOverdue = hasOverdueCards ? ['Overdue', ...allDecks] : allDecks;

        // Create date range array
        const dateRange: string[] = [];
        for (let d = new Date(startDate); d < endDate; d.setDate(d.getDate() + 1)) {
            dateRange.push(d.toISOString().split('T')[0]); // YYYY-MM-DD format
        }

        // Initialize forecast data structure
        const forecastData = dateRange.map((date, index) => {
            const dayData: { [key: string]: number | string } = { date };
            
            // Initialize all regular decks with 0 counts
            allDecks.forEach(deck => {
                dayData[deck] = 0;
            });
            
            // Add overdue column only to the first day (today)
            if (index === 0 && hasOverdueCards) {
                dayData['Overdue'] = 0;
            }
            
            return dayData;
        });

        // Fill in actual counts from future cards query
        futureResult.rows.forEach(row => {
            const dateStr = row.due_date.toISOString().split('T')[0];
            const deck = row.deck;
            const count = parseInt(row.card_count);

            const dayIndex = dateRange.indexOf(dateStr);
            if (dayIndex !== -1) {
                forecastData[dayIndex][deck] = count;
            }
        });

        // Fill in overdue counts for the first day only
        if (hasOverdueCards && forecastData.length > 0) {
            let totalOverdue = 0;
            overdueResult.rows.forEach(row => {
                totalOverdue += parseInt(row.card_count);
            });
            forecastData[0]['Overdue'] = totalOverdue;
        }

        // Calculate total reviews (including overdue)
        const totalFutureReviews = futureResult.rows.reduce((sum, row) => sum + parseInt(row.card_count), 0);
        const totalOverdueReviews = overdueResult.rows.reduce((sum, row) => sum + parseInt(row.card_count), 0);
        const totalReviews = totalFutureReviews + totalOverdueReviews;

        console.log(`📊 Generated forecast for ${allDecks.length} decks over ${daysAheadNum} days`);
        console.log(`📊 Total future reviews: ${totalFutureReviews}, Overdue: ${totalOverdueReviews}`);
        console.log(`📊 Total reviews in period: ${totalReviews}`);

        res.json({
            status: 'success',
            forecast_data: forecastData,
            decks: allDecks, // Return regular decks only, not including "Overdue"
            date_range: {
                start_date: startDate.toISOString().split('T')[0],
                end_date: endDate.toISOString().split('T')[0]
            },
            total_reviews: totalReviews,
            overdue_count: totalOverdueReviews,
            has_overdue: hasOverdueCards
        } as ReviewForecastResponse & { overdue_count: number; has_overdue: boolean });

    } catch (err) {
        console.error('Error generating review forecast:', err);
        res.status(500).json({
            status: 'error',
            error: 'Error generating review forecast',
            details: err instanceof Error ? err.message : 'Unknown error'
        } as ReviewForecastResponse);
    }
}));