import { Client } from 'pg'

// Definitely change these. Your deployment environment should tell you what to do here.
const CLIENT_PROPS = {
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.DATABASE_URL,
  password: process.env.PGPASSWORD,
  port: Number(process.env.PGPORT),
}

export const client = new Client(CLIENT_PROPS)
