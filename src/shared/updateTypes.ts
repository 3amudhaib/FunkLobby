export type UpdateChannel = 'stable' | 'beta';

export interface UpdateInfo {
  latestVersion: string;
  currentVersion: string;
  updateAvailable: boolean;
  releaseUrl: string | null;
  releaseNotes: string;
  publishedAt: string | null;
  downloadUrl: string | null;
  downloadSize: number;
  checksum: string | null;
  channel: UpdateChannel;
}

export interface UpdateDownloadProgress {
  bytesPerSecond: number;
  percent: number;
  total: number;
  transferred: number;
}

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'up_to_date'
  | 'downloading'
  | 'downloaded'
  | 'installing'
  | 'installed'
  | 'restarting'
  | 'error'
  | 'rollback';

export interface UpdateState {
  status: UpdateStatus;
  info: UpdateInfo | null;
  progress: UpdateDownloadProgress | null;
  error: string | null;
  channel: UpdateChannel;
  autoUpdate: boolean;
}

export const UPDATE_REPO_OWNER = '3amudhaib';
export const UPDATE_REPO_NAME = 'FunkLobby';

export const UPDATE_IPC_CHANNELS = {
  CHECK: 'update:check',
  DOWNLOAD: 'update:download',
  INSTALL: 'update:install',
  GET_STATE: 'update:getState',
  SET_CHANNEL: 'update:setChannel',
  SET_AUTO_UPDATE: 'update:setAutoUpdate',
  GET_CHANNEL: 'update:getChannel',
  GET_AUTO_UPDATE: 'update:getAutoUpdate',
  ON_STATUS: 'update:onStatus',
  ON_PROGRESS: 'update:onProgress',
} as const;