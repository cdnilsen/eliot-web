CREATE TABLE cards (
    card_id SERIAL PRIMARY KEY,
    note_id INTEGER REFERENCES notes(note_id) ON DELETE CASCADE, -- Foreign key to parent note
    deck VARCHAR(255) NOT NULL,
    card_format VARCHAR(255), -- Which card template/format from the note type
    field_names TEXT[], -- Copy from note or subset
    field_values TEXT[], -- Copy from note or processed versions
    field_processing TEXT[], -- How each field was processed for this card
    peers INTEGER[], -- Array of other card_ids from the same note
    prereqs INTEGER[],
    dependents INTEGER[],
    created TIMESTAMP DEFAULT NOW(),
    time_due TIMESTAMP,
    interval INT8,
    past_reviews TIMESTAMP[],
    past_grades INT2[],
    retrievability FLOAT4,
    stability FLOAT4,
    difficulty FLOAT4,
    -- Was missing from this file despite being read/written throughout
    -- src/server/index.ts (e.g. /submit_review_results); type inferred from
    -- usage as a TIMESTAMP, not verified live via \d.
    last_reviewed TIMESTAMP,
    reviewed_today BOOLEAN DEFAULT FALSE,
    reviewed_yesterday BOOLEAN DEFAULT FALSE,
    under_review BOOLEAN DEFAULT FALSE,
    most_recent_grade INT2,
    is_buried BOOLEAN DEFAULT FALSE,
    is_only_buried_today BOOLEAN DEFAULT FALSE,
    bury_tomorrow BOOLEAN DEFAULT FALSE,
    is_suspended BOOLEAN DEFAULT FALSE
)

-- GET /export_deck / POST /import_deck (src/server/index.ts, src/server/blob_codec.ts)
-- pack a subset of the above scheduling columns and the peers/prereqs/dependents
-- arrays into two synthesized "sched"/"rel" string columns in the exported
-- CSV/TSV. These are not stored anywhere — computed at export time, decoded
-- and validated (checksummed) at import time — and import only ever UPDATEs
-- existing card_ids, never inserts or deletes.

-- review_sessions / session_card_reviews were previously undocumented here
-- (review_sessions had an empty column list, session_card_reviews wasn't
-- listed at all) despite being queried throughout src/server/index.ts.
-- Reconstructed from actual usage there; types are best-guess where index.ts
-- doesn't pin them down, and this hasn't been diffed against the live DB via
-- \d — treat as a starting point to reconcile, not a verified source of truth.
CREATE TABLE review_sessions (
    session_id SERIAL PRIMARY KEY,
    deck VARCHAR(255) NOT NULL,
    started_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    max_cards_requested INTEGER,
    review_ahead_hours INTEGER DEFAULT 0,
    cards_presented INTEGER,
    cards_completed INTEGER,
    pass_count INTEGER,
    hard_count INTEGER,
    fail_count INTEGER,
    session_status VARCHAR(50) DEFAULT 'in_progress',
    notes TEXT
)

CREATE TABLE session_card_reviews (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES review_sessions(session_id) ON DELETE CASCADE,
    card_id INTEGER REFERENCES cards(card_id) ON DELETE CASCADE,
    deck VARCHAR(255),
    position INTEGER,
    presented_at TIMESTAMP DEFAULT NOW(),
    reviewed_at TIMESTAMP,
    grade INT2,
    interval_before INT8,
    interval_after INT8,
    retrievability_before FLOAT4,
    retrievability_after FLOAT4,
    under_review BOOLEAN DEFAULT FALSE
)

-- Cards fetched for review are filtered/sorted by (deck, time_due) on every
-- Review-tab load and every check_cards_available(_batch) call, with no
-- supporting index. Run manually via psql against the live DB (not
-- auto-applied by app code, and CONCURRENTLY cannot run inside a transaction):
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cards_deck_time_due
    ON cards (deck, time_due);