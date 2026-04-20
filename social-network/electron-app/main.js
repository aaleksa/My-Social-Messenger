const { app, BrowserWindow, ipcMain, Notification, dialog, session, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const SESSION_FILE = path.join(app.getPath('userData'), 'session.json');
const REGISTER_URL = 'http://localhost:3000/register';

let mainWindow = null;

function loadSession() {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      return JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
    }
  } catch (_) {}
  return null;
}

function saveSession(data) {
  try {
    fs.writeFileSync(SESSION_FILE, JSON.stringify(data), 'utf8');
  } catch (_) {}
}

function clearSession() {
  try { fs.unlinkSync(SESSION_FILE); } catch (_) {}
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 800,
    minHeight: 560,
    title: 'Social Messenger',
    backgroundColor: '#1a1a2e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Prevent renderer from navigating away from the local HTML
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) event.preventDefault();
  });
  // Open all external links in the system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (!mainWindow) createWindow(); });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ── IPC handlers ─────────────────────────────────────────────────────────────

ipcMain.handle('session:load', () => loadSession());
ipcMain.handle('session:save', (_, data) => { saveSession(data); });
ipcMain.handle('session:clear', () => { clearSession(); });

ipcMain.handle('open:register', () => {
  shell.openExternal(REGISTER_URL);
});

ipcMain.handle('notify', (_, { title, body }) => {
  if (Notification.isSupported()) {
    new Notification({ title, body, silent: false }).show();
  }
});

ipcMain.handle('pick-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }],
  });
  return result.filePaths[0] || null;
});
