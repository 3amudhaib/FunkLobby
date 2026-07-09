export const APP_NAME = 'FunkLobby';
export const APP_VERSION = '1.0.0';
export const APP_REPO = 'https://github.com/example/fnf-lobby';

export { ENGINE_CATALOG } from './engineTypes';

export const CATEGORIES = [
  'All',
  'Gameplay',
  'Character',
  'Song',
  'Chart',
  'UI',
  'Script',
  'Tutorial',
  'Full Conversion',
  'Other',
];

export const DIFFICULTIES = [
  'All',
  'Easy',
  'Normal',
  'Hard',
  'Expert',
  'Insane',
];

export const SORT_OPTIONS = [
  { id: 'popular', label: 'Most Popular' },
  { id: 'trending', label: 'Trending' },
  { id: 'updated', label: 'Recently Updated' },
  { id: 'name', label: 'Name' },
];

export const THEMES = {
  dark: {
    bg: 'bg-surface-950',
    surface: 'bg-surface-900',
    surfaceHover: 'bg-surface-800',
    surfaceLight: 'bg-surface-800/50',
    border: 'border-surface-700/50',
    text: 'text-white',
    textSecondary: 'text-surface-400',
    glass: 'bg-white/5 backdrop-blur-xl',
    glassBorder: 'border-white/10',
    card: 'bg-surface-900 border border-surface-700/50',
    cardHover: 'bg-surface-800 border-surface-600/50',
  },
  light: {
    bg: 'bg-surface-50',
    surface: 'bg-white',
    surfaceHover: 'bg-surface-100',
    surfaceLight: 'bg-surface-100/50',
    border: 'border-surface-200/50',
    text: 'text-surface-900',
    textSecondary: 'text-surface-500',
    glass: 'bg-white/80 backdrop-blur-xl',
    glassBorder: 'border-surface-200/50',
    card: 'bg-white border border-surface-200/50',
    cardHover: 'bg-surface-50 border-surface-300/50',
  },
};

export const THEME_PRESETS = [
  { id: 'dark', name: 'Dark', description: 'Classic dark theme', icon: 'moon', colors: { primary: '#3b82f6', bg: '#020617', surface: '#0f172a' } },
  { id: 'light', name: 'Light', description: 'Clean light theme', icon: 'sun', colors: { primary: '#2563eb', bg: '#f8fafc', surface: '#ffffff' } },
  { id: 'midnight', name: 'Midnight Blue', description: 'Deep blue tones', icon: 'moon', colors: { primary: '#8b5cf6', bg: '#020617', surface: '#0f172a', accent: '#a78bfa' } },
  { id: 'forest', name: 'Forest', description: 'Green natural vibe', icon: 'moon', colors: { primary: '#22c55e', bg: '#052e16', surface: '#0f172a', accent: '#4ade80' } },
  { id: 'sunset', name: 'Sunset', description: 'Warm orange glow', icon: 'sun', colors: { primary: '#f59e0b', bg: '#1c1917', surface: '#292524', accent: '#fb923c' } },
  { id: 'ocean', name: 'Ocean', description: 'Cool aquatic theme', icon: 'moon', colors: { primary: '#06b6d4', bg: '#042f2e', surface: '#0f172a', accent: '#22d3ee' } },
];

export const STANDALONE_ENGINE_ID = 'standalone';
export const STANDALONE_ENGINE = { id: STANDALONE_ENGINE_ID, name: 'Standalone', detectFiles: [] };

export const DEFAULT_SETTINGS = {
  theme: 'dark',
  themePreset: 'dark',
  customPrimary: '#3b82f6',
  customBg: '#020617',
  language: 'en',
  downloadFolder: '',
  gameFolder: '',
  engineFolders: [] as string[],
  defaultEngine: 'psych',
  concurrentDownloads: 3,
  animations: true,
  notifications: true,
  autoUpdate: true,
  autoUpdateMods: true,
};

