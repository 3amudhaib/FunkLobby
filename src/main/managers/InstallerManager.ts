import path from 'path';
import { app } from 'electron';
import { getPrisma } from './PrismaManager';
import { ExtractionManager } from './ExtractionManager';
import { LogManager } from './LogManager';
import { asyncFs } from '../asyncFs';
import { STANDALONE_ENGINE_ID } from '../../shared/constants';

function sanitizeFolderName(name: string): string {
  return name.replace(/[<>:"\/\\|?*.]/g, '_').trim().replace(/^_+|_+$/g, '') || 'unknown_mod';
}

function getStandaloneRoot(): string {
  return path.join(app.getPath('userData'), 'standalone-mods');
}

export class InstallerManager {
  static async installMod(
    modId: string,
    zipPath: string,
    enginePath: string,
    profileId: string,
  ): Promise<{ installId: string; conflicts: string[] }> {
    LogManager.info('Installing mod', { modId, zipPath, enginePath });

    const zipExists = await asyncFs.exists(zipPath).catch(() => false);
    if (!zipExists) {
      throw new Error(`ZIP file not found: ${zipPath}`);
    }

    const validZip = await ExtractionManager.validateZipAsync(zipPath);
    if (!validZip) {
      throw new Error('Invalid or corrupted ZIP file');
    }

    const prisma = getPrisma();
    const modData = await prisma.mod.findUnique({ where: { id: modId } });
    if (!modData) {
      throw new Error(`Mod not found: ${modId}`);
    }

    const isStandalone = modData.engine === STANDALONE_ENGINE_ID;
    const modsFolder = isStandalone
      ? getStandaloneRoot()
      : path.join(enginePath, 'mods');

    await asyncFs.ensureDir(modsFolder);

    const modFolderName = sanitizeFolderName(modData.title);
    let targetPath = path.join(modsFolder, modFolderName);

    const resolvedEnginePath = isStandalone ? getStandaloneRoot() : enginePath;

    const backupFolder = path.join(modsFolder, '.backups');
    await asyncFs.ensureDir(backupFolder);

    let extracted: string[] = [];
    let conflicts: string[] = [];
    let backupPath: string | null = null;

    try {
      if (await asyncFs.exists(targetPath).catch(() => false)) {
        const backupResult = await ExtractionManager.backupAndExtract(zipPath, targetPath, backupFolder);
        extracted = backupResult.extracted;
        backupPath = backupResult.backupPath;
        conflicts = backupResult.restored ? [] : [];
      } else {
        const result = await ExtractionManager.extractWithOverwriteCheck(zipPath, targetPath);
        extracted = result.extracted;
        conflicts = result.conflicts;

        if (conflicts.length > 0) {
          const cbPath = path.join(backupFolder, `conflict_backup_${Date.now()}`);
          await asyncFs.ensureDir(cbPath);
          for (const conflict of conflicts) {
            const srcPath = path.join(targetPath, conflict);
            if (await asyncFs.exists(srcPath).catch(() => false)) {
              const destDir = path.dirname(path.join(cbPath, conflict));
              await asyncFs.ensureDir(destDir);
              await asyncFs.copyFile(srcPath, path.join(cbPath, conflict)).catch(() => {});
            }
          }
          await ExtractionManager.extractZip(zipPath, targetPath);
        }
      }
    } catch (err) {
      LogManager.error('Installation failed', { modId, error: String(err) });
      throw new Error(`Installation failed: ${err}`);
    }

    const install = await prisma.install.create({
      data: {
        modId,
        profileId,
        enginePath: resolvedEnginePath,
        status: 'installed',
        enabled: true,
        backupPath,
      },
    });

    await prisma.mod.update({
      where: { id: modId },
      data: { isInstalled: true, installedAt: new Date().toISOString() },
    });

    LogManager.info('Mod installed successfully', { modId, installId: install.id });
    return { installId: install.id, conflicts };
  }

  static async uninstallMod(installId: string) {
    const prisma = getPrisma();
    const install = await prisma.install.findUnique({
      where: { id: installId },
      include: { mod: true },
    });
    if (!install) throw new Error('Install not found');

    const modFolder = this.getModFolderPath(install.enginePath, install.mod.title, install.mod.engine);

    if (modFolder && await asyncFs.exists(modFolder).catch(() => false)) {
      try {
        await asyncFs.rm(modFolder, { recursive: true, force: true });
        LogManager.info('Mod folder removed', { path: modFolder });
      } catch (err) {
        LogManager.error('Failed to remove mod folder', { path: modFolder, error: String(err) });
      }
    } else if (modFolder) {
      const parent = path.dirname(modFolder);
      if (await asyncFs.exists(parent).catch(() => false)) {
        try {
          const entries = await asyncFs.readdir(parent) as string[];
          for (const entry of entries) {
            if (entry.toLowerCase().includes(sanitizeFolderName(install.mod.title).substring(0, 20))) {
              const found = path.join(parent, entry);
              try { await asyncFs.rm(found, { recursive: true, force: true }); } catch {}
              break;
            }
          }
        } catch {}
      }
    }

    await prisma.install.delete({ where: { id: installId } });

    const remainingInstalls = await prisma.install.findMany({ where: { modId: install.modId } });
    if (remainingInstalls.length === 0) {
      await prisma.mod.update({
        where: { id: install.modId },
        data: { isInstalled: false, installedAt: null },
      });
    }
  }

  static async enableMod(installId: string) {
    const prisma = getPrisma();
    const install = await prisma.install.findUnique({
      where: { id: installId },
      include: { mod: true },
    });
    if (!install) throw new Error('Install not found');

    const modFolderName = sanitizeFolderName(install.mod.title);
    const parentDir = install.mod.engine === STANDALONE_ENGINE_ID
      ? getStandaloneRoot()
      : path.join(install.enginePath, 'mods');
    const disabledDir = path.join(parentDir, '_disabled');
    const disabledPath = path.join(disabledDir, modFolderName);
    const targetPath = path.join(parentDir, modFolderName);

    const disabledExists = await asyncFs.exists(disabledPath).catch(() => false);
    const targetExists = await asyncFs.exists(targetPath).catch(() => false);

    if (disabledExists && !targetExists) {
      try {
        await asyncFs.rename(disabledPath, targetPath);
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'EXDEV') {
          await ExtractionManager.copyDirectoryAsync(disabledPath, targetPath);
          await ExtractionManager.cleanupAsync(disabledPath);
        } else {
          throw err;
        }
      }
    }

    await prisma.install.update({ where: { id: installId }, data: { enabled: true } });
  }

  static async disableMod(installId: string) {
    const prisma = getPrisma();
    const install = await prisma.install.findUnique({
      where: { id: installId },
      include: { mod: true },
    });
    if (!install) throw new Error('Install not found');

    const modFolderName = sanitizeFolderName(install.mod.title);
    const parentDir = install.mod.engine === STANDALONE_ENGINE_ID
      ? getStandaloneRoot()
      : path.join(install.enginePath, 'mods');
    const modFolder = path.join(parentDir, modFolderName);
    const disabledDir = path.join(parentDir, '_disabled');
    const disabledPath = path.join(disabledDir, `${modFolderName}_${Date.now()}`);

    if (await asyncFs.exists(modFolder).catch(() => false)) {
      await asyncFs.ensureDir(disabledDir);
      try {
        await asyncFs.rename(modFolder, disabledPath);
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'EXDEV') {
          await ExtractionManager.copyDirectoryAsync(modFolder, disabledPath);
          await ExtractionManager.cleanupAsync(modFolder);
        } else {
          throw err;
        }
      }
    }

    await prisma.install.update({ where: { id: installId }, data: { enabled: false } });
  }

  static async restoreFromBackup(installId: string, backupPath: string) {
    const prisma = getPrisma();
    const install = await prisma.install.findUnique({
      where: { id: installId },
      include: { mod: true },
    });
    if (!install) throw new Error('Install not found');

    if (!await asyncFs.exists(backupPath).catch(() => false)) {
      throw new Error('Backup path not found');
    }

    const targetPath = this.getModFolderPath(install.enginePath, install.mod.title, install.mod.engine);

    const tempRestore = path.join(path.dirname(targetPath), `_restore_${Date.now()}`);
    try {
      await ExtractionManager.copyDirectoryAsync(backupPath, tempRestore);

      if (await asyncFs.exists(targetPath).catch(() => false)) {
        await asyncFs.rm(targetPath, { recursive: true, force: true });
      }

      await asyncFs.rename(tempRestore, targetPath);
    } catch (err) {
      await ExtractionManager.cleanupAsync(tempRestore);
      throw new Error(`Restore failed: ${err}`);
    }
  }

  static async backupMod(installId: string): Promise<string> {
    const prisma = getPrisma();
    const install = await prisma.install.findUnique({
      where: { id: installId },
      include: { mod: true },
    });
    if (!install) throw new Error('Install not found');

    const modFolder = this.getModFolderPath(install.enginePath, install.mod.title, install.mod.engine);

    if (!await asyncFs.exists(modFolder).catch(() => false)) {
      throw new Error('Mod folder not found');
    }

    const backupFolder = install.mod.engine === STANDALONE_ENGINE_ID
      ? path.join(getStandaloneRoot(), '.backups', `backup_${installId}_${Date.now()}`)
      : path.join(install.enginePath, 'mods', '.backups', `backup_${installId}_${Date.now()}`);
    await asyncFs.ensureDir(backupFolder);

    await ExtractionManager.copyDirectoryAsync(modFolder, backupFolder);

    await prisma.install.update({ where: { id: installId }, data: { backupPath: backupFolder } });

    return backupFolder;
  }

  private static async checkConflicts(zipPath: string, targetPath: string): Promise<string[]> {
    const conflicts: string[] = [];
    if (!await asyncFs.exists(targetPath).catch(() => false)) return conflicts;

    const tempDir = path.join(path.dirname(zipPath), `_check_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
    try {
      await ExtractionManager.extractZip(zipPath, tempDir);
      const entries = await asyncFs.readdir(tempDir) as string[];
      for (const entry of entries) {
        const fullPath = path.join(tempDir, entry as string);
        try {
          const stat = await asyncFs.stat(fullPath);
          if (stat.isFile()) {
            const target = path.join(targetPath, entry as string);
            if (await asyncFs.exists(target).catch(() => false)) {
              conflicts.push(entry as string);
            }
          }
        } catch {}
      }
      await ExtractionManager.cleanupAsync(tempDir);
    } catch {
      await ExtractionManager.cleanupAsync(tempDir).catch(() => {});
    }

    return conflicts;
  }

  static async verifyInstallation(installId: string): Promise<boolean> {
    const prisma = getPrisma();
    const install = await prisma.install.findUnique({
      where: { id: installId },
      include: { mod: true },
    });
    if (!install) return false;

    const modFolder = this.getModFolderPath(install.enginePath, install.mod.title, install.mod.engine);

    const exists = await asyncFs.exists(modFolder).catch(() => false);
    if (!exists) return false;

    const entries = await asyncFs.readdir(modFolder) as string[];
    if (entries.length === 0) return false;

    const hasModFile = entries.some((e: string) =>
      e.endsWith('.lua') || e.endsWith('.xml') || e.endsWith('.json') ||
      e.endsWith('.txt') || e.endsWith('.png') || e.endsWith('.ogg')
    );
    if (!hasModFile && entries.length < 3) return false;

    return true;
  }

  static getModFolderPath(enginePath: string, modTitle: string, engineType: string): string {
    const folderName = sanitizeFolderName(modTitle);
    if (engineType === STANDALONE_ENGINE_ID) {
      return path.join(getStandaloneRoot(), folderName);
    }
    return path.join(enginePath, 'mods', folderName);
  }
}
