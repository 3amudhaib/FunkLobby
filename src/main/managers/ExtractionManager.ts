import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import extractZip from 'extract-zip';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { LogManager } from './LogManager';
import { asyncFs } from '../asyncFs';

function tempDirName(baseDir: string): string {
  return path.join(baseDir, `_temp_${crypto.randomBytes(4).toString('hex')}`);
}

type ArchiveFormat = 'zip' | '7z' | 'rar' | 'unknown';

let _cliCache: { sevenZip: string | null } = { sevenZip: null };

async function findSevenZip(): Promise<string | null> {
  if (_cliCache.sevenZip !== undefined) return _cliCache.sevenZip;
  const candidates = [
    'C:\\Program Files\\7-Zip\\7z.exe',
    'C:\\Program Files (x86)\\7-Zip\\7z.exe',
    '7z',
    '7za',
  ];
  for (const exe of candidates) {
    try {
      await fsp.access(exe);
      _cliCache.sevenZip = exe;
      return exe;
    } catch {
      // try next
    }
  }
  // If candidates didn't pass fsp.access (which fails for PATH names), try executing '7z' to see if it's available on PATH
  try {
    await new Promise<void>((resolve, reject) => {
      const p = execFile('7z', ['--help'], { timeout: 5000 }, (err) => {
        if (err) return reject(err);
        resolve();
      });
      // if the process couldn't be spawned, reject will fire
    });
    _cliCache.sevenZip = '7z';
    return '7z';
  } catch {}

  _cliCache.sevenZip = null;
  return null;
}

async function readMagicBytes(filePath: string, bytes: number = 8): Promise<Buffer> {
  const fd = await fsp.open(filePath, 'r');
  const buf = Buffer.alloc(bytes);
  await fd.read(buf, 0, bytes, 0);
  await fd.close();
  return buf;
}

export class ExtractionManager {
  static detectArchiveFormat(archivePath: string): Promise<ArchiveFormat> {
    return this._detectFormat(archivePath);
  }

  private static async _detectFormat(filePath: string): Promise<ArchiveFormat> {
    try {
      const buf = await readMagicBytes(filePath, 8);
      if (buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04) return 'zip';
      if (buf[0] === 0x37 && buf[1] === 0x7a && buf[2] === 0xbc && buf[3] === 0xaf && buf[4] === 0x27 && buf[5] === 0x1c) return '7z';
      if (buf[0] === 0x52 && buf[1] === 0x61 && buf[2] === 0x72 && buf[3] === 0x21) return 'rar';
      const ext = path.extname(filePath).toLowerCase();
      if (ext === '.zip') return 'zip';
      if (ext === '.7z') return '7z';
      if (ext === '.rar') return 'rar';
      return 'unknown';
    } catch {
      return 'unknown';
    }
  }

  static async extractArchive(archivePath: string, destination: string): Promise<string[]> {
    LogManager.info('Extracting archive', { archivePath, destination });
    const format = await this._detectFormat(archivePath);
    switch (format) {
      case 'zip':
        return this.extractZip(archivePath, destination);
      case '7z':
      case 'rar':
        return this.extractWithCli(archivePath, destination, format);
      default:
        throw new Error(`Unsupported archive format: ${format}. Only ZIP, 7z, and RAR are supported.`);
    }
  }

  static async extractZip(zipPath: string, destination: string): Promise<string[]> {
    LogManager.info('Extracting ZIP', { zipPath, destination });

    if (!await asyncFs.exists(zipPath).catch(() => false)) {
      throw new Error(`Archive not found: ${zipPath}`);
    }

    const resolvedDest = path.resolve(destination);
    await asyncFs.ensureDir(destination);

    try {
      await extractZip(zipPath, { dir: resolvedDest });
    } catch (err) {
      LogManager.error('ZIP extraction failed', { zipPath, error: String(err) });
      throw new Error(`Extraction failed: ${err}`);
    }

    const extracted = await this.listFilesAsync(destination);
    return extracted;
  }

  private static async extractWithCli(archivePath: string, destination: string, format: ArchiveFormat): Promise<string[]> {
    const sevenZip = await findSevenZip();
    if (!sevenZip) {
      throw new Error(
        `${format.toUpperCase()} extraction requires 7-Zip. Please install 7-Zip (https://www.7-zip.org/) and try again.`
      );
    }

    await asyncFs.ensureDir(destination);
    const resolvedDest = path.resolve(destination);

    return new Promise((resolve, reject) => {
      execFile(sevenZip, ['x', archivePath, `-o${resolvedDest}`, '-y'], { timeout: 120000 }, async (err) => {
        if (err) {
          LogManager.error('7z extraction failed', { archivePath, error: err.message });
          reject(new Error(`Extraction failed: ${err.message}`));
          return;
        }
        try {
          const files = await this.listFilesAsync(destination);
          resolve(files);
        } catch (e) {
          reject(new Error(`Extraction failed: could not read output directory`));
        }
      });
    });
  }

