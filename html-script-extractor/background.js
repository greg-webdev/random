/**
 * Background Service Worker
 * Intercepts network requests for scripts and handles CORS-free HTML/script fetching
 */

const tabScriptsMap = new Map();

function isSupportedUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return url.startsWith('http://') || url.startsWith('https://');
}

function getTabStore(tabId) {
  if (!tabScriptsMap.has(tabId)) {
    tabScriptsMap.set(tabId, new Map());
  }
  return tabScriptsMap.get(tabId);
}

function updateBadge(tabId) {
  if (!tabId || tabId < 0) return;
  const store = tabScriptsMap.get(tabId);
  const count = store ? store.size : 0;
  chrome.action.setBadgeText({
    tabId: tabId,
    text: count > 0 ? String(count) : ''
  }).catch(() => {});

  chrome.action.setBadgeBackgroundColor({
    tabId: tabId,
    color: '#4f46e5'
  }).catch(() => {});
}

// 1. Intercept Network Requests via chrome.webRequest
if (chrome.webRequest && chrome.webRequest.onBeforeRequest) {
  chrome.webRequest.onBeforeRequest.addListener(
    (details) => {
      const { tabId, url, type, method, initiator, timeStamp } = details;
      if (tabId < 0 || !isSupportedUrl(url)) return;

      const isScriptType = type === 'script';
      const isJsExtension = /\.(js|mjs|cjs)(\?.*)?$/i.test(url);

      if (isScriptType || isJsExtension) {
        const store = getTabStore(tabId);
        if (!store.has(url)) {
          store.set(url, {
            url: url,
            category: 'network_request',
            type: 'external',
            method: method || 'GET',
            initiator: initiator || '',
            requestType: type,
            timestamp: timeStamp || Date.now(),
            fromNetwork: true
          });
          updateBadge(tabId);
        }
      }
    },
    { urls: ['http://*/*', 'https://*/*'] }
  );
}

// 2. Clear state on tab navigation / reload
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    tabScriptsMap.delete(tabId);
    updateBadge(tabId);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  tabScriptsMap.delete(tabId);
});

// 3. Message handler for Content Script and Popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const tabId = (sender && sender.tab && sender.tab.id) || message.tabId;

  // Get network script list for a specific tab
  if (message.action === 'GET_NETWORK_SCRIPTS') {
    const targetTabId = message.tabId;
    const store = tabScriptsMap.get(targetTabId);
    const list = store ? Array.from(store.values()) : [];
    sendResponse({ scripts: list });
    return false;
  }

  // Fetch Raw Server HTML (Direct HTTP fetch from background worker)
  if (message.action === 'FETCH_RAW_HTML') {
    const targetUrl = message.url;

    if (!isSupportedUrl(targetUrl)) {
      sendResponse({
        success: false,
        error: `Scheme not supported for server fetch: ${targetUrl}`
      });
      return false;
    }

    const startTime = Date.now();

    fetch(targetUrl, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Upgrade-Insecure-Requests': '1'
      }
    })
      .then(async (response) => {
        const text = await response.text();
        const duration = Date.now() - startTime;
        const headers = {};
        for (const [key, value] of response.headers.entries()) {
          headers[key] = value;
        }

        sendResponse({
          success: true,
          status: response.status,
          statusText: response.statusText,
          headers: headers,
          rawHtml: text,
          byteSize: new TextEncoder().encode(text).length,
          duration: duration,
          url: response.url || targetUrl
        });
      })
      .catch((error) => {
        sendResponse({
          success: false,
          error: error.message || 'Failed to fetch raw HTML'
        });
      });

    return true; // Keep message channel open for async response
  }

  // Fetch individual script source code
  if (message.action === 'FETCH_SCRIPT_SOURCE') {
    const scriptUrl = message.url;

    if (!isSupportedUrl(scriptUrl)) {
      sendResponse({
        success: false,
        error: `Scheme not supported for script fetch: ${scriptUrl}`
      });
      return false;
    }

    fetch(scriptUrl, {
      method: 'GET',
      cache: 'force-cache'
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} ${response.statusText}`);
        }
        const code = await response.text();
        sendResponse({
          success: true,
          code: code,
          contentType: response.headers.get('content-type') || 'application/javascript',
          byteSize: new TextEncoder().encode(code).length
        });
      })
      .catch((error) => {
        sendResponse({
          success: false,
          error: error.message
        });
      });

    return true; // Keep message channel open for async response
  }
});
