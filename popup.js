/**
 * Web Browsing Toolbox
 * * Third Party Libraries:
 * - qrcode.min.js: Copyright (c) 2012 davidshimjs (MIT License) https://github.com/davidshimjs/qrcodejs
 */

// 多言語対応初期化
document.addEventListener('DOMContentLoaded', () => {
  l10n.localize(document);

  // ==========================================
  // 5. Sticky Notes (Toggle & List)
  // ==========================================
  
  const btnToggle = document.getElementById('btn-toggle-notes');
  const lblToggle = document.getElementById('lbl-toggle-notes');

  // 初期表示時のボタン状態設定
  (async function initStickyBtn() {
    const data = await browser.storage.local.get('stickyNotesEnabled');
    const isEnabled = !!data.stickyNotesEnabled;
    updateBtnState(isEnabled);
  })();

  function updateBtnState(isEnabled) {
    if (isEnabled) {
      btnToggle.classList.remove('primary');
      btnToggle.classList.add('outline');
      lblToggle.innerText = browser.i18n.getMessage("deactivateNote");
      btnToggle.style.backgroundColor = '#e6f7ff';
    } else {
      btnToggle.classList.add('primary');
      btnToggle.classList.remove('outline');
      lblToggle.innerText = browser.i18n.getMessage("activateNote");
      btnToggle.style.backgroundColor = '';
    }
  }

  // ON/OFF 切り替え処理
  btnToggle.addEventListener('click', async () => {
    // 現在の状態を取得して反転
    const data = await browser.storage.local.get('stickyNotesEnabled');
    const newState = !data.stickyNotesEnabled;

    // 設定保存
    await browser.storage.local.set({ stickyNotesEnabled: newState });
    updateBtnState(newState);

    // 現在のアクティブタブに通知して即時反映させる
    const tab = await getCurrentTab();
    try {
      await browser.tabs.sendMessage(tab.id, { 
        action: 'toggleStickyNotes', 
        enabled: newState 
      });
    } catch (e) {
      // コンテントスクリプトが読み込まれていないページ（chrome://など）ではエラーになるため無視
      console.log('Cannot inject into this page', e);
    }
  });

  // リスト表示
  document.getElementById('btn-view-notes-list').addEventListener('click', () => {
    browser.tabs.create({ url: 'notes_list.html' });
  });
});

// --- ユーティリティ関数 ---

/** 現在のアクティブなタブを取得 */
async function getCurrentTab() {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

/** 文字列から一意の整数IDを生成 (ドメインブロッカー用) */
function getHashId(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  return Math.abs(hash);
}

// ==========================================
// 1. スマートコピー (要素選択コピー)
// ==========================================
document.getElementById('btn-smart-copy').addEventListener('click', async () => {
  const tab = await getCurrentTab();
  
  // スクリプト注入完了後にウィンドウを閉じるため、ここでは閉じない
  await browser.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      // Firefox,Chrome両対応用(polyfill.js代替)
      const browser = window.browser || window.chrome;

      // 多重起動防止：既存スタイルがあれば削除
      const existing = document.getElementById('smart-copy-style');
      if (existing) existing.remove();

      alert(browser.i18n.getMessage("smartcopyGuide"));

      const style = document.createElement('style');
      style.id = 'smart-copy-style';
      // 強制的にスタイルを適用し、クリック可能な領域を視覚化
      style.innerHTML = `
        * { cursor: copy !important; }
        *:hover {
          outline: 3px solid #28a745 !important;
          box-shadow: 0 0 15px rgba(40,167,69,0.5) !important;
          z-index: 2147483647 !important;
        }
      `;
      (document.head || document.documentElement).appendChild(style);

      const clickHandler = (e) => {
        e.preventDefault();
        e.stopPropagation();

        const target = e.target;
        
        try {
          // 要素全体を選択範囲として設定
          const selection = window.getSelection();
          const range = document.createRange();
          range.selectNodeContents(target);
          selection.removeAllRanges();
          selection.addRange(range);

          // コピー実行
          document.execCommand('copy');
          
          // 後始末
          selection.removeAllRanges();
          cleanup();
          alert(browser.i18n.getMessage("smartcopyCopied"));
        } catch (err) {
          alert(browser.i18n.getMessage("smartcopyFailed") + err);
          cleanup();
        }
      };

      const keyHandler = (e) => {
        if (e.key === 'Escape') {
          cleanup();
          alert(browser.i18n.getMessage("canceled"));
        }
      };

      function cleanup() {
        // キャプチャフェーズでイベントを確実に削除
        document.removeEventListener('click', clickHandler, true);
        document.removeEventListener('keydown', keyHandler, true);
        const s = document.getElementById('smart-copy-style');
        if (s) s.remove();
      }

      // 他のイベントより優先させるためキャプチャフェーズ(true)を使用
      document.addEventListener('click', clickHandler, true);
      document.addEventListener('keydown', keyHandler, true);
    }
  });

  window.close();
});

