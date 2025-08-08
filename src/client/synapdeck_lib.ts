export type CardRating = 1 | 2 | 3 | 4;

export type Tracker = {
    card_id: string,
    deck: string,
    parent_note: string,
    card_format: string,
    field_names: string[],
    field_values: string[],
    field_processing: string[],
    peers: string[],
    prereqs: string[],
    dependents: string[],
    created: number,
    time_due: number,
    interval: number,
    past_reviews: number[],
    past_grades: CardRating[],
    retrievability: number,
    stability: number,
    difficulty: number,
    reviewed_today: boolean,
    reviewed_yesterday: boolean,
    most_recent_grade: boolean,
    is_buried: boolean,
    is_only_buried_today: boolean,
    bury_tomorrow: boolean,
    is_suspended: boolean
}

export type Pretracker = {
    deck: string,
    note_type: string,
    field_values: string[],
    field_processing: string[]
}