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
    reviewed_today BOOLEAN DEFAULT FALSE,
    reviewed_yesterday BOOLEAN DEFAULT FALSE,
    under_review BOOLEAN DEFAULT FALSE,
    most_recent_grade INT2,
    is_buried BOOLEAN DEFAULT FALSE,
    is_only_buried_today BOOLEAN DEFAULT FALSE,
    bury_tomorrow BOOLEAN DEFAULT FALSE,
    is_suspended BOOLEAN DEFAULT FALSE
)

CREATE TABLE review_sessions (
    
)