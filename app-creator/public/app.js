// ==========================================================================
// AppCraft Studio - Client Application Logic
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
  // State
  let presets = [];
  let userApps = [];
  let currentCategory = 'all';
  let searchQuery = '';
  let ws = null;
  let runningProcess = false;
  let executionStartTime = null;
  let timerInterval = null;
  let activeExportButton = null;

  // DOM Elements
  const appGrid = document.getElementById('appGrid');
  const sidebarNav = document.getElementById('sidebarNav');
  const searchInput = document.getElementById('searchInput');
  const badgeAllCount = document.getElementById('badgeAllCount');
  const displayedAppsCount = document.getElementById('displayedAppsCount');
  const currentCategoryTitle = document.getElementById('currentCategoryTitle');

  // Terminal DOM
  const terminalDrawer = document.getElementById('terminalDrawer');
  const terminalLogs = document.getElementById('terminalLogs');
  const terminalPlaceholder = document.querySelector('.terminal-placeholder');
  const termStatusBadge = document.getElementById('termStatusBadge');
  const termPidBadge = document.getElementById('termPidBadge');
  const termTimerBadge = document.getElementById('termTimerBadge');
  const btnKillProcess = document.getElementById('btnKillProcess');
  const btnClearTerm = document.getElementById('btnClearTerm');
  const btnCopyTerm = document.getElementById('btnCopyTerm');
  const btnToggleTermHeight = document.getElementById('btnToggleTermHeight');
  const connectionBadge = document.getElementById('connectionBadge');

  // Modal DOM
  const appEditorModal = document.getElementById('appEditorModal');
  const btnCreateApp = document.getElementById('btnCreateApp');
  const btnCloseModal = document.getElementById('btnCloseModal');
  const btnCancelModal = document.getElementById('btnCancelModal');
  const btnSaveApp = document.getElementById('btnSaveApp');
  const appForm = document.getElementById('appForm');
  const paramsList = document.getElementById('paramsList');
  const btnAddParam = document.getElementById('btnAddParam');
  const editorTagBadges = document.getElementById('editorTagBadges');
  const appCommand = document.getElementById('appCommand');

  // Export Modal DOM
  const exportModal = document.getElementById('exportModal');
  const btnCloseExportModal = document.getElementById('btnCloseExportModal');
  const exportTargetInfo = document.getElementById('exportTargetInfo');

  // Import / Export JSON buttons
  const btnImportJson = document.getElementById('btnImportJson');
  const btnExportAll = document.getElementById('btnExportAll');
  const jsonFileInput = document.getElementById('jsonFileInput');

  // System Widget DOM
  const sysCpu = document.getElementById('sysCpu');
  const sysRam = document.getElementById('sysRam');
  const sysOs = document.getElementById('sysOs');

  // Initialize Lucide Icons
  lucide.createIcons();

  // Initialize WebSocket Connection
  function initWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      connectionBadge.className = 'connection-badge status-connected';
      connectionBadge.querySelector('#connText').textContent = 'Connected';
    };

    ws.onclose = () => {
      connectionBadge.className = 'connection-badge status-disconnected';
      connectionBadge.querySelector('#connText').textContent = 'Disconnected';
      setTimeout(initWebSocket, 3000);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleWsMessage(msg);
      } catch (e) {
        console.error('WS Parse Error:', e);
      }
    };
  }

  // Load System Stats
  async function loadSystemStats() {
    try {
      const res = await fetch('/api/system');
      const data = await res.json();
      if (data) {
        sysCpu.textContent = `${data.cpus} Cores`;
        sysRam.textContent = `${data.totalMemGB} GB RAM`;
        sysOs.textContent = data.platform === 'win32' ? 'Windows' : data.platform;
      }
    } catch (e) {
      console.warn('Could not fetch system stats:', e);
    }
  }

  // Load Apps Data
  async function loadApps() {
    try {
      const res = await fetch('/api/apps');
      const data = await res.json();
      presets = data.presets || [];
      userApps = data.userApps || [];
      renderSidebarNav();
      renderAppGrid();
    } catch (e) {
      console.error('Error loading apps:', e);
    }
  }

  // Save User Apps to API
  async function saveUserAppsToServer() {
    try {
      await fetch('/api/apps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apps: userApps })
      });
    } catch (e) {
      console.error('Failed saving user apps:', e);
    }
  }

  // Get All Buttons (Combined presets + user apps)
  function getAllButtons() {
    const presetButtons = presets.flatMap(cat => cat.buttons.map(b => ({ ...b, category: cat.title, isPreset: true })));
    const customButtons = userApps.map(b => ({ ...b, isPreset: false }));
    return [...presetButtons, ...customButtons];
  }

  // Render Sidebar Navigation Categories
  function renderSidebarNav() {
    const allButtons = getAllButtons();
    badgeAllCount.textContent = allButtons.length;

    // Group categories
    const categoriesMap = new Map();
    allButtons.forEach(btn => {
      const catName = btn.category || 'Custom Apps';
      categoriesMap.set(catName, (categoriesMap.get(catName) || 0) + 1);
    });

    let navHtml = `
      <button class="nav-item ${currentCategory === 'all' ? 'active' : ''}" data-category="all">
        <i data-lucide="layout-grid"></i> All Apps <span class="badge">${allButtons.length}</span>
      </button>
    `;

    categoriesMap.forEach((count, catName) => {
      let catIcon = 'folder';
      if (catName.includes('System')) catIcon = 'activity';
      else if (catName.includes('Developer')) catIcon = 'code';
      else if (catName.includes('Scripting')) catIcon = 'zap';

      navHtml += `
        <button class="nav-item ${currentCategory === catName ? 'active' : ''}" data-category="${catName}">
          <i data-lucide="${catIcon}"></i> ${catName} <span class="badge">${count}</span>
        </button>
      `;
    });

    sidebarNav.innerHTML = navHtml;
    lucide.createIcons();

    // Attach Category Click Handlers
    sidebarNav.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        sidebarNav.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentCategory = btn.dataset.category;
        currentCategoryTitle.textContent = currentCategory === 'all' ? 'All Executable Apps' : currentCategory;
        renderAppGrid();
      });
    });
  }

  // Render App Grid
  function renderAppGrid() {
    let allButtons = getAllButtons();

    // Filter by Category
    if (currentCategory !== 'all') {
      allButtons = allButtons.filter(b => (b.category || 'Custom Apps') === currentCategory);
    }

    // Filter by Search Query
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      allButtons = allButtons.filter(b => 
        b.name.toLowerCase().includes(q) || 
        (b.description && b.description.toLowerCase().includes(q)) ||
        (b.command && b.command.toLowerCase().includes(q))
      );
    }

    displayedAppsCount.textContent = `Showing ${allButtons.length} executable app${allButtons.length === 1 ? '' : 's'}`;

    if (allButtons.length === 0) {
      appGrid.innerHTML = `
        <div class="empty-state" style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">
          <i data-lucide="package-search" style="width: 48px; height: 48px; margin-bottom: 12px; opacity: 0.4;"></i>
          <h3>No Executable Apps Found</h3>
          <p>Click "Create New App" to build your custom command app button!</p>
        </div>
      `;
      lucide.createIcons();
      return;
    }

    let gridHtml = '';

    allButtons.forEach(btn => {
      const cardColor = btn.color || '#3b82f6';
      const cardIcon = btn.icon || 'terminal';
      const inputs = btn.inputs || [];

      let inputsHtml = '';
      if (inputs.length > 0) {
        inputsHtml += `<div class="card-inputs-container">`;
        inputs.forEach(inp => {
          inputsHtml += `
            <div class="card-input-field">
              <label for="input_${btn.id}_${inp.id}">${inp.label}</label>
              <input type="${inp.type || 'text'}" id="input_${btn.id}_${inp.id}" data-param="${inp.id}" value="${inp.default || ''}">
            </div>
          `;
        });
        inputsHtml += `</div>`;
      }

      gridHtml += `
        <div class="app-card" id="card_${btn.id}">
          <div class="app-card-top">
            <div class="app-card-brand">
              <div class="app-card-icon" style="background: ${cardColor};">
                <i data-lucide="${cardIcon}"></i>
              </div>
              <div class="app-card-meta">
                <h3>${escapeHtml(btn.name)}</h3>
                <span class="app-card-type-badge">${btn.type || 'cmd'}</span>
              </div>
            </div>

            <div class="app-card-actions">
              <button class="icon-btn btn-export-card" data-id="${btn.id}" title="Export Executable Launcher (.bat / .ps1)">
                <i data-lucide="download"></i>
              </button>
              ${!btn.isPreset ? `
                <button class="icon-btn btn-edit-card" data-id="${btn.id}" title="Edit Code & Config">
                  <i data-lucide="edit-3"></i>
                </button>
                <button class="icon-btn btn-delete-card" data-id="${btn.id}" title="Delete App">
                  <i data-lucide="trash-2"></i>
                </button>
              ` : `
                <button class="icon-btn btn-edit-card" data-id="${btn.id}" title="Inspect / Customize Code">
                  <i data-lucide="code"></i>
                </button>
              `}
            </div>
          </div>

          <div class="app-card-desc">${escapeHtml(btn.description || 'No description provided.')}</div>

          ${inputsHtml}

          <div class="app-card-bottom">
            <button class="btn-run-app" data-id="${btn.id}" style="background: linear-gradient(135deg, ${cardColor}, ${adjustColor(cardColor, -30)});}">
              <i data-lucide="play"></i> RUN APP
            </button>
          </div>
        </div>
      `;
    });

    appGrid.innerHTML = gridHtml;
    lucide.createIcons();

    // Attach Event Handlers
    appGrid.querySelectorAll('.btn-run-app').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const targetBtn = getAllButtons().find(b => b.id === id);
        if (targetBtn) runApp(targetBtn);
      });
    });

    appGrid.querySelectorAll('.btn-export-card').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const targetBtn = getAllButtons().find(b => b.id === id);
        if (targetBtn) openExportModal(targetBtn);
      });
    });

    appGrid.querySelectorAll('.btn-edit-card').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const targetBtn = getAllButtons().find(b => b.id === id);
        if (targetBtn) openEditorModal(targetBtn);
      });
    });

    appGrid.querySelectorAll('.btn-delete-card').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        if (confirm('Are you sure you want to delete this custom executable app?')) {
          userApps = userApps.filter(b => b.id !== id);
          saveUserAppsToServer();
          renderSidebarNav();
          renderAppGrid();
        }
      });
    });
  }

  // Execute App Button Command via WebSocket
  function runApp(button) {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      alert('Server WebSocket disconnected! Reconnecting...');
      return;
    }

    // Collect Input Parameter values from Card
    const inputsVal = {};
    if (button.inputs && button.inputs.length > 0) {
      button.inputs.forEach(inp => {
        const inputElem = document.getElementById(`input_${button.id}_${inp.id}`);
        if (inputElem) {
          inputsVal[inp.id] = inputElem.value;
        } else {
          inputsVal[inp.id] = inp.default || '';
        }
      });
    }

    // Show Terminal Drawer
    terminalDrawer.style.display = 'flex';
    terminalLogs.style.display = 'block';
    terminalPlaceholder.style.display = 'none';

    termStatusBadge.className = 'terminal-status-badge status-running';
    termStatusBadge.textContent = 'RUNNING...';
    btnKillProcess.disabled = false;

    // Start Timer
    startTimer();

    // Send Run Payload
    ws.send(JSON.stringify({
      action: 'run',
      type: button.type || 'powershell',
      command: button.command,
      inputs: inputsVal
    }));
  }

  // Handle Incoming WS Messages
  function handleWsMessage(msg) {
    if (msg.type === 'start') {
      appendLog(`\n--- Executing: ${msg.command} ---\n`, 'cyan');
    } else if (msg.type === 'pid') {
      termPidBadge.style.display = 'inline-block';
      termPidBadge.textContent = `PID: ${msg.pid}`;
    } else if (msg.type === 'stdout') {
      appendLog(msg.data, 'white');
    } else if (msg.type === 'stderr') {
      appendLog(msg.data, 'yellow');
    } else if (msg.type === 'error') {
      appendLog(`\n[Execution Error]: ${msg.data}\n`, 'red');
    } else if (msg.type === 'exit') {
      stopTimer();
      btnKillProcess.disabled = true;
      termPidBadge.style.display = 'none';

      if (msg.code === 0) {
        termStatusBadge.className = 'terminal-status-badge status-success';
        termStatusBadge.textContent = `COMPLETED (Code 0)`;
        appendLog(`\n[Process completed successfully]\n`, 'green');
      } else {
        termStatusBadge.className = 'terminal-status-badge status-error';
        termStatusBadge.textContent = `FAILED (Code ${msg.code})`;
        appendLog(`\n[Process exited with code ${msg.code}]\n`, 'red');
      }
    }
  }

  // Append Text to Terminal Log
  function appendLog(text, color = 'white') {
    const span = document.createElement('span');
    span.textContent = text;
    if (color === 'cyan') span.style.color = '#38bdf8';
    if (color === 'yellow') span.style.color = '#fde047';
    if (color === 'red') span.style.color = '#f87171';
    if (color === 'green') span.style.color = '#4ade80';

    terminalLogs.appendChild(span);
    terminalBody.scrollTop = terminalBody.scrollHeight;
  }

  // Timer Controls
  function startTimer() {
    stopTimer();
    executionStartTime = Date.now();
    termTimerBadge.textContent = '0.0s';
    timerInterval = setInterval(() => {
      const elapsed = ((Date.now() - executionStartTime) / 1000).toFixed(1);
      termTimerBadge.textContent = `${elapsed}s`;
    }, 100);
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  // Kill Process Handler
  btnKillProcess.addEventListener('click', () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ action: 'kill' }));
    }
  });

  // Clear Terminal
  btnClearTerm.addEventListener('click', () => {
    terminalLogs.innerHTML = '';
    termStatusBadge.className = 'terminal-status-badge status-idle';
    termStatusBadge.textContent = 'IDLE';
    termTimerBadge.textContent = '0.0s';
  });

  // Copy Terminal Logs
  btnCopyTerm.addEventListener('click', () => {
    navigator.clipboard.writeText(terminalLogs.textContent);
    btnCopyTerm.innerHTML = `<i data-lucide="check"></i> Copied!`;
    lucide.createIcons();
    setTimeout(() => {
      btnCopyTerm.innerHTML = `<i data-lucide="copy"></i> Copy Output`;
      lucide.createIcons();
    }, 2000);
  });

  // Toggle Terminal Height
  btnToggleTermHeight.addEventListener('click', () => {
    terminalDrawer.classList.toggle('expanded');
    const isExpanded = terminalDrawer.classList.contains('expanded');
    btnToggleTermHeight.innerHTML = `<i data-lucide="${isExpanded ? 'minimize-2' : 'maximize-2'}"></i>`;
    lucide.createIcons();
  });

  // --- App Editor Modal Handlers ---

  btnCreateApp.addEventListener('click', () => {
    openEditorModal(null);
  });

  function openEditorModal(button = null) {
    appForm.reset();
    paramsList.innerHTML = '';

    if (button) {
      document.getElementById('editorModalTitle').textContent = 'Edit Executable App';
      document.getElementById('editAppId').value = button.id;
      document.getElementById('appName').value = button.name;
      document.getElementById('appCategory').value = button.category || 'Custom Apps';
      document.getElementById('appType').value = button.type || 'powershell';
      document.getElementById('appColor').value = button.color || '#3b82f6';
      document.getElementById('appIcon').value = button.icon || 'terminal';
      document.getElementById('appDescription').value = button.description || '';
      document.getElementById('appCommand').value = button.command || '';

      if (button.inputs) {
        button.inputs.forEach(inp => addParamRow(inp));
      }
    } else {
      document.getElementById('editorModalTitle').textContent = 'Create New Executable App';
      document.getElementById('editAppId').value = '';
      document.getElementById('appColor').value = '#3b82f6';
      document.getElementById('appIcon').value = 'terminal';
    }

    renderParamTagBadges();
    appEditorModal.classList.add('open');
  }

  function closeEditorModal() {
    appEditorModal.classList.remove('open');
  }

  btnCloseModal.addEventListener('click', closeEditorModal);
  btnCancelModal.addEventListener('click', closeEditorModal);

  // Add Dynamic Input Parameter Row
  function addParamRow(inp = { id: '', label: '', type: 'text', default: '' }) {
    const rowId = 'param_' + Math.random().toString(36).substr(2, 6);
    const div = document.createElement('div');
    div.className = 'param-row';
    div.id = rowId;

    div.innerHTML = `
      <input type="text" placeholder="ID (e.g. host)" class="param-id" value="${inp.id}" required style="flex:1;">
      <input type="text" placeholder="Label (e.g. Target Host)" class="param-label" value="${inp.label}" required style="flex:2;">
      <select class="param-type" style="flex:1;">
        <option value="text" ${inp.type === 'text' ? 'selected' : ''}>Text</option>
        <option value="number" ${inp.type === 'number' ? 'selected' : ''}>Number</option>
      </select>
      <input type="text" placeholder="Default Value" class="param-default" value="${inp.default}" style="flex:1.5;">
      <button type="button" class="icon-btn btn-remove-param" title="Remove Field">
        <i data-lucide="x"></i>
      </button>
    `;

    paramsList.appendChild(div);
    lucide.createIcons();

    div.querySelector('.btn-remove-param').addEventListener('click', () => {
      div.remove();
      renderParamTagBadges();
    });

    div.querySelector('.param-id').addEventListener('input', renderParamTagBadges);
  }

  btnAddParam.addEventListener('click', () => {
    addParamRow();
  });

  // Render Parameter Tag Badges for quick insert into Code Editor
  function renderParamTagBadges() {
    const idInputs = paramsList.querySelectorAll('.param-id');
    let tagsHtml = '<span class="tag-label">Click to insert parameter tag:</span>';

    let count = 0;
    idInputs.forEach(input => {
      const val = input.value.trim();
      if (val) {
        count++;
        tagsHtml += `<span class="param-tag-badge" data-tag="{{${val}}}">{{${val}}}</span>`;
      }
    });

    if (count === 0) {
      tagsHtml += `<span style="font-size:0.72rem; color:var(--text-muted);">No input variables defined above</span>`;
    }

    editorTagBadges.innerHTML = tagsHtml;

    editorTagBadges.querySelectorAll('.param-tag-badge').forEach(badge => {
      badge.addEventListener('click', () => {
        const tag = badge.dataset.tag;
        insertTextAtCursor(appCommand, tag);
      });
    });
  }

  function insertTextAtCursor(textarea, text) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const val = textarea.value;
    textarea.value = val.substring(0, start) + text + val.substring(end);
    textarea.focus();
    textarea.selectionStart = textarea.selectionEnd = start + text.length;
  }

  // Save App Button Submission
  btnSaveApp.addEventListener('click', () => {
    if (!appForm.checkValidity()) {
      appForm.reportValidity();
      return;
    }

    const editId = document.getElementById('editAppId').value;
    const name = document.getElementById('appName').value.trim();
    const category = document.getElementById('appCategory').value.trim() || 'Custom Apps';
    const type = document.getElementById('appType').value;
    const color = document.getElementById('appColor').value;
    const icon = document.getElementById('appIcon').value.trim() || 'terminal';
    const description = document.getElementById('appDescription').value.trim();
    const command = document.getElementById('appCommand').value;

    // Collect Parameters
    const inputs = [];
    paramsList.querySelectorAll('.param-row').forEach(row => {
      const pId = row.querySelector('.param-id').value.trim();
      const pLabel = row.querySelector('.param-label').value.trim();
      const pType = row.querySelector('.param-type').value;
      const pDefault = row.querySelector('.param-default').value.trim();
      if (pId) {
        inputs.push({ id: pId, label: pLabel || pId, type: pType, default: pDefault });
      }
    });

    if (editId) {
      // Check if user app or preset override
      const idx = userApps.findIndex(b => b.id === editId);
      if (idx !== -1) {
        userApps[idx] = { ...userApps[idx], name, category, type, color, icon, description, command, inputs };
      } else {
        // Created custom copy of preset
        const newApp = {
          id: 'custom_' + Date.now(),
          name, category, type, color, icon, description, command, inputs
        };
        userApps.push(newApp);
      }
    } else {
      const newApp = {
        id: 'custom_' + Date.now(),
        name, category, type, color, icon, description, command, inputs
      };
      userApps.push(newApp);
    }

    saveUserAppsToServer();
    closeEditorModal();
    renderSidebarNav();
    renderAppGrid();
  });

  // --- Standalone Executable Exporter Modal Handlers ---

  function openExportModal(button) {
    activeExportButton = button;
    exportTargetInfo.innerHTML = `
      <div style="display:flex; align-items:center; gap:12px; background:rgba(30,41,59,0.5); padding:12px; border-radius:var(--radius-md); border:1px solid var(--border-color);">
        <div style="width:36px; height:36px; border-radius:var(--radius-sm); background:${button.color || '#3b82f6'}; display:flex; align-items:center; justify-content:center; color:white;">
          <i data-lucide="${button.icon || 'terminal'}"></i>
        </div>
        <div>
          <strong style="display:block;">${escapeHtml(button.name)}</strong>
          <span style="font-size:0.75rem; color:var(--text-muted);">${button.inputs ? button.inputs.length : 0} input parameters • ${button.type} engine</span>
        </div>
      </div>
    `;
    lucide.createIcons();
    exportModal.classList.add('open');
  }

  btnCloseExportModal.addEventListener('click', () => {
    exportModal.classList.remove('open');
  });

  exportModal.querySelectorAll('.export-option-card').forEach(card => {
    card.addEventListener('click', async () => {
      const format = card.dataset.format;
      if (!activeExportButton) return;

      try {
        const response = await fetch('/api/export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ button: activeExportButton, format })
        });

        if (response.ok) {
          const blob = await response.blob();
          const downloadUrl = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = downloadUrl;
          a.download = `${activeExportButton.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.${format}`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          exportModal.classList.remove('open');
        } else {
          alert('Export error occurred.');
        }
      } catch (e) {
        console.error('Export failed:', e);
      }
    });
  });

  // --- JSON Import & Export ---

  btnExportAll.addEventListener('click', () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(userApps, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "appcraft_user_apps.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  });

  btnImportJson.addEventListener('click', () => {
    jsonFileInput.click();
  });

  jsonFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const imported = JSON.parse(evt.target.result);
        if (Array.isArray(imported)) {
          userApps = [...userApps, ...imported];
          saveUserAppsToServer();
          renderSidebarNav();
          renderAppGrid();
          alert(`Successfully imported ${imported.length} app buttons!`);
        }
      } catch (err) {
        alert('Invalid JSON file format.');
      }
    };
    reader.readAsText(file);
  });

  // Search Input Listener
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderAppGrid();
  });

  // Helper Functions
  function escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function adjustColor(hex, percent) {
    let num = parseInt(hex.replace('#', ''), 16),
      amt = Math.round(2.55 * percent),
      R = (num >> 16) + amt,
      G = (num >> 8 & 0x00FF) + amt,
      B = (num & 0x0000FF) + amt;
    return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 + (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 + (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
  }

  // Boot Application
  initWebSocket();
  loadSystemStats();
  loadApps();
});
