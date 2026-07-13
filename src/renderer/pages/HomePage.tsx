import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Search, WifiOff, AlertCircle, RotateCcw,
  Compass, ChevronDown,
} from 'lucide-react';
import { DiscoverModCard } from '../components/DiscoverModCard';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { useTranslation } from '../hooks/useTranslation';

const CATEGORIES = [
  'All', 'Characters', 'Executables', 'Weeks', 'Songs', 'Stages', 'Skins', 'UI', 'Tools', 'Misc',
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

export function HomePage() {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [sortBy, setSortBy] = useState('trending');
  const [results, setResults] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const searchTimer = useRef<any>(null);
  const mountedRef = useRef(false);
  const currentFetch = useRef(0);

  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;

    const cached = loadFromCache();
    if (cached && cached.mods.length > 0) {
      setResults(cached.mods);
      setTotal(cached.total || 0);
      setHasMore(cached.hasMore || false);
      setPage(cached.page || 1);
      setLoading(false);
    }

    doFetch(1, false);
  }, []);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      doFetch(1, false);
    }, 350);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [query, category, sortBy]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || loading) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          doFetch(page + 1, true);
        }
      },
      { rootMargin: '400px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loading, page, results.length]);

  function loadFromCache(): { mods: any[]; total: number; hasMore: boolean; page: number } | null {
    try {
      const raw = localStorage.getItem(DISCOVER_CACHE_KEY);
      if (raw) {
        const cached = JSON.parse(raw);
        if (cached?.mods?.length > 0) return cached;
      }
    } catch {}
    return null;
  }

  function saveToCache(data: { mods: any[]; total: number; hasMore: boolean; page: number }) {
    try {
      localStorage.setItem(DISCOVER_CACHE_KEY, JSON.stringify(data));
    } catch {}
  }

  const doFetch = async (p: number, append: boolean) => {
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
        limit: 30,
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Request timed out')), REQUEST_TIMEOUT)
      );

      const result = await Promise.race([fetchPromise, timeoutPromise]);

      if (fetchId !== currentFetch.current) return;

      const mods = result.mods || [];
      setResults(prev => append ? [...prev, ...mods] : mods);
      setPage(p);
      setTotal(result.total || 0);
      setHasMore(p < (result.totalPages || 1));
      setLoading(false);

      if (p === 1 && !query.trim()) {
        saveToCache({
          mods,
          total: result.total || 0,
          hasMore: 1 < (result.totalPages || 1),
          page: 1,
        });
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
  };

  const handleRetry = () => {
    doFetch(1, false);
  };

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

            {!loading && hasMore && (
              <div ref={sentinelRef} className="flex justify-center py-4">
                <ChevronDown className="w-4 h-4 text-surface-500 animate-bounce" />
              </div>
            )}

            {!hasMore && results.length > 0 && (
              <p className="text-center text-surface-500 text-xs py-4">
                Showing all {results.length} mods
              </p>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
