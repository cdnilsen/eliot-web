// Card search module - extracted from card_browser.ts

export interface CardDue {
    card_id: number;
    note_id: number;
    deck: string;
    card_format: string;
    field_names: string[];
    field_values: string[];
    field_processing: string[];
    time_due: string;
    interval: number;
    retrievability: number;
    peers: number[];
    prereqs?: number[];
    dependents?: number[];
}

export interface CardBrowserDeps {
    deckNameList: string[];
    generateCardFrontLine: (card: CardDue) => string;
    generateCardBackLine: (card: CardDue) => string;
    cleanFieldDatum: (card: CardDue, targetIndex: number, isBackOfCard: boolean) => string;
}

interface BrowseCardsResponse {
    status: 'success' | 'error';
    cards?: CardDue[];
    total_count?: number;
    deck?: string;
    error?: string;
    filters_applied?: FiltersApplied;
}

interface CardBrowserFilters {
    deck?: string;
    searchTerm?: string;
    cardFormat?: string;
    sortBy?: string;
    sortDirection?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
}

interface FiltersApplied {
    deck?: string;
    search_term?: string;
    card_format?: string;
    sort_by?: string;
    sort_direction?: string;
}

let deps: CardBrowserDeps = {
    deckNameList: [],
    generateCardFrontLine: () => '',
    generateCardBackLine: () => '',
    cleanFieldDatum: () => '',
};

export let currentBrowsePage = 0;
let currentBrowseFilters: CardBrowserFilters = {};

export function initializeCardSearch(searchDeps: CardBrowserDeps): void {
    deps = searchDeps;
}

