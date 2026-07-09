import { create } from 'zustand';

interface DownloadProgress {
  modId: string;
  downloadId: string;
  fileName: string;
  totalBytes: number;
  downloadedBytes: number;
  speed: number;
  eta: number;
  percent: number;
  status: string;
}

interface DownloadState {
  queue: any[];
  activeDownloads: Map<string, DownloadProgress>;
  isQueueVisible: boolean;

  fetchQueue: () => Promise<void>;
  startDownload: (params: { modId: string; url: string; fileName: string; hash?: string }) => Promise<string>;
  pauseDownload: (id: string) => Promise<void>;
  resumeDownload: (id: string) => Promise<void>;
  cancelDownload: (id: string) => Promise<void>;
  retryDownload: (id: string) => Promise<void>;
  updateProgress: (data: DownloadProgress) => void;
  setQueueVisible: (visible: boolean) => void;
}

export const useDownloadStore = create<DownloadState>((set, get) => ({
  queue: [],
  activeDownloads: new Map(),
  isQueueVisible: false,

  fetchQueue: async () => {
    try {
      const queue = await window.electronAPI.getQueue();
      set({ queue });
    } catch {}
  },

  startDownload: async (params) => {
    const id = await window.electronAPI.startDownload(params);
    await get().fetchQueue();
    return id;
  },

  pauseDownload: async (id) => {
    await window.electronAPI.pauseDownload(id);
    await get().fetchQueue();
  },

  resumeDownload: async (id) => {
    await window.electronAPI.resumeDownload(id);
    await get().fetchQueue();
  },

  cancelDownload: async (id) => {
    await window.electronAPI.cancelDownload(id);
    await get().fetchQueue();
    const active = get().activeDownloads;
    active.delete(id);
    set({ activeDownloads: new Map(active) });
  },

  retryDownload: async (id) => {
    await window.electronAPI.retryDownload(id);
    await get().fetchQueue();
  },

  updateProgress: (data) => {
    const active = get().activeDownloads;
    active.set(data.downloadId || data.modId, data);
    set({ activeDownloads: new Map(active) });
  },

  setQueueVisible: (visible) => set({ isQueueVisible: visible }),
}));
