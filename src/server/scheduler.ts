// scheduler.ts - Adapted from your FSRS implementation

// FSRS parameters (from your original code)
const W: number[] = [0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575, 0.1192, 1.01925, 1.9395, 0.11, 0.29605, 2.2698, 0.2315, 2.9898, 0.51655, 0.6621];

type CardRating = 1 | 2 | 3 | 4; // Forgot, hard, good, easy
type Timestamp = number;

// Simplified settings for now - can be expanded later
interface SchedulerSettings {
    retention: number; // Desired retention rate (0.0 to 1.0)
    dayRolloverDelay: number; // Milliseconds after midnight for day rollover
}

// Default settings
const DEFAULT_SETTINGS: SchedulerSettings = {
    retention: 0.9, // 90% retention
    dayRolloverDelay: 0 // Midnight rollover
};

// Interface matching your current database structure
interface CardForScheduling {
    card_id: number;
    deck: string;
    current_time_due: string;
    current_interval: number;
    current_retrievability: number;
    grade: 'pass' | 'hard' | 'fail';
    reviewed_at: Date;
    
    // Additional fields we might need from your database
    current_stability?: number;
    current_difficulty?: number;
}

interface ScheduledCard {
    card_id: number;
    new_time_due: Date;
    new_interval: number;
    new_retrievability: number;
    new_stability: number;
    new_difficulty: number;
    grade: string;
}

// Convert string grades to numeric ratings
function gradeToRating(grade: string): CardRating {
    switch (grade.toLowerCase()) {
        case 'pass': return 3; // Good
        case 'hard': return 2; // Hard  
        case 'fail': return 1; // Forgot
        default: return 1; // Default to forgot for safety
    }
}

// Core FSRS functions (adapted from your code)
function clamp(input: number, min: number, max: number): number {
    if (input >= max) return max;
    if (input <= min) return min;
    return input;
}

function clamp_d(D: number): number {
    return clamp(D, 1, 10);
}

function getInitialDifficulty(G: CardRating): number {
    return clamp_d(W[4] - (Math.E ** (W[5] * (G - 1))) + 1);
}

function getDeltaD(G: CardRating): number {
    return (0 - W[6]) * (G - 3);
}

function getDPrime(D: number, G: CardRating): number {
    return D + (getDeltaD(G) * ((10 - D) / 9));
}

function getReviewDifficulty(D: number, G: CardRating): number {
    return clamp_d((W[7] * getInitialDifficulty(4)) + ((1 - W[7]) * getDPrime(D, G)));
}

function getStabilityOnSuccess(S: number, D: number, R: number, G: CardRating): number {
    let t_d = 11 - D; // difficulty penalty
    let t_s = (S ** (0 - W[9]));
    let t_r = (Math.E ** (W[10] * (1 - R)) - 1);
    
    let H = 1; // Hard penalty
    if (G == 2) { 
        H = W[15];
    }

    let B = 1; // easy-recall bonus
    if (G == 4) { 
        B = W[16];
    }

    let e_w8 = (Math.E ** W[8]);
    let scalingFactor = 1 + (t_d * t_s * t_r * H * B * e_w8);

    return S * scalingFactor;
}

function getStabilityOnFailure(S: number, D: number, R: number): number {
    let d_f = D ** (0 - W[12]);
    let s_f = ((S + 1) ** W[13]) - 1;
    let r_f = Math.E ** (W[14] * (1 - R));
    let c_f = W[11];

    let newS = d_f * s_f * r_f * c_f;
    return Math.min(S, newS);
}

function updateInterval(stability: number, settings: SchedulerSettings): number {
    let F = (19/81);
    let C = -0.5;
    
    // Convert to milliseconds
    return stability * ((settings.retention ** (1/C)) - 1) / F * 86400000; // Convert days to milliseconds
}

function recalculateRetrievability(lastReviewTime: Date, reviewedAt: Date, stability: number): number {
    let timeDiffMs = reviewedAt.getTime() - lastReviewTime.getTime();
    let timeDiffDays = timeDiffMs / 86400000; // Convert to days
    
    let F = (19/81);
    let C = -0.5;

    return ((1 + ((F * timeDiffDays) / stability)) ** C);
}

