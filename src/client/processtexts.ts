async function loadFileList() {
    const response = await fetch('/textfiles');
    const files = await response.json();
    
    const fileList = document.getElementById('fileList');
    if (!fileList) return;
    
    fileList.innerHTML = files.map((file: string) => `
    <div>
        <input type="checkbox" id="${file}" name="textfile" value="${file}">
        <label for="${file}">${file}</label>
    </div>
    `).join('');
}

async function processFile(filename: string): Promise<void> {
    const status = document.getElementById('status');
    if (!status) return;
    
    status.innerHTML += `<p>Processing ${filename}...</p>`;
    
    try {
        const response = await fetch('/process-file', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ filename })
        });
        
        const result = await response.json();
        status.innerHTML += `<p>Completed ${filename}: ${result.wordsProcessed} words processed</p>`;
    } catch (err) {
        status.innerHTML += `<p style="color: red">Error processing ${filename}</p>`;
    }
}

async function processSelectedFiles() {
    const checkboxes = document.querySelectorAll<HTMLInputElement>('input[name="textfile"]:checked');
    const files = Array.from(checkboxes).map(cb => cb.value);
    
    for (const file of files) {
        await processFile(file);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadFileList();
    
    const processButton = document.getElementById('processFiles');
    if (processButton) {
        processButton.addEventListener('click', processSelectedFiles);
    }
});