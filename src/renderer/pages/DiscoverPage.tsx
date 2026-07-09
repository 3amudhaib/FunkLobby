import { useEffect, useRef, useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { Compass, ChevronDown, AlertCircle, WifiOff, RotateCcw } from 'lucide-react';
import { SearchBar } from '../components/SearchBar';
import { SearchFilters } from '../components/SearchFilters';
import { SearchResultCard } from '../components/SearchResultCard';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { useSearchStore } from '../stores/searchStore';
import { useModStore } from '../stores/modStore';

export function DiscoverPage() {
  const {
    query, results, total, hasMore, loading, error, offline,
    filters, focusedIndex,
    setQuery, search, loadMore, clearResults, setFocusedIndex,
  } = useSearchStore();

  const [showFilters, setShowFilters] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const searchInitiated = useRef(false);

  const doSearch = useCallback(() => {
    searchInitiated.current = true;
    search(false);
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(doSearch, 400);
    return () => clearTimeout(timer);
  }, [query, filters]);

  useEffect(() => {
    if (!sentinelRef.current || !hasMore || loading) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          loadMore();
        }
      },
      { rootMargin: '400px' }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loading, results.length]);

  const handleKeyNav = useCallback((direction: 'up' | 'down' | 'enter' | 'escape') => {
    if (direction === 'escape') {
      setFocusedIndex(-1);
      return;
    }
    if (direction === 'down') {
      setFocusedIndex(Math.min(focusedIndex + 1, results.length - 1));
    } else if (direction === 'up') {
      setFocusedIndex(Math.max(focusedIndex - 1, -1));
    } else if (direction === 'enter') {
      if (focusedIndex >= 0 && focusedIndex < results.length) {
        const mod = results[focusedIndex];
        if (!mod.isInstalled) {
          handleInstallMod(mod);
        }
      }
    }
  }, [focusedIndex, results]);

  const handleInstallMod = async (mod: any) => {
    try {
      const profiles = await window.electronAPI.getProfiles();
      const defaultProfile = profiles.find((p: any) => p.isDefault) || profiles[0];
      if (!defaultProfile) return;
      useModStore.getState().installMod(mod.id, defaultProfile.id);
    } catch { /* ignore */ }
  };

  const showWelcome = !searchInitiated.current || (!query && results.length === 0 && !loading);

  return (
    <div className="page-container pt-14">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Discover Mods</h1>
            <p className="text-surface-400 text-sm mt-1">
              {searchInitiated.current
                ? `${total} mods found`
                : 'Find and download new mods from GameBanana'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <SearchBar
            value={query}
            onChange={setQuery}
            onKeyNav={handleKeyNav}
            placeholder="Search Friday Night Funkin' mods..."
            className="flex-1 max-w-xl"
            loading={loading}
            autoFocus
          />
          <SearchFilters open={showFilters} onToggle={() => setShowFilters(!showFilters)} />
        </div>

        {error && !offline && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-4">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1">{error}</span>
            <button className="btn-ghost text-xs text-red-400 hover:text-red-300" onClick={doSearch}>
              <RotateCcw className="w-3 h-3" /> Retry
            </button>
          </div>
        )}

        {offline && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm mb-4">
            <WifiOff className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1">Connection lost. Showing cached results.</span>
            <button className="btn-ghost text-xs text-amber-400 hover:text-amber-300" onClick={doSearch}>
              <RotateCcw className="w-3 h-3" /> Retry
            </button>
          </div>
        )}

        {showWelcome ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500/20 to-surface-800 flex items-center justify-center mb-4">
              <Compass className="w-8 h-8 text-primary-400" />
            </div>
            <h2 className="text-lg font-medium text-white mb-2">Search FNF Mods</h2>
            <p className="text-surface-400 text-sm max-w-md">
              Type in the search bar above to find Friday Night Funkin' mods from GameBanana.
              Supports partial matches, full names, and more.
            </p>
          </div>
        ) : loading && results.length === 0 ? (
          <LoadingSpinner className="mt-12" />
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Compass className="w-12 h-12 text-surface-600 mb-3" />
            <h2 className="text-lg font-medium text-white mb-1">No results found</h2>
            <p className="text-surface-400 text-sm max-w-md">
              {query
                ? `No mods match "${query}". Try a different search term or check your spelling.`
                : 'No mods available yet.'}
            </p>
            {query && (
              <button className="btn-secondary text-sm mt-4" onClick={() => setQuery('')}>
                Clear search
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {results.map((mod, i) => (
              <SearchResultCard
                key={mod.id}
                mod={mod}
                index={i}
                focused={focusedIndex === i}
              />
            ))}

            {loading && (
              <div className="flex items-center justify-center py-6">
                <LoadingSpinner />
              </div>
            )}

            {!loading && hasMore && (
              <div ref={sentinelRef} className="flex items-center justify-center py-4">
                <div className="flex items-center gap-2 text-surface-500 text-sm">
                  <ChevronDown className="w-4 h-4" />
                  Scroll for more
                </div>
              </div>
            )}

            {!hasMore && results.length > 0 && (
              <p className="text-center text-surface-500 text-xs py-4">
                {results.length >= 30 ? `Showing ${results.length} of ${total} results` : `${results.length} results`}
              </p>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
