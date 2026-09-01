/**
 * HTML & Script Harvester - Popup Controller
 */

// Application State
const state = {
  tab: null,
  pageUrl: '',
  pageTitle: '',
  renderedHtml: '',
  rawHtml: '',
  rawMeta: null,
  scripts: [],         // Merged & deduplicated scripts
  filteredScripts: [],
  selectedScript: null,
  activeFilter: 'all',
  searchQuery: '',
  viewerCode: '',
  viewerTitle: ''
};

// UI Elements Cache
const elements = {
  targetHost: document.getElementById('target-host'),
  btnDownloadZip: document.getElementById('btn-download-zip'),
  btnRescan: document.getElementById('btn-rescan'),
  btnCopyUrls: document.getElementById('btn-copy-urls'),

  navTabs: document.querySelectorAll('.nav-tab'),
  tabPanels: document.querySelectorAll('.tab-panel'),
  
  badgeScriptsCount: document.getElementById('badge-scripts-count'),
  badgeRawStatus: document.getElementById('badge-raw-status'),
  badgeDomSize: document.getElementById('badge-dom-size'),

  scriptSearch: document.getElementById('script-search'),
  clearSearch: document.getElementById('clear-search'),
  filterChips: document.querySelectorAll('.chip'),
  
  countAll: document.getElementById('count-all'),
  countExternal: document.getElementById('count-external'),
  countInline: document.getElementById('count-inline'),
  countDynamic: document.getElementById('count-dynamic'),
  scriptsSummaryText: document.getElementById('scripts-summary-text'),
  scriptsList: document.getElementById('scripts-list'),

  // Raw HTML Tab
  rawStatusTag: document.getElementById('raw-status-tag'),
  rawSizeTag: document.getElementById('raw-size-tag'),
  rawTimeTag: document.getElementById('raw-time-tag'),
  btnCopyRawHtml: document.getElementById('btn-copy-raw-html'),
  btnDownloadRawHtml: document.getElementById('btn-download-raw-html'),
  rawHtmlLoading: document.getElementById('raw-html-loading'),
  rawHtmlPre: document.getElementById('raw-html-pre'),
  rawHtmlCode: document.getElementById('raw-html-code'),

  // Live DOM Tab
  domSizeTag: document.getElementById('dom-size-tag'),
  domElementsTag: document.getElementById('dom-elements-tag'),
  btnCopyDomHtml: document.getElementById('btn-copy-dom-html'),
  btnDownloadDomHtml: document.getElementById('btn-download-dom-html'),
  domHtmlPre: document.getElementById('dom-html-pre'),
  domHtmlCode: document.getElementById('dom-html-code'),

  // Viewer Tab
  viewerTypeTag: document.getElementById('viewer-type-tag'),
  viewerTitle: document.getElementById('viewer-title'),
  btnViewerFormat: document.getElementById('btn-viewer-format'),
  btnViewerCopy: document.getElementById('btn-viewer-copy'),
  btnViewerDownload: document.getElementById('btn-viewer-download'),
  viewerEmpty: document.getElementById('viewer-empty'),
  viewerLoading: document.getElementById('viewer-loading'),
  viewerPre: document.getElementById('viewer-pre'),
  viewerCode: document.getElementById('viewer-code'),

  toast: document.getElementById('toast')
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();
  await loadCurrentTabData();
});

