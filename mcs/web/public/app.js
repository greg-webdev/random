const socket = io();

// UI Elements
const navBtns = document.querySelectorAll('.nav-btn');
const tabContents = document.querySelectorAll('.tab-content');

const sidebarStatusDot = document.getElementById('sidebar-status-dot');
const sidebarStatusText = document.getElementById('sidebar-status-text');

const statState = document.getElementById('stat-state');
const statPort = document.getElementById('stat-port');
const statOnlineMode = document.getElementById('stat-online-mode');

const btnStart = document.getElementById('btn-start');
const btnStop = document.getElementById('btn-stop');

const consoleBox = document.getElementById('console-box');
const consoleMini = document.getElementById('console-mini');
const consoleInput = document.getElementById('console-input');
const btnSendCmd = document.getElementById('btn-send-cmd');
const btnClearConsole = document.getElementById('btn-clear-console');

const settingsForm = document.getElementById('settings-form');
const btnSaveSettings = document.getElementById('btn-save-settings');
const settingsAlert = document.getElementById('settings-alert');

// Navigation Tab Switching
function switchTab(tabId) {
    const allNavBtns = document.querySelectorAll('.nav-btn');
    const allTabContents = document.querySelectorAll('.tab-content');

    allNavBtns.forEach(btn => {
        if (btn.dataset.tab === tabId) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    allTabContents.forEach(content => {
        if (content.id === `tab-${tabId}`) {
            content.classList.add('active');
            if (tabId === 'players' && spectatorRenderer && spectatorCamera) {
                const container = document.getElementById('spectator-camera-viewport');
                if (container) {
                    const w = container.clientWidth || 640;
                    const h = container.clientHeight || 360;
                    spectatorCamera.aspect = w / h;
                    spectatorCamera.updateProjectionMatrix();
                    spectatorRenderer.setSize(w, h);
                }
            }
            if (tabId === 'mods') {
                loadMods();
            }
        } else {
            content.classList.remove('active');
        }
    });
}



document.addEventListener('click', (e) => {
    const navBtn = e.target.closest('.nav-btn');
    if (navBtn && navBtn.dataset.tab) {
        switchTab(navBtn.dataset.tab);
    }
});


// Socket Events & Status Updates
socket.on('status-change', (data) => {
    updateStatus(data.online);
});

socket.on('init-logs', (logs) => {
    consoleBox.innerHTML = '';
    consoleMini.innerHTML = '';
    logs.forEach(appendLog);
});

socket.on('console-log', (text) => {
    appendLog(text);
});

function appendLog(text) {
    if (!consoleBox || !consoleMini) return;
    const isAtBottom = consoleBox.scrollTop + consoleBox.clientHeight >= consoleBox.scrollHeight - 50;
    
    const span = document.createElement('span');
    span.textContent = text;
    if (text.includes('[System]')) span.style.color = '#ffffff';
    else if (text.includes('WARN')) span.style.color = '#aaaaaa';
    else if (text.includes('ERROR')) span.style.color = '#888888';
    
    consoleBox.appendChild(span.cloneNode(true));
    consoleMini.appendChild(span);

    if (isAtBottom) {
        consoleBox.scrollTop = consoleBox.scrollHeight;
    }
    consoleMini.scrollTop = consoleMini.scrollHeight;
}

function updateStatus(isOnline) {
    if (sidebarStatusDot) sidebarStatusDot.classList.toggle('online', isOnline);
    if (sidebarStatusText) sidebarStatusText.textContent = isOnline ? 'RUNNING' : 'OFFLINE';
    if (statState) {
        statState.textContent = isOnline ? 'RUNNING' : 'OFFLINE';
        statState.style.color = isOnline ? '#ffffff' : '#888888';
    }
    if (btnStart) btnStart.disabled = isOnline;
    if (btnStop) btnStop.disabled = !isOnline;
}

// Control Actions
if (btnStart) btnStart.addEventListener('click', () => socket.emit('start-server'));
if (btnStop) btnStop.addEventListener('click', () => socket.emit('stop-server'));

function sendConsoleCommand() {
    if (!consoleInput) return;
    const cmd = consoleInput.value.trim();
    if (cmd) {
        socket.emit('send-command', cmd);
        consoleInput.value = '';
    }
}

if (btnSendCmd) btnSendCmd.addEventListener('click', sendConsoleCommand);
if (consoleInput) {
    consoleInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') sendConsoleCommand();
    });
}

