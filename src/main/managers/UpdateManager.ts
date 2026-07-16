import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { app } from 'electron';
import axios from 'axios';
import { LogManager } from './LogManager';
import { ExtractionManager } from './ExtractionManager';
import { asyncFs } from '../asyncFs';
import { APP_NAME, APP_VERSION } from '../../shared/constants';
import { selectPreferredAsset } from './updateAssetSelection';
import {
  UpdateInfo, UpdateChannel, UpdateState, UpdateDownloadProgress,
  UpdateStatus, UPDATE_REPO_OWNER, UPDATE_REPO_NAME,
} from '../../shared/updateTypes';

const UPDATE_CACHE_DIR = 'update-cache';
const BACKUP_DIR = 'update-backup';
const STATE_FILE = 'update-state.json';

interface CachedRelease {
  fetchedAt: number;
  tag_name: string;
  body: string;
  published_at: string;
  html_url: string;
  assets: Array<{
    name: string;
    browser_download_url: string;
    size: number;
  }>;
}

interface PersistedState {
  downloadedPath: string | null;
  downloadedVersion: string | null;
  downloadedChecksum: string | null;
  channel: UpdateChannel;
  autoUpdate: boolean;
}

let _statusCallbacks: Array<(status: UpdateStatus, info: UpdateInfo | null, error: string | null) => void> = [];
let _progressCallbacks: Array<(progress: UpdateDownloadProgress) => void> = [];

function getUpdateCacheDir(): string {
  return path.join(app.getPath('userData'), UPDATE_CACHE_DIR);
}

function getBackupDir(): string {
  return path.join(app.getPath('userData'), BACKUP_DIR);
}

function getAppRootDir(): string {
  return path.resolve(app.getAppPath(), '..');
}

function getStatePath(): string {
  return path.join(app.getPath('userData'), STATE_FILE);
}

async function loadPersistedState(): Promise<PersistedState> {
  try {
    const p = getStatePath();
    if (await asyncFs.exists(p).catch(() => false)) {
      const raw = await asyncFs.readFile(p) as string;
      return JSON.parse(raw);
    }
  } catch {}
  return { downloadedPath: null, downloadedVersion: null, downloadedChecksum: null, channel: 'stable', autoUpdate: true };
}

async function savePersistedState(s: Partial<PersistedState>) {
  try {
    const current = await loadPersistedState().catch(() => ({ downloadedPath: null, downloadedVersion: null, downloadedChecksum: null, channel: 'stable' as const, autoUpdate: true }));
    await asyncFs.writeFile(getStatePath(), JSON.stringify({ ...current, ...s }, null, 2));
  } catch {}
}

function semverCompare(a: string, b: string): number {
  const pa = a.split('.').map(n => parseInt(n, 10) || 0);
  const pb = b.split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
  }
  return 0;
}

function selectAssetForPlatform(assets: CachedRelease['assets']): CachedRelease['assets'][0] | null {
  return selectPreferredAsset(assets, process.platform, process.arch) as CachedRelease['assets'][0] | null;
}

async function copyRecursive(src: string, dest: string): Promise<void> {
  await asyncFs.ensureDir(dest);
  const entries = await asyncFs.readdir(src, { withFileTypes: true }) as fs.Dirent[];
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyRecursive(srcPath, destPath);
    } else {
      try { await asyncFs.copyFile(srcPath, destPath); } catch {}
    }
  }
}

let _state: UpdateState = { status: 'idle', info: null, progress: null, error: null, channel: 'stable', autoUpdate: true };

function updateAndNotify(partial: Partial<UpdateState>, notify = true) {
  _state = { ..._state, ...partial };
  if (notify) {
    for (const cb of _statusCallbacks) {
      try { cb(_state.status, _state.info, _state.error); } catch {}
    }
  }
}

export class UpdateManager {

  static async getState(): Promise<UpdateState> {
    const persisted = await loadPersistedState();
    return { ..._state, channel: persisted.channel, autoUpdate: persisted.autoUpdate };
  }

  static onStatus(cb: (status: UpdateStatus, info: UpdateInfo | null, error: string | null) => void): () => void {
    _statusCallbacks.push(cb);
    return () => { _statusCallbacks = _statusCallbacks.filter(c => c !== cb); };
  }

  static onProgress(cb: (progress: UpdateDownloadProgress) => void): () => void {
    _progressCallbacks.push(cb);
    return () => { _progressCallbacks = _progressCallbacks.filter(c => c !== cb); };
  }

  static async setChannel(channel: UpdateChannel) {
    await savePersistedState({ channel });
    _state.channel = channel;
  }

