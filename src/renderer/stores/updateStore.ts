import { create } from 'zustand';

export type UpdateStatus =
  | 'idle' | 'checking' | 'available' | 'up_to_date'
  | 'downloading' | 'downloaded' | 'installing' | 'installed'
  | 'restarting' | 'error' | 'rollback';

export interface UpdateProgress {
  bytesPerSecond: number;
  percent: number;
  total: number;
  transferred: number;
}

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
  channel: 'stable' | 'beta';
}

interface UpdateState {
  status: UpdateStatus;
  info: UpdateInfo | null;
  progress: UpdateProgress | null;
  error: string | null;
  channel: 'stable' | 'beta';
  autoUpdate: boolean;
  showUpdateBanner: boolean;

  checkUpdates: (force?: boolean) => Promise<void>;
  downloadUpdate: () => Promise<void>;
  installUpdate: () => Promise<void>;
  setChannel: (channel: 'stable' | 'beta') => Promise<void>;
  setAutoUpdate: (enabled: boolean) => Promise<void>;
  dismissBanner: () => void;
}

export const useUpdateStore = create<UpdateState>((set, get) => ({
  status: 'idle',
  info: null,
  progress: null,
  error: null,
  channel: 'stable',
  autoUpdate: true,
  showUpdateBanner: false,

  checkUpdates: async (force = false) => {
    set({ status: 'checking', error: null });
    try {
      const info = await window.electronAPI.checkUpdatesApp(force);
      const hasUpdate = info?.updateAvailable || false;
      set({
        status: hasUpdate ? 'available' : 'up_to_date',
        info,
        showUpdateBanner: hasUpdate && !get().autoUpdate ? false : hasUpdate,
      });
    } catch (err: any) {
      set({ status: 'error', error: err.message });
    }
  },

  downloadUpdate: async () => {
    set({ status: 'downloading', error: null });
    try {
      await window.electronAPI.downloadUpdate();
      set({ status: 'downloaded' });
    } catch (err: any) {
      set({ status: 'error', error: err.message });
    }
  },

  installUpdate: async () => {
    set({ status: 'installing', error: null });
    try {
      await window.electronAPI.installUpdate();
      set({ status: 'installed' });
    } catch (err: any) {
      set({ status: 'error', error: err.message });
    }
  },

  setChannel: async (channel) => {
    await window.electronAPI.setUpdateChannel(channel);
    set({ channel });
  },

  setAutoUpdate: async (enabled) => {
    await window.electronAPI.setAutoUpdateApp(enabled);
    set({ autoUpdate: enabled });
  },

  dismissBanner: () => set({ showUpdateBanner: false }),
}));