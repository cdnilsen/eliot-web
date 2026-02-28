// Card browser module - extracted from synapdeck.ts

interface CardDue {
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

declare global {
    interface Window {
        closeEditModal: () => void;
        saveAllFields: (cardId: number) => Promise<void>;
        performCardSearch: (page?: number) => Promise<void>;
    }
}

let deps: CardBrowserDeps = {
    deckNameList: [],
    generateCardFrontLine: () => '',
    generateCardBackLine: () => '',
    cleanFieldDatum: () => '',
};

export function initializeBrowserTab(browserDeps: CardBrowserDeps): void {
    deps = browserDeps;
}





// Interfaces for card browsing (add these near your other interfaces)
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

// Add these variables for browser state management
let currentBrowsePage = 0;
let currentBrowseFilters: CardBrowserFilters = {};

// Browser API function
async function browseCards(filters: CardBrowserFilters = {}): Promise<BrowseCardsResponse> {
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



// Replace the displayBrowseResults function with this spreadsheet-style version
function displayBrowseResults(cards: CardDue[], totalCount: number): void {
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

        // Format due date for display
        const dueDateDisplay = dueDate.toLocaleDateString() + ' ' + dueDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
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

    // Add event listeners to action buttons and sortable headers
    setupCardActionButtons();
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
            displayBrowseResults(result.cards, result.total_count || 0);
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

function setupCardActionButtons(): void {
    const resultsDiv = document.getElementById('browse_results');
    if (!resultsDiv) {
        console.error('Browse results div not found');
        return;
    }

    // Use event delegation with proper typing
    resultsDiv.addEventListener('click', async (event: MouseEvent) => {
        const target = event.target as HTMLElement;
        
        // Handle edit button clicks
        if (target.classList.contains('edit-card-btn') || target.closest('.edit-card-btn')) {
            event.preventDefault();
            event.stopPropagation();
            
            const button = target.classList.contains('edit-card-btn') ? target : target.closest('.edit-card-btn') as HTMLElement;
            const cardId = button?.getAttribute('data-card-id');
            
            if (cardId) {
                console.log(`Edit button clicked for card ${cardId}`);
                await editCard(parseInt(cardId));
            } else {
                console.error('No card ID found for edit button');
            }
        }
        
        // Handle delete button clicks
        else if (target.classList.contains('delete-card-btn') || target.closest('.delete-card-btn')) {
            event.preventDefault();
            event.stopPropagation();
            
            const button = target.classList.contains('delete-card-btn') ? target : target.closest('.delete-card-btn') as HTMLElement;
            const cardId = button?.getAttribute('data-card-id');
            
            if (cardId) {
                console.log(`Delete button clicked for card ${cardId}`);
                await deleteCard(parseInt(cardId));
            } else {
                console.error('No card ID found for delete button');
            }
        }

        else if (target.classList.contains('relationship-btn') || target.closest('.relationship-btn')) {
            event.preventDefault();
            event.stopPropagation();
            
            const button = target.classList.contains('relationship-btn') ? target : target.closest('.relationship-btn') as HTMLElement;
            const cardId = button?.getAttribute('data-card-id');
            
            // Prevent rapid clicking
            if (button?.dataset.processing === 'true') {
                console.log('Button already processing, ignoring click');
                return;
            }
    
            if (cardId) {
                console.log(`Relationship button clicked for card ${cardId}`);
                button.dataset.processing = 'true';
                
                showCardRelationshipModal(parseInt(cardId)).finally(() => {
                    // Reset the processing flag after a delay
                    setTimeout(() => {
                        button.dataset.processing = 'false';
                    }, 1000);
                });
            } else {
                console.error('No card ID found for relationship button');
            }
        }

        else if (target.classList.contains('history-btn') || target.closest('.history-btn')) {
            event.preventDefault();
            event.stopPropagation();

            const button = target.classList.contains('history-btn') ? target : target.closest('.history-btn') as HTMLElement;
            const cardId = button?.getAttribute('data-card-id');

            if (button?.dataset.processing === 'true') {
                return;
            }

            if (cardId) {
                button.dataset.processing = 'true';

                showCardHistoryModal(parseInt(cardId)).finally(() => {
                    setTimeout(() => {
                        button.dataset.processing = 'false';
                    }, 1000);
                });
            }
        }
    });

    // Log button count for debugging
    const editButtons = resultsDiv.querySelectorAll('.edit-card-btn');
    const deleteButtons = resultsDiv.querySelectorAll('.delete-card-btn');
    console.log(`Set up action handlers for ${editButtons.length} edit buttons and ${deleteButtons.length} delete buttons`);
}

// Add these interfaces first
interface CreateCardRelationshipRequest {
    card_a_id: number;
    card_b_id: number;
    relationship: 'peer' | 'dependent' | 'prereq';
    between_notes?: boolean; // Add this
}

interface CreateCardRelationshipResponse {
    status: 'success' | 'error';
    card_a_id?: number;
    card_b_id?: number;
    relationship?: string;
    changes_made?: {
        card_a_changes: string[];
        card_b_changes: string[];
    };
    error?: string;
    details?: string;
}

// API functions
export async function createCardRelationship(cardAId: number, cardBId: number, relationship: 'peer' | 'dependent' | 'prereq', betweenNotes?: boolean): Promise<CreateCardRelationshipResponse> {
    try {
        const response = await fetch('/create_card_relationship', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                card_a_id: cardAId,
                card_b_id: cardBId,
                relationship: relationship,
                between_notes: betweenNotes
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result: CreateCardRelationshipResponse = await response.json();
        console.log('Create relationship response:', result);
        
        return result;
    } catch (error) {
        console.error('Error creating card relationship:', error);
        return { 
            status: 'error', 
            error: 'Network error creating card relationship' 
        };
    }
}

async function removeCardRelationship(cardAId: number, cardBId: number, relationship: 'peer' | 'dependent' | 'prereq'): Promise<CreateCardRelationshipResponse> {
    try {
        const response = await fetch('/remove_card_relationship', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                card_a_id: cardAId,
                card_b_id: cardBId,
                relationship: relationship
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result: CreateCardRelationshipResponse = await response.json();
        return result;
    } catch (error) {
        console.error('Error removing card relationship:', error);
        return { 
            status: 'error', 
            error: 'Network error removing card relationship' 
        };
    }
}

// Main function to show the relationship modal
async function showCardRelationshipModal(cardId: number): Promise<void> {
    console.log(`Opening relationship manager for card ${cardId}`);

    // CRITICAL: Always clean up any existing modals first
    const existingModal = document.getElementById('cardRelationshipModal');
    if (existingModal) {
        console.log('Removing existing modal');
        existingModal.remove();
    }

    // Also clean up any loading modals
    const existingLoadingModal = document.getElementById('cardEditModal');
    if (existingLoadingModal) {
        existingLoadingModal.remove();
    }

    // Add a flag to prevent multiple simultaneous opens
    if ((window as any).relationshipModalOpening) {
        console.log('Modal already opening, ignoring duplicate request');
        return;
    }
    (window as any).relationshipModalOpening = true;

    try {
        // Show loading first
        showLoadingModal(`Loading relationships for card ${cardId}...`);

        // Get card details
        const response = await fetch(`/card/${cardId}`);
        const cardDetails = await response.json();
        
        if (cardDetails.status !== 'success') {
            throw new Error(cardDetails.error || 'Failed to load card details');
        }

        // Remove loading modal
        const loadingModal = document.getElementById('cardEditModal');
        if (loadingModal) {
            loadingModal.remove();
        }
        
        // Create the relationship modal
        showRelationshipModal(cardId, cardDetails.card);
        
    } catch (error: unknown) {
        console.error('Error loading card relationships:', error);
        closeRelationshipModal();
        const message = error instanceof Error ? error.message : 'Unknown error';
        showToast(`Failed to load relationships for card ${cardId}: ${message}`, 'error');
    } finally {
        // Reset the flag
        (window as any).relationshipModalOpening = false;
    }
}


// Function to create the relationship modal
function showRelationshipModal(cardId: number, cardData: any): void {
    // Double-check that no modal exists
    const existingModal = document.getElementById('cardRelationshipModal');
    if (existingModal) {
        console.log('Modal already exists, removing it first');
        existingModal.remove();
    }

    const modal = document.createElement('div');
    modal.id = 'cardRelationshipModal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
        animation: fadeIn 0.2s ease-out;
    `;

    // Create the modal content
    modal.innerHTML = `
        <div style="
            background: white;
            border-radius: 12px;
            width: 90%;
            max-width: 800px;
            max-height: 80vh;
            overflow: hidden;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
            animation: slideIn 0.3s ease-out;
        ">
            <!-- Modal Header -->
            <div style="
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 20px 24px;
                border-bottom: 1px solid #e1e5e9;
                background: #f8f9fa;
            ">
                <h2 style="margin: 0; color: #333; font-size: 20px; font-weight: 600;">
                    🔗 Manage Relationships - Card ${cardId}
                </h2>
                <button id="closeRelationshipModal_${cardId}" style="
                    background: none;
                    border: none;
                    font-size: 28px;
                    cursor: pointer;
                    color: #666;
                    width: 40px;
                    height: 40px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 6px;
                    transition: all 0.2s;
                " onmouseover="this.style.background='#e9ecef'" onmouseout="this.style.background='none'">×</button>
            </div>

            <!-- Modal Body -->
            <div style="padding: 24px; max-height: 50vh; overflow-y: auto;">
                <!-- Card Info Section -->
                <div style="
                    background: #f0f8ff;
                    padding: 16px;
                    border-radius: 8px;
                    border: 1px solid #b8daff;
                    margin-bottom: 24px;
                ">
                    <div style="font-weight: 600; color: #0c5460; margin-bottom: 8px;">Card Information</div>
                    <div style="font-size: 14px; color: #495057;">
                        <strong>Deck:</strong> ${cardData.deck || 'Unknown'}<br>
                        <strong>Format:</strong> ${cardData.card_format || 'Unknown'}<br>
                        <strong>Card ID:</strong> ${cardId}<br>
                        <strong>Front:</strong> <span style="font-family: 'GentiumPlus', 'Gentium Plus', serif;">${(() => {
                        const frontText = deps.cleanFieldDatum(cardData, 0, false);
                        return frontText.substring(0, 60) + (frontText.length > 60 ? '...' : '');
                    })() || 'No content'}</span>
                    </div>
                </div>

                <!-- Create New Relationship Section -->
                <div style="margin-bottom: 24px;">
                    <h3 style="color: #333; margin-bottom: 16px;">Create New Relationship</h3>
                    
                    <div style="margin-bottom: 16px;">
                        <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #333;">
                            Search for card to relate to:
                        </label>
                        <div style="position: relative;">
                            <input type="text" id="cardSearchInput_${cardId}" placeholder="Type to search for cards..." style="
                                width: 100%;
                                padding: 10px;
                                border: 1px solid #ced4da;
                                border-radius: 6px;
                                font-size: 14px;
                                box-sizing: border-box;
                            ">
                            <div id="cardSearchResults_${cardId}" style="
                                position: absolute;
                                top: 100%;
                                left: 0;
                                right: 0;
                                background: white;
                                border: 1px solid #ced4da;
                                border-top: none;
                                border-radius: 0 0 6px 6px;
                                max-height: 200px;
                                overflow-y: auto;
                                z-index: 1000;
                                display: none;
                                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                            "></div>
                        </div>
                    </div>

                    <div style="margin-bottom: 16px;">
                        <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #333;">
                            Relationship Type:
                        </label>
                        <select id="relationshipType_${cardId}" style="
                            width: 100%;
                            padding: 10px;
                            border: 1px solid #ced4da;
                            border-radius: 6px;
                            font-size: 14px;
                            box-sizing: border-box;
                        ">
                            <option value="peer">Peer (cards of similar difficulty)</option>
                            <option value="dependent">Dependent (this card depends on the other)</option>
                            <option value="prereq">Prerequisite (other card depends on this)</option>
                        </select>
                    </div>

                    <div style="margin-bottom: 16px;">
                        <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                            <input type="checkbox" id="relationshipBetweenNotes_${cardId}" checked style="
                                transform: scale(1.2);
                                cursor: pointer;
                            ">
                            <span style="font-weight: 600; color: #333;">Relationship between notes</span>
                        </label>
                        <small style="color: #666; font-size: 12px; margin-left: 32px;">
                            When checked, creates relationship between all cards in both notes
                        </small>
                    </div>

                    <button id="createRelationshipBtn_${cardId}" disabled style="
                        padding: 10px 20px;
                        background: #28a745;
                        color: white;
                        border: none;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 14px;
                        font-weight: 600;
                        opacity: 0.5;
                        transition: all 0.2s;
                    ">Create Relationship</button>
                </div>

                <!-- Existing Relationships Section -->
                <div>
                    <h3 style="color: #333; margin-bottom: 16px;">Existing Relationships</h3>
                    <div id="relationshipsList_${cardId}" style="
                        background: #f8f9fa;
                        padding: 16px;
                        border-radius: 8px;
                        border: 1px solid #dee2e6;
                        min-height: 60px;
                        font-family: 'GentiumPlus', 'Gentium Plus', serif;
                    ">
                        <p style="color: #666; font-style: italic;">Loading relationships...</p>
                    </div>
                </div>
            </div>

            <!-- Modal Footer -->
            <div style="
                display: flex;
                justify-content: flex-end;
                align-items: center;
                padding: 20px 24px;
                border-top: 1px solid #e1e5e9;
                background: #f8f9fa;
                gap: 12px;
            ">
                <button id="closeRelationshipModalBtn_${cardId}" style="
                    padding: 10px 20px;
                    background: #6c757d;
                    color: white;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 500;
                    transition: all 0.2s;
                " onmouseover="this.style.background='#545b62'" onmouseout="this.style.background='#6c757d'">
                    Close
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    console.log(`Created relationship modal for card ${cardId}`);

    // Set up event listeners
    setupRelationshipModalEventListeners(cardId);
    loadExistingRelationships(cardId);
    addRemoveAllRelationshipsButton(cardId);
}

// Add this function to handle the card search functionality
function setupCardSearchFunctionality(cardId: number): void {
    const searchInput = document.getElementById(`cardSearchInput_${cardId}`) as HTMLInputElement;
    const searchResults = document.getElementById(`cardSearchResults_${cardId}`);
    const createBtn = document.getElementById(`createRelationshipBtn_${cardId}`) as HTMLButtonElement;
    
    if (!searchInput || !searchResults || !createBtn) return;

    let selectedCardId: number | null = null;
    let searchTimeout: NodeJS.Timeout;

    // Handle search input
    searchInput.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        const query = this.value.trim();
        
        if (query.length < 2) {
            searchResults.style.display = 'none';
            return;
        }

        searchTimeout = setTimeout(async () => {
            try {
                const results = await searchCardsForRelationship(query, cardId);
                displaySearchResults(results, cardId);
            } catch (error) {
                console.error('Search error:', error);
                searchResults.innerHTML = '<div style="padding: 8px; color: #dc3545;">Search error occurred</div>';
                searchResults.style.display = 'block';
            }
        }, 300);
    });

    // Handle Enter key
    searchInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            const firstResult = searchResults.querySelector('.search-result-item') as HTMLElement;
            if (firstResult) {
                firstResult.click();
            }
        }
    });

