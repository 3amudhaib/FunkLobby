import { app, BrowserWindow, session } from 'electron';
import path from 'path';
import { registerAllIpc } from './ipc';
import { LogManager } from './managers/LogManager';
import { CacheManager } from './managers/CacheManager';
import { initDatabase } from './managers/PrismaManager';
import { ModSourceManager } from './managers/ModSourceManager';
import { RepairManager } from './managers/RepairManager';
import { UpdateManager } from './managers/UpdateManager';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    frame: true,
    show: false,
    icon: path.join(__dirname, '../../assets/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    backgroundColor: '#020617',
    titleBarStyle: 'hidden',
  });

  mainWindow.setTitle('FunkLobby');

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  if (process.env.NODE_ENV === 'development' || process.argv.includes('--dev')) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  LogManager.info('Application starting...');

  await initDatabase();
  LogManager.markDbReady();
  CacheManager.init();

  // Run auto-repair logic on startup
  await RepairManager.autoRepair();

  // Background sync: populate DB with GameBanana mods
  ModSourceManager.getTrendingMods().catch(e => {
    LogManager.warn(`Failed to preload trending mods`, { error: String(e) });
  });

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' http://localhost:* https:;",
        ],
      },
    });
  });

  registerAllIpc();
  createWindow();

  UpdateManager.checkOnStartup().catch(e => {
    LogManager.warn('Auto-update check on startup failed', { error: String(e) });
  });

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

app.on('before-quit', () => {
  LogManager.info('Application shutting down...');
  UpdateManager.cleanup().catch(() => {});
});

process.on('uncaughtException', (error) => {
  LogManager.error('Uncaught exception', { error: error.message, stack: error.stack });
});

process.on('unhandledRejection', (reason) => {
  LogManager.error('Unhandled rejection', { reason: String(reason) });
});
