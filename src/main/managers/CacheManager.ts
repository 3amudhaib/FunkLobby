import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { LogManager } from './LogManager';
import { asyncFs } from '../asyncFs';

const CACHE_DIR = path.join(app.getPath('userData'), 'cache');
const API_CACHE_DIR = path.join(CACHE_DIR, 'api');
const THUMBNAIL_CACHE_DIR = path.join(CACHE_DIR, 'thumbnails');
const DEFAULT_API_TTL = 3600_000;
const DEFAULT_THUMBNAIL_TTL = 86400_000;

function safeKey(key: string): string {
  return Buffer.from(key).toString('base64url').slice(0, 120);
}

export class CacheManager {
  static init() {
    asyncFs.ensureDir(API_CACHE_DIR).catch(() => {});
    asyncFs.ensureDir(THUMBNAIL_CACHE_DIR).catch(() => {});
  }

  static async getApi<T>(key: string, ttl = DEFAULT_API_TTL): Promise<T | null> {
    return CacheManager.get<T>(API_CACHE_DIR, key, ttl);
  }

  static async setApi(key: string, data: any): Promise<void> {
    return CacheManager.set(API_CACHE_DIR, key, data);
  }

  static async getThumbnail(key: string): Promise<Buffer | null> {
    return CacheManager.getFile(THUMBNAIL_CACHE_DIR, key, DEFAULT_THUMBNAIL_TTL);
  }

  static async setThumbnail(key: string, buffer: Buffer): Promise<void> {
    return CacheManager.setFile(THUMBNAIL_CACHE_DIR, key, buffer);
  }

  static async clearApi() {
    await CacheManager.clearDir(API_CACHE_DIR);
  }

  static async clearThumbnails() {
    await CacheManager.clearDir(THUMBNAIL_CACHE_DIR);
  }

  static async clearAll() {
    await CacheManager.clearApi();
    await CacheManager.clearThumbnails();
  }

  static async getSize(): Promise<{ api: number; thumbnails: number; total: number }> {
    const apiSize = await CacheManager.dirSize(API_CACHE_DIR);
    const thumbnailSize = await CacheManager.dirSize(THUMBNAIL_CACHE_DIR);
    return { api: apiSize, thumbnails: thumbnailSize, total: apiSize + thumbnailSize };
  }

  private static async get<T>(dir: string, key: string, ttl: number): Promise<T | null> {
    const filePath = path.join(dir, safeKey(key));
    try {
      const exists = await asyncFs.exists(filePath);
      if (!exists) return null;
      const stat = await asyncFs.stat(filePath);
      if (Date.now() - stat.mtimeMs > ttl) {
        await asyncFs.unlink(filePath).catch(() => {});
        return null;
      }
      const raw = await asyncFs.readFile(filePath);
      return JSON.parse(raw as string) as T;
    } catch { return null; }
  }

  private static async set(dir: string, key: string, data: any): Promise<void> {
    try {
      await asyncFs.ensureDir(dir);
      await asyncFs.writeFile(path.join(dir, safeKey(key)), JSON.stringify(data));
    } catch (err) {
      LogManager.warn('Cache write failed', { key, error: String(err) });
    }
  }

  private static async getFile(dir: string, key: string, ttl: number): Promise<Buffer | null> {
    const filePath = path.join(dir, safeKey(key));
    try {
      const exists = await asyncFs.exists(filePath);
      if (!exists) return null;
      const stat = await asyncFs.stat(filePath);
      if (Date.now() - stat.mtimeMs > ttl) {
        await asyncFs.unlink(filePath).catch(() => {});
        return null;
      }
      return await asyncFs.readBuffer(filePath);
    } catch { return null; }
  }

  private static async setFile(dir: string, key: string, buffer: Buffer): Promise<void> {
    try {
      await asyncFs.ensureDir(dir);
      await asyncFs.writeFile(path.join(dir, safeKey(key)), buffer);
    } catch (err) {
      LogManager.warn('Cache file write failed', { key, error: String(err) });
    }
  }

  private static async clearDir(dir: string) {
    try {
      const exists = await asyncFs.exists(dir);
      if (!exists) return;
      await asyncFs.rm(dir, { recursive: true, force: true });
    } catch (err) {
      LogManager.warn('Cache clear failed', { dir, error: String(err) });
    }
  }

  private static async dirSize(dir: string): Promise<number> {
    try {
      const exists = await asyncFs.exists(dir);
      if (!exists) return 0;
      let size = 0;
      const entries = await asyncFs.readdir(dir, { withFileTypes: true }) as fs.Dirent[];
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isFile()) {
          try { const s = await asyncFs.stat(fullPath); size += s.size; } catch {}
        } else if (entry.isDirectory()) {
          size += await CacheManager.dirSize(fullPath);
        }
      }
      return size;
    } catch { return 0; }
  }

  static getApiPath(key: string): string {
    return path.join(API_CACHE_DIR, safeKey(key));
  }
}