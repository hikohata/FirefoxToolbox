document.addEventListener('DOMContentLoaded', async () => {
  // Initialize Localization
  if (typeof l10n !== 'undefined') l10n.localize(document);

  const tbody = document.getElementById('listBody');

  try {
    // Fetch all data from storage
    // Thanks to polyfill.js, 'browser.storage.local.get' returns a Promise in both Chrome/Firefox
    const allData = await browser.storage.local.get(null);
    const rows = [];

    // Filter for sticky note keys
    if (allData) {
      for (const [key, val] of Object.entries(allData)) {
        if (key.startsWith('stickyNotes_') && Array.isArray(val)) {
          val.forEach(note => {
            rows.push({
              key: key,
              ...note
            });
          });
        }
      }
    }

    // Empty State
    if (rows.length === 0) {
      const emptyRow = document.createElement('tr');
      const emptyCell = document.createElement('td');
      emptyCell.colSpan = 5;
      emptyCell.className = 'empty';
      emptyCell.textContent = browser.i18n.getMessage("noNotes") || "No notes";
      emptyRow.appendChild(emptyCell);
      tbody.appendChild(emptyRow);
      return;
    }

    // Render
    const render = (data) => {
      tbody.textContent = '';
      data.forEach(item => {
        const tr = document.createElement('tr');
        const dateStr = item.lastUpdated ? new Date(item.lastUpdated).toLocaleString() : '-';

        // Title Cell
        const tdTitle = document.createElement('td');
        tdTitle.style.fontWeight = 'bold';
        tdTitle.textContent = item.title || 'Untitled';
        tr.appendChild(tdTitle);

        // URL Cell
        const tdUrl = document.createElement('td');
        const link = document.createElement('a');
        link.href = item.url || '#';
        link.target = '_blank';
        link.textContent = truncate(item.url || '', 40);
        tdUrl.appendChild(link);
        tr.appendChild(tdUrl);

        // Content Cell
        const tdText = document.createElement('td');
        tdText.className = 'note-text';
        tdText.textContent = item.text || '';
        tr.appendChild(tdText);

        // Date Cell
        const tdDate = document.createElement('td');
        tdDate.style.fontSize = '0.9em';
        tdDate.style.color = '#666';
        tdDate.textContent = dateStr;
        tr.appendChild(tdDate);

        // Actions Cell
        const tdActions = document.createElement('td');
        tdActions.className = 'actions';
        tr.appendChild(tdActions);

        // Delete Button
        const delBtn = document.createElement('button');
        delBtn.innerText = '×';
        delBtn.title = browser.i18n.getMessage("deleteNote");
        delBtn.onclick = async () => {
          if (!confirm(browser.i18n.getMessage("deleteNoteConfirm"))) return;

          const pageData = await browser.storage.local.get(item.key);
          let notes = pageData[item.key] || [];
          notes = notes.filter(n => n.id !== item.id);

          if (notes.length === 0) {
            await browser.storage.local.remove(item.key);
          } else {
            await browser.storage.local.set({ [item.key]: notes });
          }
          tr.remove();
        };

        tdActions.appendChild(delBtn);
        tbody.appendChild(tr);
      });
    };

    render(rows);

    // Sorting Logic
    document.querySelectorAll('th[data-sort]').forEach(th => {
      th.addEventListener('click', () => {
        const type = th.dataset.sort;
        const isAsc = th.classList.toggle('asc');

        rows.sort((a, b) => {
          let valA = type === 'date' ? (a.lastUpdated || 0) : (a[type] || '').toLowerCase();
          let valB = type === 'date' ? (b.lastUpdated || 0) : (b[type] || '').toLowerCase();

          if (valA < valB) return isAsc ? -1 : 1;
          if (valA > valB) return isAsc ? 1 : -1;
          return 0;
        });
        render(rows);
      });
    });

  } catch (e) {
    console.error("Failed to load notes:", e);
    tbody.textContent = '';
    const errRow = document.createElement('tr');
    errRow.className = 'error';
    const errCell = document.createElement('td');
    errCell.colSpan = 5;
    errCell.textContent = 'Error loading notes: ' + e.message;
    errRow.appendChild(errCell);
    tbody.appendChild(errRow);
  }
});

// Utilities
function escapeHtml(text) {
  if (!text) return '';
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
function truncate(str, n) {
  return (str.length > n) ? str.substr(0, n - 1) + '...' : str;
}