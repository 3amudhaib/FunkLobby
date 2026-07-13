import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // Mod operations
  searchMods: (params: any) => ipcRenderer.invoke('mods:search', params),
  getMod: (id: string) => ipcRenderer.invoke('mods:get', id),
  getFeatured: () => ipcRenderer.invoke('mods:getFeatured'),
  getTrending: () => ipcRenderer.invoke('mods:getTrending'),
  getPopular: () => ipcRenderer.invoke('mods:getPopular'),
  getRecentlyPlayed: () => ipcRenderer.invoke('mods:getRecentlyPlayed'),
  getInstalled: () => ipcRenderer.invoke('mods:getInstalled'),
  getLibrary: (params: any) => ipcRenderer.invoke('mods:getLibrary', params),
  favoriteMod: (id: string) => ipcRenderer.invoke('mods:favorite', id),
  deleteMod: (id: string) => ipcRenderer.invoke('mods:delete', id),
  installMod: (id: string, profileId: string, engineSelection?: string) => ipcRenderer.invoke('mods:install', id, profileId, engineSelection),
  uninstallMod: (id: string) => ipcRenderer.invoke('mods:uninstall', id),
  enableMod: (id: string) => ipcRenderer.invoke('mods:enable', id),
  disableMod: (id: string) => ipcRenderer.invoke('mods:disable', id),
  duplicateMod: (id: string) => ipcRenderer.invoke('mods:duplicate', id),
  backupMod: (id: string) => ipcRenderer.invoke('mods:backup', id),
  restoreMod: (id: string, backupPath: string) => ipcRenderer.invoke('mods:restore', id, backupPath),
  exportMod: (id: string) => ipcRenderer.invoke('mods:export', id),
  importMod: () => ipcRenderer.invoke('mods:import'),
  renameMod: (id: string, name: string) => ipcRenderer.invoke('mods:rename', id, name),
  moveMod: (id: string, targetProfile: string) => ipcRenderer.invoke('mods:move', id, targetProfile),

  getModDetails: (gameBananaId: number) => ipcRenderer.invoke('mods:getModDetails', gameBananaId),
  getDownloadUrl: (gameBananaId: number) => ipcRenderer.invoke('mods:getDownloadUrl', gameBananaId),
  syncFromGameBanana: (query?: string) => ipcRenderer.invoke('mods:syncFromGameBanana', query),
  verifyInstallation: (modId: string) => ipcRenderer.invoke('mods:verifyInstallation', modId),

  // Download operations
  startDownload: (params: any) => ipcRenderer.invoke('download:start', params),
  pauseDownload: (id: string) => ipcRenderer.invoke('download:pause', id),
  resumeDownload: (id: string) => ipcRenderer.invoke('download:resume', id),
  cancelDownload: (id: string) => ipcRenderer.invoke('download:cancel', id),
  retryDownload: (id: string) => ipcRenderer.invoke('download:retry', id),
  getQueue: () => ipcRenderer.invoke('download:getQueue'),

  // Download events
  onDownloadProgress: (callback: (data: any) => void) => {
    ipcRenderer.on('download:progress', (_event, data) => callback(data));
  },
  removeDownloadProgressListener: (callback: (data: any) => void) => {
    ipcRenderer.removeListener('download:progress', callback);
  },
  onDownloadComplete: (callback: (data: any) => void) => {
    ipcRenderer.on('download:complete', (_event, data) => callback(data));
  },
  removeDownloadCompleteListener: (callback: (data: any) => void) => {
    ipcRenderer.removeListener('download:complete', callback);
  },
  onDownloadError: (callback: (data: any) => void) => {
    ipcRenderer.on('download:error', (_event, data) => callback(data));
  },
  removeDownloadErrorListener: (callback: (data: any) => void) => {
    ipcRenderer.removeListener('download:error', callback);
  },

  // Engine operations
  getEngineCatalog: () => ipcRenderer.invoke('engines:catalog'),
  getEngines: () => ipcRenderer.invoke('engines:getAll'),
  getEngine: (id: string) => ipcRenderer.invoke('engines:get', id),
  installEngine: (engineType: string) => ipcRenderer.invoke('engines:install', engineType),
  uninstallEngine: (engineId: string) => ipcRenderer.invoke('engines:uninstall', engineId),
  launchEngine: (engineId: string) => ipcRenderer.invoke('engines:launch', engineId),
  detectEngines: () => ipcRenderer.invoke('engines:detect'),
  selectDefaultEngine: (id: string) => ipcRenderer.invoke('engines:selectDefault', id),
  launchMod: (modId: string, engineId: string) => ipcRenderer.invoke('engines:launchMod', modId, engineId),
  openEngineFolder: (id: string) => ipcRenderer.invoke('engines:openFolder', id),
  checkEngineUpdates: (engineType?: string) => ipcRenderer.invoke('engines:checkUpdates', engineType),
  updateEngine: (engineId: string) => ipcRenderer.invoke('engines:update', engineId),
  repairEngine: (engineId: string) => ipcRenderer.invoke('engines:repair', engineId),
  verifyEngine: (engineId: string) => ipcRenderer.invoke('engines:verify', engineId),
  createEngineShortcut: (engineId: string) => ipcRenderer.invoke('engines:createShortcut', engineId),
  getEngineImage: (engineType: string) => ipcRenderer.invoke('engines:getImage', engineType),
  getEngineLogs: (engineId: string) => ipcRenderer.invoke('engines:logs', engineId),
  importExternalEngine: () => ipcRenderer.invoke('engines:importExternal'),

  // Engine install progress events
  onEngineInstallProgress: (callback: (data: { engineType: string; percent: number; status: string }) => void) => {
    ipcRenderer.on('engine:installProgress', (_event, data) => callback(data));
  },
  removeEngineInstallProgressListener: (callback: (data: any) => void) => {
    ipcRenderer.removeListener('engine:installProgress', callback);
  },

  // Profile operations
  createProfile: (name: string, description?: string) => ipcRenderer.invoke('profiles:create', name, description),
  deleteProfile: (id: string) => ipcRenderer.invoke('profiles:delete', id),
  getProfiles: () => ipcRenderer.invoke('profiles:getAll'),
  setDefaultProfile: (id: string) => ipcRenderer.invoke('profiles:setDefault', id),
  switchProfile: (id: string) => ipcRenderer.invoke('profiles:switch', id),
  updateProfile: (id: string, data: any) => ipcRenderer.invoke('profiles:update', id, data),

  // Settings operations
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (settings: any) => ipcRenderer.invoke('settings:update', settings),
  resetSettings: () => ipcRenderer.invoke('settings:reset'),

  // File operations
  openModFolder: (id: string) => ipcRenderer.invoke('file:openModFolder', id),
  revealInExplorer: (path: string) => ipcRenderer.invoke('file:reveal', path),
  copyPath: (path: string) => ipcRenderer.invoke('file:copyPath', path),
  selectFolder: () => ipcRenderer.invoke('file:selectFolder'),
  selectFile: (filters?: any[]) => ipcRenderer.invoke('file:selectFile', filters),

  // App operations
  getAppInfo: () => ipcRenderer.invoke('app:getInfo'),
  checkUpdates: () => ipcRenderer.invoke('app:checkUpdates'),
  minimizeWindow: () => ipcRenderer.invoke('app:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('app:maximize'),
  closeWindow: () => ipcRenderer.invoke('app:close'),
  getLogs: (level?: string) => ipcRenderer.invoke('app:getLogs', level),
  clearAllData: () => ipcRenderer.invoke('app:clearData'),

  // Local import operations
  selectLocalModFolder: () => ipcRenderer.invoke('mods:selectLocalModFolder'),
  saveLocalMod: (params: { name: string; sourceFolder: string }) =>
    ipcRenderer.invoke('mods:saveLocalMod', params),
  installToEngine: (params: { modId: string; engineId: string }) =>
    ipcRenderer.invoke('mods:installToEngine', params),
  getInstalledEngines: () => ipcRenderer.invoke('mods:getInstalledEngines'),

  // Cover operations
  setCover: (modId: string) => ipcRenderer.invoke('mods:setCover', modId),
  removeCover: (modId: string) => ipcRenderer.invoke('mods:removeCover', modId),
  getCoverPath: (modId: string) => ipcRenderer.invoke('mods:getCoverPath', modId),

  // Cache operations
  getCacheSize: () => ipcRenderer.invoke('cache:getSize'),
  clearCache: (type?: 'api' | 'thumbnails' | 'all') => ipcRenderer.invoke('cache:clear', type),

  // Discover operations
  discoverGetSection: (section: string) => ipcRenderer.invoke('discover:getSection', section),
  discoverGetRichDetails: (gameBananaId: number) => ipcRenderer.invoke('discover:getRichDetails', gameBananaId),
  discoverSearch: (params: any) => ipcRenderer.invoke('discover:search', params),
  discoverDownloadUrl: (gameBananaId: number) => ipcRenderer.invoke('discover:downloadUrl', gameBananaId),

  // Update operations
  checkUpdatesApp: (force?: boolean) => ipcRenderer.invoke('update:check', force),
  downloadUpdate: () => ipcRenderer.invoke('update:download'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  getUpdateState: () => ipcRenderer.invoke('update:getState'),
  setUpdateChannel: (channel: string) => ipcRenderer.invoke('update:setChannel', channel),
  setAutoUpdateApp: (enabled: boolean) => ipcRenderer.invoke('update:setAutoUpdate', enabled),
  getUpdateChannel: () => ipcRenderer.invoke('update:getChannel'),
  getAutoUpdateApp: () => ipcRenderer.invoke('update:getAutoUpdate'),
});
