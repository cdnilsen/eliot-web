import { convertUploadedFiles, convertAnkiToSynapdeck, AnkiToSynapdeckConverter } from './anki_converter_lib.js';

// Example 1: Simple file upload conversion (most common use case)
async function handleFileUpload(cardsFile: File, reviewsFile: File) {
  try {
    console.log(`Processing ${cardsFile.name} and ${reviewsFile.name}...`);
    
    // Convert the uploaded files
    const result = await convertUploadedFiles(cardsFile, reviewsFile);
    
    console.log(`✅ Converted ${result.cards.length} cards and ${result.notes.length} notes`);
    
    // Create downloadable files
    downloadAsJSON(result.cards, 'synapdeck_cards.json');
    downloadAsJSON(result.notes, 'synapdeck_notes.json');
    downloadAsText(result.sql, 'synapdeck_import.sql');
    
    return result;
  } catch (error) {
    console.error('❌ Conversion failed:', error);
    throw error;
  }
}

// Example 2: HTML file input integration
function createFileUploadInterface() {
  const html = `
    <div id="anki-converter">
      <h3>Anki to Synapdeck Converter</h3>
      
      <div class="upload-section">
        <label for="cards-file">
          📚 Cards CSV File:
          <input type="file" id="cards-file" accept=".csv" required>
        </label>
        
        <label for="reviews-file">
          📊 Reviews CSV File:
          <input type="file" id="reviews-file" accept=".csv" required>
        </label>
        
        <button id="convert-btn" disabled>Convert to Synapdeck</button>
      </div>
      
      <div id="progress" style="display: none;">
        <div class="progress-bar"></div>
        <div class="progress-text">Processing...</div>
      </div>
      
      <div id="results" style="display: none;">
        <h4>Conversion Complete!</h4>
        <div id="stats"></div>
        <div class="download-buttons"></div>
      </div>
    </div>
  `;
  
  // Add the HTML to your page
  document.body.innerHTML = html;
  
  // Set up event listeners
  const cardsInput = document.getElementById('cards-file') as HTMLInputElement;
  const reviewsInput = document.getElementById('reviews-file') as HTMLInputElement;
  const convertBtn = document.getElementById('convert-btn') as HTMLButtonElement;
  const progressDiv = document.getElementById('progress') as HTMLDivElement;
  const resultsDiv = document.getElementById('results') as HTMLDivElement;
  
  // Enable convert button when both files are selected
  function checkFiles() {
    const hasFiles = cardsInput.files?.[0] && reviewsInput.files?.[0];
    convertBtn.disabled = !hasFiles;
  }
  
  cardsInput.addEventListener('change', checkFiles);
  reviewsInput.addEventListener('change', checkFiles);
  
  // Handle conversion
  convertBtn.addEventListener('click', async () => {
    const cardsFile = cardsInput.files?.[0];
    const reviewsFile = reviewsInput.files?.[0];
    
    if (!cardsFile || !reviewsFile) {
      alert('Please select both files');
      return;
    }
    
    try {
      // Show progress
      progressDiv.style.display = 'block';
      resultsDiv.style.display = 'none';
      convertBtn.disabled = true;
      
      // Perform conversion
      const result = await handleFileUpload(cardsFile, reviewsFile);
      
      // Show results
      progressDiv.style.display = 'none';
      resultsDiv.style.display = 'block';
      
      // Display stats
      const statsDiv = document.getElementById('stats') as HTMLDivElement;
      statsDiv.innerHTML = `
        <p>📊 <strong>${result.cards.length}</strong> cards converted</p>
        <p>📝 <strong>${result.notes.length}</strong> notes converted</p>
        <p>💾 Files ready for download below</p>
      `;
      
    } catch (error) {
      alert(`Conversion failed: ${error.message}`);
    } finally {
      convertBtn.disabled = false;
    }
  });
}

