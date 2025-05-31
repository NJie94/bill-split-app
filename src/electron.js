const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    }
  });

  // Load Angular's index.html from the built dist folder
  const indexPath = path.join(__dirname, 'dist', 'bill-split-app', 'index.html');
  mainWindow.loadFile(indexPath);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Your existing IPC stub remains if you still want local save:
ipcMain.handle('save-state', async (_, { key, data }) => {
  // e.g. write `data` to a file in app.getPath('userData'), if desired
  return true;
});
