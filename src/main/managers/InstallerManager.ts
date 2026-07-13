import path from 'path';
import { app } from 'electron';
import fs from 'fs';
import { getPrisma } from './PrismaManager';
import { ExtractionManager } from './ExtractionManager';
import { LogManager } from './LogManager';
import { asyncFs } from '../asyncFs';
import { STANDALONE_ENGINE_ID } from '../../shared/constants';
import { ENGINE_CATALOG } from '../../shared/engineTypes';

function sanitizeFolderName(name: string): string {
  return name.replace(/[<>:"\/\\|?*.]/g, '_').trim().replace(/^_+|_+$/g, '') || 'unknown_mod';
}

function getStandaloneRoot(): string {
  return path.join(app.getPath('userData'), 'standalone-mods');
}

export class InstallerManager {
  static async installMod(
    modId: string,
    archivePath: string,
    enginePath: string,
    profileId: string,
  ): Promise<{ installId: string; conflicts: string[] }> {
    LogManager.info('Installing mod', { modId, archivePath, enginePath });

    const archiveExists = await asyncFs.exists(archivePath).catch(() => false);
    if (!archiveExists) {
      // Try to locate a similar archive in the same folder (tolerate small filename mismatches/quotes)
      try {
        const dir = path.dirname(archivePath);
        const base = path.basename(archivePath).toLowerCase().replace(/[^a-z0-9\.]/g, '');
        if (await asyncFs.exists(dir).catch(() => false)) {
          const files = await asyncFs.readdir(dir) as string[];
          const candidates = files.filter(f => ['.zip', '.7z', '.rar'].includes(path.extname(f).toLowerCase()));
          let found: string | null = null;
          for (const c of candidates) {
            const comp = c.toLowerCase().replace(/[^a-z0-9\.]/g, '');
            if (comp.includes(base) || base.includes(comp) || comp.includes(modId.toLowerCase())) {
              found = path.join(dir, c);
              break;
            }
          }
          if (found && await asyncFs.exists(found).catch(() => false)) {
            LogManager.info('Found alternate archive path for install', { original: archivePath, found });
            archivePath = found;
          }
        }
      } catch (e) {
        LogManager.warn('Error while searching for alternate archive', { archivePath, error: String(e) });
      }
    }

    if (!await asyncFs.exists(archivePath).catch(() => false)) {
      throw new Error(`Archive file not found: ${archivePath}`);
    }

    const validation = await ExtractionManager.validateArchiveAsync(archivePath);
    if (!validation.valid) {
      throw new Error(validation.error || 'Invalid or corrupted archive file');
    }

    const prisma = getPrisma();
    const modData = await prisma.mod.findUnique({ where: { id: modId } });
    if (!modData) {
      throw new Error(`Mod not found in database: ${modId}`);
    }

    const isStandalone = modData.engine === STANDALONE_ENGINE_ID;
    const modsFolder = isStandalone
      ? getStandaloneRoot()
      : path.join(enginePath, 'mods');

    await asyncFs.ensureDir(modsFolder);

    const modFolderName = sanitizeFolderName(modData.title);
    const finalTargetPath = path.join(modsFolder, modFolderName);
    const resolvedEnginePath = isStandalone ? getStandaloneRoot() : enginePath;

    // Step 1: Extract to a temp directory
    const tempDir = path.join(modsFolder, `_install_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
    await asyncFs.ensureDir(tempDir);

    let extractedFiles: string[] = [];
    try {
      extractedFiles = await ExtractionManager.extractArchive(archivePath, tempDir);
    } catch (err) {
      await ExtractionManager.cleanupAsync(tempDir).catch(() => {});
      throw new Error(`Extraction failed: ${err}`);
    }

    if (extractedFiles.length === 0) {
      await ExtractionManager.cleanupAsync(tempDir).catch(() => {});
      throw new Error('Extraction failed: archive appears to be empty');
    }

    // Step 2: Detect mod root directory
    const detectedRoot = await this.detectModRoot(tempDir);
    if (!detectedRoot) {
      await ExtractionManager.cleanupAsync(tempDir).catch(() => {});
      const topLevel = await this.listTopLevel(tempDir);
      throw new Error(
        `Unsupported mod structure. Could not find expected mod files (assets/, data/, songs/, pack.json, etc.) in the archive.\n` +
        `Top-level contents: ${topLevel.join(', ')}`
      );
    }

    // Step 3: Move detected root to final target
    if (await asyncFs.exists(finalTargetPath).catch(() => false)) {
      try {
        await asyncFs.rm(finalTargetPath, { recursive: true, force: true });
      } catch {
        await ExtractionManager.cleanupAsync(tempDir).catch(() => {});
        throw new Error(`Installation failed: could not remove existing mod folder at ${finalTargetPath}`);
      }
    }

    try {
      await asyncFs.rename(detectedRoot, finalTargetPath);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'EXDEV') {
        try {
          await ExtractionManager.copyDirectoryAsync(detectedRoot, finalTargetPath);
          await ExtractionManager.cleanupAsync(detectedRoot);
        } catch (copyErr) {
          await ExtractionManager.cleanupAsync(tempDir).catch(() => {});
          throw new Error(`Installation failed: could not copy mod files to ${finalTargetPath}: ${copyErr}`);
        }
      } else {
        await ExtractionManager.cleanupAsync(tempDir).catch(() => {});
        throw new Error(`Installation failed: could not move mod to ${finalTargetPath}: ${err}`);
      }
    }

    // Clean up temp
    await ExtractionManager.cleanupAsync(tempDir).catch(() => {});

    // Step 4: Validate installed structure
    const validationErrors = await this.validateModStructure(finalTargetPath);
    if (validationErrors.length > 0) {
      LogManager.warn('Mod installed with validation warnings', { modId, warnings: validationErrors });
    }

    // Step 5: Attempt to read version/metadata and detect engine from installed folder
    const modUpdate: any = { isInstalled: true, installedAt: new Date().toISOString() };
    let detectedEngine: string | null = null;
    try {
      const tryFiles = ['pack.json', 'mod.json'];
      for (const f of tryFiles) {
        const p = path.join(finalTargetPath, f);
        if (await asyncFs.exists(p).catch(() => false)) {
          try {
            const content = (await asyncFs.readFile(p)) as string;
            const parsed = JSON.parse(content);
            if (parsed.version) modUpdate.version = parsed.version;
            else if (parsed._sVersion) modUpdate.version = parsed._sVersion;
            if (parsed.engine) {
              detectedEngine = InstallerManager.detectEngineFromMetadata(parsed.engine);
            }
            break;
          } catch {}
        }
      }
      // If no engine detected from metadata files, scan the folder
      if (!detectedEngine || detectedEngine === 'unknown') {
        const folderEngine = await InstallerManager.detectEngineFromFolder(finalTargetPath);
        if (folderEngine !== 'unknown') {
          detectedEngine = folderEngine;
        }
      }
      if (detectedEngine && detectedEngine !== 'unknown') {
        modUpdate.engine = detectedEngine;
      }
    } catch (err) {
      LogManager.warn('Failed to read installed mod metadata', { modId, error: String(err) });
    }

    if (modUpdate.engine === 'unknown') {
      delete modUpdate.engine;
    }

    await prisma.mod.update({ where: { id: modId }, data: modUpdate });

    // Step 6: Create install record in DB
    const install = await prisma.install.create({
      data: {
        modId,
        profileId,
        enginePath: resolvedEnginePath,
        status: 'installed',
        enabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });

    LogManager.info('Mod installed successfully', {
      modId,
      installId: install.id,
      targetPath: finalTargetPath,
      validationWarnings: validationErrors.length,
    });

    return { installId: install.id, conflicts: validationErrors };
  }

  private static async detectModRoot(extractedDir: string): Promise<string | null> {
    const entries = await this.listTopLevel(extractedDir);

    // Case 1: The extracted directory itself IS the mod root
    if (this.looksLikeModRoot(entries)) {
      return extractedDir;
    }

    // Case 2: Single subfolder contains the mod root (wrapping folder)
    const dirs = entries.filter(e => !e.startsWith('.'));
    if (dirs.length === 1) {
      const singleSub = path.join(extractedDir, dirs[0]);
      try {
        const stat = await asyncFs.stat(singleSub);
        if (stat.isDirectory()) {
          const subEntries = await asyncFs.readdir(singleSub) as string[];
          if (this.looksLikeModRoot(subEntries)) {
            return singleSub;
          }
        }
      } catch {}
    }

    // Case 3: Deep search - look for a folder that contains assets/ or data/ or pack.json
    const deepResult = await this.deepSearchForModRoot(extractedDir, 0, 3);
    if (deepResult) return deepResult;

    return null;
  }

  static detectEngineFromMetadata(engineStr: string): string {
    const known = ENGINE_CATALOG.map(e => e.id);
    const lower = engineStr.toLowerCase().replace(/[^a-z0-9+\-_. ]/g, '');
    const engineMap: Record<string, string> = {
      'psych': 'psych', 'psychengine': 'psych', 'psych engine': 'psych',
      'codename': 'codename', 'codenameengine': 'codename', 'codename engine': 'codename',
      'cdev': 'cdev', 'cdevengine': 'cdev', 'cdev engine': 'cdev',
      'yoshie': 'yoshicrafter', 'yoshicrafter': 'yoshicrafter', 'yoshicrafterengine': 'yoshicrafter', 'yoshi engine': 'yoshicrafter',
      'dragon': 'dragon', 'dragonengine': 'dragon', 'dragon engine': 'dragon',
      'shadow': 'shadow', 'shadowengine': 'shadow', 'shadow engine': 'shadow',
      'shattered': 'shattered', 'shatteredengine': 'shattered', 'shattered engine': 'shattered',
      'slushi': 'slushi', 'slushiengine': 'slushi', 'slushi engine': 'slushi',
      'troll': 'troll', 'trollengine': 'troll', 'troll engine': 'troll',
      'universe': 'universe', 'universeengine': 'universe', 'universe engine': 'universe',
      'plusengine': 'funkin-plus-plus', 'funkinplusplus': 'funkin-plus-plus', 'funkin++': 'funkin-plus-plus',
      'vslice': 'v-slice', 'v-slice': 'v-slice',
      'kade': 'kade', 'kadeengine': 'kade', 'kade engine': 'kade',
      'forever': 'forever', 'foreverengine': 'forever', 'forever engine': 'forever',
      'leather': 'leather', 'leatherengine': 'leather', 'leather engine': 'leather',
      'solar': 'solar', 'solarenigne': 'solar', 'solar engine': 'solar',
      'fps-plus': 'fps-plus', 'fpsplus': 'fps-plus', 'fps plus': 'fps-plus',
      'js-engine': 'js-engine', 'jsengine': 'js-engine', 'js engine': 'js-engine',
      'fnf-love': 'fnf-love', 'fnflove': 'fnf-love', 'fnf love': 'fnf-love', 'fnf love engine': 'fnf-love',
      'standalone': 'standalone',
    };
    return engineMap[lower] || (known.includes(lower) ? lower : 'unknown');
  }

  static async detectEngineFromFolder(folderPath: string): Promise<string> {
    try {
      const entries = await asyncFs.readdir(folderPath) as string[];
      const lower = entries.map(e => e.toLowerCase());

      // Check pack.json / mod.json first
      for (const metaFile of ['pack.json', 'mod.json']) {
        const idx = lower.indexOf(metaFile);
        if (idx !== -1) {
          try {
            const content = (await asyncFs.readFile(path.join(folderPath, entries[idx]))) as string;
            const parsed = JSON.parse(content);
            const engineVal = parsed.engine || parsed.type || '';
            if (engineVal) {
              const detected = InstallerManager.detectEngineFromMetadata(engineVal);
              if (detected !== 'unknown') return detected;
            }
          } catch {}
        }
      }

      // Check project.xml
      const projIdx = lower.indexOf('project.xml');
      if (projIdx !== -1) {
        try {
          const content = (await asyncFs.readFile(path.join(folderPath, entries[projIdx]))) as string;
          const engineId = InstallerManager.detectEngineFromProjectXml(content);
          if (engineId !== 'unknown') return engineId;
        } catch {}
      }

      // Check .hxproj files
      const hxprojFiles = entries.filter(e => e.endsWith('.hxproj') || e.endsWith('.hxp'));
      for (const hxf of hxprojFiles) {
        try {
          const content = (await asyncFs.readFile(path.join(folderPath, hxf))) as string;
          const lowerContent = content.toLowerCase();
          const engineId = InstallerManager.detectEngineFromHxproj(lowerContent);
          if (engineId !== 'unknown') return engineId;
        } catch {}
      }

      // Check for _polymod_ folder
      if (entries.some(e => e.startsWith('_polymod_'))) {
        return 'psych';
      }

      // Check executable files that match known engine names
      for (const entry of entries) {
        const el = entry.toLowerCase();
        for (const catalog of ENGINE_CATALOG) {
          for (const detectFile of catalog.detectFiles) {
            if (el === detectFile.toLowerCase()) {
              return catalog.id;
            }
          }
        }
      }

      return 'unknown';
    } catch {
      return 'unknown';
    }
  }

  private static detectEngineFromProjectXml(xmlContent: string): string {
    const lower = xmlContent.toLowerCase();
    if (lower.includes('vslice') || lower.includes('v-slice')) return 'v-slice';
    if (lower.includes('psych')) return 'psych';
    if (lower.includes('codename')) return 'codename';
    if (lower.includes('cdev')) return 'cdev';
    if (lower.includes('yoshie') || lower.includes('yoshi')) return 'yoshicrafter';
    if (lower.includes('dragon')) return 'dragon';
    if (lower.includes('shadow')) return 'shadow';
    if (lower.includes('shattered')) return 'shattered';
    if (lower.includes('slushi')) return 'slushi';
    if (lower.includes('troll')) return 'troll';
    if (lower.includes('universe')) return 'universe';
    if (lower.includes('kade')) return 'kade';
    if (lower.includes('forever')) return 'forever';
    if (lower.includes('leather')) return 'leather';
    if (lower.includes('fps') && lower.includes('plus')) return 'fps-plus';
    if (lower.includes('js') && lower.includes('engine')) return 'js-engine';
    if (lower.includes('fnf love') || lower.includes('love engine')) return 'fnf-love';
    return 'unknown';
  }

  private static detectEngineFromHxproj(lowerContent: string): string {
    if (lowerContent.includes('vslice') || lowerContent.includes('v-slice')) return 'v-slice';
    if (lowerContent.includes('psych')) return 'psych';
    if (lowerContent.includes('codename')) return 'codename';
    if (lowerContent.includes('cdev')) return 'cdev';
    if (lowerContent.includes('dragon')) return 'dragon';
    if (lowerContent.includes('shadow')) return 'shadow';
    if (lowerContent.includes('shattered')) return 'shattered';
    if (lowerContent.includes('slushi')) return 'slushi';
    if (lowerContent.includes('troll')) return 'troll';
    if (lowerContent.includes('universe')) return 'universe';
    if (lowerContent.includes('kade')) return 'kade';
    if (lowerContent.includes('forever')) return 'forever';
    if (lowerContent.includes('leather')) return 'leather';
    if (lowerContent.includes('yoshie') || lowerContent.includes('yoshi')) return 'yoshicrafter';
    if (lowerContent.includes('solar')) return 'solar';
    if (lowerContent.includes('fps') && lowerContent.includes('plus')) return 'fps-plus';
    if (lowerContent.includes('js')) return 'js-engine';
    if (lowerContent.includes('fnf love') || lowerContent.includes('love engine')) return 'fnf-love';
    return 'unknown';
  }

  private static looksLikeModRoot(entries: string[]): boolean {
    const lower = entries.map(e => e.toLowerCase());
    if (lower.includes('assets')) return true;
    if (lower.includes('data')) return true;
    if (lower.includes('songs')) return true;
    if (lower.includes('pack.json')) return true;
    if (lower.includes('mod.json')) return true;
    if (lower.includes('mods')) return true;
    return false;
  }

  private static async deepSearchForModRoot(dir: string, depth: number, maxDepth: number): Promise<string | null> {
    if (depth > maxDepth) return null;
    const entries = await asyncFs.readdir(dir, { withFileTypes: true }) as fs.Dirent[];
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
      const fullPath = path.join(dir, entry.name);
      try {
        const subEntries = await asyncFs.readdir(fullPath) as string[];
        if (this.looksLikeModRoot(subEntries)) return fullPath;
        const deeper = await this.deepSearchForModRoot(fullPath, depth + 1, maxDepth);
        if (deeper) return deeper;
      } catch {}
    }
    return null;
  }

  private static async listTopLevel(dir: string): Promise<string[]> {
    try {
      return await asyncFs.readdir(dir) as string[];
    } catch {
      return [];
    }
  }

  static async validateModStructure(modFolder: string): Promise<string[]> {
    const warnings: string[] = [];
    try {
      const entries = await asyncFs.readdir(modFolder) as string[];
      const lower = entries.map(e => e.toLowerCase());

      if (!lower.some(e => e === 'assets' || e.startsWith('assets'))) {
        warnings.push('Missing assets folder - mod may not display correctly');
      }
      if (!lower.some(e => e === 'data')) {
        warnings.push('Missing data folder - mod may not function correctly');
      }
      if (!lower.some(e => e === 'songs')) {
        warnings.push('Missing songs folder - mod may have no audio');
      }
      if (!lower.some(e => e === 'pack.json' || e === 'mod.json')) {
        warnings.push('Missing pack.json or mod.json metadata file');
      }

      const hasAnyModFile = entries.some((e: string) =>
        e.endsWith('.lua') || e.endsWith('.xml') || e.endsWith('.json') ||
        e.endsWith('.ogg') || e.endsWith('.png') || e.endsWith('.txt') ||
        e.endsWith('.mp3') || e.endsWith('.fla')
      );

      let hasSubdir = false;
      for (const e of entries) {
        try {
          const s = await asyncFs.stat(path.join(modFolder, e));
          if (s.isDirectory()) { hasSubdir = true; break; }
        } catch { continue; }
      }

      if (!hasAnyModFile && !hasSubdir) {
        warnings.push('Mod folder appears empty or contains no recognizable files');
      }

      return warnings;
    } catch {
      warnings.push('Could not read mod folder for validation');
      return warnings;
    }
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
