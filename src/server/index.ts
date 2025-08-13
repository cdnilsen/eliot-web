import express from "express"
import path from "path"
import fs from 'fs'
import session from 'express-session'
import bcrypt from "bcrypt"
import client from './db'
import { wrapAsync } from './utils'
import { Request, Response, NextFunction } from 'express';
import { rescheduleCards, getSchedulingStats } from './scheduler';


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
                        1,
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
    const { deck, current_time, actual_current_time, review_ahead, hours_ahead } = req.body;
    
    if (!deck) {
        return res.status(400).json({ 
            status: 'error', 
            error: 'Deck name is required' 
        });
    }
    
    // Use provided times
    const checkTime = current_time ? new Date(current_time) : new Date();
    const actualCurrentTime = actual_current_time ? new Date(actual_current_time) : new Date();

    console.log('Testing simple query...');
    const testQuery = await client.query(
        'SELECT COUNT(*) as count FROM cards WHERE deck = $1',
        [deck]
    );
    console.log('Simple query result:', testQuery.rows);

    // If that works, try the full query with explicit logging
    console.log('Parameters being passed:', [deck, checkTime, actualCurrentTime]);
    console.log('Parameter types:', [typeof deck, typeof checkTime, typeof actualCurrentTime]);

    console.log('Request body:', req.body);
    console.log('Deck:', deck);
    console.log('Current time:', current_time);
    console.log('Actual current time:', actual_current_time);
    
    const modeText = review_ahead ? `review ahead (${hours_ahead || 24}h)` : 'due now';
    console.log(`Checking cards for deck: ${deck} - Mode: ${modeText} - Check time: ${checkTime.toISOString()} - Actual current time: ${actualCurrentTime.toISOString()}`);
    
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
            ORDER BY time_due ASC`,
            [deck, checkTime, actualCurrentTime] // Changed $3 to use actualCurrentTime
        );
        
        const dueNow = query.rows.filter(card => card.due_status === 'due_now');
        const dueAhead = query.rows.filter(card => card.due_status === 'due_ahead');
        
        console.log(`Found ${query.rows.length} cards total (${dueNow.length} due now, ${dueAhead.length} due ahead)`);
        
        res.json({
            status: 'success',
            cards: query.rows,
            total_due: query.rows.length,
            due_now_count: dueNow.length,
            due_ahead_count: dueAhead.length,
            deck: deck,
            checked_at: checkTime.toISOString(),
            review_ahead: review_ahead || false,
            hours_ahead: hours_ahead || 0
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