export interface ModData {
  id: string;
  title: string;
  author: string;
  version: string;
  description: string;
  engine: string;
  tags: string;
  category: string;
  homepage: string;
  bannerUrl: string;
  thumbnailUrl: string;
  fileSize: number;
  downloadCount: number;
  sourceUrl: string;
  sourceType: string;
  isInstalled: boolean;
  installedAt: string | null;
  updatedAt: string;
  createdAt: string;
  dependencies: string;
  requirements: string;
  changelog: string;
  screenshots: string;
  videos: string;
  characters: string;
  songs: string;
  difficulty: string;
  isFeatured: boolean;
  isTrending: boolean;
  isPopular: boolean;
  isFavorited: boolean;
}

export interface DownloadData {
  id: string;
  modId: string;
  url: string;
  fileName: string;
  filePath: string;
  totalBytes: number;
  downloadedBytes: number;
  status: DownloadStatus;
  speed: number;
  eta: number;
  error: string | null;
  createdAt: string;
  hash: string | null;
}

export type DownloadStatus = 'pending' | 'downloading' | 'paused' | 'completed' | 'error' | 'cancelled' | 'verifying';

export interface InstallData {
  id: string;
  modId: string;
  profileId: string;
  enginePath: string;
  status: string;
  enabled: boolean;
  createdAt: string;
  backupPath: string | null;
}

export interface ProfileData {
  id: string;
  name: string;
  description: string | null;
  color: string;
  isDefault: boolean;
  createdAt: string;
}

export interface EngineData {
  id: string;
  name: string;
  type: string;
  path: string;
  version: string | null;
  isCustom: boolean;
  isDetected: boolean;
  createdAt: string;
}

export interface SettingData {
  id: string;
  key: string;
  value: string;
}

export interface LogData {
  id: string;
  level: string;
  message: string;
  details: string | null;
  createdAt: string;
}

export interface CollectionData {
  id: string;
  name: string;
  description: string | null;
  coverUrl: string | null;
  modIds: string;
  createdAt: string;
}

export interface DownloadProgress {
  modId: string;
  downloadId: string;
  fileName: string;
  totalBytes: number;
  downloadedBytes: number;
  speed: number;
  eta: number;
  percent: number;
  status: DownloadStatus;
}

export interface ModSearchResult {
  id: string;
  title: string;
  author: string;
  version: string;
  description: string;
  engine: string;
  thumbnailUrl: string;
  fileSize: number;
  downloadCount: number;
  sourceUrl: string;
  sourceType: string;
  characters: string;
  songs: string;
  difficulty: string;
  category: string;
  isFeatured: boolean;
  isTrending: boolean;
  isPopular: boolean;
  isFavorited: boolean;
  isInstalled: boolean;
  tags: string;
  updatedAt: string;
}

export interface SearchFilters {
  query: string;
  category: string;
  engine: string;
  character: string;
  song: string;
  difficulty: string;
  sortBy: 'popular' | 'trending' | 'updated' | 'name';
}

export interface DownloadQueueItem {
  id: string;
  modId: string;
  url: string;
  fileName: string;
  status: DownloadStatus;
  progress: number;
  totalBytes: number;
  downloadedBytes: number;
  speed: number;
  eta: number;
}

export interface AppSettings {
  theme: 'dark' | 'light';
  language: string;
  downloadFolder: string;
  gameFolder: string;
  engineFolders: string[];
  defaultEngine: string;
  concurrentDownloads: number;
  animations: boolean;
  notifications: boolean;
  autoUpdate: boolean;
  autoUpdateMods: boolean;
}

export interface GameBananaMod {
  id: number;
  name: string;
  owner: { name: string };
  description: string;
  Downloads: { aFiles: Array<{ _sFile: string; _nFileSize: number; _sDownloadUrl: string }> };
  _sPreviewUrl: string;
  _sScreenshotUrl: string;
  _aTags: Array<{ _sName: string }>;
  _sModelName: string;
  _aMetadata: Record<string, any>;
  _aChangeLogs?: Array<{ _sText: string }>;
}

export interface GitHubRelease {
  tag_name: string;
  name: string;
  body: string;
  assets: Array<{
    name: string;
    size: number;
    browser_download_url: string;
    content_type: string;
  }>;
  published_at: string;
  html_url: string;
}
