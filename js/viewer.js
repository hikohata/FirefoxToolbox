let rawDataBlob = null;
let parsedData = [];

document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const targetUrl = params.get('url');

    if (!targetUrl) return;

    const fileName = targetUrl.split('/').pop() || targetUrl;
    document.getElementById('file-name').textContent = fileName;
    document.title = fileName;

    try {
        const response = await fetch(targetUrl);
        const buffer = await response.arrayBuffer();

        // 1. Detect Encoding
        let binaryString = "";
        const bytes = new Uint8Array(buffer);
        const checkLen = Math.min(bytes.length, 65535);
        for (let i = 0; i < checkLen; i++) {
            binaryString += String.fromCharCode(bytes[i]);
        }

        // Use implicit global jschardet
        const detected = jschardet.detect(binaryString);
        const encoding = detected.encoding || 'utf-8';
        console.log(`Detected encoding: ${encoding}`);

        // 2. Decode
        const decoder = new TextDecoder(encoding);
        const csvText = decoder.decode(buffer);

        // 3. Keep raw for download
        rawDataBlob = new Blob([buffer], { type: 'text/csv' });

        // 4. Parse
        Papa.parse(csvText, {
            header: false,
            skipEmptyLines: true,
            complete: function (results) {
                if (results.errors.length > 0) console.warn("Parse errors:", results.errors);
                parsedData = results.data;
                renderTable(parsedData);
            }
        });

    } catch (e) {
        document.getElementById('status-msg').textContent = "Error: " + e.message;
    }
});

function renderTable(data) {
    const container = document.getElementById('table-container');

    if (!data || data.length === 0) {
        container.textContent = "No data.";
        return;
    }

    let html = '<table><tbody>';
    data.forEach(row => {
        html += '<tr>';
        row.forEach(cell => {
            const safeCell = escapeHtml(cell);
            html += `<td>${safeCell}</td>`;
        });
        html += '</tr>';
    });
    html += '</tbody></table>';

    container.innerHTML = html;
}

document.getElementById('search-box').addEventListener('input', (e) => {
    const keyword = e.target.value.toLowerCase();
    const filtered = parsedData.filter(row => {
        return row.some(cell => String(cell).toLowerCase().includes(keyword));
    });
    renderTable(filtered);
});

document.getElementById('download-btn').addEventListener('click', () => {
    if (!rawDataBlob) return;
    const url = URL.createObjectURL(rawDataBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = document.getElementById('file-name').textContent;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

function escapeHtml(text) {
    if (text === null || text === undefined) return "";
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
