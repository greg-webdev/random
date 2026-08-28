const path = require('path');
const fs = require('fs-extra');
const axios = require('axios');
const AdmZip = require('adm-zip');
const {
  ASSETS_DIR,
  LIBRARIES_DIR,
  NATIVES_DIR,
  VERSIONS_DIR,
  ROAMING_MINECRAFT
} = require('./paths');

const MC_VERSION = '1.21.11';
const FABRIC_META_URL = 'https://meta.fabricmc.net/v2/versions/loader/1.21.11';
const MOJANG_MANIFEST_URL = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json';

/**
 * Extract native DLLs from library JARs into NATIVES_DIR
 */
async function extractNatives(nativePaths = []) {
  await fs.ensureDir(NATIVES_DIR);
  await fs.emptyDir(NATIVES_DIR); // Clean old natives first to avoid version conflicts and segfaults!

  for (const nativePath of nativePaths) {
    if (await fs.pathExists(nativePath)) {
      try {
        const zip = new AdmZip(nativePath);
        zip.getEntries().forEach(e => {
          if (e.entryName.endsWith('.dll')) {
            const targetName = path.basename(e.entryName);
            const dest = path.join(NATIVES_DIR, targetName);
            fs.writeFileSync(dest, zip.readFile(e));
          }
        });
      } catch (err) {
        console.error(`[Launcher] Failed to extract natives from ${nativePath}:`, err.message);
      }
    }
  }
}

/**
 * Download a file with progress reporting callback
 */
async function downloadFile(url, destPath, onProgress) {
  await fs.ensureDir(path.dirname(destPath));

  // Check if file exists in roaming .minecraft first to save download!
  const relPath = path.relative(path.resolve(__dirname, '..'), destPath);
  let roamingCandidate = null;
  if (relPath.startsWith('libraries')) {
    roamingCandidate = path.join(ROAMING_MINECRAFT, relPath);
  } else if (relPath.startsWith('assets')) {
    roamingCandidate = path.join(ROAMING_MINECRAFT, relPath);
  }

  if (roamingCandidate && await fs.pathExists(roamingCandidate)) {
    await fs.copy(roamingCandidate, destPath);
    return;
  }

  if (await fs.pathExists(destPath)) {
    return; // Already downloaded
  }

  try {
    const response = await axios({
      url,
      method: 'GET',
      responseType: 'arraybuffer',
      timeout: 5000
    });
    await fs.writeFile(destPath, response.data);
    if (onProgress) onProgress({ type: 'download', file: path.basename(destPath) });
  } catch (err) {
    console.error(`Failed to download ${url}: ${err.message}`);
  }
}

/**
 * Instant Cached Setup for Fabric 1.21.11
 */
