import Papa from 'papaparse';

// Type definitions for the input CSV data
interface AnkiCard {
  card_id: number;
  note_id: number;
  deck_id: number;
  deck_name: string;
  template_ord: number;
  card_type: string;
  queue: string;
  due_date: string;
  interval_days: number;
  ease_factor: number;
  review_count: number;
  lapses: number;
  learning_steps_left: number;
  tags: string;
  Field_1: string;
  Field_2: string;
  Field_3: string;
  Field_4: string;
  Field_5: string;
  Field_6: string;
  Field_7: string;
  Field_8: string;
  Field_9: number | null;
  Field_10: number | null;
}

interface AnkiReview {
  review_datetime: string;
  card_id: number;
  button_pressed: string;
  new_interval_days: number;
  previous_interval_days: number;
  new_ease_factor: number;
  review_time_seconds: number;
  review_type: string;
}

// Type definitions for Synapdeck output
interface SynapdeckCard {
  card_id: number;
  note_id: number;
  deck: string;
  card_format: string;
  field_names: string[];
  field_values: string[];
  field_processing: string[];
  peers: number[];
  prereqs: number[];
  dependents: number[];
  created: Date;
  time_due: Date;
  interval: number;
  past_reviews: Date[];
  past_grades: number[];
  retrievability: number;
  stability: number;
  difficulty: number;
  reviewed_today: boolean;
  reviewed_yesterday: boolean;
  under_review: boolean;
  most_recent_grade: number;
  is_buried: boolean;
  is_only_buried_today: boolean;
  bury_tomorrow: boolean;
  is_suspended: boolean;
  last_reviewed: Date | null;
  primary_field: string;
}

interface SynapdeckNote {
  note_id: number;
  deck: string;
  note_type: string;
  field_names: string[];
  field_values: string[];
  created_at: Date;
}

class AnkiToSynapdeckConverter {
  private cards: AnkiCard[] = [];
  private reviews: AnkiReview[] = [];
  private reviewsByCardId: Map<number, AnkiReview[]> = new Map();

  // Load from File objects (browser upload)
  async loadFromFiles(cardsFile: File, reviewsFile: File): Promise<void> {
    const cardsContent = await cardsFile.text();
    const reviewsContent = await reviewsFile.text();
    return this.loadFromContent(cardsContent, reviewsContent);
  }

  // Load from string content
  async loadFromContent(cardsContent: string, reviewsContent: string): Promise<void> {
    // Parse cards CSV
    const cardsResult = Papa.parse<AnkiCard>(cardsContent, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      transformHeader: (header: string) => header.trim()
    });
    
    if (cardsResult.errors.length > 0) {
      console.warn('Cards CSV parsing errors:', cardsResult.errors);
    }
    
    this.cards = cardsResult.data.filter(card => card.card_id); // Filter out empty rows
    console.log(`Loaded ${this.cards.length} cards`);