  static async setAutoUpdate(enabled: boolean) {
    await savePersistedState({ autoUpdate: enabled });
    _state.autoUpdate = enabled;
  }

  static async check(force = false): Promise<UpdateInfo> {
    updateAndNotify({ status: 'checking', error: null });

    try {
      const cached = await this.getCachedRelease();
      const info = this.buildUpdateInfo(cached);

      if (!info.updateAvailable && !force) {
        updateAndNotify({ status: 'up_to_date', info });
        return info;
      }

      updateAndNotify({ status: info.updateAvailable ? 'available' : 'up_to_date', info });
      return info;
    } catch (err: any) {
      const errMsg = err?.message || 'Failed to check for updates';
      updateAndNotify({ status: 'error', error: errMsg });
      throw new Error(errMsg);
    }
  }

  static async download(): Promise<string> {
    const info = _state.info;
    if (!info?.updateAvailable || !info.downloadUrl) {
      throw new Error('No update available to download. Check for updates first.');
    }

    updateAndNotify({ status: 'downloading', progress: { bytesPerSecond: 0, percent: 0, total: 0, transferred: 0 } });

    try {
      const cacheDir = getUpdateCacheDir();
      await asyncFs.ensureDir(cacheDir);

      const urlExt = path.extname(new URL(info.downloadUrl).pathname) || '.exe';
      const downloadPath = path.join(cacheDir, `${APP_NAME}-update-${info.latestVersion}${urlExt}`);

      if (await asyncFs.exists(downloadPath).catch(() => false)) {
        try { await asyncFs.rm(downloadPath, { force: true }); } catch {}
      }

      const writer = fs.createWriteStream(downloadPath);
      const response = await axios({
        method: 'GET',
        url: info.downloadUrl,
        responseType: 'stream',
        timeout: 300000,
        headers: { 'User-Agent': `${APP_NAME}/${APP_VERSION}` },
        maxRedirects: 5,
      });

      const total = parseInt(String(response.headers['content-length'] || '0'), 10) || info.downloadSize;
      let transferred = 0;
      let lastTime = Date.now();
      let lastBytes = 0;

      response.data.on('data', (chunk: Buffer) => {
        transferred += chunk.length;
        const now = Date.now();
        const elapsed = (now - lastTime) / 1000;
        let bytesPerSecond = 0;
        if (elapsed > 0.5) {
          bytesPerSecond = Math.round((transferred - lastBytes) / elapsed);
          lastTime = now;
          lastBytes = transferred;
        }
        const percent = total > 0 ? Math.min(100, Math.round((transferred / total) * 100)) : 0;
        updateAndNotify({
          progress: { bytesPerSecond, percent, total, transferred },
        }, false);
        for (const cb of _progressCallbacks) {
          try { cb({ bytesPerSecond, percent, total, transferred }); } catch {}
        }
      });

      await new Promise<void>((resolve, reject) => {
        response.data.pipe(writer);
        writer.on('finish', () => resolve());
        writer.on('error', reject);
      });

      const dlSize = await asyncFs.size(downloadPath);
      if (dlSize === 0) {
        throw new Error('Downloaded file is empty or missing');
      }

      if (info.checksum) {
        const fileBuffer = await asyncFs.readBuffer(downloadPath);
        const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
        if (hash.toLowerCase() !== info.checksum.toLowerCase()) {
          try { await asyncFs.rm(downloadPath, { force: true }); } catch {}
          throw new Error(`Checksum mismatch. Expected ${info.checksum}, got ${hash}`);
        }
      }

      await savePersistedState({ downloadedPath: downloadPath, downloadedVersion: info.latestVersion, downloadedChecksum: info.checksum });
      updateAndNotify({ status: 'downloaded', progress: null });

      return downloadPath;
    } catch (err: any) {
      updateAndNotify({ status: 'error', error: err?.message || 'Download failed' });
      throw err;
    }
  }

