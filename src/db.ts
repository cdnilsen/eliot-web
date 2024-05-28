import { Client } from 'pg'

// Definitely change these. Your deployment environment should tell you what to do here.
const CLIENT_PROPS = {
    user: 'postgres',
    password: 'postgres',
    database: 'eliotweb',
    port: 5432
}

export const client = new Client(CLIENT_PROPS)