// ==========================================
// 2. クイックテキスト (定型文)
// ==========================================
const qtKeyInput = document.getElementById('qt-key');
const qtValInput = document.getElementById('qt-val');
const qtListEl = document.getElementById('quick-text-list');

/** 保存された定型文を読み込みリストを表示 */
async function renderQuickTexts() {
  const data = await browser.storage.local.get('quickTexts');
  const items = data.quickTexts || [];
  
  qtListEl.innerHTML = '';
  if (items.length === 0) {
    qtListEl.innerHTML = '<div style="padding:4px;color:#999;">' + browser.i18n.getMessage("quicktextNoRegistration") + '</div>';
    return;
  }

  items.forEach((item, index) => {
    const row = document.createElement('div');
    row.className = 'qt-item';
    
    // ラベル部分：クリックで貼り付け実行
    const label = document.createElement('span');
    label.style.flexGrow = '1';
    label.innerText = item.key;
    label.title = item.value;
    label.onclick = async () => {
      const tab = await getCurrentTab();
      browser.scripting.executeScript({
        target: { tabId: tab.id },
        args: [item.value],
        func: (textToInsert) => {
          // Firefox,Chrome両対応用(polyfill.js代替)
          const browser = window.browser || window.chrome;

          const activeEl = document.activeElement;
          // input/textareaの場合
          if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
            const start = activeEl.selectionStart;
            const end = activeEl.selectionEnd;
            const val = activeEl.value;
            // カーソル位置に挿入
            activeEl.value = val.substring(0, start) + textToInsert + val.substring(end);
            activeEl.selectionStart = activeEl.selectionEnd = start + textToInsert.length;
          } 
          // ContentEditableの場合 (Gmail等)
          else if (activeEl && activeEl.isContentEditable) {
              document.execCommand('insertText', false, textToInsert);
          } else {
            alert(browser.i18n.getMessage("quicktextGuideToPaste"));
          }
        }
      });
    };

    // 削除ボタン
    const delBtn = document.createElement('span');
    delBtn.className = 'qt-del';
    delBtn.innerText = '×';
    delBtn.onclick = async (e) => {
      e.stopPropagation();
      items.splice(index, 1);
      await browser.storage.local.set({ quickTexts: items });
      renderQuickTexts();
    };

    row.appendChild(label);
    row.appendChild(delBtn);
    qtListEl.appendChild(row);
  });
}

// 定型文の追加処理
document.getElementById('btn-add-qt').addEventListener('click', async () => {
  const key = qtKeyInput.value.trim();
  const val = qtValInput.value;
  if (!key || !val) return;

  const data = await browser.storage.local.get('quickTexts');
  const items = data.quickTexts || [];
  items.push({ key, value: val });
  
  await browser.storage.local.set({ quickTexts: items });
  qtKeyInput.value = '';
  qtValInput.value = '';
  renderQuickTexts();
});

// 初期表示
renderQuickTexts();

