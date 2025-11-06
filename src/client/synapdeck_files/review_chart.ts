interface ReviewForecastData {
    date: string;
    [deck: string]: number | string;
}

interface ReviewForecastResponse {
    status: 'success' | 'error';
    forecast_data?: ReviewForecastData[];
    decks?: string[];
    date_range?: {
        start_date: string;
        end_date: string;
    };
    total_reviews?: number;
    error?: string;
}

export interface ReviewForecastOptions {
    reviewForecastChart: any;
    availableDecks: string[];
    selectedDecks: string[];
}

function getBlankReviewForecast(): ReviewForecastOptions {
    return {
        reviewForecastChart: null,
        availableDecks: [],
        selectedDecks: []
    }
}

const DECK_COLORS = [
    '#ff4444', // Red for overdue cards (first color)
    '#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff7f', '#ff6b6b',
    '#4ecdc4', '#45b7d1', '#f9ca24', '#f0932b', '#eb4d4b', '#6c5ce7'
];

async function fetchReviewForecast(decks?: string[], daysAhead: number = 14, startDate?: string): Promise<ReviewForecastResponse> {
    try {
        const params = new URLSearchParams();
        if (decks && decks.length > 0) {
            params.append('decks', decks.join(','));
        }
        params.append('days_ahead', daysAhead.toString());
        if (startDate) {
            params.append('start_date', startDate); // Add this line
        }

        const response = await fetch(`/review_forecast?${params.toString()}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result: ReviewForecastResponse = await response.json();
        return result;
    } catch (error) {
        console.error('Error fetching forecast data:', error);
        return {
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

interface ChartDataset {
    label: string,
    data: number[],
    backgroundColor: string,
    borderColor: string,
    borderWidth: number
}

function createReviewForecastChart(data: ReviewForecastData[], decks: string[], chartData: ReviewForecastOptions) {
    const ctx = document.getElementById('reviewForecastChart') as HTMLCanvasElement;

    let forecastChart = chartData.reviewForecastChart;
    let selectedDecks = chartData.selectedDecks;
    let availableDecks = chartData.availableDecks;

    if (!ctx) {
        console.error('Canvas element not found');
        return;
    }

    const Chart = window.Chart;
    if (!Chart) {
        console.log('Chart.js not ready, waiting...');
        setTimeout(() => createReviewForecastChart(data, decks, forecastChart), 100);
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

    if (forecastChart) {
        forecastChart.destroy();
    }

    // Get today's date for comparison
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset to midnight for accurate comparison

    // Create labels and determine which dates are overdue
    const labels = data.map(item => {
        if (item.date === 'Overdue') {
            return 'OVERDUE';
        } else {
            const itemDate = new Date(item.date);
            itemDate.setHours(0, 0, 0, 0);
            
            if (itemDate < today) {
                // This date is overdue
                return `${itemDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} (OVERDUE)`;
            } else {
                return itemDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            }
        }
    });

    // Check if each data point is overdue
    const isOverdueArray = data.map(item => {
        if (item.date === 'Overdue') return true;
        const itemDate = new Date(item.date);
        itemDate.setHours(0, 0, 0, 0);
        return itemDate < today;
    });

    // Prepare datasets (one for each selected deck)
    const datasets: ChartDataset[] = selectedDecks.map((deck, index) => ({
        label: deck,
        data: data.map(item => item[deck] as number || 0),
        backgroundColor: DECK_COLORS[index % DECK_COLORS.length],
        borderColor: DECK_COLORS[index % DECK_COLORS.length],
        borderWidth: 1
    }));;

    // Create the chart
    forecastChart = new Chart(ctx, {
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
                                const date = new Date(originalDate);
                                return date.toLocaleDateString('en-US', {
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
                        }
                    }
                }
            },
            scales: {
                x: {
                    stacked: true,  // ADD THIS
                    title: {
                        display: true,
                        text: 'Date'
                    },
                    ticks: {
                        color: function(context: any) {
                            const dataIndex = context.index;
                            // Make overdue labels red
                            if (data[dataIndex] && (data[dataIndex].date === 'Overdue' || isOverdueArray[dataIndex])) {
                                return '#ff0000';
                            }
                            return '#666666';
                        },
                        font: function(context: any) {
                            const dataIndex = context.index;
                            // Make overdue labels bold
                            if (data[dataIndex] && (data[dataIndex].date === 'Overdue' || isOverdueArray[dataIndex])) {
                                return {
                                    weight: 'bold',
                                    size: 12
                                };
                            }
                            return {
                                weight: 'normal',
                                size: 12
                            };
                        }
                    }
                },
                y: {
                    stacked: true,  // ADD THIS
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

// 5. Optional: Add a function to calculate overdue totals for display
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

// 6. Optional: Update the forecast stats display to show overdue information
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

// Function to update deck selection
export async function updateDeckSelection(chartData: ReviewForecastOptions) {
    const checkboxes = document.querySelectorAll('#deckSelection input[type="checkbox"]') as NodeListOf<HTMLInputElement>;
    chartData.selectedDecks = [];
    
    checkboxes.forEach(checkbox => {
        if (checkbox.checked) {
            chartData.selectedDecks.push(checkbox.value);
        }
    });
    
    // Always include overdue cards if any deck is selected
    // (You might want to make this configurable)
    
    await loadReviewForecast(chartData);
}

// Function to create deck selection checkboxes
function createDeckCheckboxes(chartData: ReviewForecastOptions) {
    const container = document.getElementById('deckSelection');
    if (!container) return;
    
    container.innerHTML = ''; // Clear existing checkboxes
    
    // Add select all/none buttons
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
    
    // Add checkboxes for each deck
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
        
        // Special styling for overdue
        if (deck === 'Overdue') {
            label.style.fontWeight = 'bold';
            label.style.color = '#ff4444';
        }
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = deck;
        checkbox.checked = true; // All selected by default
        checkbox.style.marginRight = '8px';
        checkbox.addEventListener('change', () => updateDeckSelection(chartData));
        
        const colorBox = document.createElement('span');
        colorBox.style.display = 'inline-block';
        colorBox.style.width = '12px';
        colorBox.style.height = '12px';
        colorBox.style.backgroundColor = DECK_COLORS[index % DECK_COLORS.length];
        colorBox.style.marginRight = '6px';
        colorBox.style.borderRadius = '2px';
        
        // Special styling for overdue color box
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

// Enhanced loadReviewForecast function with better error handling
export async function loadReviewForecast(chartData: ReviewForecastOptions): Promise<void> {
    let reviewForecastChart = chartData.reviewForecastChart;
    let selectedDecks = chartData.selectedDecks;
    let availableDecks = chartData.availableDecks;

    const loadingEl = document.getElementById('forecastLoading');
    const errorEl = document.getElementById('forecastError');
    
    if (loadingEl) loadingEl.style.display = 'block';
    if (errorEl) errorEl.style.display = 'none';
    
    // Simple, reliable way to get the days value
    const daysSelect = document.getElementById('forecastDays') as HTMLSelectElement;
    let daysAhead = 14; // default
    
    if (daysSelect && daysSelect.value) {
        const parsedDays = parseInt(daysSelect.value);
        if (!isNaN(parsedDays) && parsedDays > 0) {
            daysAhead = parsedDays;
        }
    }
    
    console.log(`Loading forecast for ${daysAhead} days ahead (dropdown value: "${daysSelect?.value}")`);
    
    try {
        const today = new Date();
        const localMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
        
        const result = await fetchReviewForecast(
            selectedDecks.length > 0 ? selectedDecks : undefined, 
            daysAhead,
            localMidnight.toISOString()
        );
        
        if (result.status === 'success' && result.forecast_data && result.decks) {
            console.log(`Successfully loaded forecast data for ${daysAhead} days:`, result);
            
            if (availableDecks.length === 0) {
                availableDecks = result.decks;
                selectedDecks = result.decks;
                createDeckCheckboxes(chartData);
            }
            
            createReviewForecastChart(result.forecast_data, result.decks, chartData);
            updateForecastStats(result.forecast_data, result.total_reviews || 0, result.decks);
            
        } else {
            throw new Error(result.error || 'Failed to load forecast data');
        }
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

export function setupReviewForecastTab(): void {  // Keep as void
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
    
    // Add clean event listener
    forecastDays.addEventListener('change', async function(event) {
        const target = event.target as HTMLSelectElement;
        console.log(`Forecast period changed to: ${target.value} days`);
        await loadReviewForecast(chartData);  // chartData is passed and modified in place
    });
    
    // Set up deck selection if it exists
    const deckSelection = document.getElementById('deckSelection');
    if (deckSelection && !deckSelection.dataset.initialized) {
        deckSelection.dataset.initialized = 'true';
        deckSelection.addEventListener('change', function(event) {
            const target = event.target as HTMLInputElement;
            if (target.type === 'checkbox') {
                console.log('Forecast deck selection changed');
                updateDeckSelection(chartData);
            }
        });
    }
    
    console.log('Forecast event listeners set up successfully');
    
    // Load initial data (don't await - just fire and forget)
    loadReviewForecast(chartData);
}
