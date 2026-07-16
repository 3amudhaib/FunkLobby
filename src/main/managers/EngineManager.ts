import fs from 'fs';
import path from 'path';
import { execFile, spawn } from 'child_process';
import { getSafeChildProcessOptions, resolvePackagedAssetPath } from '../utils/packagedPathResolver';
import { app, BrowserWindow } from 'electron';
import axios from 'axios';
import { getPrisma } from './PrismaManager';
import { LogManager } from './LogManager';
import { ExtractionManager } from './ExtractionManager';
import { asyncFs } from '../asyncFs';
import { ENGINE_CATALOG, ENGINE_DETECT_CONFIG, EngineCatalogEntry, classifyEngineInstallMethod } from '../../shared/engineTypes';
import { STANDALONE_ENGINE_ID } from '../../shared/constants';
import { loadReleaseFromCache } from './engineReleaseCache';

const INSTALL_ROOT = 'engine-manager';
const IMAGE_CACHE_DIR = 'engine-images';
const RELEASE_CACHE_DIR = 'engine-releases';

interface GitHubRelease {
  tag_name: string;
  name: string;
  body: string;
  published_at: string;
  html_url: string;
  assets: Array<{
    name: string;
    browser_download_url: string;
    size: number;
  }>;
}

interface InstallResult {
  success: boolean;
  version?: string;
  exePath?: string;
  installPath?: string;
  error?: string;
}

const BINARY_ASSET_MAP: Record<string, { binaryHint: string; exeName: string }> = {
  psych: { binaryHint: 'Windows64', exeName: 'PsychEngine.exe' },
  codename: { binaryHint: 'Windows', exeName: 'CodenameEngine.exe' },
  cdev: { binaryHint: 'win64', exeName: 'CDEVEngine.exe' },
  yoshicrafter: { binaryHint: 'Windows', exeName: 'YoshiCrafterEngine.exe' },
  dragon: { binaryHint: 'Windows', exeName: 'DragonEngine.exe' },
  shadow: { binaryHint: 'windows-x86_64', exeName: 'ShadowEngine.exe' },
  shattered: { binaryHint: 'windowsBuild', exeName: 'ShatteredEngine.exe' },
  slushi: { binaryHint: 'Win64', exeName: 'SlushiEngine.exe' },
  troll: { binaryHint: 'windowsBuild', exeName: 'TrollEngine.exe' },
  universe: { binaryHint: 'Windows', exeName: 'UniverseEngine.exe' },
  'v-slice': { binaryHint: 'windows', exeName: 'P-Slice.exe' },
  'funkin-plus-plus': { binaryHint: 'Windows', exeName: 'PlusEngine.exe' },
  'fps-plus': { binaryHint: 'fpsplus', exeName: 'FPSPlus.exe' },
  'micd-up': { binaryHint: 'mic.dUP', exeName: "Mic'd Up.exe" },
  vanilla: { binaryHint: 'windows', exeName: 'Funkin.exe' },
};

function getEnginesRoot(): string {
  // Store everything inside userData so it survives app updates and is
  // writable regardless of install location (%APPDATA%/FunkLobby/engines).
  return path.join(app.getPath('userData'), 'engines');
}

function getImageCacheDir(): string {
  return path.join(app.getPath('userData'), IMAGE_CACHE_DIR);
}

function getReleaseCacheDir(): string {
  return path.join(app.getPath('userData'), RELEASE_CACHE_DIR);
}

interface RepoValidation {
  valid: boolean;
  archived: boolean;
  redirectUrl: string | null;
  fetchedAt: number;
}

const VALID_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

function getValidCacheDir(): string {
  return path.join(app.getPath('userData'), 'repo-validation');
}