// ==========================================
// 3. QRコード (オフライン・ライブラリ使用)
// ==========================================
(async function initQRCode() {
  const tab = await getCurrentTab();
  const container = document.getElementById('qrcode');
  
  // qrcode.js がロードされているか確認
  if (typeof QRCode !== 'undefined') {
    new QRCode(container, {
      text: tab.url,
      width: 128,
      height: 128,
      colorDark : "#000000",
      colorLight : "#ffffff",
      correctLevel : QRCode.CorrectLevel.M
    });
  } else {
    container.innerHTML = "Library Error";
    console.error("qrcode.js not found.");
  }
})();

// ==========================================
// 4. その他機能 (ページ操作・制限解除・ブロック)
// ==========================================

// ポップアップウィンドウ化
document.getElementById('btn-popup-window').addEventListener('click', async () => {
  const tab = await getCurrentTab();
  browser.windows.create({ url: tab.url, type: 'popup', width: 600, height: 400 });
});

// リンク情報のコピー (HTML/Text)
document.getElementById('btn-copy-link').addEventListener('click', async () => {
  const tab = await getCurrentTab();
  try {
    const data = [new ClipboardItem({
      "text/html": new Blob([`<a href="${tab.url}">${tab.title}</a>`], { type: "text/html" }),
      "text/plain": new Blob([`${tab.title}\n${tab.url}`], { type: "text/plain" })
    })];
    await navigator.clipboard.write(data);
    
    // 完了フィードバック
    const btn = document.getElementById('btn-copy-link');
    btn.innerHTML = '<span class="icon">✔</span> ' + browser.i18n.getMessage("completed");
    setTimeout(() => btn.innerHTML = '<span class="icon">🔗</span> ' + browser.i18n.getMessage("copyLink"), 1500);
  } catch (e) {
    console.error(e);
  }
});

// 編集モード (ContentEditable) トグル
document.getElementById('btn-toggle-edit').addEventListener('click', async () => {
  const tab = await getCurrentTab();
  browser.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      // Firefox,Chrome両対応用(polyfill.js代替)
      const browser = window.browser || window.chrome;

      document.body.contentEditable = document.body.contentEditable === 'true' ? 'false' : 'true';
      alert(browser.i18n.getMessage("editMode") + ': ' + (document.body.contentEditable === 'true' ? 'ON' : 'OFF'));
    }
  });
});

// 要素選択削除
document.getElementById('btn-zap-element').addEventListener('click', async () => {
  const tab = await getCurrentTab();
  
  await browser.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      // Firefox,Chrome両対応用(polyfill.js代替)
      const browser = window.browser || window.chrome;

      const existing = document.getElementById('zap-style');
      if (existing) existing.remove();

      alert(browser.i18n.getMessage("deleteMode"));
      
      const style = document.createElement('style');
      style.id = 'zap-style';
      style.innerHTML = `
        * { cursor: crosshair !important; }
        *:hover {
          outline: 2px solid red !important;
          background-color: rgba(255, 0, 0, 0.1) !important;
          z-index: 2147483647 !important;
        }
      `;
      (document.head || document.documentElement).appendChild(style);
      
      const clickHandler = (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.target.remove(); // 要素削除
      };
      
      const keyHandler = (e) => {
        if(e.key === 'Escape') {
          cleanup();
          alert(browser.i18n.getMessage("finished"));
        }
      };
      
      function cleanup() {
        document.removeEventListener('click', clickHandler, true);
        document.removeEventListener('keydown', keyHandler, true);
        const s = document.getElementById('zap-style');
        if(s) s.remove();
      }
      
      document.addEventListener('click', clickHandler, true);
      document.addEventListener('keydown', keyHandler, true);
    }
  });

  window.close();
});

