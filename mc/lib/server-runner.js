const path = require('path');
const os = require('os');
const fs = require('fs-extra');
const { spawn, execSync } = require('child_process');

const MCS_DIR = path.join(os.homedir(), 'Documents', 'mcserver');
const JAR_PATH = path.join(MCS_DIR, 'fabric-server.jar');

let serverProcess = null;

function getRunningServerPid() {
  if (serverProcess && serverProcess.pid) {
    return serverProcess.pid;
  }
  try {
    if (process.platform === 'win32') {
      const output = execSync('wmic process where "name=\'java.exe\' and commandline like \'%fabric-server.jar%\'" get ProcessId', {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore']
      });
      const lines = output.trim().split(/\r?\n/).map(l => l.trim()).filter(l => /^\d+$/.test(l));
      if (lines.length > 0) {
        return parseInt(lines[0], 10);
      }
    }
  } catch (e) {}
  return null;
}

function killOrphanedServerProcess() {
  try {
    if (process.platform === 'win32') {
      execSync('wmic process where "name=\'java.exe\' and commandline like \'%fabric-server.jar%\'" call terminate', {
        stdio: 'ignore'
      });
    }
  } catch (e) {}
}

function removeStaleSessionLock() {
  try {
    const lockPath = path.join(MCS_DIR, 'world', 'session.lock');
    if (fs.existsSync(lockPath)) {
      fs.removeSync(lockPath);
    }
  } catch (e) {}
}

function getServerStatus() {
  const pid = getRunningServerPid();
  return {
    online: pid !== null,
    pid: pid,
    dir: MCS_DIR
  };
}

function killProcessOnPort(port) {
  try {
    if (process.platform === 'win32') {
      const portOut = execSync(`powershell -NoProfile -Command "(Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue).OwningProcess"`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
      const pids = portOut.trim().split(/\r?\n/).map(p => p.trim()).filter(p => /^\d+$/.test(p) && p !== '0' && p !== String(process.pid));
      for (const pid of pids) {
        try { execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' }); } catch (e) {}
      }
    }
  } catch (e) {}
}

function startMinecraftServer(onLog, onStatus) {
  // 1. Terminate any previous orphaned instances holding port 25565 or session.lock
  killProcessOnPort(25565);
  killOrphanedServerProcess();

  // 2. Remove stale session.lock if left by a crashed process
  removeStaleSessionLock();

  const javaPath = 'C:\\Program Files\\Java\\jdk-21\\bin\\java.exe';
  const effectiveJava = fs.existsSync(javaPath) ? javaPath : 'java';

  if (!fs.existsSync(JAR_PATH)) {
    throw new Error(`fabric-server.jar not found at ${JAR_PATH}`);
  }

  // Ensure eula.txt exists and is accepted
  const eulaPath = path.join(MCS_DIR, 'eula.txt');
  fs.writeFileSync(eulaPath, 'eula=true\n', 'utf8');

  // Spawn directly without shell wrapper to ensure clean termination
  serverProcess = spawn(effectiveJava, ['-Xms1024M', '-Xmx2048M', '-jar', 'fabric-server.jar', 'nogui'], {
    cwd: MCS_DIR,
    stdio: ['pipe', 'pipe', 'pipe']
  });

  if (onStatus) onStatus(getServerStatus());
  if (onLog) onLog({ type: 'sys', text: `[Server] Starting Fabric Minecraft Server 1.21.11 (Java 21)...` });

  serverProcess.stdout.on('data', (data) => {
    const text = data.toString();
    if (onLog) onLog({ type: 'server', text });
  });

  serverProcess.stderr.on('data', (data) => {
    const text = data.toString();
    if (onLog) onLog({ type: 'server-err', text });
  });

  serverProcess.on('close', (code) => {
    serverProcess = null;
    if (onStatus) onStatus(getServerStatus());
    if (onLog) onLog({ type: 'sys', text: `[Server] Process exited with code ${code}` });
  });

  serverProcess.on('error', (err) => {
    serverProcess = null;
    if (onStatus) onStatus(getServerStatus());
    if (onLog) onLog({ type: 'err', text: `[Server Error] ${err.message}` });
  });

  return getServerStatus();
}

function stopMinecraftServer() {
  if (serverProcess) {
    try {
      serverProcess.stdin.write('stop\n');
    } catch (e) {}
    setTimeout(() => {
      try { if (serverProcess) serverProcess.kill(); } catch (err) {}
      serverProcess = null;
    }, 1500);
  }
  // Ensure OS-level cleanup
  killOrphanedServerProcess();
  removeStaleSessionLock();
  return true;
}

function sendServerCommand(cmd) {
  if (!serverProcess) return false;
  serverProcess.stdin.write(cmd + '\n');
  return true;
}

// Clean up child process when parent launcher exits
process.on('exit', () => {
  if (serverProcess) {
    try { serverProcess.kill(); } catch (e) {}
  }
});

process.on('SIGINT', () => {
  if (serverProcess) {
    try { serverProcess.kill(); } catch (e) {}
  }
});

module.exports = {
  getServerStatus,
  startMinecraftServer,
  stopMinecraftServer,
  sendServerCommand,
  MCS_DIR
};
