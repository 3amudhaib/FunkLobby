import axios from 'axios';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import stream from 'stream';
import { BrowserWindow } from 'electron';
import { getPrisma } from './PrismaManager';
import { LogManager } from './LogManager';
import { SettingsManager } from './SettingsManager';
import { asyncFs } from '../asyncFs';

const { pipeline } = stream.promises;

interface DownloadTask {
  id: string;
  modId: string;
  url: string;
  fileName: string;
  filePath: string;
  totalBytes: number;
  downloadedBytes: number;
  status: 'pending' | 'downloading' | 'paused' | 'completed' | 'error' | 'cancelled' | 'verifying';
  speed: number;
  eta: number;
  startTime: number;
  controller: AbortController | null;
  stream: fs.WriteStream | null;
  lastEmit: number;
  lastBytes: number;
  hash: string | null;
  cancelledFlag: boolean;
}

function safeIpcSend(channel: string, data: any) {
  try {
    BrowserWindow.getAllWindows().forEach((win) => {
      try {
        if (!win.isDestroyed()) {
          win.webContents.send(channel, data);
        }
      } catch {}
    });
  } catch {}
}

function pathTraversalSafe(filePath: string, baseDir: string): boolean {
  const resolved = path.resolve(filePath);
  const base = path.resolve(baseDir);
  return resolved.startsWith(base + path.sep) || resolved === base;
}

class DownloadManagerClass {
  private downloads: Map<string, DownloadTask> = new Map();
  private queue: string[] = [];
  private activeCount = 0;
  private maxConcurrent = 3;
  private processing = false;
  private processPending = false;

  async init() {
    this.maxConcurrent = await SettingsManager.getNumber('concurrentDownloads', 3);
  }

  async startDownload(modId: string, url: string, fileName: string, hash?: string): Promise<string> {
    const prisma = getPrisma();
    const settings = await SettingsManager.getAll();
    const downloadFolder = settings.downloadFolder || path.join(process.env.USERPROFILE || '', 'Downloads', 'FunkLobby');

    if (!await asyncFs.exists(downloadFolder).catch(() => false)) {
      await asyncFs.mkdir(downloadFolder, { recursive: true });
    }

    const filePath = path.join(downloadFolder, fileName);
    if (!pathTraversalSafe(filePath, downloadFolder)) {
      throw new Error('Invalid download path detected');
    }

    const download = await prisma.download.create({
      data: {
        modId,
        url,
        fileName,
        filePath,
        totalBytes: 0,
        downloadedBytes: 0,
        status: 'pending',
        hash: hash || null,
      },
    });

    const task: DownloadTask = {
      id: download.id,
      modId,
      url,
      fileName,
      filePath,
      totalBytes: 0,
      downloadedBytes: 0,
      status: 'pending',
      speed: 0,
      eta: 0,
      startTime: 0,
      controller: null,
      stream: null,
      lastEmit: 0,
      lastBytes: 0,
      hash: hash || null,
      cancelledFlag: false,
    };

    this.downloads.set(download.id, task);
    this.queue.push(download.id);
    this.processQueue();

    return download.id;
  }

  private async processQueue() {
    if (this.processing) {
      this.processPending = true;
      return;
    }
    this.processing = true;
    try {
      while (this.activeCount < this.maxConcurrent && this.queue.length > 0) {
        const id = this.queue.shift();
        if (!id) continue;
        const task = this.downloads.get(id);
        if (task && task.status === 'pending') {
          this.activeCount++;
          this.executeDownload(id).finally(() => {
            this.activeCount--;
            this.processQueue();
          });
        }
      }
    } finally {
      this.processing = false;
      if (this.processPending) {
        this.processPending = false;
        this.processQueue();
      }
    }
  }