// Setup UI event listeners
function setupEventListeners() {
  // Navigation Tabs
  elements.navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetPanelId = tab.getAttribute('data-tab');
      switchTab(targetPanelId);
    });
  });

  // Filter Chips
  elements.filterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      elements.filterChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.activeFilter = chip.getAttribute('data-filter');
      applyScriptFilters();
    });
  });

  // Search Input
  elements.scriptSearch.addEventListener('input', (e) => {
    state.searchQuery = e.target.value.trim().toLowerCase();
    elements.clearSearch.style.display = state.searchQuery ? 'block' : 'none';
    applyScriptFilters();
  });

  elements.clearSearch.addEventListener('click', () => {
    elements.scriptSearch.value = '';
    state.searchQuery = '';
    elements.clearSearch.style.display = 'none';
    applyScriptFilters();
  });

  // Top Actions
  elements.btnRescan.addEventListener('click', () => loadCurrentTabData());
  elements.btnDownloadZip.addEventListener('click', () => exportAllAsZip());
  elements.btnCopyUrls.addEventListener('click', () => copyAllScriptUrls());

  // Raw HTML Actions
  elements.btnCopyRawHtml.addEventListener('click', () => {
    if (state.rawHtml) {
      copyToClipboard(state.rawHtml);
      showToast('Raw server HTML copied to clipboard!');
    }
  });

  elements.btnDownloadRawHtml.addEventListener('click', () => {
    if (state.rawHtml) {
      const filename = getSafeHost() + '_raw_server.html';
      downloadFile(filename, state.rawHtml, 'text/html');
    }
  });

  // Live DOM Actions
  elements.btnCopyDomHtml.addEventListener('click', () => {
    if (state.renderedHtml) {
      copyToClipboard(state.renderedHtml);
      showToast('Rendered DOM copied to clipboard!');
    }
  });

  elements.btnDownloadDomHtml.addEventListener('click', () => {
    if (state.renderedHtml) {
      const filename = getSafeHost() + '_rendered_dom.html';
      downloadFile(filename, state.renderedHtml, 'text/html');
    }
  });

  // Viewer Actions
  elements.btnViewerCopy.addEventListener('click', () => {
    if (state.viewerCode) {
      copyToClipboard(state.viewerCode);
      showToast('Source code copied to clipboard!');
    }
  });

  elements.btnViewerDownload.addEventListener('click', () => {
    if (state.viewerCode && state.selectedScript) {
      let filename = 'script.js';
      if (state.selectedScript.type === 'inline') {
        filename = `inline_script_${state.selectedScript.id || 'code'}.js`;
      } else if (state.selectedScript.url) {
        try {
          const urlObj = new URL(state.selectedScript.url);
          const pathParts = urlObj.pathname.split('/').filter(Boolean);
          filename = pathParts[pathParts.length - 1] || 'script.js';
          if (!filename.endsWith('.js')) filename += '.js';
        } catch (e) {
          filename = 'script.js';
        }
      }
      downloadFile(filename, state.viewerCode, 'application/javascript');
    }
  });

  elements.btnViewerFormat.addEventListener('click', () => {
    if (state.viewerCode) {
      const formatted = simpleBeautifyJS(state.viewerCode);
      state.viewerCode = formatted;
      elements.viewerCode.textContent = formatted;
      showToast('Formatted script successfully!');
    }
  });
}

// Switch Active Tab
function switchTab(panelId) {
  elements.navTabs.forEach(tab => {
    tab.classList.toggle('active', tab.getAttribute('data-tab') === panelId);
  });
  elements.tabPanels.forEach(panel => {
    panel.classList.toggle('active', panel.id === panelId);
  });
}

// Format bytes
function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getSafeHost() {
  try {
    return new URL(state.pageUrl).hostname.replace(/[^a-z0-9.-]/gi, '_') || 'page';
  } catch (e) {
    return 'page';
  }
}