if (btnClearConsole) {
    btnClearConsole.addEventListener('click', () => {
        if (consoleBox) consoleBox.innerHTML = '';
    });
}


// Load Settings
async function loadSettings() {
    try {
        const res = await fetch('/api/settings');
        const settings = await res.json();

        statPort.textContent = settings['server-port'] || '25565';
        statOnlineMode.textContent = settings['online-mode'] === 'true' ? 'Enabled' : 'Disabled';

        settingsForm.innerHTML = '';
        for (const [key, value] of Object.entries(settings)) {
            const div = document.createElement('div');
            div.className = 'setting-item';

            const label = document.createElement('label');
            label.textContent = key;
            div.appendChild(label);

            let input;
            if (value === 'true' || value === 'false') {
                input = document.createElement('select');
                input.name = key;
                input.innerHTML = `
                    <option value="true" ${value === 'true' ? 'selected' : ''}>true</option>
                    <option value="false" ${value === 'false' ? 'selected' : ''}>false</option>
                `;
            } else {
                input = document.createElement('input');
                input.type = 'text';
                input.name = key;
                input.value = value;
            }

            div.appendChild(input);
            settingsForm.appendChild(div);
        }
    } catch (err) {
        console.error('Failed to load settings:', err);
    }
}

// Save Settings
btnSaveSettings.addEventListener('click', async () => {
    const formData = new FormData(settingsForm);
    const updatedProps = {};
    formData.forEach((val, key) => {
        updatedProps[key] = val;
    });

    try {
        const res = await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedProps)
        });
        const data = await res.json();
        if (data.success) {
            settingsAlert.textContent = 'Settings saved successfully.';
            settingsAlert.className = 'alert success';
            setTimeout(() => settingsAlert.className = 'alert hidden', 3000);
            loadSettings();
        }
    } catch (err) {
        alert('Failed to save settings: ' + err.message);
    }
});

// ----------------------------------------------------
// RELIABLE THREE.JS 3D VOXEL ENGINE FOR REAL WORLD MAP
// ----------------------------------------------------
let mapInitialized = false;
let scene, camera, renderer, controls;
let containerEl = null;
let voxelInstancedMesh = null;
let allVoxelsData = [];
let playerMarkers = {};
let activePlayersList = [];
let currentCutoffY = 320;
let followTarget = 'none'; // 'none', 'spawn', or player name

const BLOCK_COLORS = {
    grass_block: 0x4a7c29,
    grass: 0x4a7c29,
    dirt: 0x6e5239,
    coarse_dirt: 0x5a412c,
    stone: 0x666666,
    deepslate: 0x333338,
    cobblestone: 0x555555,
    sand: 0xc2b280,
    sandstone: 0xbdad76,
    water: 0x2b6cb0,
    oak_log: 0x4a3728,
    birch_log: 0xd4ceb8,
    spruce_log: 0x3b2a1d,
    wood: 0x4a3728,
    oak_leaves: 0x2d5a27,
    birch_leaves: 0x3e7a35,
    spruce_leaves: 0x1f421c,
    leaves: 0x2d5a27,
    coal_ore: 0x222222,
    iron_ore: 0x997755,
    diamond_ore: 0x319795,
    copper_ore: 0xb06d4e,
    gold_ore: 0xcca028,
    bedrock: 0x111111
};

function getBlockColor(type) {
    if (!type) return 0x666666;
    for (const [key, color] of Object.entries(BLOCK_COLORS)) {
        if (type.includes(key)) return color;
    }
    if (type.includes('stone')) return 0x666666;
    if (type.includes('leaves')) return 0x2d5a27;
    if (type.includes('log') || type.includes('wood')) return 0x4a3728;
    if (type.includes('ore')) return 0xaaaaaa;
    return 0x555555;
}

function onResize() {
    if (!renderer || !containerEl || !camera) return;
    const w = containerEl.clientWidth || (window.innerWidth - 300);
    const h = containerEl.clientHeight || (window.innerHeight - 200);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
}

