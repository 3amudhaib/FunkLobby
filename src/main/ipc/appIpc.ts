import { ipcMain, BrowserWindow, app, dialog } from 'electron';
import path from 'path';
import { asyncFs } from '../asyncFs';
import axios from 'axios';
import { LogManager } from '../managers/LogManager';
import { CacheManager } from '../managers/CacheManager';
import { InstallerManager } from '../managers/InstallerManager';
import { EngineManager } from '../managers/EngineManager';
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

  /** Clear cache only — thumbnails, temp downloads, API cache. Keeps everything else. */
  ipcMain.handle(IPC_CHANNELS.CLEAR_CACHE_ONLY, async () => {
    // Clear API + thumbnail cache
    await CacheManager.clearAll().catch(() => {});
    // Clear temp download folder
    const downloadFolder = path.join(app.getPath('userData'), 'downloads');
    if (await asyncFs.exists(downloadFolder).catch(() => false)) {
      try {
        const entries = await asyncFs.readdir(downloadFolder) as string[];
        for (const entry of entries) {
          try { await asyncFs.rm(path.join(downloadFolder, entry), { recursive: true, force: true }); } catch {}
        }
      } catch {}
    }
    // Clear repo validation cache
    const repoCache = path.join(app.getPath('userData'), 'repo-validation');
    if (await asyncFs.exists(repoCache).catch(() => false)) {
      try { await asyncFs.rm(repoCache, { recursive: true, force: true }); } catch {}
    }
    // Clear engine release cache
    const releaseCache = path.join(app.getPath('userData'), 'engine-releases');
    if (await asyncFs.exists(releaseCache).catch(() => false)) {
      try { await asyncFs.rm(releaseCache, { recursive: true, force: true }); } catch {}
    }
    LogManager.info('Cache cleared by user');
    return { success: true };
  });

  /** Reset app — clears DB, settings, favorites, history, metadata.
   *  Keeps installed engine folders and mod folders on disk.
   *  DB records are removed; next startup will rescan and recreate them. */
  ipcMain.handle(IPC_CHANNELS.RESET_APP_KEEP_FILES, async () => {
    const result = await dialog.showMessageBox({
      type: 'warning',
      buttons: ['Cancel', 'Reset App'],
      defaultId: 0,
      cancelId: 0,
      title: 'Reset App',
      message: 'This will reset all application data (database, settings, favorites, history, metadata).',
      detail: 'Installed engines and mods will NOT be deleted. They will be re-detected on next startup.\n\nThis action cannot be undone.',
    });
    if (result.response !== 1) return { success: false, reason: 'cancelled' };

    const prisma = getPrisma();

    // Delete all DB records but KEEP engines and mods on disk
    await prisma.download.deleteMany();
    await prisma.install.deleteMany();
    await prisma.mod.deleteMany();
    await prisma.profile.deleteMany();
    await prisma.engine.deleteMany();
    await prisma.setting.deleteMany();
    await prisma.collection.deleteMany();
    await prisma.log.deleteMany();

    // Clear cache + temp downloads
    await CacheManager.clearAll().catch(() => {});
    const downloadFolder = path.join(app.getPath('userData'), 'downloads');
    if (await asyncFs.exists(downloadFolder).catch(() => false)) {
      try { await asyncFs.rm(downloadFolder, { recursive: true, force: true }); } catch {}
    }

    // Recreate default settings
    const { DEFAULT_SETTINGS } = await import('../../shared/constants');
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS || {})) {
      const strValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
      await prisma.setting.upsert({
        where: { key },
        create: { key, value: strValue },
        update: { value: strValue },
      }).catch(() => {});
    }

    LogManager.info('App reset by user (engines and mods kept on disk)');
    return { success: true };
  });

  /** Factory reset — removes EVERYTHING including installed engines and mods. */
  ipcMain.handle(IPC_CHANNELS.CLEAR_ALL_DATA, async () => {
    const result = await dialog.showMessageBox({
      type: 'warning',
      buttons: ['Cancel', 'Factory Reset'],
      defaultId: 0,
      cancelId: 0,
      title: 'Factory Reset',
      message: 'This will delete EVERYTHING: all engines, mods, downloads, profiles, settings, cache, and metadata.',
      detail: 'Your installed engines and mods will be permanently deleted from disk.\n\nThis action CANNOT be undone.\n\nAre you absolutely sure?',
    });
    if (result.response !== 1) return { success: false, reason: 'cancelled' };

    const prisma = getPrisma();

    // Delete all physical mod folders
    const installs = await prisma.install.findMany({ include: { mod: true } });
    for (const install of installs) {
      const folder = InstallerManager.getModFolderPath(install.enginePath, install.mod.title, install.mod.engine);
      if (folder && await asyncFs.exists(folder).catch(() => false)) {
        try { await asyncFs.rm(folder, { recursive: true, force: true }); } catch {}
      }
    }

    // Delete all downloaded ZIP files
    const downloads = await prisma.download.findMany();
    for (const dl of downloads) {
      if (dl.filePath && await asyncFs.exists(dl.filePath).catch(() => false)) {
        try { await asyncFs.rm(dl.filePath, { recursive: true, force: true }); } catch {}
      }
    }

    // Clear download temp folder
    const downloadFolder = path.join(app.getPath('userData'), 'downloads');
    if (await asyncFs.exists(downloadFolder).catch(() => false)) {
      try { await asyncFs.rm(downloadFolder, { recursive: true, force: true }); } catch {}
    }

    // Clear standalone mods folder
    const standaloneFolder = path.join(app.getPath('userData'), 'standalone-mods');
    if (await asyncFs.exists(standaloneFolder).catch(() => false)) {
      try { await asyncFs.rm(standaloneFolder, { recursive: true, force: true }); } catch {}
    }

    // Delete ALL installed engines on disk
    const enginesRoot = path.join(app.getPath('userData'), 'engines');
    if (await asyncFs.exists(enginesRoot).catch(() => false)) {
      try { await asyncFs.rm(enginesRoot, { recursive: true, force: true }); } catch {}
    }

    // Delete engine images cache
    const imageCacheDir = path.join(app.getPath('userData'), 'engine-images');
    if (await asyncFs.exists(imageCacheDir).catch(() => false)) {
      try { await asyncFs.rm(imageCacheDir, { recursive: true, force: true }); } catch {}
    }

    // Delete engine release cache
    const releaseCacheDir = path.join(app.getPath('userData'), 'engine-releases');
    if (await asyncFs.exists(releaseCacheDir).catch(() => false)) {
      try { await asyncFs.rm(releaseCacheDir, { recursive: true, force: true }); } catch {}
    }

    // Delete repo validation cache
    const repoCacheDir = path.join(app.getPath('userData'), 'repo-validation');
    if (await asyncFs.exists(repoCacheDir).catch(() => false)) {
      try { await asyncFs.rm(repoCacheDir, { recursive: true, force: true }); } catch {}
    }

    // Clear cache (api + thumbnails)
    const cacheBase = path.join(app.getPath('userData'), 'cache');
    if (await asyncFs.exists(cacheBase).catch(() => false)) {
      try { await asyncFs.rm(cacheBase, { recursive: true, force: true }); } catch {}
    }

    // Clear engine import temp
    const engineImportDir = path.join(app.getPath('userData'), 'engine-import');
    if (await asyncFs.exists(engineImportDir).catch(() => false)) {
      try { await asyncFs.rm(engineImportDir, { recursive: true, force: true }); } catch {}
    }

    // Delete all database records
    await prisma.download.deleteMany();
    await prisma.install.deleteMany();
    await prisma.mod.deleteMany();
    await prisma.profile.deleteMany();
    await prisma.engine.deleteMany();
    await prisma.setting.deleteMany();
    await prisma.collection.deleteMany();
    await prisma.log.deleteMany();

    // Recreate default settings
    const { DEFAULT_SETTINGS } = await import('../../shared/constants');
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS || {})) {
      const strValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
      await prisma.setting.upsert({
        where: { key },
        create: { key, value: strValue },
        update: { value: strValue },
      }).catch(() => {});
    }

    LogManager.info('Factory reset by user');
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

  // ── Diagnostics ──────────────────────────────────────────────────

  ipcMain.handle(IPC_CHANNELS.RUN_DIAGNOSTICS, async () => {
    const results: Array<{ check: string; status: 'ok' | 'warn' | 'fail'; message: string }> = [];
    const prisma = getPrisma();
    const userData = app.getPath('userData');

    // 1. Database connection
    try {
      await prisma.$queryRaw`SELECT 1`;
      results.push({ check: 'Database', status: 'ok', message: 'Connected' });
    } catch (err) {
      results.push({ check: 'Database', status: 'fail', message: `Connection failed: ${String(err)}` });
    }

    // 2. Required directories
    const requiredDirs = [
      { name: 'User Data Root', path: userData },
      { name: 'Engines', path: path.join(userData, 'engines') },
      { name: 'Standalone Mods', path: path.join(userData, 'standalone-mods') },
      { name: 'Downloads', path: path.join(userData, 'downloads') },
      { name: 'Cache', path: path.join(userData, 'cache') },
      { name: 'Temp', path: path.join(userData, 'temp') },
      { name: 'Covers', path: path.join(userData, 'covers') },
      { name: 'Logs', path: path.join(userData, 'logs') },
    ];
    for (const dir of requiredDirs) {
      try {
        const exists = await asyncFs.exists(dir.path).catch(() => false);
        if (exists) {
          results.push({ check: `Folder: ${dir.name}`, status: 'ok', message: dir.path });
        } else {
          results.push({ check: `Folder: ${dir.name}`, status: 'fail', message: `Missing: ${dir.path}` });
        }
      } catch {
        results.push({ check: `Folder: ${dir.name}`, status: 'fail', message: `Cannot access: ${dir.path}` });
      }
    }

    // 3. Engine integrity
    const engines = await prisma.engine.findMany({ where: { status: { in: ['installed', 'update_available'] } } });
    if (engines.length === 0) {
      results.push({ check: 'Engines', status: 'warn', message: 'No engines installed' });
    }
    for (const engine of engines) {
      if (!engine.installPath) {
        results.push({ check: `Engine: ${engine.name}`, status: 'fail', message: 'No install path in database' });
        continue;
      }
      const pathExists = await asyncFs.exists(engine.installPath).catch(() => false);
      if (!pathExists) {
        results.push({ check: `Engine: ${engine.name}`, status: 'fail', message: `Folder missing: ${engine.installPath}` });
        continue;
      }
      if (!engine.exePath) {
        results.push({ check: `Engine: ${engine.name}`, status: 'warn', message: 'No executable path in database' });
        continue;
      }
      const exeExists = await asyncFs.exists(engine.exePath).catch(() => false);
      if (!exeExists) {
        results.push({ check: `Engine: ${engine.name}`, status: 'fail', message: `Executable missing: ${engine.exePath}` });
      } else {
        results.push({ check: `Engine: ${engine.name}`, status: 'ok', message: `Ready at ${engine.exePath}` });
      }
    }

    // 4. Mod installation integrity
    const installs = await prisma.install.findMany({ include: { mod: true } });
    if (installs.length === 0) {
      results.push({ check: 'Installed Mods', status: 'warn', message: 'No mods installed' });
    }
    for (const inst of installs) {
      const target = InstallerManager.getModFolderPath(inst.enginePath, inst.mod.title, inst.mod.engine);
      const exists = target ? await asyncFs.exists(target).catch(() => false) : false;
      if (exists && target) {
        results.push({ check: `Mod: ${inst.mod.title}`, status: 'ok', message: `Installed at ${target}` });
      } else {
        results.push({ check: `Mod: ${inst.mod.title}`, status: 'fail', message: `Files missing: ${target || inst.enginePath}` });
      }
    }

    // 5. User data directory write permissions
    try {
      const testFile = path.join(userData, '.write_test');
      await asyncFs.writeFile(testFile, 'test');
      await asyncFs.unlink(testFile);
      results.push({ check: 'Permissions', status: 'ok', message: 'User data directory is writable' });
    } catch {
      results.push({ check: 'Permissions', status: 'fail', message: `Cannot write to ${userData}` });
    }

    return results;
  });

  // ── Repair Installation ──────────────────────────────────────────

  ipcMain.handle(IPC_CHANNELS.REPAIR_INSTALLATION, async () => {
    const results: string[] = [];
    const prisma = getPrisma();
    const userData = app.getPath('userData');

    // 1. Recreate missing directories
    const dirs = [
      path.join(userData, 'engines'),
      path.join(userData, 'standalone-mods'),
      path.join(userData, 'downloads'),
      path.join(userData, 'cache'),
      path.join(userData, 'cache', 'api'),
      path.join(userData, 'cache', 'thumbnails'),
      path.join(userData, 'temp'),
      path.join(userData, 'covers'),
      path.join(userData, 'logs'),
    ];
    let recreatedCount = 0;
    for (const dir of dirs) {
      const exists = await asyncFs.exists(dir).catch(() => false);
      if (!exists) {
        try {
          await asyncFs.ensureDir(dir);
          results.push(`Created missing directory: ${path.basename(dir)}`);
          recreatedCount++;
        } catch (err) {
          results.push(`Failed to create directory ${path.basename(dir)}: ${String(err)}`);
        }
      }
    }
    if (recreatedCount === 0) results.push('All required directories exist');

    // 2. Remove invalid installed engine records (files missing)
    const engines = await prisma.engine.findMany({ where: { status: { in: ['installed', 'update_available'] } } });
    let engineFixCount = 0;
    for (const engine of engines) {
      if (!engine.installPath || !await asyncFs.exists(engine.installPath).catch(() => false)) {
        await prisma.engine.update({
          where: { id: engine.id },
          data: { status: 'not_installed', installPath: null, exePath: null },
        });
        results.push(`Marked engine "${engine.name}" as not installed (missing folder)`);
        engineFixCount++;
        continue;
      }
      if (!engine.exePath || !await asyncFs.exists(engine.exePath).catch(() => false)) {
        // Try to re-detect executable
        const exe = await EngineManager.findEngineExe(engine.installPath);
        if (exe) {
          await prisma.engine.update({ where: { id: engine.id }, data: { exePath: exe } });
          results.push(`Re-detected executable for engine "${engine.name}": ${exe}`);
          engineFixCount++;
        } else {
          await prisma.engine.update({
            where: { id: engine.id },
            data: { status: 'broken_installation', exePath: null },
          });
          results.push(`Engine "${engine.name}" has no executable — marked as broken`);
          engineFixCount++;
        }
      }
    }
    if (engineFixCount === 0) results.push('All engine records are consistent with disk');

    // 3. Remove invalid installed mod records
    const installs = await prisma.install.findMany({ include: { mod: true } });
    let modFixCount = 0;
    for (const inst of installs) {
      const target = InstallerManager.getModFolderPath(inst.enginePath, inst.mod.title, inst.mod.engine);
      const exists = target ? await asyncFs.exists(target).catch(() => false) : false;
      if (!exists) {
        await prisma.install.delete({ where: { id: inst.id } });
        await prisma.mod.update({ where: { id: inst.modId }, data: { isInstalled: false, installedAt: null } });
        results.push(`Removed install record for "${inst.mod.title}" (files missing)`);
        modFixCount++;
      }
    }
    if (modFixCount === 0) results.push('All mod install records are consistent with disk');

    // 4. Clear corrupted cache
    try {
      await CacheManager.clearAll();
      results.push('Cache cleared');
    } catch {
      results.push('Failed to clear cache');
    }

    return results;
  });

  ipcMain.handle('cache:getCachedThumbnail', async (_event, url: string) => {
    const cached = await CacheManager.getThumbnail(url);
    if (cached) {
      const base64 = cached.toString('base64');
      const mime = url.match(/\.(png|jpe?g|gif|webp)/i)?.[1]?.replace('jpe', 'jpeg') || 'jpeg';
      return `data:image/${mime};base64,${base64}`;
    }
    try {
      const resp = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 10000,
        headers: { 'User-Agent': 'FunkLobby/1.0' },
      });
      await CacheManager.setThumbnail(url, Buffer.from(resp.data));
      const base64 = Buffer.from(resp.data).toString('base64');
      const mime = url.match(/\.(png|jpe?g|gif|webp)/i)?.[1]?.replace('jpe', 'jpeg') || 'jpeg';
      return `data:image/${mime};base64,${base64}`;
    } catch {
      return url;
    }
  });
}
