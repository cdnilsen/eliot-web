interface DeckStatistic {
    deck: string;
    total_cards: number;
    cards_due_now: number;
    cards_due_today: number;
    cards_under_review: number;
    avg_interval: string;
    avg_retrievability: string;
}

interface HeatmapEntry {
    date: string;
    count: number;
}

interface HeatmapResponse {
    status: 'success' | 'error';
    past_reviews?: HeatmapEntry[];
    future_due?: HeatmapEntry[];
    today_due?: number;
    error?: string;
}

let pieChart: any = null;
let statsInitialized = false;

// Colors ordered to maximize contrast between adjacent slices
const PIE_COLORS = [
    '#4a90d9', // blue
    '#f0932b', // orange
    '#30a14e', // green
    '#e74c3c', // red
    '#9b59b6', // purple
    '#f9ca24', // yellow
    '#4ecdc4', // teal
    '#ff6b9d', // pink
    '#2c3e50', // dark blue-gray
    '#1abc9c', // turquoise
    '#d35400', // burnt orange
    '#8e44ad', // violet
    '#27ae60', // emerald
    '#c0392b', // dark red
    '#3498db', // light blue
    '#f39c12', // gold
];

async function fetchDeckStatistics(): Promise<DeckStatistic[]> {
    const response = await fetch('/deck_statistics');
    const data = await response.json();
    if (data.status === 'success') {
        return data.deck_statistics;
    }
    throw new Error(data.error || 'Failed to fetch deck statistics');
}

async function fetchHeatmapData(): Promise<HeatmapResponse> {
    const response = await fetch('/review_heatmap');
    return await response.json();
}

function createPieChart(stats: DeckStatistic[]): void {
    const ctx = document.getElementById('deckPieChart') as HTMLCanvasElement;
    if (!ctx) return;

    const Chart = (window as any).Chart;
    if (!Chart) {
        setTimeout(() => createPieChart(stats), 100);
        return;
    }

    if (!Chart._registered) {
        Chart.register(
            Chart.ArcElement,
            Chart.Tooltip,
            Chart.Legend
        );
        Chart._registered = true;
    }

    if (pieChart) {
        pieChart.destroy();
        pieChart = null;
    }

    // Sort by total_cards descending
    const sortedStats = [...stats].sort((a, b) => b.total_cards - a.total_cards);
    console.log('Sorted deck stats:', sortedStats.map(s => `${s.deck}: ${s.total_cards}`));

    const labels = sortedStats.map(s => s.deck);
    const data = sortedStats.map(s => s.total_cards);
    const total = data.reduce((a, b) => a + b, 0);

    // Update the heading to include total card count
    const titleEl = document.getElementById('cardsByDeckTitle');
    if (titleEl) {
        titleEl.textContent = `${total} Cards by Deck`;
    }

    pieChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: PIE_COLORS.slice(0, labels.length),
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            rotation: 0, // Start at 12 o'clock (top)
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        font: { size: 13 },
                        sort: (a: any, b: any) => a.index - b.index,  // Preserve data order (descending by card count)
                        generateLabels: function(chart: any) {
                            const dataset = chart.data.datasets[0];
                            return chart.data.labels.map((label: string, i: number) => {
                                const count = dataset.data[i];
                                const pct = ((count / total) * 100).toFixed(1);
                                return {
                                    text: `${label}: ${count} cards (${pct}%)`,
                                    fillStyle: dataset.backgroundColor[i],
                                    strokeStyle: dataset.borderColor,
                                    lineWidth: dataset.borderWidth,
                                    hidden: !chart.getDataVisibility(i),
                                    index: i
                                };
                            });
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context: any) {
                            const count = context.raw as number;
                            const pct = ((count / total) * 100).toFixed(1);
                            return `${context.label}: ${count} cards (${pct}%)`;
                        }
                    }
                }
            }
        }
    });
}

