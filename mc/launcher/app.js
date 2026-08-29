// State
const state = {
  activeTab: 'dashboard',
  mods: [],
  roaming: null,
  gameStatus: { isRunning: false, pid: null },
  launchStatus: { state: 'idle', message: '' },
  ws: null
};

// DOM Elements container (populated inside init after DOM load)
let elements = {};

function queryDOMElements() {
  elements = {
    navButtons: document.querySelectorAll('.nav-item'),
    tabViews: document.querySelectorAll('.tab-view'),
    
    // Dashboard
    inputUsername: document.getElementById('input-username'),
    inputRam: document.getElementById('input-ram'),
    ramValDisplay: document.getElementById('ram-val-display'),
    btnLaunch: document.getElementById('btn-launch'),
    btnKill: document.getElementById('btn-kill'),
    launchStatusBox: document.getElementById('launch-status-box'),
    launchStatusText: document.getElementById('launch-status-text'),
    launchSpinner: document.getElementById('launch-spinner'),
    instanceStatusLabel: document.getElementById('instance-status-label'),
    infoModCount: document.getElementById('info-mod-count'),
    infoJavaPath: document.getElementById('info-java-path'),
    btnOpenMods: document.getElementById('btn-open-mods'),
    btnOpenMods2: document.getElementById('btn-open-mods-2'),
    btnOpenInstance: document.getElementById('btn-open-instance'),
    modCountBadge: document.getElementById('mod-count-badge'),

    // Mods
    dropzone: document.getElementById('dropzone'),
    modFileInput: document.getElementById('mod-file-input'),
    btnBrowseMods: document.getElementById('btn-browse-mods'),
    modsGrid: document.getElementById('mods-grid'),

    // Roaming
    btnSyncOptions: document.getElementById('btn-sync-options'),
    savesList: document.getElementById('saves-list'),
    rpList: document.getElementById('rp-list'),
    spList: document.getElementById('sp-list'),

    // Console
    consoleTerminal: document.getElementById('console-terminal'),
    btnClearConsole: document.getElementById('btn-clear-console'),

    // Settings
    settingJavaPath: document.getElementById('setting-java-path'),
    settingJvmArgs: document.getElementById('setting-jvm-args'),

    // Status Indicator
    connectionDot: document.getElementById('connection-dot'),
    connectionText: document.getElementById('connection-text')
  };
}

// Single launch guard
let isLaunchInFlight = false;

// Initialize Application
function init() {
  queryDOMElements();
  setupNavigation();
  setupEventListeners();
  connectWebSocket();
  fetchInitialData();
}

// Navigation Tabs
function setupNavigation() {
  elements.navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.getAttribute('data-tab');
      switchTab(tabName);
    });
  });
}

function switchTab(tabName) {
  state.activeTab = tabName;
  elements.navButtons.forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
  });
  elements.tabViews.forEach(view => {
    view.classList.toggle('active', view.id === `tab-${tabName}`);
  });

  // Lazily load the server control panel iframe when the server tab is clicked
  if (tabName === 'server') {
    const iframe = document.getElementById('server-iframe');
    if (iframe && (iframe.src === 'about:blank' || iframe.src === '')) {
      iframe.src = 'http://localhost:3000';
    }
  }
}

// Event Listeners
function setupEventListeners() {
  if (elements.inputRam) {
    elements.inputRam.addEventListener('input', (e) => {
      elements.ramValDisplay.textContent = `${e.target.value} GB`;
    });
  }

  if (elements.btnLaunch) {
    elements.btnLaunch.addEventListener('click', launchMinecraft);
  }
  if (elements.btnKill) {
    elements.btnKill.addEventListener('click', killMinecraft);
  }

  if (elements.btnOpenMods) elements.btnOpenMods.addEventListener('click', () => postAPI('/api/mods/open-folder'));
  if (elements.btnOpenMods2) elements.btnOpenMods2.addEventListener('click', () => postAPI('/api/mods/open-folder'));
  if (elements.btnOpenInstance) elements.btnOpenInstance.addEventListener('click', () => postAPI('/api/instance/open-folder'));

  const dropzone = elements.dropzone;
  if (dropzone) {
    ['dragenter', 'dragover'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      }, false);
    });
    ['dragleave', 'drop'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
      }, false);
    });

    dropzone.addEventListener('drop', (e) => {
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        uploadModFiles(files);
      }
    });
  }

  if (elements.btnBrowseMods) {
    elements.btnBrowseMods.addEventListener('click', () => elements.modFileInput.click());
  }
  if (elements.modFileInput) {
    elements.modFileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        uploadModFiles(e.target.files);
      }
    });
  }

  if (elements.btnSyncOptions) {
    elements.btnSyncOptions.addEventListener('click', () => syncItem('options'));
  }

  if (elements.btnClearConsole) {
    elements.btnClearConsole.addEventListener('click', () => {
      elements.consoleTerminal.innerHTML = '<div class="log-line sys">[System] Console cleared.</div>';
    });
  }
}