// In-page extraction function (injected via executeScript)
function extractPageDirectly() {
  let doctypeStr = '<!DOCTYPE html>';
  if (document.doctype) {
    doctypeStr = '<!DOCTYPE ' + document.doctype.name +
      (document.doctype.publicId ? ' PUBLIC "' + document.doctype.publicId + '"' : '') +
      (!document.doctype.publicId && document.doctype.systemId ? ' SYSTEM' : '') +
      (document.doctype.systemId ? ' "' + document.doctype.systemId + '"' : '') +
      '>';
  }
  const renderedHtml = `${doctypeStr}\n${document.documentElement ? document.documentElement.outerHTML : ''}`;

  const scriptElements = Array.from(document.querySelectorAll('script'));
  const domScripts = scriptElements.map((el, idx) => {
    const src = el.src || el.getAttribute('src');
    const content = el.textContent || el.innerHTML || '';
    let resolvedUrl = '';
    if (src) {
      try {
        resolvedUrl = new URL(src, document.baseURI || location.href).href;
      } catch (e) {
        resolvedUrl = src;
      }
    }
    return {
      index: idx,
      id: el.id || null,
      type: resolvedUrl ? 'external' : 'inline',
      url: resolvedUrl,
      rawSrc: el.getAttribute('src') || null,
      content: resolvedUrl ? '' : content,
      charCount: resolvedUrl ? 0 : content.length,
      isModule: el.type === 'module',
      isAsync: Boolean(el.async),
      isDefer: Boolean(el.defer),
      noModule: Boolean(el.noModule),
      integrity: el.getAttribute('integrity') || null,
      crossOrigin: el.getAttribute('crossorigin') || null,
      location: el.closest('head') ? 'head' : (el.closest('body') ? 'body' : 'other')
    };
  });

  let perfScripts = [];
  try {
    perfScripts = performance.getEntriesByType('resource')
      .filter(r => r.initiatorType === 'script' || /\.(js|mjs|cjs)(\?.*)?$/i.test(r.name))
      .map(r => ({
        url: r.name,
        duration: Math.round(r.duration || 0),
        transferSize: r.transferSize || 0,
        decodedBodySize: r.decodedBodySize || 0
      }));
  } catch (e) {}

  return {
    success: true,
    pageUrl: window.location.href,
    pageTitle: document.title || window.location.hostname,
    baseUri: document.baseURI,
    renderedHtml: renderedHtml,
    domScripts: domScripts,
    perfScripts: perfScripts,
    timestamp: Date.now()
  };
}

// --- Main Data Fetching ---
async function loadCurrentTabData() {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!activeTab || !activeTab.url) {
    showRestrictedPageMessage('No active browser tab found.');
    return;
  }

  state.tab = activeTab;
  state.pageUrl = activeTab.url;

  // Check if browser internal page
  const restrictedPrefixes = ['chrome://', 'chrome-extension://', 'edge://', 'about:', 'view-source:', 'devtools://'];
  if (restrictedPrefixes.some(p => activeTab.url.startsWith(p))) {
    showRestrictedPageMessage(`Cannot extract from internal browser URL (${activeTab.url}). Please open a standard webpage (e.g. https://google.com) and try again.`);
    return;
  }

  try {
    const urlObj = new URL(activeTab.url);
    elements.targetHost.textContent = urlObj.hostname + (urlObj.pathname.length > 20 ? urlObj.pathname.slice(0, 20) + '...' : urlObj.pathname);
  } catch (e) {
    elements.targetHost.textContent = activeTab.url;
  }

  // 1. Extract DOM Data directly using chrome.scripting.executeScript
  let pageData = null;
  try {
    const executionResults = await chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      func: extractPageDirectly
    });

    if (executionResults && executionResults[0] && executionResults[0].result) {
      pageData = executionResults[0].result;
    }
  } catch (scriptErr) {
    console.warn('executeScript failed, trying message fallback:', scriptErr);
    try {
      pageData = await chrome.tabs.sendMessage(activeTab.id, { action: 'EXTRACT_PAGE_DATA' });
    } catch (msgErr) {
      console.warn('tabs.sendMessage fallback also failed:', msgErr);
    }
  }

  // 2. Fetch Network Scripts from Background Service Worker
  let networkData = { scripts: [] };
  try {
    networkData = await chrome.runtime.sendMessage({
      action: 'GET_NETWORK_SCRIPTS',
      tabId: activeTab.id
    });
  } catch (e) {
    console.warn('Could not fetch network scripts from background:', e);
  }

  // 3. Process & Display DOM & Scripts
  if (pageData && pageData.success) {
    state.renderedHtml = pageData.renderedHtml;
    state.pageTitle = pageData.pageTitle;

    // Rendered DOM View
    elements.domHtmlCode.textContent = state.renderedHtml;
    const domBytes = new TextEncoder().encode(state.renderedHtml).length;
    elements.domSizeTag.textContent = formatBytes(domBytes);
    elements.badgeDomSize.textContent = formatBytes(domBytes);

    const elCount = (state.renderedHtml.match(/<[a-z0-9-]+/gi) || []).length;
    elements.domElementsTag.textContent = `${elCount} elements`;
  }

  // Merge scripts from DOM, Performance timing, and Background Network
  mergeAndProcessScripts(
    (pageData && pageData.domScripts) || [],
    (pageData && pageData.perfScripts) || [],
    (networkData && networkData.scripts) || []
  );

  // 4. Fetch Raw Server HTML via Background Service Worker (only for http/https)
  if (activeTab.url && (activeTab.url.startsWith('http://') || activeTab.url.startsWith('https://'))) {
    fetchRawServerHtml(activeTab.url);
  } else {
    elements.rawHtmlLoading.style.display = 'none';
    elements.badgeRawStatus.textContent = 'Rendered';
    elements.rawStatusTag.textContent = 'Non-HTTP Scheme';
    elements.rawHtmlCode.textContent = state.renderedHtml || 'Raw server HTTP fetch is only applicable for http/https URLs.';
    elements.rawHtmlPre.style.display = 'block';
  }
}

