export interface ElectronAPI {
  searchMods: (params: any) => Promise<any>;
  getModDetails: (gameBananaId: number) => Promise<any>;
  getDownloadUrl: (gameBananaId: number) => Promise<string | null>;
  syncFromGameBanana: (query?: string) => Promise<number>;
  getMod: (id: string) => Promise<any>;
  getFeatured: () => Promise<any[]>;
  getRecentlyPlayed: () => Promise<any[]>;
  getTrending: () => Promise<any[]>;
  getPopular: () => Promise<any[]>;
  getInstalled: () => Promise<any[]>;
  getLibrary: (params: any) => Promise<any[]>;
  favoriteMod: (id: string) => Promise<any>;
  deleteMod: (id: string) => Promise<any>;
  installMod: (id: string, profileId: string, engineSelection?: string) => Promise<any>;
  uninstallMod: (id: string) => Promise<any>;
  enableMod: (id: string) => Promise<any>;
  disableMod: (id: string) => Promise<any>;
  duplicateMod: (id: string) => Promise<any>;
  backupMod: (id: string) => Promise<string>;
  restoreMod: (id: string, backupPath: string) => Promise<any>;
  exportMod: (id: string) => Promise<any>;
  importMod: () => Promise<any>;
  renameMod: (id: string, name: string) => Promise<any>;
  moveMod: (id: string, targetProfile: string) => Promise<any>;
  verifyInstallation: (modId: string) => Promise<{ verified: boolean; error?: string }>;

  startDownload: (params: { modId: string; url: string; fileName: string; hash?: string }) => Promise<string>;
  pauseDownload: (id: string) => Promise<any>;
  resumeDownload: (id: string) => Promise<any>;
  cancelDownload: (id: string) => Promise<any>;
  retryDownload: (id: string) => Promise<any>;
  getQueue: () => Promise<any[]>;

  onDownloadProgress: (callback: (data: any) => void) => void;
  removeDownloadProgressListener: (callback: (data: any) => void) => void;
  onDownloadComplete: (callback: (data: any) => void) => void;
  removeDownloadCompleteListener: (callback: (data: any) => void) => void;
  onDownloadError: (callback: (data: any) => void) => void;
  removeDownloadErrorListener: (callback: (data: any) => void) => void;

  getEngineCatalog: () => Promise<any[]>;
  getEngines: () => Promise<any[]>;
  getEngine: (id: string) => Promise<any>;
  installEngine: (engineType: string) => Promise<any>;
  uninstallEngine: (engineId: string) => Promise<any>;
  launchEngine: (engineId: string) => Promise<any>;
  detectEngines: () => Promise<any[]>;
  selectDefaultEngine: (id: string) => Promise<any>;
  launchMod: (modId: string, engineId: string) => Promise<any>;
  openEngineFolder: (id: string) => Promise<any>;
  checkEngineUpdates: (engineType?: string) => Promise<any>;
  updateEngine: (engineId: string) => Promise<any>;
  repairEngine: (engineId: string) => Promise<any>;
  verifyEngine: (engineId: string) => Promise<any>;
  createEngineShortcut: (engineId: string) => Promise<any>;
  getEngineImage: (engineType: string) => Promise<string | null>;
  getEngineLogs: (engineId: string) => Promise<any>;
  importExternalEngine: () => Promise<any>;

  onEngineInstallProgress: (callback: (data: { engineType: string; percent: number; status: string }) => void) => void;
  removeEngineInstallProgressListener: (callback: (data: any) => void) => void;

  createProfile: (name: string, description?: string) => Promise<any>;
  deleteProfile: (id: string) => Promise<any>;
  getProfiles: () => Promise<any[]>;
  setDefaultProfile: (id: string) => Promise<any>;
  switchProfile: (id: string) => Promise<any>;
  updateProfile: (id: string, data: any) => Promise<any>;

  getSettings: () => Promise<Record<string, string>>;
  updateSettings: (settings: Record<string, string>) => Promise<any>;
  resetSettings: () => Promise<any>;

