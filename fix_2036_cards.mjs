// One-off script: fix cards whose time_due was corrupted to ~2036 by the
// fix_weird_intervals bug (stability used instead of interval for time_due,
// applied to never-reviewed cards).
//
// Sets each affected card to:
//   interval  = random int in [15, 20]
//   time_due  = NOW() + interval days   (i.e. due in 15–20 days)
//   stability = NULL                    (no real FSRS data, let it re-seed on first review)
//
// Run from eliot-web root:
//   DATABASE_URL=... node fix_2036_cards.mjs

import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function main() {
    const client = await pool.connect();
    try {
        // Find all cards with absurdly far future due dates (anything past 2030 is wrong).
        const { rows } = await client.query(
            `SELECT card_id, deck, time_due, interval, stability, last_reviewed
             FROM cards
             WHERE time_due > '2030-01-01'
             ORDER BY deck, card_id`
        );

        if (rows.length === 0) {
            console.log('No affected cards found — already clean.');
            return;
        }

        console.log(`Found ${rows.length} affected card(s):`);
        for (const r of rows) {
            console.log(`  card_id=${r.card_id} deck=${r.deck} time_due=${r.time_due} interval=${r.interval} stability=${r.stability} last_reviewed=${r.last_reviewed}`);
        }

        await client.query('BEGIN');

        let fixed = 0;
        for (const card of rows) {
            const intervalDays = randInt(15, 20);
            await client.query(
                `UPDATE cards
                 SET interval  = $1::int8,
                     time_due  = NOW() + ($1::int8 * INTERVAL '1 day'),
                     stability = NULL
                 WHERE card_id = $2`,
                [intervalDays, card.card_id]
            );
            console.log(`  Fixed card_id=${card.card_id}: interval=${intervalDays}d, due in ${intervalDays} days`);
            fixed++;
        }

        await client.query('COMMIT');
        console.log(`\nDone. Fixed ${fixed} card(s).`);
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
        await pool.end();
    }
}

main().catch(err => { console.error(err); process.exit(1); });