function init3DMap() {
    mapInitialized = true;
    containerEl = document.getElementById('map-3d-canvas');
    if (!containerEl) return;

    const w = containerEl.clientWidth || (window.innerWidth - 300);
    const h = containerEl.clientHeight || (window.innerHeight - 200);

    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050505);

    // Camera
    camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 2000);
    camera.position.set(0, 120, 140);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    
    containerEl.innerHTML = '';
    containerEl.appendChild(renderer.domElement);

    // Orbit Controls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 64, 0);

    // Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.75);
    scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.85);
    dirLight.position.set(100, 200, 100);
    scene.add(dirLight);

    // Grid Floor
    const grid = new THREE.GridHelper(512, 64, 0xffffff, 0x333333);
    grid.position.y = 0;
    scene.add(grid);

    // Spawn Point Marker
    const spawnMat = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true });
    const spawnGeo = new THREE.BoxGeometry(4, 12, 4);
    const spawnMesh = new THREE.Mesh(spawnGeo, spawnMat);
    spawnMesh.position.set(0, 70, 0);
    spawnMesh.name = 'spawn_marker';
    scene.add(spawnMesh);

    // Fetch and render voxel terrain
    fetchVoxels();

    // Poll player positions & world voxel updates every 2 seconds
    setInterval(fetchVoxels, 2000);

    window.addEventListener('resize', onResize);


    // Toolbar Listeners
    const sliderY = document.getElementById('slice-y-slider');
    const valY = document.getElementById('val-slice-y');
    if (sliderY) {
        sliderY.addEventListener('input', (e) => {
            currentCutoffY = parseInt(e.target.value);
            valY.textContent = currentCutoffY;
            updateVoxelCutoff();
        });
    }

    const selectFollow = document.getElementById('select-follow-player');
    if (selectFollow) {
        selectFollow.addEventListener('change', (e) => {
            followTarget = e.target.value;
            const hudStatus = document.getElementById('hud-follow-status');
            if (hudStatus) hudStatus.textContent = followTarget === 'none' ? 'Free Camera' : `Following ${followTarget}`;
        });
    }

    const btnResetCam = document.getElementById('btn-reset-cam');
    if (btnResetCam) {
        btnResetCam.addEventListener('click', () => {
            followTarget = 'none';
            if (selectFollow) selectFollow.value = 'none';
            camera.position.set(0, 120, 140);
            controls.target.set(0, 64, 0);
        });
    }

    // Render Loop
    function renderLoop() {
        requestAnimationFrame(renderLoop);

        // Player Follow Camera Lock Tracking
        if (followTarget !== 'none') {
            let targetPos = null;
            if (followTarget === 'spawn') {
                targetPos = new THREE.Vector3(0, 70, 0);
            } else if (playerMarkers[followTarget]) {
                targetPos = playerMarkers[followTarget].position;
            }

            if (targetPos) {
                // If target just changed or offset is not initialized, set default overhead offset
                if (!controls.currentFollowOffset) {
                    controls.currentFollowOffset = new THREE.Vector3(0, 40, 50);
                }

                // Continuously update controls target to player position
                controls.target.copy(targetPos);
                camera.position.copy(targetPos).add(controls.currentFollowOffset);
            }
        } else {
            controls.currentFollowOffset = null;
        }





        controls.update();
        renderer.render(scene, camera);
    }
    renderLoop();
    setTimeout(onResize, 100);
}

async function fetchVoxels() {
    try {
        const res = await fetch('/api/world/voxels');
        const data = await res.json();
        allVoxelsData = data.voxels || [];
        activePlayersList = data.players || [];

        const hudCount = document.getElementById('hud-voxels-count');
        if (hudCount) hudCount.textContent = allVoxelsData.length;

        updatePlayerSelectOptions(activePlayersList);
        updatePlayer3DMarkers(activePlayersList);
        renderVoxels(allVoxelsData);
    } catch (e) {
        console.error('Error fetching real world voxels:', e);
    }
}

function updatePlayerSelectOptions(players) {
    const select = document.getElementById('select-follow-player');
    if (!select) return;

    const currentVal = select.value || followTarget;

    // Check if dropdown options match existing options to prevent resetting user selection
    const existingOptions = Array.from(select.options).map(o => o.value);
    const newPlayerValues = players.map(p => p.name);

    if (existingOptions.slice(2).join(',') !== newPlayerValues.join(',')) {
        select.innerHTML = `
            <option value="none">Free Camera</option>
            <option value="spawn">Spawn Point (0,70,0)</option>
        `;

        players.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.name;
            opt.textContent = `Player: ${p.name}`;
            select.appendChild(opt);
        });

        if (currentVal) {
            select.value = currentVal;
            followTarget = select.value;
        }
    }
}


