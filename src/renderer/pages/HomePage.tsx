import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Search, WifiOff, AlertCircle, RotateCcw,
  Compass, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { DiscoverModCard } from '../components/DiscoverModCard';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { useTranslation } from '../hooks/useTranslation';

const CATEGORIES = [
  'All', 'Mod', 'Character', 'Song', 'Audio', 'Misc', 'WIP',
];

const SORT_OPTIONS = [
  { id: 'trending', label: 'Trending' },
  { id: 'newest', label: 'Newest' },
  { id: 'updated', label: 'Recently Updated' },
  { id: 'downloads', label: 'Most Downloaded' },
  { id: 'name', label: 'Alphabetical' },
];

const DISCOVER_CACHE_KEY = 'funklobby_discover_cache';
const REQUEST_TIMEOUT = 30000;
const PAGE_SIZE = 48;
const MAX_VISIBLE_PAGES = 7;

export function HomePage() {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [sortBy, setSortBy] = useState('trending');
  const [results, setResults] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [pageCache, setPageCache] = useState<Record<number, any[]>>({});
  const searchTimer = useRef<any>(null);
  const mountedRef = useRef(false);
  const currentFetch = useRef(0);

  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;
    doFetch(1, false);
  }, []);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    setPageCache({});
    searchTimer.current = setTimeout(() => {
      doFetch(1, false);
    }, 350);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [query, category, sortBy]);

  const doFetch = useCallback(async (p: number, fromCache = false) => {
    if (!fromCache) {
      const cachedPage = pageCache[p];
      if (cachedPage) {
        setResults(cachedPage);
        setPage(p);
        return;
      }
    }

    const fetchId = ++currentFetch.current;
    setLoading(true);
    setError(null);
    setOffline(false);

    try {
      const fetchPromise = window.electronAPI.discoverSearch({
        query: query.trim() || undefined,
        category: category === 'All' ? undefined : category,
        sortBy,
        page: p,
        limit: PAGE_SIZE,
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Request timed out')), REQUEST_TIMEOUT)
      );

      const result = await Promise.race([fetchPromise, timeoutPromise]);
      if (fetchId !== currentFetch.current) return;

      const mods = result.mods || [];
      setResults(mods);
      setPage(p);
      setTotal(result.total || 0);
      setTotalPages(result.totalPages || Math.ceil((result.total || 0) / PAGE_SIZE) || 1);
      setLoading(false);

      setPageCache(prev => ({ ...prev, [p]: mods }));

      if (p === 1 && !query.trim()) {
        try {
          localStorage.setItem(DISCOVER_CACHE_KEY, JSON.stringify({ mods, total: result.total || 0, page: 1 }));
        } catch {}
      }
    } catch (err: any) {
      if (fetchId !== currentFetch.current) return;
      setLoading(false);
      if (!navigator.onLine) {
        setOffline(true);
        setError('You are offline. Showing cached content.');
      } else {
        setError(err.message || 'Unable to load GameBanana mods.');
      }
    }
  }, [query, category, sortBy, pageCache]);

  const goToPage = useCallback((p: number) => {
    if (p < 1 || p > totalPages || loading) return;
    doFetch(p, false);
  }, [totalPages, loading, doFetch]);

  const handleRetry = () => doFetch(1, false);

  const visiblePages = useMemo(() => {
    const pages: (number | 'ellipsis')[] = [];
    const total = totalPages;
    const current = page;
    if (total <= MAX_VISIBLE_PAGES) {
      for (let i = 1; i <= total; i++) pages.push(i);
    } else {
      pages.push(1);
      let start = Math.max(2, current - 2);
      let end = Math.min(total - 1, current + 2);
      if (current <= 3) { start = 2; end = Math.min(5, total - 1); }
      if (current >= total - 2) { start = Math.max(total - 4, 2); end = total - 1; }
      if (start > 2) pages.push('ellipsis');
      for (let i = start; i <= end; i++) pages.push(i);
      if (end < total - 1) pages.push('ellipsis');
      pages.push(total);
    }
    return pages;
  }, [page, totalPages]);

  const hasResults = results.length > 0;
  const showLoadingSpinner = !hasResults && loading;
  const showError = !hasResults && !loading && error;
  const showEmpty = !hasResults && !loading && !error;

  return (
    <div className="page-container pt-14">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">{t('home.title') || 'Discover'}</h1>
          <p className="text-surface-400 mt-1">Browse Friday Night Funkin' mods from GameBanana</p>
        </div>

        {offline && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm mb-4">
            <WifiOff className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1">{error}</span>
            <button className="btn-ghost text-xs text-amber-400 hover:text-amber-300" onClick={handleRetry}>
              <RotateCcw className="w-3 h-3" /> Retry
            </button>
          </div>
        )}

        {error && !offline && !loading && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-4">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1">{error}</span>
            <button className="btn-ghost text-xs text-red-400 hover:text-red-300" onClick={handleRetry}>
              <RotateCcw className="w-3 h-3" /> Retry
            </button>
          </div>
        )}

        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-xl">
            <Search className="w-4 h-4 text-surface-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              className="input text-sm pl-10 w-full"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search thousands of mods from GameBanana..."
            />
          </div>
          <select
            className="input text-sm w-36"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            {SORT_OPTIONS.map(s => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5 mb-6 overflow-x-auto pb-1 scrollbar-none">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-3 py-1.5 text-xs rounded-lg whitespace-nowrap transition-colors ${
                category === cat
                  ? 'bg-primary-500/20 text-primary-300 border border-primary-500/30'
                  : 'bg-surface-800/50 text-surface-400 border border-surface-700/30 hover:text-surface-200 hover:border-surface-600/50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {showLoadingSpinner && (
          <div className="flex justify-center py-20">
            <LoadingSpinner />
          </div>
        )}

        {showError && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500/20 to-surface-800 flex items-center justify-center mb-4">
              <AlertCircle className="w-8 h-8 text-red-400" />
            </div>
            <h2 className="text-lg font-medium text-white mb-2">Unable to load GameBanana mods</h2>
            <p className="text-surface-400 text-sm max-w-md mb-4">
              The request timed out or the server is unreachable. Please check your connection and try again.
            </p>
            <button className="btn-primary text-sm flex items-center gap-2" onClick={handleRetry}>
              <RotateCcw className="w-4 h-4" /> Retry
            </button>
          </div>
        )}

        {showEmpty && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Compass className="w-12 h-12 text-surface-600 mb-3" />
            <h2 className="text-lg font-medium text-white mb-1">
              {query ? `No mods found for "${query}"` : 'No mods found'}
            </h2>
            <p className="text-surface-400 text-sm max-w-md">
              {query
                ? 'Try a different search term or adjust the category filter.'
                : 'Try adjusting the category or sort filter.'}
            </p>
          </div>
        )}

        {hasResults && (
          <div>
            {total > 0 && (
              <p className="text-xs text-surface-500 mb-3">{total.toLocaleString()} mods found</p>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
              {results.map((mod: any, i: number) => (
                <DiscoverModCard key={mod.id} mod={mod} index={i} />
              ))}
            </div>

            {loading && (
              <div className="flex justify-center py-6"><LoadingSpinner /></div>
            )}

            {totalPages > 1 && !loading && (
              <div className="flex items-center justify-center gap-1.5 mt-6 pb-4">
                <button
                  className="pagination-btn"
                  disabled={page <= 1}
                  onClick={() => goToPage(page - 1)}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {visiblePages.map((p, i) =>
                  p === 'ellipsis' ? (
                    <span key={`e-${i}`} className="px-1 text-surface-500 text-sm">...</span>
                  ) : (
                    <button
                      key={p}
                      className={`pagination-btn min-w-[32px] ${
                        p === page
                          ? 'bg-primary-500/20 text-primary-300 border-primary-500/30'
                          : 'text-surface-400 border-surface-700/30 hover:border-surface-600/50'
                      }`}
                      onClick={() => goToPage(p)}
                    >
                      {p}
                    </button>
                  )
                )}
                <button
                  className="pagination-btn"
                  disabled={page >= totalPages}
                  onClick={() => goToPage(page + 1)}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
