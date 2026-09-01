const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const os = require('os');
const httpProxy = require('http-proxy');
const selfsigned = require('selfsigned');

const RELAY_PORT = 8080;
const RELAY_PROXY_PORT = 8609;
const VELOCITY_PORT = 25566;
const VELOCITY_PROXY_PORT = 8608;

// All paths relative to launcher directory
const MC_DIR = path.resolve(__dirname, '../minecraft-server');
const VELOCITY_JAR = path.join(MC_DIR, 'Velocity.jar');
const PLUGINS_DIR = path.join(MC_DIR, 'plugins');

// Plugins on the Velocity proxy
const VIAVERSION_JAR = path.join(PLUGINS_DIR, 'ViaVersion.jar');
const VIABACKWARDS_JAR = path.join(PLUGINS_DIR, 'ViaBackwards.jar');
const VIAREWIND_JAR = path.join(PLUGINS_DIR, 'ViaRewind.jar');
const EAGLER_PLUGIN = path.join(PLUGINS_DIR, 'EaglerXServer.jar');

// Mods folders on Fabric server (clean them to prevent crashes on Fabric!)
const FABRIC_MODS_DIR = path.resolve(__dirname, '../../mcs/mods');
const USER_MCS_MODS_DIR = path.join(os.homedir(), 'Documents', 'mcserver', 'mods');

const VELOCITY_URL = 'https://fill-data.papermc.io/v1/objects/b4e3164df5377346854dc6cb9e6a78022b1946ff69e89676313f5f6f1c6f0fb3/velocity-3.5.1-615.jar';
const VIAVERSION_URL = 'https://github.com/ViaVersion/ViaVersion/releases/download/5.11.0/ViaVersion-5.11.0.jar';
const VIABACKWARDS_URL = 'https://github.com/ViaVersion/ViaBackwards/releases/download/5.11.0/ViaBackwards-5.11.0.jar';
const VIAREWIND_URL = 'https://cdn.modrinth.com/data/TbHIxhx5/versions/r9d7WsYA/ViaRewind-4.1.3.jar';
const EAGLER_PLUGIN_URL = 'https://github.com/lax1dude/eaglerxserver/releases/download/v1.1.1/EaglerXServer.jar';

let relayProcess = null;
let velocityProcess = null;
let unifiedProxyServer = null;

function getJava21Executable() {
  const java21 = 'C:\\Program Files\\Java\\jdk-21\\bin\\java.exe';
  return fs.existsSync(java21) ? java21 : 'java';
}

function killOrphanedJavaProcess(pattern) {
  try {
    if (process.platform === 'win32') {
      execSync(`wmic process where "name='java.exe' and commandline like '%${pattern}%'" call terminate`, { stdio: 'ignore' });
    }
  } catch (e) {}
}

function getProxyStatus() {
  return {
    running: unifiedProxyServer !== null && velocityProcess !== null,
    port: process.env.PORT ? parseInt(process.env.PORT, 10) : VELOCITY_PROXY_PORT
  };
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const file = fs.createWriteStream(dest);
    const request = (targetUrl) => {
      https.get(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      }, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          return request(response.headers.location);
        }
        if (response.statusCode !== 200) {
          return reject(new Error(`Failed to download from ${targetUrl}: HTTP ${response.statusCode}`));
        }
        response.pipe(file);
        file.on('finish', () => {
          file.close(() => resolve());
        });
      }).on('error', (err) => {
        fs.unlink(dest, () => reject(err));
      });
    };
    request(url);
  });
}

function cleanObsoleteFabricMods(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const lowercaseName = file.toLowerCase();
    if (lowercaseName.startsWith('viafabric') || lowercaseName.startsWith('viaversion') || lowercaseName.startsWith('viabackwards')) {
      console.log(`Removing mod from Fabric server mods directory: ${file} (now managed by Velocity proxy)`);
      try {
        fs.unlinkSync(path.join(dir, file));
      } catch (err) {
        console.error(`Failed to remove mod ${file}:`, err.message);
      }
    }
  }
}

