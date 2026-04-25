/**
 * Sticky Notes 2.0
 */

const PAGE_KEY = 'stickyNotes_' + encodeURIComponent(location.origin + location.pathname);

const STICKY_STYLES = `
  .sn-wrapper { 
      position:absolute; width:220px; min-height:120px; 
      background: linear-gradient(135deg, #fff9b0, #fff540);
      border-radius: 8px;
      box-shadow: 0 5px 15px rgba(0,0,0,0.2); 
      z-index: 2147483646; 
      font-family: 'Segoe UI', sans-serif; 
      display:flex; flex-direction:column;
      transition: box-shadow 0.2s;
  }
  .sn-wrapper:hover {
      box-shadow: 0 8px 25px rgba(0,0,0,0.3);
      z-index: 2147483647;
  }
  .sn-header { 
      height: 24px; 
      background: rgba(0,0,0,0.05); 
      cursor: move; 
      border-radius: 8px 8px 0 0; 
      display: flex;
      justify-content: flex-end;
      align-items: center;
      padding: 0 8px;
  }
  .sn-close { 
      cursor:pointer; color:#888; font-weight:bold; font-size:16px; 
      line-height: 1;
      width: 16px; height: 16px; text-align: center;
      border-radius: 50%;
  }
  .sn-close:hover { background: rgba(0,0,0,0.1); color: #000; }
  .sn-body { 
      flex: 1; padding: 10px; font-size: 14px; color: #333; line-height: 1.5; outline: none; 
      overflow-y: auto;
  }
  
  .sn-dock {
      position: fixed; bottom: 20px; right: 20px;
      display: flex; gap: 10px; z-index: 2147483647;
  }
  
  .sn-btn {
      width: 40px; height: 40px; border-radius: 50%;
      border: none; cursor: pointer;
      background: #00d2ff; color: white;
      font-size: 20px;
      box-shadow: 0 4px 10px rgba(0,0,0,0.2);
      display: flex; align-items: center; justify-content: center;
      transition: transform 0.2s;
  }
  .sn-btn:hover { transform: scale(1.1); }
  .sn-btn.danger { background: #ff4757; }
`;

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

const Store = {
  async get() {
    const d = await browser.storage.local.get(PAGE_KEY);
    return d[PAGE_KEY] || [];
  },
  async set(notes) {
    await browser.storage.local.set({ [PAGE_KEY]: notes });
  }
};

async function initStickyNotes() {
  if (document.getElementById('__sn_style__')) return;

  const s = document.createElement('style');
  s.id = '__sn_style__';
  s.textContent = STICKY_STYLES;
  (document.head || document.documentElement).appendChild(s);

  const notes = await Store.get();
  notes.forEach(n => document.body.appendChild(createNote(n)));
  createDock();
}

function removeStickyNotes() {
  document.getElementById('__sn_style__')?.remove();
  document.querySelectorAll('.sn-wrapper').forEach(e => e.remove());
  document.querySelector('.sn-dock')?.remove();
}

function createNote(data) {
  const el = document.createElement('div');
  el.className = 'sn-wrapper';
  el.style.left = (data.left || 100) + 'px';
  el.style.top = (data.top || 100) + 'px';

  // Header
  const hdr = document.createElement('div');
  hdr.className = 'sn-header';
  const close = document.createElement('span');
  close.className = 'sn-close';
  close.textContent = '×';
  close.onclick = async () => {
    if (confirm('Delete?')) {
      const list = await Store.get();
      await Store.set(list.filter(x => x.id !== data.id));
      el.remove();
    }
  };
  hdr.appendChild(close);
  el.appendChild(hdr);

  // Body
  const body = document.createElement('div');
  body.className = 'sn-body';
  body.contentEditable = true;
  body.innerText = data.text || '';
  body.oninput = async () => {
    const list = await Store.get();
    const target = list.find(x => x.id === data.id);
    if (target) {
      target.text = body.innerText;
      target.lastUpdated = Date.now();
      Store.set(list);
    }
  };
  el.appendChild(body);

  // Drag
  hdr.onmousedown = (e) => {
    if (e.target === close) return;
    e.preventDefault();
    const startX = e.clientX - el.offsetLeft;
    const startY = e.clientY - el.offsetTop;

    const move = (e) => {
      el.style.left = (e.clientX - startX) + 'px';
      el.style.top = (e.clientY - startY) + 'px';
    };
    const stop = async () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', stop);
      const list = await Store.get();
      const target = list.find(x => x.id === data.id);
      if (target) {
        target.left = parseInt(el.style.left);
        target.top = parseInt(el.style.top);
        Store.set(list);
      }
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', stop);
  };

  return el;
}

function createDock() {
  const dock = document.createElement('div');
  dock.className = 'sn-dock';

  const addBtn = document.createElement('button');
  addBtn.className = 'sn-btn';
  addBtn.textContent = '＋';
  addBtn.title = "New Note";
  addBtn.onclick = async () => {
    const note = {
      id: uuid(),
      text: '',
      left: Math.random() * (window.innerWidth - 250),
      top: Math.random() * (window.innerHeight - 200) + 50,
      title: document.title,
      url: location.href,
      lastUpdated: Date.now()
    };
    const list = await Store.get();
    list.push(note);
    await Store.set(list);
    document.body.appendChild(createNote(note));
  };

  const clearBtn = document.createElement('button');
  clearBtn.className = 'sn-btn danger';
  clearBtn.textContent = '🗑';
  clearBtn.title = "Clear All";
  clearBtn.onclick = async () => {
    if (confirm('Clear all notes on this page?')) {
      await Store.set([]);
      document.querySelectorAll('.sn-wrapper').forEach(e => e.remove());
    }
  };

  dock.append(clearBtn, addBtn);
  document.body.appendChild(dock);
}

// Init Check
browser.storage.local.get('stickyNotesEnabled').then(res => {
  if (res.stickyNotesEnabled) initStickyNotes();
});

// Listener
browser.runtime.onMessage.addListener(msg => {
  if (msg.action === 'toggleStickyNotes') {
    msg.enabled ? initStickyNotes() : removeStickyNotes();
  }
});