// Browser API function
export async function browseCards(filters: CardBrowserFilters = {}): Promise<BrowseCardsResponse> {
    try {
        const queryParams = new URLSearchParams();

        if (filters.deck) queryParams.append('deck', filters.deck);
        if (filters.searchTerm) queryParams.append('search_term', filters.searchTerm);
        if (filters.cardFormat) queryParams.append('card_format', filters.cardFormat);
        if (filters.sortBy) queryParams.append('sort_by', filters.sortBy);
        if (filters.sortDirection) queryParams.append('sort_direction', filters.sortDirection);
        if (filters.limit) queryParams.append('limit', filters.limit.toString());
        if (filters.offset) queryParams.append('offset', filters.offset.toString());

        const response = await fetch(`/browse_cards?${queryParams.toString()}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result: BrowseCardsResponse = await response.json();
        console.log('Browse cards response:', result);

        return result;
    } catch (error) {
        console.error('Error browsing cards:', error);
        return {
            status: 'error',
            error: 'Network error browsing cards'
        };
    }
}

// Setup function for browse cards tab
export function setupBrowseCardsTab(): void {
    const browseTab = document.getElementById('browse_mainDiv');
    if (!browseTab) return;

    // Only set up once
    if (browseTab.querySelector('.browse-controls')) {
        return;
    }

    const deckOptions = deps.deckNameList.map(deck =>
        `<option value="${deck}">${deck}</option>`
    ).join('');

    // Create the browse cards UI with spreadsheet-like layout
    browseTab.innerHTML = `
        <h2>Browse Cards</h2>

        <div class="browse-controls">
            <div class="browse-filters">
                <div class="filter-row">
                    <div class="filter-group">
                        <label for="browse_deck_select">Deck:</label>
                        <select id="browse_deck_select">
                            <option value="">All Decks</option>
                            ${deckOptions}
                        </select>
                    </div>

                    <div class="filter-group">
                        <label for="browse_search_input">Search:</label>
                        <input type="text" id="browse_search_input" placeholder="Search in card content...">
                    </div>

                    <div class="filter-group">
                        <label for="browse_format_select">Card Format:</label>
                        <select id="browse_format_select">
                            <option value="">All Formats</option>
                            <option value="Target to Native">Target to Native</option>
                            <option value="Native to Target">Native to Target</option>
                            <option value="One Way">One Way</option>
                        </select>
                    </div>

                    <div class="filter-group">
                        <label for="browse_sort_select">Sort By:</label>
                        <select id="browse_sort_select">
                            <option value="card_id">Card ID</option>
                            <option value="time_due">Due Date</option>
                            <option value="interval">Interval</option>
                            <option value="retrievability">Retrievability</option>
                            <option value="created">Created Date</option>
                            <option value="deck">Deck</option>
                            <option value="card_format">Format</option>
                        </select>
                    </div>

                    <div class="filter-group">
                        <label for="browse_direction_select">Direction:</label>
                        <select id="browse_direction_select">
                            <option value="asc">Ascending</option>
                            <option value="desc">Descending</option>
                        </select>
                    </div>

                    <div class="filter-group">
                        <label for="browse_limit_input">Results per page:</label>
                        <select id="browse_limit_input">
                            <option value="25">25</option>
                            <option value="50" selected>50</option>
                            <option value="100">100</option>
                            <option value="200">200</option>
                        </select>
                    </div>
                </div>

                <div class="filter-actions">
                    <button id="browse_search_btn" class="btn">Search Cards</button>
                    <button id="browse_clear_btn" class="btn btn-secondary">Clear Filters</button>
                </div>
            </div>
        </div>

        <div id="browse_results_info" class="results-info"></div>
        <div id="browse_results" class="browse-results"></div>
        <div id="browse_pagination" class="pagination"></div>
    `;

    // Add event listeners
    const searchButton = document.getElementById('browse_search_btn') as HTMLButtonElement;
    const clearButton = document.getElementById('browse_clear_btn') as HTMLButtonElement;
    const searchInput = document.getElementById('browse_search_input') as HTMLInputElement;
    const sortSelect = document.getElementById('browse_sort_select') as HTMLSelectElement;
    const directionSelect = document.getElementById('browse_direction_select') as HTMLSelectElement;

    if (searchButton) {
        searchButton.addEventListener('click', () => performCardSearch());
    }

    if (clearButton) {
        clearButton.addEventListener('click', clearFilters);
    }

    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                performCardSearch();
            }
        });
    }

    // Add event listeners for sort changes
    if (sortSelect) {
        sortSelect.addEventListener('change', () => performCardSearch(0));
    }

    if (directionSelect) {
        directionSelect.addEventListener('change', () => performCardSearch(0));
    }

    // Load initial cards
    performCardSearch();
}

// Display browse results in a spreadsheet-style table
function displayBrowseResults(cards: CardDue[]): void {
    const resultsDiv = document.getElementById('browse_results') as HTMLDivElement;
    if (!resultsDiv) return;

    if (cards.length === 0) {
        resultsDiv.innerHTML = '<p class="no-results">No cards found matching your search criteria.</p>';
        return;
    }

    // Create spreadsheet-like table
    let html = `
        <div class="card-spreadsheet">
            <table class="card-table">
                <thead>
                    <tr>
                        <th class="sortable" data-sort="card_id">
                            ID
                            <span class="sort-indicator">${getSortIndicator('card_id')}</span>
                        </th>
                        <th class="sortable" data-sort="deck">
                            Deck
                            <span class="sort-indicator">${getSortIndicator('deck')}</span>
                        </th>
                        <th class="card-content-col">Front</th>
                        <th class="card-content-col">Back</th>
                        <th class="sortable" data-sort="card_format">
                            Format
                            <span class="sort-indicator">${getSortIndicator('card_format')}</span>
                        </th>
                        <th class="sortable" data-sort="time_due">
                            Due Date
                            <span class="sort-indicator">${getSortIndicator('time_due')}</span>
                        </th>
                        <th class="sortable" data-sort="interval">
                            Interval
                            <span class="sort-indicator">${getSortIndicator('interval')}</span>
                        </th>
                        <th class="sortable" data-sort="retrievability">
                            Retrievability
                            <span class="sort-indicator">${getSortIndicator('retrievability')}</span>
                        </th>
                        <th class="actions-col">Actions</th>
                    </tr>
                </thead>
                <tbody>
    `;

    cards.forEach((card) => {
        const dueDate = new Date(card.time_due);
        const now = new Date();
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        const isOverdue = dueDate < now;
        const dueDateClass = isOverdue ? 'overdue' : (dueDate <= endOfToday ? 'due-soon' : 'upcoming');

        // Generate preview of both sides of the card
        const frontText = deps.generateCardFrontLine(card);
        const backText = deps.generateCardBackLine(card);

        // Retrievability as percentage with color coding
        const retrievabilityPercent = (card.retrievability * 100).toFixed(1);
        const retrievabilityClass = getRetrievabilityClass(card.retrievability);

        html += `
            <tr class="card-row ${dueDateClass}" data-card-id="${card.card_id}" data-deck="${card.deck}">
                <td class="card-id-cell">
                    <span class="card-id-number">${card.card_id}</span>
                </td>
                <td class="deck-cell">
                    <span class="deck-badge">${card.deck}</span>
                </td>
                <td class="content-cell front-cell">
                    <div class="content-preview" title="${escapeHtml(stripHtml(frontText))}">
                        ${truncateText(stripHtml(frontText), 50)}
                    </div>
                </td>
                <td class="content-cell back-cell">
                    <div class="content-preview" title="${escapeHtml(stripHtml(backText))}">
                        ${truncateText(stripHtml(backText), 50)}
                    </div>
                </td>
                <td class="format-cell">
                    <span class="format-badge">${getFormatAbbreviation(card.card_format)}</span>
                </td>
                <td class="due-date-cell ${dueDateClass}">
                    <div class="due-date-display">
                        <div class="due-date">${dueDate.toLocaleDateString()}</div>
                        <div class="due-time">${dueDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                        ${isOverdue ? '<span class="overdue-badge">OVERDUE</span>' : ''}
                    </div>
                </td>
                <td class="interval-cell">
                    <span class="interval-badge">${card.interval}d</span>
                </td>
                <td class="retrievability-cell">
                    <div class="retrievability-display ${retrievabilityClass}">
                        <div class="retrievability-bar">
                            <div class="retrievability-fill" style="width: ${retrievabilityPercent}%"></div>
                        </div>
                        <span class="retrievability-text">${retrievabilityPercent}%</span>
                    </div>
                </td>
                <td class="actions-cell">
                    <div class="action-buttons">
                        <button class="btn btn-small edit-card-btn" data-card-id="${card.card_id}" title="Edit note">
                            ✏️
                        </button>
                        <button class="btn btn-small relationship-btn" data-card-id="${card.card_id}" title="Manage relationships">
                            🔗
                        </button>
                        <button class="btn btn-small history-btn" data-card-id="${card.card_id}" title="View history">
                            📜
                        </button>
                        <button class="btn btn-small delete-card-btn" data-card-id="${card.card_id}" title="Delete card">
                            🗑️
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });

    html += `
                </tbody>
            </table>
        </div>
    `;

    resultsDiv.innerHTML = html;

    // Add event listeners to sortable headers
    setupSortableHeaders();
}

// Helper functions for the spreadsheet display
function getSortIndicator(column: string): string {
    const currentSort = currentBrowseFilters.sortBy;
    const currentDirection = currentBrowseFilters.sortDirection;

    if (currentSort === column) {
        return currentDirection === 'asc' ? '↑' : '↓';
    }
    return '↕️';
}

function getRetrievabilityClass(retrievability: number): string {
    if (retrievability >= 0.9) return 'high';
    if (retrievability >= 0.7) return 'medium';
    if (retrievability >= 0.5) return 'low';
    return 'very-low';
}

function getFormatAbbreviation(format: string): string {
    switch (format) {
        case 'Target to Native': return 'T→N';
        case 'Native to Target': return 'N→T';
        default: return format.substring(0, 3);
    }
}

function stripHtml(html: string): string {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || '';
}

function truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Setup sortable headers
function setupSortableHeaders(): void {
    const sortableHeaders = document.querySelectorAll('.sortable');

    sortableHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const sortBy = header.getAttribute('data-sort');
            if (!sortBy) return;

            // Toggle direction if same column, otherwise default to asc
            let newDirection: 'asc' | 'desc' = 'asc';
            if (currentBrowseFilters.sortBy === sortBy && currentBrowseFilters.sortDirection === 'asc') {
                newDirection = 'desc';
            }

            // Update the sort select elements to match
            const sortSelect = document.getElementById('browse_sort_select') as HTMLSelectElement;
            const directionSelect = document.getElementById('browse_direction_select') as HTMLSelectElement;

            if (sortSelect) sortSelect.value = sortBy;
            if (directionSelect) directionSelect.value = newDirection;

            // Perform the search with new sorting
            performCardSearch(0);
        });
    });
}

