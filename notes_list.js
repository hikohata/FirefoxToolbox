document.addEventListener('DOMContentLoaded', async () => {
  l10n.localize(document);
  const tbody = document.getElementById('listBody');
  
  // Fetch all data from storage
  const allData = await browser.storage.local.get(null);
  const rows = [];

  // Filter for sticky note keys
  for (const [key, val] of Object.entries(allData)) {
    if (key.startsWith('stickyNotes_') && Array.isArray(val)) {
      val.forEach(note => {
        rows.push({
          key: key, // needed for deletion
          ...note
        });
      });
    }
  }

  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty">' + browser.i18n.getMessage("noNotes") + '</td></tr>';
    return;
  }

  // Render Table
  const render = (data) => {
    tbody.innerHTML = '';
    data.forEach(item => {
      const tr = document.createElement('tr');
      
      const dateStr = item.lastUpdated ? new Date(item.lastUpdated).toLocaleString() : '-';
      
      tr.innerHTML = `
        <td style="font-weight:bold;">${escapeHtml(item.title)}</td>
        <td><a href="${item.url}" target="_blank">${truncate(item.url, 40)}</a></td>
        <td class="note-text">${escapeHtml(item.text)}</td>
        <td style="font-size:0.9em; color:#666;">${dateStr}</td>
        <td class="actions"></td>
      `;

      // Delete Button
      const delBtn = document.createElement('button');
      delBtn.innerText = '×';
      delBtn.title = browser.i18n.getMessage("deleteNote");
      delBtn.onclick = async () => {
        if(!confirm(browser.i18n.getMessage("deleteNoteConfirm"))) return;
        
        // Fetch current array for this page key
        const pageData = await browser.storage.local.get(item.key);
        let notes = pageData[item.key] || [];
        
        // Remove specific note
        notes = notes.filter(n => n.id !== item.id);
        
        if(notes.length === 0) {
            await browser.storage.local.remove(item.key);
        } else {
            await browser.storage.local.set({ [item.key]: notes });
        }
        
        tr.remove();
      };
      
      tr.querySelector('.actions').appendChild(delBtn);
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
});

// Utilities
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function truncate(str, n) {
  return (str.length > n) ? str.substr(0, n-1) + '...' : str;
}