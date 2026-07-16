import { BrowserWindow, app } from 'electron';
import path from 'path';
import fs from 'fs';
import { LogManager } from './LogManager';

interface PopupState {
  win: BrowserWindow;
  dx: number;
  dy: number;
  angle: number;
  angleSpeed: number;
  jitterPhase: number;
}

export class EasterEggManager {
  private static popups: PopupState[] = [];
  private static shakeInterval: ReturnType<typeof setInterval> | null = null;
  private static popupInterval: ReturnType<typeof setInterval> | null = null;
  private static cleanupTimer: ReturnType<typeof setTimeout> | null = null;
  private static originalBounds: { x: number; y: number; width: number; height: number } | null = null;

  static async trigger(mainWindow: BrowserWindow): Promise<void> {
    LogManager.info('Easter egg triggered!');

    const bounds = mainWindow.getBounds();
    this.originalBounds = { ...bounds };

    this.shakeWindow(mainWindow);
    this.spawnPopups(mainWindow);

    setTimeout(() => {
      this.stopShake(mainWindow);
      this.darkenMainWindow(mainWindow);
    }, 2000);

    this.cleanupTimer = setTimeout(() => {
      this.cleanup(mainWindow);
    }, 12000);
  }

  private static shakeWindow(mainWindow: BrowserWindow): void {
    const orig = this.originalBounds!;
    let startTime = Date.now();

    this.shakeInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      if (elapsed > 2000) return;

      const intensity = Math.max(0, 1 - elapsed / 2000) * 8;
      const ox = (Math.random() - 0.5) * 2 * intensity;
      const oy = (Math.random() - 0.5) * 2 * intensity;

      try {
        mainWindow.setBounds({
          x: Math.round(orig.x + ox),
          y: Math.round(orig.y + oy),
          width: orig.width,
          height: orig.height,
        });
      } catch {}
    }, 16);
  }

  private static stopShake(mainWindow: BrowserWindow): void {
    if (this.shakeInterval) {
      clearInterval(this.shakeInterval);
      this.shakeInterval = null;
    }
    if (this.originalBounds) {
      try {
        mainWindow.setBounds(this.originalBounds);
      } catch {}
    }
  }

  private static spawnPopups(mainWindow: BrowserWindow): void {
    const displays = require('electron').screen.getAllDisplays();
    const primary = displays[0] || { bounds: { x: 0, y: 0, width: 1920, height: 1080 } };
    const { x: sx, y: sy, width: sw, height: sh } = primary.workArea || primary.bounds;

    const count = 8 + Math.floor(Math.random() * 8);
    const colors = ['#ff6b6b', '#ffd93d', '#6bcbff', '#a66cff', '#ff8a5c', '#5cf0a0', '#ff6bcb', '#6bffd9'];

    for (let i = 0; i < count; i++) {
      const w = 100 + Math.floor(Math.random() * 200);
      const h = 60 + Math.floor(Math.random() * 100);
      const x = sx + Math.floor(Math.random() * Math.max(sw - w, 200));
      const y = sy + Math.floor(Math.random() * Math.max(sh - h, 200));
      const color = colors[i % colors.length];
      const rot = (Math.random() - 0.5) * 10;
      const angleSpeed = (Math.random() - 0.5) * 0.02;
      const dx = (Math.random() - 0.5) * 4;
      const dy = (Math.random() - 0.5) * 4;

      const win = new BrowserWindow({
        width: w,
        height: h,
        x, y,
        transparent: true,
        frame: false,
        alwaysOnTop: true,
        resizable: false,
        skipTaskbar: true,
        hasShadow: false,
        show: false,
        webPreferences: {
          sandbox: true,
          contextIsolation: true,
        },
      });

      const hueShift = Math.floor(Math.random() * 360);
      const html = `<!DOCTYPE html>
<html><body style="margin:0;overflow:hidden;width:100%;height:100%;background:transparent;display:flex;align-items:center;justify-content:center;font-family:'Segoe UI',Arial,sans-serif;font-size:${12 + Math.floor(Math.random() * 8)}px;color:${color};text-shadow:0 0 8px ${color}44;transform:rotate(${rot}deg);user-select:none;cursor:default;">let me out, my new friend.</body></html>`;

      win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
      win.show();

      this.popups.push({ win, dx, dy, angle: rot, angleSpeed, jitterPhase: Math.random() * Math.PI * 2 });
    }

    this.popupInterval = setInterval(() => {
      for (const p of this.popups) {
        try {
          const bounds = p.win.getBounds();
          let nx = bounds.x + p.dx;
          let ny = bounds.y + p.dy;

          if (nx <= sx || nx + bounds.width >= sx + sw) { p.dx *= -1; nx = Math.max(sx, Math.min(nx, sx + sw - bounds.width)); }
          if (ny <= sy || ny + bounds.height >= sy + sh) { p.dy *= -1; ny = Math.max(sy, Math.min(ny, sy + sh - bounds.height)); }

          p.angle += p.angleSpeed;
          p.jitterPhase += 0.1;
          const jx = Math.sin(p.jitterPhase) * 0.5;
          const jy = Math.cos(p.jitterPhase * 1.3) * 0.5;

          p.win.setBounds({ x: Math.round(nx + jx), y: Math.round(ny + jy), width: bounds.width, height: bounds.height });
        } catch {}
      }
    }, 16);
  }

  private static darkenMainWindow(mainWindow: BrowserWindow): void {
    try {
      const imagePath = this.resolveImagePath();
      const imageDataUrl = this.fileToDataUrl(imagePath);
      mainWindow.webContents.send('easter-egg:overlay', {
        imageDataUrl,
      });
    } catch (err) {
      LogManager.warn('Failed to send easter egg overlay', { error: String(err) });
    }
  }

  private static resolveImagePath(): string {
    if (app.isPackaged) {
      const resPath = path.join(process.resourcesPath, 'assets', 'eastereggs', 'marky.png');
      if (fs.existsSync(resPath)) return resPath;
      return path.join(app.getAppPath(), 'assets', 'eastereggs', 'marky.png');
    }
    return path.join(app.getAppPath(), 'assets', 'eastereggs', 'marky.png');
  }

  private static fileToDataUrl(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mime = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.gif' ? 'image/gif' : 'image/png';
    const buffer = fs.readFileSync(filePath);
    return `data:${mime};base64,${buffer.toString('base64')}`;
  }

  private static async cleanup(mainWindow: BrowserWindow): Promise<void> {
    if (this.shakeInterval) { clearInterval(this.shakeInterval); this.shakeInterval = null; }
    if (this.popupInterval) { clearInterval(this.popupInterval); this.popupInterval = null; }
    if (this.cleanupTimer) { clearTimeout(this.cleanupTimer); this.cleanupTimer = null; }

    if (this.originalBounds) {
      try {
        mainWindow.setBounds(this.originalBounds);
      } catch {}
      this.originalBounds = null;
    }

    try {
      mainWindow.webContents.send('easter-egg:cleanup');
    } catch {}

    for (const p of this.popups) {
      try { p.win.close(); } catch {}
    }
    this.popups = [];

    await new Promise(r => setTimeout(r, 300));
    app.quit();
  }
}
