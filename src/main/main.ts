import { app, BrowserWindow, session, protocol, net } from 'electron';
import path from 'path';
import fs from 'fs';
import { registerAllIpc } from './ipc';
import { LogManager } from './managers/LogManager';
import { CacheManager } from './managers/CacheManager';
import { initDatabase } from './managers/PrismaManager';
import { ModSourceManager } from './managers/ModSourceManager';
import { RepairManager } from './managers/RepairManager';
import { UpdateManager } from './managers/UpdateManager';
import { ThemeIconManager } from './managers/ThemeIconManager';
import { resolvePackagedAssetPath } from './utils/packagedPathResolver';
import { asyncFs } from './asyncFs';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    frame: true,
    show: false,
    icon: resolvePackagedAssetPath(['assets', 'icon.ico']),
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
    console.log('MAIN_PROCESS: Window ready-to-show fired');
  });

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('MAIN_PROCESS: Renderer did-finish-load');
    // Check for renderer errors after a short delay
    setTimeout(() => {
      mainWindow?.webContents.executeJavaScript('console.log("RENDERER_ALIVE: JavaScript confirmed running in renderer")').catch(() => {});
    }, 1000);
  });

  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    const levels = ['verbose', 'info', 'warning', 'error'];
    const lvl = levels[level] || 'unknown';
    if (lvl === 'error' || lvl === 'warning') {
      console.log(`RENDERER_${lvl.toUpperCase()}: ${message} (${sourceId}:${line})`);
    }
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

  // Set Windows App User Model ID so the taskbar icon matches our custom icon
  app.setAppUserModelId('com.funklobby.app');

  // Ensure all required directories exist on every startup
  await ensureAppDirectories();

  await initDatabase();
  LogManager.markDbReady();
  CacheManager.init();

  // Run auto-repair logic on startup
  await RepairManager.autoRepair();

  // Background sync: populate DB with GameBanana mods
  ModSourceManager.getTrendingMods().catch(e => {
    LogManager.warn(`Failed to preload trending mods`, { error: String(e) });
  });

  protocol.handle('cover', (request) => {
    const filePath = decodeURIComponent(request.url.slice('cover://'.length));
    return new Response(fs.readFileSync(filePath), {
      headers: { 'Content-Type': 'image/png' },
    });
  });

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: file: cover:; font-src 'self' data:; connect-src 'self' http://localhost:* https:;",
        ],
      },
    });
  });

  registerAllIpc();
  createWindow();

  ThemeIconManager.loadSavedTheme().catch(e => {
    LogManager.warn('Failed to load saved theme icon', { error: String(e) });
  });

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
  console.error('UNCAUGHT EXCEPTION:', error.message, error.stack);
  LogManager.error('Uncaught exception', { error: error.message, stack: error.stack });
});

process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION:', String(reason));
  LogManager.error('Unhandled rejection', { reason: String(reason) });
});

/**
 * Create every required directory on startup so the app works
 * for any Windows user without manual configuration.
 */
async function ensureAppDirectories(): Promise<void> {
  const userData = app.getPath('userData');
  const dirs = [
    userData,
    path.join(userData, 'engines'),
    path.join(userData, 'mods'),
    path.join(userData, 'standalone-mods'),
    path.join(userData, 'downloads'),
    path.join(userData, 'cache'),
    path.join(userData, 'cache', 'api'),
    path.join(userData, 'cache', 'thumbnails'),
    path.join(userData, 'temp'),
    path.join(userData, 'covers'),
    path.join(userData, 'logs'),
    path.join(userData, 'profiles'),
    path.join(userData, 'repo-validation'),
    path.join(userData, 'engine-releases'),
    path.join(userData, 'engine-images'),
    path.join(userData, 'update-cache'),
    path.join(userData, 'update-backup'),
  ];

  let anyFailed = false;
  for (const dir of dirs) {
    try {
      await asyncFs.ensureDir(dir);
    } catch (err) {
      LogManager.error('Failed to create directory', { dir, error: String(err) });
      anyFailed = true;
    }
  }

  if (anyFailed) {
    LogManager.warn('Some directories could not be created. Some features may not work.');
  } else {
    LogManager.info('All app directories verified/created successfully');
  }
}
