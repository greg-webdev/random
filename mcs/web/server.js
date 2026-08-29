const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const proxy = require('express-http-proxy');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 3000;
const MCS_DIR = process.env.MCS_DIR || path.join(os.homedir(), 'Documents', 'mcserver');
const SERVER_PROPS_PATH = path.join(MCS_DIR, 'server.properties');
const JAR_PATH = path.join(MCS_DIR, 'fabric-server.jar');

let mcProcess = null;
let logHistory = [];
const MAX_LOGS = 1000;

app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, PATCH, DELETE");
    res.setHeader("Access-Control-Allow-Headers", "*");
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf'
};

app.get('/favicon.ico', (req, res) => res.status(204).end());
app.all('/.well-known/*', (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.status(200).json({});
});

app.use('/viewer', proxy('http://localhost:3001', {
    proxyReqPathResolver: function (req) {
        return req.url;
    },
    proxyErrorHandler: function (err, res, next) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.status(200).send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <style>
                    body { margin: 0; background: #0b0f19; color: #8892b0; font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; text-align: center; }
                    .box { padding: 24px; border: 1px dashed rgba(255,255,255,0.15); border-radius: 8px; max-width: 320px; background: rgba(0,0,0,0.5); }
                    .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #eab308; margin-right: 6px; }
                    h4 { margin: 0 0 6px 0; color: #ffffff; font-size: 14px; }
                    p { margin: 0; font-size: 12px; color: #94a3b8; line-height: 1.4; }
                </style>
            </head>
            <body>
                <div class="box">
                    <h4><span class="dot"></span> 3D Camera Offline</h4>
                    <p>Start the server to activate the live 3D spectator camera view.</p>
                </div>
            </body>
            </html>
        `);
    }
}));
app.use(express.json());

app.get('/', (req, res) => {
    try {
        const filePath = path.join(PUBLIC_DIR, 'index.html');
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send(fs.readFileSync(filePath, 'utf-8'));
    } catch (e) {
        res.status(500).send('Error loading dashboard: ' + e.message);
    }
});

app.get('/launcher.html', (req, res) => {
    try {
        const filePath = path.join(PUBLIC_DIR, 'launcher.html');
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send(fs.readFileSync(filePath, 'utf-8'));
    } catch (e) {
        res.status(500).send('Error loading launcher: ' + e.message);
    }
});

app.get('/index.html', (req, res) => {
    try {
        const filePath = path.join(PUBLIC_DIR, 'index.html');
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send(fs.readFileSync(filePath, 'utf-8'));
    } catch (e) {
        res.status(500).send('Error loading index: ' + e.message);
    }
});

// PKG virtual snapshot compatible static file serving
app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        return next();
    }
    const cleanPath = req.path === '/' ? '/index.html' : req.path;
    const filePath = path.join(PUBLIC_DIR, cleanPath);
    try {
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            const ext = path.extname(filePath).toLowerCase();
            const contentType = MIME_TYPES[ext] || 'application/octet-stream';
            res.setHeader('Content-Type', contentType);
            return res.send(fs.readFileSync(filePath));
        }
    } catch (e) {}
    next();
});

app.use(express.static(PUBLIC_DIR));


function addLog(data) {
    const text = data.toString();
    logHistory.push(text);
    if (logHistory.length > MAX_LOGS) logHistory.shift();
    parsePlayerPositionsFromLogs(text);
    io.emit('console-log', text);
}

// Initial log parse on backend startup to detect active players
const latestLogPath = path.join(MCS_DIR, 'logs', 'latest.log');
if (fs.existsSync(latestLogPath)) {
    try {
        const existingLogs = fs.readFileSync(latestLogPath, 'utf-8');
        parsePlayerPositionsFromLogs(existingLogs);
    } catch (e) {}
}



// Parse server.properties file
function parseProperties() {
    if (!fs.existsSync(SERVER_PROPS_PATH)) return {};
    const content = fs.readFileSync(SERVER_PROPS_PATH, 'utf-8');
    const lines = content.split(/\r?\n/);
    const props = {};
    lines.forEach(line => {
        line = line.trim();
        if (line && !line.startsWith('#')) {
            const parts = line.split('=');
            const key = parts[0].trim();
            const val = parts.slice(1).join('=').trim();
            props[key] = val;
        }
    });
    return props;
}

// Save server.properties file
function saveProperties(newProps) {
    let content = '#Minecraft server properties\n';
    for (const [key, val] of Object.entries(newProps)) {
        content += `${key}=${val}\n`;
    }
    fs.writeFileSync(SERVER_PROPS_PATH, content, 'utf-8');
}

// Launcher API Routes
const USER_DOCUMENTS = path.join(os.homedir(), 'Documents');
const TARGET_DIR = path.join(USER_DOCUMENTS, 'mcserver');

app.get('/api/launcher-status', (req, res) => {
    const exists = fs.existsSync(TARGET_DIR) && fs.existsSync(path.join(TARGET_DIR, 'fabric-server.jar'));
    res.json({
        exists,
        targetDir: TARGET_DIR
    });
});

app.post('/api/reinstall', (req, res) => {
    try {
        const fsExtra = require('fs-extra');
        if (fs.existsSync(TARGET_DIR)) {
            const items = fs.readdirSync(TARGET_DIR);
            for (const item of items) {
                if (item.toLowerCase() === 'mods') continue;
                fsExtra.removeSync(path.join(TARGET_DIR, item));
            }
        }
        fsExtra.ensureDirSync(TARGET_DIR);
        const templateDir = path.join(__dirname, 'server_template');
        if (fs.existsSync(templateDir)) {
            fsExtra.copySync(templateDir, TARGET_DIR, {
                filter: (src) => path.basename(src).toLowerCase() !== 'mods'
            });
        }
        fsExtra.ensureDirSync(path.join(TARGET_DIR, 'mods'));
        res.json({ success: true, message: 'Server unpacked successfully!' });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/api/launch', (req, res) => {
    res.json({ success: true, message: 'Server launched!' });
});

// API Routes
app.get('/api/status', (req, res) => {

    res.json({
        online: mcProcess !== null,
        pid: mcProcess ? mcProcess.pid : null,
        systemCpu: (os.loadavg()[0] || 0).toFixed(2),
        totalMem: (os.totalmem() / 1024 / 1024 / 1024).toFixed(2) + ' GB',
        freeMem: (os.freemem() / 1024 / 1024 / 1024).toFixed(2) + ' GB'
    });
});

const { parseMCAFile } = require('./mca_parser');

let cachedVoxels = null;
let lastCacheTime = 0;

// Read real MCA region files from world/region
async function getRealWorldVoxels() {
    const now = Date.now();
    // Cache world voxels for 10 seconds to keep server snappy
    if (cachedVoxels && (now - lastCacheTime < 10000)) {
        return cachedVoxels;
    }

    const regionDir = path.join(MCS_DIR, 'world', 'region');
    let voxels = [];

    if (fs.existsSync(regionDir)) {
        const files = fs.readdirSync(regionDir).filter(f => f.endsWith('.mca'));
        // Parse up to 4 most recently modified region files
        const sortedFiles = files.map(f => ({
            name: f,
            mtime: fs.statSync(path.join(regionDir, f)).mtimeMs
        })).sort((a, b) => b.mtime - a.mtime).slice(0, 4);

        for (const fileObj of sortedFiles) {
            try {
                const fileVoxels = await parseMCAFile(path.join(regionDir, fileObj.name));
                voxels = voxels.concat(fileVoxels);
            } catch (e) {
                console.error(`Error parsing region file ${fileObj.name}:`, e);
            }
        }
    }

    cachedVoxels = voxels;
    lastCacheTime = now;
    return voxels;
}


let activePlayers = {};

function parsePlayerPositionsFromLogs(logText) {
    const lines = logText.split(/\r?\n/);
    lines.forEach(line => {
        // Auto-connect Mineflayer Spectator Bot once server finishes boot
        if (line.includes('Done (') && line.includes('For help, type "help"')) {
            setTimeout(() => {
                if (mcProcess && mcProcess.stdin) {
                    spectatorBot.start((cmd) => mcProcess.stdin.write(cmd), app, server);
                }
            }, 3000);
        }


        const joinMatch = line.match(/(\w+)\[\/[\d\.:]+\] logged in with entity id \d+ at \(([-\d\.]+),\s*([-\d\.]+),\s*([-\d\.]+)\)/);
        if (joinMatch) {
            const name = joinMatch[1];
            if (name !== 'WebMapBot' && name !== 'WebSpectatorBot') {
                const x = parseFloat(joinMatch[2]);
                const y = parseFloat(joinMatch[3]);
                const z = parseFloat(joinMatch[4]);
                activePlayers[name] = { name, x, y, z, lastSeen: Date.now() };
            }
        }


        const tpMatch = line.match(/Teleported (\w+) to ([-\d\.]+),\s*([-\d\.]+),\s*([-\d\.]+)/i) || line.match(/(\w+) has been teleported to ([-\d\.]+),\s*([-\d\.]+),\s*([-\d\.]+)/i);
        if (tpMatch) {
            const name = tpMatch[1];
            if (name !== 'WebMapBot') {
                activePlayers[name] = {
                    name,
                    x: parseFloat(tpMatch[2]),
                    y: parseFloat(tpMatch[3]),
                    z: parseFloat(tpMatch[4]),
                    lastSeen: Date.now()
                };
            }
        }

        const posMatch = line.match(/\[(\w+):\s*(?:has the following entity data|Position:)\s*([-\d\.]+)[dD]?,\s*([-\d\.]+)[dD]?,\s*([-\d\.]+)[dD]?/i);
        if (posMatch) {
            const name = posMatch[1];
            if (name !== 'WebMapBot') {
                activePlayers[name] = {
                    name,
                    x: parseFloat(posMatch[2]),
                    y: parseFloat(posMatch[3]),
                    z: parseFloat(posMatch[4]),
                    lastSeen: Date.now()
                };
            }
        }

        const leaveMatch = line.match(/(\w+) left the game/);
        if (leaveMatch) {
            delete activePlayers[leaveMatch[1]];
        }
    });
}

// 3D World Voxel Chunk API
app.get('/api/world/voxels', async (req, res) => {
    try {
        const voxels = await getRealWorldVoxels();
        res.json({
            totalVoxels: voxels.length,
            spawn: { x: 0, y: 70, z: 0 },
            players: Object.values(activePlayers),
            voxels
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});



app.get('/api/world/players', (req, res) => {
    res.json(Object.values(activePlayers));
});



app.get('/api/settings', (req, res) => {
    res.json(parseProperties());
});

app.post('/api/settings', (req, res) => {
    try {
        saveProperties(req.body);
        res.json({ success: true, message: 'Settings saved successfully!' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Helper for file sizes
function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Mods Management API
app.get('/api/mods', (req, res) => {
    try {
        const modsDir = path.join(MCS_DIR, 'mods');
        if (!fs.existsSync(modsDir)) {
            fs.mkdirSync(modsDir, { recursive: true });
        }
        const entries = fs.readdirSync(modsDir, { withFileTypes: true });
        const mods = [];
        for (const entry of entries) {
            if (entry.isFile()) {
                const filePath = path.join(modsDir, entry.name);
                const stats = fs.statSync(filePath);
                const isJar = entry.name.endsWith('.jar');
                const isDisabled = entry.name.endsWith('.disabled');
                if (isJar || isDisabled) {
                    mods.push({
                        name: entry.name,
                        displayName: entry.name.replace(/\.disabled$/, ''),
                        size: stats.size,
                        formattedSize: formatBytes(stats.size),
                        mtime: stats.mtime,
                        enabled: isJar
                    });
                }
            }
        }
        mods.sort((a, b) => a.displayName.localeCompare(b.displayName));
        res.json({ mods, count: mods.length, modsDir });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/mods/upload', express.raw({ type: '*/*', limit: '200mb' }), (req, res) => {
    try {
        const rawFilename = req.headers['x-filename'] || req.query.name;
        if (!rawFilename) {
            return res.status(400).json({ error: 'No filename provided in X-Filename header.' });
        }
        const filename = decodeURIComponent(rawFilename);
        const safeName = path.basename(filename);
        if (!safeName.endsWith('.jar') && !safeName.endsWith('.jar.disabled')) {
            return res.status(400).json({ error: 'Only .jar files are supported as Minecraft mods.' });
        }
        if (!req.body || req.body.length === 0) {
            return res.status(400).json({ error: 'Empty file payload.' });
        }
        const modsDir = path.join(MCS_DIR, 'mods');
        if (!fs.existsSync(modsDir)) {
            fs.mkdirSync(modsDir, { recursive: true });
        }
        const targetPath = path.join(modsDir, safeName);
        fs.writeFileSync(targetPath, req.body);
        res.json({ success: true, message: `Successfully installed ${safeName}!`, filename: safeName });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.delete('/api/mods/:name', (req, res) => {
    try {
        const modName = path.basename(decodeURIComponent(req.params.name));
        const modsDir = path.join(MCS_DIR, 'mods');
        const targetPath = path.join(modsDir, modName);
        if (fs.existsSync(targetPath)) {
            fs.unlinkSync(targetPath);
            res.json({ success: true, message: `Removed mod ${modName}` });
        } else {
            res.status(404).json({ success: false, error: `Mod ${modName} not found.` });
        }
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/mods/toggle', (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: 'Missing mod name.' });
        const modName = path.basename(name);
        const modsDir = path.join(MCS_DIR, 'mods');
        const currentPath = path.join(modsDir, modName);

        if (!fs.existsSync(currentPath)) {
            return res.status(404).json({ error: 'Mod file not found.' });
        }

        let newName;
        if (modName.endsWith('.disabled')) {
            newName = modName.replace(/\.disabled$/, '');
        } else {
            newName = modName + '.disabled';
        }

        const newPath = path.join(modsDir, newName);
        fs.renameSync(currentPath, newPath);
        res.json({ success: true, oldName: modName, newName, enabled: !newName.endsWith('.disabled') });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

const CameraSpectatorBot = require('./spectator_bot');
const spectatorBot = new CameraSpectatorBot('localhost', 25565, 'WebSpectatorBot');

// Socket.io for Realtime Control & Logs
io.on('connection', (socket) => {
    // Send existing logs & status
    socket.emit('init-logs', logHistory);
    socket.emit('status-change', { online: mcProcess !== null });
    socket.emit('bot-status-update', {
        connected: spectatorBot.connected,
        targetPlayer: spectatorBot.targetPlayer,
        pos: spectatorBot.position
    });

    // 15 FPS (66ms) Realtime POV Stream socket broadcast
    const botPosTimer = setInterval(() => {
        const povBlocks = spectatorBot.getNearbyPOVBlocks(10);
        socket.emit('bot-pos-update', {
            connected: spectatorBot.connected,
            targetPlayer: spectatorBot.targetPlayer,
            pos: spectatorBot.position,
            povVoxels: povBlocks
        });
    }, 66);


    socket.on('disconnect', () => {
        clearInterval(botPosTimer);
    });


    socket.on('connect-bot', () => {
        if (!mcProcess) {
            socket.emit('console-log', '\n[System] Cannot connect bot: Server is offline.\n');
            return;
        }
        spectatorBot.start((cmd) => {
            if (mcProcess && mcProcess.stdin) {
                mcProcess.stdin.write(cmd);
            }
        }, app, server);
        io.emit('bot-status-update', {
            connected: spectatorBot.connected,
            targetPlayer: spectatorBot.targetPlayer,
            pos: spectatorBot.position
        });
    });

    socket.on('spectate-player', (targetPlayer) => {

        if (!mcProcess) {
            socket.emit('console-log', '\n[System] Cannot spectate: Server is offline.\n');
            return;
        }

        spectatorBot.start((cmd) => {
            if (mcProcess && mcProcess.stdin) {
                mcProcess.stdin.write(cmd);
            }
        }, app, server);
        spectatorBot.spectate(targetPlayer);


        io.emit('bot-status-update', {
            connected: true,
            targetPlayer: targetPlayer
        });
    });

    socket.on('stop-spectating', () => {
        spectatorBot.stopSpectating();
        io.emit('bot-status-update', {
            connected: spectatorBot.connected,
            targetPlayer: null
        });
    });

    socket.on('start-server', () => {
        if (mcProcess) {
            socket.emit('console-log', '\n[System] Server is already running!\n');
            return;
        }

        addLog('\n[System] Starting Minecraft Fabric Server 1.21.11 (Java 21)...\n');

        // Spawn Java Process
        mcProcess = spawn('C:\\Program Files\\Java\\jdk-21\\bin\\java.exe', ['-Xms1024M', '-Xmx2048M', '-jar', 'fabric-server.jar', 'nogui'], {
            cwd: MCS_DIR
        });

        io.emit('status-change', { online: true });

        mcProcess.stdout.on('data', (data) => {
            addLog(data);
        });

        mcProcess.stderr.on('data', (data) => {
            addLog(data);
        });

        mcProcess.on('close', (code) => {
            addLog(`\n[System] Minecraft server process exited with code ${code}\n`);
            mcProcess = null;
            io.emit('status-change', { online: false });
        });

        mcProcess.on('error', (err) => {
            addLog(`\n[System Error] Failed to launch server process: ${err.message}\n`);
            mcProcess = null;
            io.emit('status-change', { online: false });
        });
    });

    socket.on('stop-server', () => {
        if (!mcProcess) {
            socket.emit('console-log', '\n[System] Server is not running.\n');
            return;
        }
        addLog('\n[System] Sending stop command to server...\n');
        mcProcess.stdin.write('stop\n');
    });

    socket.on('send-command', (cmd) => {
        if (!mcProcess) {
            socket.emit('console-log', '\n[System] Server is offline. Cannot execute command.\n');
            return;
        }
        addLog(`> ${cmd}\n`);
        mcProcess.stdin.write(cmd + '\n');
    });
});


server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`\n[Error] Port ${PORT} is already in use by another process!`);
        console.error(`Please close any running server instance or node process and try again.\n`);
    } else {
        console.error('\n[Error] Server error:', err);
    }
});

server.listen(PORT, () => {
    console.log(`\n==================================================`);
    console.log(`🚀 Fabric Minecraft Server Web UI is running!`);
    console.log(`🌐 Open in browser: http://localhost:${PORT}`);
    console.log(`==================================================\n`);
});