function updatePlayer3DMarkers(players) {
    // Clear old markers not in list
    Object.keys(playerMarkers).forEach(name => {
        if (!players.some(p => p.name === name)) {
            scene.remove(playerMarkers[name]);
            delete playerMarkers[name];
        }
    });

    // Create / Update markers
    players.forEach(p => {
        if (!playerMarkers[p.name]) {
            const group = new THREE.Group();
            
            // Player body cylinder
            const bodyGeo = new THREE.CylinderGeometry(0.8, 0.8, 3, 8);
            const bodyMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
            const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
            bodyMesh.position.y = 1.5;
            group.add(bodyMesh);

            // Floating beacon ring
            const ringGeo = new THREE.RingGeometry(1.5, 2, 16);
            const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
            const ringMesh = new THREE.Mesh(ringGeo, ringMat);
            ringMesh.rotation.x = Math.PI / 2;
            ringMesh.position.y = 3.2;
            group.add(ringMesh);

            scene.add(group);
            playerMarkers[p.name] = group;
        }

        playerMarkers[p.name].position.set(p.x, p.y, p.z);
    });
}

function renderVoxels(voxels) {
    const filtered = voxels.filter(v => v.y <= currentCutoffY);
    if (filtered.length === 0) {
        if (voxelInstancedMesh) voxelInstancedMesh.count = 0;
        return;
    }

    // Reuse instanced mesh if capacity allows, otherwise re-create
    if (!voxelInstancedMesh || voxelInstancedMesh.instanceMatrix.array.length < filtered.length * 16) {
        if (voxelInstancedMesh) {
            scene.remove(voxelInstancedMesh);
            voxelInstancedMesh.geometry.dispose();
            voxelInstancedMesh.material.dispose();
        }

        const geometry = new THREE.BoxGeometry(1.95, 1.95, 1.95);
        const material = new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.1 });
        voxelInstancedMesh = new THREE.InstancedMesh(geometry, material, Math.max(filtered.length, 50000));
        scene.add(voxelInstancedMesh);
    }

    voxelInstancedMesh.count = filtered.length;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    filtered.forEach((v, i) => {
        dummy.position.set(v.x, v.y, v.z);
        dummy.updateMatrix();
        voxelInstancedMesh.setMatrixAt(i, dummy.matrix);

        const hex = getBlockColor(v.type);
        color.setHex(hex);
        voxelInstancedMesh.setColorAt(i, color);
    });

    voxelInstancedMesh.instanceMatrix.needsUpdate = true;
    if (voxelInstancedMesh.instanceColor) voxelInstancedMesh.instanceColor.needsUpdate = true;

    // Reposition camera target to world center ONLY if not following a target
    if (followTarget === 'none' && filtered.length > 0 && !controls.targetHasBeenSet) {
        let avgX = 0, avgZ = 0;
        const sampleCount = Math.min(100, filtered.length);
        for (let i = 0; i < sampleCount; i++) {
            avgX += filtered[i].x;
            avgZ += filtered[i].z;
        }
        controls.target.set(avgX / sampleCount, 60, avgZ / sampleCount);
        controls.targetHasBeenSet = true;
    }

}


function updateVoxelCutoff() {
    if (allVoxelsData.length > 0) {
        renderVoxels(allVoxelsData);
    }
}


