const path = require('path');
const fs = require('fs-extra');
const AdmZip = require('adm-zip');
const { MODS_DIR } = require('./paths');

/**
 * Get details of all mods in the local mods directory.
 */
async function getModsList() {
  await fs.ensureDir(MODS_DIR);
  const files = await fs.readdir(MODS_DIR);
  const mods = [];

  for (const filename of files) {
    if (!filename.endsWith('.jar') && !filename.endsWith('.jar.disabled')) {
      continue;
    }

    const filePath = path.join(MODS_DIR, filename);
    const stat = await fs.stat(filePath);
    const enabled = filename.endsWith('.jar');

    let modInfo = {
      filename,
      name: filename.replace(/\.jar(\.disabled)?$/, ''),
      id: filename,
      version: 'Unknown',
      description: 'Local mod file',
      icon: null,
      enabled,
      size: (stat.size / (1024 * 1024)).toFixed(2) + ' MB',
      updatedAt: stat.mtime
    };

    // Try reading fabric.mod.json from zip archive
    try {
      const zip = new AdmZip(filePath);
      const zipEntries = zip.getEntries();
      const fabricEntry = zipEntries.find(entry => entry.entryName === 'fabric.mod.json');
      
      if (fabricEntry) {
        const content = zip.readAsText(fabricEntry);
        const fabricJson = JSON.parse(content);
        
        modInfo.name = fabricJson.name || modInfo.name;
        modInfo.id = fabricJson.id || modInfo.id;
        modInfo.version = fabricJson.version || modInfo.version;
        modInfo.description = fabricJson.description || modInfo.description;
        
        // Try reading mod icon if specified
        if (fabricJson.icon) {
          let iconPath = fabricJson.icon;
          if (typeof iconPath === 'object') {
            iconPath = iconPath['128'] || iconPath['64'] || Object.values(iconPath)[0];
          }
          if (typeof iconPath === 'string') {
            const iconEntry = zipEntries.find(e => e.entryName === iconPath.replace(/^\//, ''));
            if (iconEntry) {
              const iconBuffer = zip.readFile(iconEntry);
              if (iconBuffer) {
                const ext = path.extname(iconPath).slice(1) || 'png';
                modInfo.icon = `data:image/${ext};base64,${iconBuffer.toString('base64')}`;
              }
            }
          }
        }
      }
    } catch (err) {
      // Ignore zip reading errors, fallback to basic details
    }

    mods.push(modInfo);
  }

  // Sort enabled mods first, then alphabetically
  return mods.sort((a, b) => {
    if (a.enabled === b.enabled) {
      return a.name.localeCompare(b.name);
    }
    return a.enabled ? -1 : 1;
  });
}

/**
 * Toggle mod status between .jar and .jar.disabled
 */
async function toggleMod(filename) {
  const filePath = path.join(MODS_DIR, filename);
  if (!await fs.pathExists(filePath)) {
    throw new Error(`Mod file not found: ${filename}`);
  }

  let newFilename;
  if (filename.endsWith('.jar')) {
    newFilename = filename + '.disabled';
  } else if (filename.endsWith('.jar.disabled')) {
    newFilename = filename.slice(0, -9);
  } else {
    throw new Error('Invalid mod extension');
  }

  const newPath = path.join(MODS_DIR, newFilename);
  await fs.rename(filePath, newPath);
  return { oldFilename: filename, newFilename, enabled: newFilename.endsWith('.jar') };
}

/**
 * Delete mod file from local mods directory
 */
async function deleteMod(filename) {
  const filePath = path.join(MODS_DIR, filename);
  if (await fs.pathExists(filePath)) {
    await fs.remove(filePath);
  }
  return { filename };
}

module.exports = {
  getModsList,
  toggleMod,
  deleteMod
};