// Perform card search function
export async function performCardSearch(page: number = 0): Promise<void> {
    const deckSelect = document.getElementById('browse_deck_select') as HTMLSelectElement;
    const searchInput = document.getElementById('browse_search_input') as HTMLInputElement;
    const formatSelect = document.getElementById('browse_format_select') as HTMLSelectElement;
    const sortSelect = document.getElementById('browse_sort_select') as HTMLSelectElement;
    const directionSelect = document.getElementById('browse_direction_select') as HTMLSelectElement;
    const limitSelect = document.getElementById('browse_limit_input') as HTMLSelectElement;

    const limit = parseInt(limitSelect?.value || '50');
    const offset = page * limit;

    currentBrowseFilters = {
        deck: deckSelect?.value || undefined,
        searchTerm: searchInput?.value.trim() || undefined,
        cardFormat: formatSelect?.value || undefined,
        sortBy: sortSelect?.value || 'card_id',
        sortDirection: (directionSelect?.value as 'asc' | 'desc') || 'asc',
        limit: limit,
        offset: offset
    };

    currentBrowsePage = page;

    // Show loading state
    const resultsDiv = document.getElementById('browse_results') as HTMLDivElement;
    const infoDiv = document.getElementById('browse_results_info') as HTMLDivElement;

    if (resultsDiv) resultsDiv.innerHTML = '<p class="loading">Loading cards...</p>';
    if (infoDiv) infoDiv.innerHTML = '';

    try {
        const result = await browseCards(currentBrowseFilters);

        if (result.status === 'success' && result.cards) {
            displayBrowseResults(result.cards);
            updatePagination(result.total_count || 0, limit, page);
            updateResultsInfo(result.total_count || 0, offset, limit, result.filters_applied);
        } else {
            if (resultsDiv) {
                resultsDiv.innerHTML = `<p class="error">Error: ${result.error}</p>`;
            }
        }
    } catch (error) {
        console.error('Error performing card search:', error);
        if (resultsDiv) {
            resultsDiv.innerHTML = '<p class="error">Network error occurred</p>';
        }
    }
}