async function setupFabricInstance(onProgress = () => {}) {
  const cachedProfilePath = path.join(VERSIONS_DIR, 'fabric-profile-1.21.11.json');
  const clientJarPath = path.join(VERSIONS_DIR, `${MC_VERSION}.jar`);

  // Fast path: If cached profile exists locally, load INSTANTLY (0.01s)!
  if (await fs.pathExists(cachedProfilePath) && await fs.pathExists(clientJarPath)) {
    onProgress({ type: 'status', message: 'Loading cached Fabric 1.21.11 environment...' });
    const cachedData = await fs.readJson(cachedProfilePath);
    await extractNatives(cachedData.nativePaths || []);
    await ensureAssets(cachedData.assetIndexId || '29', cachedData.assetIndexUrl, onProgress);
    return cachedData;
  }

  onProgress({ type: 'status', message: 'Fetching Fabric 1.21.11 Loader metadata...' });

  let loaderVersion = '0.19.4';
  try {
    const fabricRes = await axios.get(FABRIC_META_URL, { timeout: 4000 });
    if (fabricRes.data && fabricRes.data.length > 0) {
      loaderVersion = fabricRes.data[0].loader.version;
    }
  } catch (e) {}

  onProgress({ type: 'status', message: `Using Fabric Loader ${loaderVersion}` });

  // Fetch Fabric profile JSON
  let fabricProfile = null;
  try {
    const fabricProfileUrl = `https://meta.fabricmc.net/v2/versions/loader/1.21.11/${loaderVersion}/profile/json`;
    const fabricProfileRes = await axios.get(fabricProfileUrl, { timeout: 4000 });
    fabricProfile = fabricProfileRes.data;
  } catch (e) {}

  // Fetch Mojang Version Manifest
  let mojangVersion = null;
  try {
    const mojangManifestRes = await axios.get(MOJANG_MANIFEST_URL, { timeout: 4000 });
    const vInfo = mojangManifestRes.data.versions.find(v => v.id === MC_VERSION);
    if (vInfo) {
      const mojangVersionRes = await axios.get(vInfo.url, { timeout: 4000 });
      mojangVersion = mojangVersionRes.data;
    }
  } catch (e) {}

  // Copy or download Client JAR
  if (!await fs.pathExists(clientJarPath)) {
    const roamingClientJar = path.join(ROAMING_MINECRAFT, 'versions', MC_VERSION, `${MC_VERSION}.jar`);
    if (await fs.pathExists(roamingClientJar)) {
      await fs.copy(roamingClientJar, clientJarPath);
    } else if (mojangVersion && mojangVersion.downloads && mojangVersion.downloads.client) {
      await downloadFile(mojangVersion.downloads.client.url, clientJarPath, onProgress);
    }
  }

  const allLibraries = [
    ...(mojangVersion ? (mojangVersion.libraries || []) : []),
    ...(fabricProfile ? (fabricProfile.libraries || []) : [])
  ];

  const classpaths = [];
  const nativePaths = [];
  const roamingLibDir = path.join(ROAMING_MINECRAFT, 'libraries');

  for (let i = 0; i < allLibraries.length; i++) {
    const lib = allLibraries[i];

    // Check rule filters if applicable to skip non-Windows libraries
    if (lib.rules) {
      const allowed = lib.rules.every(rule => {
        if (rule.action === 'allow' && rule.os && rule.os.name && rule.os.name !== 'windows') return false;
        if (rule.action === 'disallow' && rule.os && rule.os.name && rule.os.name === 'windows') return false;
        return true;
      });
      if (!allowed) continue;
    }

    let libRelPath = '';
    let downloadUrl = '';

    if (lib.downloads && lib.downloads.artifact) {
      libRelPath = lib.downloads.artifact.path;
      downloadUrl = lib.downloads.artifact.url;
    } else if (lib.name) {
      const parts = lib.name.split(':');
      const group = parts[0].replace(/\./g, '/');
      const artifact = parts[1];
      const version = parts[2];
      libRelPath = `${group}/${artifact}/${version}/${artifact}-${version}.jar`;
      downloadUrl = lib.url ? `${lib.url}${libRelPath}` : `https://libraries.minecraft.net/${libRelPath}`;
    }

    if (libRelPath) {
      const localLibPath = path.join(LIBRARIES_DIR, libRelPath);
      const roamingLibPath = path.join(roamingLibDir, libRelPath);

      if (await fs.pathExists(localLibPath)) {
        classpaths.push(localLibPath);
      } else if (await fs.pathExists(roamingLibPath)) {
        classpaths.push(roamingLibPath);
      } else {
        classpaths.push(localLibPath);
        try {
          await downloadFile(downloadUrl, localLibPath, onProgress);
        } catch (e) {}
      }
    }

    // Handle native classifiers (e.g. natives-windows)
    if (lib.downloads && lib.downloads.classifiers) {
      const nativeKey = lib.downloads.classifiers['natives-windows'];
      if (nativeKey) {
        const nativeDest = path.join(LIBRARIES_DIR, nativeKey.path);
        const roamingNativePath = path.join(roamingLibDir, nativeKey.path);

        if (await fs.pathExists(nativeDest)) {
          nativePaths.push(nativeDest);
        } else if (await fs.pathExists(roamingNativePath)) {
          nativePaths.push(roamingNativePath);
        } else {
          nativePaths.push(nativeDest);
          try {
            await downloadFile(nativeKey.url, nativeDest, onProgress);
          } catch (e) {}
        }
      }
    }
  }

  classpaths.push(clientJarPath);

  const result = {
    mainClass: (fabricProfile && fabricProfile.mainClass) || 'net.fabricmc.loader.impl.launch.knot.KnotClient',
    classpaths,
    nativePaths,
    assetIndexId: mojangVersion && mojangVersion.assetIndex ? mojangVersion.assetIndex.id : '29',
    assetIndexUrl: mojangVersion && mojangVersion.assetIndex ? mojangVersion.assetIndex.url : null
  };

  // Cache profile so future launches load INSTANTLY in 10ms!
  await fs.ensureDir(VERSIONS_DIR);
  await fs.writeJson(cachedProfilePath, result, { spaces: 2 });

  await extractNatives(result.nativePaths);
  await ensureAssets(result.assetIndexId, result.assetIndexUrl, onProgress);

  return result;
}

