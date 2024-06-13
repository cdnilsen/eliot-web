import { Pool } from 'pg';

// Create a pool with your database credentials
const pool = new Pool({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.DATABASE_URL,
  password: process.env.PGPASSWORD,
  port: Number(process.env.PGPORT),
});

export default pool;
