const { app, BrowserWindow, shell } = require('electron');
const { startServer } = require('./server');

const gotTheLock = app.requestSingleInstanceLock();

let mainWindow;

if (!gotTheLock) {
  // If an instance is already running, gracefully quit the second instance
  app.quit();
} else {
  app.on('second-instance', () => {
    // Focus the existing window if user tries to open another instance
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  async function createWindow() {
    const boundPort = await startServer(3007);

    mainWindow = new BrowserWindow({
      width: 1150,
      height: 750,
      minWidth: 900,
      minHeight: 600,
      title: 'Fabric 1.21.1 Launcher',
      backgroundColor: '#0b0f19',
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: true
      }
    });

    // Load backend web server in the standalone desktop window
    mainWindow.loadURL(`http://localhost:${boundPort}`);

    // Open external links in default browser if needed
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: 'deny' };
    });

    mainWindow.on('closed', () => {
      mainWindow = null;
    });
  }

  app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