// Guaranteed Smooth Launch Animation
function triggerLaunchAnimation() {
  return new Promise((resolve) => {
    const overlay = document.getElementById('launch-overlay');
    if (!overlay) return resolve();

    // 1. Activate overlay at scale 0
    overlay.className = 'launch-overlay active';
    void overlay.offsetWidth; // Force DOM paint computation

    setTimeout(() => {
      // 2. Scale white background circle to 100% full screen
      overlay.classList.add('zoomed-in');

      setTimeout(() => {
        // 3. Reveal bold LAUNCHING text
        overlay.classList.add('show-text');

        setTimeout(() => {
          // 4. Zoom 90x into the dot of the 'i'
          overlay.classList.add('zoom-dot');

          setTimeout(() => {
            // 5. Fade out overlay smoothly to prevent abrupt white flash
            overlay.classList.add('fade-out');

            setTimeout(() => {
              // 6. Reset overlay and resolve cleanly after fade out
              overlay.className = 'launch-overlay';
              resolve();
            }, 500);
          }, 800);
        }, 600); // 0.6s pause on text
      }, 550);
    }, 60);
  });
}

// Launch Game
async function launchMinecraft() {
  if (isLaunchInFlight || state.gameStatus.isRunning) {
    return;
  }

  isLaunchInFlight = true;
  if (elements.btnLaunch) elements.btnLaunch.disabled = true;

  const username = elements.inputUsername ? elements.inputUsername.value.trim() : 'Player';
  const ramGbs = elements.inputRam ? parseInt(elements.inputRam.value, 10) : 4;
  const javaPath = elements.settingJavaPath ? elements.settingJavaPath.value.trim() : null;
  const jvmArgs = elements.settingJvmArgs ? elements.settingJvmArgs.value.trim() : '';

  updateLaunchStatus({ state: 'launching', message: 'Starting launch sequence...' });

  // Play full zoom animation
  await triggerLaunchAnimation();

  try {
    const res = await postAPI('/api/launch', {
      username: username || 'Player',
      maxRam: ramGbs * 1024,
      minRam: 1024,
      javaPath: javaPath || null,
      jvmArgs
    });

    if (!res.success) {
      updateLaunchStatus({ state: 'idle', message: `Launch failed: ${res.error}` });
      isLaunchInFlight = false;
      if (elements.btnLaunch) elements.btnLaunch.disabled = false;
    } else {
      setTimeout(() => {
        switchTab('console');
      }, 1000);
    }
  } catch (err) {
    isLaunchInFlight = false;
    if (elements.btnLaunch) elements.btnLaunch.disabled = false;
  }
}

async function killMinecraft() {
  await postAPI('/api/kill');
}

// WebSocket Connection
function connectWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}`;
  state.ws = new WebSocket(wsUrl);

  state.ws.onopen = () => {
    if (elements.connectionDot) {
      elements.connectionDot.style.backgroundColor = '#ffffff';
      elements.connectionDot.style.boxShadow = '0 0 8px #ffffff';
    }
    if (elements.connectionText) elements.connectionText.textContent = 'Connected';
  };

  state.ws.onclose = () => {
    if (elements.connectionDot) {
      elements.connectionDot.style.backgroundColor = '#ff4444';
      elements.connectionDot.style.boxShadow = '0 0 8px #ff4444';
    }
    if (elements.connectionText) elements.connectionText.textContent = 'Disconnected (Reconnecting...)';
    setTimeout(connectWebSocket, 3000);
  };

  state.ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === 'log') {
      appendConsoleLog(msg.data);
    } else if (msg.type === 'launchStatus') {
      updateLaunchStatus(msg.data);
    } else if (msg.type === 'status') {
      updateGameStatus(msg.data);
    }
  };
}

// Initial Data Loading
async function fetchInitialData() {
  await fetchStatus();
  await fetchMods();
  await fetchRoaming();
}

async function fetchStatus() {
  const res = await fetch('/api/status');
  const data = await res.json();
  if (data.success) {
    if (elements.infoJavaPath) elements.infoJavaPath.textContent = data.javaPath || 'javaw';
    updateGameStatus(data.game);
  }
}

async function fetchMods() {
  const res = await fetch('/api/mods');
  const data = await res.json();
  if (data.success) {
    state.mods = data.mods;
    renderMods();
  }
}

async function fetchRoaming() {
  const res = await fetch('/api/roaming');
  const data = await res.json();
  if (data.success && data.info.exists) {
    state.roaming = data.info;
    renderRoaming();
  }
}

// Render Mods
function renderMods() {
  const count = state.mods.filter(m => m.enabled).length;
  if (elements.modCountBadge) elements.modCountBadge.textContent = state.mods.length;
  if (elements.infoModCount) elements.infoModCount.textContent = `${count} active / ${state.mods.length} total`;

  if (!elements.modsGrid) return;

  if (state.mods.length === 0) {
    elements.modsGrid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 30px;">
        No mods in local <code>./mods</code> folder yet. Drag & drop .jar files above to add them!
      </div>
    `;
    return;
  }

  elements.modsGrid.innerHTML = state.mods.map(mod => `
    <div class="mod-card">
      <div class="mod-icon">
        ${mod.icon ? `<img src="${mod.icon}" alt="icon">` : `
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
          </svg>
        `}
      </div>
      <div class="mod-info">
        <div class="mod-name" title="${escapeHtml(mod.name)}">${escapeHtml(mod.name)}</div>
        <div class="mod-ver">v${escapeHtml(mod.version)} • ${mod.size}</div>
        <div class="mod-desc">${escapeHtml(mod.description)}</div>
      </div>
      <div class="mod-actions">
        <label class="switch">
          <input type="checkbox" ${mod.enabled ? 'checked' : ''} onchange="toggleModStatus('${escapeJs(mod.filename)}')">
          <span class="slider"></span>
        </label>
        <button class="btn-icon-danger" onclick="deleteModFile('${escapeJs(mod.filename)}')" title="Delete Mod">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    </div>
  `).join('');
}