async function setupVelocityProxy() {
  console.log('Verifying Minecraft server proxy files (Velocity)...');
  
  if (!fs.existsSync(MC_DIR)) {
    fs.mkdirSync(MC_DIR, { recursive: true });
  }

  // 1. Clean up legacy BungeeCord files if present
  const oldBungee = path.join(MC_DIR, 'BungeeCord.jar');
  const oldBungeeConfig = path.join(MC_DIR, 'config.yml');
  if (fs.existsSync(oldBungee)) {
    try { fs.unlinkSync(oldBungee); } catch (e) {}
  }
  if (fs.existsSync(oldBungeeConfig)) {
    try { fs.unlinkSync(oldBungeeConfig); } catch (e) {}
  }

  const handleDownload = async (name, url, dest) => {
    if (fs.existsSync(dest)) return;
    try {
      console.log(`Downloading ${name}...`);
      await downloadFile(url, dest);
      console.log(`${name} downloaded successfully.`);
    } catch (err) {
      console.error(`\n[Network Block Warning] Failed to download ${name}: ${err.message}`);
      console.error(`If you are behind a firewall, please download the file manually:`);
      console.error(`URL:  ${url}`);
      console.error(`Save to: ${dest}\n`);
      if (!fs.existsSync(dest)) {
        throw new Error(`Missing required file ${name}. Please download it manually and place it at: ${dest}`);
      }
    }
  };

  await handleDownload('Velocity Proxy', VELOCITY_URL, VELOCITY_JAR);
  await handleDownload('ViaVersion', VIAVERSION_URL, VIAVERSION_JAR);
  await handleDownload('ViaBackwards', VIABACKWARDS_URL, VIABACKWARDS_JAR);
  await handleDownload('ViaRewind', VIAREWIND_URL, VIAREWIND_JAR);
  await handleDownload('EaglercraftXServer', EAGLER_PLUGIN_URL, EAGLER_PLUGIN);

  cleanObsoleteFabricMods(FABRIC_MODS_DIR);
  cleanObsoleteFabricMods(USER_MCS_MODS_DIR);

  // Pre-configure Velocity velocity.toml
  const velocityTomlPath = path.join(MC_DIR, 'velocity.toml');
  if (fs.existsSync(velocityTomlPath)) {
    const content = fs.readFileSync(velocityTomlPath, 'utf8');
    if (!content.includes('forced-hosts')) {
      console.log('Regenerating velocity.toml to include forced-hosts setting...');
      try { fs.unlinkSync(velocityTomlPath); } catch (e) {}
    }
  }

  if (!fs.existsSync(velocityTomlPath)) {
    console.log('Creating Velocity configuration (velocity.toml)...');
    const defaultVelocityConfig = `
config-version = "2.7"
bind = "127.0.0.1:${VELOCITY_PORT}"
motd = "<gradient:#FFd32a:#FFa801>An Eaglercraft-Compatible Minecraft Server</gradient>"
show-max-players = 20
online-mode = false
prevent-client-proxy-connections = false
player-info-forwarding-mode = "none"
announce-forge = false
kick-existing-players = false
ping-passthrough = "disabled"

[servers]
lobby = "127.0.0.1:25565"
try = [
  "lobby"
]

[forced-hosts]

[advanced]
compression-threshold = 256
compression-level = -1
login-ratelimit = 3000
connection-timeout = 5000
read-timeout = 30000
haproxy-protocol = false
`;
    fs.writeFileSync(velocityTomlPath, defaultVelocityConfig.trim(), 'utf8');
  }

  // Pre-configure EaglercraftXServer listeners.toml
  const listenersTomlPath = path.join(PLUGINS_DIR, 'eaglerxserver', 'listeners.toml');
  if (fs.existsSync(listenersTomlPath)) {
    const content = fs.readFileSync(listenersTomlPath, 'utf8');
    if (!content.includes(`inject_address = "127.0.0.1:${VELOCITY_PORT}"`)) {
      console.log('Regenerating eaglerxserver/listeners.toml with correct inject_address...');
      try { fs.unlinkSync(listenersTomlPath); } catch (e) {}
    }
  }

  if (!fs.existsSync(listenersTomlPath)) {
    console.log('Pre-configuring EaglercraftXServer listeners.toml...');
    fs.mkdirSync(path.dirname(listenersTomlPath), { recursive: true });
    const defaultListeners = `
[[listener_list]]
listener_name = "listener0"
inject_address = "127.0.0.1:${VELOCITY_PORT}"
velocity_clone_listener = false
dual_stack = true
forward_ip = true
forward_ip_header = "X-Real-IP"
spoof_player_address_forwarded = true
server_motd = ["&6An EaglercraftX server"]
allow_motd = true
allow_query = true
show_motd_player_list = true

[listener_list.tls_config]
enable_tls = false

[listener_list.ratelimit]
disable_ratelimit = ["127.0.0.0/8", "::1/128"]

[listener_list.ratelimit.ip]
enable = true
period = 90
limit = 60

[listener_list.ratelimit.login]
enable = true
period = 50
limit = 5
`;
    fs.writeFileSync(listenersTomlPath, defaultListeners.trim(), 'utf8');
  }
}