// Main scheduling function
export async function rescheduleCards(
    cards: CardForScheduling[],
    reviewTimestamp: Date,
    settings: SchedulerSettings = DEFAULT_SETTINGS
): Promise<ScheduledCard[]> {
    console.log(`🔄 FSRS Scheduling ${cards.length} cards at ${reviewTimestamp.toISOString()}`);
    
    const scheduledCards: ScheduledCard[] = [];
    
    for (const card of cards) {
        try {
            const rating = gradeToRating(card.grade);
            const isFirstReview = card.current_interval <= 1; // Assume first review if interval is 1 day or less
            
            console.log(`📋 Processing card ${card.card_id}: grade="${card.grade}" (${rating}), interval=${card.current_interval}d`);
            
            // Initialize values for new cards or use existing values
            let stability: number;
            let difficulty: number;
            let retrievability: number;
            
            if (isFirstReview) {
                // First review - use FSRS initial values
                stability = W[rating - 1]; // W[0], W[1], W[2], or W[3] based on rating
                difficulty = getInitialDifficulty(rating);
                retrievability = 1; // Perfect recall at first review
                
                console.log(`🆕 First review: S=${stability.toFixed(3)}, D=${difficulty.toFixed(3)}, R=${retrievability.toFixed(3)}`);
            } else {
                // Subsequent review - update based on performance
                const oldStability = card.current_stability || W[2]; // Default to W[2] if missing
                const oldDifficulty = card.current_difficulty || 5; // Default to middle difficulty
                
                // Recalculate retrievability based on time since last review
                const lastReviewTime = new Date(card.current_time_due);
                lastReviewTime.setTime(lastReviewTime.getTime() - (card.current_interval * 24 * 60 * 60 * 1000));
                retrievability = recalculateRetrievability(lastReviewTime, reviewTimestamp, oldStability);
                
                // Update stability based on performance
                if (rating > 1) { // Passed
                    stability = getStabilityOnSuccess(oldStability, oldDifficulty, retrievability, rating);
                } else { // Failed
                    stability = getStabilityOnFailure(oldStability, oldDifficulty, retrievability);
                }
                
                // Update difficulty
                difficulty = getReviewDifficulty(oldDifficulty, rating);
                
                console.log(`🔄 Subsequent review: S=${oldStability.toFixed(3)}→${stability.toFixed(3)}, D=${oldDifficulty.toFixed(3)}→${difficulty.toFixed(3)}, R=${retrievability.toFixed(3)}`);
            }
            
            // Calculate new interval
            const newIntervalMs = updateInterval(stability, settings);
            let newIntervalDays = Math.max(1, Math.ceil(newIntervalMs / (24 * 60 * 60 * 1000))); // At least 1 day

            // Calculate new due date
            let newTimeDue = new Date(reviewTimestamp.getTime() + newIntervalMs);

            // New cards graded hard: push to start of next day so they don't reappear today
            if (isFirstReview && card.grade === 'hard') {
                const nextDay = new Date(reviewTimestamp);
                nextDay.setDate(nextDay.getDate() + 1);
                nextDay.setHours(0, 0, 0, 0);

                if (newTimeDue < nextDay) {
                    newTimeDue = nextDay;
                    newIntervalDays = Math.max(newIntervalDays, 1);
                    console.log(`⏭️ New card ${card.card_id} graded hard — pushed to next day: ${newTimeDue.toISOString()}`);
                }
            }
            
            // Reset retrievability to 1 since card was just reviewed
            const newRetrievability = 1;
            
            const scheduledCard: ScheduledCard = {
                card_id: card.card_id,
                new_time_due: newTimeDue,
                new_interval: newIntervalDays,
                new_retrievability: newRetrievability,
                new_stability: stability,
                new_difficulty: difficulty,
                grade: card.grade
            };
            
            scheduledCards.push(scheduledCard);
            
            console.log(`✅ Card ${card.card_id}: ${card.current_interval}d → ${newIntervalDays}d, due: ${newTimeDue.toISOString()}`);
            
        } catch (error) {
            console.error(`❌ Error scheduling card ${card.card_id}:`, error);
            throw error; // Re-throw to trigger transaction rollback
        }
    }
    
    console.log(`🎉 Successfully scheduled ${scheduledCards.length} cards using FSRS`);
    return scheduledCards;
}

// Utility function to get statistics about scheduling results
export function getSchedulingStats(scheduledCards: ScheduledCard[]) {
    const statsByGrade = scheduledCards.reduce((acc, card) => {
        if (!acc[card.grade]) {
            acc[card.grade] = [];
        }
        acc[card.grade].push(card.new_interval);
        return acc;
    }, {} as { [grade: string]: number[] });
    
    const stats = Object.entries(statsByGrade).map(([grade, intervals]) => ({
        grade,
        count: intervals.length,
        avgInterval: intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length,
        minInterval: Math.min(...intervals),
        maxInterval: Math.max(...intervals)
    }));
    
    return stats;
}

// Export settings for external configuration
export { SchedulerSettings, DEFAULT_SETTINGS };