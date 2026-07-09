import { ipcMain, BrowserWindow, app, dialog } from 'electron';
import path from 'path';
import { asyncFs } from '../asyncFs';
import axios from 'axios';
import { LogManager } from '../managers/LogManager';
import { CacheManager } from '../managers/CacheManager';
import { InstallerManager } from '../managers/InstallerManager';
import { getPrisma } from '../managers/PrismaManager';
import { IPC_CHANNELS, APP_NAME, APP_VERSION, APP_REPO } from '../../shared/constants';

export function registerAppIpc() {
  ipcMain.handle(IPC_CHANNELS.GET_APP_INFO, async () => {
    return {
      name: APP_NAME,
      version: APP_VERSION,
      repo: APP_REPO,
      electron: process.versions.electron,
      node: process.versions.node,
      chrome: process.versions.chrome,
    };
  });

  ipcMain.handle(IPC_CHANNELS.CHECK_UPDATES, async () => {
    try {
      const response = await axios.get(`${APP_REPO}/releases/latest`, {
        headers: { 'User-Agent': 'FunkLobby/1.0', 'Accept': 'application/vnd.github.v3+json' },
        timeout: 10000,
      });
      const latestVersion = response.data.tag_name?.replace(/^v/, '') || '0.0.0';
      const hasUpdate = latestVersion.localeCompare(APP_VERSION, undefined, { numeric: true }) > 0;
      return { hasUpdate, latestVersion, currentVersion: APP_VERSION, releaseUrl: response.data.html_url };
    } catch {
      return { hasUpdate: false, latestVersion: APP_VERSION, currentVersion: APP_VERSION, releaseUrl: '' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.MINIMIZE_WINDOW, () => {
    BrowserWindow.getFocusedWindow()?.minimize();
  });

  ipcMain.handle(IPC_CHANNELS.MAXIMIZE_WINDOW, () => {
    const win = BrowserWindow.getFocusedWindow();
    if (win) {
      win.isMaximized() ? win.unmaximize() : win.maximize();
    }
  });

  ipcMain.handle(IPC_CHANNELS.CLOSE_WINDOW, () => {
    BrowserWindow.getFocusedWindow()?.close();
  });

  ipcMain.handle(IPC_CHANNELS.GET_LOGS, async (_event, level?: string) => {
    return await LogManager.getLogs(level);
  });

  ipcMain.handle(IPC_CHANNELS.CLEAR_ALL_DATA, async () => {
    const result = await dialog.showMessageBox({
      type: 'warning',
      buttons: ['Cancel', 'Clear Everything'],
      defaultId: 0,
      cancelId: 0,
      title: 'Clear All Data',
      message: 'This will delete ALL mods, downloads, profiles, engines, and reset all settings. This action cannot be undone.',
      detail: 'Are you sure you want to proceed?',
    });
    if (result.response !== 1) return { success: false, reason: 'cancelled' };

    const prisma = getPrisma();

    // 1. Delete all physical mod folders
    const installs = await prisma.install.findMany({ include: { mod: true } });
    for (const install of installs) {
      const folder = InstallerManager.getModFolderPath(install.enginePath, install.mod.title, install.mod.engine);
      if (folder && await asyncFs.exists(folder).catch(() => false)) {
        try { await asyncFs.rm(folder, { recursive: true, force: true }); } catch {}
      }
    }

    // 2. Delete all downloaded ZIP files
    const downloads = await prisma.download.findMany();
    for (const dl of downloads) {
      if (dl.filePath && await asyncFs.exists(dl.filePath).catch(() => false)) {
        try { await asyncFs.rm(dl.filePath, { recursive: true, force: true }); } catch {}
      }
    }

    // 3. Clear download temp folder
    const downloadFolder = path.join(app.getPath('userData'), 'downloads');
    if (await asyncFs.exists(downloadFolder).catch(() => false)) {
      try { await asyncFs.rm(downloadFolder, { recursive: true, force: true }); } catch {}
    }

    // 4. Clear standalone mods folder
    const standaloneFolder = path.join(app.getPath('userData'), 'standalone-mods');
    if (await asyncFs.exists(standaloneFolder).catch(() => false)) {
      try { await asyncFs.rm(standaloneFolder, { recursive: true, force: true }); } catch {}
    }

    // 5. Delete all database records
    await prisma.download.deleteMany();
    await prisma.install.deleteMany();
    await prisma.mod.deleteMany();
    await prisma.profile.deleteMany();
    await prisma.engine.deleteMany();
    await prisma.setting.deleteMany();
    await prisma.collection.deleteMany();
    await prisma.log.deleteMany();

    LogManager.info('All data cleared by user');
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.GET_CACHE_SIZE, async () => {
    return await CacheManager.getSize();
  });

  ipcMain.handle(IPC_CHANNELS.CLEAR_CACHE, async (_event, type?: 'api' | 'thumbnails' | 'all') => {
    if (type === 'api') await CacheManager.clearApi();
    else if (type === 'thumbnails') await CacheManager.clearThumbnails();
    else await CacheManager.clearAll();
    return { success: true };
  });
}
