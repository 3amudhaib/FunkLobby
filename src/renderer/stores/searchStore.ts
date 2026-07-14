import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

const PAGE_SIZE = 48;

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
  totalPages: number;
  loading: boolean;
  error: string | null;
  offline: boolean;

  filters: SearchFilters;

  focusedIndex: number;
  searchHistory: SearchHistoryItem[];

  pageCache: Record<number, SearchResultMod[]>;

  setQuery: (q: string) => void;
  setFilter: (key: keyof SearchFilters, value: string) => void;
  search: () => Promise<void>;
  goToPage: (page: number) => Promise<void>;
  clearResults: () => void;
  setFocusedIndex: (idx: number) => void;
  installMod: (mod: SearchResultMod, profileId: string) => Promise<void>;
}

let abortController: AbortController | null = null;

function prefetchPages(currentPage: number, totalPages: number) {
  const pagesToPrefetch = [currentPage - 1, currentPage + 1, currentPage - 2, currentPage + 2]
    .filter(p => p >= 1 && p <= totalPages && p !== currentPage);
  for (const page of pagesToPrefetch) {
    const state = useSearchStore.getState();
    if (!state.pageCache[page] && !state.loading) {
      window.electronAPI.searchMods({
        query: state.query.trim(),
        category: state.filters.category === 'All' ? undefined : state.filters.category,
        engine: state.filters.engine || undefined,
        sortBy: state.filters.sortBy,
        page,
        limit: PAGE_SIZE,
      }).then((result) => {
        const mods = (result.mods || []).map((m: any) => ({
          id: m.id, gameBananaId: m.gameBananaId, title: m.title,
          author: m.author, version: m.version || '1.0.0',
          description: m.description || '', engine: m.engine || 'standalone',
          category: m.category || 'Other', thumbnailUrl: m.thumbnailUrl || '',
          bannerUrl: m.bannerUrl || '', sourceUrl: m.sourceUrl || '',
          sourceType: m.sourceType || 'gamebanana',
          downloadCount: m.downloadCount || 0, viewCount: m.viewCount || 0,
          likeCount: m.likeCount || 0, fileSize: m.fileSize || 0,
          updatedAt: m.updatedAt || '', isInstalled: m.isInstalled || false,
        }));
        useSearchStore.setState((s) => ({
          pageCache: { ...s.pageCache, [page]: mods },
        }));
      }).catch(() => {});
    }
  }
}

export const useSearchStore = create<SearchState>()(
  devtools(
    (set, get) => ({
      query: '',
      results: [],
      total: 0,
      page: 1,
      totalPages: 0,
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
      pageCache: {},

      setQuery: (q: string) => {
        set({ query: q, focusedIndex: -1 });
      },

      setFilter: (key: string, value: string) => {
        set((s) => ({
          filters: { ...s.filters, [key]: value },
        }));
      },

      search: async () => {
        const { query, filters, searchHistory, pageCache } = get();
        const page = 1;

        if (abortController) {
          abortController.abort();
        }
        abortController = new AbortController();

        set({ loading: true, error: null, offline: false, page, results: [], pageCache: {} });

        try {
          if (query.trim() && !searchHistory.some(h => h.query === query)) {
            set({
              searchHistory: [{ query, timestamp: Date.now() }, ...searchHistory].slice(0, 50),
            });
          }

          const result = await window.electronAPI.searchMods({
            query: query.trim(),
            category: filters.category === 'All' ? undefined : filters.category,
            engine: filters.engine || undefined,
            sortBy: filters.sortBy,
            page,
            limit: PAGE_SIZE,
          });

          const mods: SearchResultMod[] = (result.mods || []).map((m: any) => ({
            id: m.id,
            gameBananaId: m.gameBananaId,
            title: m.title,
            author: m.author,
            version: m.version || '1.0.0',
            description: m.description || '',
            engine: m.engine || 'standalone',
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
          const totalPages = result.totalPages || Math.ceil(total / PAGE_SIZE) || 1;

          set({
            results: mods,
            total,
            totalPages,
            pageCache: { ...pageCache, [page]: mods },
            loading: false,
            offline: result.offline === true,
          });
        } catch (err: any) {
          if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
          set({ loading: false, error: err.message || 'Search failed' });
        }
      },

      goToPage: async (page: number) => {
        const { pageCache, query, filters, totalPages } = get();
        if (page < 1 || page > totalPages) return;
        if (pageCache[page]) {
          set({ results: pageCache[page], page, loading: false });
          prefetchPages(page, totalPages);
          return;
        }
        set({ loading: true, page });

        try {
          const result = await window.electronAPI.searchMods({
            query: query.trim(),
            category: filters.category === 'All' ? undefined : filters.category,
            engine: filters.engine || undefined,
            sortBy: filters.sortBy,
            page,
            limit: PAGE_SIZE,
          });

          const mods: SearchResultMod[] = (result.mods || []).map((m: any) => ({
            id: m.id,
            gameBananaId: m.gameBananaId,
            title: m.title,
            author: m.author,
            version: m.version || '1.0.0',
            description: m.description || '',
            engine: m.engine || 'standalone',
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

          set({
            results: mods,
            pageCache: { ...pageCache, [page]: mods },
            loading: false,
          });

          prefetchPages(page, totalPages);
        } catch (err: any) {
          if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
          set({ loading: false, error: err.message || 'Search failed' });
        }
      },

      clearResults: () => {
        set({ results: [], total: 0, page: 1, totalPages: 0, loading: false, error: null, pageCache: {} });
      },

      setFocusedIndex: (idx: number) => set({ focusedIndex: idx }),

      installMod: async (mod: SearchResultMod, profileId: string) => {
        try {
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
