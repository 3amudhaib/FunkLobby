import { create } from 'zustand';

interface ModState {
  mods: any[];
  featured: any[];
  trending: any[];
  popular: any[];
  recentlyPlayed: any[];
  installed: any[];
  library: any[];
  selectedMod: any | null;
  loading: boolean;

  // Browse (infinite scroll) state
  browseMods: any[];
  browsePage: number;
  browseTotal: number;
  browseLoading: boolean;
  browseHasMore: boolean;

  fetchFeatured: () => Promise<void>;
  fetchTrending: () => Promise<void>;
  fetchPopular: () => Promise<void>;
  fetchRecentlyPlayed: () => Promise<void>;
  fetchInstalled: () => Promise<void>;
  fetchLibrary: (params?: any) => Promise<void>;
  setSelectedMod: (mod: any | null) => void;
  searchMods: (params: any) => Promise<any>;
  browseAllMods: (params?: BrowseParams, append?: boolean) => Promise<void>;
  installMod: (modId: string, profileId: string) => Promise<void>;
  uninstallMod: (installId: string) => Promise<void>;
  toggleFavorite: (modId: string) => Promise<void>;
  deleteMod: (modId: string) => Promise<void>;
  enableMod: (modId: string) => Promise<void>;
  disableMod: (modId: string) => Promise<void>;
  moveMod: (modId: string, targetProfile: string) => Promise<void>;
  duplicateMod: (modId: string) => Promise<void>;
  backupMod: (modId: string) => Promise<string>;
  restoreMod: (modId: string, backupPath: string) => Promise<void>;
  renameMod: (modId: string, name: string) => Promise<void>;
  importMod: () => Promise<any>;
  exportMod: (modId: string) => Promise<void>;
}

interface BrowseParams {
  query?: string;
  category?: string;
  engine?: string;
  difficulty?: string;
  sortBy?: string;
  page?: number;
  limit?: number;
}

export const useModStore = create<ModState>((set, get) => ({
  mods: [],
  featured: [],
  trending: [],
  popular: [],
  recentlyPlayed: [],
  installed: [],
  library: [],
  selectedMod: null,
  loading: false,

  browseMods: [],
  browsePage: 1,
  browseTotal: 0,
  browseLoading: false,
  browseHasMore: true,

  fetchFeatured: async () => {
    try {
      const featured = await window.electronAPI.getFeatured();
      set({ featured });
    } catch (err) {
      console.error('Failed to fetch featured mods:', err);
    }
  },

  fetchTrending: async () => {
    try {
      const trending = await window.electronAPI.getTrending();
      set({ trending });
    } catch (err) {
      console.error('Failed to fetch trending mods:', err);
    }
  },

  fetchPopular: async () => {
    try {
      const popular = await window.electronAPI.getPopular();
      set({ popular });
    } catch (err) {
      console.error('Failed to fetch popular mods:', err);
    }
  },

  fetchRecentlyPlayed: async () => {
    try {
      const recentlyPlayed = await window.electronAPI.getRecentlyPlayed();
      set({ recentlyPlayed });
    } catch (err) {
      console.error('Failed to fetch recently played:', err);
    }
  },

  fetchInstalled: async () => {
    try {
      const installed = await window.electronAPI.getInstalled();
      set({ installed });
    } catch (err) {
      console.error('Failed to fetch installed mods:', err);
    }
  },

  fetchLibrary: async (params?: any) => {
    try {
      set({ loading: true });
      const library = await window.electronAPI.getLibrary(params || {});
      set({ library, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  setSelectedMod: (mod) => set({ selectedMod: mod }),

  searchMods: async (params) => {
    try {
      return await window.electronAPI.searchMods(params);
    } catch {
      return { mods: [], total: 0, page: 1, limit: 30, totalPages: 0 };
    }
  },

  browseAllMods: async (params: BrowseParams = {}, append = false) => {
    try {
      set({ browseLoading: true });
      const result = await window.electronAPI.searchMods({
        query: params.query || '',
        category: params.category === 'All' ? undefined : params.category,
        engine: params.engine || undefined,
        difficulty: params.difficulty === 'All' ? undefined : params.difficulty,
        sortBy: params.sortBy || 'popular',
        page: params.page || 1,
        limit: params.limit || 30,
      });
      const mods = result.mods || [];
      const total = result.total || 0;
      const pageSize = params.limit || 30;
      const hasMore = (params.page || 1) * pageSize < total;

      set({
        browseMods: append ? [...get().browseMods, ...mods] : mods,
        browsePage: params.page || 1,
        browseTotal: total,
        browseLoading: false,
        browseHasMore: hasMore,
      });
    } catch {
      set({ browseLoading: false, browseHasMore: false });
    }
  },

  syncFromGameBanana: async (query?: string) => {
    try {
      return await window.electronAPI.syncFromGameBanana(query);
    } catch {
      return 0;
    }
  },

  installMod: async (modId, profileId) => {
    const result = await window.electronAPI.installMod(modId, profileId);
    await Promise.all([
      get().fetchInstalled(),
      get().fetchLibrary(),
    ]);
    return result;
  },

  uninstallMod: async (installId) => {
    await window.electronAPI.uninstallMod(installId);
    await get().fetchInstalled();
  },

  toggleFavorite: async (modId) => {
    await window.electronAPI.favoriteMod(modId);
    await get().fetchLibrary();
  },

  deleteMod: async (modId) => {
    await window.electronAPI.deleteMod(modId);
    set((s) => ({
      mods: s.mods.filter((m) => m.id !== modId),
      library: s.library.filter((m) => m.id !== modId),
      installed: s.installed.filter((m) => m.id !== modId),
      browseMods: s.browseMods.filter((b) => b.id !== modId),
    }));
  },

  enableMod: async (modId) => {
    await window.electronAPI.enableMod(modId);
    await get().fetchInstalled();
  },

  disableMod: async (modId) => {
    await window.electronAPI.disableMod(modId);
    await get().fetchInstalled();
  },

  moveMod: async (modId: string, targetProfile: string) => {
    await window.electronAPI.moveMod(modId, targetProfile);
    await get().fetchInstalled();
  },

  duplicateMod: async (modId) => {
    await window.electronAPI.duplicateMod(modId);
    await get().fetchLibrary();
  },

  backupMod: async (modId) => {
    return await window.electronAPI.backupMod(modId);
  },

  restoreMod: async (modId, backupPath) => {
    await window.electronAPI.restoreMod(modId, backupPath);
  },

  renameMod: async (modId, name) => {
    await window.electronAPI.renameMod(modId, name);
    await get().fetchLibrary();
  },

  importMod: async () => {
    const result = await window.electronAPI.importMod();
    await get().fetchLibrary();
    return result;
  },

  exportMod: async (modId) => {
    await window.electronAPI.exportMod(modId);
  },
}));