// Command Generator Interactivity
function initCommandGenerator() {
    let currentCmdType = 'give';

    const typeBtns = document.querySelectorAll('.cmd-type-btn');
    const forms = document.querySelectorAll('.cmd-form');
    const outputInput = document.getElementById('generated-cmd-input');

    typeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            typeBtns.forEach(b => b.classList.remove('active'));
            forms.forEach(f => f.classList.remove('active'));

            btn.classList.add('active');
            currentCmdType = btn.getAttribute('data-cmd');
            const targetForm = document.getElementById(`form-${currentCmdType}`);
            if (targetForm) targetForm.classList.add('active');

            updateGeneratedCommand();
        });
    });

    const allInputs = document.querySelectorAll('.cmd-form input, .cmd-form select');
    allInputs.forEach(input => {
        input.addEventListener('input', updateGeneratedCommand);
        input.addEventListener('change', updateGeneratedCommand);
    });

    function updateGeneratedCommand() {
        if (!outputInput) return;
        let command = '';

        if (currentCmdType === 'give') {
            const target = document.getElementById('give-target').value.trim() || '@p';
            const item = document.getElementById('give-item').value.trim() || 'diamond_sword';
            const count = document.getElementById('give-count').value || 1;
            const name = document.getElementById('give-name').value.trim();
            const enchStr = document.getElementById('give-ench').value.trim();

            let components = [];
            if (name) {
                components.push(`custom_name='"${name}"'`);
            }
            if (enchStr) {
                const enchs = enchStr.split(',').map(s => {
                    const [eName, lvl] = s.split(':').map(x => x.trim());
                    return `"${eName}":${lvl || 1}`;
                }).join(',');
                components.push(`enchantments={levels:{${enchs}}}`);
            }

            const compStr = components.length > 0 ? `[${components.join(',')}]` : '';
            command = `give ${target} minecraft:${item}${compStr} ${count}`;
        } else if (currentCmdType === 'tp') {
            const target = document.getElementById('tp-target').value.trim() || '@p';
            const dest = document.getElementById('tp-dest').value.trim() || '0 100 0';
            command = `tp ${target} ${dest}`;
        } else if (currentCmdType === 'gamemode') {
            const mode = document.getElementById('gm-mode').value;
            const target = document.getElementById('gm-target').value.trim() || '@p';
            command = `gamemode ${mode} ${target}`;
        } else if (currentCmdType === 'effect') {
            const target = document.getElementById('eff-target').value.trim() || '@p';
            const name = document.getElementById('eff-name').value.trim() || 'speed';
            const duration = document.getElementById('eff-duration').value || 60;
            const amp = document.getElementById('eff-amp').value || 1;
            command = `effect give ${target} minecraft:${name} ${duration} ${amp}`;
        } else if (currentCmdType === 'summon') {
            const entity = document.getElementById('sum-entity').value.trim() || 'zombie';
            const pos = document.getElementById('sum-pos').value.trim() || '~ ~ ~';
            command = `summon minecraft:${entity} ${pos}`;
        } else if (currentCmdType === 'weather') {
            const wtType = document.getElementById('wt-type').value;
            command = wtType;
        }

        outputInput.value = command;
    }

    const btnCopy = document.getElementById('btn-copy-cmd');
    if (btnCopy) {
        btnCopy.addEventListener('click', () => {
            if (outputInput && outputInput.value) {
                navigator.clipboard.writeText(outputInput.value);
                const origText = btnCopy.textContent;
                btnCopy.textContent = 'Copied!';
                setTimeout(() => { btnCopy.textContent = origText; }, 1500);
            }
        });
    }

    const btnRun = document.getElementById('btn-run-generated-cmd');
    if (btnRun) {
        btnRun.addEventListener('click', () => {
            if (outputInput && outputInput.value) {
                socket.emit('send-command', outputInput.value);
                const origText = btnRun.textContent;
                btnRun.textContent = 'Sent!';
                setTimeout(() => { btnRun.textContent = origText; }, 1500);
            }
        });
    }

    updateGeneratedCommand();
}

// ----------------------------------------------------
// LIVE PLAYER TRACKER & THREE.JS CAMERA VIEWPORT
// ----------------------------------------------------
let spectatorScene, spectatorCamera, spectatorRenderer;
let botTargetMesh = null;
let spectatorViewportInitialized = false;