    // Hide results when clicking outside
    document.addEventListener('click', function(e) {
        if (!searchInput.contains(e.target as Node) && !searchResults.contains(e.target as Node)) {
            searchResults.style.display = 'none';
        }
    });
}

// Add this function to display search results
function displaySearchResults(cards: CardDue[], currentCardId: number): void {
    const searchResults = document.getElementById(`cardSearchResults_${currentCardId}`);
    if (!searchResults) return;

    if (cards.length === 0) {
        searchResults.innerHTML = '<div style="padding: 8px; color: #666; font-size: 12px;">No cards found</div>';
        searchResults.style.display = 'block';
        return;
    }

    const html = cards.map(card => {
        const frontText = deps.cleanFieldDatum(card, 0, false) || 'No content';
        const backText = deps.cleanFieldDatum(card, 1, true) || 'No content';
        
        return `
            <div class="search-result-item" data-card-id="${card.card_id}" style="padding: 8px; border-bottom: 1px solid #eee; cursor: pointer; font-size: 12px; transition: background 0.2s;">
                <div style="font-weight: 600; color: #333; font-family: 'Jost', sans-serif;">Card ${card.card_id} (${card.deck})</div>
                <div style="color: #666; font-family: 'GentiumPlus', 'Gentium Plus', serif;">${frontText.substring(0, 60)}${frontText.length > 60 ? '...' : ''} → ${backText.substring(0, 60)}${backText.length > 60 ? '...' : ''}</div>
            </div>
        `;
    }).join('');

    searchResults.innerHTML = html;
    searchResults.style.display = 'block';

    // Add click handlers to search results
    searchResults.querySelectorAll('.search-result-item').forEach((item, index) => {
        item.addEventListener('mouseenter', function() {
            (item as HTMLElement).style.background = '#f0f8ff';
        });
        
        item.addEventListener('mouseleave', function() {
            (item as HTMLElement).style.background = 'white';
        });
        
        item.addEventListener('click', function() {
            selectCard(cards[index], currentCardId);
            searchResults.style.display = 'none';
        });
    });
}

