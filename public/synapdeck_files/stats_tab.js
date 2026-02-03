let pieChart = null;
let statsInitialized = false;
const PIE_COLORS = [
    '#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff7f', '#ff6b6b',
    '#4ecdc4', '#45b7d1', '#f9ca24', '#f0932b', '#eb4d4b', '#6c5ce7'
];
async function fetchDeckStatistics() {
    const response = await fetch('/deck_statistics');
    const data = await response.json();
    if (data.status === 'success') {
        return data.deck_statistics;
    }
    throw new Error(data.error || 'Failed to fetch deck statistics');
}
async function fetchHeatmapData() {
    const response = await fetch('/review_heatmap');
    return await response.json();
}
function createPieChart(stats) {
    const ctx = document.getElementById('deckPieChart');
    if (!ctx)
        return;
    const Chart = window.Chart;
    if (!Chart) {
        setTimeout(() => createPieChart(stats), 100);
        return;
    }
    if (!Chart._registered) {
        Chart.register(Chart.ArcElement, Chart.Tooltip, Chart.Legend);
        Chart._registered = true;
    }
    if (pieChart) {
        pieChart.destroy();
        pieChart = null;
    }
    const labels = stats.map(s => s.deck);
    const data = stats.map(s => s.total_cards);
    const total = data.reduce((a, b) => a + b, 0);
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
            plugins: {
                legend: {
                    position: 'right',
                    labels: { font: { size: 13 } }
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            const count = context.raw;
                            const pct = ((count / total) * 100).toFixed(1);
                            return `${context.label}: ${count} cards (${pct}%)`;
                        }
                    }
                }
            }
        }
    });
}
function createHeatmap(pastReviews, futureDue, todayDue) {
    const container = document.getElementById('heatmapContainer');
    if (!container)
        return;
    // Build a map of date -> count covering past year + future year
    const dateMap = new Map();
    for (const entry of pastReviews) {
        const d = new Date(entry.date).toISOString().slice(0, 10);
        dateMap.set(d, { count: entry.count, type: 'past' });
    }
    const todayStr = new Date().toISOString().slice(0, 10);
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
    // Find max count for color scaling
    let maxCount = 1;
    dateMap.forEach(v => { if (v.count > maxCount)
        maxCount = v.count; });
    // Build weeks
    const weeks = [];
    let currentWeek = [];
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
    if (currentWeek.length > 0)
        weeks.push(currentWeek);
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
            const color = getCellColor(cell.count, maxCount, cell.type, cell.dateStr === todayStr);
            html += `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" rx="2" ry="2" `
                + `fill="${color}" class="heatmap-cell" `
                + `data-date="${cell.dateStr}" data-count="${cell.count}" data-type="${cell.type}"/>`;
        }
    }
    html += `</svg></div>`;
    // Legend
    html += `<div class="heatmap-legend">
        <span class="heatmap-legend-label">Less</span>
        <span class="heatmap-legend-cell" style="background:${getCellColor(0, maxCount, 'past', false)}"></span>
        <span class="heatmap-legend-cell" style="background:${getCellColor(maxCount * 0.25, maxCount, 'past', false)}"></span>
        <span class="heatmap-legend-cell" style="background:${getCellColor(maxCount * 0.5, maxCount, 'past', false)}"></span>
        <span class="heatmap-legend-cell" style="background:${getCellColor(maxCount * 0.75, maxCount, 'past', false)}"></span>
        <span class="heatmap-legend-cell" style="background:${getCellColor(maxCount, maxCount, 'past', false)}"></span>
        <span class="heatmap-legend-label">More</span>
        <span style="margin-left:16px" class="heatmap-legend-label">Past reviews</span>
        <span class="heatmap-legend-cell" style="background:#9be9a8"></span>
        <span class="heatmap-legend-label">Future due</span>
        <span class="heatmap-legend-cell" style="background:#79b8f8"></span>
    </div>`;
    container.innerHTML = html;
    // Attach tooltip events
    container.querySelectorAll('.heatmap-cell').forEach(el => {
        el.addEventListener('mouseenter', (e) => {
            if (!tooltip)
                return;
            const rect = el;
            const date = rect.getAttribute('data-date') || '';
            const count = parseInt(rect.getAttribute('data-count') || '0');
            const type = rect.getAttribute('data-type') || '';
            const dateObj = new Date(date + 'T00:00:00');
            const dateLabel = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
            let label;
            if (type === 'today') {
                label = `${count} card${count !== 1 ? 's' : ''} due today`;
            }
            else if (type === 'past') {
                label = `${count} card${count !== 1 ? 's' : ''} reviewed`;
            }
            else {
                label = `${count} card${count !== 1 ? 's' : ''} due`;
            }
            tooltip.innerHTML = `<strong>${dateLabel}</strong><br>${label}`;
            tooltip.style.display = 'block';
            const mouseEvent = e;
            tooltip.style.left = mouseEvent.pageX + 10 + 'px';
            tooltip.style.top = mouseEvent.pageY - 30 + 'px';
        });
        el.addEventListener('mouseleave', () => {
            if (tooltip)
                tooltip.style.display = 'none';
        });
    });
}
function getCellColor(count, maxCount, type, isToday) {
    if (isToday)
        return '#ffc658';
    if (count === 0)
        return '#ebedf0';
    const intensity = Math.min(count / maxCount, 1);
    const level = Math.ceil(intensity * 4); // 1-4
    if (type === 'future') {
        // Blue shades for future
        const blues = ['#c6dbef', '#79b8f8', '#4a90d9', '#1a5fb4'];
        return blues[level - 1];
    }
    else {
        // Green shades for past (GitHub-style)
        const greens = ['#9be9a8', '#40c463', '#30a14e', '#216e39'];
        return greens[level - 1];
    }
}
export async function setupStatsTab() {
    if (statsInitialized)
        return;
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
    }
    catch (err) {
        console.error('Error setting up stats tab:', err);
    }
}
//# sourceMappingURL=stats_tab.js.map