export type CardRating = 1 | 2 | 3 | 4;

export type CardTracker = {
    deck: string,
    card_format: string,
    field_names: string[],
    field_values: string[],
    field_processing: string[],
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

export type NoteTracker = {
    deck: string,
    note_type: string,
    field_names: string[],
    field_values: string[],
    trackers: CardTracker[]
}

export function TwoWayCard(deck: string, values: string[], processing: string[]): any[] {
    while (values.length < 4) {
        values.push("");
        processing.push("");
    }
    
    return [
        {
            card_format: "Two-Way-Front",
            field_names: ["Target", "Native", "Target_Back", "Native_Back"],
            field_values: values,
            field_processing: processing
        },
        {
            card_format: "Two-Way-Back", 
            field_names: ["Native", "Target", "Native_Back", "Target_Back"],
            field_values: [values[1], values[0], values[3], values[2]], // Swapped
            field_processing: processing
        }
    ];
}

export function OneWayCard(deck: string, values: string[], processing: string[]): any[] {
    return [
        {
            card_format: "One-Way",
            field_names: ["Front", "Back"],
            field_values: [values[0], values[1]],
            field_processing: processing
        }
    ];
}