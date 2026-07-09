import { ipcMain } from 'electron';
import { EngineManager } from '../managers/EngineManager';
import { SettingsManager } from '../managers/SettingsManager';
import { getPrisma } from '../managers/PrismaManager';
import { GameBananaSearch } from '../managers/GameBananaSearch';
import { InstallerManager } from '../managers/InstallerManager';
import { asyncFs } from '../asyncFs';
import { IPC_CHANNELS, STANDALONE_ENGINE_ID } from '../../shared/constants';

export function registerEngineIpc() {
  ipcMain.handle(IPC_CHANNELS.GET_ENGINE_CATALOG, async () => {
    return EngineManager.getCatalog();
  });

  ipcMain.handle(IPC_CHANNELS.GET_ENGINES, async () => {
    return EngineManager.getAllInstalled();
  });

  ipcMain.handle(IPC_CHANNELS.GET_ENGINE, async (_event, id: string) => {
    return EngineManager.getEngineById(id);
  });

  ipcMain.handle(IPC_CHANNELS.INSTALL_ENGINE, async (_event, engineType: string) => {
    return EngineManager.installEngine(engineType);
  });

  ipcMain.handle(IPC_CHANNELS.UNINSTALL_ENGINE, async (_event, engineId: string) => {
    await EngineManager.uninstallEngine(engineId);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.LAUNCH_ENGINE, async (_event, engineId: string) => {
    const result = await EngineManager.launchEngine(engineId);
    if (!result.healthOk) {
      const prisma = getPrisma();
      const engine = await prisma.engine.findUnique({ where: { id: engineId } });
      if (engine) {
        await prisma.engine.update({
          where: { id: engineId },
          data: {
            status: 'broken_installation',
            error: result.exitCode !== undefined ? `Engine crashed on launch (exit code: ${result.exitCode})` : 'Engine failed to launch',
          },
        });
      }
    }
    return { success: result.healthOk, exitCode: result.exitCode };
  });

  ipcMain.handle(IPC_CHANNELS.CHECK_ENGINE_UPDATES, async (_event, engineType?: string) => {
    if (engineType) {
      return EngineManager.checkForUpdates(engineType);
    }
    return EngineManager.checkAllUpdates();
  });

  ipcMain.handle(IPC_CHANNELS.UPDATE_ENGINE, async (_event, engineId: string) => {
    await EngineManager.updateEngine(engineId);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.REPAIR_ENGINE, async (_event, engineId: string) => {
    await EngineManager.repairEngine(engineId);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.VERIFY_ENGINE, async (_event, engineId: string) => {
    return EngineManager.verifyEngine(engineId);
  });

  ipcMain.handle(IPC_CHANNELS.DETECT_ENGINES, async () => {
    return EngineManager.detectEngines();
  });

  ipcMain.handle(IPC_CHANNELS.OPEN_ENGINE_FOLDER, async (_event, engineId: string) => {
    const prisma = getPrisma();
    const engine = await prisma.engine.findUnique({ where: { id: engineId } });
    if (!engine) throw new Error('Engine not found');
    if (!engine.installPath) throw new Error('Engine not installed');
    await EngineManager.openFolder(engineId);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.SELECT_DEFAULT_ENGINE, async (_event, id: string) => {
    await SettingsManager.set('defaultEngine', id);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.LAUNCH_MOD, async (_event, modId: string, engineId: string) => {
    const prisma = getPrisma();
    const install = await prisma.install.findFirst({ where: { modId }, include: { mod: true } });
    if (!install) throw new Error('Mod not installed');
    if (!install.mod) throw new Error('Mod record not found');

    if (install.mod.engine === STANDALONE_ENGINE_ID) {
      const modFolder = InstallerManager.getModFolderPath('', install.mod.title, STANDALONE_ENGINE_ID);
      if (!await asyncFs.exists(modFolder).catch(() => false)) {
        throw new Error(`Standalone mod folder not found at ${modFolder}. Reinstall the mod.`);
      }
      const exe = await EngineManager.findEngineExe(modFolder);
      if (!exe) {
        const entries = await asyncFs.readdir(modFolder) as string[];
        const hasModFiles = entries.some(e =>
          e.endsWith('.lua') || e.endsWith('.xml') || e.endsWith('.json') ||
          e.endsWith('.png') || e.endsWith('.ogg') || e.endsWith('.txt')
        );
        if (hasModFiles) {
          const engineHint = GameBananaSearch.detectEngineFromMod({
            _sName: install.mod.title,
            _sDescription: install.mod.description || '',
            _sText: '',
            _aTags: [],
          });
          throw new Error(
            `This mod contains mod data (scripts, assets) but no executable. ` +
            `It was imported as "Standalone" but appears to be an engine-based mod. ` +
            `Try reinstalling with the "${engineHint}" engine instead.`
          );
        }
        throw new Error(
          `No executable found in standalone mod folder. ` +
          `This mod is not a standalone release. ` +
          `Try reinstalling the mod with a specific engine target.`
        );
      }
      await EngineManager.launchExe(exe, modFolder);
      return { success: true };
    }

    const engine = engineId
      ? await prisma.engine.findUnique({ where: { id: engineId } })
      : await prisma.engine.findFirst({ where: { type: install.mod.engine } });

    if (!engine) {
      const catalog = await EngineManager.getCatalog();
      const known = catalog.find(e => e.id === install.mod.engine);
      const engineName = known?.name || install.mod.engine;
      throw new Error(
        `Engine "${engineName}" is not installed. ` +
        `Go to Engines to install ${engineName}, then try launching again.`
      );
    }

    const modPath = InstallerManager.getModFolderPath(engine.installPath || '', install.mod.title, install.mod.engine);

    if (!await asyncFs.exists(modPath).catch(() => false)) {
      const standalonePath = InstallerManager.getModFolderPath('', install.mod.title, STANDALONE_ENGINE_ID);
      if (await asyncFs.exists(standalonePath).catch(() => false)) {
        throw new Error(`This mod was installed as standalone. Use the standalone launcher to play it.`);
      }
      throw new Error(`Mod folder not found at ${modPath}. The mod may have been deleted.`);
    }

    await EngineManager.launchMod(engine.installPath || '', modPath);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.CREATE_ENGINE_SHORTCUT, async (_event, engineId: string) => {
    await EngineManager.createShortcut(engineId);
    return { success: true };
  });

  ipcMain.handle(IPC_CHANNELS.GET_ENGINE_IMAGE, async (_event, engineType: string) => {
    return EngineManager.fetchEngineImage(engineType);
  });

  ipcMain.handle(IPC_CHANNELS.GET_ENGINE_LOGS, async (_event, engineId: string) => {
    return EngineManager.getEngineLogs(engineId);
  });
}
