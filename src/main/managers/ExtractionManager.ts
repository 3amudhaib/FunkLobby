import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import extractZip from 'extract-zip';
import crypto from 'crypto';
import { LogManager } from './LogManager';
import { asyncFs } from '../asyncFs';

function tempDirName(baseDir: string): string {
  return path.join(baseDir, `_temp_${crypto.randomBytes(4).toString('hex')}`);
}

export class ExtractionManager {
  static async extractZip(zipPath: string, destination: string): Promise<string[]> {
    LogManager.info('Extracting archive', { zipPath, destination });

    if (!await asyncFs.exists(zipPath).catch(() => false)) {
      throw new Error(`Archive not found: ${zipPath}`);
    }

    const resolvedDest = path.resolve(destination);
    await asyncFs.ensureDir(destination);

    try {
      await extractZip(zipPath, { dir: resolvedDest });
    } catch (err) {
      LogManager.error('Extraction failed', { zipPath, error: String(err) });
      throw err;
    }

    const extractedFiles = await this.listFilesAsync(destination);
    LogManager.info('Extraction completed', { fileCount: extractedFiles.length });
    return extractedFiles;
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
        LogManager.error('ZIP file not found', { path: zipPath });
        return false;
      }
      const stat = await asyncFs.stat(zipPath);
      if (stat.size === 0) {
        LogManager.error('ZIP file is empty', { path: zipPath });
        return false;
      }
      const fd = await fsp.open(zipPath, 'r');
      const buf = Buffer.alloc(4);
      await fd.read(buf, 0, 4, 0);
      await fd.close();
      const isValid = buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04;
      if (!isValid) LogManager.error('Invalid ZIP signature', { path: zipPath });
      return isValid;
    } catch { return false; }
  }

  static validateZip(zipPath: string): boolean {
    return false;
  }

  static async extractWithOverwriteCheck(
    zipPath: string,
    destination: string,
  ): Promise<{ extracted: string[]; conflicts: string[] }> {
    const valid = await this.validateZipAsync(zipPath);
    if (!valid) throw new Error('Invalid or corrupted ZIP archive');

    const conflicts: string[] = [];
    let tempDir = '';
    try {
      const extracted = await this.extractZip(zipPath, tempDir);
      for (const file of extracted) {
        const relativePath = path.relative(tempDir, file);
        const targetPath = path.join(destination, relativePath);
        if (await asyncFs.exists(targetPath).catch(() => false)) {
          conflicts.push(relativePath);
        }
      }
      if (conflicts.length > 0) {
        await this.cleanupAsync(tempDir);
        tempDir = '';
        return { extracted: [], conflicts };
      }
      await this.copyDirectoryAsync(tempDir, destination);
      await this.cleanupAsync(tempDir);
      tempDir = '';
      return { extracted, conflicts };
    } catch (err) {
      if (tempDir) await this.cleanupAsync(tempDir).catch(() => {});
      throw err;
    }
  }

  static async backupAndExtract(
    zipPath: string,
    destination: string,
    backupFolder: string,
  ): Promise<{ extracted: string[]; backupPath: string; restored: boolean }> {
    const valid = await this.validateZipAsync(zipPath);
    if (!valid) throw new Error('Invalid or corrupted ZIP archive');

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

    const tempExtract = tempDirName(path.dirname(zipPath));
    try {
      const extracted = await this.extractZip(zipPath, tempExtract);

      if (await asyncFs.exists(destination).catch(() => false)) {
        await asyncFs.rm(destination, { recursive: true, force: true });
      }
      await asyncFs.ensureDir(destination);
      await this.copyDirectoryAsync(tempExtract, destination);
      await this.cleanupAsync(tempExtract);

      return { extracted, backupPath, restored: false };
    } catch (err) {
      await this.cleanupAsync(tempExtract).catch(() => {});
      LogManager.error('Extraction failed, rolling back', { zipPath, error: String(err) });

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