  static async install(): Promise<void> {
    const persisted = await loadPersistedState();
    const downloadedExists = persisted.downloadedPath && await asyncFs.exists(persisted.downloadedPath).catch(() => false);
    if (!downloadedExists) {
      throw new Error('No downloaded update found. Download the update first.');
    }

    updateAndNotify({ status: 'installing' });

    const appRoot = getAppRootDir();
    const backupDir = getBackupDir();
    const downloadPath = persisted.downloadedPath!;

    try {
      if (await asyncFs.exists(backupDir).catch(() => false)) {
        try { await asyncFs.rm(backupDir, { recursive: true, force: true }); } catch {}
      }

      await copyRecursive(appRoot, backupDir);
      LogManager.info('Backup created before update', { appRoot, backupDir });

      const ext = path.extname(downloadPath).toLowerCase();
      const isPackaged = app.isPackaged;

      if (isPackaged && (ext === '.exe' || ext === '.msi')) {
        const { execFile } = require('child_process');
        const downloadedName = path.basename(downloadPath).toLowerCase();
        const isInstallerLike = downloadedName.includes('setup') || downloadedName.includes('installer') || downloadedName.includes('nsis') || downloadedName.includes('install');

        if (!isInstallerLike) {
          throw new Error('Downloaded update is not an installer package. Please use a release asset that contains an installer.');
        }

        execFile(downloadPath, [], { detached: true, stdio: 'ignore' }, () => {});
        app.quit();
        return;
      }

      if (ext === '.zip' || ext === '.7z') {
        const extractDir = path.join(getUpdateCacheDir(), 'extracted');
        const exists = await asyncFs.exists(extractDir).catch(() => false);
        if (exists) {
          try { await asyncFs.rm(extractDir, { recursive: true, force: true }); } catch {}
        }
        await asyncFs.mkdir(extractDir, { recursive: true });

        const valid = await ExtractionManager.validateZipAsync(downloadPath);
        if (valid) {
          await ExtractionManager.extractZip(downloadPath, extractDir);
        } else {
          const unzipper = require('unzipper');
          await new Promise<void>((resolve, reject) => {
            const rs = fs.createReadStream(downloadPath);
            rs.pipe(unzipper.Extract({ path: extractDir }))
              .on('close', () => resolve())
              .on('error', reject);
          });
        }

        const entries = await asyncFs.readdir(extractDir) as string[];
        let sourceDir = extractDir;
        if (entries.length === 1 && await asyncFs.isDir(path.join(extractDir, entries[0]))) {
          sourceDir = path.join(extractDir, entries[0]);
        }

        await this.replaceAppFiles(appRoot, sourceDir);

        await savePersistedState({ downloadedPath: null, downloadedVersion: null, downloadedChecksum: null });
        updateAndNotify({ status: 'installed' });

        const { execFile: exec } = require('child_process');
        const relaunchCmd = isPackaged ? path.join(appRoot, `${APP_NAME}.exe`) : process.execPath;
        const relaunchArgs = isPackaged ? [] : [app.getAppPath()];
        exec(relaunchCmd, relaunchArgs, { detached: true, stdio: 'ignore' }, () => {});
        app.quit();
        return;
      }

      throw new Error(`Unsupported update package format: ${ext}`);
    } catch (err: any) {
      LogManager.error('Update install failed, rolling back', { error: String(err) });

      try {
        if (await asyncFs.exists(backupDir).catch(() => false)) {
          await copyRecursive(backupDir, appRoot);
          try { await asyncFs.rm(backupDir, { recursive: true, force: true }); } catch {}
        }
      } catch {}

      await savePersistedState({ downloadedPath: null, downloadedVersion: null, downloadedChecksum: null });
      updateAndNotify({ status: 'error', error: err?.message || 'Installation failed, previous version restored' });
      throw new Error(`Update failed: ${err?.message || 'Unknown error'}. Previous version restored.`);
    }
  }

  static async checkOnStartup(): Promise<void> {
    const persisted = await loadPersistedState();
    if (!persisted.autoUpdate) return;

    try {
      const info = await this.check(false);
      if (info.updateAvailable && info.downloadUrl) {
        LogManager.info('Auto-update: downloading update', { version: info.latestVersion });
        this.download().catch(err => {
          LogManager.warn('Auto-update download failed', { error: String(err) });
        });
      }
    } catch (err) {
      LogManager.warn('Auto-update check failed on startup', { error: String(err) });
    }
  }

  static async cleanup() {
    const cacheDir = getUpdateCacheDir();
    if (await asyncFs.exists(cacheDir).catch(() => false)) {
      try { await asyncFs.rm(cacheDir, { recursive: true, force: true }); } catch {}
    }
    const backupDir = getBackupDir();
    if (await asyncFs.exists(backupDir).catch(() => false)) {
      try { await asyncFs.rm(backupDir, { recursive: true, force: true }); } catch {}
    }
    await savePersistedState({ downloadedPath: null, downloadedVersion: null, downloadedChecksum: null });
  }