  private async executeDownload(downloadId: string) {
    const task = this.downloads.get(downloadId);
    if (!task) return;

    task.status = 'downloading';
    task.startTime = Date.now();
    task.controller = new AbortController();
    task.cancelledFlag = false;
    try { await this.updateDbStatus(downloadId, 'downloading'); } catch {}

    let writer: fs.WriteStream | null = null;

    try {
      LogManager.info('Starting download', { url: task.url.substring(0, 100), file: task.fileName });
      let headUrl = task.url;
      const headResp = await axios.head(headUrl, {
        headers: { 'User-Agent': 'FunkLobby/1.0' },
        timeout: 15000,
        maxRedirects: 5,
        validateStatus: (s) => s >= 200 && s < 400,
      });

      const contentType = (headResp.headers['content-type'] as string) || '';
      const contentLength = parseInt(headResp.headers['content-length'] as string || '0', 10);

      if (contentType.includes('text/html') || (contentLength > 0 && contentLength < 100)) {
        LogManager.warn('Download URL returned non-binary response, trying direct GameBanana link', {
          contentType, contentLength, url: task.url.substring(0, 100),
        });
        const gbMatch = task.url.match(/gamebanana\.com\/(?:dl|mods\/download)\/(\d+)/);
        if (gbMatch) {
          headUrl = `https://gamebanana.com/dl/${gbMatch[1]}`;
          const retry = await axios.head(headUrl, {
            headers: { 'User-Agent': 'FunkLobby/1.0', 'Referer': 'https://gamebanana.com/' },
            timeout: 15000,
            maxRedirects: 5,
            validateStatus: (s) => s >= 200 && s < 400,
          });
          const retryCt = retry.headers['content-type'] as string || '';
          const retryCl = parseInt(retry.headers['content-length'] as string || '0', 10);
          if (!retryCt.includes('text/html') && retryCl > 100) {
            task.url = headUrl;
          }
        }
      }

      let existingBytes = 0;
      if (await asyncFs.exists(task.filePath).catch(() => false) && task.downloadedBytes > 0) {
        existingBytes = (await asyncFs.stat(task.filePath)).size;
        if (existingBytes === 0) {
          task.downloadedBytes = 0;
        } else {
          LogManager.info('Resuming download', { file: task.fileName, existingBytes });
        }
      } else {
        task.downloadedBytes = 0;
      }

      const headers: any = {
        'User-Agent': 'FunkLobby/1.0',
        'Accept': 'application/octet-stream, */*',
        'Referer': task.url.includes('gamebanana.com') ? 'https://gamebanana.com/' : '',
      };

      if (existingBytes > 0) {
        headers['Range'] = `bytes=${existingBytes}-`;
      }

      const response = await axios({
        method: 'GET',
        url: task.url,
        responseType: 'stream',
        signal: task.controller.signal,
        headers,
        maxRedirects: 5,
        timeout: 30000,
        validateStatus: (s) => s >= 200 && s < 400,
      });

      const finalContentLength = response.headers['content-length'] as string;
      const contentRange = response.headers['content-range'] as string;

      let isResuming = false;
      if (response.status === 206 && contentRange) {
        isResuming = true;
        const match = contentRange.match(/bytes \d+-\d+\/(\d+)/);
        if (match) task.totalBytes = parseInt(match[1], 10);
      } else {
        task.totalBytes = parseInt(finalContentLength || '0', 10) || 0;
        task.downloadedBytes = 0;
      }

      if (task.totalBytes === 0) {
        LogManager.warn('Download has unknown content length, proceeding anyway');
      }

      writer = fs.createWriteStream(task.filePath, { flags: isResuming ? 'a' : 'w' });
      task.stream = writer;

      let downloadedBytes = task.downloadedBytes;
      response.data.on('data', (chunk: Buffer) => {
        if (task.cancelledFlag || task.status === 'cancelled') {
          response.data.destroy();
          return;
        }
        downloadedBytes += chunk.length;
        task.downloadedBytes = downloadedBytes;
        const now = Date.now();
        if (now - task.lastEmit > 200) {
          const interval = (now - task.lastEmit) / 1000;
          const bytesDelta = downloadedBytes - task.lastBytes;
          task.speed = interval > 0 ? bytesDelta / interval : 0;
          task.lastBytes = downloadedBytes;
          task.lastEmit = now;
          task.eta = task.speed > 0 ? Math.ceil((task.totalBytes - downloadedBytes) / task.speed) : 0;
          safeIpcSend('download:progress', {
            modId: task.modId,
            downloadId: task.id,
            fileName: task.fileName,
            totalBytes: task.totalBytes,
            downloadedBytes,
            speed: task.speed,
            eta: task.eta,
            percent: task.totalBytes > 0 ? Math.round((downloadedBytes / task.totalBytes) * 100) : 0,
            status: task.status,
          });
        }
      });

      // Register abort handler BEFORE pipeline to avoid race
      const onAbort = () => {
        task.cancelledFlag = true;
        response.data.destroy();
        if (writer) {
          try { writer.close(); } catch {}
          writer = null;
        }
      };
      task.controller.signal.addEventListener('abort', onAbort);

      try {
        await pipeline(response.data, writer);
        writer = null;
      } catch (err: any) {
        if (err.code === 'ERR_STREAM_PREMATURE_CLOSE' || task.cancelledFlag) {
          return;
        }
        throw err;
      } finally {
        task.controller.signal.removeEventListener('abort', onAbort);
      }

      // Check for cancellation that happened right after pipeline finished
      if (task.cancelledFlag) return;

      task.status = 'verifying';
      safeIpcSend('download:progress', {
        modId: task.modId, downloadId: task.id, fileName: task.fileName,
        totalBytes: task.totalBytes, downloadedBytes: task.downloadedBytes,
        speed: 0, eta: 0, percent: 100, status: task.status,
      });

      if (task.hash) {
        const fileHash = await this.calculateHash(task.filePath);
        if (fileHash !== task.hash) {
          task.status = 'error';
          try { await this.updateDbStatus(downloadId, 'error', 'Hash mismatch'); } catch {}
          LogManager.error('Hash mismatch', { file: task.fileName, expected: task.hash, got: fileHash });
          safeIpcSend('download:error', { modId: task.modId, downloadId: task.id, error: 'Hash verification failed' });
          return;
        }
      }

      task.status = 'completed';
      try { await this.updateDbStatus(downloadId, 'completed'); } catch {}
      LogManager.info('Download completed', { file: task.fileName, size: task.totalBytes });
      safeIpcSend('download:progress', {
        modId: task.modId, downloadId: task.id, fileName: task.fileName,
        totalBytes: task.totalBytes, downloadedBytes: task.totalBytes,
        speed: 0, eta: 0, percent: 100, status: 'completed',
      });
      safeIpcSend('download:complete', { modId: task.modId, downloadId: task.id, filePath: task.filePath });

      const prisma = getPrisma();
      try {
        await prisma.download.update({
          where: { id: downloadId },
          data: { downloadedBytes: task.totalBytes, totalBytes: task.totalBytes },
        });
      } catch {}

    } catch (err: any) {
      if (task.filePath && await asyncFs.exists(task.filePath).catch(() => false)) {
        try { await asyncFs.unlink(task.filePath); } catch {}
      }
      if (axios.isCancel(err) || task.cancelledFlag) return;
      task.status = 'error';
      try { await this.updateDbStatus(downloadId, 'error', err.message); } catch {}
      safeIpcSend('download:error', { modId: task.modId, downloadId: task.id, error: err.message });
      LogManager.error('Download failed', { url: task.url?.substring(0, 100), error: err.message });
    } finally {
      if (writer) {
        try { writer.close(); } catch {}
        writer = null;
      }
    }
  }

