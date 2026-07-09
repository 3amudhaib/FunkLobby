import { ipcMain, dialog, shell, clipboard, app } from 'electron';
import path from 'path';
import { getPrisma } from '../managers/PrismaManager';
import { EngineManager } from '../managers/EngineManager';
import { asyncFs } from '../asyncFs';
import { IPC_CHANNELS, STANDALONE_ENGINE_ID } from '../../shared/constants';

export function registerFileIpc() {
  ipcMain.handle(IPC_CHANNELS.OPEN_MOD_FOLDER, async (_event, id: string) => {
    const prisma = getPrisma();

    // Empty ID → open the engine's mods root folder
    if (!id) {
      const defaultEngine = await prisma.setting.findUnique({ where: { key: 'defaultEngine' } });
      let engine = await prisma.engine.findFirst({ where: { type: defaultEngine?.value || 'psych' } });

      // If no engines in DB yet, try auto-detecting on the fly
      if (!engine) {
        const totalEngines = await prisma.engine.count();
        if (totalEngines === 0) {
          await EngineManager.detectEngines();
          engine = await prisma.engine.findFirst({ where: { type: defaultEngine?.value || 'psych' } });
        }
      }

      // If still no engine, try using the assets/engines/psych path directly
      if (!engine || !engine.installPath) {
        const psychPath = path.join(EngineManager.getAssetsEnginesPath(), 'psych', 'psych engine');
        if (await asyncFs.exists(psychPath).catch(() => false)) {
          const modsFolder = path.join(psychPath, 'mods');
          await asyncFs.ensureDir(modsFolder);
          await shell.openPath(modsFolder);
          return { success: true };
        }
      } else if (engine.installPath) {
        const modsFolder = path.join(engine.installPath, 'mods');
        if (await asyncFs.exists(modsFolder).catch(() => false)) {
          await shell.openPath(modsFolder);
          return { success: true };
        }
      }
      throw new Error('No engine configured. Configure an engine in Settings first.');
    }

    const install = await prisma.install.findFirst({ where: { modId: id }, include: { mod: true } });
    if (!install) throw new Error('Mod is not installed yet. Install it first to open its folder.');
    if (!install.mod) throw new Error('Associated mod record not found');

    // Standalone mod — open its own installation folder
    if (install.mod.engine === STANDALONE_ENGINE_ID) {
      const standaloneRoot = path.join(app.getPath('userData'), 'standalone-mods');
      const modFolderName = install.mod.title.replace(/[<>:"\/\\|?*]/g, '_');
      const modFolder = path.join(standaloneRoot, modFolderName);
      if (await asyncFs.exists(modFolder).catch(() => false)) {
        await shell.openPath(modFolder);
        return { success: true };
      }
      throw new Error(`Standalone mod folder not found at: ${modFolder}`);
    }

    const modFolderName = install.mod.title.replace(/[<>:"\/\\|?*]/g, '_');
    const modFolder = path.join(install.enginePath, 'mods', modFolderName);
    if (await asyncFs.exists(modFolder).catch(() => false)) {
      await shell.openPath(modFolder);
    } else {
      throw new Error(`Mod folder not found at: ${modFolder}. The mod may have been deleted or moved.`);
    }
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.REVEAL_IN_EXPLORER, async (_event, filePath: string) => {
    if (!await asyncFs.exists(filePath).catch(() => false)) {
      throw new Error(`File not found: ${filePath}`);
    }
    await shell.showItemInFolder(filePath);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.COPY_PATH, async (_event, filePath: string) => {
    clipboard.writeText(filePath);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.SELECT_FOLDER, async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true };
    }
    return { path: result.filePaths[0] };
  });

  ipcMain.handle(IPC_CHANNELS.SELECT_FILE, async (_event, filters?: any[]) => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: filters || [{ name: 'All Files', extensions: ['*'] }],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true };
    }
    return { path: result.filePaths[0] };
  });
}
