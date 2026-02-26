


/*
function generateCardHTML(card: CardDue, cardNumber: number): string {
    const frontSideLine = generateCardFrontLine(card);
    // Function to safely process HTML while allowing specific tags
    function processHTMLContent(text: string): string {
        // First, handle your custom tags
        let processed = text
            .replace(/<ብ>/g, '<strong>')
            .replace(/<\/ብ>/g, '</strong>');
        
        // Define allowed HTML tags
        const allowedTags = ['b', 'strong', 'i', 'em', 'u', 'span', 'br'];
        
        // Split text into parts: HTML tags vs regular text
        const parts = processed.split(/(<\/?[^>]+>)/);
        
        const processedParts = parts.map(part => {
            if (part.match(/^<\/?[^>]+>$/)) {
                // This is an HTML tag
                const tagMatch = part.match(/^<\/?(\w+)(?:\s|>)/);
                const tagName = tagMatch ? tagMatch[1].toLowerCase() : '';
                
                if (allowedTags.includes(tagName)) {
                    // Keep allowed tags as-is
                    return part;
                } else {
                    // Escape disallowed tags
                    return part
                        .replace(/&/g, '&amp;')
                        .replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;');
                }
            } else {
                // This is regular text - only escape dangerous characters, not HTML entities
                return part
                    .replace(/&(?!(?:amp|lt|gt|quot|apos);)/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;');
            }
        });
        
        return processedParts.join('');
    }
    
    const processedText = processHTMLContent(frontSideLine);
    
    return `
        <div class="card-item">
            <div class="card-question">
                ${cardNumber}. ${processedText}
            </div>
        </div>
    `;
}

function generateReviewSheetHTML(cards: CardDue[], leftColumnWidth: string = "40%"): string {
    const today = new Date().toLocaleDateString();
    const rightColumnWidth = `calc(100% - ${leftColumnWidth})`;
    
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Card Review Sheet - ${today}</title>
            <style>
                @font-face {
                    font-family: 'GentiumPlus';
                    src: url('/Gentium/GentiumPlus-Regular.ttf') format('truetype');
                    font-weight: normal;
                    font-style: normal;
                    font-display: swap;
                }
                @font-face {
                    font-family: 'GentiumPlus';
                    src: url('/Santakku/Santakku.ttf') format('truetype');
                    unicode-range: U+12000-1254F;
                    font-display: swap;
                }
                @font-face {
                    font-family: 'GentiumPlus';
                    font-style: italic;
                    src: url('/Santakku/Santakku.ttf') format('truetype');
                    unicode-range: U+12000-1254F;
                    font-display: swap;
                }
                
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                
                body {
                    font-family: 'GentiumPlus', 'Gentium Plus', serif;
                    font-size: 14px;
                    line-height: 1.4;
                    color: #000;
                    background: white;
                    max-width: 8.5in;
                    margin: 0 auto;
                    padding: 0.5in;
                }
                
                .header {
                    text-align: center;
                    margin-bottom: 30px;
                    border-bottom: 2px solid #333;
                    padding-bottom: 20px;
                }
                
                .title {
                    font-size: 24px;
                    font-weight: bold;
                    margin-bottom: 8px;
                }
                
                .date {
                    font-size: 12px;
                    color: #666;
                    margin-bottom: 15px;
                }
                
                .summary {
                    font-size: 14px;
                    font-weight: bold;
                }
                
                .section-title {
                    font-size: 16px;
                    font-weight: bold;
                    margin: 20px 0 15px 0;
                    color: #333;
                }
                
                .two-column-container {
                    display: flex;
                    min-height: calc(100vh - 200px);
                    gap: 20px;
                }
                
                .left-column {
                    width: ${leftColumnWidth};
                    padding-right: 10px;
                }
                
                .right-column {
                    width: ${rightColumnWidth};
                    padding-left: 10px;
                }
                
                .card-item {
                    margin-bottom: 15px;
                    display: flex;
                    align-items: flex-start;
                    justify-content: flex-end;
                    text-align: right;
                }
                
                .card-question {
                    font-size: 14px;
                    font-weight: normal;
                    line-height: 1.4;
                    max-width: 100%;
                }
                
                .card-question strong {
                    font-weight: bold;
                }
                
                .controls {
                    position: fixed;
                    top: 10px;
                    right: 10px;
                    background: rgba(255, 255, 255, 0.95);
                    padding: 10px;
                    border-radius: 5px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    border: 1px solid #ddd;
                    z-index: 1000;
                }
                
                .btn {
                    background: #007cba;
                    color: white;
                    border: none;
                    padding: 8px 16px;
                    margin: 0 5px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                }
                
                .btn:hover {
                    background: #005a87;
                }
                
                .width-controls {
                    position: fixed;
                    top: 60px;
                    right: 10px;
                    background: rgba(255, 255, 255, 0.95);
                    padding: 10px;
                    border-radius: 5px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    border: 1px solid #ddd;
                    z-index: 1000;
                    font-size: 12px;
                }
                
                .width-controls label {
                    display: block;
                    margin-bottom: 5px;
                }
                
                .width-controls input {
                    width: 60px;
                    padding: 2px 4px;
                    margin-left: 5px;
                }
                
                @media print {
                    .controls, .width-controls {
                        display: none !important;
                    }
                    
                    body {
                        font-size: 11pt !important;
                        line-height: 1.3 !important;
                        max-width: none;
                        margin: 0;
                        padding: 0.4in !important;
                    }
                    
                    .header {
                        margin-bottom: 15px !important;
                        padding-bottom: 10px !important;
                        page-break-after: avoid;
                    }
                    
                    .title {
                        font-size: 18px !important;
                        margin-bottom: 4px !important;
                    }
                    
                    .date {
                        font-size: 10px !important;
                        margin-bottom: 8px !important;
                    }
                    
                    .summary {
                        font-size: 12px !important;
                    }
                    
                    .section-title {
                        font-size: 14px !important;
                        margin: 12px 0 8px 0 !important;
                        page-break-after: avoid;
                        page-break-before: avoid;
                    }
                    
                    .two-column-container {
                        display: block !important;
                        min-height: auto;
                        gap: 0 !important;
                    }
                    
                    .left-column {
                        width: 100% !important;
                        padding: 0 !important;
                    }
                    
                    .right-column {
                        display: none !important;
                    }
                    
                    .card-item {
                        margin-bottom: 6px !important;
                        display: block !important;
                        text-align: left !important;
                        
                        page-break-inside: avoid;
                        break-inside: avoid;
                        
                        orphans: 3;
                        widows: 3;
                        
                        page-break-before: auto;
                    }
                    
                    
                    .card-item:before {
                        content: "";
                        display: inline;
                        page-break-after: avoid;
                    }
                    
                    .card-question {
                        font-size: 11pt !important;
                        line-height: 1.3 !important;
                        
                        text-align: left !important;
                        display: inline !important;
                        
                        orphans: 2;
                        widows: 2;
                    }
                    
                    
                    .card-item.long-item {
                        page-break-inside: auto !important;
                        break-inside: auto !important;
                    }
                    
                    
                    @page {
                        margin: 0.4in;
                        orphans: 3;
                        widows: 3;
                    }
                    
                    
                    .card-item[data-long="true"] {
                        page-break-inside: auto;
                        padding-top: 2pt;
                    }
                }
                
                
                @media (max-width: 768px) {
                    .two-column-container {
                        flex-direction: column;
                    }
                    
                    .left-column, .right-column {
                        width: 100% !important;
                        padding: 0;
                    }
                    
                    .card-item {
                        justify-content: flex-start;
                        text-align: left;
                    }
                }
            </style>
        </head>
        <body>
            <div class="controls">
                <button class="btn" onclick="window.print()">📄 Save as PDF</button>
                <button class="btn" onclick="window.close()">✕ Close</button>
            </div>
            
            <div class="width-controls">
                <label>Left Column Width:
                    <input type="text" id="leftWidthInput" value="${leftColumnWidth}" onchange="updateColumnWidths()">
                </label>
                <small>e.g., 40%, 300px, 3in</small>
            </div>
            
            <div class="header">
                <div class="title">Card Review Sheet</div>
                <div class="date">Generated: ${today}</div>
                <div class="summary">Total Cards: ${cards.length}</div>
            </div>
            
            <div class="section-title">Cards Due for Review:</div>
            
            <div class="two-column-container">
                <div class="left-column">
                    ${cards.map((card, index) => generateCardHTML(card, index + 1)).join('')}
                </div>
                <div class="right-column">
                    <!-- Empty space for answers -->
                </div>
            </div>
            
            <script>
                // Ensure fonts are loaded before any operations
                document.fonts.ready.then(() => {
                    console.log('✅ All fonts loaded');
                });
                
                // Function to update column widths dynamically
                function updateColumnWidths() {
                    const leftWidthInput = document.getElementById('leftWidthInput');
                    const newLeftWidth = leftWidthInput.value;
                    const newRightWidth = \`calc(100% - \${newLeftWidth})\`;
                    
                    const leftColumn = document.querySelector('.left-column');
                    const rightColumn = document.querySelector('.right-column');
                    
                    if (leftColumn && rightColumn) {
                        leftColumn.style.width = newLeftWidth;
                        rightColumn.style.width = newRightWidth;
                    }
                }
                
                // Enhanced print optimization
                window.addEventListener('beforeprint', () => {
                    console.log('🖨️ Preparing for print...');
                    
                    // Mark potentially long items for special handling
                    const cardItems = document.querySelectorAll('.card-item');
                    cardItems.forEach((item, index) => {
                        const height = item.offsetHeight;
                        // If item is taller than ~1.5 inches (108pt), mark as long
                        if (height > 108) {
                            item.classList.add('long-item');
                            item.setAttribute('data-long', 'true');
                        }
                    });
                });
                
                window.addEventListener('afterprint', () => {
                    console.log('🖨️ Print completed');
                    
                    // Clean up print-specific classes
                    const longItems = document.querySelectorAll('.long-item');
                    longItems.forEach(item => {
                        item.classList.remove('long-item');
                        item.removeAttribute('data-long');
                    });
                });
                
                // Optional: Auto-focus for keyboard shortcuts
                window.addEventListener('load', () => {
                    window.focus();
                });
                
                // Keyboard shortcut for print
                document.addEventListener('keydown', (e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
                        e.preventDefault();
                        window.print();
                    }
                });
            </script>
        </body>
        </html>`;
}
*/
