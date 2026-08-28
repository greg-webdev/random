const path = require('path');
const fs = require('fs-extra');
const { ROAMING_MINECRAFT, INSTANCE_DIR } = require('./paths');

/**
 * Inspect roaming .minecraft folder status and content summaries
 */
async function getRoamingInfo() {
  const exists = await fs.pathExists(ROAMING_MINECRAFT);
  if (!exists) {
    return {
      exists: false,
      path: ROAMING_MINECRAFT,
      saves: [],
      resourcepacks: [],
      shaderpacks: [],
      hasOptions: false
    };
  }

  const savesDir = path.join(ROAMING_MINECRAFT, 'saves');
  const rpDir = path.join(ROAMING_MINECRAFT, 'resourcepacks');
  const spDir = path.join(ROAMING_MINECRAFT, 'shaderpacks');
  const optionsPath = path.join(ROAMING_MINECRAFT, 'options.txt');

  const saves = [];
  if (await fs.pathExists(savesDir)) {
    const items = await fs.readdir(savesDir);
    for (const item of items) {
      const p = path.join(savesDir, item);
      const stat = await fs.stat(p);
      if (stat.isDirectory()) {
        saves.push({ name: item, mtime: stat.mtime });
      }
    }
  }

  const resourcepacks = [];
  if (await fs.pathExists(rpDir)) {
    const items = await fs.readdir(rpDir);
    for (const item of items) {
      resourcepacks.push({ name: item });
    }
  }

  const shaderpacks = [];
  if (await fs.pathExists(spDir)) {
    const items = await fs.readdir(spDir);
    for (const item of items) {
      shaderpacks.push({ name: item });
    }
  }

  const hasOptions = await fs.pathExists(optionsPath);

  return {
    exists: true,
    path: ROAMING_MINECRAFT,
    saves,
    resourcepacks,
    shaderpacks,
    hasOptions
  };
}

/**
 * Copy specific items from Roaming .minecraft to local instance
 */
async function syncFromRoaming(type, name) {
  if (!await fs.pathExists(ROAMING_MINECRAFT)) {
    throw new Error('Roaming .minecraft directory not found');
  }

  if (type === 'options') {
    const src = path.join(ROAMING_MINECRAFT, 'options.txt');
    const dest = path.join(INSTANCE_DIR, 'options.txt');
    if (await fs.pathExists(src)) {
      await fs.copy(src, dest, { overwrite: true });
      return { success: true, message: 'Copied options.txt into local instance' };
    } else {
      throw new Error('options.txt not found in roaming .minecraft');
    }
  }

  if (type === 'save') {
    const src = path.join(ROAMING_MINECRAFT, 'saves', name);
    const dest = path.join(INSTANCE_DIR, 'saves', name);
    if (await fs.pathExists(src)) {
      await fs.copy(src, dest, { overwrite: true });
      return { success: true, message: `Copied save "${name}" into local instance` };
    } else {
      throw new Error(`Save "${name}" not found`);
    }
  }

  if (type === 'resourcepack') {
    const src = path.join(ROAMING_MINECRAFT, 'resourcepacks', name);
    const dest = path.join(INSTANCE_DIR, 'resourcepacks', name);
    if (await fs.pathExists(src)) {
      await fs.copy(src, dest, { overwrite: true });
      return { success: true, message: `Copied resourcepack "${name}" into local instance` };
    } else {
      throw new Error(`Resourcepack "${name}" not found`);
    }
  }

  if (type === 'shaderpack') {
    const src = path.join(ROAMING_MINECRAFT, 'shaderpacks', name);
    const dest = path.join(INSTANCE_DIR, 'shaderpacks', name);
    if (await fs.pathExists(src)) {
      await fs.copy(src, dest, { overwrite: true });
      return { success: true, message: `Copied shaderpack "${name}" into local instance` };
    } else {
      throw new Error(`Shaderpack "${name}" not found`);
    }
  }

  throw new Error(`Unknown sync type: ${type}`);
}

module.exports = {
  getRoamingInfo,
  syncFromRoaming
};
