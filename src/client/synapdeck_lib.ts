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

export function TwoWayCard(values: string[], processing: string[]): any[] {
    while (values.length < 4) {
        values.push("");
        processing.push("");
    }
    
    return [
        {
            card_format: "Target to Native",
            field_names: ["Target", "Native", "Target_Back", "Native_Back"],
            field_values: values,
            field_processing: processing
        },
        {
            card_format: "Native to Target", 
            field_names: ["Native", "Target", "Native_Back", "Target_Back"],
            field_values: [values[1], values[0], values[3], values[2]], // Swapped
            field_processing: processing
        }
    ];
}

export function OneWayCard(values: string[], processing: string[]): any[] {
    return [
        {
            card_format: "One Way",
            field_names: ["Front", "Back"],
            field_values: [values[0], values[1]],
            field_processing: processing
        }
    ];
}


// Helper function to convert ArrayBuffer to base64 without stack overflow
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    const chunkSize = 32768; // Process in 32KB chunks to avoid stack overflow
    let binary = '';
    
    for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.slice(i, i + chunkSize);
        binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    
    return btoa(binary);
}

// Add this helper function to properly handle Ge'ez text in jsPDF
export function prepareTextForPDF(text: string): string {
    // Method 1: Ensure proper Unicode normalization
    let normalizedText = text.normalize('NFC');
    
    // Method 2: Replace any problematic HTML entities or tags
    normalizedText = normalizedText
        .replace(/<[^>]*>/g, '') // Remove any HTML tags
        .replace(/&[^;]+;/g, ''); // Remove HTML entities
    
    return normalizedText;
}

// Add this function to test if characters will render properly
export function testCharacterRendering(doc: any, text: string): boolean {
    try {
        // Try to measure the text - if it fails, the characters aren't supported
        const dimensions = doc.getTextDimensions(text);
        return dimensions.w > 0; // If width is 0, characters aren't rendering
    } catch (error) {
        console.warn('Character rendering test failed:', error);
        return false;
    }
}