async function getAssetIndexUrl(assetIndexId) {
  try {
    const manifestRes = await axios.get(MOJANG_MANIFEST_URL, { timeout: 4000 });
    const vInfo = manifestRes.data.versions.find(v => v.id === MC_VERSION);
    if (vInfo) {
      const verRes = await axios.get(vInfo.url, { timeout: 4000 });
      if (verRes.data && verRes.data.assetIndex) {
        return verRes.data.assetIndex.url;
      }
    }
  } catch (err) {
    console.error(`[Launcher] Failed to fetch asset index URL from manifest: ${err.message}`);
  }
  return `https://piston-meta.mojang.com/v2/assets/${assetIndexId}.json`;
}

async function ensureAssets(assetIndexId, assetIndexUrl, onProgress = () => {}) {
  const assetIndexPath = path.join(ASSETS_DIR, 'indexes', `${assetIndexId}.json`);
  
  if (!await fs.pathExists(assetIndexPath)) {
    onProgress({ type: 'status', message: `Downloading asset index ${assetIndexId}...` });
    if (!assetIndexUrl) {
      assetIndexUrl = await getAssetIndexUrl(assetIndexId);
    }
    await downloadFile(assetIndexUrl, assetIndexPath, onProgress);
  }
  
  const assetIndex = await fs.readJson(assetIndexPath);
  const objects = assetIndex.objects || {};
  const hashes = Object.values(objects).map(obj => obj.hash);
  
  // Find missing assets
  const missingAssets = [];
  const roamingAssetsDir = path.join(ROAMING_MINECRAFT, 'assets', 'objects');
  
  for (const hash of hashes) {
    const two = hash.slice(0, 2);
    const localPath = path.join(ASSETS_DIR, 'objects', two, hash);
    const roamingPath = path.join(roamingAssetsDir, two, hash);
    
    if (await fs.pathExists(localPath)) {
      continue;
    }
    if (await fs.pathExists(roamingPath)) {
      await fs.ensureDir(path.dirname(localPath));
      await fs.copy(roamingPath, localPath);
      continue;
    }
    
    missingAssets.push({
      url: `https://resources.download.minecraft.net/${two}/${hash}`,
      dest: localPath
    });
  }
  
  if (missingAssets.length > 0) {
    onProgress({ type: 'status', message: `Downloading ${missingAssets.length} missing assets...` });
    
    let downloadedCount = 0;
    const limit = 15;
    let index = 0;
    
    const execute = async () => {
      while (index < missingAssets.length) {
        const current = index++;
        const { url, dest } = missingAssets[current];
        try {
          await downloadFile(url, dest);
          downloadedCount++;
          if (downloadedCount % 50 === 0 || downloadedCount === missingAssets.length) {
            onProgress({ type: 'status', message: `Syncing assets: ${downloadedCount}/${missingAssets.length} completed...` });
          }
        } catch (err) {
          console.error(`Failed to download asset ${url}: ${err.message}`);
        }
      }
    };
    
    const workers = Array.from({ length: Math.min(limit, missingAssets.length) }, execute);
    await Promise.all(workers);
  }
  
  onProgress({ type: 'status', message: `Assets verified (${hashes.length} files).` });
}

module.exports = {
  setupFabricInstance,
  MC_VERSION
};