// Add this function to handle card selection
function selectCard(card: CardDue, currentCardId: number): void {
    const searchInput = document.getElementById(`cardSearchInput_${currentCardId}`) as HTMLInputElement;
    const createBtn = document.getElementById(`createRelationshipBtn_${currentCardId}`) as HTMLButtonElement;
    
    if (!searchInput || !createBtn) return;

    // Show selected card in the input
    const frontText = deps.cleanFieldDatum(card, 0, false) || 'No content';
    searchInput.value = `Card ${card.card_id}: ${frontText.substring(0, 40)}${frontText.length > 40 ? '...' : ''}`;
    searchInput.dataset.selectedCardId = card.card_id.toString();

    // Enable the create button
    createBtn.disabled = false;
    createBtn.style.opacity = '1';
    
    console.log(`Selected card ${card.card_id} for relationship`);
}

// Add this function to implement the search API call
async function searchCardsForRelationship(searchTerm: string, excludeCardId: number): Promise<CardDue[]> {
    try {
        const result = await browseCards({
            searchTerm: searchTerm,
            limit: 10,
            offset: 0
        });
        
        if (result.status === 'success' && result.cards) {
            // Exclude the current card from results
            return result.cards.filter(card => card.card_id !== excludeCardId);
        }
        return [];
    } catch (error) {
        console.error('Error searching cards for relationship:', error);
        return [];
    }
}

// Update the setupRelationshipModalEventListeners function to include search setup:
function setupRelationshipModalEventListeners(cardId: number): void {
    setTimeout(() => {
        const closeBtn = document.getElementById(`closeRelationshipModal_${cardId}`);
        const closeBtn2 = document.getElementById(`closeRelationshipModalBtn_${cardId}`);
        const modal = document.getElementById('cardRelationshipModal');
        const createBtn = document.getElementById(`createRelationshipBtn_${cardId}`) as HTMLButtonElement;
        const relationshipSelect = document.getElementById(`relationshipType_${cardId}`) as HTMLSelectElement;

        console.log('Setting up event listeners for card', cardId);

        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                closeRelationshipModal();
            });
        }

        if (closeBtn2) {
            closeBtn2.addEventListener('click', (e) => {
                e.preventDefault();
                closeRelationshipModal();
            });
        }

        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    closeRelationshipModal();
                }
            });
        }

        // Set up create relationship button
        if (createBtn) {
            createBtn.addEventListener('click', async () => {
                const searchInput = document.getElementById(`cardSearchInput_${cardId}`) as HTMLInputElement;
                const selectedCardId = parseInt(searchInput.dataset.selectedCardId || '0');
                const relationship = relationshipSelect.value as 'peer' | 'dependent' | 'prereq';

                if (!selectedCardId) {
                    showToast('Please select a card first', 'warning');
                    return;
                }

                createBtn.textContent = 'Creating...';
                createBtn.disabled = true;

                try {
                    const relationshipBetweenNotesCheckbox = document.getElementById(`relationshipBetweenNotes_${cardId}`) as HTMLInputElement;
                    const betweenNotes = relationshipBetweenNotesCheckbox.checked;

                    const result = await createCardRelationship(cardId, selectedCardId, relationship, betweenNotes);
                    
                    if (result.status === 'success') {
                        showToast(`${relationship} relationship created successfully!`, 'success');
                        
                        // Clear the form
                        searchInput.value = '';
                        searchInput.dataset.selectedCardId = '';
                        createBtn.disabled = true;
                        createBtn.style.opacity = '0.5';
                        
                        // Reload existing relationships
                        loadExistingRelationships(cardId);
                    } else {
                        throw new Error(result.error || 'Failed to create relationship');
                    }
                } catch (error) {
                    console.error('Error creating relationship:', error);
                    const message = error instanceof Error ? error.message : 'Unknown error';
                    showToast(`Failed to create relationship: ${message}`, 'error');
                } finally {
                    createBtn.textContent = 'Create Relationship';
                }
            });
        }

        // Set up search functionality
        setupCardSearchFunctionality(cardId);

        document.addEventListener('keydown', function escHandler(e) {
            if (e.key === 'Escape') {
                closeRelationshipModal();
                document.removeEventListener('keydown', escHandler);
            }
        });
    }, 100);
}

