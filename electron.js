// electron.js
console.log('▶ electron.js has been loaded (PID:', process.pid, ')');
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const isDev = Boolean(process.env.ELECTRON_START_URL);

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    show: false, // we’ll show after load (or force show on error)
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    // — DEV mode: point at ng serve
    const url = process.env.ELECTRON_START_URL;
    console.log('→ DEV mode: loading URL:', url);
    mainWindow.loadURL(url).catch(err => {
      console.error('Failed to load dev URL:', err);
      mainWindow.show(); // show blank window so we can see errors
    });
    mainWindow.webContents.openDevTools();
  } else {
    // — PROD mode: load from dist/bill-split-app/browser/index.html
    const indexPath = path.join(
      __dirname,
      'dist',
      'bill-split-app',
      'browser',
      'index.html'
    );
    console.log('→ PROD mode: expecting index.html at:', indexPath);

    if (fs.existsSync(indexPath)) {
      // Use file:// URL explicitly to see any console errors in DevTools
      mainWindow.loadURL(`file://${indexPath}`).catch(err => {
        console.error('Error in loadURL(file://):', err);
        mainWindow.show();
      });
      // mainWindow.webContents.openDevTools();
    } else {
      console.error('✖✖✖ index.html not found at:', indexPath);
      // Force-show a blank window so you can inspect the DevTools console
      mainWindow.loadURL('about:blank');
      // mainWindow.webContents.openDevTools();
    }
  }

  // Ensure window is shown even if loadFile/loadURL failed
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => app.quit());
}

app.whenReady().then(createWindow);

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