    // Parse reviews CSV
    const reviewsResult = Papa.parse<AnkiReview>(reviewsContent, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      transformHeader: (header: string) => header.trim()
    });
    
    if (reviewsResult.errors.length > 0) {
      console.warn('Reviews CSV parsing errors:', reviewsResult.errors);
    }
    
    this.reviews = reviewsResult.data.filter(review => review.card_id); // Filter out empty rows
    console.log(`Loaded ${this.reviews.length} reviews`);

    // Group reviews by card_id for efficient lookup
    this.groupReviewsByCardId();
  }

  private groupReviewsByCardId(): void {
    for (const review of this.reviews) {
      if (!this.reviewsByCardId.has(review.card_id)) {
        this.reviewsByCardId.set(review.card_id, []);
      }
      this.reviewsByCardId.get(review.card_id)!.push(review);
    }

    // Sort reviews by datetime for each card
    for (const [cardId, reviews] of this.reviewsByCardId.entries()) {
      reviews.sort((a, b) => new Date(a.review_datetime).getTime() - new Date(b.review_datetime).getTime());
    }
  }

  private extractFieldData(card: AnkiCard): { fieldNames: string[], fieldValues: string[] } {
    const fieldNames: string[] = [];
    const fieldValues: string[] = [];
    
    // Map the numbered fields to meaningful names based on common Anki patterns
    const fieldMappings = [
      { key: 'Field_1', name: 'Front' },
      { key: 'Field_2', name: 'Type' },
      { key: 'Field_3', name: 'Back' },
      { key: 'Field_4', name: 'Pronunciation' },
      { key: 'Field_5', name: 'Extra1' },
      { key: 'Field_6', name: 'Notes' },
      { key: 'Field_7', name: 'Extra2' },
      { key: 'Field_8', name: 'Extra3' },
      { key: 'Field_9', name: 'Numeric1' },
      { key: 'Field_10', name: 'Numeric2' }
    ];

    for (const mapping of fieldMappings) {
      const value = card[mapping.key as keyof AnkiCard];
      if (value !== null && value !== undefined && value !== '') {
        fieldNames.push(mapping.name);
        fieldValues.push(String(value));
      }
    }

    return { fieldNames, fieldValues };
  }

  private mapButtonPressedToGrade(buttonPressed: string): number {
    // Map Anki button presses to grades (1-4 scale typically)
    switch (buttonPressed.toLowerCase()) {
      case 'again': return 1;
      case 'hard': return 2;
      case 'good': return 3;
      case 'easy': return 4;
      default: return 3; // Default to "good"
    }
  }

  private calculateRetrievability(card: AnkiCard, reviews: AnkiReview[]): number {
    // Simple heuristic: higher for cards with more successful reviews
    if (reviews.length === 0) return 0.9; // New card
    
    const recentReviews = reviews.slice(-5); // Last 5 reviews
    const avgGrade = recentReviews.reduce((sum, r) => sum + this.mapButtonPressedToGrade(r.button_pressed), 0) / recentReviews.length;
    
    return Math.min(0.95, Math.max(0.1, avgGrade / 4));
  }

  private calculateStability(intervalDays: number): number {
    // Convert interval to stability estimate (days)
    return Math.max(1, intervalDays * 0.8);
  }

  private calculateDifficulty(lapses: number, reviewCount: number): number {
    // Higher difficulty for cards with more lapses relative to reviews
    if (reviewCount === 0) return 0.5;
    return Math.min(0.9, Math.max(0.1, lapses / reviewCount + 0.3));
  }

  private isToday(date: Date): boolean {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  }

  private isYesterday(date: Date): boolean {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return date.toDateString() === yesterday.toDateString();
  }

  convertToSynapdeckCards(): SynapdeckCard[] {
    const synapdeckCards: SynapdeckCard[] = [];

    for (const card of this.cards) {
      const reviews = this.reviewsByCardId.get(card.card_id) || [];
      const { fieldNames, fieldValues } = this.extractFieldData(card);
      
      // Extract review dates and grades
      const pastReviews = reviews.map(r => new Date(r.review_datetime));
      const pastGrades = reviews.map(r => this.mapButtonPressedToGrade(r.button_pressed));
      
      // Get last review date
      const lastReviewed = reviews.length > 0 ? new Date(reviews[reviews.length - 1].review_datetime) : null;
      const mostRecentGrade = pastGrades.length > 0 ? pastGrades[pastGrades.length - 1] : 0;

      // Calculate scheduling parameters
      const retrievability = this.calculateRetrievability(card, reviews);
      const stability = this.calculateStability(card.interval_days);
      const difficulty = this.calculateDifficulty(card.lapses, card.review_count);

      const synapdeckCard: SynapdeckCard = {
        card_id: card.card_id,
        note_id: card.note_id,
        deck: card.deck_name,
        card_format: this.determineCardFormat(card.template_ord),
        field_names: fieldNames,
        field_values: fieldValues,
        field_processing: fieldNames.map(() => 'html'), // Assume HTML processing for all fields
        peers: [], // Would need additional logic to determine peer relationships
        prereqs: [], // Would need additional logic to determine prerequisites
        dependents: [], // Would need additional logic to determine dependents
        created: this.estimateCreatedDate(card, reviews),
        time_due: new Date(card.due_date),
        interval: card.interval_days * 24 * 60 * 60 * 1000, // Convert days to milliseconds
        past_reviews: pastReviews,
        past_grades: pastGrades,
        retrievability: retrievability,
        stability: stability,
        difficulty: difficulty,
        reviewed_today: lastReviewed ? this.isToday(lastReviewed) : false,
        reviewed_yesterday: lastReviewed ? this.isYesterday(lastReviewed) : false,
        under_review: card.queue === 'Review',
        most_recent_grade: mostRecentGrade,
        is_buried: card.queue === 'UserBuried' || card.queue === 'SchedBuried',
        is_only_buried_today: false, // Would need additional logic
        bury_tomorrow: false, // Would need additional logic
        is_suspended: card.queue === 'Suspended',
        last_reviewed: lastReviewed,
        primary_field: fieldValues[0] || ''
      };

      synapdeckCards.push(synapdeckCard);
    }

    return synapdeckCards;
  }

  convertToSynapdeckNotes(): SynapdeckNote[] {
    const notesMap = new Map<number, SynapdeckNote>();

    for (const card of this.cards) {
      if (!notesMap.has(card.note_id)) {
        const { fieldNames, fieldValues } = this.extractFieldData(card);
        
        const note: SynapdeckNote = {
          note_id: card.note_id,
          deck: card.deck_name,
          note_type: this.determineNoteType(card),
          field_names: fieldNames,
          field_values: fieldValues,
          created_at: this.estimateCreatedDate(card, this.reviewsByCardId.get(card.card_id) || [])
        };

        notesMap.set(card.note_id, note);
      }
    }

    return Array.from(notesMap.values());
  }

  private determineCardFormat(templateOrd: number): string {
    // Map template order to card format
    switch (templateOrd) {
      case 0: return 'forward';
      case 1: return 'reverse';
      default: return 'custom';
    }
  }

  private determineNoteType(card: AnkiCard): string {
    // Analyze the card structure to determine note type
    if (card.tags.includes('basic')) return 'Basic';
    if (card.tags.includes('cloze')) return 'Cloze';
    return 'Basic'; // Default
  }

  private estimateCreatedDate(card: AnkiCard, reviews: AnkiReview[]): Date {
    // If we have reviews, use the earliest review date minus some buffer
    if (reviews.length > 0) {
      const earliestReview = new Date(reviews[0].review_datetime);
      earliestReview.setDate(earliestReview.getDate() - 1); // Assume created 1 day before first review
      return earliestReview;
    }
    
    // Otherwise, estimate based on card ID (assuming timestamp-based IDs)
    const cardIdStr = card.card_id.toString();
    if (cardIdStr.length >= 10) {
      // Looks like a timestamp
      return new Date(parseInt(cardIdStr.substring(0, 10)) * 1000);
    }
    
    // Fallback to current date minus some time
    const fallback = new Date();
    fallback.setMonth(fallback.getMonth() - 6); // 6 months ago
    return fallback;
  }

  // Export methods for different formats
  exportAsJSON(): { cards: SynapdeckCard[], notes: SynapdeckNote[] } {
    return {
      cards: this.convertToSynapdeckCards(),
      notes: this.convertToSynapdeckNotes()
    };
  }

  exportAsSQL(): string {
    const cards = this.convertToSynapdeckCards();
    const notes = this.convertToSynapdeckNotes();
    
    let sql = '-- Synapdeck Import SQL\n\n';
    
    // Insert notes
    sql += 'INSERT INTO notes (note_id, deck, note_type, field_names, field_values, created_at) VALUES\n';
    const noteValues = notes.map(note => 
      `(${note.note_id}, '${note.deck.replace(/'/g, "''")}', '${note.note_type}', ` +
      `ARRAY[${note.field_names.map(n => `'${n.replace(/'/g, "''")}'`).join(',')}], ` +
      `ARRAY[${note.field_values.map(v => `'${v.replace(/'/g, "''")}'`).join(',')}], ` +
      `'${note.created_at.toISOString()}')`
    ).join(',\n');
    sql += noteValues + ';\n\n';
    
    // Insert cards
    sql += 'INSERT INTO cards (card_id, note_id, deck, card_format, field_names, field_values, field_processing, ' +
           'peers, prereqs, dependents, created, time_due, interval, past_reviews, past_grades, ' +
           'retrievability, stability, difficulty, reviewed_today, reviewed_yesterday, under_review, ' +
           'most_recent_grade, is_buried, is_only_buried_today, bury_tomorrow, is_suspended, ' +
           'last_reviewed, primary_field) VALUES\n';
           
    const cardValues = cards.map(card => {
      const pastReviewsArray = card.past_reviews.length > 0 ? 
        `ARRAY[${card.past_reviews.map(d => `'${d.toISOString()}'`).join(',')}]` : 'ARRAY[]::timestamp[]';
      const pastGradesArray = card.past_grades.length > 0 ? 
        `ARRAY[${card.past_grades.join(',')}]` : 'ARRAY[]::smallint[]';
      const lastReviewed = card.last_reviewed ? `'${card.last_reviewed.toISOString()}'` : 'NULL';
      
      return `(${card.card_id}, ${card.note_id}, '${card.deck.replace(/'/g, "''")}', '${card.card_format}', ` +
             `ARRAY[${card.field_names.map(n => `'${n.replace(/'/g, "''")}'`).join(',')}], ` +
             `ARRAY[${card.field_values.map(v => `'${v.replace(/'/g, "''")}'`).join(',')}], ` +
             `ARRAY[${card.field_processing.map(p => `'${p}'`).join(',')}], ` +
             `ARRAY[]::integer[], ARRAY[]::integer[], ARRAY[]::integer[], ` +
             `'${card.created.toISOString()}', '${card.time_due.toISOString()}', ${card.interval}, ` +
             `${pastReviewsArray}, ${pastGradesArray}, ` +
             `${card.retrievability}, ${card.stability}, ${card.difficulty}, ` +
             `${card.reviewed_today}, ${card.reviewed_yesterday}, ${card.under_review}, ` +
             `${card.most_recent_grade}, ${card.is_buried}, ${card.is_only_buried_today}, ` +
             `${card.bury_tomorrow}, ${card.is_suspended}, ${lastReviewed}, ` +
             `'${card.primary_field.replace(/'/g, "''")}')`
    }).join(',\n');
    
    sql += cardValues + ';';
    
    return sql;
  }
}

