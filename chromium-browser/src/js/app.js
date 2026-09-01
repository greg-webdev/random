// Chromium Desktop Browser Core Logic
(() => {
  let tabs = [];
  let activeTabId = null;
  let tabCounter = 0;
  let bookmarks = [];
  let settings = {
    searchEngine: 'google',
    homePage: 'chrome://newtab',
    theme: 'dark',
    defaultZoom: 1.0
  };

  // DOM Elements
  const tabsList = document.getElementById('tabs-list');
  const newTabBtn = document.getElementById('new-tab-btn');
  const viewsContainer = document.getElementById('views-container');

  const btnBack = document.getElementById('btn-back');
  const btnForward = document.getElementById('btn-forward');
  const btnReload = document.getElementById('btn-reload');
  const btnHome = document.getElementById('btn-home');
  const btnStar = document.getElementById('btn-star');
  const btnDevtools = document.getElementById('btn-devtools');
  const btnMenu = document.getElementById('btn-menu');
  const omnibox = document.getElementById('omnibox-input');
  const securityBadge = document.getElementById('security-badge');
  const loadingBar = document.getElementById('loading-bar');
  const bookmarksBar = document.getElementById('bookmarks-bar');
  const dropdownMenu = document.getElementById('dropdown-menu');

  const winMinBtn = document.getElementById('win-min-btn');
  const winMaxBtn = document.getElementById('win-max-btn');
  const winCloseBtn = document.getElementById('win-close-btn');

  const findBar = document.getElementById('find-bar');
  const findInput = document.getElementById('find-input');
  const findCount = document.getElementById('find-count');
  const findPrev = document.getElementById('find-prev');
  const findNext = document.getElementById('find-next');
  const findClose = document.getElementById('find-close');

  // Inject Icons
  function initIcons() {
    newTabBtn.innerHTML = ICONS.plus;
    btnBack.innerHTML = ICONS.back;
    btnForward.innerHTML = ICONS.forward;
    btnReload.innerHTML = ICONS.reload;
    btnHome.innerHTML = ICONS.home;
    btnStar.innerHTML = ICONS.star;
    btnDevtools.innerHTML = ICONS.devtools;
    btnMenu.innerHTML = ICONS.menu;
    winMinBtn.innerHTML = ICONS.winMin;
    winMaxBtn.innerHTML = ICONS.winMax;
    winCloseBtn.innerHTML = ICONS.winClose;
  }

  // Setup Window Controls
  function setupWindowControls() {
    winMinBtn.addEventListener('click', () => window.browserAPI?.minimizeWindow());
    winMaxBtn.addEventListener('click', () => window.browserAPI?.maximizeWindow());
    winCloseBtn.addEventListener('click', () => window.browserAPI?.closeWindow());
  }

  // Load Settings and Bookmarks
  async function loadInitialData() {
    if (window.browserAPI) {
      try {
        bookmarks = await window.browserAPI.getBookmarks();
        settings = await window.browserAPI.getSettings();
      } catch (e) {
        console.error('Failed to load initial data:', e);
      }
    }
    renderBookmarksBar();
  }

  // Render Bookmarks Bar
  function renderBookmarksBar() {
    bookmarksBar.innerHTML = '';
    bookmarks.forEach(bm => {
      const item = document.createElement('div');
      item.className = 'bookmark-item';
      item.innerHTML = `<span>⭐</span><span>${bm.title}</span>`;
      item.title = `${bm.title}\n${bm.url}`;
      item.addEventListener('click', () => {
        navigateTo(bm.url);
      });
      bookmarksBar.appendChild(item);
    });
  }

  // Tab Helpers
  function getActiveTab() {
    return tabs.find(t => t.id === activeTabId);
  }

  // Create a new tab
  async function createTab(initialUrl = 'chrome://newtab', activate = true) {
    const id = 'tab-' + (++tabCounter);
    
    // Tab Element
    const tabEl = document.createElement('div');
    tabEl.className = 'tab';
    tabEl.id = id;
    tabEl.innerHTML = `
      <div class="tab-favicon">
        <span class="default-icon">${ICONS.globe}</span>
      </div>
      <span class="tab-title">New Tab</span>
      <div class="tab-close-btn" title="Close Tab (Ctrl+W)">${ICONS.close}</div>
    `;

    // Webview Element
    const webview = document.createElement('webview');
    webview.setAttribute('allowpopups', 'on');
    webview.setAttribute('webpreferences', 'contextIsolation=no, nodeIntegration=no');
    
    viewsContainer.appendChild(webview);

    const tabObj = {
      id,
      tabEl,
      webview,
      url: initialUrl,
      displayUrl: initialUrl,
      title: 'New Tab',
      favicon: '',
      isLoading: false
    };

    tabs.push(tabObj);
    tabsList.appendChild(tabEl);

    // Tab event listeners
    tabEl.addEventListener('click', (e) => {
      if (e.target.closest('.tab-close-btn')) {
        closeTab(id);
      } else {
        switchTab(id);
      }
    });

    // Middle click to close tab
    tabEl.addEventListener('auxclick', (e) => {
      if (e.button === 1) {
        closeTab(id);
      }
    });

    // Webview Event Listeners
    setupWebviewEvents(tabObj);

    if (activate) {
      switchTab(id);
    }

    // Navigate to initial URL
    await navigateTabTo(tabObj, initialUrl);

    return tabObj;
  }

  // Setup Webview Lifecycle Events
  function setupWebviewEvents(tab) {
    const { webview, tabEl } = tab;
    const faviconEl = tabEl.querySelector('.tab-favicon');
    const titleEl = tabEl.querySelector('.tab-title');

    // Loading start
    webview.addEventListener('did-start-loading', () => {
      tab.isLoading = true;
      faviconEl.innerHTML = `<div class="spinner"></div>`;
      if (tab.id === activeTabId) {
        btnReload.innerHTML = ICONS.stop;
        btnReload.title = 'Stop loading this page';
        loadingBar.classList.add('active');
        loadingBar.style.width = '35%';
      }
    });

    // Loading stop
    webview.addEventListener('did-stop-loading', () => {
      tab.isLoading = false;
      updateTabFavicon(tab);
      if (tab.id === activeTabId) {
        btnReload.innerHTML = ICONS.reload;
        btnReload.title = 'Reload this page (Ctrl+R)';
        loadingBar.style.width = '100%';
        setTimeout(() => {
          loadingBar.classList.remove('active');
          loadingBar.style.width = '0%';
        }, 250);
        updateNavButtons();
      }
    });

    // Page title update
    webview.addEventListener('page-title-updated', (e) => {
      tab.title = e.title;
      titleEl.innerText = e.title;
      tabEl.title = e.title;
      if (tab.id === activeTabId) {
        document.title = `${e.title} - Chromium Browser`;
      }
    });

    // Favicon update
    webview.addEventListener('page-favicon-updated', (e) => {
      if (e.favicons && e.favicons.length > 0) {
        tab.favicon = e.favicons[0];
        updateTabFavicon(tab);
      }
    });

    // Navigation state change
    const onNavigated = (url) => {
      tab.url = url;
      if (!tab.displayUrl || (!tab.displayUrl.startsWith('chrome://') && !url.startsWith('file://'))) {
        tab.displayUrl = url;
      }
      if (tab.id === activeTabId) {
        updateOmniboxUI(tab.displayUrl || url);
        updateNavButtons();
        updateStarState();
      }
      // Record history
      const histUrl = tab.displayUrl || url;
      if (histUrl && !histUrl.startsWith('chrome://newtab')) {
        window.browserAPI?.addHistory({
          title: tab.title || histUrl,
          url: histUrl
        });
      }
    };

    webview.addEventListener('did-navigate', (e) => onNavigated(e.url));
    webview.addEventListener('did-navigate-in-page', (e) => onNavigated(e.url));

    // Handle in-page chrome:// links via will-navigate
    webview.addEventListener('will-navigate', (e) => {
      if (e.url.startsWith('chrome://')) {
        e.preventDefault();
        navigateTabTo(tab, e.url);
      }
    });

    // Injected click handler for chrome:// links
    webview.addEventListener('dom-ready', () => {
      webview.executeJavaScript(`
        document.querySelectorAll('a[href^="chrome://"]').forEach(a => {
          a.addEventListener('click', (ev) => {
            ev.preventDefault();
            window.location.href = a.getAttribute('href');
          });
        });
      `).catch(() => {});
    });

    // Handle target="_blank" or window.open
    webview.addEventListener('new-window', (e) => {
      createTab(e.url, true);
    });

    // Handle close request from page
    webview.addEventListener('close', () => {
      closeTab(tab.id);
    });

    // In-page search result listener
    webview.addEventListener('found-in-page', (e) => {
      findCount.innerText = `${e.result.activeMatchOrdinal}/${e.result.matches}`;
    });
  }

  // Update Favicon Helper
  function updateTabFavicon(tab) {
    const faviconEl = tab.tabEl.querySelector('.tab-favicon');
    const checkUrl = tab.displayUrl || tab.url || '';
    if (checkUrl.startsWith('chrome://')) {
      faviconEl.innerHTML = ICONS.system;
    } else if (tab.favicon) {
      faviconEl.innerHTML = `<img src="${tab.favicon}" onerror="this.parentElement.innerHTML='${ICONS.globe.replace(/"/g, '&quot;')}'"/>`;
    } else {
      faviconEl.innerHTML = ICONS.globe;
    }
  }

  // Switch Active Tab
  function switchTab(tabId) {
    const target = tabs.find(t => t.id === tabId);
    if (!target) return;

    activeTabId = tabId;

    tabs.forEach(t => {
      if (t.id === tabId) {
        t.tabEl.classList.add('active');
        t.webview.classList.add('active');
      } else {
        t.tabEl.classList.remove('active');
        t.webview.classList.remove('active');
      }
    });

    // Update Omnibox, buttons, title
    updateOmniboxUI(target.displayUrl || target.url);
    updateNavButtons();
    updateStarState();
    document.title = target.title ? `${target.title} - Chromium Browser` : 'Chromium Browser';

    if (target.isLoading) {
      btnReload.innerHTML = ICONS.stop;
      loadingBar.classList.add('active');
    } else {
      btnReload.innerHTML = ICONS.reload;
      loadingBar.classList.remove('active');
    }
  }

  // Close Tab
  function closeTab(tabId) {
    const index = tabs.findIndex(t => t.id === tabId);
    if (index === -1) return;

    const tab = tabs[index];
    tab.tabEl.remove();
    tab.webview.remove();
    tabs.splice(index, 1);

    if (tabs.length === 0) {
      createTab('chrome://newtab');
    } else if (activeTabId === tabId) {
      const nextTab = tabs[Math.max(0, index - 1)];
      switchTab(nextTab.id);
    }
  }

  // Update Omnibox and Security Badge
  function updateOmniboxUI(url) {
    if (!url) return;
    if (url === 'chrome://newtab' || url === 'about:blank') {
      omnibox.value = '';
    } else {
      omnibox.value = url;
    }

    if (url.startsWith('https://')) {
      securityBadge.innerHTML = ICONS.lock;
      securityBadge.className = 'security-badge secure';
      securityBadge.title = 'Secure Connection (HTTPS)';
    } else if (url.startsWith('chrome://')) {
      securityBadge.innerHTML = ICONS.system;
      securityBadge.className = 'security-badge system';
      securityBadge.title = 'Internal Chromium System Page';
    } else {
      securityBadge.innerHTML = ICONS.unlock;
      securityBadge.className = 'security-badge';
      securityBadge.title = 'Not Secure';
    }
  }

  // Update Navigation Back/Forward Buttons
  function updateNavButtons() {
    const activeTab = getActiveTab();
    if (!activeTab || !activeTab.webview) return;
    try {
      btnBack.disabled = !activeTab.webview.canGoBack();
      btnForward.disabled = !activeTab.webview.canGoForward();
    } catch (e) {
      btnBack.disabled = true;
      btnForward.disabled = true;
    }
  }

  // Update Bookmark Star Icon
  function updateStarState() {
    const activeTab = getActiveTab();
    if (!activeTab) return;
    const checkUrl = activeTab.displayUrl || activeTab.url;
    const isBookmarked = bookmarks.some(b => b.url === checkUrl);
    btnStar.innerHTML = isBookmarked ? ICONS.starFilled : ICONS.star;
    btnStar.title = isBookmarked ? 'Remove Bookmark (Ctrl+D)' : 'Bookmark this Tab (Ctrl+D)';
  }

  // Smart URL parser and navigation
  function parseAndFormatUrl(input) {
    const trimmed = input.trim();
    if (!trimmed) return 'chrome://newtab';

    // Protocols
    if (
      trimmed.startsWith('http://') ||
      trimmed.startsWith('https://') ||
      trimmed.startsWith('chrome://') ||
      trimmed.startsWith('file:///') ||
      trimmed.startsWith('data:') ||
      trimmed.startsWith('view-source:')
    ) {
      return trimmed;
    }

    // Localhost or IP address with port
    if (/^localhost(:\d+)?(\/.*)?$/i.test(trimmed) || /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?(\/.*)?$/.test(trimmed)) {
      return 'http://' + trimmed;
    }

    // Domain name (e.g. example.com, test.org/path)
    if (/^[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+(\/.*)?$/.test(trimmed) && !trimmed.includes(' ')) {
      return 'https://' + trimmed;
    }

    // Search query fallback based on search engine preference
    const query = encodeURIComponent(trimmed);
    const searchEngines = {
      google: `https://www.google.com/search?q=${query}`,
      duckduckgo: `https://duckduckgo.com/?q=${query}`,
      bing: `https://www.bing.com/search?q=${query}`,
      brave: `https://search.brave.com/search?q=${query}`
    };

    return searchEngines[settings.searchEngine] || searchEngines.google;
  }

  // Navigate specific tab to URL
  async function navigateTabTo(tab, rawUrl) {
    const target = parseAndFormatUrl(rawUrl);
    tab.displayUrl = target;
    
    if (target.startsWith('chrome://')) {
      if (window.browserAPI) {
        const fileUrl = await window.browserAPI.resolveChromeUrl(target);
        tab.webview.loadURL(fileUrl);
      } else {
        tab.webview.loadURL(target);
      }
    } else {
      tab.webview.loadURL(target);
    }

    if (tab.id === activeTabId) {
      updateOmniboxUI(target);
      updateStarState();
    }
  }

  // Navigate active tab
  async function navigateTo(url) {
    const activeTab = getActiveTab();
    if (!activeTab) return;
    await navigateTabTo(activeTab, url);
  }

  // Star Toggle
  async function toggleBookmark() {
    const activeTab = getActiveTab();
    if (!activeTab) return;
    const url = activeTab.displayUrl || activeTab.url;
    if (!url || url.startsWith('chrome://newtab')) return;

    const existingIndex = bookmarks.findIndex(b => b.url === url);
    if (existingIndex > -1) {
      bookmarks.splice(existingIndex, 1);
    } else {
      bookmarks.push({
        id: Date.now().toString(),
        title: activeTab.title || url,
        url: url,
        favicon: activeTab.favicon
      });
    }

    if (window.browserAPI) {
      await window.browserAPI.saveBookmarks(bookmarks);
    }
    updateStarState();
    renderBookmarksBar();
  }

  // Setup Event Listeners for UI
  function setupEventListeners() {
    // New tab button
    newTabBtn.addEventListener('click', () => createTab('chrome://newtab'));

    // Omnibox Navigation
    omnibox.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        navigateTo(omnibox.value);
        omnibox.blur();
      }
    });

    omnibox.addEventListener('focus', () => {
      omnibox.select();
    });

    // Navigation buttons
    btnBack.addEventListener('click', () => {
      const activeTab = getActiveTab();
      if (activeTab && activeTab.webview.canGoBack()) {
        activeTab.webview.goBack();
      }
    });

    btnForward.addEventListener('click', () => {
      const activeTab = getActiveTab();
      if (activeTab && activeTab.webview.canGoForward()) {
        activeTab.webview.goForward();
      }
    });

    btnReload.addEventListener('click', () => {
      const activeTab = getActiveTab();
      if (!activeTab) return;
      if (activeTab.isLoading) {
        activeTab.webview.stop();
      } else {
        activeTab.webview.reload();
      }
    });

    btnHome.addEventListener('click', () => {
      navigateTo(settings.homePage || 'chrome://newtab');
    });

    btnStar.addEventListener('click', toggleBookmark);

    // DevTools toggle
    btnDevtools.addEventListener('click', () => {
      const activeTab = getActiveTab();
      if (!activeTab) return;
      if (activeTab.webview.isDevToolsOpened()) {
        activeTab.webview.closeDevTools();
      } else {
        activeTab.webview.openDevTools();
      }
    });

    // Dropdown Menu Toggle
    btnMenu.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdownMenu.classList.toggle('visible');
    });

    document.addEventListener('click', (e) => {
      if (!dropdownMenu.contains(e.target) && e.target !== btnMenu) {
        dropdownMenu.classList.remove('visible');
      }
    });

    // Menu Item Actions
    document.getElementById('menu-new-tab').addEventListener('click', () => {
      createTab('chrome://newtab');
      dropdownMenu.classList.remove('visible');
    });

    document.getElementById('menu-devtools').addEventListener('click', () => {
      const activeTab = getActiveTab();
      if (activeTab) activeTab.webview.openDevTools();
      dropdownMenu.classList.remove('visible');
    });

    document.getElementById('menu-history').addEventListener('click', () => {
      createTab('chrome://history');
      dropdownMenu.classList.remove('visible');
    });

    document.getElementById('menu-bookmarks').addEventListener('click', () => {
      createTab('chrome://bookmarks');
      dropdownMenu.classList.remove('visible');
    });

    document.getElementById('menu-downloads').addEventListener('click', () => {
      createTab('chrome://downloads');
      dropdownMenu.classList.remove('visible');
    });

    document.getElementById('menu-chrome-urls').addEventListener('click', () => {
      createTab('chrome://about');
      dropdownMenu.classList.remove('visible');
    });

    document.getElementById('menu-dino').addEventListener('click', () => {
      createTab('chrome://dino');
      dropdownMenu.classList.remove('visible');
    });

    document.getElementById('menu-settings').addEventListener('click', () => {
      createTab('chrome://settings');
      dropdownMenu.classList.remove('visible');
    });

    document.getElementById('menu-about').addEventListener('click', () => {
      createTab('chrome://version');
      dropdownMenu.classList.remove('visible');
    });

    document.getElementById('menu-exit').addEventListener('click', () => {
      window.browserAPI?.closeWindow();
    });

    // Find in Page
    findInput.addEventListener('input', () => {
      const activeTab = getActiveTab();
      const val = findInput.value;
      if (activeTab && val) {
        activeTab.webview.findInPage(val);
      } else if (activeTab) {
        activeTab.webview.stopFindInPage('clearSelection');
        findCount.innerText = '0/0';
      }
    });

    findNext.addEventListener('click', () => {
      const activeTab = getActiveTab();
      if (activeTab && findInput.value) {
        activeTab.webview.findInPage(findInput.value, { findNext: true, forward: true });
      }
    });

    findPrev.addEventListener('click', () => {
      const activeTab = getActiveTab();
      if (activeTab && findInput.value) {
        activeTab.webview.findInPage(findInput.value, { findNext: true, forward: false });
      }
    });

    findClose.addEventListener('click', () => {
      const activeTab = getActiveTab();
      if (activeTab) activeTab.webview.stopFindInPage('clearSelection');
      findBar.classList.remove('visible');
    });

    // Global Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        createTab('chrome://newtab');
      } else if (e.ctrlKey && e.key.toLowerCase() === 'w') {
        e.preventDefault();
        if (activeTabId) closeTab(activeTabId);
      } else if ((e.ctrlKey && e.key.toLowerCase() === 'l') || (e.altKey && e.key.toLowerCase() === 'd')) {
        e.preventDefault();
        omnibox.focus();
        omnibox.select();
      } else if ((e.ctrlKey && e.key.toLowerCase() === 'r') || e.key === 'F5') {
        e.preventDefault();
        const activeTab = getActiveTab();
        if (activeTab) activeTab.webview.reload();
      } else if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'i')) {
        e.preventDefault();
        const activeTab = getActiveTab();
        if (activeTab) {
          if (activeTab.webview.isDevToolsOpened()) activeTab.webview.closeDevTools();
          else activeTab.webview.openDevTools();
        }
      } else if (e.ctrlKey && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        createTab('chrome://history');
      } else if (e.ctrlKey && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        createTab('chrome://downloads');
      } else if (e.ctrlKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        toggleBookmark();
      } else if (e.ctrlKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        findBar.classList.toggle('visible');
        if (findBar.classList.contains('visible')) {
          findInput.focus();
          findInput.select();
        }
      } else if (e.ctrlKey && e.key === 'Tab') {
        e.preventDefault();
        if (tabs.length > 1) {
          const currentIndex = tabs.findIndex(t => t.id === activeTabId);
          const nextIndex = e.shiftKey ? (currentIndex - 1 + tabs.length) % tabs.length : (currentIndex + 1) % tabs.length;
          switchTab(tabs[nextIndex].id);
        }
      }
    });
  }

  // Initialize Browser Application
  async function init() {
    initIcons();
    setupWindowControls();
    setupEventListeners();
    await loadInitialData();

    // Open initial tab
    await createTab('chrome://newtab');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
