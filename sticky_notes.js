/**
 * Sticky Notes Content Script
 * ページ読み込み時に自動実行され、設定に応じて付箋を表示・非表示にします
 */

// --- 定数・ユーティリティ ---
const PAGE_KEY = 'stickyNotes_' + encodeURIComponent(location.origin + location.pathname);

// スタイル定義
const STICKY_CSS = `
  .sn { position:absolute; width:200px; min-height:100px; background:#fffa65; 
        border:1px solid #e0e0e0; box-shadow:2px 2px 6px rgba(0,0,0,0.2); 
        padding:5px; z-index:2147483647; font-family:Arial,sans-serif; 
        font-size:14px; line-height:1.4; border-radius:4px; display:flex; flex-direction:column; }
  .sn-header { cursor:move; height:20px; background:rgba(0,0,0,0.05); margin:-5px -5px 5px -5px; border-radius:4px 4px 0 0; position:relative; }
  .sn .close { position:absolute; top:0px; right:4px; cursor:pointer; font-weight:bold; color:#888; font-size:16px; }
  .sn .close:hover { color:#444; }
  .sn-body { outline:none; flex-grow:1; white-space:pre-wrap; text-align:left; }
  .sn-ctrl-btn { position:fixed; bottom:20px; z-index:2147483647; padding:10px 15px; 
                 background:#fffa65; border:1px solid #999; cursor:pointer; 
                 box-shadow: 0 2px 5px rgba(0,0,0,0.2); font-weight:bold; border-radius:20px; }
  .sn-ctrl-btn:hover { background:#fff540; transform:translateY(-2px); }
`;

// UUID生成
const uuid = () => {
  return 'xxxxxx-xxxx-4xxx-yxxx-xxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : r & 0x3 | 0x8;
    return v.toString(16);
  });
};

// ストレージ操作
const loadNotes = async () => {
  const data = await browser.storage.local.get(PAGE_KEY);
  return data[PAGE_KEY] || [];
};

const saveNotes = async (notes) => {
  notes.forEach(n => n.lastUpdated = Date.now());
  await browser.storage.local.set({ [PAGE_KEY]: notes });
};

// --- DOM操作 ---

// 付箋とコントロールボタンの初期化
async function initStickyNotes() {
  if (document.getElementById('__sn_style__')) return; // 既に有効なら何もしない

  // スタイル注入
  const s = document.createElement('style');
  s.id = '__sn_style__';
  s.textContent = STICKY_CSS;
  (document.head || document.documentElement).appendChild(s);

  // ノート読み込み
  const notes = await loadNotes();
  notes.forEach(n => document.body.appendChild(createNoteEl(n)));

  // コントロールボタン追加
  addControlButtons();
}

// 付箋機能の削除（非表示化）
function removeStickyNotes() {
  // スタイル削除
  const style = document.getElementById('__sn_style__');
  if (style) style.remove();

  // 要素削除
  document.querySelectorAll('.sn').forEach(e => e.remove());
  document.querySelectorAll('.sn-ctrl-btn').forEach(e => e.remove());
}

// 付箋DOM生成
function createNoteEl(n) {
  const d = document.createElement('div');
  d.className = 'sn';
  d.dataset.id = n.id;
  d.style.left = (n.left || 100) + 'px';
  d.style.top = (n.top || 100) + 'px';
  d.style.width = (n.width || 200) + 'px';

  // Header
  const h = document.createElement('div');
  h.className = 'sn-header';
  const c = document.createElement('span');
  c.className = 'close';
  c.innerHTML = '&times;';
  c.title = 'Delete Note';
  h.appendChild(c);
  d.appendChild(h);

  // Body
  const t = document.createElement('div');
  t.className = 'sn-body';
  t.contentEditable = true;
  t.innerText = n.text || '';
  d.appendChild(t);

  // Dragging Logic
  h.onmousedown = (e) => {
    if (e.target.className === 'close') return;
    e.preventDefault();
    const ox = e.clientX - d.offsetLeft;
    const oy = e.clientY - d.offsetTop;

    const mv = (e) => {
      d.style.left = (e.clientX - ox) + 'px';
      d.style.top = (e.clientY - oy) + 'px';
    };

    const up = async () => {
      document.removeEventListener('mousemove', mv);
      document.removeEventListener('mouseup', up);
      // Save Position
      const ns = await loadNotes();
      const nd = ns.find(x => x.id === n.id);
      if (nd) {
        nd.left = parseInt(d.style.left);
        nd.top = parseInt(d.style.top);
        await saveNotes(ns);
      }
    };
    document.addEventListener('mousemove', mv);
    document.addEventListener('mouseup', up);
  };

  // Delete Logic
  c.onclick = async () => {
    if(confirm('Delete this note?')) {
      const ns = await loadNotes();
      const newNs = ns.filter(x => x.id !== n.id);
      await saveNotes(newNs);
      d.remove();
    }
  };

  // Auto-save Logic
  t.addEventListener('input', async () => {
    const ns = await loadNotes();
    const nd = ns.find(x => x.id === n.id);
    if (nd) {
      nd.text = t.innerText;
      await saveNotes(ns);
    }
  });

  return d;
}

// ボタン追加
function addControlButtons() {
  // Clear All
  const btnClear = document.createElement('button');
  btnClear.className = 'sn-ctrl-btn';
  btnClear.innerText = '🗑 ' + browser.i18n.getMessage("clearPageNotes");
  btnClear.style.left = '20px';
  btnClear.onclick = async () => {
    if(confirm(browser.i18n.getMessage("clearPageNotesConfirm"))) {
      await saveNotes([]);
      document.querySelectorAll('.sn').forEach(el => el.remove());
    }
  };
  document.body.appendChild(btnClear);

  // New Note
  const btnNew = document.createElement('button');
  btnNew.className = 'sn-ctrl-btn';
  btnNew.innerText = '＋ ' + browser.i18n.getMessage("newNote");
  btnNew.style.right = '20px';
  btnNew.onclick = async () => {
    const nn = {
      id: uuid(),
      title: document.title,
      url: location.href,
      text: '',
      left: 150 + (Math.random()*50),
      top: 150 + (Math.random()*50),
      width: 200
    };
    const ns = await loadNotes();
    ns.push(nn);
    await saveNotes(ns);
    document.body.appendChild(createNoteEl(nn));
  };
  document.body.appendChild(btnNew);
}

// --- メイン処理 ---

// 1. 設定を読み込んで初期化判断
browser.storage.local.get('stickyNotesEnabled').then((res) => {
  // デフォルトは無効(undefined) または trueなら有効化
  // ※使い勝手を考慮し、初回インストール時はOFF、ユーザがONにしたら次回から自動ONとします
  if (res.stickyNotesEnabled) {
    initStickyNotes();
  }
});

// 2. Popupからのメッセージ受信 (ON/OFF切り替え)
browser.runtime.onMessage.addListener((message) => {
  if (message.action === 'toggleStickyNotes') {
    if (message.enabled) {
      initStickyNotes();
    } else {
      removeStickyNotes();
    }
  }
});