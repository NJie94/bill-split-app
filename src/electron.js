// src/electron.js
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 1280,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    }
  });

  // __dirname === …/Split-Bill/src
  // Go up one level (to project root), then into dist/bill-split-app/browser/index.html
  const indexPath = path.join(
    __dirname,          // …/Split-Bill/src
    '..',               // …/Split-Bill
    'dist',
    'bill-split-app',
    'browser',
    'index.html'
  );

  console.log('✏️  Electron is loading:', indexPath);
  mainWindow.loadFile(indexPath).catch(err => {
    console.error('❌ Failed to load index.html:', err);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('save-state', async (_, { key, data }) => {
  // (Optional) Write data to disk under app.getPath('userData')
  return true;
});