  private static buildUpdateInfo(cached: CachedRelease | null): UpdateInfo {
    if (!cached) {
      return {
        latestVersion: APP_VERSION, currentVersion: APP_VERSION, updateAvailable: false,
        releaseUrl: null, releaseNotes: '', publishedAt: null,
        downloadUrl: null, downloadSize: 0, checksum: null, channel: _state.channel,
      };
    }

    const latestVersion = cached.tag_name.replace(/^v/i, '');
    const updateAvailable = semverCompare(latestVersion, APP_VERSION) > 0;

    const asset = selectAssetForPlatform(cached.assets);

    return {
      latestVersion,
      currentVersion: APP_VERSION,
      updateAvailable,
      releaseUrl: cached.html_url,
      releaseNotes: cached.body || '',
      publishedAt: cached.published_at || null,
      downloadUrl: asset?.browser_download_url || cached.html_url,
      downloadSize: asset?.size || 0,
      checksum: null,
      channel: _state.channel,
    };
  }

  private static async getCachedRelease(): Promise<CachedRelease | null> {
    const cacheDir = getUpdateCacheDir();
    await asyncFs.ensureDir(cacheDir);

    const cacheFile = path.join(cacheDir, 'release.json');
    const TTL = 6 * 60 * 60 * 1000;

    const cacheExists = await asyncFs.exists(cacheFile).catch(() => false);
    if (cacheExists) {
      try {
        const raw = await asyncFs.readFile(cacheFile) as string;
        const cached = JSON.parse(raw);
        if (Date.now() - cached.fetchedAt < TTL) return cached;
      } catch {}
    }

    try {
      if (_state.channel === 'beta') {
        const resp = await axios.get(
          `https://api.github.com/repos/${UPDATE_REPO_OWNER}/${UPDATE_REPO_NAME}/releases?per_page=10`,
          { headers: { 'User-Agent': `${APP_NAME}/${APP_VERSION}`, 'Accept': 'application/vnd.github.v3+json' }, timeout: 15000 },
        );
        const releases = resp.data;
        if (Array.isArray(releases) && releases.length > 0) {
          const withAssets = releases.filter(r => r.tag_name && Array.isArray(r.assets));
          const chosen = withAssets.length > 0 ? withAssets[0] : releases[0];
          if (chosen?.tag_name) return await this.writeCached(cacheFile, chosen);
        }
        return await this.tryStaleCache(cacheFile);
      }

      const resp = await axios.get(
        `https://api.github.com/repos/${UPDATE_REPO_OWNER}/${UPDATE_REPO_NAME}/releases/latest`,
        { headers: { 'User-Agent': `${APP_NAME}/${APP_VERSION}`, 'Accept': 'application/vnd.github.v3+json' }, timeout: 15000 },
      );
      if (resp.data?.tag_name) return await this.writeCached(cacheFile, resp.data);
    } catch {}

    return await this.tryStaleCache(cacheFile);
  }

  private static async writeCached(cacheFile: string, data: any): Promise<CachedRelease> {
    const wrapped: CachedRelease = {
      fetchedAt: Date.now(),
      tag_name: data.tag_name,
      body: data.body || '',
      published_at: data.published_at || '',
      html_url: data.html_url || '',
      assets: (data.assets || []).map((a: any) => ({
        name: a.name, browser_download_url: a.browser_download_url, size: a.size || 0,
      })),
    };
    try { await asyncFs.writeFile(cacheFile, JSON.stringify(wrapped)); } catch {}
    return wrapped;
  }

  private static async tryStaleCache(cacheFile: string): Promise<CachedRelease | null> {
    try {
      const exists = await asyncFs.exists(cacheFile).catch(() => false);
      if (exists) {
        const raw = await asyncFs.readFile(cacheFile) as string;
        return JSON.parse(raw);
      }
    } catch {}
    return null;
  }

  private static async replaceAppFiles(target: string, source: string): Promise<void> {
    const skipDirs = new Set(['node_modules', '.git', 'prisma']);
    const entries = await asyncFs.readdir(source, { withFileTypes: true }) as fs.Dirent[];
    for (const entry of entries) {
      if (skipDirs.has(entry.name) || entry.name.startsWith('_')) continue;
      const srcPath = path.join(source, entry.name);
      const destPath = path.join(target, entry.name);
      if (entry.isDirectory()) {
        const destExists = await asyncFs.exists(destPath).catch(() => false);
        if (destExists) {
          try { await asyncFs.rm(destPath, { recursive: true, force: true }); } catch {}
        }
        await copyRecursive(srcPath, destPath);
      } else {
        try { await asyncFs.copyFile(srcPath, destPath); } catch {}
      }
    }
  }
}