  private static async listFilesAsync(dir: string): Promise<string[]> {
    const files: string[] = [];
    const entries = await asyncFs.readdir(dir, { withFileTypes: true }) as fs.Dirent[];
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...await this.listFilesAsync(fullPath));
      } else {
        files.push(fullPath);
      }
    }
    return files;
  }

  static async validateZipAsync(zipPath: string): Promise<boolean> {
    try {
      if (!await asyncFs.exists(zipPath).catch(() => false)) {
        return false;
      }
      const stat = await asyncFs.stat(zipPath);
      if (stat.size === 0) return false;
      const buf = await readMagicBytes(zipPath, 4);
      return buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04;
    } catch { return false; }
  }

  static async validateArchiveAsync(archivePath: string): Promise<{ valid: boolean; format: ArchiveFormat; error?: string }> {
    try {
      if (!await asyncFs.exists(archivePath).catch(() => false)) {
        return { valid: false, format: 'unknown', error: 'Archive file not found' };
      }
      const stat = await asyncFs.stat(archivePath);
      if (stat.size === 0) {
        return { valid: false, format: 'unknown', error: 'Archive file is empty' };
      }
      const format = await this._detectFormat(archivePath);
      if (format === 'unknown') {
        return { valid: false, format, error: 'Unrecognized archive format. Expected ZIP, 7z, or RAR.' };
      }
      return { valid: true, format };
    } catch (e) {
      return { valid: false, format: 'unknown', error: `Could not read archive: ${e}` };
    }
  }

  static validateZip(zipPath: string): boolean {
    return false;
  }

  static async extractWithOverwriteCheck(
    archivePath: string,
    destination: string,
  ): Promise<{ extracted: string[]; conflicts: string[] }> {
    const validation = await this.validateArchiveAsync(archivePath);
    if (!validation.valid) throw new Error(validation.error || 'Invalid or corrupted archive');

    const conflicts: string[] = [];
    const tempDir = tempDirName(path.dirname(archivePath));
    try {
      const extracted = await this.extractArchive(archivePath, tempDir);
      for (const file of extracted) {
        const relativePath = path.relative(tempDir, file);
        const targetPath = path.join(destination, relativePath);
        if (await asyncFs.exists(targetPath).catch(() => false)) {
          conflicts.push(relativePath);
        }
      }
      if (conflicts.length > 0) {
        await this.cleanupAsync(tempDir);
        return { extracted: [], conflicts };
      }
      await this.copyDirectoryAsync(tempDir, destination);
      await this.cleanupAsync(tempDir);
      return { extracted, conflicts };
    } catch (err) {
      await this.cleanupAsync(tempDir).catch(() => {});
      throw err;
    }
  }

  static async backupAndExtract(
    archivePath: string,
    destination: string,
    backupFolder: string,
  ): Promise<{ extracted: string[]; backupPath: string; restored: boolean }> {
    const validation = await this.validateArchiveAsync(archivePath);
    if (!validation.valid) throw new Error(validation.error || 'Invalid or corrupted archive');

    const backupPath = path.join(backupFolder, `backup_${Date.now()}`);
    let backupComplete = false;

    if (await asyncFs.exists(destination).catch(() => false)) {
      const tempBackup = tempDirName(backupFolder);
      await asyncFs.ensureDir(tempBackup);
      try {
        await this.copyDirectoryAsync(destination, tempBackup);
        await asyncFs.rename(tempBackup, backupPath);
        backupComplete = true;
      } catch (err) {
        await this.cleanupAsync(tempBackup).catch(() => {});
        throw new Error(`Failed to create backup: ${err}`);
      }
    }

    const tempExtract = tempDirName(path.dirname(archivePath));
    try {
      const extracted = await this.extractArchive(archivePath, tempExtract);

      if (await asyncFs.exists(destination).catch(() => false)) {
        await asyncFs.rm(destination, { recursive: true, force: true });
      }
      await asyncFs.ensureDir(destination);
      await this.copyDirectoryAsync(tempExtract, destination);
      await this.cleanupAsync(tempExtract);

      return { extracted, backupPath, restored: false };
    } catch (err) {
      await this.cleanupAsync(tempExtract).catch(() => {});
      LogManager.error('Extraction failed, rolling back', { archivePath, error: String(err) });

      if (backupComplete && await asyncFs.exists(backupPath).catch(() => false)) {
        if (await asyncFs.exists(destination).catch(() => false)) {
          await asyncFs.rm(destination, { recursive: true, force: true });
        }
        await asyncFs.ensureDir(path.dirname(destination));
        await this.copyDirectoryAsync(backupPath, destination);
      }
      throw err;
    }
  }

  static async copyDirectoryAsync(source: string, destination: string): Promise<void> {
    await asyncFs.ensureDir(destination);
    const entries = await asyncFs.readdir(source, { withFileTypes: true }) as fs.Dirent[];
    for (const entry of entries) {
      const srcPath = path.join(source, entry.name);
      const destPath = path.join(destination, entry.name);
      if (entry.isDirectory()) {
        await this.copyDirectoryAsync(srcPath, destPath);
      } else {
        await asyncFs.copyFile(srcPath, destPath).catch(() => {});
      }
    }
  }

  static async cleanupAsync(dir: string): Promise<void> {
    if (await asyncFs.exists(dir).catch(() => false)) {
      await asyncFs.rm(dir, { recursive: true, force: true });
    }
  }

  static copyDirectory(source: string, destination: string): void {}
  static cleanup(dir: string): void {}
}