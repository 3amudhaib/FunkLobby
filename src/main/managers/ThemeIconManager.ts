import { app, BrowserWindow, nativeImage, Tray } from 'electron';
import path from 'path';
import fs from 'fs';
import { LogManager } from './LogManager';
import { SettingsManager } from './SettingsManager';
import { resolvePackagedAssetPath } from '../utils/packagedPathResolver';

const THEME_ICON_MAP: Record<string, string> = {
  dark: 'dark-light.png',
  light: 'dark-light.png',
  midnight: 'midnight-blue.png',
  forest: 'forest.png',
  sunset: 'sunset.png',
  ocean: 'ocean.png',
};

const DEFAULT_ICON = 'icon.png';
const THEMES_DIR = 'assets/icons/themes';

export class ThemeIconManager {
  private static currentTheme: string = 'dark';
  private static tray: Tray | null = null;

  static getIconPath(theme: string): string {
    const filename = THEME_ICON_MAP[theme] || DEFAULT_ICON;
    return resolvePackagedAssetPath([THEMES_DIR, filename]);
  }

  static getCurrentTheme(): string {
    return this.currentTheme;
  }

  static getCurrentIcon(): string {
    return this.getIconPath(this.currentTheme);
  }

  static async setTheme(theme: string): Promise<void> {
    this.currentTheme = theme;
    this.updateWindowIcon();
    this.updateTrayIcon();
  }

  static updateWindowIcon(): void {
    try {
      const iconPath = this.getCurrentIcon();
      if (!fs.existsSync(iconPath)) {
        LogManager.warn('Theme icon not found in packaged app', {
          theme: this.currentTheme,
          iconPath,
          appPath: app.getAppPath(),
          resourcesPath: process.resourcesPath,
          packaged: app.isPackaged,
        });
        return;
      }
      const icon = nativeImage.createFromPath(iconPath);
      if (icon.isEmpty()) {
        LogManager.warn(`Theme icon is empty, falling back to default`, { path: iconPath });
        return;
      }
      const windows = BrowserWindow.getAllWindows();
      for (const win of windows) {
        win.setIcon(icon);
      }
    } catch (err) {
      LogManager.error('Failed to update window icon', { error: String(err) });
    }
  }

  static updateTrayIcon(): void {
    if (!this.tray) return;
    try {
      const iconPath = this.getCurrentIcon();
      if (!fs.existsSync(iconPath)) return;
      const icon = nativeImage.createFromPath(iconPath);
      if (!icon.isEmpty()) {
        this.tray.setImage(icon);
      }
    } catch (err) {
      LogManager.error('Failed to update tray icon', { error: String(err) });
    }
  }

  static setTray(tray: Tray | null): void {
    this.tray = tray;
    if (tray) {
      this.updateTrayIcon();
    }
  }

  static async loadSavedTheme(): Promise<void> {
    try {
      const theme = await SettingsManager.get('theme');
      this.currentTheme = theme || 'dark';
      this.updateWindowIcon();
    } catch (err) {
      LogManager.error('Failed to load saved theme icon', { error: String(err) });
      this.currentTheme = 'dark';
    }
  }

  static async saveTheme(theme: string): Promise<void> {
    try {
      await SettingsManager.set('theme', theme);
    } catch (err) {
      LogManager.error('Failed to save theme setting', { error: String(err) });
    }
  }
}