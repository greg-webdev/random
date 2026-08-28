const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3838;
const DATA_FILE = path.join(__dirname, 'user_apps.json');
const PRESETS_FILE = path.join(__dirname, 'presets.json');

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Store active running processes
const activeProcesses = new Map();

// Helper: load presets
function getPresets() {
  try {
    if (fs.existsSync(PRESETS_FILE)) {
      return JSON.parse(fs.readFileSync(PRESETS_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Error reading presets:', e);
  }
  return [];
}

// Helper: load user apps
function getUserApps() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Error reading user_apps.json:', e);
  }
  return [];
}

// Helper: save user apps
function saveUserApps(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// API Routes
app.get('/api/presets', (req, res) => {
  res.json(getPresets());
});

app.get('/api/apps', (req, res) => {
  const userApps = getUserApps();
  const presets = getPresets();
  res.json({ presets, userApps });
});

app.post('/api/apps', (req, res) => {
  try {
    const { apps } = req.body;
    saveUserApps(apps);
    res.json({ success: true, count: apps.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// System info endpoint
app.get('/api/system', (req, res) => {
  res.json({
    platform: os.platform(),
    release: os.release(),
    arch: os.arch(),
    cpus: os.cpus().length,
    totalMemGB: (os.totalmem() / 1024 / 1024 / 1024).toFixed(2),
    freeMemGB: (os.freemem() / 1024 / 1024 / 1024).toFixed(2),
    uptimeHours: (os.uptime() / 3600).toFixed(1),
    hostname: os.hostname(),
    username: os.userInfo().username
  });
});

// Standalone Executable Script Exporter
app.post('/api/export', (req, res) => {
  const { button, format } = req.body;
  if (!button) {
    return res.status(400).json({ error: 'Button definition required' });
  }

  const { name, command, type, inputs = [] } = button;

  if (format === 'bat') {
    let script = `@echo off\n:: AppCraft Standalone Executable Batch Script: ${name}\n`;
    script += `title ${name} - AppCraft Launcher\ncolor 0A\necho ============================================\necho   AppCraft Executable App: ${name}\necho ============================================\necho.\n\n`;

    // Prompt for inputs if defined
    inputs.forEach((inp) => {
      script += `set /p "${inp.id}=Enter ${inp.label} [Default: ${inp.default || ''}]: "\n`;
      script += `if "%${inp.id}%"=="" set "${inp.id}=${inp.default || ''}"\n\n`;
    });

    let execCmd = command;
    inputs.forEach((inp) => {
      const reg = new RegExp(`{{\\s*${inp.id}\\s*}}`, 'g');
      execCmd = execCmd.replace(reg, `%${inp.id}%`);
    });

    script += `echo Executing command...\necho --------------------------------------------\n`;

    if (type === 'powershell') {
      script += `powershell -NoProfile -ExecutionPolicy Bypass -Command "${execCmd.replace(/"/g, '""')}"\n`;
    } else if (type === 'node') {
      const escapedNode = execCmd.replace(/"/g, '\\"').replace(/\n/g, ' ');
      script += `node -e "${escapedNode}"\n`;
    } else {
      script += `${execCmd}\n`;
    }

    script += `\necho.\necho --------------------------------------------\necho Command finished with exit code %ERRORLEVEL%.\npause\n`;

    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="${name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.bat"`);
    return res.send(script);
  }

  if (format === 'ps1') {
    let script = `# AppCraft Standalone PowerShell App: ${name}\n`;
    script += `[CmdletBinding()]\nParam()\n\n`;
    script += `Write-Host "============================================" -ForegroundColor Cyan\n`;
    script += `Write-Host "  AppCraft Executable: ${name}" -ForegroundColor Yellow\n`;
    script += `Write-Host "============================================" -ForegroundColor Cyan\n\n`;

    inputs.forEach((inp) => {
      script += `$input_${inp.id} = Read-Host "Enter ${inp.label} [Default: ${inp.default || ''}]"\n`;
      script += `if ([string]::IsNullOrWhiteSpace($input_${inp.id})) { $input_${inp.id} = "${inp.default || ''}" }\n\n`;
    });

    let execCmd = command;
    inputs.forEach((inp) => {
      const reg = new RegExp(`{{\\s*${inp.id}\\s*}}`, 'g');
      execCmd = execCmd.replace(reg, `$input_${inp.id}`);
    });

    script += `Write-Host "Executing..." -ForegroundColor Gray\n`;
    script += `Write-Host "--------------------------------------------" -ForegroundColor DarkGray\n\n`;

    if (type === 'node') {
      script += `$code = @"\n${command}\n"@\n`;
      inputs.forEach((inp) => {
        script += `$code = $code.Replace("{{${inp.id}}}", $input_${inp.id})\n`;
      });
      script += `node -e $code\n`;
    } else {
      script += `Invoke-Expression @"\n${execCmd}\n"@\n`;
    }

    script += `\nWrite-Host "--------------------------------------------" -ForegroundColor DarkGray\n`;
    script += `Write-Host "Execution completed." -ForegroundColor Green\n`;
    script += `Read-Host "Press Enter to exit..."\n`;

    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="${name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.ps1"`);
    return res.send(script);
  }

  return res.status(400).json({ error: 'Unsupported format' });
});

// WebSocket Handler for Real-time Execution & Log Streaming
wss.on('connection', (ws) => {
  let currentProcess = null;

  ws.on('message', (messageStr) => {
    try {
      const msg = JSON.parse(messageStr);

      if (msg.action === 'run') {
        if (currentProcess) {
          try { currentProcess.kill(); } catch (e) {}
        }

        const { type = 'powershell', command = '', inputs = {}, cwd } = msg;

        // Substitute inputs into command template
        let finalCommand = command;
        Object.keys(inputs).forEach((key) => {
          const reg = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
          finalCommand = finalCommand.replace(reg, inputs[key]);
        });

        ws.send(JSON.stringify({ type: 'start', command: finalCommand }));

        let spawnCmd = 'powershell.exe';
        let spawnArgs = [];

        const workDir = cwd || process.cwd();

        if (type === 'cmd') {
          spawnCmd = 'cmd.exe';
          spawnArgs = ['/c', finalCommand];
        } else if (type === 'powershell') {
          spawnCmd = 'powershell.exe';
          spawnArgs = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', finalCommand];
        } else if (type === 'node') {
          spawnCmd = 'node';
          spawnArgs = ['-e', finalCommand];
        } else if (type === 'python') {
          spawnCmd = 'python';
          spawnArgs = ['-c', finalCommand];
        } else if (type === 'bash') {
          spawnCmd = 'bash';
          spawnArgs = ['-c', finalCommand];
        }

        const proc = spawn(spawnCmd, spawnArgs, {
          cwd: workDir,
          env: { ...process.env, FORCE_COLOR: '1' },
          shell: false
        });

        currentProcess = proc;
        activeProcesses.set(proc.pid, proc);

        ws.send(JSON.stringify({ type: 'pid', pid: proc.pid }));

        proc.stdout.on('data', (data) => {
          ws.send(JSON.stringify({ type: 'stdout', data: data.toString() }));
        });

        proc.stderr.on('data', (data) => {
          ws.send(JSON.stringify({ type: 'stderr', data: data.toString() }));
        });

        proc.on('error', (err) => {
          ws.send(JSON.stringify({ type: 'error', data: err.message }));
        });

        proc.on('close', (code) => {
          activeProcesses.delete(proc.pid);
          ws.send(JSON.stringify({ type: 'exit', code: code !== null ? code : -1 }));
          currentProcess = null;
        });
      }

      if (msg.action === 'kill') {
        if (currentProcess) {
          currentProcess.kill('SIGTERM');
          ws.send(JSON.stringify({ type: 'stdout', data: '\n[AppCraft Process Terminated by User]\n' }));
        }
      }
    } catch (err) {
      ws.send(JSON.stringify({ type: 'error', data: `Invalid WS message: ${err.message}` }));
    }
  });

  ws.on('close', () => {
    if (currentProcess) {
      try { currentProcess.kill(); } catch (e) {}
    }
  });
});

server.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(` AppCraft Studio running at http://localhost:${PORT}`);
  console.log(`=================================================`);
});