// Example 3: Advanced conversion with analysis (using File objects)
async function advancedFileConversion(cardsFile: File, reviewsFile: File) {
  try {
    console.log('🚀 Starting advanced conversion...');
    
    // Create converter instance
    const converter = new AnkiToSynapdeckConverter();
    
    // Load from uploaded files
    await converter.loadFromFiles(cardsFile, reviewsFile);
    
    // Get converted data
    const cards = converter.convertToSynapdeckCards();
    const notes = converter.convertToSynapdeckNotes();
    
    // Analyze the conversion results
    console.log('\n📊 CONVERSION ANALYSIS');
    console.log(`Total cards: ${cards.length}`);
    console.log(`Total notes: ${notes.length}`);
    
    // Analyze card formats
    const cardFormats = cards.reduce((acc, card) => {
      acc[card.card_format] = (acc[card.card_format] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    console.log('Card formats:', cardFormats);
    
    // Analyze decks
    const deckCounts = cards.reduce((acc, card) => {
      acc[card.deck] = (acc[card.deck] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    console.log('Cards per deck:', deckCounts);
    
    // Analyze review status
    const reviewedToday = cards.filter(c => c.reviewed_today).length;
    const reviewedYesterday = cards.filter(c => c.reviewed_yesterday).length;
    const underReview = cards.filter(c => c.under_review).length;
    const suspended = cards.filter(c => c.is_suspended).length;
    
    console.log(`📅 Cards reviewed today: ${reviewedToday}`);
    console.log(`📅 Cards reviewed yesterday: ${reviewedYesterday}`);
    console.log(`🔄 Cards under review: ${underReview}`);
    console.log(`⏸️  Suspended cards: ${suspended}`);
    
    // Analyze difficulty distribution
    const avgDifficulty = cards.reduce((sum, c) => sum + c.difficulty, 0) / cards.length;
    const avgRetrievability = cards.reduce((sum, c) => sum + c.retrievability, 0) / cards.length;
    const avgStability = cards.reduce((sum, c) => sum + c.stability, 0) / cards.length;
    
    console.log(`📈 Average difficulty: ${avgDifficulty.toFixed(3)}`);
    console.log(`📈 Average retrievability: ${avgRetrievability.toFixed(3)}`);
    console.log(`📈 Average stability: ${avgStability.toFixed(1)} days`);
    
    // Show sample converted card
    console.log('\n🔍 SAMPLE CONVERTED CARD');
    const sampleCard = cards[0];
    console.log('Card ID:', sampleCard.card_id);
    console.log('Deck:', sampleCard.deck);
    console.log('Format:', sampleCard.card_format);
    console.log('Field Names:', sampleCard.field_names);
    console.log('Field Values:', sampleCard.field_values.map(v => v.length > 50 ? v.substring(0, 50) + '...' : v));
    console.log('Due Date:', sampleCard.time_due);
    console.log('Interval (days):', Math.round(sampleCard.interval / (24 * 60 * 60 * 1000)));
    console.log('Total Reviews:', sampleCard.past_reviews.length);
    console.log('Most Recent Grade:', sampleCard.most_recent_grade);
    console.log('Difficulty:', sampleCard.difficulty.toFixed(3));
    console.log('Retrievability:', sampleCard.retrievability.toFixed(3));
    
    // Export data
    const jsonExport = converter.exportAsJSON();
    const sqlExport = converter.exportAsSQL();
    
    // Download all files
    downloadAsJSON(jsonExport.cards, 'synapdeck_cards.json');
    downloadAsJSON(jsonExport.notes, 'synapdeck_notes.json');
    downloadAsText(sqlExport, 'synapdeck_import.sql');
    
    // Create analysis report
    const analysisReport = {
      conversion_date: new Date().toISOString(),
      input_files: {
        cards_file: cardsFile.name,
        reviews_file: reviewsFile.name
      },
      totals: {
        cards: cards.length,
        notes: notes.length,
        reviews: cards.reduce((sum, c) => sum + c.past_reviews.length, 0)
      },
      card_formats: cardFormats,
      deck_distribution: deckCounts,
      review_status: {
        reviewed_today: reviewedToday,
        reviewed_yesterday: reviewedYesterday,
        under_review: underReview,
        suspended: suspended
      },
      averages: {
        difficulty: parseFloat(avgDifficulty.toFixed(3)),
        retrievability: parseFloat(avgRetrievability.toFixed(3)),
        stability_days: parseFloat(avgStability.toFixed(1))
      }
    };
    
    downloadAsJSON(analysisReport, 'conversion_analysis.json');
    
    console.log('\n✅ EXPORT COMPLETE');
    console.log('Files created:');
    console.log('- synapdeck_cards.json');
    console.log('- synapdeck_notes.json'); 
    console.log('- synapdeck_import.sql');
    console.log('- conversion_analysis.json');
    
    return { cards, notes, analysis: analysisReport };
    
  } catch (error) {
    console.error('❌ Advanced conversion failed:', error);
    throw error;
  }
}

// Example 4: Drag and drop interface
function createDragDropInterface() {
  const html = `
    <div id="drag-drop-converter" class="converter-container">
      <h3>🎯 Drag & Drop Anki Converter</h3>
      
      <div class="drop-zones">
        <div class="drop-zone" id="cards-drop" data-file-type="cards">
          <div class="drop-content">
            <div class="drop-icon">📚</div>
            <div class="drop-text">Drop Cards CSV here</div>
            <div class="drop-filename" style="display: none;"></div>
          </div>
        </div>
        
        <div class="drop-zone" id="reviews-drop" data-file-type="reviews">
          <div class="drop-content">
            <div class="drop-icon">📊</div>
            <div class="drop-text">Drop Reviews CSV here</div>
            <div class="drop-filename" style="display: none;"></div>
          </div>
        </div>
      </div>
      
      <button id="process-files" disabled class="process-btn">
        🔄 Convert to Synapdeck
      </button>
      
      <div id="conversion-status" style="display: none;">
        <div class="status-text">Processing...</div>
        <div class="status-progress"></div>
      </div>
    </div>
  `;
  
  document.body.innerHTML = html;
  
  let cardsFile: File | null = null;
  let reviewsFile: File | null = null;
  
  const processBtn = document.getElementById('process-files') as HTMLButtonElement;
  const statusDiv = document.getElementById('conversion-status') as HTMLDivElement;
  
  // Set up drag and drop for both zones
  ['cards-drop', 'reviews-drop'].forEach(id => {
    const dropZone = document.getElementById(id) as HTMLDivElement;
    const fileType = dropZone.getAttribute('data-file-type');
    
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('drag-over');
    });
    
    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('drag-over');
    });
    
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      
      const files = Array.from(e.dataTransfer?.files || []);
      const csvFile = files.find(f => f.name.toLowerCase().endsWith('.csv'));
      
      if (csvFile) {
        const filenameDiv = dropZone.querySelector('.drop-filename') as HTMLDivElement;
        const textDiv = dropZone.querySelector('.drop-text') as HTMLDivElement;
        
        filenameDiv.textContent = csvFile.name;
        filenameDiv.style.display = 'block';
        textDiv.style.display = 'none';
        dropZone.classList.add('has-file');
        
        if (fileType === 'cards') {
          cardsFile = csvFile;
        } else {
          reviewsFile = csvFile;
        }
        
        // Enable process button if both files are present
        processBtn.disabled = !(cardsFile && reviewsFile);
      }
    });
  });
  
  // Handle processing
  processBtn.addEventListener('click', async () => {
    if (!cardsFile || !reviewsFile) return;
    
    try {
      statusDiv.style.display = 'block';
      processBtn.disabled = true;
      
      await advancedFileConversion(cardsFile, reviewsFile);
      
      statusDiv.innerHTML = '<div class="status-text success">✅ Conversion Complete!</div>';
      
    } catch (error) {
      statusDiv.innerHTML = `<div class="status-text error">❌ Error: ${error.message}</div>`;
    }
  });
}

