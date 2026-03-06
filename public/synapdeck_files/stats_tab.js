let pieChart = null;
let lineChart = null;
let subTabsSetup = false;
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
async function fetchReviewHistory() {
    const response = await fetch('/review_history');
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
                        sort: (a, b) => a.index - b.index, // Preserve data order (descending by card count)
                        generateLabels: function (chart) {
                            const dataset = chart.data.datasets[0];
                            return chart.data.labels.map((label, i) => {
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
function createLineChart(entries) {
    const ctx = document.getElementById('reviewsLineChart');
    if (!ctx)
        return;
    const Chart = window.Chart;
    if (!Chart) {
        setTimeout(() => createLineChart(entries), 100);
        return;
    }
    // Build date range: last 90 days up to today
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 89);
    const dates = [];
    const cursor = new Date(startDate);
    while (cursor <= today) {
        dates.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`);
        cursor.setDate(cursor.getDate() + 1);
    }
    const dateSet = new Set(dates);
    // Collect decks and build lookup maps
    const deckSet = new Set();
    for (const e of entries)
        deckSet.add(e.deck);
    const decks = Array.from(deckSet).sort();
    const deckDateMap = new Map();
    const totalDateMap = new Map();
    for (const deck of decks)
        deckDateMap.set(deck, new Map());
    for (const e of entries) {
        if (!dateSet.has(e.date))
            continue;
        deckDateMap.get(e.deck)?.set(e.date, e.count);
        totalDateMap.set(e.date, (totalDateMap.get(e.date) || 0) + e.count);
    }
    // Build checkboxes
    const checkboxContainer = document.getElementById('deckCheckboxes');
    if (checkboxContainer) {
        let html = `<label class="deck-checkbox-label">
            <input type="checkbox" id="line-cb-total" checked>
            <span class="deck-cb-swatch" style="background:#555"></span>
            <span>Total</span>
        </label>`;
        decks.forEach((deck, i) => {
            const color = PIE_COLORS[i % PIE_COLORS.length];
            html += `<label class="deck-checkbox-label">
                <input type="checkbox" id="line-cb-${i}" data-deck="${deck}" checked>
                <span class="deck-cb-swatch" style="background:${color}"></span>
                <span>${deck}</span>
            </label>`;
        });
        checkboxContainer.innerHTML = html;
    }
    // Build cumulative datasets
    function cumsum(values) {
        let running = 0;
        return values.map(v => (running += v));
    }
    const totalDataset = {
        label: 'Total',
        data: cumsum(dates.map(d => totalDateMap.get(d) || 0)),
        borderColor: '#555',
        backgroundColor: '#55555515',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.3,
        fill: false,
    };
    const deckDatasets = decks.map((deck, i) => ({
        label: deck,
        data: cumsum(dates.map(d => deckDateMap.get(deck)?.get(d) || 0)),
        borderColor: PIE_COLORS[i % PIE_COLORS.length],
        backgroundColor: PIE_COLORS[i % PIE_COLORS.length] + '15',
        borderWidth: 1.5,
        pointRadius: 0,
        tension: 0.3,
        fill: false,
    }));
    if (lineChart) {
        lineChart.destroy();
        lineChart = null;
    }
    // Format dates for display (e.g. "Mar 1")
    const displayLabels = dates.map(d => {
        const dt = new Date(d + 'T00:00:00');
        return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });
    lineChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: displayLabels,
            datasets: [totalDataset, ...deckDatasets]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (context) => `${context.dataset.label}: ${context.raw}`
                    }
                }
            },
            scales: {
                x: {
                    ticks: { maxTicksLimit: 12, maxRotation: 0 }
                },
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'Cumulative Cards Reviewed' }
                }
            }
        }
    });
    // Wire up checkboxes
    const totalCb = document.getElementById('line-cb-total');
    if (totalCb) {
        totalCb.addEventListener('change', () => {
            lineChart.data.datasets[0].hidden = !totalCb.checked;
            lineChart.update();
        });
    }
    decks.forEach((_, i) => {
        const cb = document.getElementById(`line-cb-${i}`);
        if (cb) {
            cb.addEventListener('change', () => {
                lineChart.data.datasets[i + 1].hidden = !cb.checked;
                lineChart.update();
            });
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
        dateMap.set(entry.date, { count: entry.count, type: 'past' });
    }
    const _now = new Date();
    const todayStr = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}-${String(_now.getDate()).padStart(2, '0')}`;
    dateMap.set(todayStr, { count: todayDue, type: 'today' });
    for (const entry of futureDue) {
        // Skip overdue entries (date in the past) — they belong in the bar chart's
        // "Overdue" bucket, not as blue cells on past calendar days.
        if (entry.date <= todayStr)
            continue;
        dateMap.set(entry.date, { count: entry.count, type: 'future' });
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
        if (v.type === 'past' && v.count > maxPastCount)
            maxPastCount = v.count;
        if (v.type === 'future' && v.count > maxFutureCount)
            maxFutureCount = v.count;
    });
    // Build weeks
    const weeks = [];
    let currentWeek = [];
    const cursor = new Date(startDate);
    while (cursor <= endDate) {
        const dateStr = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
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
function setupStatsSubTabs() {
    if (subTabsSetup)
        return;
    subTabsSetup = true;
    const tabs = document.querySelectorAll('.stats-sub-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const panelId = tab.dataset.panel;
            document.querySelectorAll('.stats-panel').forEach(panel => {
                panel.style.display =
                    panel.id === `stats-panel-${panelId}` ? '' : 'none';
            });
        });
    });
}
export async function setupStatsTab() {
    setupStatsSubTabs();
    try {
        const [stats, heatmapData, historyData] = await Promise.all([
            fetchDeckStatistics(),
            fetchHeatmapData(),
            fetchReviewHistory()
        ]);
        createPieChart(stats);
        if (heatmapData.status === 'success' && heatmapData.past_reviews && heatmapData.future_due) {
            createHeatmap(heatmapData.past_reviews, heatmapData.future_due, heatmapData.today_due || 0);
        }
        if (historyData.status === 'success' && historyData.entries) {
            createLineChart(historyData.entries);
        }
    }
    catch (err) {
        console.error('Error setting up stats tab:', err);
    }
}
//# sourceMappingURL=stats_tab.js.map