function showRestrictedPageMessage(msg) {
  elements.targetHost.textContent = 'Restricted page';
  elements.scriptsSummaryText.textContent = msg;
  elements.scriptsList.innerHTML = `
    <div class="empty-state" style="padding: 40px 20px;">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color: var(--accent-amber);">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
      <p style="color: var(--text-primary); font-weight: 600; margin-top: 8px;">Cannot inspect internal browser page</p>
      <p style="font-size: 11.5px; margin-top: 4px;">Chrome security prevents extensions from reading internal <code>chrome://</code> pages.<br><br>Please navigate to any regular website (e.g. <strong>https://google.com</strong> or <strong>https://github.com</strong>) and click this extension icon.</p>
    </div>
  `;
}

// Merge & Deduplicate Scripts
function mergeAndProcessScripts(domScripts, perfScripts, networkScripts) {
  const map = new Map();

  // 1. DOM Scripts (Tags & Inline)
  domScripts.forEach((s, idx) => {
    const key = s.type === 'external' ? s.url : `inline_dom_${idx}_${s.charCount}`;
    map.set(key, {
      id: `dom_${idx}`,
      source: 'DOM Element',
      type: s.type,
      category: 'dom_tag',
      url: s.url || '',
      content: s.content || '',
      size: s.charCount || 0,
      isModule: s.isModule,
      isAsync: s.isAsync,
      isDefer: s.isDefer,
      location: s.location
    });
  });

  // 2. Performance Resource Timing Scripts (catches all dynamically fetched JS)
  perfScripts.forEach((s, idx) => {
    const key = s.url;
    if (!map.has(key)) {
      map.set(key, {
        id: `perf_${idx}`,
        source: 'Resource Timing (Fetched)',
        type: 'external',
        category: 'dynamic',
        url: s.url,
        content: '',
        size: s.decodedBodySize || s.transferSize || 0,
        dynamic: true
      });
    } else {
      const existing = map.get(key);
      if (s.decodedBodySize) existing.size = s.decodedBodySize;
    }
  });

  // 3. Network Scripts (from webRequest)
  networkScripts.forEach((s, idx) => {
    const key = s.url;
    if (!map.has(key)) {
      map.set(key, {
        id: `net_${idx}`,
        source: 'Network Request',
        type: 'external',
        category: 'network',
        url: s.url,
        content: '',
        size: 0,
        method: s.method || 'GET'
      });
    }
  });

  state.scripts = Array.from(map.values());
  updateScriptCounts();
  applyScriptFilters();
}

// Update script badge & category counts
function updateScriptCounts() {
  const allCount = state.scripts.length;
  const externalCount = state.scripts.filter(s => s.type === 'external').length;
  const inlineCount = state.scripts.filter(s => s.type === 'inline').length;
  const dynamicCount = state.scripts.filter(s => s.category !== 'dom_tag' || s.dynamic).length;

  elements.badgeScriptsCount.textContent = allCount;
  elements.countAll.textContent = allCount;
  elements.countExternal.textContent = externalCount;
  elements.countInline.textContent = inlineCount;
  elements.countDynamic.textContent = dynamicCount;

  elements.scriptsSummaryText.textContent = `${allCount} total scripts (${externalCount} external, ${inlineCount} inline, ${dynamicCount} dynamic/network)`;
}

