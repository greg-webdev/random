const { app, BrowserWindow, ipcMain, protocol, net, session } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;

// User data persistence paths
const userDataPath = app.getPath('userData');
const historyFile = path.join(userDataPath, 'browser_history.json');
const bookmarksFile = path.join(userDataPath, 'browser_bookmarks.json');
const settingsFile = path.join(userDataPath, 'browser_settings.json');

// Default configurations
const defaultSettings = {
  searchEngine: 'google', // google, duckduckgo, bing, brave
  homePage: 'chrome://newtab',
  theme: 'dark',
  enableAdBlocker: true,
  defaultZoom: 1.0
};

const defaultBookmarks = [
  { id: '1', title: 'Google', url: 'https://www.google.com', favicon: 'https://www.google.com/favicon.ico' },
  { id: '2', title: 'YouTube', url: 'https://www.youtube.com', favicon: 'https://www.youtube.com/favicon.ico' },
  { id: '3', title: 'GitHub', url: 'https://github.com', favicon: 'https://github.com/favicon.ico' },
  { id: '4', title: 'Wikipedia', url: 'https://www.wikipedia.org', favicon: 'https://www.wikipedia.org/favicon.ico' },
  { id: '5', title: 'Reddit', url: 'https://www.reddit.com', favicon: 'https://www.reddit.com/favicon.ico' },
  { id: '6', title: 'Chrome URLs', url: 'chrome://about', favicon: '' },
  { id: '7', title: 'Chromium Info', url: 'chrome://version', favicon: '' }
];

function readJsonFile(filePath, fallback) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (e) {
    console.error(`Error reading ${filePath}:`, e);
  }
  return fallback;
}

function writeJsonFile(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error(`Error writing ${filePath}:`, e);
  }
}

function resolveInternalPage(chromeUrl) {
  try {
    let clean = chromeUrl.replace(/^chrome:\/\//i, '').replace(/^\/+/, '').split('/')[0].split('?')[0].toLowerCase();
    const pageMap = {
      '': 'newtab.html',
      'newtab': 'newtab.html',
      'new-tab': 'newtab.html',
      'version': 'version.html',
      'about': 'urls.html',
      'chrome-urls': 'urls.html',
      'urls': 'urls.html',
      'history': 'history.html',
      'bookmarks': 'bookmarks.html',
      'downloads': 'downloads.html',
      'settings': 'settings.html',
      'flags': 'settings.html',
      'dino': 'dino.html',
      'help': 'version.html'
    };
    const target = pageMap[clean] || 'urls.html';
    const absPath = path.join(__dirname, 'src', 'internal_pages', target);
    return `file://${absPath.replace(/\\/g, '/')}`;
  } catch (e) {
    const fallback = path.join(__dirname, 'src', 'internal_pages', 'urls.html');
    return `file://${fallback.replace(/\\/g, '/')}`;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 640,
    minHeight: 480,
    title: 'Chromium Browser',
    backgroundColor: '#121316',
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
      spellcheck: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Track file downloads
  session.defaultSession.on('will-download', (event, item, webContents) => {
    const fileName = item.getFilename();
    const totalBytes = item.getTotalBytes();
    
    item.on('updated', (event, state) => {
      if (state === 'interrupted') {
        mainWindow?.webContents.send('download-updated', {
          id: item.getStartTime(),
          name: fileName,
          state: 'interrupted'
        });
      } else if (state === 'progressing') {
        mainWindow?.webContents.send('download-updated', {
          id: item.getStartTime(),
          name: fileName,
          state: item.isPaused() ? 'paused' : 'progressing',
          receivedBytes: item.getReceivedBytes(),
          totalBytes
        });
      }
    });

    item.once('done', (event, state) => {
      mainWindow?.webContents.send('download-updated', {
        id: item.getStartTime(),
        name: fileName,
        state: state === 'completed' ? 'completed' : 'cancelled',
        savePath: item.getSavePath(),
        receivedBytes: item.getReceivedBytes(),
        totalBytes
      });
    });
  });
}

// App lifecycle
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Event Handlers
ipcMain.handle('get-app-info', () => {
  return {
    chromiumVersion: process.versions.chrome,
    electronVersion: process.versions.electron,
    nodeVersion: process.versions.node,
    v8Version: process.versions.v8,
    osPlatform: process.platform,
    osArch: process.arch,
    userAgent: session.defaultSession.getUserAgent()
  };
});

ipcMain.handle('resolve-chrome-url', (event, url) => {
  return resolveInternalPage(url);
});

// Window controls
ipcMain.on('window-minimize', () => mainWindow?.minimize());
ipcMain.on('window-maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});
ipcMain.on('window-close', () => mainWindow?.close());
ipcMain.handle('is-window-maximized', () => mainWindow?.isMaximized() || false);

// History management
ipcMain.handle('get-history', () => readJsonFile(historyFile, []));
ipcMain.handle('add-history', (event, item) => {
  const history = readJsonFile(historyFile, []);
  if (history.length === 0 || history[0].url !== item.url) {
    history.unshift({
      id: Date.now().toString(),
      title: item.title || item.url,
      url: item.url,
      timestamp: Date.now()
    });
    if (history.length > 2000) history.pop();
    writeJsonFile(historyFile, history);
  }
  return history;
});
ipcMain.handle('clear-history', () => {
  writeJsonFile(historyFile, []);
  return [];
});

// Bookmarks management
ipcMain.handle('get-bookmarks', () => readJsonFile(bookmarksFile, defaultBookmarks));
ipcMain.handle('save-bookmarks', (event, bookmarks) => {
  writeJsonFile(bookmarksFile, bookmarks);
  return bookmarks;
});

// Settings management
ipcMain.handle('get-settings', () => readJsonFile(settingsFile, defaultSettings));
ipcMain.handle('save-settings', (event, settings) => {
  writeJsonFile(settingsFile, settings);
  return settings;
});