function sanitizeFolderName(name: string): string {
  return name.replace(/[<>:"\/\\|?*.]/g, '_').trim().replace(/^_+|_+$/g, '') || 'unknown_engine';
}

export class EngineManager {
  /** Track child processes by engine ID so we can report running state and kill them. */
  private static runningEngines = new Map<string, { proc: import('child_process').ChildProcess; exePath: string; startedAt: number }>();

  /** Migrate engines from the old next-to-exe location to userData. */
  static async migrateOldEngines(): Promise<void> {
    const oldRoot = app.isPackaged
      ? path.join(path.dirname(app.getPath('exe')), 'engines')
      : path.join(app.getAppPath(), 'engines');
    const newRoot = getEnginesRoot();
    if (oldRoot === newRoot) return;
    try {
      if (await asyncFs.exists(oldRoot).catch(() => false)) {
        const entries = await asyncFs.readdir(oldRoot) as string[];
        await asyncFs.ensureDir(newRoot);
        for (const entry of entries) {
          const src = path.join(oldRoot, entry);
          const dst = path.join(newRoot, entry);
          try {
            if (!await asyncFs.exists(dst).catch(() => false)) {
              await asyncFs.rename(src, dst);
            }
          } catch {}
        }
        // Remove old root if empty
        const remaining = await asyncFs.readdir(oldRoot) as string[];
        if (remaining.length === 0) {
          await asyncFs.rm(oldRoot, { recursive: true, force: true }).catch(() => {});
        }
      }
    } catch {}
  }

  /** Mark an engine process as running. Called after successful spawn. */
  private static trackRunningEngine(engineId: string, proc: import('child_process').ChildProcess, exePath: string): void {
    this.runningEngines.set(engineId, { proc, exePath, startedAt: Date.now() });
    this.sendEnginesRunningChanged();
    proc.on('exit', () => {
      this.runningEngines.delete(engineId);
      this.sendEnginesRunningChanged();
    });
  }

  /** Get set of engine IDs whose processes are currently alive. */
  static getRunningEngineIds(): string[] {
    return Array.from(this.runningEngines.keys());
  }

  /** Gracefully stop a running engine. */
  static async stopEngine(engineId: string): Promise<void> {
    const entry = this.runningEngines.get(engineId);
    if (!entry) throw new Error(`Engine ${engineId} is not running`);
    entry.proc.kill('SIGTERM');
    // Wait up to 5 seconds for graceful exit
    for (let i = 0; i < 50; i++) {
      if (!this.runningEngines.has(engineId)) return;
      await new Promise(r => setTimeout(r, 100));
    }
    // Force kill
    entry.proc.kill('SIGKILL');
    this.runningEngines.delete(engineId);
    this.sendEnginesRunningChanged();
  }

  private static sendEnginesRunningChanged(): void {
    try {
      const ids = Array.from(this.runningEngines.keys());
      BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('engines:runningChanged', ids);
      });
    } catch {}
  }

  private static catalogRefreshInProgress = false;

  static async getCatalog(): Promise<EngineCatalogEntry[]> {
    const entries = ENGINE_CATALOG.map(e => ({ ...e }));
    const results: EngineCatalogEntry[] = [];
    const pendingFetches: Array<{ entry: EngineCatalogEntry; owner: string; repo: string }> = [];

    for (const entry of entries) {
      if (!entry.repoOwner || !entry.repoName) {
        entry.installMethod = entry.downloadUrl ? 'direct_download' : 'manual';
        entry.supported = true;
        entry.repoUrl = entry.websiteUrl;
        results.push(entry);
        continue;
      }
      entry.repoUrl = `https://github.com/${entry.repoOwner}/${entry.repoName}`;
      const bam = BINARY_ASSET_MAP[entry.id];
      if (bam) {
        entry.binaryAssetName = bam.binaryHint;
        entry.executableName = bam.exeName;
      }
      // Check if release cache exists for instant response
      const cachedRelease = await this.getCachedReleaseIfAvailable(entry.repoOwner, entry.repoName);
      if (cachedRelease !== undefined) {
        const method = classifyEngineInstallMethod(entry, cachedRelease);
        entry.installMethod = method;
        entry.supported = true;
      } else {
        // No cached release — show "Checking..." and fetch in background
        entry.installMethod = 'checking';
        entry.supported = true;
        pendingFetches.push({ entry, owner: entry.repoOwner, repo: entry.repoName });
      }
      results.push(entry);
    }

    // Kick off background release fetching for uncached entries
    if (pendingFetches.length > 0 && !this.catalogRefreshInProgress) {
      this.catalogRefreshInProgress = true;
      this.refreshCatalogReleases(results, pendingFetches).finally(() => {
        this.catalogRefreshInProgress = false;
      });
    }

    return results;
  }

  private static async getCachedReleaseIfAvailable(owner: string, repo: string): Promise<GitHubRelease | null | undefined> {
    const cacheKey = `${owner}/${repo}`.toLowerCase().replace(/[^a-z0-9/]/g, '_');
    const cacheDir = getReleaseCacheDir();
    const cacheFile = path.join(cacheDir, `${cacheKey}.json`);
    try {
      const exists = await asyncFs.exists(cacheFile);
      if (!exists) return undefined;
      const raw = await asyncFs.readFile(cacheFile);
      const entry = JSON.parse(raw as string) as { fetchedAt: number; data: GitHubRelease | null };
      // Return stale cache data if available — graceful fallback
      if (entry.data) return entry.data;
      return undefined;
    } catch {
      return undefined;
    }
  }

  private static async refreshCatalogReleases(entries: EngineCatalogEntry[], pending: Array<{ entry: EngineCatalogEntry; owner: string; repo: string }>) {
    const updated: EngineCatalogEntry[] = [];
    const retryQueue: Array<{ entry: EngineCatalogEntry; owner: string; repo: string; attempt: number }> = [];
    const MAX_RETRIES = 3;
    const RETRY_BASE_DELAY = 2000;

    for (const { entry, owner, repo } of pending) {
      try {
        const release = await this.getCachedRelease(owner, repo);
        const method = classifyEngineInstallMethod(entry, release);
        if (entry.installMethod !== method) {
          entry.installMethod = method;
          updated.push(entry);
        }
      } catch {
        // Fetch failed — check if stale cache exists on disk
        const staleRelease = await this.getCachedReleaseIfAvailable(owner, repo);
        if (staleRelease !== undefined) {
          const method = classifyEngineInstallMethod(entry, staleRelease);
          if (entry.installMethod !== method) {
            entry.installMethod = method;
            updated.push(entry);
          }
        } else {
          // No cache at all — keep 'checking', schedule retry later
          if (entry.installMethod !== 'checking') {
            entry.installMethod = 'checking';
            updated.push(entry);
          }
          retryQueue.push({ entry, owner, repo, attempt: 1 });
        }
      }
    }

    // Retry failed fetches with exponential backoff
    for (const rq of retryQueue) {
      this.retryReleaseFetch(rq.entry, rq.owner, rq.repo, rq.attempt, MAX_RETRIES, RETRY_BASE_DELAY, entries);
    }

    if (updated.length > 0) {
      this.sendCatalogUpdated(entries);
    }
  }

  private static async retryReleaseFetch(
    entry: EngineCatalogEntry, owner: string, repo: string,
    attempt: number, maxRetries: number, baseDelay: number, allEntries: EngineCatalogEntry[]
  ) {
    const delay = baseDelay * Math.pow(2, attempt - 1);
    await new Promise(r => setTimeout(r, delay));
    try {
      const release = await this.getCachedRelease(owner, repo);
      const method = classifyEngineInstallMethod(entry, release);
      if (entry.installMethod !== method) {
        entry.installMethod = method;
        this.sendCatalogUpdated(allEntries);
      }
    } catch {
      if (attempt < maxRetries) {
        this.retryReleaseFetch(entry, owner, repo, attempt + 1, maxRetries, baseDelay, allEntries);
      } else {
        // Final fallback — check stale cache one more time
        const staleRelease = await this.getCachedReleaseIfAvailable(owner, repo);
        if (staleRelease !== undefined) {
          const method = classifyEngineInstallMethod(entry, staleRelease);
          if (entry.installMethod !== method) {
            entry.installMethod = method;
            this.sendCatalogUpdated(allEntries);
          }
        }
        // If still no cache, leave as 'checking' — next app restart will retry
      }
    }
  }

  private static sendCatalogUpdated(entries: EngineCatalogEntry[]) {
    try {
      const { BrowserWindow } = require('electron');
      const wins = BrowserWindow.getAllWindows();
      for (const win of wins) {
        win.webContents.send('catalog:update', entries);
      }
    } catch {}
  }

  static async getAllInstalled(): Promise<any[]> {
    const prisma = getPrisma();
    return prisma.engine.findMany({ orderBy: { createdAt: 'desc' } });
  }

  static async getEngineById(id: string): Promise<any> {
    const prisma = getPrisma();
    return prisma.engine.findUnique({ where: { id } });
  }

  static async getEngineByType(type: string): Promise<any> {
    const prisma = getPrisma();
    return prisma.engine.findFirst({ where: { type } });
  }

  static async fetchEngineImage(engineType: string): Promise<string | null> {
    const entry = ENGINE_CATALOG.find(e => e.id === engineType);
    if (!entry || !entry.repoOwner || !entry.repoName) return null;

    // Skip fetching images only for repos that are definitively invalid
    const validation = await this.getCachedValidation(entry.repoOwner, entry.repoName);
    if (validation && !validation.valid) return null;

    const cacheDir = getImageCacheDir();
    await asyncFs.ensureDir(cacheDir);

    const cachedPath = path.join(cacheDir, `${engineType}.jpg`);

    try {
      const stat = await asyncFs.stat(cachedPath);
      if (stat.size > 0) return `file://${cachedPath}`;
    } catch {}

    try {
      const repoOwner = validation?.redirectUrl ? validation.redirectUrl.replace('https://github.com/', '').split('/')[0] : entry.repoOwner;
      const repoName = validation?.redirectUrl ? validation.redirectUrl.replace('https://github.com/', '').split('/')[1] : entry.repoName;
      const resp = await axios.get(`https://api.github.com/repos/${repoOwner}/${repoName}`, {
        headers: { 'User-Agent': 'FunkLobby/1.0', 'Accept': 'application/vnd.github.v3+json' },
        timeout: 10000,
      });
      const ogImage = resp.data?.social_preview_image_url || resp.data?.open_graph_image_url;
      if (ogImage) {
        const imgResp = await axios.get(ogImage, { responseType: 'stream', timeout: 15000 });
        const writer = imgResp.data.pipe(fs.createWriteStream(cachedPath));
        const size = await asyncFs.size(cachedPath);
        if (size > 0) return `file://${cachedPath}`;
      }
    } catch {}

    return null;
  }

  private static async getCachedValidation(owner: string, repo: string): Promise<RepoValidation | null> {
    const cacheKey = `${owner}/${repo}`.toLowerCase().replace(/[^a-z0-9/]/g, '_');
    const cacheDir = getValidCacheDir();
    const cacheFile = path.join(cacheDir, `${cacheKey}.json`);
    try {
      const exists = await asyncFs.exists(cacheFile);
      if (exists) {
        const raw = await asyncFs.readFile(cacheFile);
        const cached = JSON.parse(raw as string) as RepoValidation;
        if (Date.now() - cached.fetchedAt < VALID_CACHE_TTL) {
          return cached;
        }
      }
    } catch {}
    // Fetch fresh validation
    const validation = await this.validateRepoAsync(owner, repo);
    if (validation) {
      try {
        await asyncFs.ensureDir(cacheDir);
        await asyncFs.writeFile(cacheFile, JSON.stringify({ ...validation, fetchedAt: Date.now() }));
      } catch {}
    }
    return validation;
  }

  private static sendInstallProgress(engineType: string, percent: number, status: string): void {
    try {
      BrowserWindow.getAllWindows().forEach(win => {
        win.webContents.send('engine:installProgress', { engineType, percent, status });
      });
    } catch {}
  }

  private static async validateRepoAsync(owner: string, repo: string): Promise<RepoValidation | null> {
    try {
      const resp = await axios.get(`https://api.github.com/repos/${owner}/${repo}`, {
        headers: { 'User-Agent': 'FunkLobby/1.0', 'Accept': 'application/vnd.github.v3+json' },
        timeout: 10000,
        maxRedirects: 5,
        validateStatus: (status) => status < 400 || status === 404 || status === 410,
      });
      if (resp.status === 404 || resp.status === 410) {
        return { valid: false, archived: false, redirectUrl: null, fetchedAt: Date.now() };
      }
      const data = resp.data;
      const archived = data.archived === true;
      return { valid: true, archived, redirectUrl: null, fetchedAt: Date.now() };
    } catch {
      // Follow HTTP redirect manually if axios doesn't
      try {
        const resp = await axios.get(`https://github.com/${owner}/${repo}`, {
          timeout: 10000,
          maxRedirects: 5,
          validateStatus: (status) => true,
        });
        if (resp.status === 200) {
          return { valid: true, archived: false, redirectUrl: null, fetchedAt: Date.now() };
        }
        if (resp.status >= 300 && resp.status < 400 && resp.request?.res?.responseUrl) {
          const redirectedUrl = resp.request.res.responseUrl;
          if (redirectedUrl.includes('github.com/')) {
            const parts = redirectedUrl.replace('https://github.com/', '').split('/');
            return { valid: true, archived: false, redirectUrl: `https://github.com/${parts[0]}/${parts[1]}`, fetchedAt: Date.now() };
          }
        }
        return { valid: false, archived: false, redirectUrl: null, fetchedAt: Date.now() };
      } catch {
        return { valid: false, archived: false, redirectUrl: null, fetchedAt: Date.now() };
      }
    }
  }

  private static installInProgress = new Set<string>();
  private static readonly INSTALL_RETRY_DELAY_MS = 2000;
  private static readonly API_RETRY_DELAY_MS = 1000;

  static async installEngine(engineType: string): Promise<void> {
    if (this.installInProgress.has(engineType)) {
      throw new Error(`Installation of ${engineType} is already in progress.`);
    }
    this.installInProgress.add(engineType);
    try {
      await this.installEngineImpl(engineType);
    } finally {
      this.installInProgress.delete(engineType);
    }
  }

  private static async installEngineImpl(engineType: string): Promise<void> {
    const entry = ENGINE_CATALOG.find(e => e.id === engineType);
    if (!entry) throw new Error(`Unknown engine: ${engineType}`);

    // If a direct downloadUrl is set on the catalog entry, bypass all manual/repo checks
    // and go straight to the auto-download-and-install flow
    if (entry.downloadUrl) {
      await this.directDownloadAndInstall(entry);
      return;
    }

    if (entry.downloadType === 'manual') {
      const imported = await this.importExternalEngine();
      if (!imported) throw new Error('Import cancelled.');
      return;
    }

    try {
      if (entry.repoOwner && entry.repoName) {
        const validation = await this.getCachedValidation(entry.repoOwner, entry.repoName);
        if (validation && !validation.valid) {
          const imported = await this.importExternalEngine();
          if (!imported) throw new Error('Import cancelled.');
          return;
        }
      }

      let release = entry.repoOwner && entry.repoName ? await this.getCachedRelease(entry.repoOwner, entry.repoName) : null;
      // Retry once with delay if release fetch failed (transient network/rate-limit issue)
      if (!release && entry.repoOwner && entry.repoName) {
        await new Promise(r => setTimeout(r, this.API_RETRY_DELAY_MS));
        release = await this.getCachedRelease(entry.repoOwner, entry.repoName);
      }
      // Populate binary asset hints so classifyEngineInstallMethod can match
      // asset names like 'fpsplus_v9_0_0.zip' against the known binary hint
      const bam = BINARY_ASSET_MAP[entry.id];
      if (bam) {
        entry.binaryAssetName = bam.binaryHint;
        entry.executableName = bam.exeName;
      }
      const method = classifyEngineInstallMethod(entry, release);
      if (method === 'source_only' || method === 'unavailable' || method === 'unknown_repo') {
        const imported = await this.importExternalEngine();
        if (!imported) throw new Error('Import cancelled.');
        return;
      }

      const prisma = getPrisma();
      const existing = await prisma.engine.findFirst({ where: { type: engineType } });

      const now = new Date().toISOString();
    if (existing) {
      await prisma.engine.update({
        where: { id: existing.id },
        data: { status: 'downloading', error: null, version: null, installPath: null },
      });
    } else {
      await prisma.engine.create({
        data: {
          name: entry.name,
          type: engineType,
          description: entry.description,
          author: entry.maintainers.join(', '),
          repoUrl: entry.repoUrl || (entry.repoOwner && entry.repoName ? `https://github.com/${entry.repoOwner}/${entry.repoName}` : null),
          websiteUrl: entry.websiteUrl,
          license: entry.license,
          features: JSON.stringify(entry.features),
          platforms: JSON.stringify(entry.platforms),
          status: 'downloading',
          version: null,
          createdAt: now,
          updatedAt: now,
        },
      });
    }

      const result = await this.downloadAndInstall(entry, release);

      if (result.success) {
        await prisma.engine.updateMany({
          where: { type: engineType },
          data: {
            status: 'installed',
            version: result.version,
            installPath: result.installPath,
            exePath: result.exePath,
            error: null,
            installedAt: now,
            lastUpdatedAt: now,
          },
        });

        this.verifyHealthAfterLaunch(result.exePath!, result.installPath!).catch(() => {});
        this.fetchEngineImage(engineType).catch(() => {});
      } else {
        await prisma.engine.updateMany({
          where: { type: engineType },
          data: {
            status: 'download_failed',
            error: result.error || 'Installation failed',
            version: null,
            installPath: null,
            exePath: null,
          },
        });
        throw new Error(result.error || 'Installation failed');
      }
    } catch (error: any) {
      LogManager.error('Engine install request failed', { engineType, error: error?.message || String(error) });
      throw error;
    }
  }

  /**
   * Install an engine that has a direct downloadUrl (no GitHub release needed).
   * Creates a DB record, streams the zip from the URL, extracts, finds the exe,
   * cleans up the temp zip, and updates the DB to 'installed'.
   */
  private static async directDownloadAndInstall(entry: EngineCatalogEntry): Promise<void> {
    const engineType = entry.id;
    const prisma = getPrisma();

    const existing = await prisma.engine.findFirst({ where: { type: engineType } });
    const now = new Date().toISOString();

    if (existing) {
      await prisma.engine.update({
        where: { id: existing.id },
        data: { status: 'downloading', error: null, version: null, installPath: null },
      });
    } else {
      await prisma.engine.create({
        data: {
          name: entry.name,
          type: engineType,
          description: entry.description,
          author: entry.maintainers.length > 0 ? entry.maintainers.join(', ') : 'Unknown',
          repoUrl: entry.repoUrl || entry.websiteUrl || null,
          websiteUrl: entry.websiteUrl,
          license: entry.license,
          features: JSON.stringify(entry.features),
          platforms: JSON.stringify(entry.platforms),
          status: 'downloading',
          version: null,
          createdAt: now,
          updatedAt: now,
        },
      });
    }

    const result = await this.downloadAndInstall(entry, null);

    if (result.success) {
      await prisma.engine.updateMany({
        where: { type: engineType },
        data: {
          status: 'installed',
          version: result.version,
          installPath: result.installPath,
          exePath: result.exePath,
          error: null,
          installedAt: now,
          lastUpdatedAt: now,
        },
      });
      this.verifyHealthAfterLaunch(result.exePath!, result.installPath!).catch(() => {});
    } else {
      await prisma.engine.updateMany({
        where: { type: engineType },
        data: {
          status: 'download_failed',
          error: result.error || 'Installation failed',
          version: null,
          installPath: null,
          exePath: null,
        },
      });
      throw new Error(result.error || 'Installation failed');
    }
  }

  private static async downloadAndInstall(entry: EngineCatalogEntry, release: GitHubRelease | null): Promise<InstallResult> {
    const engineType = entry.id;
    const prisma = getPrisma();
    let tempDir: string | null = null;
    let installDir: string | null = null;
    const startLog = Date.now();

    try {
      await prisma.engine.updateMany({
        where: { type: engineType },
        data: { status: 'installing' },
      });

      let downloadUrl: string | null = null;
      let releaseVersion = 'unknown';

      if (entry.downloadType === 'github' && entry.repoOwner && entry.repoName) {
        if (release) {
          releaseVersion = release.tag_name.replace(/^v/i, '');
          downloadUrl = this.selectBestAsset(entry, release);
        } else {
          // Fallback: try fetching latest release directly (bypass cache)
          try {
            const fallbackRelease = await this.fetchLatestGitHubReleaseAsync(entry.repoOwner, entry.repoName, '');
            if (fallbackRelease) {
              releaseVersion = fallbackRelease.tag_name.replace(/^v/i, '');
              downloadUrl = this.selectBestAsset(entry, fallbackRelease);
            }
          } catch {}
        }
      } else if (entry.downloadUrl) {
        downloadUrl = entry.downloadUrl;
      }

      if (!downloadUrl) {
        const hasBam = !!BINARY_ASSET_MAP[entry.id];
        if (entry.repoOwner && entry.repoName && hasBam) {
          return { success: false, error: `GitHub API rate limit reached. Please wait a few minutes and try again.` };
        }
        return { success: false, error: `No download URL available for ${entry.name}.` };
      }

      const enginesRoot = getEnginesRoot();
      await asyncFs.ensureDir(enginesRoot);

      installDir = path.join(enginesRoot, sanitizeFolderName(entry.name));
      if (await asyncFs.exists(installDir)) {
        await asyncFs.rm(installDir, { recursive: true, force: true });
      }
      await asyncFs.mkdir(installDir);

      const jobId = `eng_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      tempDir = path.join(enginesRoot, `.tmp_${jobId}`);
      await asyncFs.ensureDir(tempDir);

      LogManager.info('Downloading engine', { engineType, url: downloadUrl.substring(0, 100) });

      this.sendInstallProgress(engineType, 0, 'downloading');
      const zipPath = path.join(tempDir, `${entry.id}.zip`);
      const response = await axios({
        method: 'GET',
        url: downloadUrl,
        responseType: 'stream',
        timeout: 180000,
        headers: { 'User-Agent': 'FunkLobby/1.0' },
        maxRedirects: 5,
        onDownloadProgress: (progressEvent) => {
          const pct = progressEvent.total ? Math.round((progressEvent.loaded / progressEvent.total) * 100) : 0;
          this.sendInstallProgress(engineType, pct, 'downloading');
          if (Date.now() - startLog > 5000) LogManager.info(`Download progress`, { engineType, pct });
        },
      });

      const totalSize = parseInt(String(response.headers['content-length'] || '0'), 10);

      await new Promise<void>((resolve, reject) => {
        const writer = fs.createWriteStream(zipPath);
        response.data.pipe(writer);
        writer.on('finish', () => resolve());
        writer.on('error', reject);
      });

      const dlElapsed = Date.now() - startLog;
      if (dlElapsed > 100) LogManager.info(`Timing: download took ${dlElapsed}ms`, { engineType });

      const zipSize = await asyncFs.size(zipPath);
      if (zipSize === 0) {
        return { success: false, error: 'Downloaded file is empty or missing' };
      }

      if (totalSize > 0 && zipSize < totalSize * 0.9) {
        return { success: false, error: `Download incomplete: got ${Math.round(zipSize / totalSize * 100)}% of expected ${totalSize} bytes` };
      }

      this.sendInstallProgress(engineType, 100, 'extracting');
      LogManager.info('Extracting engine', { engineType, zipPath });

      const extractDir = path.join(tempDir, 'extracted');
      await asyncFs.ensureDir(extractDir);

      const validZip = await ExtractionManager.validateZipAsync(zipPath);
      if (validZip) {
        await ExtractionManager.extractZip(zipPath, extractDir);

        const items = await asyncFs.readdir(extractDir);
        const singleDir = items.length === 1 && await asyncFs.isDir(path.join(extractDir, items[0] as string));

        if (singleDir) {
          await ExtractionManager.copyDirectoryAsync(path.join(extractDir, items[0] as string), installDir);
        } else {
          await ExtractionManager.copyDirectoryAsync(extractDir, installDir);
        }
      } else {
        try {
          await ExtractionManager.extractZip(zipPath, installDir);
        } catch {
          return { success: false, error: 'Failed to extract archive - file may be corrupted' };
        }
      }

      const extractElapsed = Date.now() - startLog - dlElapsed;
      if (extractElapsed > 100) LogManager.info(`Timing: extract took ${extractElapsed}ms`, { engineType });

      this.sendInstallProgress(engineType, 100, 'installing');
      LogManager.info('Scanning for executable', { engineType, installDir });

      const exePath = await this.findEngineExeRecursiveAsync(installDir);

      if (!exePath) {
        if (tempDir && await asyncFs.exists(tempDir)) {
          await asyncFs.rm(tempDir, { recursive: true, force: true });
        }
        return { success: false, error: 'No executable found after extraction. The release may not contain a standalone executable.' };
      }

      if (tempDir && await asyncFs.exists(tempDir)) {
        await asyncFs.rm(tempDir, { recursive: true, force: true });
      }

      LogManager.info('Engine installed successfully', { engineType, version: releaseVersion, exePath });

      return { success: true, version: releaseVersion, exePath, installPath: installDir };

    } catch (err: any) {
      if (tempDir && await asyncFs.exists(tempDir).catch(() => false)) {
        try { await asyncFs.rm(tempDir, { recursive: true, force: true }); } catch {}
      }
      if (installDir && await asyncFs.exists(installDir).catch(() => false)) {
        try { await asyncFs.rm(installDir, { recursive: true, force: true }); } catch {}
      }
      LogManager.error('Engine installation failed', { engineType, error: String(err) });
      return { success: false, error: err.message || 'Unknown installation error' };
    }
  }

  static async findEngineExeRecursiveAsync(searchPath: string, maxDepth = 5): Promise<string | null> {
    const preferredExtensions = ['.exe', '.love', '.jar'];
    try {
      const entries = await asyncFs.readdir(searchPath, { withFileTypes: true }) as fs.Dirent[];
      let best: { path: string; prio: number } | null = null;

      for (const entry of entries) {
        if (!entry.isFile()) continue;
        const lower = entry.name.toLowerCase();
        let prio = -1;
        if (lower.endsWith('.exe')) prio = 2;
        else if (lower.endsWith('.love')) prio = 1;
        else if (lower.endsWith('.jar')) prio = 0;
        if (prio < 0) continue;

        const fullPath = path.join(searchPath, entry.name);
        if (prio === 2) {
          try {
            const stat = await asyncFs.stat(fullPath);
            if (stat.size <= 1024) continue;
          } catch { continue; }
        }
        if (!best || prio > best.prio) {
          best = { path: fullPath, prio };
        }
      }

      if (best) return best.path;

      if (maxDepth > 0) {
        const subdirs = entries
          .filter(e => e.isDirectory() && !e.name.startsWith('.') && !e.name.startsWith('$'))
          .sort((a, b) => {
            const aScore = a.name.toLowerCase().includes('bin') || a.name.toLowerCase().includes('release') ? 0 : 1;
            const bScore = b.name.toLowerCase().includes('bin') || b.name.toLowerCase().includes('release') ? 0 : 1;
            return aScore - bScore;
          });

        for (const subdir of subdirs) {
          const result = await this.findEngineExeRecursiveAsync(path.join(searchPath, subdir.name), maxDepth - 1);
          if (result) return result;
        }
      }
    } catch { return null; }
    return null;
  }

  static async findEngineExe(enginePath: string): Promise<string | null> {
    return this.findEngineExeRecursiveAsync(enginePath);
  }

  private static async getCachedRelease(owner: string, repo: string): Promise<GitHubRelease | null> {
    const cacheKey = `${owner}/${repo}`.toLowerCase().replace(/[^a-z0-9/]/g, '_');
    const cacheDir = getReleaseCacheDir();
    const cacheFile = path.join(cacheDir, `${cacheKey}.json`);

    try {
      return await loadReleaseFromCache<GitHubRelease>({
        readCache: async () => {
          try {
            const raw = await asyncFs.readFile(cacheFile);
            return JSON.parse(raw as string) as { fetchedAt: number; data: GitHubRelease | null };
          } catch {
            return null;
          }
        },
        writeCache: async (entry) => {
          try {
            await asyncFs.ensureDir(cacheDir);
            await asyncFs.writeFile(cacheFile, JSON.stringify(entry));
          } catch {}
        },
        fetchLatest: async () => {
          return this.fetchLatestGitHubReleaseAsync(owner, repo, cacheFile);
        },
      });
    } catch {
      return null;
    }
  }

  private static async fetchLatestGitHubReleaseAsync(owner: string, repo: string, cacheFile: string): Promise<GitHubRelease | null> {
    try {
      const resp = await axios.get(`https://api.github.com/repos/${owner}/${repo}/releases/latest`, {
        headers: { 'User-Agent': 'FunkLobby/1.0', 'Accept': 'application/vnd.github.v3+json' },
        timeout: 15000,
      });
      const data = resp.data;
      if (data && data.tag_name && Array.isArray(data.assets)) {
        await this.writeReleaseCache(cacheFile, data);
        return data;
      }
    } catch {}
    try {
      const resp = await axios.get(`https://api.github.com/repos/${owner}/${repo}/releases?per_page=10`, {
        headers: { 'User-Agent': 'FunkLobby/1.0', 'Accept': 'application/vnd.github.v3+json' },
        timeout: 15000,
      });
      const releases = resp.data;
      if (Array.isArray(releases) && releases.length > 0) {
        const sorted = releases.filter((r: any) => r.tag_name && Array.isArray(r.assets) && r.assets.length > 0);
        const chosen = sorted.length > 0 ? sorted[0] : (releases[0].tag_name ? releases[0] : null);
        if (chosen) {
          await this.writeReleaseCache(cacheFile, chosen);
          return chosen;
        }
      }
    } catch {}
    return null;
  }

  private static async writeReleaseCache(cacheFile: string, data: any): Promise<void> {
    try {
      const dir = path.dirname(cacheFile);
      await asyncFs.ensureDir(dir);
      await asyncFs.writeFile(cacheFile, JSON.stringify({ fetchedAt: Date.now(), data }));
    } catch {}
  }

  private static selectBestAsset(entry: EngineCatalogEntry, release: GitHubRelease): string | null {
    const candidates = release.assets;
    if (candidates.length === 0) return null;

    const isWindows = process.platform === 'win32';
    const bam = BINARY_ASSET_MAP[entry.id];
    if (bam && isWindows) {
      const hint = bam.binaryHint.toLowerCase();
      const preferred = candidates.find(a => a.name.toLowerCase().includes(hint));
      if (preferred) return preferred.browser_download_url;

      const windowsArchive = candidates.find(a => {
        const name = a.name.toLowerCase();
        return (name.endsWith('.zip') || name.endsWith('.7z'))
          && !name.includes('source')
          && !name.includes('src')
          && !name.includes('linux')
          && !name.includes('mac')
          && !name.includes('debug')
          && (name.includes('windows') || name.includes('win32') || name.includes('win64') || name.includes('win'));
      });
      if (windowsArchive) return windowsArchive.browser_download_url;
    }

    const normalize = (s: string) => s.replace(/[^a-z0-9]/g, '');
    const engineKeywords = [entry.repoName?.toLowerCase() || '', entry.name.toLowerCase()].filter(Boolean);
    const normalizedKeywords = engineKeywords.map(normalize);

    const scoreAsset = (asset: { name: string; size: number }): number => {
      const name = asset.name.toLowerCase();
      const nameNorm = normalize(name);
      let score = 0;
      if (name.endsWith('.exe') && isWindows) score += 100;
      if (name.endsWith('.zip')) score += 80;
      if (name.endsWith('.7z')) score += 60;
      if (name.endsWith('.love')) score += 50;
      if (name.includes('source') || name.includes('src')) score -= 50;
      if (name.includes('debug') || name.includes('pdb')) score -= 20;
      if (name.includes('setup') || name.includes('installer')) score -= 10;
      for (const kw of engineKeywords) { if (kw && name.includes(kw)) score += 40; }
      for (const kw of normalizedKeywords) { if (kw && nameNorm.includes(kw)) score += 40; }
      if (name.includes('windows') || name.includes('win')) score += 20;
      if (name.includes('portable')) score += 15;
      const mb = asset.size / (1024 * 1024);
      if (mb > 1 && mb < 500) score += 10;
      return score;
    };

    const sorted = [...candidates].sort((a, b) => scoreAsset(b) - scoreAsset(a));
    return sorted[0]?.browser_download_url || null;
  }

  static async checkForUpdates(engineType: string): Promise<{
    currentVersion: string | null;
    latestVersion: string | null;
    updateAvailable: boolean;
    releaseUrl: string | null;
    status: string;
  }> {
    const prisma = getPrisma();
    const engine = await prisma.engine.findFirst({ where: { type: engineType } });
    if (!engine) return { currentVersion: null, latestVersion: null, updateAvailable: false, releaseUrl: null, status: 'unsupported' };

    const entry = ENGINE_CATALOG.find(e => e.id === engineType);
    if (!entry || !entry.repoOwner || !entry.repoName) {
      return { currentVersion: engine.version, latestVersion: null, updateAvailable: false, releaseUrl: null, status: 'unsupported' };
    }

    const release = await this.getCachedRelease(entry.repoOwner, entry.repoName);
    if (!release) return { currentVersion: engine.version, latestVersion: null, updateAvailable: false, releaseUrl: null, status: 'failed' };

    const latestVersion = release.tag_name.replace(/^v/i, '');
    const currentVersion = engine.version;
    const updateAvailable = currentVersion !== latestVersion && currentVersion !== null;

    return { currentVersion, latestVersion, updateAvailable, releaseUrl: release.html_url, status: updateAvailable ? 'update_available' : 'up_to_date' };
  }

  static async checkAllUpdates(): Promise<Array<{
    engineId: string; engineName: string; currentVersion: string | null;
    latestVersion: string | null; updateAvailable: boolean; releaseUrl: string | null; status: string;
  }>> {
    const prisma = getPrisma();
    const engines = await prisma.engine.findMany({ where: { status: 'installed' } });
    const results = [];
    for (const engine of engines) {
      const result = await this.checkForUpdates(engine.type);
      results.push({ ...result, engineId: engine.id, engineName: engine.name });
    }
    return results;
  }

  static async updateEngine(engineId: string): Promise<void> {
    const prisma = getPrisma();
    const engine = await prisma.engine.findUnique({ where: { id: engineId } });
    if (!engine) throw new Error('Engine not found');
    if (engine.status !== 'installed' && engine.status !== 'update_available') {
      throw new Error(`Cannot update engine with status "${engine.status}"`);
    }

    const entry = ENGINE_CATALOG.find(e => e.id === engine.type);
    if (!entry) throw new Error('Engine not in catalog');

    const oldInstallPath = engine.installPath;
    const oldExePath = engine.exePath;

    const release = entry.repoOwner && entry.repoName ? await this.getCachedRelease(entry.repoOwner, entry.repoName) : null;

    await prisma.engine.update({ where: { id: engineId }, data: { status: 'downloading', error: null } });

    const result = await this.downloadAndInstall(entry, release);

    if (result.success) {
      if (oldInstallPath && await asyncFs.exists(oldInstallPath).catch(() => false) && oldInstallPath !== result.installPath) {
        try { await asyncFs.rm(oldInstallPath, { recursive: true, force: true }); } catch {}
      }
      await prisma.engine.update({
        where: { id: engineId },
        data: { status: 'installed', version: result.version, installPath: result.installPath, exePath: result.exePath, error: null, lastUpdatedAt: new Date().toISOString() },
      });
    } else {
      await prisma.engine.update({
        where: { id: engineId },
        data: { status: 'download_failed', error: result.error || 'Update failed', installPath: oldInstallPath, exePath: oldExePath },
      });
      throw new Error(result.error || 'Update failed');
    }
  }

  static async repairEngine(engineId: string): Promise<void> {
    const prisma = getPrisma();
    const engine = await prisma.engine.findUnique({ where: { id: engineId } });
    if (!engine) throw new Error('Engine not found');
    if (!engine.installPath) throw new Error('Engine has no install path');

    const exeFound = await this.findEngineExe(engine.installPath);
    if (exeFound) {
      await prisma.engine.update({ where: { id: engineId }, data: { status: 'installed', exePath: exeFound, error: null } });
      return;
    }

    const entry = ENGINE_CATALOG.find(e => e.id === engine.type);
    if (!entry) {
      await prisma.engine.update({ where: { id: engineId }, data: { status: 'corrupted', error: 'Cannot repair: engine not in catalog' } });
      throw new Error('Cannot repair: engine not in catalog');
    }

    await prisma.engine.update({ where: { id: engineId }, data: { status: 'downloading', error: null } });

    const oldInstallPath = engine.installPath;
    const release = entry.repoOwner && entry.repoName ? await this.getCachedRelease(entry.repoOwner, entry.repoName) : null;

    const result = await this.downloadAndInstall(entry, release);

    if (result.success) {
      if (oldInstallPath && await asyncFs.exists(oldInstallPath).catch(() => false) && oldInstallPath !== result.installPath) {
        try { await asyncFs.rm(oldInstallPath, { recursive: true, force: true }); } catch {}
      }
      await prisma.engine.update({
        where: { id: engineId },
        data: { status: 'installed', version: result.version, installPath: result.installPath, exePath: result.exePath, error: null, lastUpdatedAt: new Date().toISOString() },
      });
    } else {
      await prisma.engine.update({
        where: { id: engineId },
        data: { status: 'corrupted', error: result.error || 'Repair failed', installPath: oldInstallPath },
      });
      throw new Error(result.error || 'Repair failed');
    }
  }

  static async verifyEngine(engineId: string): Promise<{ verified: boolean; issues: string[] }> {
    const prisma = getPrisma();
    const engine = await prisma.engine.findUnique({ where: { id: engineId } });
    if (!engine) throw new Error('Engine not found');

    const issues: string[] = [];

    if (!engine.installPath) issues.push('No install path set');
    else if (!await asyncFs.exists(engine.installPath).catch(() => false)) issues.push('Install path does not exist on disk');
    else {
      const exeFound = await this.findEngineExe(engine.installPath);
      if (!exeFound) issues.push('No executable found in install path');
      else {
        try {
          const stat = await asyncFs.stat(exeFound);
          if (stat.size < 1024) issues.push('Executable file is too small (possibly invalid)');
        } catch { issues.push('Cannot read executable file'); }
      }
    }

    if (engine.status !== 'installed' && engine.status !== 'broken_installation') {
      issues.push(`Engine status is "${engine.status}", expected "installed"`);
    }

    const verified = issues.length === 0;

    if (verified && engine.status !== 'installed') {
      await prisma.engine.update({ where: { id: engineId }, data: { status: 'installed' } });
    }
    if (!verified && engine.status === 'installed') {
      await prisma.engine.update({ where: { id: engineId }, data: { status: 'corrupted' } });
    }

    return { verified, issues };
  }

  static async uninstallEngine(engineId: string): Promise<void> {
    const prisma = getPrisma();
    const engine = await prisma.engine.findUnique({ where: { id: engineId } });
    if (!engine) throw new Error('Engine not found');

    await prisma.engine.update({
      where: { id: engineId },
      data: { status: 'not_installed', installPath: null, exePath: null, version: null, error: null, installedAt: null },
    });

    if (engine.installPath && await asyncFs.exists(engine.installPath).catch(() => false)) {
      try { await asyncFs.rm(engine.installPath, { recursive: true, force: true }); }
      catch (err) { LogManager.warn('Failed to remove engine files', { engineId, error: String(err) }); }
    }
  }

  static async launchEngine(engineId: string): Promise<{ healthOk: boolean; exitCode?: number }> {
    const prisma = getPrisma();
    const engine = await prisma.engine.findUnique({ where: { id: engineId } });
    if (!engine) throw new Error('Engine not found');
    if (engine.status !== 'installed' && engine.status !== 'broken_installation') {
      throw new Error(`Engine is not installed (status: ${engine.status})`);
    }
    if (!engine.installPath) throw new Error('Engine install path is missing');

    // Resolve the actual install path — handle migration from a previous dev/userData path
    let installPath = engine.installPath;
    if (!await asyncFs.exists(installPath).catch(() => false)) {
      // Try the old userData-based path as a fallback (for engines installed before v1.0.6)
      const oldRoot = path.join(app.getPath('userData'), 'engine-manager');
      const folderName = path.basename(installPath);
      const oldPath = path.join(oldRoot, folderName);
      if (await asyncFs.exists(oldPath).catch(() => false)) {
        installPath = oldPath;
      } else {
        throw new Error('Engine install path does not exist on disk');
      }
    }

    // Prevent launching if already running
    if (this.runningEngines.has(engine.id)) {
      throw new Error('Engine is already running');
    }

    let exe = engine.exePath || null;
    if (!exe || !await asyncFs.exists(exe).catch(() => false)) {
      exe = await this.findEngineExe(installPath);
    }
    if (!exe) throw new Error('Engine executable not found. Try repairing the engine.');

    const result = await this.launchExe(exe, installPath);
    // Track if launch was successful (process started)
    if (result.healthOk) {
      this.trackRunningEngine(engine.id, result.childProc!, exe);
    }
    // Return health info but strip childProc
    return { healthOk: result.healthOk, exitCode: result.exitCode };
  }

  static async launchMod(enginePath: string, modPath: string): Promise<void> {
    LogManager.info('Launching mod', { enginePath, modPath });
    const engineExe = await this.findEngineExe(enginePath);
    if (!engineExe) throw new Error('Engine executable not found');
    const modArg = path.basename(modPath);
    return new Promise((resolve, reject) => {
      LogManager.info('Launching engine for mod', { engineExe, enginePath, modArg });
      execFile(engineExe, [modArg], getSafeChildProcessOptions(enginePath), (error) => {
        if (error) {
          LogManager.error('Failed to launch engine', { engineExe, enginePath, modArg, error: error.message, code: error.code });
          reject(error);
        } else {
          LogManager.info('Engine launched successfully', { engineExe, enginePath, modArg });
          resolve();
        }
      });
    });
  }

  private static getLoveExePath(): string | null {
    const lovePaths = [
      path.join(process.env.LOCALAPPDATA || '', 'LOVE', 'love.exe'),
      path.join(process.env.PROGRAMFILES || '', 'LOVE', 'love.exe'),
      path.join(process.env['PROGRAMFILES(X86)'] || '', 'LOVE', 'love.exe'),
    ];
    for (const p of lovePaths) {
      try { if (fs.existsSync(p)) return p; } catch {}
    }
    return null;
  }

  static async launchExe(exePath: string, cwd: string): Promise<{ healthOk: boolean; exitCode?: number; error?: string; childProc?: import('child_process').ChildProcess }> {
    LogManager.info('Launching executable', { exePath, cwd });
    return new Promise((resolve) => {
      const isLoveFile = path.extname(exePath).toLowerCase() === '.love';
      let args: string[] = [];
      let binary = exePath;
      if (isLoveFile) {
        const loveExe = this.getLoveExePath();
        if (!loveExe) {
          LogManager.error('Cannot launch .love engine', { exePath, error: 'LOVE runtime not found. Install LOVE from https://love2d.org' });
          resolve({ healthOk: false, exitCode: 1, error: 'This engine requires the LOVE runtime. Install LOVE from https://love2d.org and try again.' });
          return;
        }
        binary = loveExe;
        args = [exePath];
      }

      let stderr = '';
      const proc = spawn(binary, args, { ...getSafeChildProcessOptions(cwd), stdio: ['ignore', 'ignore', 'pipe'] });
      proc.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

      const timer = setTimeout(() => {
        if (proc.exitCode === null) { resolve({ healthOk: true, childProc: proc }); }
      }, 3000);

      proc.on('error', (err) => {
        clearTimeout(timer);
        LogManager.error('Failed to start executable', { exePath, cwd, error: err.message });
        resolve({ healthOk: false, error: err.message });
      });
      proc.on('exit', (code) => {
        clearTimeout(timer);
        const healthOk = code === null || code === 0;
        if (!healthOk) {
          const diag = stderr ? ` (stderr: ${stderr.trim().slice(0, 200)})` : '';
          LogManager.warn('Executable exited with error', { exePath, cwd, exitCode: code, stderr: stderr.slice(0, 500) });
        }
        resolve(healthOk ? { healthOk: true, childProc: proc } : { healthOk: false, exitCode: code, error: stderr ? stderr.trim().slice(0, 200) : undefined });
      });
    });
  }

  private static async verifyHealthAfterLaunch(exePath: string, cwd: string): Promise<void> {
    const prisma = getPrisma();
    const engines = await prisma.engine.findMany({ where: { installPath: cwd } });
    if (engines.length === 0) return;

    const result = await this.launchExe(exePath, cwd);
    if (!result.healthOk) {
      for (const engine of engines) {
        await prisma.engine.update({
          where: { id: engine.id },
          data: { status: 'broken_installation', error: result.exitCode !== undefined ? `Engine crashed on launch (exit code: ${result.exitCode})` : 'Engine failed to launch' },
        });
      }
    }
  }

  static async detectEngines(): Promise<any[]> {
    LogManager.info('Scanning for installed engines...');
    const detected: any[] = [];
    const searchPaths = [
      process.env.LOCALAPPDATA || '',
      process.env.PROGRAMFILES || '',
      process.env['PROGRAMFILES(X86)'] || '',
      app.getPath('downloads'),
      app.getPath('desktop'),
      process.env.APPDATA || '',
      getEnginesRoot(),
    ];
    const alreadyDetected = new Set<string>();

    for (const basePath of searchPaths) {
      if (!basePath || !await asyncFs.exists(basePath).catch(() => false)) continue;
      const result = await this.detectEngineInPath(basePath, alreadyDetected);
      detected.push(...result);
    }

    await this.storeDetectedEngines(detected);
    LogManager.info('Engine detection complete', { count: detected.length });
    return detected;
  }

  private static async detectEngineInPath(basePath: string, alreadyDetected: Set<string>, depth = 0): Promise<any[]> {
    if (depth > 3) return [];
    const found: any[] = [];

    try {
      const entries = await asyncFs.readdir(basePath, { withFileTypes: true }) as fs.Dirent[];
      const dirs: string[] = [];
      let fileNames = '';

      for (const entry of entries) {
        const fullPath = path.join(basePath, entry.name);
        if (entry.name.startsWith('.') || entry.name.startsWith('$')) continue;
        if (entry.isDirectory()) {
          dirs.push(fullPath);
        } else if (entry.isFile()) {
          fileNames += entry.name.toLowerCase() + '|';
        }
      }

      for (const detectEntry of ENGINE_DETECT_CONFIG) {
        if (alreadyDetected.has(detectEntry.id)) continue;

        for (const detectFile of detectEntry.detectFiles) {
          if (fileNames.includes(detectFile.toLowerCase())) {
            const installPath = basePath;
            const exePath = await this.findEngineExe(installPath);
            const catalogEntry = ENGINE_CATALOG.find(e => e.id === detectEntry.id);
            found.push({
              name: detectEntry.name, type: detectEntry.id, path: installPath, exePath,
              version: null, isCustom: false, isDetected: true,
              description: catalogEntry?.description || '',
              author: catalogEntry?.maintainers.join(', ') || '',
              repoUrl: catalogEntry?.repoOwner && catalogEntry?.repoName ? `https://github.com/${catalogEntry.repoOwner}/${catalogEntry.repoName}` : null,
              websiteUrl: catalogEntry?.websiteUrl || null,
              license: catalogEntry?.license || null,
              features: catalogEntry ? JSON.stringify(catalogEntry.features) : null,
              platforms: catalogEntry ? JSON.stringify(catalogEntry.platforms) : null,
            });
            alreadyDetected.add(detectEntry.id);
            break;
          }
        }

        if (alreadyDetected.has(detectEntry.id)) continue;

        for (const detectFolder of detectEntry.detectFolders) {
          if (fileNames.includes(detectFolder.toLowerCase() + '|')) {
            continue;
          }
          if (basePath.toLowerCase().includes(detectFolder.toLowerCase())) {
            const exePath = await this.findEngineExe(basePath);
            const catalogEntry = ENGINE_CATALOG.find(e => e.id === detectEntry.id);
            found.push({
              name: detectEntry.name, type: detectEntry.id, path: basePath, exePath,
              version: null, isCustom: false, isDetected: true,
              description: catalogEntry?.description || '',
              author: catalogEntry?.maintainers.join(', ') || '',
              repoUrl: catalogEntry?.repoOwner && catalogEntry?.repoName ? `https://github.com/${catalogEntry.repoOwner}/${catalogEntry.repoName}` : null,
              websiteUrl: catalogEntry?.websiteUrl || null,
              license: catalogEntry?.license || null,
              features: catalogEntry ? JSON.stringify(catalogEntry.features) : null,
              platforms: catalogEntry ? JSON.stringify(catalogEntry.platforms) : null,
            });
            alreadyDetected.add(detectEntry.id);
            break;
          }
        }
      }

      for (const dir of dirs) {
        if (alreadyDetected.size >= ENGINE_DETECT_CONFIG.length) break;
        const sub = await this.detectEngineInPath(dir, alreadyDetected, depth + 1);
        found.push(...sub);
      }
    } catch {}

    return found;
  }

  private static async storeDetectedEngines(engines: any[]) {
    const prisma = getPrisma();
    for (const engine of engines) {
      const existing = await prisma.engine.findFirst({ where: { type: engine.type, installPath: engine.path } });
      if (!existing) {
        const entry = ENGINE_CATALOG.find(e => e.id === engine.type);
        const exePath = engine.exePath || (engine.path ? await this.findEngineExe(engine.path) : null);
        await prisma.engine.create({
          data: {
            name: engine.name, type: engine.type, version: engine.version, installPath: engine.path, exePath, status: 'installed',
            isCustom: engine.isCustom, isDetected: engine.isDetected, description: entry?.description || null,
            author: entry?.maintainers.join(', ') || null, repoUrl: engine.repoUrl, websiteUrl: entry?.websiteUrl || null,
            license: entry?.license || null, features: entry ? JSON.stringify(entry.features) : null,
            platforms: entry ? JSON.stringify(entry.platforms) : null, installedAt: new Date().toISOString(),
          },
        });
      } else if (existing.status !== 'installed' && existing.status !== 'broken_installation') {
        const exePath = engine.exePath || (existing.installPath ? await this.findEngineExe(existing.installPath) : null);
        await prisma.engine.update({ where: { id: existing.id }, data: { status: 'installed', exePath } });
      }
    }
  }

  static async openFolder(engineId: string) {
    const prisma = getPrisma();
    const engine = await prisma.engine.findUnique({ where: { id: engineId } });
    if (!engine) throw new Error('Engine not found');
    if (!engine.installPath) throw new Error('Engine not installed');

    const { shell } = await import('electron');
    await shell.openPath(engine.installPath);
  }

  /** Get version string from a Windows executable */
  private static async getExeVersion(exePath: string): Promise<string | null> {
    try {
      const { execFile } = await import('child_process');
      return new Promise((resolve) => {
        execFile('powershell', [
          '-NoProfile', '-Command',
          `(Get-Item '${exePath.replace(/'/g, "''")}').VersionInfo.FileVersion`,
        ], { timeout: 5000 }, (err, stdout) => {
          if (err) { resolve(null); return; }
          const v = stdout?.toString().trim();
          resolve(v || null);
        });
      });
    } catch { return null; }
  }

  static async createShortcut(engineId: string): Promise<void> {
    const prisma = getPrisma();
    const engine = await prisma.engine.findUnique({ where: { id: engineId } });
    if (!engine) throw new Error('Engine not found');
    if (engine.status !== 'installed') throw new Error('Engine must be installed to create a shortcut');
    if (!engine.installPath) throw new Error('Engine not installed');

    let exe = engine.exePath || null;
    if (!exe || !await asyncFs.exists(exe).catch(() => false)) {
      exe = await this.findEngineExe(engine.installPath);
    }
    if (!exe) throw new Error('Engine executable not found');

    const desktopPath = path.join(app.getPath('desktop'), `${engine.name}.lnk`);
    try {
      const shortcutContent = `[InternetShortcut]\nURL=file:///${exe.replace(/\\/g, '/')}\nIconIndex=0\nIconFile=${exe.replace(/\\/g, '/')}`;
      await asyncFs.writeFile(desktopPath.replace('.lnk', '.url'), shortcutContent);
      LogManager.info('Shortcut created', { path: desktopPath });
    } catch (err) {
      throw new Error(`Failed to create shortcut: ${err}`);
    }
  }

  /**
   * Validate ALL installed engines against disk and repair DB records.
   * - If engine folder or exe is missing, mark as not_installed.
   * - If engine folder exists but DB says not_installed, keep it.
   * - Remove orphan engine records (engine installed in DB but no disk trace).
   * Returns { repaired: number, removed: number }.
   */
  static async validateAllInstalledEngines(): Promise<{ repaired: number; removed: number }> {
    const prisma = getPrisma();
    const allEngines = await prisma.engine.findMany();
    let repaired = 0;
    let removed = 0;

    for (const engine of allEngines) {
      // Skip engines that are clearly not installed
      if (engine.status === 'not_installed' || engine.status === 'download_failed') continue;

      const installPath = engine.installPath;
      if (!installPath) {
        // DB says installed but no path — reset
        await prisma.engine.update({
          where: { id: engine.id },
          data: { status: 'not_installed', exePath: null, version: null, installedAt: null, lastUpdatedAt: null, error: 'Install path was missing' },
        });
        removed++;
        continue;
      }

      const pathExists = await asyncFs.exists(installPath).catch(() => false);
      if (!pathExists) {
        // Try fallback to userData path
        const userDataPath = path.join(app.getPath('userData'), 'engines', path.basename(installPath));
        if (await asyncFs.exists(userDataPath).catch(() => false)) {
          // Migrate the path in DB
          await prisma.engine.update({
            where: { id: engine.id },
            data: { installPath: userDataPath, status: 'installed' },
          });
          repaired++;
          continue;
        }
        // Path truly gone — mark as not_installed
        await prisma.engine.update({
          where: { id: engine.id },
          data: { status: 'not_installed', exePath: null, version: null, installedAt: null, lastUpdatedAt: null, error: 'Engine folder was deleted' },
        });
        removed++;
        continue;
      }

      // Path exists — verify exe
      let exe = engine.exePath || null;
      if (!exe || !await asyncFs.exists(exe).catch(() => false)) {
        exe = await this.findEngineExe(installPath);
      }
      if (!exe) {
        // Exe missing but folder exists — mark as corrupted
        await prisma.engine.update({
          where: { id: engine.id },
          data: { status: 'corrupted', error: 'Executable not found', exePath: null },
        });
        removed++;
        continue;
      }

      // Everything looks good — ensure status is correct
      if (engine.status !== 'installed' && engine.status !== 'update_available') {
        await prisma.engine.update({
          where: { id: engine.id },
          data: { status: 'installed', exePath: exe, error: null },
        });
        repaired++;
      }
    }

    if (repaired > 0 || removed > 0) {
      LogManager.info('Engine validation complete', { repaired, removed });
    }
    return { repaired, removed };
  }

  /**
   * Remove all engine records that are not in the current catalog.
   * Also clear cached images for removed engines.
   */
  static async purgeObsoleteEngines(): Promise<number> {
    const prisma = getPrisma();
    const catalogIds = new Set(ENGINE_CATALOG.map(e => e.id));
    const allEngines = await prisma.engine.findMany({ select: { id: true, type: true, installPath: true } });
    let removed = 0;
    for (const engine of allEngines) {
      if (!catalogIds.has(engine.type) && !engine.type.startsWith('imported_')) {
        // Remove install files
        if (engine.installPath) {
          try {
            await asyncFs.rm(engine.installPath, { recursive: true, force: true });
          } catch {}
        }
        await prisma.engine.delete({ where: { id: engine.id } }).catch(() => {});
        LogManager.info('Purged obsolete engine', { id: engine.id, type: engine.type });
        removed++;
      }
    }

    // Clear cached images for old engines
    const imageCacheDir = getImageCacheDir();
    if (await asyncFs.exists(imageCacheDir).catch(() => false)) {
      try {
        const images = await asyncFs.readdir(imageCacheDir) as string[];
        for (const img of images) {
          const engineType = path.basename(img, path.extname(img));
          if (!catalogIds.has(engineType)) {
            try {
              await asyncFs.unlink(path.join(imageCacheDir, img));
            } catch {}
          }
        }
      } catch {}
    }

    return removed;
  }

  static getAssetsEnginesPath(): string {
    return resolvePackagedAssetPath(['assets', 'engines']);
  }

  /**
   * Import an external engine from a ZIP archive or folder.
   * Opens a dialog for the user to select a ZIP or folder, then detects
   * the executable, name, version, and registers it in the DB.
   */
  static async importExternalEngine(): Promise<any> {
    const { dialog } = await import('electron');
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'openDirectory'],
      title: 'Select Engine Executable or ZIP Archive',
      filters: [
        { name: 'Engine Files', extensions: ['exe', 'zip', '7z', 'jar', 'love'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    if (result.canceled || result.filePaths.length === 0) return null;

    const selectedPath = result.filePaths[0];
    const stat = await asyncFs.stat(selectedPath).catch(() => null);
    if (!stat) throw new Error('Cannot access selected file or folder');

    let engineDir: string;
    let tempDir: string | null = null;

    if (stat.isDirectory()) {
      engineDir = selectedPath;
    } else {
      const ext = path.extname(selectedPath).toLowerCase();
      if (['.zip', '.7z'].includes(ext)) {
        tempDir = path.join(app.getPath('userData'), 'engine-import', `import_${Date.now()}`);
        await asyncFs.ensureDir(tempDir);

        try {
          if (ext === '.zip') {
            const valid = await ExtractionManager.validateZipAsync(selectedPath);
            if (valid) {
              await ExtractionManager.extractZip(selectedPath, tempDir);
            } else {
              throw new Error('Invalid or corrupted ZIP archive');
            }
          } else {
            throw new Error('7z archive extraction is not supported. Please extract it manually and select the folder.');
          }
        } catch (err: any) {
          if (tempDir) await asyncFs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
          throw new Error(`Extraction failed: ${err.message}`);
        }

        const items = await asyncFs.readdir(tempDir) as string[];
        if (items.length === 1 && await asyncFs.isDir(path.join(tempDir, items[0]))) {
          engineDir = path.join(tempDir, items[0]);
        } else {
          engineDir = tempDir;
        }
      } else {
        engineDir = path.dirname(selectedPath);
      }
    }

    // Find the executable
    let exePath: string | null = null;
    if (stat.isFile() && (selectedPath.endsWith('.exe') || selectedPath.endsWith('.jar') || selectedPath.endsWith('.love'))) {
      exePath = selectedPath;
    } else {
      exePath = await this.findEngineExe(engineDir);
    }
    if (!exePath) throw new Error('No executable found in the selected path');

    // Try to identify the engine type
    const exeName = path.basename(exePath, path.extname(exePath));
    let detectedType: string | null = null;
    let detectedName = exeName;

    // Check against known engines by exe name
    const exeLower = exeName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const knownEngines = [
      { id: 'psych', name: 'Psych Engine', exes: ['psychengine', 'psych'] },
      { id: 'codename', name: 'Codename Engine', exes: ['codenameengine', 'codename'] },
      { id: 'cdev', name: 'CDEV Engine', exes: ['cdevengine', 'cdev'] },
      { id: 'yoshicrafter', name: 'YoshiCrafter Engine', exes: ['yoshicrafterengine', 'yoshicrafter', 'yoshie'] },
      { id: 'dragon', name: 'Dragon Engine', exes: ['dragonengine', 'dragon'] },
      { id: 'shadow', name: 'Shadow Engine', exes: ['shadowengine', 'shadow'] },
      { id: 'shattered', name: 'Shattered Engine', exes: ['shatteredengine', 'shattered'] },
      { id: 'slushi', name: 'Slushi Engine', exes: ['slushiengine', 'slushi'] },
      { id: 'troll', name: 'Troll Engine', exes: ['trollengine', 'troll'] },
      { id: 'universe', name: 'Universe Engine', exes: ['universeengine', 'universe'] },
      { id: 'funkin-plus-plus', name: 'Funkin Plus Plus', exes: ['plusengine', 'funkinplusplus', 'funkin+', 'funkin plus'] },
      { id: 'v-slice', name: 'V-Slice', exes: ['vslice', 'v-slice', 'v'] },
    ];

    for (const known of knownEngines) {
      if (known.exes.some(e => exeLower.includes(e))) {
        detectedType = known.id;
        detectedName = known.name;
        break;
      }
    }

    // Try to get version from the exe or folder
    let version: string | null = null;
    try {
      version = await this.getExeVersion(exePath);
    } catch {}

    // Register in DB
    const prisma = getPrisma();
    const now = new Date().toISOString();
    const importedEngine = await prisma.engine.create({
      data: {
        name: detectedName,
        type: detectedType || `imported_${exeName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
        version: version || '1.0.0',
        description: `Imported external engine from ${selectedPath}`,
        exePath,
        installPath: engineDir,
        status: 'installed',
        isCustom: true,
        isDetected: false,
        importSource: selectedPath,
        installedAt: now,
        createdAt: now,
        updatedAt: now,
      },
    });

    LogManager.info('External engine imported', { id: importedEngine.id, name: detectedName, path: selectedPath });
    return importedEngine;
  }

  static async getEngineLogs(engineId: string): Promise<string[]> {
    const prisma = getPrisma();
    const engine = await prisma.engine.findUnique({ where: { id: engineId } });
    if (!engine) throw new Error('Engine not found');
    return [
      `Engine: ${engine.name} (${engine.type})`,
      `Version: ${engine.version || 'N/A'}`,
      `Status: ${engine.status}`,
      `Install Path: ${engine.installPath || 'N/A'}`,
      `Executable Path: ${engine.exePath || 'N/A'}`,
      `Installed: ${engine.installedAt || 'N/A'}`,
      `Last Updated: ${engine.lastUpdatedAt || 'N/A'}`,
      `Error: ${engine.error || 'None'}`,
    ];
  }

  static async copyDirectoryAsync(src: string, dest: string): Promise<void> {
    await asyncFs.mkdir(dest, { recursive: true }).catch(() => {});
    const entries = await asyncFs.readdir(src, { withFileTypes: true }) as fs.Dirent[];
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        await this.copyDirectoryAsync(srcPath, destPath);
      } else {
        await asyncFs.copyFile(srcPath, destPath).catch(() => {});
      }
    }
  }
}