// Filter scripts based on active filter chip and search query
function applyScriptFilters() {
  let list = state.scripts;

  if (state.activeFilter === 'external') {
    list = list.filter(s => s.type === 'external');
  } else if (state.activeFilter === 'inline') {
    list = list.filter(s => s.type === 'inline');
  } else if (state.activeFilter === 'dynamic') {
    list = list.filter(s => s.category !== 'dom_tag' || s.dynamic || s.category === 'network');
  }

  if (state.searchQuery) {
    const q = state.searchQuery;
    list = list.filter(s => {
      const urlMatch = s.url && s.url.toLowerCase().includes(q);
      const contentMatch = s.content && s.content.toLowerCase().includes(q);
      const catMatch = s.category && s.category.toLowerCase().includes(q);
      const sourceMatch = s.source && s.source.toLowerCase().includes(q);
      return urlMatch || contentMatch || catMatch || sourceMatch;
    });
  }

  state.filteredScripts = list;
  renderScriptsList(list);
}

// Render Scripts in Table / Cards
function renderScriptsList(scripts) {
  elements.scriptsList.innerHTML = '';

  if (scripts.length === 0) {
    elements.scriptsList.innerHTML = `
      <div class="empty-state" style="padding: 30px;">
        <p>No scripts found matching the filter.</p>
      </div>
    `;
    return;
  }

  scripts.forEach((script, index) => {
    const itemEl = document.createElement('div');
    itemEl.className = 'script-item';

    // Type Badge
    let typeBadgeClass = 'type-ext';
    let typeText = 'EXT';
    if (script.type === 'inline') {
      typeBadgeClass = 'type-inline';
      typeText = 'INLINE';
    } else if (script.workerType) {
      typeBadgeClass = 'type-worker';
      typeText = 'WORKER';
    } else if (script.category !== 'dom_tag' || script.dynamic) {
      typeBadgeClass = 'type-dyn';
      typeText = 'DYN';
    }

    // Name / URL formatting
    let displayName = 'Inline Script';
    let subText = '';
    if (script.type === 'external' && script.url) {
      try {
        const urlObj = new URL(script.url);
        const pathParts = urlObj.pathname.split('/').filter(Boolean);
        displayName = pathParts[pathParts.length - 1] || urlObj.hostname;
        subText = urlObj.origin + urlObj.pathname;
      } catch (e) {
        displayName = script.url;
        subText = script.url;
      }
    } else {
      displayName = `Inline Script #${index + 1} (${script.size} chars)`;
      subText = script.content.replace(/\s+/g, ' ').slice(0, 75) + '...';
    }

    // Attributes list (tags)
    let attrHtml = '';
    if (script.isModule) attrHtml += `<span class="tag-attr">module</span> `;
    if (script.isAsync) attrHtml += `<span class="tag-attr">async</span> `;
    if (script.isDefer) attrHtml += `<span class="tag-attr">defer</span> `;
    if (script.location) attrHtml += `<span class="tag-attr">&lt;${script.location}&gt;</span> `;
    if (script.workerType) attrHtml += `<span class="tag-attr">${script.workerType}</span> `;

    itemEl.innerHTML = `
      <div class="script-main" title="Click to view full source code">
        <span class="type-badge ${typeBadgeClass}">${typeText}</span>
        <div class="script-details">
          <div class="script-name">${escapeHtml(displayName)}</div>
          <div class="script-sub">${attrHtml}<span>${escapeHtml(subText)}</span></div>
        </div>
      </div>
      <div class="script-actions">
        <button class="icon-btn btn-view" title="Inspect Source Code">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
        </button>
        <button class="icon-btn btn-copy" title="Copy URL / Content">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
        </button>
        ${script.type === 'external' ? `
          <a href="${escapeHtml(script.url)}" target="_blank" class="icon-btn" title="Open in New Tab">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
          </a>
        ` : ''}
      </div>
    `;

    // Click to view source
    itemEl.querySelector('.script-main').addEventListener('click', () => openScriptViewer(script));
    itemEl.querySelector('.btn-view').addEventListener('click', () => openScriptViewer(script));

    // Click to copy
    itemEl.querySelector('.btn-copy').addEventListener('click', async () => {
      if (script.type === 'external') {
        copyToClipboard(script.url);
        showToast('Script URL copied to clipboard!');
      } else {
        copyToClipboard(script.content);
        showToast('Inline script code copied to clipboard!');
      }
    });

    elements.scriptsList.appendChild(itemEl);
  });
}