function initSpectatorViewport() {
    if (spectatorViewportInitialized) return;
    spectatorViewportInitialized = true;

    const container = document.getElementById('spectator-camera-viewport');
    if (!container) return;

    const w = container.clientWidth || 640;
    const h = container.clientHeight || 360;

    spectatorScene = new THREE.Scene();
    spectatorScene.background = new THREE.Color(0x0a0a0a);

    spectatorCamera = new THREE.PerspectiveCamera(70, w / h, 0.1, 1000);
    spectatorCamera.position.set(0, 70, 0);

    spectatorRenderer = new THREE.WebGLRenderer({ antialias: true });
    spectatorRenderer.setSize(w, h);
    spectatorRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    container.appendChild(spectatorRenderer.domElement);

    const ambient = new THREE.AmbientLight(0xffffff, 0.8);
    spectatorScene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(50, 100, 50);
    spectatorScene.add(dirLight);

    const grid = new THREE.GridHelper(256, 32, 0xffffff, 0x444444);
    grid.position.y = 0;
    spectatorScene.add(grid);

    // Target Player Mesh Representation
    const playerGroup = new THREE.Group();
    const bodyGeo = new THREE.CylinderGeometry(0.6, 0.6, 2.8, 12);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.position.y = 1.4;
    playerGroup.add(bodyMesh);

    const headGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xcccccc });
    const headMesh = new THREE.Mesh(headGeo, headMat);
    headMesh.position.y = 3.1;
    playerGroup.add(headMesh);

    spectatorScene.add(playerGroup);
    botTargetMesh = playerGroup;

    function renderSpectatorLoop() {
        requestAnimationFrame(renderSpectatorLoop);
        if (spectatorRenderer && spectatorScene && spectatorCamera) {
            spectatorRenderer.render(spectatorScene, spectatorCamera);
        }
    }
    renderSpectatorLoop();
}

function initPlayerTracker() {
    initSpectatorViewport();

    const gridEl = document.getElementById('players-cards-grid');
    const countEl = document.getElementById('online-player-count');

    const botStatusEl = document.getElementById('bot-connection-status');
    const botTargetEl = document.getElementById('bot-spectate-target');
    const hudTargetName = document.getElementById('hud-bot-target-name');

    const hudX = document.getElementById('hud-bot-x');
    const hudY = document.getElementById('hud-bot-y');
    const hudZ = document.getElementById('hud-bot-z');

    const btnRefresh = document.getElementById('btn-refresh-players');
    const btnUnspectate = document.getElementById('btn-bot-unspectate');

    async function fetchPlayers() {
        try {
            const res = await fetch('/api/world/players');
            const players = await res.json();
            renderPlayerCards(players);
        } catch (e) {}
    }

    function renderPlayerCards(players) {
        if (countEl) countEl.textContent = players.length;
        if (!gridEl) return;

        if (players.length === 0) {
            gridEl.innerHTML = `<div class="empty-state">No players currently logged in</div>`;
            return;
        }

        gridEl.innerHTML = '';
        players.forEach(p => {
            const card = document.createElement('div');
            card.className = 'player-card';

            const x = typeof p.x === 'number' ? p.x.toFixed(1) : p.x;
            const y = typeof p.y === 'number' ? p.y.toFixed(1) : p.y;
            const z = typeof p.z === 'number' ? p.z.toFixed(1) : p.z;

            card.innerHTML = `
                <div class="player-info">
                    <div class="player-name">${p.name}</div>
                    <div class="player-coords">X: ${x} | Y: ${y} | Z: ${z}</div>
                </div>
                <button class="btn btn-primary btn-sm btn-spectate-player" data-player="${p.name}">
                    Spectate Player
                </button>
            `;
            gridEl.appendChild(card);
        });

        document.querySelectorAll('.btn-spectate-player').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const name = e.target.getAttribute('data-player');
                if (name) {
                    socket.emit('spectate-player', name);
                }
            });
        });
    }

    const btnReconnect = document.getElementById('btn-bot-reconnect');
    if (btnRefresh) btnRefresh.addEventListener('click', fetchPlayers);
    if (btnReconnect) btnReconnect.addEventListener('click', () => {
        socket.emit('connect-bot');
    });
    if (btnUnspectate) btnUnspectate.addEventListener('click', () => {
        socket.emit('stop-spectating');
    });


    socket.on('bot-pos-update', (data) => {
        const isOnline = data.connected;
        if (botStatusEl) {
            botStatusEl.textContent = isOnline ? 'Active / Online' : 'Offline';
            botStatusEl.className = isOnline ? 'status-online' : 'status-offline';
        }
        if (botTargetEl) {
            botTargetEl.textContent = data.targetPlayer ? data.targetPlayer : 'None';
        }
        if (hudTargetName) {
            hudTargetName.textContent = data.targetPlayer ? data.targetPlayer.toUpperCase() : 'NONE';
        }

        if (data.pos) {
            const x = parseFloat(data.pos.x || 0);
            const y = parseFloat(data.pos.y || 70);
            const z = parseFloat(data.pos.z || 0);

            if (hudX) hudX.textContent = x.toFixed(1);
            if (hudY) hudY.textContent = y.toFixed(1);
            if (hudZ) hudZ.textContent = z.toFixed(1);

            if (botTargetMesh) {
                botTargetMesh.position.set(x, y, z);
            }

            if (data.povVoxels && Array.isArray(data.povVoxels)) {
                renderSpectatorPOVVoxels(data.povVoxels);
            }

            if (spectatorCamera) {
                // First-person spectator POV view inside player target
                spectatorCamera.position.set(x, y + 1.62, z);

                if (data.pos.yaw !== undefined && data.pos.pitch !== undefined) {
                    spectatorCamera.rotation.set(-data.pos.pitch, -data.pos.yaw, 0, 'YXZ');
                } else {
                    spectatorCamera.lookAt(x, y + 1.6, z - 5);
                }
            }
        }
    });

    fetchPlayers();
    setInterval(fetchPlayers, 2000);
}

