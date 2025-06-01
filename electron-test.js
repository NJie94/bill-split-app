// electron-test.js
const { app, BrowserWindow } = require('electron');

console.log('▶ electron-test.js has been loaded (PID:', process.pid, ')');

app.whenReady().then(() => {
  console.log('▶ Electron “ready” event fired');
  const win = new BrowserWindow({ width: 600, height: 400 });
  win.loadURL('about:blank').then(() => {
    console.log('▶ Window loaded about:blank');
  }).catch(err => {
    console.error('✖ Failed to load about:blank:', err);
  });
});

app.on('window-all-closed', () => {
  app.quit();
});