// Fetch Raw Server HTML from Background Service Worker
async function fetchRawServerHtml(url) {
  elements.rawHtmlLoading.style.display = 'flex';
  elements.rawHtmlPre.style.display = 'none';

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'FETCH_RAW_HTML',
      url: url
    });

    elements.rawHtmlLoading.style.display = 'none';

    if (response && response.success) {
      state.rawHtml = response.rawHtml;
      state.rawMeta = response;

      elements.rawStatusTag.textContent = `HTTP ${response.status} ${response.statusText || 'OK'}`;
      elements.rawSizeTag.textContent = formatBytes(response.byteSize);
      elements.rawTimeTag.textContent = `${response.duration} ms`;

      elements.badgeRawStatus.textContent = `HTTP ${response.status}`;
      elements.badgeRawStatus.className = 'tab-badge' + (response.status === 200 ? ' tag-success' : '');

      elements.rawHtmlCode.textContent = response.rawHtml;
      elements.rawHtmlPre.style.display = 'block';
    } else {
      // If direct fetch fails (e.g. auth/cookies), fallback to using Rendered DOM
      elements.badgeRawStatus.textContent = 'Rendered';
      elements.rawStatusTag.textContent = 'Server fetch fallback';
      elements.rawHtmlCode.textContent = state.renderedHtml || `Could not fetch raw server HTML: ${response ? response.error : 'Network error'}`;
      elements.rawHtmlPre.style.display = 'block';
    }
  } catch (err) {
    elements.rawHtmlLoading.style.display = 'none';
    elements.badgeRawStatus.textContent = 'Rendered';
    elements.rawHtmlCode.textContent = state.renderedHtml || `Error: ${err.message}`;
    elements.rawHtmlPre.style.display = 'block';
  }
}

// Open Script in Source Viewer Tab
async function openScriptViewer(script) {
  state.selectedScript = script;
  switchTab('tab-viewer');

  elements.viewerEmpty.style.display = 'none';
  elements.viewerPre.style.display = 'none';
  elements.viewerLoading.style.display = 'flex';

  let title = '';
  let typeTag = 'SCRIPT';

  if (script.type === 'inline') {
    title = `Inline Script (${script.size || script.content.length} characters)`;
    typeTag = 'INLINE';
    state.viewerCode = script.content;
    displayViewerCode(title, typeTag, script.content);
  } else {
    title = script.url;
    typeTag = script.workerType ? 'WORKER' : (script.category !== 'dom_tag' ? 'DYNAMIC' : 'EXTERNAL');
    
    // Fetch script content
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'FETCH_SCRIPT_SOURCE',
        url: script.url
      });

      if (response && response.success) {
        state.viewerCode = response.code;
        displayViewerCode(title, typeTag, response.code);
      } else {
        displayViewerCode(title, typeTag, `/* Could not load script source directly: ${response ? response.error : 'CORS/Network error'} */\n// URL: ${script.url}`);
      }
    } catch (err) {
      displayViewerCode(title, typeTag, `/* Error: ${err.message} */\n// URL: ${script.url}`);
    }
  }
}

function displayViewerCode(title, typeTag, code) {
  elements.viewerLoading.style.display = 'none';
  elements.viewerTitle.textContent = title;
  elements.viewerTitle.title = title;
  elements.viewerTypeTag.textContent = typeTag;
  elements.viewerCode.textContent = code;
  elements.viewerPre.style.display = 'block';
}

// Copy All Script URLs
function copyAllScriptUrls() {
  const urls = state.scripts
    .filter(s => s.type === 'external' && s.url)
    .map(s => s.url);

  if (urls.length === 0) {
    showToast('No external script URLs to copy.');
    return;
  }

  copyToClipboard(urls.join('\n'));
  showToast(`Copied ${urls.length} script URLs to clipboard!`);
}

