/**
 * Web Browsing Toolbox - Popup Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize Localization
  if (typeof l10n !== 'undefined' && l10n.localize) {
    l10n.localize(document);
  }

  // Initialize Tabs
  initTabs();

  // Initialize Features
  await initStickyNotes();
  initSmartCopy();
  initUtilities();
  initQRCode();
  initPageMods();
  initUnlocker();
  initQuickText();
  initDataWiper();
  initDomainBlocker();
  await initAutoReload();
});

// --- Tab Navigation ---
function initTabs() {
  const tabs = document.querySelectorAll('.tab-btn');
  const contents = document.querySelectorAll('.tab-content');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      contents.forEach(c => c.classList.remove('active'));

      tab.classList.add('active');
      const targetId = tab.dataset.tab;
      document.getElementById(targetId).classList.add('active');
    });
  });
}

// --- Helper: Toast Notification ---
async function notify(tabId, message, type = 'info') {
  try {
    await browser.tabs.sendMessage(tabId, {
      action: 'showToast',
      message: message,
      type: type
    });
  } catch (e) {
    // Fallback for pages that don't support content scripts (e.g. system pages)
    console.warn('Toast failed or not supported on this page', e);
    // Maybe visual feedback in popup?
  }
}

// --- Helper: Get Current Tab ---
async function getCurrentTab() {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

// ==========================================
// Feature: Sticky Notes
// ==========================================
async function initStickyNotes() {
  const btnToggle = document.getElementById('btn-toggle-notes');
  const lblToggle = document.getElementById('lbl-toggle-notes');

  const updateState = (isEnabled) => {
    if (isEnabled) {
      btnToggle.classList.add('sticky-active');
      lblToggle.innerText = browser.i18n.getMessage("deactivateNote") || "Deactivate";
      btnToggle.style.borderColor = "#00d2ff"; // Visual active state
    } else {
      btnToggle.classList.remove('sticky-active');
      lblToggle.innerText = browser.i18n.getMessage("activateNote") || "Activate";
      btnToggle.style.borderColor = "rgba(255,255,255,0.1)";
    }
  };

  const data = await browser.storage.local.get('stickyNotesEnabled');
  updateState(!!data.stickyNotesEnabled);

  btnToggle.addEventListener('click', async () => {
    const data = await browser.storage.local.get('stickyNotesEnabled');
    const newState = !data.stickyNotesEnabled;

    await browser.storage.local.set({ stickyNotesEnabled: newState });
    updateState(newState);

    const tab = await getCurrentTab();
    try {
      await browser.tabs.sendMessage(tab.id, {
        action: 'toggleStickyNotes',
        enabled: newState
      });
      notify(tab.id, newState ? "Sticky Notes: ON" : "Sticky Notes: OFF", "success");
    } catch (e) { }
  });

  document.getElementById('btn-view-notes-list').addEventListener('click', () => {
    browser.tabs.create({ url: '/html/notes_list.html' });
  });
}

// ==========================================
// Feature: Smart Copy
// ==========================================
function initSmartCopy() {
  document.getElementById('btn-smart-copy').addEventListener('click', async () => {
    const tab = await getCurrentTab();

    await browser.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const existing = document.getElementById('smart-copy-style');
        if (existing) existing.remove();

        const style = document.createElement('style');
        style.id = 'smart-copy-style';
        style.textContent = `
                    * { cursor: copy !important; }
                    *:hover {
                        outline: 3px solid #00d2ff !important;
                        box-shadow: 0 0 15px rgba(0, 210, 255, 0.5) !important;
                        position: relative;
                        z-index: 2147483647;
                    }
                `;
        document.head.appendChild(style);

        chrome.runtime.sendMessage({ action: 'showToast', message: 'Select element to copy', type: 'info' }).catch(() => { });

        const clickHandler = (e) => {
          e.preventDefault(); e.stopPropagation();
          try {
            const selection = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(e.target);
            selection.removeAllRanges();
            selection.addRange(range);
            document.execCommand('copy');
            selection.removeAllRanges();
            cleanup();
            chrome.runtime.sendMessage({ action: 'showToast', message: 'Copied!', type: 'success' }).catch(() => { });
          } catch (err) {
            cleanup();
            chrome.runtime.sendMessage({ action: 'showToast', message: 'Copy Failed', type: 'error' }).catch(() => { });
          }
        };

        const keyHandler = (e) => {
          if (e.key === 'Escape') {
            cleanup();
            chrome.runtime.sendMessage({ action: 'showToast', message: 'Cancelled', type: 'info' }).catch(() => { });
          }
        };

        function cleanup() {
          document.removeEventListener('click', clickHandler, true);
          document.removeEventListener('keydown', keyHandler, true);
          document.getElementById('smart-copy-style')?.remove();
        }

        document.addEventListener('click', clickHandler, { capture: true, once: true });
        document.addEventListener('keydown', keyHandler, { capture: true, once: true });
      }
    });
    window.close();
  });
}

// ==========================================
// Feature: Auto Reload
// ==========================================
async function initAutoReload() {
  const tab = await getCurrentTab();
  const btnToggle = document.getElementById('btn-toggle-reload');
  const lblToggle = document.getElementById('lbl-toggle-reload');
  const inputInterval = document.getElementById('reload-interval');
  const statusEl = document.getElementById('reload-status');
  const timerEl = document.getElementById('reload-timer');

  const updateUI = (alarm) => {
    if (alarm) {
      btnToggle.classList.add('danger-action');
      btnToggle.classList.remove('primary-action');
      lblToggle.innerText = browser.i18n.getMessage("stop") || "Stop";
      statusEl.style.display = 'block';
      
      const next = new Date(alarm.scheduledTime);
      const now = new Date();
      const diff = Math.max(0, Math.round((next - now) / 1000));
      const m = Math.floor(diff / 60);
      const s = diff % 60;
      timerEl.innerText = `${m}:${s.toString().padStart(2, '0')}`;
    } else {
      btnToggle.classList.add('primary-action');
      btnToggle.classList.remove('danger-action');
      lblToggle.innerText = browser.i18n.getMessage("start") || "Start";
      statusEl.style.display = 'none';
    }
  };

  // Initial check
  const alarm = await browser.runtime.sendMessage({ action: 'getAutoReloadState', tabId: tab.id });
  updateUI(alarm);

  // Interval update for timer display
  let timerInterval = setInterval(async () => {
    const alarm = await browser.runtime.sendMessage({ action: 'getAutoReloadState', tabId: tab.id });
    if (alarm) {
      updateUI(alarm);
    } else {
      updateUI(null);
      clearInterval(timerInterval);
    }
  }, 1000);

  btnToggle.addEventListener('click', async () => {
    const currentAlarm = await browser.runtime.sendMessage({ action: 'getAutoReloadState', tabId: tab.id });
    if (currentAlarm) {
      await browser.runtime.sendMessage({ action: 'stopAutoReload', tabId: tab.id });
      updateUI(null);
    } else {
      const interval = parseFloat(inputInterval.value);
      if (isNaN(interval) || interval < 1) return;
      await browser.runtime.sendMessage({ action: 'startAutoReload', tabId: tab.id, interval: interval });
      const newAlarm = await browser.runtime.sendMessage({ action: 'getAutoReloadState', tabId: tab.id });
      updateUI(newAlarm);
    }
  });
}

// ==========================================
// Feature: Utilities
// ==========================================
function initUtilities() {
  document.getElementById('btn-popup-window').addEventListener('click', async () => {
    const tab = await getCurrentTab();
    browser.windows.create({ url: tab.url, type: 'popup', width: 800, height: 600 });
  });

    document.getElementById('btn-copy-link').addEventListener('click', async () => {
    const tab = await getCurrentTab();
    const text = `${tab.title}\n${tab.url}`;
    await navigator.clipboard.writeText(text);

    const btn = document.getElementById('btn-copy-link');
    const originalText = btn.textContent;
    btn.textContent = '✔';
    setTimeout(() => btn.textContent = originalText, 1500);
  });
}

// ==========================================
// Feature: Page Mods (Edit & Zap) - Improved Feedback
// ==========================================
function initPageMods() {
  const btnEdit = document.getElementById('btn-toggle-edit');

  // Check current state logic would be nice here but ContentEditable isn't easily persistent without state check injection.
  // We just assume start is OFF.
  let isEditMode = false;

  btnEdit.addEventListener('click', async () => {
    const tab = await getCurrentTab();

    // Visual toggle in popup
    isEditMode = !isEditMode;
    if (isEditMode) {
      btnEdit.style.background = "rgba(0, 210, 255, 0.2)";
      btnEdit.style.borderColor = "#00d2ff";
    } else {
      btnEdit.style.background = "";
      btnEdit.style.borderColor = "";
    }

    await browser.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const newState = document.body.contentEditable === 'true' ? 'false' : 'true';
        document.body.contentEditable = newState;
        // Toast
        const msg = newState === 'true' ? 'Edit Mode: ON' : 'Edit Mode: OFF';
        chrome.runtime.sendMessage({ action: 'showToast', message: msg, type: 'info' }).catch(() => { });
      }
    });
  });

  document.getElementById('btn-zap-element').addEventListener('click', async () => {
    const tab = await getCurrentTab();

    await browser.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const style = document.createElement('style');
        style.id = 'zap-style';
        style.textContent = `*:hover { outline: 2px solid red !important; background: rgba(255,0,0,0.1) !important; cursor: crosshair !important; }`;
        document.body.appendChild(style);

        chrome.runtime.sendMessage({ action: 'showToast', message: 'Click element to delete', type: 'info' }).catch(() => { });

        const handler = (e) => {
          e.preventDefault(); e.stopPropagation();
          e.target.remove();
          document.getElementById('zap-style').remove();
          chrome.runtime.sendMessage({ action: 'showToast', message: 'Deleted', type: 'success' }).catch(() => { });
        };
        document.addEventListener('click', handler, { capture: true, once: true });
      }
    });
    window.close();
  });
}

function initUnlocker() {
    document.getElementById('btn-run-unlock').addEventListener('click', async () => {
    const tab = await getCurrentTab();
    const opts = {
      context: document.getElementById('chk-unlock-context').checked,
      select: document.getElementById('chk-unlock-select').checked,
      copy: document.getElementById('chk-unlock-copy').checked
    };

    const btn = document.getElementById('btn-run-unlock');
    btn.textContent = '✔ Done';

    await browser.scripting.executeScript({
      target: { tabId: tab.id },
      args: [opts],
      func: (o) => {
        const stop = (e) => e.stopPropagation();
        if (o.context) ['contextmenu', 'mousedown', 'mouseup'].forEach(e => window.addEventListener(e, stop, true));
        if (o.select) {
          const s = document.createElement('style');
          s.textContent = '*,*::before,*::after{-webkit-user-select:text!important;user-select:text!important;}';
          document.head.appendChild(s);
          document.addEventListener('selectstart', stop, true);
        }
        if (o.copy) ['copy', 'cut', 'paste'].forEach(e => window.addEventListener(e, stop, true));

        chrome.runtime.sendMessage({ action: 'showToast', message: 'Restrictions Unlocked', type: 'success' }).catch(() => { });
      }
    });

    setTimeout(() => btn.textContent = '🔓 ' + (browser.i18n.getMessage("unlockSelected") || "Unlock"), 1000);
  });
}

// ==========================================
// Feature: Data Wiper
// ==========================================
function initDataWiper() {
  document.getElementById('btn-data-wiper').addEventListener('click', async () => {
    const tab = await getCurrentTab();
    if (!tab.url.startsWith('http')) return;

    const domain = new URL(tab.url).hostname;
    const range = document.getElementById('wiper-range').value;
    const btn = document.getElementById('btn-data-wiper');

    let since = 0;
    const now = Date.now();
    if (range === '10min') since = now - (10 * 60 * 1000);
    else if (range === '1hour') since = now - (60 * 60 * 1000);
    else if (range === '24hours') since = now - (24 * 60 * 60 * 1000);
    else since = 0; // Everything

    if (confirm(`Clear data for [${domain}] (${range})?`)) {
      // Removal options
      // Note: browser.browsingData.remove API differs by browser
      // Firefox uses 'hostnames' (Array of strings)
      // Chrome uses 'origins' (Array of strings)

      const options = {};
      if (since > 0) options.since = since;

      try {
        // Detect Browser Type
        let isFirefox = false;
        if (browser.runtime.getBrowserInfo) {
          // Only Firefox has getBrowserInfo
          isFirefox = true;
        }

        if (isFirefox) {
          options.hostnames = [domain];
        } else {
          const origin = new URL(tab.url).origin;
          options.origins = [origin];
        }

        // Firefox Limitation: localStorage cannot be cleared with 'since'
        // Chrome Limitation: history and cache cannot be cleared with 'origins'
        const types = {
          "cache": isFirefox,
          "cookies": true,
          "history": isFirefox,
          "localStorage": !(isFirefox && since > 0)
        };

        if (!types.localStorage && isFirefox && since > 0) {
          console.warn("Skipping localStorage clear (Firefox limitation with time range)");
        }

        await browser.browsingData.remove(options, types);
        btn.textContent = '✔ Cleared';
        notify(tab.id, "Data cleared for " + domain, "success");
      } catch (e) {
        console.error(e);

        // Retry Strategy: If one fails, try the other key?
        // This is useful if detection fails or polyfill behaves oddly
        if (e.message.includes("origins") || e.message.includes("hostnames")) {
          try {
            console.log("Retrying with alternative key...");
            delete options.hostnames;
            delete options.origins;

            // Swap
            if (e.message.includes("origins")) { // Failed on 'origins' -> Try 'hostnames' (Maybe Firefox pretended to be Chrome?)
              options.hostnames = [domain];
            } else {
              const origin = new URL(tab.url).origin;
              options.origins = [origin];
            }

            await browser.browsingData.remove(options, { "cache": true, "cookies": true, "history": true, "localStorage": true });
            btn.textContent = '✔ Cleared';
            notify(tab.id, "Data cleared (retry)", "success");
            return; // Success
          } catch (ex) {
            console.error("Retry failed", ex);
          }
        }

        alert("Failed to clear data: " + e.message);
      }

      setTimeout(() => {
        btn.textContent = '🗑️ ' + (browser.i18n.getMessage("clearData") || "Clear Data");
      }, 2000);
    }
  });
}

// ==========================================
// Feature: QR Code
// ==========================================
async function initQRCode() {
  const tab = await getCurrentTab();
  const container = document.getElementById('qrcode');
  if (typeof QRCode !== 'undefined') {
    container.textContent = '';
    new QRCode(container, {
      text: tab.url, width: 128, height: 128,
      colorDark: "#1c1c38", colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.M
    });
  }
}

// ==========================================
// Feature: Quick Text
// ==========================================
function initQuickText() {
  const qtKey = document.getElementById('qt-key');
  const qtVal = document.getElementById('qt-val');
  const qtList = document.getElementById('quick-text-list');

  const render = async () => {
    const data = await browser.storage.local.get('quickTexts');
    const items = data.quickTexts || [];
    qtList.textContent = '';
    if (items.length === 0) {
      qtList.textContent = browser.i18n.getMessage("quicktextNoRegistration") || "No items";
      return;
    }
    items.forEach((item, idx) => {
      const row = document.createElement('div');
      row.className = 'qt-item';

      const txt = document.createElement('span');
      txt.innerText = item.key;
      txt.style.flex = 1;
      txt.title = item.value;
      txt.onclick = async () => {
        const tab = await getCurrentTab();
        browser.scripting.executeScript({
          target: { tabId: tab.id },
          args: [item.value],
          func: (text) => {
            const el = document.activeElement;
            if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
              const [s, e] = [el.selectionStart, el.selectionEnd];
              el.value = el.value.substring(0, s) + text + el.value.substring(e);
            } else {
              document.execCommand('insertText', false, text);
            }
            chrome.runtime.sendMessage({ action: 'showToast', message: 'Pasted', type: 'success' }).catch(() => { });
          }
        });
      };

      const del = document.createElement('span');
      del.className = 'qt-del';
      del.textContent = '×';
      del.onclick = async (e) => {
        e.stopPropagation();
        items.splice(idx, 1);
        await browser.storage.local.set({ quickTexts: items });
        render();
      };
      row.append(txt, del);
      qtList.append(row);
    });
  };

  document.getElementById('btn-add-qt').addEventListener('click', async () => {
    if (!qtKey.value || !qtVal.value) return;
    const data = await browser.storage.local.get('quickTexts');
    const items = data.quickTexts || [];
    items.push({ key: qtKey.value, value: qtVal.value });
    await browser.storage.local.set({ quickTexts: items });
    qtKey.value = ''; qtVal.value = '';
    render();
  });
  render();
}

// ==========================================
// Feature: Domain Blocker
// ==========================================
async function initDomainBlocker() {
  const tab = await getCurrentTab();
  const listEl = document.getElementById('domain-list');
  const btnReload = document.getElementById('btn-reload-page');

  btnReload.addEventListener('click', () => { browser.tabs.reload(tab.id); window.close(); });

  if (!tab.url.startsWith('http')) {
    listEl.textContent = 'Unavailable';
    return;
  }

  const rules = await browser.declarativeNetRequest.getSessionRules();
  const blockedSet = new Set(rules.map(r => r.condition.urlFilter));

  const res = await browser.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      const s = new Set();
      document.querySelectorAll('script,iframe,img,link[rel="stylesheet"]').forEach(e => {
        const src = e.src || e.href;
        if (src && src.startsWith('http')) {
          try {
            const h = new URL(src).hostname;
            if (h !== location.hostname) s.add(h);
          } catch (x) { }
        }
      });
      return Array.from(s);
    }
  });

  const domains = res[0]?.result || [];
  listEl.textContent = '';
  if (domains.length === 0) listEl.textContent = browser.i18n.getMessage("noExternalResources") || "None";

  domains.forEach(d => {
    const row = document.createElement('div');
    row.className = 'domain-item';

    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.className = 'custom-checkbox';
    chk.id = `chk-${d}`;
    chk.style.width = '30px'; chk.style.height = '16px';

    const filter = `||${d}`;
    if (blockedSet.has(filter)) chk.checked = true;

    chk.addEventListener('change', async (e) => {
      btnReload.disabled = false;
      const ruleId = Array.from(d).reduce((h, c) => Math.imul(31, h) + c.charCodeAt(0) | 0, 0);
      const saneId = Math.abs(ruleId);

      if (e.target.checked) {
        await browser.declarativeNetRequest.updateSessionRules({
          addRules: [{
            id: saneId, priority: 1,
            action: { type: "redirect", redirect: { url: "http://localhost/" } },
            condition: { urlFilter: filter }
          }],
          removeRuleIds: [saneId]
        });
      } else {
        await browser.declarativeNetRequest.updateSessionRules({ removeRuleIds: [saneId] });
      }
    });

    const lbl = document.createElement('label');
    lbl.htmlFor = `chk-${d}`;
    lbl.innerText = d;
    lbl.style.fontSize = '12px';
    row.append(chk, lbl);
    listEl.append(row);
  });
}