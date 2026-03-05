export interface ReviewForecastData {
    date: string;
    [deck: string]: number | string;
}

interface HeatmapFutureDue {
    date: string;
    count: number;
    decks: Record<string, number>;
}

interface HeatmapResponse {
    status: 'success' | 'error';
    past_reviews?: { date: string; count: number }[];
    future_due?: HeatmapFutureDue[];
    today_due?: number;
    today_decks?: Record<string, number>;
    error?: string;
}

export interface ReviewForecastOptions {
    reviewForecastChart: any;
    availableDecks: string[];
    selectedDecks: string[];
    cachedHeatmap: HeatmapResponse | null;
}

function getBlankReviewForecast(): ReviewForecastOptions {
    return {
        reviewForecastChart: null,
        availableDecks: [],
        selectedDecks: [],
        cachedHeatmap: null
    };
}

const DECK_COLORS = [
    '#ff4444', // Red for overdue cards (first color)
    '#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff7f', '#ff6b6b',
    '#4ecdc4', '#45b7d1', '#f9ca24', '#f0932b', '#eb4d4b', '#6c5ce7'
];

async function fetchHeatmapData(): Promise<HeatmapResponse> {
    const response = await fetch('/review_heatmap');
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
}

function getDaysAhead(): number {
    const daysSelect = document.getElementById('forecastDays') as HTMLSelectElement;
    if (daysSelect?.value) {
        const parsed = parseInt(daysSelect.value);
        if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    return 14;
}

function transformHeatmapToForecast(
    heatmapData: HeatmapResponse,
    daysAhead: number
): { forecastData: ReviewForecastData[]; decks: string[] } {
    const allDecks = new Set<string>();

    if (heatmapData.today_decks) {
        Object.keys(heatmapData.today_decks).forEach(d => allDecks.add(d));
    }

    const futureDue = (heatmapData.future_due || []).slice(0, daysAhead);
    futureDue.forEach(entry => {
        Object.keys(entry.decks || {}).forEach(d => allDecks.add(d));
    });

    const decks = Array.from(allDecks).sort();
    const forecastData: ReviewForecastData[] = [];

    if ((heatmapData.today_due || 0) > 0) {
        const overdueEntry: ReviewForecastData = { date: 'Overdue' };
        decks.forEach(deck => {
            overdueEntry[deck] = heatmapData.today_decks?.[deck] || 0;
        });
        forecastData.push(overdueEntry);
    }

    futureDue.forEach(entry => {
        const item: ReviewForecastData = { date: entry.date };
        decks.forEach(deck => {
            item[deck] = entry.decks?.[deck] || 0;
        });
        forecastData.push(item);
    });

    return { forecastData, decks };
}

interface ChartDataset {
    label: string,
    data: number[],
    backgroundColor: string,
    borderColor: string,
    borderWidth: number
}

export function createReviewForecastChart(data: ReviewForecastData[], decks: string[], chartData: ReviewForecastOptions) {
    const ctx = document.getElementById('reviewForecastChart') as HTMLCanvasElement;

    if (!ctx) {
        console.error('Canvas element not found');
        return;
    }

    const Chart = window.Chart;
    if (!Chart) {
        console.log('Chart.js not ready, waiting...');
        setTimeout(() => createReviewForecastChart(data, decks, chartData), 100);
        return;
    }

    // Register Chart.js components if not already done
    if (!Chart._registered) {
        Chart.register(
            Chart.CategoryScale,
            Chart.LinearScale,
            Chart.BarElement,
            Chart.Title,
            Chart.Tooltip,
            Chart.Legend
        );
        Chart._registered = true;
    }

    // Destroy existing chart if it exists
    if (chartData.reviewForecastChart) {
        chartData.reviewForecastChart.destroy();
        chartData.reviewForecastChart = null;
    }

    // Get today's date for comparison (local midnight)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Parse a YYYY-MM-DD string as local midnight (not UTC midnight).
    // new Date('2026-02-26') would give Feb 25 18:00 CST due to UTC parsing rules,
    // shifting every bar one day back. Using date parts avoids this.
    function parseDateLocal(dateStr: string): Date {
        const [y, m, d] = dateStr.split('-').map(Number);
        return new Date(y, m - 1, d);
    }

    // Create labels and determine which dates are overdue
    const labels = data.map(item => {
        if (item.date === 'Overdue') {
            return 'OVERDUE';
        } else {
            const itemDate = parseDateLocal(item.date);
            if (itemDate < today) {
                return `${itemDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} (OVERDUE)`;
            } else {
                return itemDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            }
        }
    });

    // Check if each data point is overdue
    const isOverdueArray = data.map(item => {
        if (item.date === 'Overdue') return true;
        return parseDateLocal(item.date) < today;
    });

    // Prepare datasets (one for each selected deck)
    const datasets: ChartDataset[] = chartData.selectedDecks.map((deck, index) => ({
        label: deck,
        data: data.map(item => item[deck] as number || 0),
        backgroundColor: DECK_COLORS[index % DECK_COLORS.length],
        borderColor: DECK_COLORS[index % DECK_COLORS.length],
        borderWidth: 1
    }));

    // Create the chart
    chartData.reviewForecastChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Review Forecast by Deck',
                    font: { size: 16, weight: 'bold' }
                },
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        title: function(tooltipItems: any[]) {
                            const item = tooltipItems[0];
                            const dataIndex = item.dataIndex;
                            const originalDate = data[dataIndex].date;

                            if (originalDate === 'Overdue' || isOverdueArray[dataIndex]) {
                                return 'OVERDUE CARDS';
                            } else {
                                return parseDateLocal(originalDate).toLocaleDateString('en-US', {
                                    weekday: 'long',
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                });
                            }
                        },
                        label: function(context: any) {
                            const deck = context.dataset.label;
                            const value = context.raw;
                            const dataIndex = context.dataIndex;
                            const originalDate = data[dataIndex].date;
                            const isThisOverdue = originalDate === 'Overdue' || isOverdueArray[dataIndex];

                            if (isThisOverdue && value > 0) {
                                return `${deck}: ${value} cards (OVERDUE!)`;
                            } else {
                                return `${deck}: ${value} cards`;
                            }
                        },
                        afterLabel: function(context: any) {
                            const dataIndex = context.dataIndex;
                            const isThisOverdue = data[dataIndex].date === 'Overdue' || isOverdueArray[dataIndex];

                            if (isThisOverdue && context.raw > 0) {
                                return 'These cards are past due and ready for review';
                            }
                            return '';
                        },
                        footer: function(tooltipItems: any[]) {
                            const total = tooltipItems.reduce((sum: number, item: any) => sum + (Number(item.raw) || 0), 0);
                            return `Total: ${total} card${total !== 1 ? 's' : ''}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    stacked: true,
                    title: {
                        display: true,
                        text: 'Date'
                    },
                    ticks: {
                        color: function(context: any) {
                            const dataIndex = context.index;
                            if (data[dataIndex] && (data[dataIndex].date === 'Overdue' || isOverdueArray[dataIndex])) {
                                return '#ff0000';
                            }
                            return '#666666';
                        },
                        font: function(context: any) {
                            const dataIndex = context.index;
                            if (data[dataIndex] && (data[dataIndex].date === 'Overdue' || isOverdueArray[dataIndex])) {
                                return { weight: 'bold', size: 12 };
                            }
                            return { weight: 'normal', size: 12 };
                        }
                    }
                },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Number of Cards'
                    },
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

function hasOverdueData(forecastData: ReviewForecastData[]): boolean {
    return forecastData.length > 0 && forecastData[0].date === 'Overdue';
}

function calculateOverdueTotals(forecastData: ReviewForecastData[], decks: string[]): { [deck: string]: number } {
    const totals: { [deck: string]: number } = {};

    if (hasOverdueData(forecastData)) {
        const overdueData = forecastData[0];
        decks.forEach(deck => {
            totals[deck] = overdueData[deck] as number || 0;
        });
    }

    return totals;
}

function updateForecastStats(forecastData: ReviewForecastData[], totalReviews: number, decks: string[]) {
    const statsEl = document.getElementById('forecastStats');
    if (!statsEl) return;

    let statsHTML = `<div class="forecast-summary">
        <h4>Forecast Summary</h4>
        <p><strong>Total Reviews:</strong> ${totalReviews}</p>
    `;

    if (hasOverdueData(forecastData)) {
        const overdueTotals = calculateOverdueTotals(forecastData, decks);
        const totalOverdue = Object.values(overdueTotals).reduce((sum, count) => sum + count, 0);

        if (totalOverdue > 0) {
            statsHTML += `
                <div class="overdue-summary" style="color: #ff4444; font-weight: bold; margin-top: 10px;">
                    <p>🔴 <strong>Overdue Cards:</strong> ${totalOverdue}</p>
                    <div style="font-size: 12px; margin-left: 20px;">
            `;

            Object.entries(overdueTotals).forEach(([deck, count]) => {
                if (count > 0) {
                    statsHTML += `<div>${deck}: ${count}</div>`;
                }
            });

            statsHTML += `
                    </div>
                </div>
            `;
        }
    }

    statsHTML += `</div>`;
    statsEl.innerHTML = statsHTML;
}

function renderFromCache(chartData: ReviewForecastOptions) {
    if (!chartData.cachedHeatmap) return;
    const daysAhead = getDaysAhead();
    const { forecastData, decks } = transformHeatmapToForecast(chartData.cachedHeatmap, daysAhead);
    chartData.availableDecks = decks;
    chartData.selectedDecks = [...decks];
    createDeckCheckboxes(chartData);
    const totalReviews = forecastData.reduce((sum, item) =>
        sum + decks.reduce((s, d) => s + (item[d] as number || 0), 0), 0);
    createReviewForecastChart(forecastData, decks, chartData);
    updateForecastStats(forecastData, totalReviews, decks);
}

// Function to update deck selection
export async function updateDeckSelection(chartData: ReviewForecastOptions) {
    const checkboxes = document.querySelectorAll('#deckSelection input[type="checkbox"]') as NodeListOf<HTMLInputElement>;
    chartData.selectedDecks = [];

    checkboxes.forEach(checkbox => {
        if (checkbox.checked) {
            chartData.selectedDecks.push(checkbox.value);
        }
    });

    if (!chartData.cachedHeatmap) return;
    const daysAhead = getDaysAhead();
    const { forecastData, decks } = transformHeatmapToForecast(chartData.cachedHeatmap, daysAhead);
    createReviewForecastChart(forecastData, decks, chartData);
}

// Function to create deck selection checkboxes
function createDeckCheckboxes(chartData: ReviewForecastOptions) {
    const container = document.getElementById('deckSelection');
    if (!container) return;

    container.innerHTML = '';

    const controlsDiv = document.createElement('div');
    controlsDiv.style.marginBottom = '10px';

    const selectAllBtn = document.createElement('button');
    selectAllBtn.textContent = 'Select All';
    selectAllBtn.className = 'btn btn-small';
    selectAllBtn.addEventListener('click', () => {
        const checkboxes = container.querySelectorAll('input[type="checkbox"]') as NodeListOf<HTMLInputElement>;
        checkboxes.forEach(cb => cb.checked = true);
        updateDeckSelection(chartData);
    });

    const selectNoneBtn = document.createElement('button');
    selectNoneBtn.textContent = 'Select None';
    selectNoneBtn.className = 'btn btn-small';
    selectNoneBtn.style.marginLeft = '10px';
    selectNoneBtn.addEventListener('click', () => {
        const checkboxes = container.querySelectorAll('input[type="checkbox"]') as NodeListOf<HTMLInputElement>;
        checkboxes.forEach(cb => cb.checked = false);
        updateDeckSelection(chartData);
    });

    controlsDiv.appendChild(selectAllBtn);
    controlsDiv.appendChild(selectNoneBtn);
    container.appendChild(controlsDiv);

    const checkboxContainer = document.createElement('div');
    checkboxContainer.style.display = 'flex';
    checkboxContainer.style.flexWrap = 'wrap';
    checkboxContainer.style.gap = '15px';

    chartData.availableDecks.forEach((deck, index) => {
        const label = document.createElement('label');
        label.style.display = 'flex';
        label.style.alignItems = 'center';
        label.style.cursor = 'pointer';
        label.style.fontSize = '14px';

        if (deck === 'Overdue') {
            label.style.fontWeight = 'bold';
            label.style.color = '#ff4444';
        }

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = deck;
        checkbox.checked = true;
        checkbox.style.marginRight = '8px';
        checkbox.addEventListener('change', () => updateDeckSelection(chartData));

        const colorBox = document.createElement('span');
        colorBox.style.display = 'inline-block';
        colorBox.style.width = '12px';
        colorBox.style.height = '12px';
        colorBox.style.backgroundColor = DECK_COLORS[index % DECK_COLORS.length];
        colorBox.style.marginRight = '6px';
        colorBox.style.borderRadius = '2px';

        if (deck === 'Overdue') {
            colorBox.style.border = '2px solid #cc0000';
        }

        const text = document.createElement('span');
        text.textContent = deck;

        label.appendChild(checkbox);
        label.appendChild(colorBox);
        label.appendChild(text);
        checkboxContainer.appendChild(label);
    });

    container.appendChild(checkboxContainer);
}

export async function loadReviewForecast(chartData: ReviewForecastOptions): Promise<void> {
    const loadingEl = document.getElementById('forecastLoading');
    const errorEl = document.getElementById('forecastError');

    if (loadingEl) loadingEl.style.display = 'block';
    if (errorEl) errorEl.style.display = 'none';

    try {
        const heatmap = await fetchHeatmapData();

        if (heatmap.status !== 'success') {
            throw new Error(heatmap.error || 'Failed to load heatmap data');
        }

        chartData.cachedHeatmap = heatmap;
        renderFromCache(chartData);
    } catch (error) {
        console.error('Error loading review forecast:', error);
        if (errorEl) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            errorEl.style.display = 'block';
            errorEl.textContent = `Error: ${message}`;
        }
    } finally {
        if (loadingEl) loadingEl.style.display = 'none';
    }
}

export function setupReviewForecastTab(): void {
    console.log('Setting up review forecast tab...');

    const forecastDays = document.getElementById('forecastDays') as HTMLSelectElement;
    if (!forecastDays) {
        console.error('forecastDays dropdown not found!');
        return;
    }

    if (forecastDays.dataset.initialized === 'true') {
        console.log('Forecast tab already initialized, skipping...');
        return;
    }

    forecastDays.dataset.initialized = 'true';

    const chartData = getBlankReviewForecast();

    forecastDays.addEventListener('change', function() {
        // Re-render from cache — no re-fetch needed since we have 365 days cached
        renderFromCache(chartData);
    });

    const deckSelection = document.getElementById('deckSelection');
    if (deckSelection && !deckSelection.dataset.initialized) {
        deckSelection.dataset.initialized = 'true';
        deckSelection.addEventListener('change', function(event) {
            const target = event.target as HTMLInputElement;
            if (target.type === 'checkbox') {
                updateDeckSelection(chartData);
            }
        });
    }

    console.log('Forecast event listeners set up successfully');

    loadReviewForecast(chartData);
}
