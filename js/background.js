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
