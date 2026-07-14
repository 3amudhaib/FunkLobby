import { create } from 'zustand';

interface Engine {
  id: string;
  name: string;
  type: string;
  version: string | null;
  description: string | null;
  installPath: string | null;
  status: string;
  error: string | null;
  isCustom: boolean;
  isDetected: boolean;
  repoUrl: string | null;
  websiteUrl: string | null;
  license: string | null;
  features: string | null;
  platforms: string | null;
  installedAt: string | null;
  lastUpdatedAt: string | null;
}

interface EngineState {
  engines: Engine[];
  catalog: any[];
  imageUrls: Record<string, string | null>;
  loading: boolean;
  enginesLoaded: boolean;
  catalogLoaded: boolean;
  error: string | null;
  installProgress: Record<string, { percent: number; status: string }>;

  fetchEngines: () => Promise<void>;
  fetchCatalog: () => Promise<void>;
  fetchEngineImage: (engineType: string) => Promise<string | null>;
  installEngine: (engineType: string) => Promise<void>;
  uninstallEngine: (engineId: string) => Promise<void>;
  launchEngine: (engineId: string) => Promise<void>;
  detectEngines: () => Promise<void>;
  selectDefault: (id: string) => Promise<void>;
  launchMod: (modId: string, engineId: string) => Promise<void>;
  openFolder: (id: string) => Promise<void>;
  checkUpdates: (engineType?: string) => Promise<any>;
  updateEngine: (engineId: string) => Promise<void>;
  repairEngine: (engineId: string) => Promise<void>;
  verifyEngine: (engineId: string) => Promise<any>;
  createShortcut: (engineId: string) => Promise<void>;
  importExternalEngine: () => Promise<any>;
  initProgressListener: () => () => void;
}

export const useEngineStore = create<EngineState>((set, get) => ({
  engines: [],
  catalog: [],
  imageUrls: {},
  loading: true,
  enginesLoaded: false,
  catalogLoaded: false,
  error: null,
  installProgress: {},

  fetchEngines: async () => {
    try {
      const engines = await window.electronAPI.getEngines();
      set({ engines, enginesLoaded: true });
    } catch {
      set({ enginesLoaded: true });
    }
    const { catalogLoaded, enginesLoaded } = get();
    if (catalogLoaded && enginesLoaded) set({ loading: false });
  },

  fetchCatalog: async () => {
    try {
      const catalog = await window.electronAPI.getEngineCatalog();
      set({ catalog, catalogLoaded: true });
    } catch {
      set({ catalogLoaded: true });
    }
    const { catalogLoaded, enginesLoaded } = get();
    if (catalogLoaded && enginesLoaded) set({ loading: false });
  },

  fetchEngineImage: async (engineType: string) => {
    try {
      const url = await window.electronAPI.getEngineImage(engineType);
      set(state => ({ imageUrls: { ...state.imageUrls, [engineType]: url } }));
      return url;
    } catch {
      return null;
    }
  },

  installEngine: async (engineType: string) => {
    set({ loading: true, error: null });
    try {
      await window.electronAPI.installEngine(engineType);
      await get().fetchEngines();
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    } finally {
      set({ loading: false });
    }
  },

  uninstallEngine: async (engineId: string) => {
    try {
      await window.electronAPI.uninstallEngine(engineId);
      await get().fetchEngines();
    } catch { /* ignore */ }
  },

  launchEngine: async (engineId: string) => {
    await window.electronAPI.launchEngine(engineId);
  },

  detectEngines: async () => {
    try {
      await window.electronAPI.detectEngines();
      await get().fetchEngines();
    } catch { /* ignore */ }
  },

  selectDefault: async (id: string) => {
    await window.electronAPI.selectDefaultEngine(id);
  },

  launchMod: async (modId, engineId) => {
    await window.electronAPI.launchMod(modId, engineId);
  },

  openFolder: async (id: string) => {
    await window.electronAPI.openEngineFolder(id);
  },

  checkUpdates: async (engineType?: string) => {
    return window.electronAPI.checkEngineUpdates(engineType);
  },

  updateEngine: async (engineId: string) => {
    await window.electronAPI.updateEngine(engineId);
    await get().fetchEngines();
  },

  repairEngine: async (engineId: string) => {
    await window.electronAPI.repairEngine(engineId);
    await get().fetchEngines();
  },

  verifyEngine: async (engineId: string) => {
    return window.electronAPI.verifyEngine(engineId);
  },

  createShortcut: async (engineId: string) => {
    await window.electronAPI.createEngineShortcut(engineId);
  },

  importExternalEngine: async () => {
    const result = await window.electronAPI.importExternalEngine();
    if (result) {
      await get().fetchEngines();
    }
    return result;
  },

  initProgressListener: () => {
    const cb = (data: { engineType: string; percent: number; status: string }) => {
      set(state => ({
        installProgress: {
          ...state.installProgress,
          [data.engineType]: { percent: data.percent, status: data.status },
        },
      }));
      if (data.percent >= 100 || data.status === 'installed' || data.status === 'error') {
        setTimeout(() => {
          set(state => {
            const { [data.engineType]: _, ...rest } = state.installProgress;
            return { installProgress: rest };
          });
        }, 3000);
      }
    };
    window.electronAPI.onEngineInstallProgress(cb);
    return () => window.electronAPI.removeEngineInstallProgressListener(cb);
  },
}));
