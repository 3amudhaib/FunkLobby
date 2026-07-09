import { ipcMain, dialog, app } from 'electron';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { getPrisma } from '../managers/PrismaManager';
import { ModSourceManager } from '../managers/ModSourceManager';
import { GameBananaSearch } from '../managers/GameBananaSearch';
import { InstallerManager } from '../managers/InstallerManager';
import { DownloadManager } from '../managers/DownloadManager';
import { EngineManager } from '../managers/EngineManager';
import { ExtractionManager } from '../managers/ExtractionManager';
import { LogManager } from '../managers/LogManager';
import { asyncFs } from '../asyncFs';
import { IPC_CHANNELS, STANDALONE_ENGINE_ID } from '../../shared/constants';
import { ENGINE_CATALOG } from '../../shared/engineTypes';

const GAMEBANANA_CORE_API = 'https://api.gamebanana.com/Core';

async function resolveGameBananaDownloadUrl(mod: {
  sourceUrl?: string;
  sourceType?: string;
}): Promise<string | null> {
  const gbMatch = mod.sourceUrl?.match(/gamebanana\.com\/mods\/(\d+)/);
  if (!gbMatch) return null;

  const modId = gbMatch[1];
  try {
    const resp = await axios.get(`${GAMEBANANA_CORE_API}/Item/Data`, {
      params: {
        itemtype: 'Mod',
        itemid: modId,
        fields: 'Url().sDownloadUrl(),Files().aFiles()',
        format: 'json_min',
        return_keys: '1',
      },
      headers: {
        'User-Agent': 'FunkLobby/1.0',
        'Accept': 'application/json',
      },
      timeout: 10000,
    });
    const data = resp.data;
    if (data?.['Url().sDownloadUrl()']) {
      const url = data['Url().sDownloadUrl()'];
      LogManager.info('Resolved GameBanana download URL', { modId, url: url.substring(0, 100) });
      return url;
    }
    const files = data?.['Files().aFiles()'];
    if (files) {
      const firstKey = Object.keys(files)[0];
      if (firstKey && files[firstKey]?._sDownloadUrl) {
        const url = files[firstKey]._sDownloadUrl;
        LogManager.info('Resolved GameBanana file download URL', { modId, url: url.substring(0, 100) });
        return url;
      }
    }
    LogManager.warn('No download URL found in GameBanana response', { modId });
  } catch (err) {
    LogManager.error('Failed to resolve GameBanana download URL', { modId, error: String(err) });
  }
  return null;
}

function getDirectDownloadUrl(mod: { sourceUrl?: string }): string | null {
  if (!mod.sourceUrl) return null;
  const ext = path.extname(mod.sourceUrl).toLowerCase();
  if (['.zip', '.rar', '.7z'].includes(ext)) return mod.sourceUrl;
  return null;
}

function getGameBananaDirectLink(mod: { sourceUrl?: string }): string | null {
  if (!mod.sourceUrl) return null;
  const gbMatch = mod.sourceUrl.match(/gamebanana\.com\/mods\/(\d+)/);
  if (gbMatch) return `https://gamebanana.com/mods/download/${gbMatch[1]}`;
  return null;
}

function constructDownloadLinkFromModId(modId: string): string | null {
  const gbMatch = modId.match(/^gb_(\d+)$/);
  if (gbMatch) return `https://gamebanana.com/mods/download/${gbMatch[1]}`;
  return null;
}

async function pollDownload(
  downloadId: string,
  prisma: ReturnType<typeof getPrisma>,
  timeoutMs = 180000,
  intervalMs = 2000,
): Promise<any> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, intervalMs));
    const dl = await prisma.download.findUnique({ where: { id: downloadId } });
    if (!dl) throw new Error('Download record disappeared');
    if (dl.status === 'completed') return dl;
    if (dl.status === 'error') throw new Error(`Download failed: ${dl.error || 'unknown error'}`);
    if (dl.status === 'cancelled') throw new Error('Download was cancelled');
  }
  // Timeout reached - cancel the orphaned download
  try { await DownloadManager.cancelDownload(downloadId); } catch {}
  throw new Error('Download timed out');
}

