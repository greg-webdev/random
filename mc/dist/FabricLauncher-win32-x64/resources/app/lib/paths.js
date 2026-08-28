const path = require('path');
const os = require('os');
const fs = require('fs-extra');

const ROOT_DIR = path.resolve(__dirname, '..');
const MODS_DIR = path.join(ROOT_DIR, 'mods');
const INSTANCE_DIR = path.join(ROOT_DIR, 'instance');
const ASSETS_DIR = path.join(ROOT_DIR, 'assets');
const LIBRARIES_DIR = path.join(ROOT_DIR, 'libraries');
const NATIVES_DIR = path.join(INSTANCE_DIR, 'natives');
const VERSIONS_DIR = path.join(ROOT_DIR, 'versions');

// Roaming .minecraft path
const ROAMING_MINECRAFT = path.join(os.homedir(), 'AppData', 'Roaming', '.minecraft');

// Ensure essential directories exist
fs.ensureDirSync(MODS_DIR);
fs.ensureDirSync(INSTANCE_DIR);
fs.ensureDirSync(ASSETS_DIR);
fs.ensureDirSync(LIBRARIES_DIR);
fs.ensureDirSync(NATIVES_DIR);
fs.ensureDirSync(VERSIONS_DIR);

module.exports = {
  ROOT_DIR,
  MODS_DIR,
  INSTANCE_DIR,
  ASSETS_DIR,
  LIBRARIES_DIR,
  NATIVES_DIR,
  VERSIONS_DIR,
  ROAMING_MINECRAFT,
};
