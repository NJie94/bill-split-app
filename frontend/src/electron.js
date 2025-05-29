// src/electron.js
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1024, height: 768,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    }
  });
  const url = process.env.ELECTRON_START_URL
    || `file://${path.join(__dirname, '../dist/bill-split-app/index.html')}`;
  win.loadURL(url);
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// Stub for future file-based state save
ipcMain.handle('save-state', async (_, { key, data }) => {
  // TODO: write to a JSON file
  return true;
});
