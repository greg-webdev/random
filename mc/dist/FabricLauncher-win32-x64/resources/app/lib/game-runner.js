const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs-extra');
const {
  INSTANCE_DIR,
  MODS_DIR,
  ASSETS_DIR,
  NATIVES_DIR,
  ROAMING_MINECRAFT
} = require('./paths');
const { setupFabricInstance } = require('./fabric-installer');

let activeGameProcess = null;
let logWatcherInterval = null;

/**
 * Locate Java binary executable (ensuring Java 21+)
 */
async function locateJava(customPath) {
  if (customPath && await fs.pathExists(customPath)) {
    return customPath;
  }

  // 1. Prioritize official Mojang Java 21 runtime (java-runtime-delta)
  const deltaPath = path.join(ROAMING_MINECRAFT, 'runtime', 'windows-x64', 'java-runtime-delta', 'bin', 'javaw.exe');
  if (await fs.pathExists(deltaPath)) {
    return deltaPath;
  }

  // 2. Check system 'javaw' / 'java' command version
  try {
    const { execSync } = require('child_process');
    const verOut = execSync('javaw -version 2>&1').toString() || execSync('java -version 2>&1').toString();
    const match = verOut.match(/version "(\d+)/) || verOut.match(/java (\d+)/);
    if (match) {
      const major = parseInt(match[1], 10);
      if (major >= 21) {
        return 'javaw';
      }
    }
  } catch (e) {}

  // 3. Search roaming .minecraft runtime for javaw.exe (Java 21+)
  const runtimeDir = path.join(ROAMING_MINECRAFT, 'runtime');
  if (await fs.pathExists(runtimeDir)) {
    const javaExes = [];
    const searchFiles = (dir) => {
      try {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const full = path.join(dir, file);
          const stat = fs.statSync(full);
          if (stat.isDirectory()) {
            searchFiles(full);
          } else if (file.toLowerCase() === 'javaw.exe') {
            if (!full.includes('jre-legacy') && !full.includes('java-runtime-alpha') && !full.includes('java-runtime-beta')) {
              javaExes.push(full);
            }
          }
        }
      } catch (e) {}
    };
    searchFiles(runtimeDir);
    if (javaExes.length > 0) {
      return javaExes[javaExes.length - 1];
    }
  }

  return 'javaw';
}

/**
 * Tail instance/logs/latest.log for real-time log streaming without pipe bottlenecks
 */
function startLogWatcher(onLog) {
  if (logWatcherInterval) {
    clearInterval(logWatcherInterval);
    logWatcherInterval = null;
  }

  const logFile = path.join(INSTANCE_DIR, 'logs', 'latest.log');
  let lastSize = 0;

  if (fs.existsSync(logFile)) {
    try {
      lastSize = fs.statSync(logFile).size;
    } catch (e) {}
  }

  const checkLog = () => {
    if (!fs.existsSync(logFile)) return;
    try {
      const stat = fs.statSync(logFile);
      if (stat.size > lastSize) {
        const stream = fs.createReadStream(logFile, {
          start: lastSize,
          end: stat.size,
          encoding: 'utf8'
        });
        lastSize = stat.size;
        stream.on('data', (chunk) => {
          const lines = chunk.split(/\r?\n/);
          for (const line of lines) {
            if (line.trim()) {
              const type = line.includes('ERROR') || line.includes('WARN') ? 'err' : 'out';
              onLog({ type, text: line });
            }
          }
        });
      }
    } catch (e) {}
  };

  logWatcherInterval = setInterval(checkLog, 250);
}

function stopLogWatcher() {
  if (logWatcherInterval) {
    clearInterval(logWatcherInterval);
    logWatcherInterval = null;
  }
}

/**
 * Launch Fabric 1.21.11 Minecraft instance
 */