let spectatorInstancedMesh = null;

function renderSpectatorPOVVoxels(voxels) {
    if (!spectatorScene) return;

    if (voxels.length === 0) {
        if (spectatorInstancedMesh) spectatorInstancedMesh.count = 0;
        return;
    }

    if (!spectatorInstancedMesh || spectatorInstancedMesh.instanceMatrix.array.length < voxels.length * 16) {
        if (spectatorInstancedMesh) {
            spectatorScene.remove(spectatorInstancedMesh);
            spectatorInstancedMesh.geometry.dispose();
            spectatorInstancedMesh.material.dispose();
        }

        const geometry = new THREE.BoxGeometry(0.98, 0.98, 0.98);
        const material = new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.1 });
        spectatorInstancedMesh = new THREE.InstancedMesh(geometry, material, Math.max(voxels.length, 5000));
        spectatorScene.add(spectatorInstancedMesh);
    }

    spectatorInstancedMesh.count = voxels.length;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    voxels.forEach((v, i) => {
        dummy.position.set(v.x, v.y, v.z);
        dummy.updateMatrix();
        spectatorInstancedMesh.setMatrixAt(i, dummy.matrix);

        const hex = getBlockColor(v.type);
        color.setHex(hex);
        spectatorInstancedMesh.setColorAt(i, color);
    });

    spectatorInstancedMesh.instanceMatrix.needsUpdate = true;
    if (spectatorInstancedMesh.instanceColor) spectatorInstancedMesh.instanceColor.needsUpdate = true;
}


// Initial Setup Calls
initCommandGenerator();
initPlayerTracker();
loadSettings();
initModsManager();

// ==========================================
// Mods Manager Logic
// ==========================================
let allInstalledMods = [];

function showModAlert(msg, type = 'success') {
    const alertBox = document.getElementById('mod-alert');
    if (!alertBox) return;
    alertBox.className = `alert alert-${type}`;
    alertBox.textContent = msg;
    alertBox.classList.remove('hidden');
    setTimeout(() => {
        alertBox.classList.add('hidden');
    }, 4000);
}

async function loadMods() {
    const listContainer = document.getElementById('mods-list');
    const countEl = document.getElementById('mod-count');
    if (!listContainer) return;

    listContainer.innerHTML = '<div class="empty-state">Loading installed mods...</div>';

    try {
        const res = await fetch('/api/mods');
        const data = await res.json();
        allInstalledMods = data.mods || [];
        if (countEl) countEl.textContent = allInstalledMods.length;
        renderModsList(allInstalledMods);
    } catch (err) {
        listContainer.innerHTML = `<div class="empty-state" style="color: #ef4444;">Failed to load mods: ${err.message}</div>`;
    }
}

