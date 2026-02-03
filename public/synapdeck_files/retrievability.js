// Function to manually trigger retrievability update
async function triggerRetrievabilityUpdate() {
    try {
        console.log('🔄 Triggering manual retrievability update...');
        const response = await fetch('/update_retrievability', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        if (result.status === 'success') {
            console.log(`✅ Retrievability update completed in ${result.duration_seconds.toFixed(2)} seconds`);
            return true;
        }
        else {
            console.error('❌ Error updating retrievability:', result.error);
            return false;
        }
    }
    catch (error) {
        console.error('❌ Network error updating retrievability:', error);
        return false;
    }
}
// Function to get retrievability statistics
async function getRetrievabilityStatistics() {
    try {
        const response = await fetch('/retrievability_stats', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        console.log('📊 Retrieved retrievability statistics:', result);
        return result;
    }
    catch (error) {
        console.error('❌ Error getting retrievability statistics:', error);
        return {
            status: 'error',
            error: 'Network error getting retrievability statistics'
        };
    }
}
// Function to display retrievability statistics in a nice format
function displayRetrievabilityStats(stats, containerId) {
    const container = document.getElementById(containerId);
    if (!container)
        return;
    if (stats.status === 'error') {
        container.innerHTML = `<p class="error">Error: ${stats.error}</p>`;
        return;
    }
    if (!stats.deck_statistics || !stats.overall_statistics) {
        container.innerHTML = '<p class="error">No statistics available</p>';
        return;
    }
    let html = `
        <div class="retrievability-stats">
            <h3>📊 Retrievability Statistics</h3>
            <p class="timestamp">Updated: ${new Date(stats.timestamp || '').toLocaleString()}</p>
            
            <div class="overall-stats">
                <h4>🌐 Overall Statistics</h4>
                <div class="stats-grid">
                    <div class="stat-item">
                        <span class="stat-label">Total Cards:</span>
                        <span class="stat-value">${stats.overall_statistics.total_cards}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Average Retrievability:</span>
                        <span class="stat-value">${(stats.overall_statistics.avg_retrievability * 100).toFixed(1)}%</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Range:</span>
                        <span class="stat-value">
                            ${(stats.overall_statistics.min_retrievability * 100).toFixed(1)}% - 
                            ${(stats.overall_statistics.max_retrievability * 100).toFixed(1)}%
                        </span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Standard Deviation:</span>
                        <span class="stat-value">${(stats.overall_statistics.stddev_retrievability * 100).toFixed(1)}%</span>
                    </div>
                </div>
            </div>
            
            <div class="deck-stats">
                <h4>🃏 Statistics by Deck</h4>
    `;
    stats.deck_statistics.forEach(deck => {
        const belowFiftyPercent = ((deck.cards_below_50_percent / deck.total_cards) * 100).toFixed(1);
        const belowEightyPercent = ((deck.cards_below_80_percent / deck.total_cards) * 100).toFixed(1);
        const aboveNinetyPercent = ((deck.cards_above_90_percent / deck.total_cards) * 100).toFixed(1);
        html += `
            <div class="deck-stat-item">
                <h5>${deck.deck}</h5>
                <div class="deck-stats-grid">
                    <div class="stat-row">
                        <span class="stat-label">Total Cards:</span>
                        <span class="stat-value">${deck.total_cards}</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">Average Retrievability:</span>
                        <span class="stat-value">${(deck.avg_retrievability * 100).toFixed(1)}%</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">Range:</span>
                        <span class="stat-value">
                            ${(deck.min_retrievability * 100).toFixed(1)}% - 
                            ${(deck.max_retrievability * 100).toFixed(1)}%
                        </span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">Cards < 50%:</span>
                        <span class="stat-value danger">${deck.cards_below_50_percent} (${belowFiftyPercent}%)</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">Cards < 80%:</span>
                        <span class="stat-value warning">${deck.cards_below_80_percent} (${belowEightyPercent}%)</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">Cards ≥ 90%:</span>
                        <span class="stat-value success">${deck.cards_above_90_percent} (${aboveNinetyPercent}%)</span>
                    </div>
                </div>
            </div>
        `;
    });
    html += `
            </div>
        </div>
    `;
    container.innerHTML = html;
}
// Add retrievability management section to one of your tabs
export function addRetrievabilityManagementSection() {
    // You can add this to any existing tab or create a new one
    // For example, add it to the "Check Your Work" tab
    const checkTab = document.getElementById('check_mainDiv');
    if (!checkTab)
        return;
    // Add the section after existing content
    const retrievabilitySection = document.createElement('div');
    retrievabilitySection.className = 'retrievability-management';
    retrievabilitySection.innerHTML = `
        <div style="margin-top: 40px; border-top: 2px solid #dee2e6; padding-top: 20px;">
            <h3>📈 Retrievability Management</h3>
            <p>Monitor and update card retrievability values based on FSRS calculations.</p>
            
            <div class="retrievability-controls">
                <button id="updateRetrievabilityBtn" class="btn">🔄 Update All Retrievability</button>
                <button id="showRetrievabilityStatsBtn" class="btn btn-secondary">📊 Show Statistics</button>
            </div>
            
            <div id="retrievabilityStatsContainer" class="retrievability-stats-container"></div>
        </div>
    `;
    checkTab.appendChild(retrievabilitySection);
    // Add event listeners
    const updateBtn = document.getElementById('updateRetrievabilityBtn');
    const statsBtn = document.getElementById('showRetrievabilityStatsBtn');
    if (updateBtn) {
        updateBtn.addEventListener('click', async () => {
            updateBtn.textContent = '⏳ Updating...';
            updateBtn.disabled = true;
            const success = await triggerRetrievabilityUpdate();
            if (success) {
                updateBtn.textContent = '✅ Updated!';
                // Automatically show updated stats
                setTimeout(async () => {
                    const stats = await getRetrievabilityStatistics();
                    displayRetrievabilityStats(stats, 'retrievabilityStatsContainer');
                }, 1000);
            }
            else {
                updateBtn.textContent = '❌ Failed';
            }
            // Reset button after 3 seconds
            setTimeout(() => {
                updateBtn.textContent = '🔄 Update All Retrievability';
                updateBtn.disabled = false;
            }, 3000);
        });
    }
    if (statsBtn) {
        statsBtn.addEventListener('click', async () => {
            statsBtn.textContent = '⏳ Loading...';
            statsBtn.disabled = true;
            const stats = await getRetrievabilityStatistics();
            displayRetrievabilityStats(stats, 'retrievabilityStatsContainer');
            statsBtn.textContent = '📊 Show Statistics';
            statsBtn.disabled = false;
        });
    }
}
//# sourceMappingURL=retrievability.js.map