/**
 * Background Service Worker
 * Handles CSV Viewer navigation interception.
 */

// CSV Interception
if (browser.webNavigation && browser.webNavigation.onBeforeNavigate) {
    browser.webNavigation.onBeforeNavigate.addListener((details) => {
        if (details.frameId !== 0) return; // Only main frame

        try {
            const url = new URL(details.url);

            // Check for CSV/TSV extension
            if ((url.pathname.endsWith(".csv") || url.pathname.endsWith(".tsv")) && !url.href.includes("viewer.html")) {

                // Redirect to internal viewer with original URL as param
                const viewerUrl = browser.runtime.getURL("html/viewer.html") + "?url=" + encodeURIComponent(details.url);

                browser.tabs.update(details.tabId, { url: viewerUrl });
            }
        } catch (e) {
            console.error("Navigation error", e);
        }
    });
}

// Auto Reload Management
browser.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name.startsWith("reload_tab_")) {
        const tabId = parseInt(alarm.name.replace("reload_tab_", ""));
        try {
            const tab = await browser.tabs.get(tabId);
            const storageKey = `reload_url_${tabId}`;
            const data = await browser.storage.local.get(storageKey);
            const startUrl = data[storageKey];

            // Final safety check before reload
            if (tab.url !== startUrl) {
                browser.alarms.clear(alarm.name);
                browser.storage.local.remove(storageKey);
                return;
            }

            // Use update instead of reload to avoid "Confirm Form Resubmission"
            browser.tabs.update(tabId, { url: tab.url });
        } catch (e) {
            browser.alarms.clear(alarm.name);
            browser.storage.local.remove(`reload_url_${tabId}`);
        }
    }
});

// Watch for manual navigation to stop auto-reload immediately
browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.url) {
        const alarmName = `reload_tab_${tabId}`;
        const alarm = await browser.alarms.get(alarmName);
        if (alarm) {
            const storageKey = `reload_url_${tabId}`;
            const data = await browser.storage.local.get(storageKey);
            const startUrl = data[storageKey];

            if (startUrl && changeInfo.url !== startUrl) {
                console.log("Immediate stop: URL changed manually", tabId);
                browser.alarms.clear(alarmName);
                browser.storage.local.remove(storageKey);
            }
        }
    }
});

browser.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'startAutoReload') {
        const alarmName = `reload_tab_${msg.tabId}`;
        const storageKey = `reload_url_${msg.tabId}`;
        
        // Save initial URL to track navigation
        browser.tabs.get(msg.tabId).then(tab => {
            browser.storage.local.set({ [storageKey]: tab.url });
            browser.alarms.create(alarmName, {
                periodInMinutes: msg.interval
            });
        });
        return Promise.resolve({ success: true });
    } else if (msg.action === 'stopAutoReload') {
        const alarmName = `reload_tab_${msg.tabId}`;
        browser.alarms.clear(alarmName);
        browser.storage.local.remove(`reload_url_${msg.tabId}`);
        return Promise.resolve({ success: true });
    } else if (msg.action === 'getAutoReloadState') {
        const alarmName = `reload_tab_${msg.tabId}`;
        return browser.alarms.get(alarmName);
    }
});
