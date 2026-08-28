const path = require('path');
const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const formidable = require('formidable');
const fs = require('fs-extra');
const { exec } = require('child_process');

const { MODS_DIR, INSTANCE_DIR, ROAMING_MINECRAFT } = require('./lib/paths');
const { getModsList, toggleMod, deleteMod } = require('./lib/mods-manager');
const { getRoamingInfo, syncFromRoaming } = require('./lib/roaming-sync');
const { launchGame, killGame, getGameStatus, locateJava } = require('./lib/game-runner');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'launcher')));

// WebSocket connections for real-time log streaming & status broadcasts
const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  ws.send(JSON.stringify({ type: 'status', data: getGameStatus() }));

  ws.on('close', () => {
    clients.delete(ws);
  });
});

function broadcast(type, data) {
  const msg = JSON.stringify({ type, data });
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  }
}

// REST API Endpoints

// System & Game Status
app.get('/api/status', async (req, res) => {
  try {
    const javaPath = await locateJava();
    const roaming = await getRoamingInfo();
    const gameStatus = getGameStatus();
    res.json({
      success: true,
      game: gameStatus,
      javaPath,
      roaming,
      modsDir: MODS_DIR,
      instanceDir: INSTANCE_DIR
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Local Mods endpoints
app.get('/api/mods', async (req, res) => {
  try {
    const mods = await getModsList();
    res.json({ success: true, mods });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/mods/toggle', async (req, res) => {
  try {
    const { filename } = req.body;
    const result = await toggleMod(filename);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/mods/delete', async (req, res) => {
  try {
    const { filename } = req.body;
    const result = await deleteMod(filename);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/mods/upload', (req, res) => {
  const form = new formidable.IncomingForm({
    uploadDir: MODS_DIR,
    keepExtensions: true,
    multiples: true
  });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      return res.status(500).json({ success: false, error: err.message });
    }

    const uploadedFiles = Array.isArray(files.modFile) ? files.modFile : [files.modFile];
    const results = [];

    for (const file of uploadedFiles) {
      if (!file) continue;
      let targetName = file.originalFilename || file.newFilename;
      if (!targetName.endsWith('.jar') && !targetName.endsWith('.jar.disabled')) {
        targetName += '.jar';
      }
      const targetPath = path.join(MODS_DIR, targetName);
      await fs.move(file.filepath, targetPath, { overwrite: true });
      results.push(targetName);
    }

    res.json({ success: true, uploaded: results });
  });
});

app.post('/api/mods/open-folder', (req, res) => {
  exec(`start "" "${MODS_DIR}"`);
  res.json({ success: true });
});

app.post('/api/instance/open-folder', (req, res) => {
  exec(`start "" "${INSTANCE_DIR}"`);
  res.json({ success: true });
});

// Roaming .minecraft Endpoints
app.get('/api/roaming', async (req, res) => {
  try {
    const info = await getRoamingInfo();
    res.json({ success: true, info });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/roaming/sync', async (req, res) => {
  try {
    const { type, name } = req.body;
    const result = await syncFromRoaming(type, name);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Launch Game Endpoint
app.post('/api/launch', async (req, res) => {
  try {
    const config = req.body || {};
    
    // Launch game asynchronously with progress & log callbacks
    launchGame(
      config,
      (logEntry) => broadcast('log', logEntry),
      (statusEntry) => {
        broadcast('launchStatus', statusEntry);
        broadcast('status', getGameStatus());
      }
    ).then((result) => {
      broadcast('status', getGameStatus());
    }).catch((err) => {
      broadcast('log', { type: 'err', text: `[Launcher Error] ${err.message}` });
      broadcast('status', getGameStatus());
    });

    res.json({ success: true, message: 'Launch sequence initiated.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/kill', (req, res) => {
  const killed = killGame();
  broadcast('status', getGameStatus());
  res.json({ success: true, killed });
});

function startServer(initialPort = process.env.PORT || 3007) {
  return new Promise((resolve, reject) => {
    let currentPort = parseInt(initialPort, 10);

    const tryListen = (portToTry) => {
      const onError = (err) => {
        if (err.code === 'EADDRINUSE') {
          console.warn(`Port ${portToTry} in use, trying port ${portToTry + 1}...`);
          server.removeListener('error', onError);
          tryListen(portToTry + 1);
        } else {
          reject(err);
        }
      };

      server.once('error', onError);

      server.listen(portToTry, () => {
        server.removeListener('error', onError);
        console.log(`====================================================`);
        console.log(` Fabric 1.21.1 Minecraft Launcher Backend Ready`);
        console.log(` Interface running at: http://localhost:${portToTry}`);
        console.log(`====================================================`);
        resolve(portToTry);
      });
    };

    tryListen(currentPort);
  });
}

// Auto-start if executed directly via `node server.js`
if (require.main === module) {
  startServer();
}

module.exports = { startServer, app };


