import express from "express"
import path from "path"

import { client } from './db'
import { wrapAsync } from './utils'

const app = express()
const port = 3000

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

// https://expressjs.com/en/starter/static-files.html
app.use(express.static('public'))

// Async init - have to wait for the client to connect
;(async function () {
    await client.connect()
    app.listen(port, () => {
        console.log(`Example app listening on port ${port}`)
    })    
})()

