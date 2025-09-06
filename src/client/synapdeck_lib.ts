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
    console.log("Values and processing before the Two Way Card function"); 
    console.log(values);
    console.log(processing);
    
    while (values.length < 4) {
        values.push("");
        processing.push("");
    }
    console.log("Values and processing *after* the Two Way Card function"); 
    console.log(values);
    console.log(processing);

    return [
        {
            card_format: "Target to Native",
            field_names: ["Target", "Native", "Target_Back", "Native_Back", "Coloring"],
            field_values: values,
            field_processing: processing
        },
        {
            card_format: "Native to Target", 
            field_names: ["Target", "Native", "Target_Back", "Native_Back", "Coloring"],
            field_values: values,
            field_processing: processing
        }
    ];
}

export function OneWayCard(values: string[], processing: string[]): any[] {
    return [
        {
            card_format: "One Way",
            field_names: ["Front", "Back", "Coloring"],
            field_values: [values[0], values[1], values[2]],
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

export async function loadGentiumForCanvas(): Promise<boolean> {
    try {
        // Check if font is already loaded
        if (document.fonts.check('16px GentiumPlus')) {
            console.log('✅ GentiumPlus already loaded');
            return true;
        }
        
        const fontFace = new FontFace(
            'GentiumPlus', 
            'url(/Gentium/GentiumPlus-Regular.ttf)'
        );
        
        await fontFace.load();
        document.fonts.add(fontFace);
        
        // Verify font is loaded
        const isLoaded = document.fonts.check('16px GentiumPlus');
        console.log('✅ GentiumPlus font loaded for canvas:', isLoaded);
        return isLoaded;
    } catch (error) {
        console.error('❌ Failed to load GentiumPlus for canvas:', error);
        return false;
    }
}

export // Function to render text to canvas and get image data
async function renderTextToCanvas(text: string, fontSize: number = 14): Promise<{dataUrl: string, width: number, height: number} | null> {
    try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        
        // Set up the font - try GentiumPlus first, then fallback
        const fontFamily = document.fonts.check('16px GentiumPlus') 
            ? 'GentiumPlus, "Gentium Plus", serif' 
            : 'serif';
        
        ctx.font = `${fontSize}px ${fontFamily}`;
        ctx.textBaseline = 'top';
        ctx.fillStyle = 'black';
        
        // Measure the text to size canvas appropriately
        const metrics = ctx.measureText(text);
        const textWidth = Math.ceil(metrics.width || text.length * fontSize * 0.6);
        const textHeight = Math.ceil(fontSize * 1.4); // Add padding
        
        // Set canvas size
        canvas.width = Math.max(textWidth + 8, 50); // Minimum width
        canvas.height = textHeight + 8;
        
        // Re-apply styling after canvas resize (resets context)
        ctx.font = `${fontSize}px ${fontFamily}`;
        ctx.textBaseline = 'top';
        ctx.fillStyle = 'black';
        
        // Fill background white
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw text
        ctx.fillStyle = 'black';
        ctx.fillText(text, 4, 4);
        
        return {
            dataUrl: canvas.toDataURL('image/png'),
            width: canvas.width / 72, // Convert pixels to inches (assuming 72 DPI)
            height: canvas.height / 72
        };
    } catch (error) {
        console.error('Error rendering text to canvas:', error);
        return null;
    }
}