// Usage functions for different scenarios

// Function for string content (backward compatibility)
export async function convertAnkiToSynapdeck(cardsCSV: string, reviewsCSV: string): Promise<{
  cards: SynapdeckCard[],
  notes: SynapdeckNote[],
  sql: string
}> {
  const converter = new AnkiToSynapdeckConverter();
  
  await converter.loadFromContent(cardsCSV, reviewsCSV);
  
  const result = converter.exportAsJSON();
  const sql = converter.exportAsSQL();
  
  console.log(`Converted ${result.cards.length} cards and ${result.notes.length} notes`);
  
  return {
    cards: result.cards,
    notes: result.notes,
    sql: sql
  };
}

// Function for handling uploaded files
export async function convertUploadedFiles(cardsFile: File, reviewsFile: File): Promise<{
  cards: SynapdeckCard[],
  notes: SynapdeckNote[],
  sql: string
}> {
  const converter = new AnkiToSynapdeckConverter();
  
  await converter.loadFromFiles(cardsFile, reviewsFile);
  
  const result = converter.exportAsJSON();
  const sql = converter.exportAsSQL();
  
  console.log(`Converted ${result.cards.length} cards and ${result.notes.length} notes`);
  
  return {
    cards: result.cards,
    notes: result.notes,
    sql: sql
  };
}

export { AnkiToSynapdeckConverter, SynapdeckCard, SynapdeckNote };