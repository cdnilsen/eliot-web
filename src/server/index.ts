import express from "express"
import path from "path"
import fs from 'fs'

import client from './db'
import { wrapAsync } from './utils'

const app = express()
const port = process.env.PORT

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
        const content = fs.readFileSync(filePath, 'utf8');
        // Here you'll add your text processing logic
        // For example, splitting into words and inserting into database:
        const words = content.split(/\s+/)
            .map(word => word.trim())
            .filter(word => word.length > 0);
            
        for (const word of words) {
            await client.query(
                `INSERT INTO words_diacritics (word, total_count)
                 VALUES ($1, 1)
                 ON CONFLICT (word) 
                 DO UPDATE SET total_count = words_diacritics.total_count + 1`,
                [word]
            );
        }
        
        res.json({ status: 'success', wordsProcessed: words.length });
    } catch (err) {
        res.status(500).json({ error: 'Error processing file' });
    }
}));

// https://expressjs.com/en/starter/static-files.html
app.use(express.static('public'))
app.use(express.static('.'))

app.get('/test-static', (req, res) => {
    const fs = require('fs');
    const files = fs.readdirSync('public');
    res.json(files);
});


app.get('/dynamicContent', (req, res) => {
    res.send(`Hi! I'm some dynamic content! You loaded this page at millisecond ${new Date().getTime()} of the UNIX 年号.`)
})

app.get('/words', wrapAsync(async (req, res) => {
    const words = await client.query('SELECT * FROM words_diacritics')
    res.json(words.rows)
}))

app.put('/words/:word/increment', wrapAsync(async (req, res) => {
    const update = await client.query('UPDATE words_diacritics SET total_count = total_count + 1 WHERE word = $1::text', [req.params.word])
    res.json(update)
}))

app.post('/words/:word', wrapAsync(async (req, res) => {
    // TODO: check if the word already exists and return a good error
    const insert = await client.query("INSERT INTO words_diacritics VALUES ($1::text, 0)", [req.params.word])
    res.json(insert)
}))

// Default error handling middleware is fine for now


// Async init - have to wait for the client to connect
;(async function () {
    await client.connect()
    app.listen(port, () => {
        console.log(`Example app listening on port ${port}`)
    })    
})()