  openModFolder: (id: string) => Promise<any>;
  revealInExplorer: (path: string) => Promise<any>;
  copyPath: (path: string) => Promise<any>;
  selectFolder: () => Promise<{ path?: string; canceled?: boolean }>;
  selectFile: (filters?: any[]) => Promise<{ path?: string; canceled?: boolean }>;

  getAppInfo: () => Promise<any>;
  checkUpdates: () => Promise<any>;
  minimizeWindow: () => void;
  maximizeWindow: () => void;
  closeWindow: () => void;
  getLogs: (level?: string) => Promise<any[]>;
  clearAllData: () => Promise<{ success: boolean; reason?: string }>;

  selectLocalModFolder: () => Promise<{ folderPath: string; folderName: string; canceled?: boolean }>;
  saveLocalMod: (params: { name: string; sourceFolder: string }) => Promise<any>;
  installToEngine: (params: { modId: string; engineId: string }) => Promise<{ success: boolean; targetPath: string; renamed: boolean }>;
  getInstalledEngines: () => Promise<Array<{ id: string; type: string; name: string; installPath: string }>>;

  setCover: (modId: string) => Promise<any>;
  removeCover: (modId: string) => Promise<any>;
  getCoverPath: (modId: string) => Promise<string | null>;

  getCacheSize: () => Promise<{ api: number; thumbnails: number; total: number }>;
  clearCache: (type?: 'api' | 'thumbnails' | 'all') => Promise<{ success: boolean }>;
  clearCacheOnly: () => Promise<{ success: boolean }>;
  resetAppKeepFiles: () => Promise<{ success: boolean }>;
  getRunningEngines: () => Promise<string[]>;
  stopEngine: (engineId: string) => Promise<any>;
  validateAllEngines: () => Promise<any>;
  onEnginesRunningChanged: (callback: (ids: string[]) => void) => void;
  removeEnginesRunningChangedListener: (callback: (ids: string[]) => void) => void;

  // Mod install progress events
  onModInstallProgress: (callback: (data: { step: string; percent: number }) => void) => void;
  removeModInstallProgressListener: (callback: (data: any) => void) => void;

  // Catalog update events
  onCatalogUpdate: (callback: (catalog: any[]) => void) => void;
  removeCatalogUpdateListener: (callback: (catalog: any[]) => void) => void;

  // Cache operations
  getCachedThumbnail: (url: string) => Promise<string>;

  // GameBanana stats & comments
  getModStats: (gameBananaId: number) => Promise<{ likeCount: number; viewCount: number; commentCount: number } | null>;
  getModComments: (gameBananaId: number, page?: number) => Promise<{ comments: any[]; total: number; page: number; totalPages: number }>;

  // Discover operations
  discoverGetSection: (section: string) => Promise<any[]>;
  discoverGetRichDetails: (gameBananaId: number) => Promise<any>;
  discoverSearch: (params: { query?: string; category?: string; engine?: string; sortBy?: string; page?: number; limit?: number }) => Promise<any>;
  discoverDownloadUrl: (gameBananaId: number) => Promise<string | null>;

  // Update operations
  checkUpdatesApp: (force?: boolean) => Promise<any>;
  downloadUpdate: () => Promise<string>;
  installUpdate: () => Promise<void>;
  getUpdateState: () => Promise<any>;
  setUpdateChannel: (channel: string) => Promise<void>;
  setAutoUpdateApp: (enabled: boolean) => Promise<void>;
  getUpdateChannel: () => Promise<string>;
  getAutoUpdateApp: () => Promise<boolean>;

  // Diagnostics
  runDiagnostics: () => Promise<Array<{ check: string; status: 'ok' | 'warn' | 'fail'; message: string }>>;
  repairInstallation: () => Promise<string[]>;

  // Easter egg
  triggerEasterEgg: () => Promise<void>;
  onEasterEggOverlay: (callback: (data: { imageDataUrl: string }) => void) => void;
  removeEasterEggOverlayListener: (callback: (data: any) => void) => void;
  onEasterEggCleanup: (callback: () => void) => void;
  removeEasterEggCleanupListener: (callback: () => void) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