// Function to load existing relationships
async function loadExistingRelationships(cardId: number): Promise<void> {
    const relationshipsList = document.getElementById(`relationshipsList_${cardId}`);
    if (!relationshipsList) return;

    try {
        const response = await fetch(`/card/${cardId}`);
        const result = await response.json();
        
        if (result.status !== 'success') {
            throw new Error('Failed to load card details');
        }

        const card = result.card;
        let html = '';

        // Collect all related card IDs and fetch their data in parallel
        const allRelatedIds: number[] = [
            ...(card.peers || []),
            ...(card.dependents || []),
            ...(card.prereqs || []),
        ];
        const uniqueIds = [...new Set(allRelatedIds)];

        const relatedCardMap = new Map<number, any>();
        if (uniqueIds.length > 0) {
            const fetches = uniqueIds.map(id =>
                fetch(`/card/${id}`)
                    .then(r => r.json())
                    .then(data => {
                        if (data.status === 'success') relatedCardMap.set(id, data.card);
                    })
                    .catch(() => {/* leave missing */})
            );
            await Promise.all(fetches);
        }

        const cardLabel = (relatedCardId: number): string => {
            const rc = relatedCardMap.get(relatedCardId);
            if (!rc) return `Card ${relatedCardId}`;
            // Determine which field index is the "front" (question) based on format
            let frontIdx = 0;
            let backIdx = 1;
            if (rc.card_format === 'Native to Target') {
                frontIdx = 1;
                backIdx = 0;
            } else if (rc.card_format === 'One Way') {
                const processing: string[] = rc.field_processing || [];
                for (let i = 0; i < processing.length; i++) {
                    if (!processing[i] || processing[i].trim() === '') {
                        frontIdx = i;
                        backIdx = i === 0 ? 1 : 0;
                        break;
                    }
                }
            }
            const front = deps.cleanFieldDatum(rc, frontIdx, false) || '';
            const back = deps.cleanFieldDatum(rc, backIdx, true) || '';
            return `Card ${relatedCardId} (${rc.deck}) · ${front} → ${back}`;
        };

        // Helper function to create relationship items with delete buttons
        const createRelationshipItems = (relationships: number[], type: 'peer' | 'dependent' | 'prereq', label: string) => {
            if (!relationships || relationships.length === 0) return '';

            let itemsHtml = `
                <div class="relationship-section" style="margin-bottom: 16px;">
                    <strong style="color: #333; display: block; margin-bottom: 8px;">${label}:</strong>
                    <div class="relationship-items" style="display: flex; flex-direction: column; gap: 8px;">
            `;

            relationships.forEach(relatedCardId => {
                itemsHtml += `
                    <div class="relationship-item" style="
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        padding: 8px 12px;
                        background: #f8f9fa;
                        border: 1px solid #dee2e6;
                        border-radius: 6px;
                    ">
                        <span style="color: #495057;">${cardLabel(relatedCardId)}</span>
                        <button
                            class="remove-relationship-btn"
                            data-card-a-id="${cardId}"
                            data-card-b-id="${relatedCardId}"
                            data-relationship-type="${type}"
                            style="
                                background: #dc3545;
                                color: white;
                                border: none;
                                border-radius: 4px;
                                padding: 4px 8px;
                                font-size: 12px;
                                cursor: pointer;
                                transition: all 0.2s;
                                flex-shrink: 0;
                                margin-left: 8px;
                            "
                            onmouseover="this.style.background='#c82333'"
                            onmouseout="this.style.background='#dc3545'"
                            title="Remove this relationship"
                        >
                            🗑️ Remove
                        </button>
                    </div>
                `;
            });

            itemsHtml += `
                    </div>
                </div>
            `;

            return itemsHtml;
        };

        // Create sections for each relationship type
        html += createRelationshipItems(card.peers, 'peer', 'Peers');
        html += createRelationshipItems(card.dependents, 'prereq', 'Dependents (this card is prerequisite of)');
        html += createRelationshipItems(card.prereqs, 'dependent', 'Prerequisites (this card depends on)');

        if (html === '') {
            html = `
                <div style="
                    text-align: center;
                    padding: 20px;
                    color: #6c757d;
                    font-style: italic;
                    background: #f8f9fa;
                    border-radius: 8px;
                    border: 1px dashed #dee2e6;
                ">
                    No relationships found for this card.
                </div>
            `;
        }

        relationshipsList.innerHTML = html;

        // Add event listeners to remove buttons
        setupRemoveRelationshipListeners(cardId);

    } catch (error) {
        console.error('Error loading relationships:', error);
        if (relationshipsList) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            relationshipsList.innerHTML = `
                <div style="
                    padding: 16px;
                    color: #dc3545;
                    background: #f8d7da;
                    border: 1px solid #f5c6cb;
                    border-radius: 6px;
                ">
                    Error: ${message}
                </div>
            `;
        }
    }
}


// Add this new function to handle remove relationship button clicks
function setupRemoveRelationshipListeners(cardId: number): void {
    const relationshipsList = document.getElementById(`relationshipsList_${cardId}`);
    if (!relationshipsList) return;

    // Use event delegation to handle button clicks
    relationshipsList.addEventListener('click', async (event: MouseEvent) => {
        const target = event.target as HTMLElement;
        
        if (target.classList.contains('remove-relationship-btn')) {
            event.preventDefault();
            event.stopPropagation();
            
            const cardAId = parseInt(target.getAttribute('data-card-a-id') || '0');
            const cardBId = parseInt(target.getAttribute('data-card-b-id') || '0');
            const relationshipType = target.getAttribute('data-relationship-type') as 'peer' | 'dependent' | 'prereq';
            
            if (!cardAId || !cardBId || !relationshipType) {
                console.error('Missing data attributes for remove button');
                return;
            }
            
            // Confirm deletion
            const confirmed = confirm(
                `Remove ${relationshipType} relationship between cards ${cardAId} and ${cardBId}?\n\n` +
                `This action cannot be undone.`
            );
            
            if (!confirmed) return;
            
            // Show loading state
            const originalText = target.textContent;
            target.textContent = '⏳ Removing...';
            (target as HTMLButtonElement).disabled = true;
            
            try {
                console.log(`Removing ${relationshipType} relationship: ${cardAId} -> ${cardBId}`);
                
                const result = await removeCardRelationship(cardAId, cardBId, relationshipType);
                
                if (result.status === 'success') {
                    showToast(`${relationshipType} relationship removed successfully!`, 'success');
                    
                    // Reload the relationships list to show updated state
                    await loadExistingRelationships(cardId);
                    
                } else {
                    throw new Error(result.error || 'Failed to remove relationship');
                }
                
            } catch (error) {
                console.error('Error removing relationship:', error);
                const message = error instanceof Error ? error.message : 'Unknown error';
                showToast(`Failed to remove relationship: ${message}`, 'error');
                
                // Reset button state on error
                target.textContent = originalText;
                (target as HTMLButtonElement).disabled = false;
            }
        }
    });
}

// Optional: Add a "Remove All Relationships" button to the modal
function addRemoveAllRelationshipsButton(cardId: number): void {
    const relationshipsList = document.getElementById(`relationshipsList_${cardId}`);
    if (!relationshipsList) return;

    // Check if the button already exists
    if (document.getElementById(`removeAllBtn_${cardId}`)) return;

    const removeAllSection = document.createElement('div');
    removeAllSection.style.cssText = `
        margin-top: 20px;
        padding-top: 16px;
        border-top: 1px solid #dee2e6;
        text-align: center;
    `;
    
    const removeAllBtn = document.createElement('button');
    removeAllBtn.id = `removeAllBtn_${cardId}`;
    removeAllBtn.textContent = '🗑️ Remove All Relationships';
    removeAllBtn.style.cssText = `
        background: #dc3545;
        color: white;
        border: none;
        border-radius: 6px;
        padding: 10px 20px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
    `;
    
    removeAllBtn.addEventListener('mouseover', function() {
        this.style.background = '#c82333';
    });
    
    removeAllBtn.addEventListener('mouseout', function() {
        this.style.background = '#dc3545';
    });
    
    removeAllBtn.addEventListener('click', async () => {
        const confirmed = confirm(
            `⚠️ REMOVE ALL RELATIONSHIPS\n\n` +
            `This will remove ALL peer, dependent, and prerequisite relationships for card ${cardId}.\n\n` +
            `This action cannot be undone!\n\n` +
            `Continue?`
        );
        
        if (!confirmed) return;
        
        // Get current relationships
        try {
            const response = await fetch(`/card/${cardId}`);
            const result = await response.json();
            
            if (result.status !== 'success') {
                throw new Error('Failed to get card data');
            }
            
            const card = result.card;
            const allRelationships: Array<{cardBId: number, type: 'peer' | 'dependent' | 'prereq'}> = [];
            
            // Collect all relationships
            if (card.peers) {
                card.peers.forEach((peerId: number) => {
                    allRelationships.push({cardBId: peerId, type: 'peer'});
                });
            }
            if (card.dependents) {
                card.dependents.forEach((depId: number) => {
                    allRelationships.push({cardBId: depId, type: 'dependent'});
                });
            }
            if (card.prereqs) {
                card.prereqs.forEach((prereqId: number) => {
                    allRelationships.push({cardBId: prereqId, type: 'prereq'});
                });
            }
            
            if (allRelationships.length === 0) {
                showToast('No relationships to remove', 'info');
                return;
            }
            
            // Show loading state
            removeAllBtn.textContent = `⏳ Removing ${allRelationships.length} relationships...`;
            removeAllBtn.disabled = true;
            
            // Remove all relationships
            let successCount = 0;
            for (const rel of allRelationships) {
                try {
                    const result = await removeCardRelationship(cardId, rel.cardBId, rel.type);
                    if (result.status === 'success') {
                        successCount++;
                    }
                    // Small delay to avoid overwhelming the server
                    await new Promise(resolve => setTimeout(resolve, 100));
                } catch (error) {
                    console.error(`Failed to remove ${rel.type} relationship with ${rel.cardBId}:`, error);
                }
            }
            
            showToast(`Successfully removed ${successCount} of ${allRelationships.length} relationships`, 'success');
            
            // Reload relationships
            await loadExistingRelationships(cardId);
            
        } catch (error) {
            console.error('Error removing all relationships:', error);
            const message = error instanceof Error ? error.message : 'Unknown error';
            showToast(`Failed to remove relationships: ${message}`, 'error');
        } finally {
            removeAllBtn.textContent = '🗑️ Remove All Relationships';
            removeAllBtn.disabled = false;
        }
    });
    
    removeAllSection.appendChild(removeAllBtn);
    relationshipsList.appendChild(removeAllSection);
}