function createHeatmap(pastReviews: HeatmapEntry[], futureDue: HeatmapEntry[], todayDue: number): void {
    const container = document.getElementById('heatmapContainer');
    if (!container) return;

    // Build a map of date -> count covering past year + future year
    const dateMap = new Map<string, { count: number; type: 'past' | 'today' | 'future' }>();

    for (const entry of pastReviews) {
        const d = new Date(entry.date).toISOString().slice(0, 10);
        dateMap.set(d, { count: entry.count, type: 'past' });
    }

    const _now = new Date();
    const todayStr = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}-${String(_now.getDate()).padStart(2, '0')}`;
    dateMap.set(todayStr, { count: todayDue, type: 'today' });

    for (const entry of futureDue) {
        const d = new Date(entry.date).toISOString().slice(0, 10);
        dateMap.set(d, { count: entry.count, type: 'future' });
    }

    // Determine range: 6 months back to 6 months forward
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1);
    // Align to Sunday
    startDate.setDate(startDate.getDate() - startDate.getDay());

    const endDate = new Date(now.getFullYear(), now.getMonth() + 6, 0);
    // Align to Saturday
    endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));

    // Find max count for color scaling (separate for past and future for better contrast)
    let maxPastCount = 1;
    let maxFutureCount = 1;
    dateMap.forEach(v => {
        if (v.type === 'past' && v.count > maxPastCount) maxPastCount = v.count;
        if (v.type === 'future' && v.count > maxFutureCount) maxFutureCount = v.count;
    });

    // Build weeks
    const weeks: { date: Date; dateStr: string; count: number; type: string }[][] = [];
    let currentWeek: typeof weeks[0] = [];
    const cursor = new Date(startDate);

    while (cursor <= endDate) {
        const dateStr = cursor.toISOString().slice(0, 10);
        const entry = dateMap.get(dateStr);
        currentWeek.push({
            date: new Date(cursor),
            dateStr,
            count: entry?.count || 0,
            type: entry?.type || (cursor < now ? 'past' : 'future')
        });
        if (currentWeek.length === 7) {
            weeks.push(currentWeek);
            currentWeek = [];
        }
        cursor.setDate(cursor.getDate() + 1);
    }
    if (currentWeek.length > 0) weeks.push(currentWeek);

    // Render
    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const cellSize = 14;
    const cellGap = 3;
    const labelWidth = 30;
    const headerHeight = 20;
    const totalWidth = labelWidth + weeks.length * (cellSize + cellGap);
    const totalHeight = headerHeight + 7 * (cellSize + cellGap);

    let html = `<div class="heatmap-scroll"><svg width="${totalWidth}" height="${totalHeight}" class="heatmap-svg">`;

    // Day labels
    for (let d = 0; d < 7; d++) {
        if (d % 2 === 1) {
            const y = headerHeight + d * (cellSize + cellGap) + cellSize - 2;
            html += `<text x="0" y="${y}" class="heatmap-day-label">${dayLabels[d]}</text>`;
        }
    }

    // Month labels
    let lastMonth = -1;
    for (let w = 0; w < weeks.length; w++) {
        const firstDay = weeks[w][0];
        if (firstDay) {
            const month = firstDay.date.getMonth();
            if (month !== lastMonth) {
                lastMonth = month;
                const x = labelWidth + w * (cellSize + cellGap);
                const monthName = firstDay.date.toLocaleString('en-US', { month: 'short' });
                html += `<text x="${x}" y="12" class="heatmap-month-label">${monthName}</text>`;
            }
        }
    }

    // Cells
    const tooltip = document.getElementById('heatmapTooltip');

    for (let w = 0; w < weeks.length; w++) {
        for (let d = 0; d < weeks[w].length; d++) {
            const cell = weeks[w][d];
            const x = labelWidth + w * (cellSize + cellGap);
            const y = headerHeight + d * (cellSize + cellGap);
            const maxCount = cell.type === 'future' ? maxFutureCount : maxPastCount;
            const color = getCellColor(cell.count, maxCount, cell.type, cell.dateStr === todayStr);

            html += `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" rx="2" ry="2" `
                + `fill="${color}" class="heatmap-cell" `
                + `data-date="${cell.dateStr}" data-count="${cell.count}" data-type="${cell.type}"/>`;
        }
    }

    html += `</svg></div>`;

    // Legend
    html += `<div class="heatmap-legend">
        <span class="heatmap-legend-label">Past:</span>
        <span class="heatmap-legend-cell" style="background:${getCellColor(0, maxPastCount, 'past', false)}"></span>
        <span class="heatmap-legend-cell" style="background:${getCellColor(maxPastCount * 0.25, maxPastCount, 'past', false)}"></span>
        <span class="heatmap-legend-cell" style="background:${getCellColor(maxPastCount * 0.5, maxPastCount, 'past', false)}"></span>
        <span class="heatmap-legend-cell" style="background:${getCellColor(maxPastCount, maxPastCount, 'past', false)}"></span>
        <span style="margin-left:12px" class="heatmap-legend-label">Future:</span>
        <span class="heatmap-legend-cell" style="background:${getCellColor(0, maxFutureCount, 'future', false)}"></span>
        <span class="heatmap-legend-cell" style="background:${getCellColor(maxFutureCount * 0.25, maxFutureCount, 'future', false)}"></span>
        <span class="heatmap-legend-cell" style="background:${getCellColor(maxFutureCount * 0.5, maxFutureCount, 'future', false)}"></span>
        <span class="heatmap-legend-cell" style="background:${getCellColor(maxFutureCount, maxFutureCount, 'future', false)}"></span>
        <span style="margin-left:12px" class="heatmap-legend-label">Today:</span>
        <span class="heatmap-legend-cell" style="background:#ffc658"></span>
    </div>`;

    container.innerHTML = html;

    // Attach tooltip events
    container.querySelectorAll('.heatmap-cell').forEach(el => {
        el.addEventListener('mouseenter', (e) => {
            if (!tooltip) return;
            const rect = el as SVGRectElement;
            const date = rect.getAttribute('data-date') || '';
            const count = parseInt(rect.getAttribute('data-count') || '0');
            const type = rect.getAttribute('data-type') || '';

            const dateObj = new Date(date + 'T00:00:00');
            const dateLabel = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

            let label: string;
            if (type === 'today') {
                label = `${count} card${count !== 1 ? 's' : ''} due today`;
            } else if (type === 'past') {
                label = `${count} card${count !== 1 ? 's' : ''} reviewed`;
            } else {
                label = `${count} card${count !== 1 ? 's' : ''} due`;
            }

            tooltip.innerHTML = `<strong>${dateLabel}</strong><br>${label}`;
            tooltip.style.display = 'block';
            const mouseEvent = e as MouseEvent;
            tooltip.style.left = mouseEvent.pageX + 10 + 'px';
            tooltip.style.top = mouseEvent.pageY - 30 + 'px';
        });
        el.addEventListener('mouseleave', () => {
            if (tooltip) tooltip.style.display = 'none';
        });
    });
}

function getCellColor(count: number, maxCount: number, type: string, isToday: boolean): string {
    if (isToday) return '#ffc658';
    if (count === 0) return '#ebedf0';

    const intensity = Math.min(count / maxCount, 1);
    const level = Math.ceil(intensity * 4); // 1-4

    if (type === 'future') {
        // Blue shades for future
        const blues = ['#c6dbef', '#79b8f8', '#4a90d9', '#1a5fb4'];
        return blues[level - 1];
    } else {
        // Green shades for past (GitHub-style)
        const greens = ['#9be9a8', '#40c463', '#30a14e', '#216e39'];
        return greens[level - 1];
    }
}

export async function setupStatsTab(): Promise<void> {
    if (statsInitialized) return;
    statsInitialized = true;

    try {
        const [stats, heatmapData] = await Promise.all([
            fetchDeckStatistics(),
            fetchHeatmapData()
        ]);

        createPieChart(stats);

        if (heatmapData.status === 'success' && heatmapData.past_reviews && heatmapData.future_due) {
            createHeatmap(heatmapData.past_reviews, heatmapData.future_due, heatmapData.today_due || 0);
        }
    } catch (err) {
        console.error('Error setting up stats tab:', err);
    }
}
