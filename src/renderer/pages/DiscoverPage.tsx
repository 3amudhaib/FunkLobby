import { useEffect, useCallback, useState, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { Compass, AlertCircle, WifiOff, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react';
import { SearchBar } from '../components/SearchBar';
import { SearchFilters } from '../components/SearchFilters';
import { SearchResultCard } from '../components/SearchResultCard';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { useSearchStore } from '../stores/searchStore';
import { useModStore } from '../stores/modStore';
import { useTranslation } from '../hooks/useTranslation';

const MAX_VISIBLE_PAGES = 7;

export function DiscoverPage() {
  const { t } = useTranslation();
  const {
    query, results, total, page, totalPages, loading, error, offline,
    filters, focusedIndex,
    setQuery, search, goToPage, clearResults, setFocusedIndex,
  } = useSearchStore();

  const [showFilters, setShowFilters] = useState(false);
  const searchInitiated = useRef(false);

  const doSearch = useCallback(() => {
    searchInitiated.current = true;
    search();
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(doSearch, 400);
    return () => clearTimeout(timer);
  }, [query, filters]);

  useEffect(() => {
    clearResults();
  }, []);

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

  const showWelcome = !searchInitiated.current || (!query && results.length === 0 && !loading && !error);

  return (
    <div className="page-container pt-14">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">{t('discover.title')}</h1>
            <p className="text-surface-400 text-sm mt-1">
              {searchInitiated.current ? t('discover.searching') : t('discover.subtitle')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <SearchBar
            value={query}
            onChange={setQuery}
            onKeyNav={handleKeyNav}
                placeholder={t('search.placeholder')}
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
              <RotateCcw className="w-3 h-3" /> {t('discover.retry')}
            </button>
          </div>
        )}

        {offline && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm mb-4">
            <WifiOff className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1">{t('discover.offline')}</span>
            <button className="btn-ghost text-xs text-amber-400 hover:text-amber-300" onClick={doSearch}>
              <RotateCcw className="w-3 h-3" /> {t('discover.retry')}
            </button>
          </div>
        )}

        {showWelcome ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500/20 to-surface-800 flex items-center justify-center mb-4">
              <Compass className="w-8 h-8 text-primary-400" />
            </div>
            <h2 className="text-lg font-medium text-white mb-2">{t('discover.welcome')}</h2>
            <p className="text-surface-400 text-sm max-w-md">
              {t('discover.subtitle')}
            </p>
          </div>
        ) : loading && results.length === 0 ? (
          <LoadingSpinner className="mt-12" />
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Compass className="w-12 h-12 text-surface-600 mb-3" />
            <h2 className="text-lg font-medium text-white mb-1">{t('discover.noResults')}{query ? t('discover.noResultsFor', { query }) : ''}</h2>
            <p className="text-surface-400 text-sm max-w-md">
              {t('discover.adjustFilters')}
            </p>
            {query && (
              <button className="btn-secondary text-sm mt-4" onClick={() => setQuery('')}>
                {t('discover.reset')}
              </button>
            )}
          </div>
        ) : (
          <div>
            {total > 0 && (
              <p className="text-xs text-surface-500 mb-3">
                {total.toLocaleString()} mods found
              </p>
            )}
            <div className="space-y-2">
              {results.map((mod, i) => (
                <SearchResultCard
                  key={mod.id}
                  mod={mod}
                  index={i}
                  focused={focusedIndex === i}
                />
              ))}
            </div>

            {loading && (
              <div className="flex items-center justify-center py-6">
                <LoadingSpinner />
              </div>
            )}

            {totalPages > 1 && !loading && (
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                visiblePages={visiblePages}
                onPageChange={goToPage}
              />
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}

function Pagination({ currentPage, totalPages, visiblePages, onPageChange }: {
  currentPage: number;
  totalPages: number;
  visiblePages: (number | 'ellipsis')[];
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-1.5 mt-6 pb-4">
      <button
        className={`pagination-btn ${currentPage <= 1 ? 'opacity-30 cursor-not-allowed' : ''}`}
        disabled={currentPage <= 1}
        onClick={() => onPageChange(currentPage - 1)}
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      {visiblePages.map((p, i) =>
        p === 'ellipsis' ? (
          <span key={`ellipsis-${i}`} className="px-1 text-surface-500 text-sm">...</span>
        ) : (
          <button
            key={p}
            className={`pagination-btn min-w-[32px] ${
              p === currentPage
                ? 'bg-primary-500/20 text-primary-300 border-primary-500/30'
                : 'text-surface-400 border-surface-700/30 hover:border-surface-600/50'
            }`}
            onClick={() => onPageChange(p)}
          >
            {p}
          </button>
        )
      )}
      <button
        className={`pagination-btn ${currentPage >= totalPages ? 'opacity-30 cursor-not-allowed' : ''}`}
        disabled={currentPage >= totalPages}
        onClick={() => onPageChange(currentPage + 1)}
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
