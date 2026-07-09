import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface SearchFilters {
  category: string;
  engine: string;
  sortBy: string;
}

interface SearchResultMod {
  id: string;
  gameBananaId: number;
  title: string;
  author: string;
  version: string;
  description: string;
  engine: string;
  category: string;
  thumbnailUrl: string;
  bannerUrl: string;
  sourceUrl: string;
  sourceType: string;
  downloadCount: number;
  viewCount: number;
  likeCount: number;
  fileSize: number;
  updatedAt: string;
  isInstalled: boolean;
}

interface SearchHistoryItem {
  query: string;
  timestamp: number;
}

interface SearchState {
  query: string;
  results: SearchResultMod[];
  total: number;
  page: number;
  hasMore: boolean;
  loading: boolean;
  error: string | null;
  offline: boolean;

  filters: SearchFilters;

  focusedIndex: number;
  searchHistory: SearchHistoryItem[];

  setQuery: (q: string) => void;
  setFilter: (key: keyof SearchFilters, value: string) => void;
  search: (append?: boolean) => Promise<void>;
  loadMore: () => Promise<void>;
  clearResults: () => void;
  setFocusedIndex: (idx: number) => void;
  installMod: (mod: SearchResultMod, profileId: string) => Promise<void>;
}

let abortController: AbortController | null = null;

export const useSearchStore = create<SearchState>()(
  devtools(
    (set, get) => ({
      query: '',
      results: [],
      total: 0,
      page: 1,
      hasMore: false,
      loading: false,
      error: null,
      offline: false,

      filters: {
        category: 'All',
        engine: '',
        sortBy: 'trending',
      },

      focusedIndex: -1,
      searchHistory: [],

      setQuery: (q: string) => {
        set({ query: q, focusedIndex: -1 });
      },

      setFilter: (key: string, value: string) => {
        set((s) => ({
          filters: { ...s.filters, [key]: value },
        }));
      },

      search: async (append = false) => {
        const { query, filters, results, searchHistory } = get();

        if (abortController) {
          abortController.abort();
        }
        abortController = new AbortController();

        const page = append ? get().page + 1 : 1;
        set({ loading: true, error: null, offline: false, page });

        try {
          if (!append) {
            if (query.trim() && !searchHistory.some(h => h.query === query)) {
              set({
                searchHistory: [{ query, timestamp: Date.now() }, ...searchHistory].slice(0, 50),
              });
            }
          }

          const result = await window.electronAPI.searchMods({
            query: query.trim(),
            category: filters.category === 'All' ? undefined : filters.category,
            engine: filters.engine || undefined,
            sortBy: filters.sortBy,
            page,
            limit: 30,
          });

          const mods: SearchResultMod[] = (result.mods || []).map((m: any) => ({
            id: m.id,
            gameBananaId: m.gameBananaId,
            title: m.title,
            author: m.author,
            version: m.version || '1.0.0',
            description: m.description || '',
            engine: m.engine || 'psych',
            category: m.category || 'Other',
            thumbnailUrl: m.thumbnailUrl || '',
            bannerUrl: m.bannerUrl || '',
            sourceUrl: m.sourceUrl || '',
            sourceType: m.sourceType || 'gamebanana',
            downloadCount: m.downloadCount || 0,
            viewCount: m.viewCount || 0,
            likeCount: m.likeCount || 0,
            fileSize: m.fileSize || 0,
            updatedAt: m.updatedAt || '',
            isInstalled: m.isInstalled || false,
          }));

          const total = result.total || 0;
          const totalPages = result.totalPages || 1;

          set({
            results: append ? [...results, ...mods] : mods,
            total,
            hasMore: page < totalPages,
            loading: false,
            offline: result.offline === true,
          });
        } catch (err: any) {
          if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
          set({ loading: false, error: err.message || 'Search failed' });
        }
      },

      loadMore: async () => {
        const { loading, hasMore } = get();
        if (loading || !hasMore) return;
        await get().search(true);
      },

      clearResults: () => {
        set({ results: [], total: 0, hasMore: false, loading: false, error: null, page: 1 });
      },

      setFocusedIndex: (idx: number) => set({ focusedIndex: idx }),

      installMod: async (mod: SearchResultMod, profileId: string) => {
        try {
          const downloadUrl = await window.electronAPI.getDownloadUrl(mod.gameBananaId);
          if (!downloadUrl) throw new Error('No download URL available');

          await window.electronAPI.startDownload({
            modId: mod.id,
            url: downloadUrl,
            fileName: `${mod.title.replace(/[<>:"/\\|?*]/g, '_')}.zip`,
          });

          await window.electronAPI.installMod(mod.id, profileId);
          set((s) => ({
            results: s.results.map((r) =>
              r.id === mod.id ? { ...r, isInstalled: true } : r
            ),
          }));
        } catch (err: any) {
          throw new Error(err.message || 'Installation failed');
        }
      },
    }),
    { name: 'search-store' }
  )
);
