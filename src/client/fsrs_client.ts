// Pure FSRS math functions shared with the client.
// Keep in sync with src/server/scheduler.ts.

const W: number[] = [0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575, 0.1192, 1.01925, 1.9395, 0.11, 0.29605, 2.2698, 0.2315, 2.9898, 0.51655, 0.6621];

function clamp(input: number, min: number, max: number): number {
    if (input >= max) return max;
    if (input <= min) return min;
    return input;
}

export function getInitialStability(G: 1 | 2 | 3 | 4): number {
    return W[G - 1];
}

export function getInitialDifficulty(G: 1 | 2 | 3 | 4): number {
    return clamp(W[4] - Math.exp(W[5] * (G - 1)) + 1, 1, 10);
}

export function recalculateRetrievability(lastReviewTime: Date, reviewedAt: Date, stability: number): number {
    const timeDiffDays = Math.max(0, (reviewedAt.getTime() - lastReviewTime.getTime()) / 86400000);
    const F = 19 / 81;
    const C = -0.5;
    return (1 + (F * timeDiffDays) / stability) ** C;
}
