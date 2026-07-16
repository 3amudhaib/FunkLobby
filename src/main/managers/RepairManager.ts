import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { getPrisma } from './PrismaManager';
import { LogManager } from './LogManager';
import { asyncFs } from '../asyncFs';
import { EngineManager } from './EngineManager';

export class RepairManager {
  static async autoRepair() {
    LogManager.info('Starting auto-repair and filesystem scan...');
    const prisma = getPrisma();

    await this.sweepCache();

    // 1. Migrate old engines from next-to-exe location to userData
    await EngineManager.migrateOldEngines();

    // 2. Validate all installed engines against disk
    await EngineManager.validateAllInstalledEngines();

    // 3. Validate mod installations
    const installs = await prisma.install.findMany({ include: { mod: true } });
    for (const install of installs) {
      const modFolder = path.join(install.enginePath, 'mods', this.sanitizeFolderName(install.mod.title));
      const standaloneFolder = path.join(install.enginePath, this.sanitizeFolderName(install.mod.title));

      const targetFolder = install.enginePath.includes('standalone-mods') ? standaloneFolder : modFolder;

      const exists = await asyncFs.exists(targetFolder).catch(() => false);
      if (!exists) {
        LogManager.warn('Found broken install path, marking as uninstalled', { modId: install.mod.id, path: targetFolder });
        await prisma.install.delete({ where: { id: install.id } });
        continue;
      }

      const cleanName = this.sanitizeFolderName(install.mod.title);
      const currentName = path.basename(targetFolder);
      if (cleanName !== currentName) {
        LogManager.info('Repairing invalid folder name', { old: currentName, new: cleanName });
        try {
          const newPath = path.join(path.dirname(targetFolder), cleanName);
          await asyncFs.rename(targetFolder, newPath);
        } catch (err) {
          LogManager.error('Failed to rename invalid folder', { error: String(err) });
        }
      }
    }

    // 4. Clean up orphan mod records
    const allMods = await prisma.mod.findMany({ include: { installs: true } });
    for (const mod of allMods) {
      if (mod.isInstalled && mod.installs.length === 0) {
        await prisma.mod.update({ where: { id: mod.id }, data: { isInstalled: false, installedAt: null } });
      }
    }

    LogManager.info('Auto-repair complete.');
  }

  private static async sweepCache() {
    try {
      const cacheBase = path.join(app.getPath('userData'), 'cache');
      const apiCache = path.join(cacheBase, 'api');
      const thumbCache = path.join(cacheBase, 'thumbnails');

      const DEFAULT_API_TTL = 3600_000;
      const DEFAULT_THUMBNAIL_TTL = 86400_000;

      await this.sweepDirAsync(apiCache, DEFAULT_API_TTL);
      await this.sweepDirAsync(thumbCache, DEFAULT_THUMBNAIL_TTL);
    } catch (err) {
      LogManager.error('Cache sweep failed', { error: String(err) });
    }
  }

  private static async sweepDirAsync(dir: string, ttl: number) {
    const exists = await asyncFs.exists(dir).catch(() => false);
    if (!exists) return;

    const now = Date.now();
    const entries = await asyncFs.readdir(dir, { withFileTypes: true }) as fs.Dirent[];
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      try {
        const stat = await asyncFs.stat(fullPath);
        if (now - stat.mtimeMs > ttl) {
          await asyncFs.unlink(fullPath);
        }
      } catch {}
    }
  }

  private static sanitizeFolderName(name: string): string {
    return name.replace(/[<>:"\/\\|?*.]/g, '_').trim().replace(/^_+|_+$/g, '') || 'unknown_mod';
  }
}