// Utility functions for downloading files
function downloadAsJSON(data: any, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  downloadBlob(blob, filename);
}

function downloadAsText(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/plain' });
  downloadBlob(blob, filename);
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Export the main functions
export {
  handleFileUpload,
  createFileUploadInterface,
  advancedFileConversion,
  createDragDropInterface,
  downloadAsJSON,
  downloadAsText
};

// Example CSS (add this to your stylesheet)
const css = `
.converter-container {
  max-width: 800px;
  margin: 20px auto;
  padding: 20px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-family: Arial, sans-serif;
}

.upload-section {
  display: flex;
  flex-direction: column;
  gap: 15px;
  margin-bottom: 20px;
}

.upload-section label {
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-weight: bold;
}

.upload-section input[type="file"] {
  padding: 10px;
  border: 2px dashed #ccc;
  border-radius: 4px;
  cursor: pointer;
}

.drop-zones {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 20px;
}

.drop-zone {
  border: 3px dashed #ccc;
  border-radius: 8px;
  padding: 40px 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
}

.drop-zone.drag-over {
  border-color: #007bff;
  background-color: #f8f9fa;
}

.drop-zone.has-file {
  border-color: #28a745;
  background-color: #d4edda;
}

.drop-icon {
  font-size: 48px;
  margin-bottom: 10px;
}

.drop-text {
  font-weight: bold;
  color: #666;
}

.drop-filename {
  color: #28a745;
  font-weight: bold;
  margin-top: 10px;
}

.process-btn {
  width: 100%;
  padding: 15px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

.process-btn:disabled {
  background-color: #6c757d;
  cursor: not-allowed;
}

.process-btn:hover:not(:disabled) {
  background-color: #0056b3;
}

#conversion-status {
  margin-top: 20px;
  padding: 15px;
  border-radius: 4px;
  text-align: center;
}

.status-text.success {
  color: #28a745;
}

.status-text.error {
  color: #dc3545;
}
`;

// Add CSS to page
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
}