  async pauseDownload(downloadId: string) {
    const task = this.downloads.get(downloadId);
    if (!task || task.status !== 'downloading') return;
    task.status = 'paused';
    task.controller?.abort();
    try { await this.updateDbStatus(downloadId, 'paused'); } catch {}
    safeIpcSend('download:progress', {
      modId: task.modId, downloadId: task.id, fileName: task.fileName,
      totalBytes: task.totalBytes, downloadedBytes: task.downloadedBytes,
      speed: 0, eta: 0, percent: task.totalBytes > 0 ? Math.round((task.downloadedBytes / task.totalBytes) * 100) : 0,
      status: 'paused',
    });
  }

  async resumeDownload(downloadId: string) {
    const task = this.downloads.get(downloadId);
    if (!task || task.status !== 'paused') return;
    task.status = 'pending';
    task.cancelledFlag = false;
    task.controller = new AbortController();
    try { await this.updateDbStatus(downloadId, 'pending'); } catch {}
    this.queue.push(downloadId);
    this.processQueue();
  }

  async cancelDownload(downloadId: string) {
    const task = this.downloads.get(downloadId);
    if (!task) return;
    task.status = 'cancelled';
    task.cancelledFlag = true;
    task.controller?.abort();
    if (task.stream) {
      try { task.stream.close(); } catch {}
    }
    try {
      if (await asyncFs.exists(task.filePath).catch(() => false)) {
        await asyncFs.unlink(task.filePath);
      }
    } catch {}
    try { await this.updateDbStatus(downloadId, 'cancelled'); } catch {}
    safeIpcSend('download:progress', {
      modId: task.modId, downloadId: task.id, fileName: task.fileName,
      totalBytes: 0, downloadedBytes: 0, speed: 0, eta: 0, percent: 0, status: 'cancelled',
    });
    this.downloads.delete(downloadId);
  }

  async retryDownload(downloadId: string) {
    const prisma = getPrisma();

    // Cancel any existing active download for this ID first
    const existing = this.downloads.get(downloadId);
    if (existing) {
      existing.status = 'cancelled';
      existing.cancelledFlag = true;
      existing.controller?.abort();
      if (existing.stream) {
        try { existing.stream.close(); } catch {}
      }
    }

    const download = await prisma.download.findUnique({ where: { id: downloadId } });
    if (!download) return;
    if (existing) this.downloads.delete(downloadId);

    try {
      if (await asyncFs.exists(download.filePath).catch(() => false)) {
        await asyncFs.unlink(download.filePath);
      }
    } catch {}

    await prisma.download.update({
      where: { id: downloadId },
      data: { status: 'pending', downloadedBytes: 0, error: null },
    });

    const task: DownloadTask = {
      id: download.id,
      modId: download.modId,
      url: download.url,
      fileName: download.fileName,
      filePath: download.filePath,
      totalBytes: 0,
      downloadedBytes: 0,
      status: 'pending',
      speed: 0,
      eta: 0,
      startTime: 0,
      controller: null,
      stream: null,
      lastEmit: 0,
      lastBytes: 0,
      hash: download.hash,
      cancelledFlag: false,
    };

    this.downloads.set(downloadId, task);
    this.queue.push(downloadId);
    this.processQueue();
  }

  async getQueue() {
    const prisma = getPrisma();
    return await prisma.download.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  private async updateDbStatus(id: string, status: string, error?: string) {
    const prisma = getPrisma();
    await prisma.download.update({
      where: { id },
      data: { status, error: error || null },
    });
  }

  private calculateHash(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const s = fs.createReadStream(filePath);
      s.on('data', (data) => hash.update(data));
      s.on('end', () => resolve(hash.digest('hex')));
      s.on('error', reject);
    });
  }
}

export const DownloadManager = new DownloadManagerClass();