function startUnifiedProxy(proxyPort, mcTargetPort, relayTargetPort) {
  if (unifiedProxyServer) {
    try { unifiedProxyServer.close(); } catch (e) {}
  }

  const binDir = path.resolve(__dirname, '../bin');
  const certPath = path.join(binDir, 'cert.pem');
  const keyPath = path.join(binDir, 'key.pem');

  if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
    console.log('Generating self-signed SSL certificate...');
    const attrs = [{ name: 'commonName', value: 'localhost' }];
    const pems = selfsigned.generate(attrs, { days: 365, keySize: 2048 });
    fs.writeFileSync(keyPath, pems.private, 'utf8');
    fs.writeFileSync(certPath, pems.cert, 'utf8');
  }

  const key = fs.readFileSync(keyPath, 'utf8');
  const cert = fs.readFileSync(certPath, 'utf8');

  const mcProxy = httpProxy.createProxyServer({
    target: `ws://127.0.0.1:${mcTargetPort}`,
    ws: true,
    changeOrigin: true
  });

  const relayProxy = httpProxy.createProxyServer({
    target: `ws://127.0.0.1:${relayTargetPort}`,
    ws: true,
    changeOrigin: true
  });

  mcProxy.on('error', (err) => {
    console.error('Proxy error occurred for Eaglercraft Minecraft Proxy:', err.message);
  });

  relayProxy.on('error', (err) => {
    console.error('Proxy error occurred for Eaglercraft Relay:', err.message);
  });

  const server = https.createServer({ key, cert }, (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<h1>Eaglercraft Unified Secure Reverse Proxy Active</h1>');
  });

  server.on('upgrade', (req, socket, head) => {
    const remoteAddr = req.socket.remoteAddress || '127.0.0.1';
    req.headers['X-Real-IP'] = remoteAddr;
    req.headers['X-Forwarded-For'] = remoteAddr;

    const urlPath = req.url || '/';
    if (urlPath.startsWith('/relay')) {
      relayProxy.ws(req, socket, head);
    } else {
      mcProxy.ws(req, socket, head);
    }
  });

  function killPort(port) {
    try {
      if (process.platform === 'win32') {
        const out = execSync(
          `powershell -NoProfile -Command "(Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue).OwningProcess"`,
          { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }
        );
        const pids = out.trim().split(/\r?\n/).map(p => p.trim()).filter(p => /^\d+$/.test(p) && p !== '0' && p !== String(process.pid));
        for (const pid of pids) {
          try { execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' }); } catch (_) {}
        }
      }
    } catch (_) {}
  }

  function tryListen(retries = 3) {
    server.listen(proxyPort, () => {
      console.log(`\n==================================================`);
      console.log(`UNIFIED SECURE REVERSE PROXY RUNNING ON PORT ${proxyPort}`);
      console.log(`==================================================\n`);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`[Proxy] Port ${proxyPort} is already in use. Freeing it...`);
        killPort(proxyPort);
        if (retries > 0) {
          server.removeAllListeners('error');
          server.close(() => {
            setTimeout(() => tryListen(retries - 1), 2000);
          });
        } else {
          console.error(`[Proxy] Could not bind to port ${proxyPort} after multiple attempts.`);
        }
      } else {
        console.error('[Proxy] Server error:', err.message);
      }
    });
  }

  tryListen();

  unifiedProxyServer = server;
}