// Export Everything into a Clean ZIP Archive
async function exportAllAsZip() {
  showToast('Preparing ZIP archive with all HTML & scripts...');
  const zip = new window.SimpleZip();

  const hostname = getSafeHost();

  // 1. Add Raw Server HTML
  if (state.rawHtml) {
    zip.file('raw_server.html', state.rawHtml);
  }

  // 2. Add Rendered Live DOM
  if (state.renderedHtml) {
    zip.file('rendered_dom.html', state.renderedHtml);
  }

  // 3. Fetch and Add all Scripts
  let inlineIndex = 1;
  let extIndex = 1;
  const scriptIndexMeta = [];

  for (const script of state.scripts) {
    if (script.type === 'inline' && script.content) {
      const fileName = `scripts/inline/inline_script_${String(inlineIndex).padStart(2, '0')}.js`;
      zip.file(fileName, script.content);
      scriptIndexMeta.push({
        type: 'inline',
        file: fileName,
        length: script.content.length,
        category: script.category
      });
      inlineIndex++;
    } else if (script.type === 'external' && script.url) {
      try {
        const urlObj = new URL(script.url);
        const pathParts = urlObj.pathname.split('/').filter(Boolean);
        let baseName = pathParts[pathParts.length - 1] || `script_${extIndex}.js`;
        if (!baseName.endsWith('.js')) baseName += '.js';
        
        baseName = baseName.replace(/[^a-zA-Z0-9._-]/g, '_');
        const fileName = `scripts/external/${urlObj.hostname}/${baseName}`;

        // Fetch source
        const res = await chrome.runtime.sendMessage({
          action: 'FETCH_SCRIPT_SOURCE',
          url: script.url
        });

        const codeContent = (res && res.success) ? res.code : `// Could not fetch source: ${script.url}`;
        zip.file(fileName, codeContent);
        
        scriptIndexMeta.push({
          type: 'external',
          url: script.url,
          file: fileName,
          status: (res && res.success) ? 'downloaded' : 'failed'
        });
      } catch (e) {}
      extIndex++;
    }
  }

  // 4. Add Metadata JSON Summary
  const metadata = {
    extractedAt: new Date().toISOString(),
    pageUrl: state.pageUrl,
    pageTitle: state.pageTitle,
    totalScripts: state.scripts.length,
    rawServerHtmlLength: state.rawHtml ? state.rawHtml.length : 0,
    renderedDomLength: state.renderedHtml ? state.renderedHtml.length : 0,
    scripts: scriptIndexMeta
  };

  zip.file('metadata.json', JSON.stringify(metadata, null, 2));

  // Generate & Download ZIP
  try {
    const zipBlob = zip.generateBlob();
    const url = URL.createObjectURL(zipBlob);
    const downloadFilename = `${hostname}_source_bundle.zip`;

    chrome.downloads.download({
      url: url,
      filename: downloadFilename,
      saveAs: true
    }, () => {
      showToast(`Exported ${downloadFilename} successfully!`);
    });
  } catch (err) {
    showToast(`Error generating ZIP: ${err.message}`);
  }
}

// Download arbitrary single file
function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  chrome.downloads.download({
    url: url,
    filename: filename,
    saveAs: true
  });
}

// Helper: Copy text to clipboard
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).catch(err => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  });
}

// Toast notification
let toastTimer = null;
function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    elements.toast.style.display = 'none';
  }, 2400);
}

// HTML escape helper
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Simple JS beautifier for minified scripts
function simpleBeautifyJS(code) {
  let indent = 0;
  const tab = '  ';
  let formatted = '';
  let inString = false;
  let stringChar = '';

  for (let i = 0; i < code.length; i++) {
    const char = code[i];
    const prev = code[i - 1];

    if ((char === '"' || char === "'" || char === '`') && prev !== '\\') {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (stringChar === char) {
        inString = false;
      }
    }

    if (inString) {
      formatted += char;
      continue;
    }

    if (char === '{' || char === '[') {
      indent++;
      formatted += char + '\n' + tab.repeat(indent);
    } else if (char === '}' || char === ']') {
      indent = Math.max(0, indent - 1);
      formatted += '\n' + tab.repeat(indent) + char;
    } else if (char === ';') {
      formatted += ';\n' + tab.repeat(indent);
    } else {
      formatted += char;
    }
  }

  return formatted.replace(/\n\s*\n/g, '\n');
}