export function registerModIpc() {
  ipcMain.handle(IPC_CHANNELS.SEARCH_MODS, async (_event, params) => {
    return await GameBananaSearch.searchMods(params);
  });

  ipcMain.handle(IPC_CHANNELS.GET_MOD_DETAILS, async (_event, gameBananaId: number) => {
    return await GameBananaSearch.getModDetails(gameBananaId);
  });

  ipcMain.handle(IPC_CHANNELS.GET_DOWNLOAD_URL, async (_event, gameBananaId: number) => {
    return await GameBananaSearch.getModDownloadUrl(gameBananaId);
  });

  ipcMain.handle(IPC_CHANNELS.SYNC_FROM_GAMEBANANA, async (_event, query?: string) => {
    return await GameBananaSearch.syncGameBananaMods(query);
  });

  ipcMain.handle(IPC_CHANNELS.GET_MOD, async (_event, id: string) => {
    const prisma = getPrisma();
    return await prisma.mod.findUnique({ where: { id } });
  });

  ipcMain.handle(IPC_CHANNELS.GET_FEATURED, async () => {
    return await GameBananaSearch.getFeaturedMods();
  });

  ipcMain.handle(IPC_CHANNELS.GET_TRENDING, async () => {
    return await GameBananaSearch.getTrendingMods();
  });

  ipcMain.handle(IPC_CHANNELS.GET_POPULAR, async () => {
    return await GameBananaSearch.getPopularMods();
  });

  ipcMain.handle(IPC_CHANNELS.GET_RECENTLY_PLAYED, async () => {
    return await ModSourceManager.getRecentlyPlayedMods();
  });

  ipcMain.handle(IPC_CHANNELS.GET_INSTALLED, async () => {
    const prisma = getPrisma();
    const installs = await prisma.install.findMany({
      include: { mod: true, profile: true },
      orderBy: { createdAt: 'desc' },
    });
    return installs.map(inst => ({
      ...inst.mod,
      installId: inst.id,
      enabled: inst.enabled,
      profileId: inst.profileId,
      enginePath: inst.enginePath,
      lastPlayedAt: inst.lastPlayedAt,
      backupPath: inst.backupPath,
      installCreatedAt: inst.createdAt,
    }));
  });

  ipcMain.handle(IPC_CHANNELS.GET_LIBRARY, async (_event, params) => {
    const prisma = getPrisma();
    const where: any = {};
    if (params?.query) {
      where.OR = [
        { title: { contains: params.query } },
        { author: { contains: params.query } },
      ];
    }
    if (params?.engine) where.engine = { contains: params.engine, mode: 'insensitive' };
    if (params?.category && params.category !== 'All') where.category = params.category;
    if (params?.favorites) where.isFavorited = true;
    if (params?.installed) where.isInstalled = true;

    let orderBy: any = { title: 'asc' };
    if (params?.sortBy === 'updated') orderBy = { updatedAt: 'desc' };
    else if (params?.sortBy === 'popular') orderBy = { downloadCount: 'desc' };

    return await prisma.mod.findMany({ where, orderBy });
  });

  ipcMain.handle(IPC_CHANNELS.FAVORITE_MOD, async (_event, id: string) => {
    const prisma = getPrisma();
    const mod = await prisma.mod.findUnique({ where: { id } });
    if (!mod) throw new Error('Mod not found');
    return await prisma.mod.update({
      where: { id },
      data: { isFavorited: !mod.isFavorited },
    });
  });

  ipcMain.handle(IPC_CHANNELS.DELETE_MOD, async (_event, id: string) => {
    const prisma = getPrisma();

    const activeDownloads = await prisma.download.findMany({ where: { modId: id, status: { in: ['pending', 'downloading'] } } });
    for (const dl of activeDownloads) {
      try { await DownloadManager.cancelDownload(dl.id); } catch {}
    }

    const installs = await prisma.install.findMany({ where: { modId: id }, include: { mod: true } });
    for (const install of installs) {
      const modFolder = InstallerManager.getModFolderPath(install.enginePath, install.mod.title, install.mod.engine);
      if (modFolder && await asyncFs.exists(modFolder).catch(() => false)) {
        try {
          await asyncFs.rm(modFolder, { recursive: true, force: true });
          LogManager.info('Deleted mod folder', { path: modFolder });
        } catch (err) {
          LogManager.error('Failed to delete mod folder', { path: modFolder, error: String(err) });
        }
      }
    }

    const downloads = await prisma.download.findMany({ where: { modId: id } });
    for (const dl of downloads) {
      if (dl.filePath && await asyncFs.exists(dl.filePath).catch(() => false)) {
        try {
          await asyncFs.rm(dl.filePath, { force: true });
        } catch {}
      }
    }

    // Wrap in a transaction-like flow: order matters so delete installs first, then downloads, then mod
    await prisma.install.deleteMany({ where: { modId: id } });
    await prisma.download.deleteMany({ where: { modId: id } });
    await prisma.mod.delete({ where: { id } });

    LogManager.info('Mod fully deleted', { id });
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.INSTALL_MOD, async (_event, modId: string, profileId: string, engineSelection?: string) => {
    const prisma = getPrisma();
    let mod = await prisma.mod.findUnique({ where: { id: modId } });

    let resolvedDownloadUrl: string | null = null;

    // If mod doesn't exist in DB (e.g. from a live search result), create it
    if (!mod) {
      const gbMatch = modId.match(/^gb_(\d+)$/);
      if (!gbMatch) throw new Error(`Mod "${modId}" not found in library`);
      const gbId = parseInt(gbMatch[1], 10);

      const detail = await GameBananaSearch.getModDetails(gbId);
      if (!detail) throw new Error('Could not fetch mod details from GameBanana');

      // Extract download URL from the detail response we already fetched
      const files = detail['Files().aFiles()'] || {};
      const firstFile = Object.values(files)[0] as any;
      const fileSize = firstFile?._nFilesize || 0;
      const thumbnailUrl = detail['Preview().sSubFeedImageUrl()'] || '';
      const profileUrl = detail['Url().sProfileUrl()'] || `https://gamebanana.com/mods/${gbId}`;
      const downloadCount = detail.downloads || 0;
      const autoEngine = engineSelection || GameBananaSearch.detectEngineFromMod(detail) || 'psych';

      // Use download URL directly from the detail, or construct a fallback
      if (firstFile?._sDownloadUrl) {
        resolvedDownloadUrl = firstFile._sDownloadUrl;
      }

      mod = await prisma.mod.create({
        data: {
          id: modId,
          title: detail.name || 'Unknown Mod',
          author: detail['Owner().name'] || 'Unknown',
          version: '1.0.0',
          description: detail.text || '',
          engine: autoEngine,
          category: 'Other',
          thumbnailUrl,
          bannerUrl: '',
          sourceUrl: profileUrl,
          sourceType: 'gamebanana',
          downloadCount,
          fileSize,
          tags: '', characters: '', songs: '', difficulty: 'Normal',
          screenshots: '', videos: '', dependencies: '', requirements: '',
          changelog: '', homepage: profileUrl,
        },
      });
    } else if (engineSelection && engineSelection !== mod.engine) {
      // User explicitly chose an engine — update the mod record
      mod = await prisma.mod.update({
        where: { id: modId },
        data: { engine: engineSelection },
      });
    }

    let download = await prisma.download.findFirst({
      where: { modId, status: 'completed' },
      orderBy: { createdAt: 'desc' },
    });

    if (!download) {
      // Use the download URL we already resolved, or try the fallback methods
      const downloadUrl = resolvedDownloadUrl ||
        (await resolveGameBananaDownloadUrl(mod)) ||
        getDirectDownloadUrl(mod) ||
        getGameBananaDirectLink(mod) ||
        constructDownloadLinkFromModId(modId);

      if (!downloadUrl) {
        throw new Error('No download URL available for this mod. Try downloading it first from the mod source.');
      }

      const fileName = `${mod.title.replace(/[<>:"/\\|?*]/g, '_')}.zip`;
      const downloadId = await DownloadManager.startDownload(modId, downloadUrl, fileName);
      download = await pollDownload(downloadId, prisma);
    }

    if (!download) {
      throw new Error('Failed to prepare download for installation');
    }

    const profile = await prisma.profile.findUnique({ where: { id: profileId } });
    if (!profile) throw new Error('Profile not found');

    let enginePath: string;
    const targetEngine = engineSelection || mod.engine;

    if (targetEngine === STANDALONE_ENGINE_ID) {
      enginePath = path.join(app.getPath('userData'), 'standalone-mods');
    } else {
      let engine = await prisma.engine.findFirst({ where: { type: targetEngine } });

      if (!engine) {
        const allEngines = await prisma.engine.findMany();
        if (allEngines.length === 0) {
          await EngineManager.detectEngines();
          engine = await prisma.engine.findFirst({ where: { type: targetEngine } });
        } else {
          engine = allEngines.find(e => e.type === targetEngine) || null;
        }
      }

      if (!engine || !engine.installPath) {
        const assetsEngineRoot = path.join(EngineManager.getAssetsEnginesPath(), targetEngine);
        if (await asyncFs.exists(assetsEngineRoot).catch(() => false)) {
          const exe = await EngineManager.findEngineExe(assetsEngineRoot);
          if (exe) {
            enginePath = path.dirname(exe);
          } else {
            const subDirs = (await asyncFs.readdir(assetsEngineRoot, { withFileTypes: true }) as fs.Dirent[])
              .filter(e => e.isDirectory());
            if (subDirs.length > 0) {
              const subExe = await EngineManager.findEngineExe(path.join(assetsEngineRoot, subDirs[0].name));
              enginePath = subExe ? path.dirname(subExe) : assetsEngineRoot;
            } else {
              enginePath = assetsEngineRoot;
            }
          }
        } else {
          throw new Error(
            `Engine "${targetEngine}" not found. Install the ${targetEngine} engine in Settings, ` +
            `or reinstall with a different engine target.`
          );
        }
      } else {
        enginePath = engine.installPath;
      }
    }

    return await InstallerManager.installMod(modId, download.filePath, enginePath, profileId);
  });

  ipcMain.handle(IPC_CHANNELS.UNINSTALL_MOD, async (_event, id: string) => {
    const prisma = getPrisma();
    const install = await prisma.install.findFirst({ where: { modId: id } });
    if (!install) throw new Error('Install not found for this mod');
    await InstallerManager.uninstallMod(install.id);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.ENABLE_MOD, async (_event, id: string) => {
    const prisma = getPrisma();
    const install = await prisma.install.findFirst({ where: { modId: id } });
    if (!install) throw new Error('Install not found');
    await InstallerManager.enableMod(install.id);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.DISABLE_MOD, async (_event, id: string) => {
    const prisma = getPrisma();
    const install = await prisma.install.findFirst({ where: { modId: id } });
    if (!install) throw new Error('Install not found');
    await InstallerManager.disableMod(install.id);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.DUPLICATE_MOD, async (_event, id: string) => {
    const prisma = getPrisma();
    const original = await prisma.mod.findUnique({ where: { id } });
    if (!original) throw new Error('Mod not found');
    return await prisma.mod.create({
      data: {
        title: `${original.title} (Copy)`,
        author: original.author,
        version: '1.0.0',
        description: original.description,
        engine: original.engine,
        tags: original.tags,
        category: original.category,
        homepage: original.homepage,
        bannerUrl: original.bannerUrl,
        thumbnailUrl: original.thumbnailUrl,
        fileSize: original.fileSize,
        sourceUrl: original.sourceUrl,
        sourceType: original.sourceType,
        dependencies: original.dependencies,
        requirements: original.requirements,
        changelog: original.changelog,
        screenshots: original.screenshots,
        videos: original.videos,
        characters: original.characters,
        songs: original.songs,
        difficulty: original.difficulty,
        isInstalled: false,
        installedAt: null,
      },
    });
  });

  ipcMain.handle(IPC_CHANNELS.BACKUP_MOD, async (_event, id: string) => {
    const prisma = getPrisma();
    const install = await prisma.install.findFirst({ where: { modId: id } });
    if (!install) throw new Error('Install not found');
    return await InstallerManager.backupMod(install.id);
  });

  ipcMain.handle(IPC_CHANNELS.RESTORE_MOD, async (_event, id: string, backupPath: string) => {
    const prisma = getPrisma();
    const install = await prisma.install.findFirst({ where: { modId: id } });
    if (!install) throw new Error('Install not found');
    await InstallerManager.restoreFromBackup(install.id, backupPath);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.EXPORT_MOD, async (_event, id: string) => {
    const prisma = getPrisma();
    const install = await prisma.install.findFirst({ where: { modId: id }, include: { mod: true } });
    if (!install) throw new Error('Install not found');

    const modFolder = InstallerManager.getModFolderPath(install.enginePath, install.mod.title, install.mod.engine);

    if (modFolder && await asyncFs.exists(modFolder).catch(() => false)) {
      const result = await dialog.showSaveDialog({
        defaultPath: `${install.mod.title}.zip`,
        filters: [{ name: 'ZIP Archive', extensions: ['zip'] }],
      });
      if (result.canceled || !result.filePath) throw new Error('Export cancelled');

      const { default: archiver } = await import('archiver');
      const output = fs.createWriteStream(result.filePath);
      const archive = archiver('zip', { zlib: { level: 9 } });
      archive.pipe(output);
      archive.directory(modFolder, false);
      await archive.finalize();
      return { path: result.filePath };
    }
    throw new Error('Mod folder not found');
  });

  ipcMain.handle(IPC_CHANNELS.IMPORT_MOD, async () => {
    const result = await dialog.showOpenDialog({
      filters: [{ name: 'ZIP Archives', extensions: ['zip', 'rar', '7z'] }],
      properties: ['openFile'],
    });
    if (result.canceled || result.filePaths.length === 0) throw new Error('Import cancelled');

    const filePath = result.filePaths[0];
    const fileName = path.basename(filePath, path.extname(filePath));

    const prisma = getPrisma();
    return await prisma.mod.create({
      data: {
        title: fileName,
        author: 'Imported',
        version: '1.0.0',
        description: 'Imported mod',
        engine: 'psych',
        category: 'Other',
        tags: '',
        homepage: '',
        bannerUrl: '',
        thumbnailUrl: '',
        fileSize: (await asyncFs.stat(filePath)).size,
        downloadCount: 0,
        sourceUrl: filePath,
        sourceType: 'import',
        dependencies: '',
        requirements: '',
        changelog: '',
        screenshots: '',
        videos: '',
        characters: '',
        songs: '',
        difficulty: 'Normal',
      },
    });
  });

  ipcMain.handle(IPC_CHANNELS.RENAME_MOD, async (_event, id: string, name: string) => {
    const prisma = getPrisma();
    const mod = await prisma.mod.findUnique({ where: { id } });
    if (!mod) throw new Error('Mod not found');

    // Rename the on-disk folder if the mod is installed
    if (mod.isInstalled) {
      const install = await prisma.install.findFirst({ where: { modId: id } });
      if (install) {
        const oldFolder = InstallerManager.getModFolderPath(install.enginePath, mod.title, mod.engine);
        const newFolderName = name.replace(/[<>:"\/\\|?*.]/g, '_').trim().replace(/^_+|_+$/g, '') || 'unknown_mod';
        const parentDir = mod.engine === STANDALONE_ENGINE_ID
          ? path.join(app.getPath('userData'), 'standalone-mods')
          : path.join(install.enginePath, 'mods');
        const newFolder = path.join(parentDir, newFolderName);

        if (await asyncFs.exists(oldFolder).catch(() => false) && !await asyncFs.exists(newFolder).catch(() => false)) {
          try {
            await asyncFs.rename(oldFolder, newFolder);
          } catch {}
        }
      }
    }

    return await prisma.mod.update({ where: { id }, data: { title: name } });
  });

  ipcMain.handle(IPC_CHANNELS.MOVE_MOD, async (_event, id: string, targetProfile: string) => {
    const prisma = getPrisma();
    const install = await prisma.install.findFirst({ where: { modId: id } });
    if (!install) throw new Error('Install not found');
    return await prisma.install.update({
      where: { id: install.id },
      data: { profileId: targetProfile },
    });
  });

  ipcMain.handle(IPC_CHANNELS.SELECT_LOCAL_MOD_FOLDER, async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Select Local Mod Folder',
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true };
    }

    const folderPath = result.filePaths[0];
    const folderName = path.basename(folderPath);

    // Read available engines from catalog + DB
    const engineDirs: Array<{ id: string; name: string }> = [];

    for (const entry of ENGINE_CATALOG) {
      engineDirs.push({ id: entry.id, name: entry.name });
    }

    try {
      const prisma = getPrisma();
      const dbEngines = await prisma.engine.findMany({ select: { type: true, name: true } });
      for (const db of dbEngines) {
        if (!engineDirs.some(e => e.id === db.type)) {
          engineDirs.push({ id: db.type, name: db.name });
        }
      }
    } catch {}

    // Standalone option
    engineDirs.push({ id: STANDALONE_ENGINE_ID, name: 'Standalone (No Engine)' });

    return { folderPath, folderName, engines: engineDirs };
  });

  ipcMain.handle(IPC_CHANNELS.SAVE_LOCAL_MOD, async (_event, params: {
    name: string; sourceFolder: string; engine: string; enginePath?: string;
  }) => {
    const { name, sourceFolder, engine } = params;
    if (!name || !sourceFolder) throw new Error('Name and source folder are required');
    if (!await asyncFs.exists(sourceFolder).catch(() => false)) throw new Error('Source folder not found');

    const prisma = getPrisma();

    // Get or create default profile
    let profile = await prisma.profile.findFirst({ where: { isDefault: true } });
    if (!profile) {
      profile = await prisma.profile.create({
        data: {
          name: 'Default',
          isDefault: true,
          color: '#3b82f6',
        },
      });
    }

    const isStandalone = engine === STANDALONE_ENGINE_ID;
    const modFolderName = sanitizeFolderName(name);

    // Determine target path
    let enginePath: string;
    if (isStandalone) {
      enginePath = path.join(app.getPath('userData'), 'standalone-mods');
    } else {
      // Look up engine path from DB or use assets fallback
      const dbEngine = await prisma.engine.findFirst({ where: { type: engine } });
      if (dbEngine?.installPath) {
        enginePath = dbEngine.installPath;
      } else {
        const assetsPath = path.join(EngineManager.getAssetsEnginesPath(), engine);
        if (await asyncFs.exists(assetsPath).catch(() => false)) {
          enginePath = assetsPath;
        } else {
          enginePath = params.enginePath || engine;
        }
      }
    }

    const modsFolder = isStandalone ? enginePath : path.join(enginePath, 'mods');
    await asyncFs.ensureDir(modsFolder);

    const targetPath = path.join(modsFolder, modFolderName);

    // Copy mod folder to target
    try {
      await ExtractionManager.copyDirectoryAsync(sourceFolder, targetPath);
    } catch (err) {
      throw new Error(`Failed to copy mod folder: ${err}`);
    }

    // Calculate total file size
    let totalSize = 0;
    try {
      const walkDir = async (dir: string) => {
        const entries = await asyncFs.readdir(dir, { withFileTypes: true }) as fs.Dirent[];
        for (const entry of entries) {
          const full = path.join(dir, entry.name);
          if (entry.isFile()) {
            const st = await asyncFs.stat(full);
            totalSize += st.size;
          } else if (entry.isDirectory()) {
            await walkDir(full);
          }
        }
      };
      await walkDir(targetPath);
    } catch {}

    // Create Mod record
    const mod = await prisma.mod.create({
      data: {
        title: name,
        author: 'Imported',
        version: '1.0.0',
        description: 'Local mod imported from ' + sourceFolder,
        engine: isStandalone ? STANDALONE_ENGINE_ID : engine,
        sourceType: 'local',
        sourceUrl: sourceFolder,
        category: 'Other',
        tags: '',
        homepage: '',
        bannerUrl: '',
        thumbnailUrl: '',
        fileSize: totalSize,
        downloadCount: 0,
        isInstalled: true,
        installedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        dependencies: '',
        requirements: '',
        changelog: '',
        screenshots: '',
        videos: '',
        characters: '',
        songs: '',
        difficulty: 'Normal',
      },
    });

    // Create Install record
    const resolvedEnginePath = isStandalone ? enginePath : enginePath;
    const install = await prisma.install.create({
      data: {
        modId: mod.id,
        profileId: profile.id,
        enginePath: resolvedEnginePath,
        status: 'installed',
        enabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });

    LogManager.info('Local mod imported', { modId: mod.id, name, sourceFolder });
    return { ...mod, installId: install.id, enabled: true };
  });

  ipcMain.handle(IPC_CHANNELS.VERIFY_INSTALLATION, async (_event, modId: string) => {
    const prisma = getPrisma();
    const install = await prisma.install.findFirst({ where: { modId } });
    if (!install) return { verified: false, error: 'No installation found' };
    const exists = await InstallerManager.verifyInstallation(install.id);
    return { verified: exists };
  });
}

/** Sanitize a folder name for use on disk */
function sanitizeFolderName(name: string): string {
  return name.replace(/[<>:"\/\\|?*.]/g, '_').trim().replace(/^_+|_+$/g, '') || 'unknown_mod';
}