// Function to close the modal
function closeRelationshipModal(): void {
    console.log('Closing relationship modal');
    
    // Clean up any existing modals
    const modal = document.getElementById('cardRelationshipModal');
    const loadingModal = document.getElementById('cardEditModal');
    
    if (modal) {
        modal.remove();
    }
    
    if (loadingModal) {
        loadingModal.remove();
    }
    
    // Reset the opening flag
    (window as any).relationshipModalOpening = false;
    
    console.log('Modal cleanup complete');
}


// Show card history modal with creation date and review timeline
async function showCardHistoryModal(cardId: number): Promise<void> {
    // Clean up any existing history modal
    const existingModal = document.getElementById('cardHistoryModal');
    if (existingModal) {
        existingModal.remove();
    }

    const existingLoadingModal = document.getElementById('cardEditModal');
    if (existingLoadingModal) {
        existingLoadingModal.remove();
    }

    if ((window as any).historyModalOpening) {
        return;
    }
    (window as any).historyModalOpening = true;

    try {
        showLoadingModal(`Loading history for card ${cardId}...`);

        const response = await fetch(`/card/${cardId}/history`);
        const data = await response.json();

        if (data.status !== 'success') {
            throw new Error(data.error || 'Failed to load card history');
        }

        // Remove loading modal
        const loadingModal = document.getElementById('cardEditModal');
        if (loadingModal) {
            loadingModal.remove();
        }

        // Build review rows
        const reviews = data.reviews || [];
        let reviewsHtml = '';
        let passCount = 0, hardCount = 0, failCount = 0;

        if (reviews.length === 0) {
            reviewsHtml = `<tr><td colspan="4" style="text-align: center; color: #888; padding: 20px;">No reviews yet</td></tr>`;
        } else {
            reviews.forEach((review: any, index: number) => {
                const grade = review.grade || '—';
                let gradeColor = '#888';
                let gradeLabel = grade;
                if (grade === 'pass') { gradeColor = '#28a745'; passCount++; }
                else if (grade === 'hard') { gradeColor = '#f0ad4e'; hardCount++; }
                else if (grade === 'fail') { gradeColor = '#dc3545'; failCount++; }

                const reviewDate = review.reviewed_at ? new Date(review.reviewed_at) : null;
                const dateStr = reviewDate
                    ? `${reviewDate.toLocaleDateString()} ${reviewDate.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}`
                    : '—';

                const intervalBefore = review.interval_before != null ? `${review.interval_before}d` : '—';
                const intervalAfter = review.interval_after != null ? `${review.interval_after}d` : '—';

                reviewsHtml += `
                    <tr style="border-bottom: 1px solid #eee;">
                        <td style="padding: 8px 10px; color: #555;">${index + 1}</td>
                        <td style="padding: 8px 10px;">${dateStr}</td>
                        <td style="padding: 8px 10px;">
                            <span style="color: ${gradeColor}; font-weight: 600; text-transform: capitalize;">${gradeLabel}</span>
                        </td>
                        <td style="padding: 8px 10px; color: #555;">${intervalBefore} → ${intervalAfter}</td>
                    </tr>`;
            });
        }

        // Summary line
        const totalReviews = passCount + hardCount + failCount;
        const summaryHtml = totalReviews > 0
            ? `<span style="color:#28a745; font-weight:600;">${passCount} pass</span> · <span style="color:#f0ad4e; font-weight:600;">${hardCount} hard</span> · <span style="color:#dc3545; font-weight:600;">${failCount} fail</span>`
            : 'No reviews';

        // Card info
        const createdDate = data.created ? new Date(data.created) : null;
        const createdStr = createdDate ? createdDate.toLocaleDateString() : '—';
        const stats = data.current_stats || {};
        const lastReviewed = stats.last_reviewed ? new Date(stats.last_reviewed).toLocaleDateString() : 'Never';
        const retrievPct = stats.retrievability != null ? `${(stats.retrievability * 100).toFixed(1)}%` : '—';

        // Create modal
        const modal = document.createElement('div');
        modal.id = 'cardHistoryModal';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.7); display: flex; justify-content: center;
            align-items: center; z-index: 10000; animation: fadeIn 0.2s ease-out;
        `;

        modal.innerHTML = `
            <div style="
                background: white; border-radius: 12px; width: 90%; max-width: 600px;
                max-height: 80vh; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.3);
                animation: slideIn 0.3s ease-out; display: flex; flex-direction: column;
            ">
                <!-- Header -->
                <div style="
                    display: flex; justify-content: space-between; align-items: center;
                    padding: 20px 24px; border-bottom: 1px solid #e1e5e9; background: #f8f9fa;
                ">
                    <h2 style="margin: 0; color: #333; font-size: 20px; font-weight: 600;">
                        📜 Card History - Card ${cardId}
                    </h2>
                    <button id="closeHistoryModal_${cardId}" style="
                        background: none; border: none; font-size: 28px; cursor: pointer;
                        color: #666; width: 40px; height: 40px; display: flex;
                        align-items: center; justify-content: center; border-radius: 6px;
                        transition: all 0.2s;
                    " onmouseover="this.style.background='#e9ecef'" onmouseout="this.style.background='none'">×</button>
                </div>

                <!-- Body -->
                <div style="padding: 20px 24px; overflow-y: auto; flex: 1;">
                    <!-- Card Info -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px;">
                        <div style="background: #f8f9fa; padding: 12px; border-radius: 8px;">
                            <div style="font-size: 12px; color: #888; margin-bottom: 4px;">Created</div>
                            <div style="font-weight: 600; color: #333;">${createdStr}</div>
                        </div>
                        <div style="background: #f8f9fa; padding: 12px; border-radius: 8px;">
                            <div style="font-size: 12px; color: #888; margin-bottom: 4px;">Last Reviewed</div>
                            <div style="font-weight: 600; color: #333;">${lastReviewed}</div>
                        </div>
                        <div style="background: #f8f9fa; padding: 12px; border-radius: 8px;">
                            <div style="font-size: 12px; color: #888; margin-bottom: 4px;">Interval</div>
                            <div style="font-weight: 600; color: #333;">${stats.interval != null ? stats.interval + 'd' : '—'}</div>
                        </div>
                        <div style="background: #f8f9fa; padding: 12px; border-radius: 8px;">
                            <div style="font-size: 12px; color: #888; margin-bottom: 4px;">Retrievability</div>
                            <div style="font-weight: 600; color: #333;">${retrievPct}</div>
                        </div>
                    </div>

                    <!-- Deck & Format -->
                    <div style="font-size: 13px; color: #666; margin-bottom: 16px;">
                        <strong>Deck:</strong> ${data.deck || '—'} &nbsp;·&nbsp; <strong>Format:</strong> ${data.card_format || '—'}
                    </div>

                    <!-- Summary -->
                    <div style="margin-bottom: 16px; padding: 10px 14px; background: #f0f4f8; border-radius: 8px; font-size: 14px;">
                        <strong>${totalReviews} review${totalReviews !== 1 ? 's' : ''}</strong> &nbsp;—&nbsp; ${summaryHtml}
                    </div>

                    <!-- Reviews Table -->
                    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                        <thead>
                            <tr style="border-bottom: 2px solid #dee2e6;">
                                <th style="padding: 8px 10px; text-align: left; color: #555; font-weight: 600;">#</th>
                                <th style="padding: 8px 10px; text-align: left; color: #555; font-weight: 600;">Date</th>
                                <th style="padding: 8px 10px; text-align: left; color: #555; font-weight: 600;">Grade</th>
                                <th style="padding: 8px 10px; text-align: left; color: #555; font-weight: 600;">Interval</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${reviewsHtml}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Close button handler
        const closeBtn = document.getElementById(`closeHistoryModal_${cardId}`);
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.style.animation = 'fadeOut 0.2s ease-in';
                setTimeout(() => modal.remove(), 200);
            });
        }

        // Click backdrop to close
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.animation = 'fadeOut 0.2s ease-in';
                setTimeout(() => modal.remove(), 200);
            }
        });

    } catch (error: unknown) {
        console.error('Error loading card history:', error);
        const loadingModal = document.getElementById('cardEditModal');
        if (loadingModal) loadingModal.remove();
        const message = error instanceof Error ? error.message : 'Unknown error';
        showToast(`Failed to load history for card ${cardId}: ${message}`, 'error');
    } finally {
        (window as any).historyModalOpening = false;
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

// Add interface for filters applied
interface FiltersApplied {
    deck?: string;
    search_term?: string;
    card_format?: string;
    sort_by?: string;
    sort_direction?: string;
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



// API functions for card management
async function deleteCardById(cardId: number): Promise<boolean> {
    try {
        const response = await fetch(`/card/${cardId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        
        if (result.status === 'success') {
            console.log(`✅ Successfully deleted card ${cardId}`);
            return true;
        } else {
            console.error('❌ Error deleting card:', result.error);
            return false;
        }
    } catch (error) {
        console.error('❌ Network error deleting card:', error);
        return false;
    }
}


// Replace your editCard function with this optimized version:
async function editCard(cardId: number): Promise<void> {
    console.log(`✏️ Opening enhanced editor for card ${cardId}`);

    // Prevent multiple modals from opening
    const existingModal = document.getElementById('cardEditModal');
    if (existingModal) {
        console.log('Modal already open, ignoring request');
        return;
    }

    try {
        // Show loading state immediately
        showLoadingModal(`Loading card ${cardId}...`);

        // Get card field details
        const response = await fetch(`/card/${cardId}/fields`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await getCardFields(cardId);

        if (result.status === 'success' && result.card) {
            // Get full card details for deck and format info
            const fullCardResponse = await fetch(`/card/${cardId}`);
            const fullCardResult = await fullCardResponse.json();
            
            const cardData = {
                ...result.card,
                deck: fullCardResult.card?.deck || 'Unknown',
                card_format: fullCardResult.card?.card_format || 'Unknown'
            };
            
            // Replace loading modal with edit modal (no flashing)
            replaceLoadingWithEditModal(cardId, cardData);
        } else {
            throw new Error(result.error || 'Failed to load card data');
        }

    } catch (error) {
        console.error('Error loading card for editing:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        closeEditModal();
        showToast(`Failed to load card ${cardId}: ${message}`, 'error');
    }
}

// New function to replace loading modal smoothly
function replaceLoadingWithEditModal(cardId: number, cardData: any): void {
    const existingModal = document.getElementById('cardEditModal');
    if (!existingModal) return;

    // Find the modal content div
    const modalContent = existingModal.querySelector('div');
    if (!modalContent) return;

    // Fade out current content
    modalContent.style.transition = 'opacity 0.2s ease';
    modalContent.style.opacity = '0';
    
    setTimeout(() => {
        // Remove existing modal and create new one
        existingModal.remove();
        showCardEditModal(cardId, cardData);
    }, 200);
}

// Optimized close function to prevent flashing
function closeEditModal(): void {
    const modal = document.getElementById('cardEditModal');
    if (modal && !modal.classList.contains('closing')) {
        modal.classList.add('closing');
        modal.style.animation = 'fadeOut 0.2s ease-in';
        setTimeout(() => {
            if (modal.parentNode) {
                modal.parentNode.removeChild(modal);
            }
        }, 200);
    }
}
// Add this loading modal function to your synapdeck.ts file

function showLoadingModal(message: string): void {
    // Remove any existing modal first
    const existingModal = document.getElementById('cardEditModal');
    if (existingModal) {
        existingModal.remove();
    }

    const modal = document.createElement('div');
    modal.id = 'cardEditModal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
    `;

    const content = document.createElement('div');
    content.style.cssText = `
        background: white;
        padding: 40px;
        border-radius: 12px;
        text-align: center;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
    `;
    content.innerHTML = `
        <div style="font-size: 18px; color: #333; margin-bottom: 20px;">${message}</div>
        <div style="width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #007bff; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto;"></div>
        <style>
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        </style>
    `;

    modal.appendChild(content);
    document.body.appendChild(modal);
}

// Add this queue management for toasts
let toastQueue: Array<{message: string, type: 'success' | 'error' | 'info' | 'warning'}> = [];
let isShowingToast = false;

// Replace your showToast function with this improved version:
function showToast(message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info'): void {
    // Add to queue
    toastQueue.push({ message, type });
    
    // Process queue if not already showing
    if (!isShowingToast) {
        processToastQueue();
    }
}

function processToastQueue(): void {
    if (toastQueue.length === 0) {
        isShowingToast = false;
        return;
    }
    
    isShowingToast = true;
    const { message, type } = toastQueue.shift()!;
    
    // Remove existing toast immediately
    const existingToast = document.getElementById('edit-toast');
    if (existingToast) {
        existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.id = 'edit-toast';
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 16px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 600;
        font-size: 14px;
        z-index: 10001;
        animation: slideInRight 0.3s ease-out;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        max-width: 400px;
        word-wrap: break-word;
    `;

    // Set color based on type
    const colors = {
        success: '#28a745',
        error: '#dc3545',
        info: '#17a2b8',
        warning: '#ffc107'
    };
    toast.style.background = colors[type] || colors.info;

    toast.textContent = message;
    document.body.appendChild(toast);

    // Auto-remove and process next in queue
    setTimeout(() => {
        toast.style.animation = 'slideOutRight 0.3s ease-in';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
            // Process next toast in queue
            setTimeout(() => processToastQueue(), 100);
        }, 300);
    }, 2500); // Shortened duration to prevent buildup

    // Add animations if they don't exist
    if (!document.getElementById('toast-animations')) {
        const style = document.createElement('style');
        style.id = 'toast-animations';
        style.textContent = `
            @keyframes slideInRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOutRight {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
}

// Add this individual field save function to your synapdeck.ts file
async function saveIndividualField(cardId: number, fieldIndex: number, textarea: HTMLTextAreaElement, saveBtn: HTMLButtonElement): Promise<void> {
    const newValue = textarea.value;
    const originalValue = textarea.dataset.originalValue || '';

    if (newValue === originalValue) {
        showToast('No changes to save', 'info');
        return;
    }

    // Show loading state
    saveBtn.disabled = true;
    saveBtn.textContent = '⏳ Saving...';
    saveBtn.style.background = '#ffc107';

    try {
        const response = await fetch(`/card/${cardId}/field/${fieldIndex}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                new_value: newValue
            })
        });

        const result = await response.json();

        if (result.status === 'success') {
            // Update the original value
            textarea.dataset.originalValue = newValue;
            
            // Reset button state
            saveBtn.disabled = true;
            saveBtn.textContent = '✅ Saved!';
            saveBtn.style.background = '#28a745';
            saveBtn.style.opacity = '0.8';

            // Reset after 2 seconds
            setTimeout(() => {
                saveBtn.textContent = '💾 Save Field';
                saveBtn.style.opacity = '0.6';
                saveBtn.style.background = '#6c757d';
            }, 2000);

            showToast(`Field ${fieldIndex + 1} saved successfully!`, 'success');
            
        } else {
            throw new Error(result.error || 'Save failed');
        }

    } catch (error) {
        console.error('Error saving field:', error);
        
        // Reset button state
        saveBtn.disabled = false;
        saveBtn.textContent = '❌ Failed';
        saveBtn.style.background = '#dc3545';

        setTimeout(() => {
            saveBtn.textContent = '💾 Save Field';
            saveBtn.style.background = '#28a745';
        }, 3000);
        const message = error instanceof Error ? error.message : 'Unknown error';
        showToast(`Failed to save field: ${message}`, 'error');
    }
}


// 1. Fixed showCardEditModal function with proper type assertions
function showCardEditModal(cardId: number, cardData: any): void {
    // Remove any existing modal
    const existingModal = document.getElementById('cardEditModal');
    if (existingModal) {
        existingModal.remove();
    }

    // Create modal backdrop
    const modal = document.createElement('div');
    modal.id = 'cardEditModal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
        animation: fadeIn 0.2s ease-out;
    `;

    // Create modal content
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: white;
        border-radius: 12px;
        width: 90%;
        max-width: 700px;
        max-height: 80vh;
        overflow: hidden;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
        animation: slideIn 0.3s ease-out;
    `;

    // Modal header
    const header = document.createElement('div');
    header.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px 24px;
        border-bottom: 1px solid #e1e5e9;
        background: #f8f9fa;
    `;
    
    const title = document.createElement('h2');
    title.textContent = `Edit Note`;
    title.style.cssText = `
        margin: 0;
        color: #333;
        font-size: 20px;
        font-weight: 600;
    `;
    
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '×';
    closeBtn.style.cssText = `
        background: none;
        border: none;
        font-size: 28px;
        cursor: pointer;
        color: #666;
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 6px;
        transition: all 0.2s;
    `;
    
    // Fixed hover handlers with proper this typing
    closeBtn.addEventListener('mouseover', function(this: HTMLButtonElement) {
        this.style.background = '#e9ecef';
    });
    closeBtn.addEventListener('mouseout', function(this: HTMLButtonElement) {
        this.style.background = 'none';
    });
    closeBtn.addEventListener('click', closeEditModal);

    header.appendChild(title);
    header.appendChild(closeBtn);

    // Modal body
    const body = document.createElement('div');
    body.style.cssText = `
        padding: 24px;
        max-height: 50vh;
        overflow-y: auto;
    `;

    // Create field editors
    const fieldsContainer = document.createElement('div');
    fieldsContainer.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 20px;
    `;

    // Add info section
    const infoSection = document.createElement('div');
    infoSection.style.cssText = `
        background: #f0f8ff;
        padding: 16px;
        border-radius: 8px;
        border: 1px solid #b8daff;
        margin-bottom: 20px;
    `;
    infoSection.innerHTML = `
        <div style="font-weight: 600; color: #0c5460; margin-bottom: 8px;">Note Information</div>
        <div style="font-size: 14px; color: #495057;">
            <strong>Deck:</strong> ${cardData.deck || 'Unknown'}<br>
            <strong>Note ID:</strong> ${cardData.note_id ?? 'Unknown'}<br>
            <strong>Card ID:</strong> ${cardId}
        </div>
        <div style="font-size: 12px; color: #6c757d; margin-top: 6px;">Changes will be saved to all cards from this note.</div>
    `;
    fieldsContainer.appendChild(infoSection);

    // Create editable fields
    cardData.field_values.forEach((value: string, index: number) => {
        const fieldContainer = document.createElement('div');
        fieldContainer.style.cssText = `
            border: 1px solid #dee2e6;
            border-radius: 8px;
            padding: 16px;
            background: white;
            transition: border-color 0.2s;
        `;
        
        // Fixed hover handlers
        fieldContainer.addEventListener('mouseover', function(this: HTMLDivElement) {
            this.style.borderColor = '#80bdff';
        });
        fieldContainer.addEventListener('mouseout', function(this: HTMLDivElement) {
            this.style.borderColor = '#dee2e6';
        });

        // Field label
        const label = document.createElement('div');
        label.style.cssText = `
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 12px;
        `;
        
        const fieldName = document.createElement('span');
        fieldName.textContent = cardData.field_names?.[index] || `Field ${index + 1}`;
        fieldName.style.cssText = `
            font-weight: 600;
            color: #333;
            font-size: 14px;
        `;
        
        const processing = document.createElement('span');
        processing.textContent = `(${cardData.field_processing?.[index] || 'None'})`;
        processing.style.cssText = `
            font-size: 12px;
            color: #6c757d;
            background: #e9ecef;
            padding: 2px 8px;
            border-radius: 12px;
        `;

        label.appendChild(fieldName);
        label.appendChild(processing);

        // Text area
        const textarea = document.createElement('textarea') as HTMLTextAreaElement;
        textarea.value = value || '';
        textarea.style.cssText = `
            width: 100%;
            min-height: 80px;
            padding: 12px;
            border: 1px solid #ced4da;
            border-radius: 6px;
            font-family: 'GentiumPlus', 'Gentium Plus', Georgia, serif;
            font-size: 16px;
            line-height: 1.5;
            resize: vertical;
            transition: border-color 0.2s, box-shadow 0.2s;
            box-sizing: border-box;
        `;
        
        // Fixed focus/blur handlers
        textarea.addEventListener('focus', function(this: HTMLTextAreaElement) {
            this.style.borderColor = '#80bdff';
            this.style.boxShadow = '0 0 0 3px rgba(0, 123, 255, 0.25)';
        });
        textarea.addEventListener('blur', function(this: HTMLTextAreaElement) {
            this.style.borderColor = '#ced4da';
            this.style.boxShadow = 'none';
        });

        // Store original value and field index for change detection
        textarea.dataset.originalValue = value || '';
        textarea.dataset.fieldIndex = index.toString();

        // Individual save button
        const saveBtn = document.createElement('button');
        saveBtn.textContent = '💾 Save Field';
        saveBtn.className = 'save-field-btn';
        saveBtn.style.cssText = `
            margin-top: 8px;
            padding: 8px 16px;
            background: #28a745;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 500;
            transition: all 0.2s;
            opacity: 0.6;
        `;
        saveBtn.disabled = true;

        // Auto-resize and change detection - Fixed with proper types
        textarea.addEventListener('input', function(this: HTMLTextAreaElement) {
            // Auto-resize
            this.style.height = 'auto';
            this.style.height = this.scrollHeight + 'px';
            
            // Change detection
            const hasChanged = this.value !== (this.dataset.originalValue || '');
            saveBtn.disabled = !hasChanged;
            saveBtn.style.opacity = hasChanged ? '1' : '0.6';
            saveBtn.style.background = hasChanged ? '#28a745' : '#6c757d';
        });

        saveBtn.addEventListener('click', () => saveIndividualField(cardId, index, textarea, saveBtn));

        fieldContainer.appendChild(label);
        fieldContainer.appendChild(textarea);
        fieldContainer.appendChild(saveBtn);
        fieldsContainer.appendChild(fieldContainer);

        // Initial resize
        setTimeout(() => {
            textarea.style.height = 'auto';
            textarea.style.height = textarea.scrollHeight + 'px';
        }, 100);
    });

    body.appendChild(fieldsContainer);

    // Modal footer
    const footer = document.createElement('div');
    footer.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px 24px;
        border-top: 1px solid #e1e5e9;
        background: #f8f9fa;
        gap: 12px;
    `;

    const saveAllBtn = document.createElement('button');
    saveAllBtn.textContent = '💾 Save All Changes';
    saveAllBtn.style.cssText = `
        padding: 12px 24px;
        background: #007bff;
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 16px;
        font-weight: 600;
        transition: all 0.2s;
        flex: 1;
    `;
    
    // Fixed hover handlers for save button
    saveAllBtn.addEventListener('mouseover', function(this: HTMLButtonElement) {
        this.style.background = '#0056b3';
    });
    saveAllBtn.addEventListener('mouseout', function(this: HTMLButtonElement) {
        this.style.background = '#007bff';
    });
    saveAllBtn.addEventListener('click', () => saveAllFields(cardId));

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = `
        padding: 12px 24px;
        background: #6c757d;
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 16px;
        font-weight: 500;
        transition: all 0.2s;
    `;
    
    // Fixed hover handlers for cancel button
    cancelBtn.addEventListener('mouseover', function(this: HTMLButtonElement) {
        this.style.background = '#545b62';
    });
    cancelBtn.addEventListener('mouseout', function(this: HTMLButtonElement) {
        this.style.background = '#6c757d';
    });
    cancelBtn.addEventListener('click', closeEditModal);

    footer.appendChild(cancelBtn);
    footer.appendChild(saveAllBtn);

    // Assemble modal
    modalContent.appendChild(header);
    modalContent.appendChild(body);
    modalContent.appendChild(footer);
    modal.appendChild(modalContent);

    // Add to page
    document.body.appendChild(modal);

    // Close on backdrop click - Fixed with proper type checking
    modal.addEventListener('click', (e: MouseEvent) => {
        if (e.target === modal) closeEditModal();
    });

    // Add animations if they don't exist
    addModalAnimations();

    console.log(`✅ Edit modal opened for card ${cardId}`);
}

// Also add the fadeOut animation to your existing animations
function addModalAnimations(): void {
    if (!document.getElementById('modal-animations')) {
        const style = document.createElement('style');
        style.id = 'modal-animations';
        style.textContent = `
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes slideIn {
                from { transform: translateY(-20px) scale(0.95); opacity: 0; }
                to { transform: translateY(0) scale(1); opacity: 1; }
            }
            @keyframes fadeOut {
                from { opacity: 1; }
                to { opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
}



// Call this once when your page loads
addModalAnimations();


// API function to get detailed card field data
async function getCardFields(cardId: number): Promise<any> {
    try {
        const response = await fetch(`/card/${cardId}/fields`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Error getting card fields:', error);
        return { 
            status: 'error', 
            error: 'Network error getting card fields' 
        };
    }
}

// API function to update a specific field
async function updateCardField(cardId: number, fieldIndex: number, newValue: string): Promise<any> {
    try {
        const response = await fetch(`/card/${cardId}/field/${fieldIndex}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                new_value: newValue
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Error updating card field:', error);
        return { 
            status: 'error', 
            error: 'Network error updating card field' 
        };
    }
}

// Save all changed fields
// Add this save all fields function to your synapdeck.ts file

async function saveAllFields(cardId: number): Promise<void> {
    const textareas = document.querySelectorAll('#cardEditModal textarea') as NodeListOf<HTMLTextAreaElement>;
    const changedFields: { [key: string]: string } = {};

    // Find changed fields
    textareas.forEach((textarea, index) => {
        const currentValue = textarea.value;
        const originalValue = textarea.dataset.originalValue || '';
        const fieldIndex = textarea.dataset.fieldIndex;
        
        if (currentValue !== originalValue && fieldIndex) {
            changedFields[fieldIndex] = currentValue;
        }
    });

    const changeCount = Object.keys(changedFields).length;
    
    if (changeCount === 0) {
        showToast('No changes to save', 'info');
        return;
    }

    if (!confirm(`Save changes to ${changeCount} field(s)?`)) {
        return;
    }

    // Show loading state
    const saveAllBtn = document.querySelector('#cardEditModal footer button:last-child') as HTMLButtonElement;
    if (!saveAllBtn) return;
    
    const originalText = saveAllBtn.textContent || '';
    saveAllBtn.textContent = '⏳ Saving all changes...';
    saveAllBtn.disabled = true;

    try {
        console.log(`🔄 Bulk updating card ${cardId} with changes:`, changedFields);
        
        // Use your bulk update endpoint
        const response = await fetch(`/card/${cardId}/fields/bulk`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                field_updates: changedFields
            })
        });

        const result = await response.json();
        
        console.log('📊 Bulk update response:', result);

        if (result.status === 'success') {
            // Update all the original values for changed textareas
            if (result.updated_fields) {
                result.updated_fields.forEach((field: any) => {
                    const textarea = document.querySelector(`#cardEditModal textarea[data-field-index="${field.field_index}"]`) as HTMLTextAreaElement;
                    if (textarea) {
                        textarea.dataset.originalValue = field.new_value;
                        
                        // Reset the individual save button for this field
                        const saveBtn = textarea.parentElement?.querySelector('.save-field-btn') as HTMLButtonElement;
                        if (saveBtn) {
                            saveBtn.disabled = true;
                            saveBtn.style.opacity = '0.6';
                            saveBtn.style.background = '#6c757d';
                        }
                    }
                });
            }

            showToast(`✅ Successfully saved ${result.updated_count} field(s)!`, 'success');
            
            // Close modal and refresh if needed
            setTimeout(() => {
                closeEditModal();
                
                // Refresh the card browser if the function exists
                if (typeof performCardSearch === 'function') {
                    performCardSearch(currentBrowsePage || 0);
                }
            }, 1500);
            
        } else {
            throw new Error(result.error || 'Bulk update failed');
        }

    } catch (error) {
        console.error('Error bulk saving fields:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        showToast(`Failed to save fields: ${message}`, 'error');
    } finally {
        // Reset button
        saveAllBtn.textContent = originalText;
        saveAllBtn.disabled = false;
    }
}

// Helper function for HTML escaping
function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

window.closeEditModal = closeEditModal;
window.saveAllFields = saveAllFields;

// Replace your deleteCard function with this optimized version:
async function deleteCard(cardId: number): Promise<void> {
    // Prevent multiple delete operations on the same card
    const cardRow = document.querySelector(`tr[data-card-id="${cardId}"]`) as HTMLTableRowElement;
    if (!cardRow || cardRow.classList.contains('deleting')) {
        return;
    }

    // Enhanced confirmation dialog
    const confirmed = confirm(
        `⚠️ DELETE CARD ${cardId}\n\n` +
        `Are you absolutely sure you want to delete this card?\n\n` +
        `This action cannot be undone!`
    );
    
    if (!confirmed) {
        return;
    }

    try {
        // Mark as deleting to prevent double-clicks
        cardRow.classList.add('deleting');
        
        // Disable action buttons immediately
        const actionButtons = cardRow.querySelectorAll('.edit-card-btn, .delete-card-btn') as NodeListOf<HTMLButtonElement>;
        actionButtons.forEach(btn => {
            btn.disabled = true;
            btn.style.opacity = '0.5';
        });

        const success = await deleteCardById(cardId);
        
        if (success) {
            // Smooth fade out animation
            cardRow.style.transition = 'all 0.3s ease';
            cardRow.style.opacity = '0';
            cardRow.style.transform = 'scale(0.95)';
            
            setTimeout(() => {
                cardRow.remove();
                updateCardCount();
                showToast(`Card ${cardId} deleted successfully!`, 'success');
            }, 300);
            
        } else {
            // Re-enable buttons if delete failed
            cardRow.classList.remove('deleting');
            actionButtons.forEach(btn => {
                btn.disabled = false;
                btn.style.opacity = '1';
            });
            showToast(`Failed to delete card ${cardId}. Please try again.`, 'error');
        }
    } catch (error) {
        console.error('Error in deleteCard:', error);
        
        // Re-enable buttons on error
        cardRow.classList.remove('deleting');
        const actionButtons = cardRow.querySelectorAll('.edit-card-btn, .delete-card-btn') as NodeListOf<HTMLButtonElement>;
        actionButtons.forEach(btn => {
            btn.disabled = false;
            btn.style.opacity = '1';
        });
        
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        showToast(`Error deleting card ${cardId}: ${errorMessage}`, 'error');
    }
}

// 4. Fixed helper function
function updateCardCount(): void {
    const remainingRows = document.querySelectorAll('.card-row').length;
    const infoDiv = document.getElementById('browse_results_info');
    if (infoDiv) {
        infoDiv.innerHTML = `<p class="results-info-text">Showing ${remainingRows} cards</p>`;
    }
}

window.performCardSearch = performCardSearch;