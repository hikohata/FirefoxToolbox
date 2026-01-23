(function () {
    if (window.browser) {
        // Logic for Firefox (Native support)
        return;
    }

    console.log("Polyfilling 'browser' namespace for Chrome");

    const promisify = (fn, context) => {
        return (...args) => {
            return new Promise((resolve, reject) => {
                try {
                    fn.call(context, ...args, (result) => {
                        if (chrome.runtime.lastError) {
                            reject(chrome.runtime.lastError);
                        } else {
                            resolve(result);
                        }
                    });
                } catch (e) {
                    // Fallback for synchronous failures
                    reject(e);
                }
            });
        };
    };

    const storage = {
        local: {
            get: promisify(chrome.storage.local.get, chrome.storage.local),
            set: promisify(chrome.storage.local.set, chrome.storage.local),
            remove: promisify(chrome.storage.local.remove, chrome.storage.local),
            clear: promisify(chrome.storage.local.clear, chrome.storage.local),
        }
    };

    const tabs = {
        query: promisify(chrome.tabs.query, chrome.tabs),
        create: promisify(chrome.tabs.create, chrome.tabs),
        sendMessage: promisify(chrome.tabs.sendMessage, chrome.tabs),
        reload: promisify(chrome.tabs.reload, chrome.tabs),
        update: promisify(chrome.tabs.update, chrome.tabs),
    };

    const runtime = {
        getURL: (path) => chrome.runtime.getURL(path),
        onMessage: chrome.runtime.onMessage,
        sendMessage: promisify(chrome.runtime.sendMessage, chrome.runtime),
        // Add getBrowserInfo fallback for Chrome (returns mocked info)
        getBrowserInfo: () => Promise.resolve({ name: "Chrome" }),
        lastError: chrome.runtime.lastError
    };

    const scripting = {
        executeScript: promisify(chrome.scripting.executeScript, chrome.scripting)
    };

    const windows = {
        create: promisify(chrome.windows.create, chrome.windows)
    };

    const declarativeNetRequest = {
        getSessionRules: promisify(chrome.declarativeNetRequest.getSessionRules, chrome.declarativeNetRequest),
        updateSessionRules: promisify(chrome.declarativeNetRequest.updateSessionRules, chrome.declarativeNetRequest)
    };

    // BrowsingData
    let browsingData = {};
    if (chrome.browsingData) {
        browsingData = {
            remove: promisify(chrome.browsingData.remove, chrome.browsingData)
        };
    }

    const webNavigation = chrome.webNavigation;

    window.browser = {
        storage,
        tabs,
        runtime,
        scripting,
        windows,
        declarativeNetRequest,
        i18n: chrome.i18n,
        browsingData,
        webNavigation
    };
})();