async function launchGame(config, onLog = () => {}, onStatus = () => {}) {
  if (activeGameProcess) {
    onStatus({ state: 'running', message: 'Minecraft Fabric 1.21.11 is already running!' });
    return getGameStatus();
  }

  const {
    username = 'Player',
    maxRam = 4096,
    minRam = 1024,
    javaPath = null,
    jvmArgs = ''
  } = config;

  onStatus({ state: 'preparing', message: 'Setting up Fabric 1.21.11 assets & dependencies...' });

  const fabricInfo = await setupFabricInstance(onStatus);
  const javaExec = await locateJava(javaPath);

  // Sync enabled mods from launcher's mods folder to instance/mods
  const instanceModsDir = path.join(INSTANCE_DIR, 'mods');
  await fs.ensureDir(instanceModsDir);
  await fs.emptyDir(instanceModsDir);
  const modsFiles = await fs.readdir(MODS_DIR);
  let syncedModsCount = 0;
  for (const file of modsFiles) {
    if (file.endsWith('.jar')) {
      await fs.copy(path.join(MODS_DIR, file), path.join(instanceModsDir, file));
      syncedModsCount++;
    }
  }
  onLog({ type: 'sys', text: `[Launcher] Synced ${syncedModsCount} enabled mods to instance mods directory.` });

  onStatus({ state: 'launching', message: `Launching with Java: ${javaExec}` });
  onLog({ type: 'sys', text: `[Launcher] Java executable: ${javaExec}` });
  onLog({ type: 'sys', text: `[Launcher] Target Game Directory: ${INSTANCE_DIR}` });
  onLog({ type: 'sys', text: `[Launcher] Mods Directory: ${instanceModsDir}` });

  // Classpath string for Windows (separated by ';')
  const classpathStr = fabricInfo.classpaths.join(';');

  // Generate a fake offline UUID from username
  const fakeUuid = '00000000-0000-0000-0000-' + Buffer.from(username).toString('hex').padEnd(12, '0').slice(0, 12);

  const jvmFlags = [
    `-Xms${minRam}M`,
    `-Xmx${maxRam}M`,
    `-XX:HeapDumpPath=MojangTricksIntelDriversForPerformance_javaw.exe_minecraft.exe.heapdump`,
    `-Djava.library.path=${NATIVES_DIR}`,
    `-Djna.tmpdir=${NATIVES_DIR}`,
    `-Dorg.lwjgl.system.SharedLibraryExtractPath=${NATIVES_DIR}`,
    `-Dio.netty.native.workdir=${NATIVES_DIR}`,
    `-Dorg.lwjgl.librarypath=${NATIVES_DIR}`,
    `-Dminecraft.applet.TargetDirectory=${INSTANCE_DIR}`,
    `-Dminecraft.launcher.brand=FabricLauncher`,
    `-Dminecraft.launcher.version=2`,
    `-Dfile.encoding=UTF-8`,
    `-Dstdout.encoding=UTF-8`,
    `-Dstderr.encoding=UTF-8`,
    `-Dsun.java2d.noddraw=true`,
    `-XX:+UnlockExperimentalVMOptions`,
    `-XX:+UseG1GC`,
    `-XX:G1NewSizePercent=20`,
    `-XX:G1ReservePercent=20`,
    `-XX:MaxGCPauseMillis=50`,
    `-XX:G1HeapRegionSize=32M`,
    `-XX:+DisableExplicitGC`,
    `-XX:+AlwaysPreTouch`,
    `-XX:+ParallelRefProcEnabled`,
    `-XX:+PerfDisableSharedMem`,
    `-Dsun.rmi.dgc.server.gcInterval=2147483646`,
    `-DFabricMcEmu= net.minecraft.client.main.Main `,
    `--enable-native-access=ALL-UNNAMED`
  ];

  if (jvmArgs && jvmArgs.trim().length > 0) {
    jvmFlags.push(...jvmArgs.trim().split(/\s+/));
  }

  // Use roaming .minecraft assets directory if available for 100% asset completeness
  const roamingAssets = path.join(ROAMING_MINECRAFT, 'assets');
  const assetsDirToUse = (await fs.pathExists(roamingAssets)) ? roamingAssets : ASSETS_DIR;

  const gameArgs = [
    '--username', username,
    '--version', 'Fabric 1.21.11',
    '--gameDir', INSTANCE_DIR,
    '--assetsDir', assetsDirToUse,
    '--assetIndex', fabricInfo.assetIndexId,
    '--uuid', fakeUuid,
    '--accessToken', '0',
    '--userType', 'mojang',
    '--versionType', 'release'
  ];

  const fullArgs = [
    ...jvmFlags,
    '-cp',
    classpathStr,
    fabricInfo.mainClass,
    ...gameArgs
  ];

  onLog({ type: 'sys', text: `[Launcher] Spawning KnotClient process (stdio: ignore)...` });

  // stdio: 'ignore' ensures zero Win32 pipe deadlock on javaw.exe
  const processOptions = {
    cwd: INSTANCE_DIR,
    detached: true,
    stdio: 'ignore'
  };

  try {
    activeGameProcess = spawn(javaExec, fullArgs, processOptions);
    activeGameProcess.unref();

    onStatus({ state: 'running', message: 'Minecraft Fabric 1.21.11 is running!' });

    // Stream logs via latest.log file tailer
    startLogWatcher(onLog);

    activeGameProcess.on('close', (code) => {
      onLog({ type: 'sys', text: `[Launcher] Minecraft process exited with code ${code}` });
      activeGameProcess = null;
      stopLogWatcher();
      onStatus({ state: 'idle', message: 'Minecraft closed.' });
    });

    activeGameProcess.on('error', (err) => {
      onLog({ type: 'err', text: `[Launcher] Process error: ${err.message}` });
      activeGameProcess = null;
      stopLogWatcher();
      onStatus({ state: 'idle', message: `Launch error: ${err.message}` });
    });

    return { pid: activeGameProcess.pid };
  } catch (err) {
    activeGameProcess = null;
    stopLogWatcher();
    onStatus({ state: 'idle', message: `Failed to launch: ${err.message}` });
    throw err;
  }
}

/**
 * Kill active game process
 */
function killGame() {
  if (activeGameProcess) {
    activeGameProcess.kill('SIGKILL');
    activeGameProcess = null;
    stopLogWatcher();
    return true;
  }
  return false;
}

/**
 * Get active status
 */
function getGameStatus() {
  return {
    isRunning: !!activeGameProcess,
    pid: activeGameProcess ? activeGameProcess.pid : null
  };
}

module.exports = {
  launchGame,
  killGame,
  getGameStatus,
  locateJava
};