// 制限解除 (右クリック・コピー等)
document.getElementById('btn-run-unlock').addEventListener('click', async () => {
  const tab = await getCurrentTab();
  const opts = {
    context: document.getElementById('chk-unlock-context').checked,
    select: document.getElementById('chk-unlock-select').checked,
    copy: document.getElementById('chk-unlock-copy').checked
  };
  
  browser.scripting.executeScript({
    target: { tabId: tab.id },
    args: [opts],
    func: (o) => {
      // Firefox,Chrome両対応用(polyfill.js代替)
      const browser = window.browser || window.chrome;

      const stop = (e) => e.stopPropagation();
      
      // 右クリック禁止解除
      if(o.context) ['contextmenu','mousedown','mouseup'].forEach(e=>{
        document.addEventListener(e,stop,true);
        window.addEventListener(e,stop,true);
      });
      
      // 選択禁止解除
      if(o.select) {
        const s=document.createElement('style');
        s.innerHTML='*,*::before,*::after{-webkit-user-select:text!important;user-select:text!important;}';
        document.head.appendChild(s);
        document.addEventListener('selectstart',stop,true);
      }
      
      // コピー禁止解除
      if(o.copy) ['copy','cut','paste','dragstart'].forEach(e=>{
        document.addEventListener(e,stop,true);
        window.addEventListener(e,stop,true);
      });
      
      alert(browser.i18n.getMessage("unlocked"));
    }
  });
});

// ドメインブロッカー (localhostへのリダイレクト)
(async function initDomainBlocker() {
  const tab = await getCurrentTab();
  const listEl = document.getElementById('domain-list');
  const btnReload = document.getElementById('btn-reload-page');

  // リロードボタンの動作
  btnReload.addEventListener('click', () => { browser.tabs.reload(tab.id); window.close(); });
  
  if (!tab.url.startsWith('http')) { listEl.innerHTML = '<div style="padding:4px;">' + browser.i18n.getMessage("unavailable") + '</div>'; return; }

  // 現在適用中のルールを取得
  const activeRules = await browser.declarativeNetRequest.getSessionRules();
  const blockedFilters = new Set(activeRules.map(r => r.condition.urlFilter));

  // ページ内の外部ドメインを抽出
  const pageDomainsResult = await browser.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      // Firefox,Chrome両対応用(polyfill.js代替)
      const browser = window.browser || window.chrome;

      const d = new Set();
      document.querySelectorAll('script,iframe,img,link[rel="stylesheet"]').forEach(e => {
        const s = e.src || e.href;
        if(s && s.startsWith('http')) {
          try {
            const h = new URL(s).hostname;
            if(h !== location.hostname) d.add(h);
          } catch(x){}
        }
      });
      return Array.from(d);
    }
  });
  
  const pageDomains = pageDomainsResult[0] ? pageDomainsResult[0].result : [];

  listEl.innerHTML = '';
  if(pageDomains.length === 0) { listEl.innerHTML='<div style="padding:4px;">' + browser.i18n.getMessage("noExternalResources") + '</div>'; return; }

  // ドメインリスト生成
  pageDomains.forEach(domain => {
    const row = document.createElement('div');
    row.className = 'domain-item';
    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.id = `chk-${domain}`;
    
    // チェック状態の復元
    const filterStr = `||${domain}`;
    if (blockedFilters.has(filterStr)) chk.checked = true;

    // チェック変更時のイベント
    chk.addEventListener('change', async (e) => {
      btnReload.disabled = false; // 更新ボタン有効化
      const ruleId = getHashId(domain);
      if (e.target.checked) {
        // ルール追加: localhostへリダイレクト
        await browser.declarativeNetRequest.updateSessionRules({
          addRules: [{
            id: ruleId,
            priority: 1,
            action: { type: "redirect", redirect: { url: "http://localhost/" } },
            condition: { urlFilter: filterStr }
          }],
          removeRuleIds: [ruleId] // 重複防止
        });
      } else {
        // ルール削除
        await browser.declarativeNetRequest.updateSessionRules({ removeRuleIds: [ruleId] });
      }
    });

    const lbl = document.createElement('label');
    lbl.htmlFor = `chk-${domain}`;
    lbl.innerText = domain;
    row.appendChild(chk);
    row.appendChild(lbl);
    listEl.appendChild(row);
  });

  // 全解除ボタン
  document.getElementById('btn-reset-blocker').addEventListener('click', async () => {
    await browser.declarativeNetRequest.updateSessionRules({ removeRuleIds: pageDomains.map(d => getHashId(d)) });
    listEl.querySelectorAll('input').forEach(c => c.checked = false);
    btnReload.disabled = false;
  });
})();