function renderModsList(mods) {
    const listContainer = document.getElementById('mods-list');
    if (!listContainer) return;

    if (!mods || mods.length === 0) {
        listContainer.innerHTML = `
            <div class="empty-state">
                <p>No Fabric mods installed yet.</p>
                <p style="font-size: 0.8rem; margin-top: 0.5rem; color: var(--text-muted);">Drop <code>.jar</code> mod files into the box above or click "+ Upload .jar" to install!</p>
            </div>
        `;
        return;
    }

    listContainer.innerHTML = mods.map(mod => `
        <div class="mod-item" data-filename="${mod.name}">
            <div class="mod-info">
                <div class="mod-icon">📦</div>
                <div class="mod-details">
                    <div class="mod-title">${escapeHtml(mod.displayName)}</div>
                    <div class="mod-meta">
                        <span class="mod-badge ${mod.enabled ? 'enabled' : 'disabled'}">${mod.enabled ? 'Enabled' : 'Disabled'}</span>
                        <span>${mod.formattedSize}</span>
                        <span>Modified: ${new Date(mod.mtime).toLocaleDateString()}</span>
                    </div>
                </div>
            </div>
            <div class="mod-actions">
                <button class="btn-mod-toggle" onclick="toggleMod('${escapeHtml(mod.name)}')">
                    ${mod.enabled ? 'Disable' : 'Enable'}
                </button>
                <button class="btn-mod-delete" onclick="deleteMod('${escapeHtml(mod.name)}')">
                    Delete
                </button>
            </div>
        </div>
    `).join('');
}

async function uploadFiles(files) {
    if (!files || files.length === 0) return;
    showModAlert(`Uploading ${files.length} mod(s)...`, 'info');

    let successCount = 0;
    let failCount = 0;

    for (const file of files) {
        if (!file.name.endsWith('.jar') && !file.name.endsWith('.jar.disabled')) {
            showModAlert(`Skipped '${file.name}': Only .jar files are supported.`, 'danger');
            continue;
        }

        try {
            const res = await fetch('/api/mods/upload', {
                method: 'POST',
                headers: {
                    'X-Filename': encodeURIComponent(file.name),
                    'Content-Type': 'application/octet-stream'
                },
                body: file
            });
            const data = await res.json();
            if (data.success) {
                successCount++;
            } else {
                failCount++;
                showModAlert(`Failed uploading ${file.name}: ${data.error}`, 'danger');
            }
        } catch (e) {
            failCount++;
            showModAlert(`Upload error for ${file.name}: ${e.message}`, 'danger');
        }
    }

    if (successCount > 0) {
        showModAlert(`Successfully installed ${successCount} mod(s)! Restart server to apply.`, 'success');
        loadMods();
    }
}

async function deleteMod(name) {
    if (!confirm(`Are you sure you want to delete '${name}'?`)) return;

    try {
        const res = await fetch(`/api/mods/${encodeURIComponent(name)}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            showModAlert(`Removed ${name}`, 'success');
            loadMods();
        } else {
            showModAlert(`Error: ${data.error}`, 'danger');
        }
    } catch (e) {
        showModAlert(`Failed to delete: ${e.message}`, 'danger');
    }
}

async function toggleMod(name) {
    try {
        const res = await fetch('/api/mods/toggle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        const data = await res.json();
        if (data.success) {
            showModAlert(`Mod is now ${data.enabled ? 'Enabled' : 'Disabled'}. Restart server to apply.`, 'success');
            loadMods();
        } else {
            showModAlert(`Error: ${data.error}`, 'danger');
        }
    } catch (e) {
        showModAlert(`Failed to toggle: ${e.message}`, 'danger');
    }
}

function initModsManager() {
    const fileInput = document.getElementById('mod-file-input');
    const dropzone = document.getElementById('mod-dropzone');
    const refreshBtn = document.getElementById('btn-refresh-mods');
    const searchInput = document.getElementById('mod-search');

    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            uploadFiles(e.target.files);
            fileInput.value = '';
        });
    }

    if (dropzone) {
        dropzone.addEventListener('click', () => {
            if (fileInput) fileInput.click();
        });

        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('dragover');
        });

        dropzone.addEventListener('dragleave', () => {
            dropzone.classList.remove('dragover');
        });

        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('dragover');
            if (e.dataTransfer && e.dataTransfer.files) {
                uploadFiles(e.dataTransfer.files);
            }
        });
    }

    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadMods);
    }

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            if (!query) {
                renderModsList(allInstalledMods);
            } else {
                const filtered = allInstalledMods.filter(m => 
                    m.displayName.toLowerCase().includes(query) || m.name.toLowerCase().includes(query)
                );
                renderModsList(filtered);
            }
        });
    }
}