function stopEaglerProxyAndRelay() {
  console.log('Stopping Eaglercraft Proxy and SP Relay...');
  if (unifiedProxyServer) {
    try { unifiedProxyServer.close(); } catch (e) {}
    unifiedProxyServer = null;
  }
  if (relayProcess) {
    try { relayProcess.kill(); } catch (e) {}
    relayProcess = null;
  }
  if (velocityProcess) {
    try { velocityProcess.kill(); } catch (e) {}
    velocityProcess = null;
  }
  killOrphanedJavaProcess('sp-relay.jar');
  killOrphanedJavaProcess('Velocity.jar');
  return getProxyStatus();
}

async function startEaglerProxyAndRelay() {
  try {
    // 1. Terminate any previous orphaned instances before starting
    stopEaglerProxyAndRelay();

    // Kill any external process that may be holding the proxy port
    const configuredProxyPort = process.env.PORT ? parseInt(process.env.PORT, 10) : VELOCITY_PROXY_PORT;
    try {
      if (process.platform === 'win32') {
        const out = execSync(
          `powershell -NoProfile -Command "(Get-NetTCPConnection -LocalPort ${configuredProxyPort} -ErrorAction SilentlyContinue).OwningProcess"`,
          { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }
        );
        const pids = out.trim().split(/\r?\n/).map(p => p.trim()).filter(p => /^\d+$/.test(p) && p !== '0' && p !== String(process.pid));
        for (const pid of pids) {
          try { execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' }); console.log(`[Proxy] Freed port ${configuredProxyPort} (killed PID ${pid})`); } catch (_) {}
        }
      }
    } catch (_) {}

    await setupVelocityProxy();

    console.log('\nStarting proxy and relay servers...');
    const binDir = path.resolve(__dirname, '../bin');
    const javaExec = getJava21Executable();

    // 2. Spawn Eaglercraft Java SP Relay backend (sp-relay.jar) WITHOUT shell wrapper to enable direct kill
    console.log('Starting Eaglercraft Java SP Relay backend (sp-relay.jar)...');
    relayProcess = spawn(javaExec, ['-jar', 'sp-relay.jar'], {
      cwd: binDir,
      stdio: 'ignore'
    });

    // 3. Spawn Velocity Proxy Server (port 25566) WITHOUT shell wrapper
    console.log('Starting Velocity Proxy Server (port 25566)...');
    velocityProcess = spawn(javaExec, [
      '-Xmx512M',
      '-Xms512M',
      '-jar',
      'Velocity.jar'
    ], {
      cwd: MC_DIR,
      stdio: 'ignore'
    });

    const cleanup = () => {
      stopEaglerProxyAndRelay();
    };

    process.on('exit', cleanup);
    process.on('SIGINT', cleanup);

    // 4. Start unified secure reverse proxy on port 8608
    startUnifiedProxy(configuredProxyPort, VELOCITY_PORT, RELAY_PORT);

    return { cleanup, status: getProxyStatus() };
  } catch (err) {
    console.error('Setup/Startup error occurred:', err);
    throw err;
  }
}

module.exports = {
  startEaglerProxyAndRelay,
  stopEaglerProxyAndRelay,
  getProxyStatus
};
