import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import https from 'https';
import os from 'os';
import { startUnifiedProxy } from './proxy';

const RELAY_PORT = 8080;
const RELAY_PROXY_PORT = 8609;
const VELOCITY_PORT = 25566;
const VELOCITY_PROXY_PORT = 8608;

const MC_DIR = path.resolve('minecraft-server');
const VELOCITY_JAR = path.join(MC_DIR, 'Velocity.jar');
const PLUGINS_DIR = path.join(MC_DIR, 'plugins');

// Plugins on the Velocity proxy
const VIAVERSION_JAR = path.join(PLUGINS_DIR, 'ViaVersion.jar');
const VIABACKWARDS_JAR = path.join(PLUGINS_DIR, 'ViaBackwards.jar');
const VIAREWIND_JAR = path.join(PLUGINS_DIR, 'ViaRewind.jar');
const EAGLER_PLUGIN = path.join(PLUGINS_DIR, 'EaglerXServer.jar');

// Mods folders on Fabric server (we will CLEAN these up to prevent crashes on Fabric!)
const FABRIC_MODS_DIR = path.resolve('../mcs/mods');
const USER_MCS_MODS_DIR = path.join(os.homedir(), 'Documents', 'mcserver', 'mods');

const VELOCITY_URL = 'https://fill-data.papermc.io/v1/objects/b4e3164df5377346854dc6cb9e6a78022b1946ff69e89676313f5f6f1c6f0fb3/velocity-3.5.1-615.jar';
const VIAVERSION_URL = 'https://github.com/ViaVersion/ViaVersion/releases/download/5.11.0/ViaVersion-5.11.0.jar';
const VIABACKWARDS_URL = 'https://github.com/ViaVersion/ViaBackwards/releases/download/5.11.0/ViaBackwards-5.11.0.jar';
const VIAREWIND_URL = 'https://cdn.modrinth.com/data/TbHIxhx5/versions/r9d7WsYA/ViaRewind-4.1.3.jar';
const EAGLER_PLUGIN_URL = 'https://github.com/lax1dude/eaglerxserver/releases/download/v1.1.1/EaglerXServer.jar';

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const file = fs.createWriteStream(dest);
    const request = (targetUrl: string) => {
      https.get(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      }, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          return request(response.headers.location!);
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

function cleanObsoleteFabricMods(dir: string) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const lowercaseName = file.toLowerCase();
    // Remove ViaFabric, ViaVersion, and ViaBackwards from Fabric server to avoid crashes and classpath conflicts!
    if (lowercaseName.startsWith('viafabric') || lowercaseName.startsWith('viaversion') || lowercaseName.startsWith('viabackwards')) {
      console.log(`Removing mod from Fabric server mods directory: ${file} (now managed by Velocity proxy)`);
      try {
        fs.unlinkSync(path.join(dir, file));
      } catch (err: any) {
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
    console.log('Removing legacy BungeeCord JAR...');
    fs.unlinkSync(oldBungee);
  }
  if (fs.existsSync(oldBungeeConfig)) {
    console.log('Removing legacy BungeeCord configuration...');
    fs.unlinkSync(oldBungeeConfig);
  }

  const handleDownload = async (name: string, url: string, dest: string) => {
    if (fs.existsSync(dest)) return;
    try {
      console.log(`Downloading ${name}...`);
      await downloadFile(url, dest);
      console.log(`${name} downloaded successfully.`);
    } catch (err: any) {
      console.error(`\n[Network Block Warning] Failed to download ${name}: ${err.message}`);
      console.error(`If you are behind a firewall (like Fortinet), please download the file manually:`);
      console.error(`URL:  ${url}`);
      console.error(`Save to: ${dest}\n`);
      if (!fs.existsSync(dest)) {
        throw new Error(`Missing required file ${name}. Please download it manually and place it at: ${dest}`);
      }
    }
  };

  // 2. Download Velocity if missing
  await handleDownload('Velocity Proxy', VELOCITY_URL, VELOCITY_JAR);

  // 3. Download ViaVersion plugin if missing
  await handleDownload('ViaVersion', VIAVERSION_URL, VIAVERSION_JAR);

  // 4. Download ViaBackwards plugin if missing
  await handleDownload('ViaBackwards', VIABACKWARDS_URL, VIABACKWARDS_JAR);

  // 5. Download ViaRewind plugin if missing
  await handleDownload('ViaRewind', VIAREWIND_URL, VIAREWIND_JAR);

  // 6. Download EaglercraftXServer plugin if missing
  await handleDownload('EaglercraftXServer', EAGLER_PLUGIN_URL, EAGLER_PLUGIN);

  // 6. Remove any ViaVersion, ViaBackwards, or ViaFabric mods from Fabric server to prevent crashes
  cleanObsoleteFabricMods(FABRIC_MODS_DIR);
  cleanObsoleteFabricMods(USER_MCS_MODS_DIR);

  // 7. Pre-configure Velocity velocity.toml
  const velocityTomlPath = path.join(MC_DIR, 'velocity.toml');
  // Always delete or overwrite if it doesn't have forced-hosts configured to avoid default template crashes
  if (fs.existsSync(velocityTomlPath)) {
    const content = fs.readFileSync(velocityTomlPath, 'utf8');
    if (!content.includes('forced-hosts')) {
      console.log('Regenerating velocity.toml to include forced-hosts setting...');
      fs.unlinkSync(velocityTomlPath);
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
player-info-forwarding-mode = "legacy"
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

  // 8. Pre-configure EaglercraftXServer listeners.toml (Velocity style)
  const listenersTomlPath = path.join(PLUGINS_DIR, 'eaglerxserver', 'listeners.toml');
  
  // Overwrite listeners.toml if it exists but is not set to the correct port
  if (fs.existsSync(listenersTomlPath)) {
    const content = fs.readFileSync(listenersTomlPath, 'utf8');
    if (!content.includes(`inject_address = "127.0.0.1:${VELOCITY_PORT}"`)) {
      console.log('Regenerating eaglerxserver/listeners.toml with correct inject_address...');
      fs.unlinkSync(listenersTomlPath);
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

  // Clean up old Bungee listeners.yml if present to avoid confusion
  const oldListenersYml = path.join(PLUGINS_DIR, 'EaglercraftXServer', 'listeners.yml');
  if (fs.existsSync(oldListenersYml)) {
    try { fs.unlinkSync(oldListenersYml); } catch {}
  }
}

async function start() {
  try {
    // Perform setup
    await setupVelocityProxy();

    console.log('\nStarting servers...');

    // 1. Spawn Eaglercraft Java SP Relay backend (sp-relay.jar)
    console.log('Starting Eaglercraft Java SP Relay backend (sp-relay.jar)...');
    const relayProcess = spawn('java', ['-jar', 'sp-relay.jar'], {
      stdio: 'inherit',
      shell: true
    });

    relayProcess.on('error', (err) => {
      console.error('Failed to start Eaglercraft Java SP Relay:', err);
    });

    // 2. Spawn Velocity Proxy Server (port 25566)
    console.log('Starting Velocity Proxy Server (port 25566)...');
    const velocityProcess = spawn('java', [
      '-Xmx512M',
      '-Xms512M',
      '-jar',
      'Velocity.jar'
    ], {
      cwd: MC_DIR,
      stdio: 'inherit',
      shell: true
    });

    velocityProcess.on('error', (err) => {
      console.error('Failed to start Velocity:', err);
    });

    // Handle exits to close everything if a process dies
    const cleanup = () => {
      try { relayProcess.kill(); } catch {}
      try { velocityProcess.kill(); } catch {}
      process.exit(0);
    };

    relayProcess.on('exit', cleanup);
    velocityProcess.on('exit', cleanup);
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

    // 3. Start unified secure reverse proxy on port 8608
    // Note: To bypass corporate/school firewalls that restrict custom ports,
    // you can configure this proxy to bind directly to port 443!
    const configuredProxyPort = process.env.PORT ? parseInt(process.env.PORT, 10) : VELOCITY_PROXY_PORT;
    startUnifiedProxy(configuredProxyPort, VELOCITY_PORT, RELAY_PORT);

  } catch (err) {
    console.error('Setup/Startup error occurred:', err);
    process.exit(1);
  }
}

start();