window.toggleModStatus = async function(filename) {
  const res = await postAPI('/api/mods/toggle', { filename });
  if (res.success) {
    fetchMods();
  }
};

window.deleteModFile = async function(filename) {
  if (confirm(`Delete mod file ${filename}?`)) {
    const res = await postAPI('/api/mods/delete', { filename });
    if (res.success) {
      fetchMods();
    }
  }
};

async function uploadModFiles(files) {
  const formData = new FormData();
  for (let i = 0; i < files.length; i++) {
    formData.append('modFile', files[i]);
  }

  const res = await fetch('/api/mods/upload', {
    method: 'POST',
    body: formData
  });
  const data = await res.json();
  if (data.success) {
    fetchMods();
  }
}

function renderRoaming() {
  if (!state.roaming) return;

  if (elements.savesList) {
    elements.savesList.innerHTML = state.roaming.saves.length > 0 ? state.roaming.saves.map(s => `
      <div class="roaming-item">
        <span>${escapeHtml(s.name)}</span>
        <button class="btn btn-sync" onclick="syncItem('save', '${escapeJs(s.name)}')">Import</button>
      </div>
    `).join('') : '<div style="color: var(--text-muted); font-size: 12px;">No saves found</div>';
  }

  if (elements.rpList) {
    elements.rpList.innerHTML = state.roaming.resourcepacks.length > 0 ? state.roaming.resourcepacks.map(r => `
      <div class="roaming-item">
        <span>${escapeHtml(r.name)}</span>
        <button class="btn btn-sync" onclick="syncItem('resourcepack', '${escapeJs(r.name)}')">Import</button>
      </div>
    `).join('') : '<div style="color: var(--text-muted); font-size: 12px;">No resource packs found</div>';
  }

  if (elements.spList) {
    elements.spList.innerHTML = state.roaming.shaderpacks.length > 0 ? state.roaming.shaderpacks.map(sp => `
      <div class="roaming-item">
        <span>${escapeHtml(sp.name)}</span>
        <button class="btn btn-sync" onclick="syncItem('shaderpack', '${escapeJs(sp.name)}')">Import</button>
      </div>
    `).join('') : '<div style="color: var(--text-muted); font-size: 12px;">No shader packs found</div>';
  }
}

window.syncItem = async function(type, name) {
  const res = await postAPI('/api/roaming/sync', { type, name });
  if (res.success) {
    alert(res.result.message);
  } else {
    alert(`Error: ${res.error}`);
  }
};

function updateLaunchStatus(data) {
  if (elements.launchStatusText) elements.launchStatusText.textContent = data.message;
  if (elements.launchSpinner) {
    if (data.state === 'preparing' || data.state === 'launching') {
      elements.launchSpinner.style.display = 'block';
    } else {
      elements.launchSpinner.style.display = 'none';
    }
  }

  if (data.state === 'running') {
    updateGameStatus({ isRunning: true, pid: state.gameStatus.pid || 'Active' });
  } else if (data.state === 'idle') {
    updateGameStatus({ isRunning: false, pid: null });
  }
}

function updateGameStatus(status) {
  state.gameStatus = status;
  if (status.isRunning) {
    if (elements.btnLaunch) elements.btnLaunch.style.display = 'none';
    if (elements.btnKill) elements.btnKill.style.display = 'inline-flex';
    if (elements.instanceStatusLabel) {
      elements.instanceStatusLabel.textContent = status.pid ? `RUNNING (PID ${status.pid})` : 'RUNNING';
    }
  } else {
    isLaunchInFlight = false;
    if (elements.btnLaunch) {
      elements.btnLaunch.disabled = false;
      elements.btnLaunch.style.display = 'inline-flex';
    }
    if (elements.btnKill) elements.btnKill.style.display = 'none';
    if (elements.instanceStatusLabel) elements.instanceStatusLabel.textContent = 'READY';
  }
}

function appendConsoleLog(log) {
  if (!elements.consoleTerminal) return;
  const line = document.createElement('div');
  line.className = `log-line ${log.type || 'out'}`;
  line.textContent = log.text;
  elements.consoleTerminal.appendChild(line);
  elements.consoleTerminal.scrollTop = elements.consoleTerminal.scrollHeight;
}

async function postAPI(url, data = {}) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return await res.json();
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeJs(str) {
  return String(str || '').replace(/'/g, "\\'");
}

document.addEventListener('DOMContentLoaded', init);