// Update pagination controls
function updatePagination(totalCount: number, limit: number, currentPage: number): void {
    const paginationDiv = document.getElementById('browse_pagination') as HTMLDivElement;
    if (!paginationDiv) return;

    const totalPages = Math.ceil(totalCount / limit);

    if (totalPages <= 1) {
        paginationDiv.innerHTML = '';
        return;
    }

    let html = '<div class="pagination-controls">';

    // Previous button
    if (currentPage > 0) {
        html += `<button class="btn btn-pagination" onclick="performCardSearch(${currentPage - 1})">« Previous</button>`;
    }

    // Page numbers
    const startPage = Math.max(0, currentPage - 2);
    const endPage = Math.min(totalPages - 1, currentPage + 2);

    if (startPage > 0) {
        html += `<button class="btn btn-pagination" onclick="performCardSearch(0)">1</button>`;
        if (startPage > 1) {
            html += '<span class="pagination-ellipsis">...</span>';
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        const isActive = i === currentPage ? 'active' : '';
        html += `<button class="btn btn-pagination ${isActive}" onclick="performCardSearch(${i})">${i + 1}</button>`;
    }

    if (endPage < totalPages - 1) {
        if (endPage < totalPages - 2) {
            html += '<span class="pagination-ellipsis">...</span>';
        }
        html += `<button class="btn btn-pagination" onclick="performCardSearch(${totalPages - 1})">${totalPages}</button>`;
    }

    // Next button
    if (currentPage < totalPages - 1) {
        html += `<button class="btn btn-pagination" onclick="performCardSearch(${currentPage + 1})">Next »</button>`;
    }

    html += '</div>';
    paginationDiv.innerHTML = html;
}

// Update results info
function updateResultsInfo(totalCount: number, offset: number, limit: number, filtersApplied?: FiltersApplied): void {
    const infoDiv = document.getElementById('browse_results_info') as HTMLDivElement;
    if (!infoDiv) return;

    const startIndex = offset + 1;
    const endIndex = Math.min(offset + limit, totalCount);

    let infoText = `Showing ${startIndex}-${endIndex} of ${totalCount} cards`;

    if (filtersApplied) {
        const activeFilters: string[] = [];
        if (filtersApplied.deck) activeFilters.push(`deck: ${filtersApplied.deck}`);
        if (filtersApplied.search_term) activeFilters.push(`search: "${filtersApplied.search_term}"`);
        if (filtersApplied.card_format) activeFilters.push(`format: ${filtersApplied.card_format}`);

        if (activeFilters.length > 0) {
            infoText += ` (filtered by ${activeFilters.join(', ')})`;
        }
    }

    infoDiv.innerHTML = `<p class="results-info-text">${infoText}</p>`;
}

// Clear all filters
function clearFilters(): void {
    const deckSelect = document.getElementById('browse_deck_select') as HTMLSelectElement;
    const searchInput = document.getElementById('browse_search_input') as HTMLInputElement;
    const formatSelect = document.getElementById('browse_format_select') as HTMLSelectElement;
    const sortSelect = document.getElementById('browse_sort_select') as HTMLSelectElement;
    const directionSelect = document.getElementById('browse_direction_select') as HTMLSelectElement;
    const limitSelect = document.getElementById('browse_limit_input') as HTMLSelectElement;

    if (deckSelect) deckSelect.value = '';
    if (searchInput) searchInput.value = '';
    if (formatSelect) formatSelect.value = '';
    if (sortSelect) sortSelect.value = 'card_id';
    if (directionSelect) directionSelect.value = 'asc';
    if (limitSelect) limitSelect.value = '50';

    // Perform search with cleared filters
    performCardSearch(0);
}

export function updateCardCount(): void {
    const remainingRows = document.querySelectorAll('.card-row').length;
    const infoDiv = document.getElementById('browse_results_info');
    if (infoDiv) {
        infoDiv.innerHTML = `<p class="results-info-text">Showing ${remainingRows} cards</p>`;
    }
}