export const IPC_CHANNELS = {
  // Mod operations
  SEARCH_MODS: 'mods:search',
  GET_MOD_DETAILS: 'mods:getModDetails',
  GET_DOWNLOAD_URL: 'mods:getDownloadUrl',
  GET_MOD: 'mods:get',
  GET_FEATURED: 'mods:getFeatured',
  GET_TRENDING: 'mods:getTrending',
  GET_POPULAR: 'mods:getPopular',
  GET_RECENTLY_PLAYED: 'mods:getRecentlyPlayed',
  GET_INSTALLED: 'mods:getInstalled',
  GET_LIBRARY: 'mods:getLibrary',
  FAVORITE_MOD: 'mods:favorite',
  DELETE_MOD: 'mods:delete',
  INSTALL_MOD: 'mods:install',
  UNINSTALL_MOD: 'mods:uninstall',
  ENABLE_MOD: 'mods:enable',
  DISABLE_MOD: 'mods:disable',
  DUPLICATE_MOD: 'mods:duplicate',
  BACKUP_MOD: 'mods:backup',
  RESTORE_MOD: 'mods:restore',
  EXPORT_MOD: 'mods:export',
  IMPORT_MOD: 'mods:import',
  RENAME_MOD: 'mods:rename',
  MOVE_MOD: 'mods:move',
  SYNC_FROM_GAMEBANANA: 'mods:syncFromGameBanana',
  VERIFY_INSTALLATION: 'mods:verifyInstallation',

  // Download operations
  START_DOWNLOAD: 'download:start',
  PAUSE_DOWNLOAD: 'download:pause',
  RESUME_DOWNLOAD: 'download:resume',
  CANCEL_DOWNLOAD: 'download:cancel',
  RETRY_DOWNLOAD: 'download:retry',
  GET_QUEUE: 'download:getQueue',
  DOWNLOAD_PROGRESS: 'download:progress',
  DOWNLOAD_COMPLETE: 'download:complete',
  DOWNLOAD_ERROR: 'download:error',

  // Engine operations
  GET_ENGINE_CATALOG: 'engines:catalog',
  GET_ENGINES: 'engines:getAll',
  GET_ENGINE: 'engines:get',
  INSTALL_ENGINE: 'engines:install',
  UNINSTALL_ENGINE: 'engines:uninstall',
  LAUNCH_ENGINE: 'engines:launch',
  LAUNCH_MOD: 'engines:launchMod',
  CHECK_ENGINE_UPDATES: 'engines:checkUpdates',
  UPDATE_ENGINE: 'engines:update',
  REPAIR_ENGINE: 'engines:repair',
  VERIFY_ENGINE: 'engines:verify',
  DETECT_ENGINES: 'engines:detect',
  OPEN_ENGINE_FOLDER: 'engines:openFolder',
  SELECT_DEFAULT_ENGINE: 'engines:selectDefault',
  CREATE_ENGINE_SHORTCUT: 'engines:createShortcut',
  GET_ENGINE_LOGS: 'engines:logs',
  GET_ENGINE_IMAGE: 'engines:getImage',

  // Profile operations
  CREATE_PROFILE: 'profiles:create',
  DELETE_PROFILE: 'profiles:delete',
  GET_PROFILES: 'profiles:getAll',
  SET_DEFAULT_PROFILE: 'profiles:setDefault',
  SWITCH_PROFILE: 'profiles:switch',
  UPDATE_PROFILE: 'profiles:update',

  // Settings operations
  GET_SETTINGS: 'settings:get',
  UPDATE_SETTINGS: 'settings:update',
  RESET_SETTINGS: 'settings:reset',

  // File operations
  OPEN_MOD_FOLDER: 'file:openModFolder',
  REVEAL_IN_EXPLORER: 'file:reveal',
  COPY_PATH: 'file:copyPath',
  SELECT_FOLDER: 'file:selectFolder',
  SELECT_FILE: 'file:selectFile',

  // App operations
  GET_APP_INFO: 'app:getInfo',
  CHECK_UPDATES: 'app:checkUpdates',
  MINIMIZE_WINDOW: 'app:minimize',
  MAXIMIZE_WINDOW: 'app:maximize',
  CLOSE_WINDOW: 'app:close',
  GET_LOGS: 'app:getLogs',
  CLEAR_ALL_DATA: 'app:clearData',

  // Local import operations
  SELECT_LOCAL_MOD_FOLDER: 'mods:selectLocalModFolder',
  SAVE_LOCAL_MOD: 'mods:saveLocalMod',

  // Cache operations
  GET_CACHE_SIZE: 'cache:getSize',
  CLEAR_CACHE: 'cache:clear',
} as const;
