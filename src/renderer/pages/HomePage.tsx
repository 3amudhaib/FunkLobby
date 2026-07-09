import { useEffect, useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Star, Flame, Clock, Filter, Search } from 'lucide-react';
import { ModCard } from '../components/ModCard';
import { EmptyState } from '../components/EmptyState';
import { ModCardSkeleton } from '../components/Skeleton';
import { useModStore } from '../stores/modStore';
import { CATEGORIES, DIFFICULTIES, SORT_OPTIONS } from '../../shared/constants';
import { Compass } from 'lucide-react';

export function HomePage() {
  const {
    featured, trending, popular, recentlyPlayed,
    fetchFeatured, fetchTrending, fetchPopular, fetchRecentlyPlayed,
    browseMods, browseLoading, browseHasMore, browseTotal,
    browseAllMods, loading,
  } = useModStore();

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [difficulty, setDifficulty] = useState('All');
  const [sortBy, setSortBy] = useState('popular');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);

  const sentinelRef = useRef<HTMLDivElement>(null);

  // Load initial data
  useEffect(() => {
    fetchFeatured();
    fetchTrending();
    fetchPopular();
    fetchRecentlyPlayed();
  }, []);

  // Initial browse load
  useEffect(() => {
    setPage(1);
    browseAllMods({ query, category, difficulty, sortBy, page: 1 }, false);
  }, [query, category, difficulty, sortBy]);

  // Infinite scroll with IntersectionObserver
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && browseHasMore && !browseLoading) {
          const nextPage = page + 1;
          setPage(nextPage);
          browseAllMods({ query, category, difficulty, sortBy, page: nextPage }, true);
        }
      },
      { rootMargin: '400px' },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [browseHasMore, browseLoading, page, query, category, difficulty, sortBy]);

  const hasBrowsed = browseMods.length > 0 || !browseLoading;

  return (
    <div className="page-container pt-14">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Welcome to FunkLobby</h1>
          <p className="text-surface-400 mt-1">Discover, download, and manage Friday Night Funkin' mods</p>
        </div>

        {featured.length > 0 && (
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Star className="w-4 h-4 text-yellow-400" />
              <h2 className="text-lg font-semibold text-white">Featured Mods</h2>
            </div>
            <div className="mod-grid">
              {featured.slice(0, 6).map((mod, i) => (
                <ModCard key={mod.id} mod={mod} index={i} />
              ))}
            </div>
          </section>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {trending.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Flame className="w-4 h-4 text-orange-400" />
                <h2 className="text-lg font-semibold text-white">Trending</h2>
              </div>
              <div className="mod-grid grid-cols-2 sm:grid-cols-2">
                {trending.slice(0, 4).map((mod, i) => (
                  <ModCard key={mod.id} mod={mod} index={i} />
                ))}
              </div>
            </section>
          )}

          {popular.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <h2 className="text-lg font-semibold text-white">Most Popular</h2>
              </div>
              <div className="mod-grid grid-cols-2 sm:grid-cols-2">
                {popular.slice(0, 4).map((mod, i) => (
                  <ModCard key={mod.id} mod={mod} index={i} />
                ))}
              </div>
            </section>
          )}
        </div>

        {recentlyPlayed.length > 0 && (
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-4 h-4 text-blue-400" />
              <h2 className="text-lg font-semibold text-white">Recently Played</h2>
            </div>
            <div className="mod-grid">
              {recentlyPlayed.slice(0, 6).map((mod, i) => (
                <ModCard key={mod.id} mod={mod} index={i} />
              ))}
            </div>
          </section>
        )}

        {/* Search & Filters — rendered unconditionally so the layout is stable */}
        <section className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Browse All Mods</h2>
          </div>
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-surface-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                className="input text-sm pl-10"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search mods..."
              />
            </div>
            <button
              className={`btn-ghost text-sm flex items-center gap-2 ${showFilters ? 'text-primary-400' : ''}`}
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="w-4 h-4" />
              Filters
            </button>
          </div>

          <motion.div
            initial={false}
            animate={{ height: showFilters ? 'auto' : 0, opacity: showFilters ? 1 : 0 }}
            className="overflow-hidden"
          >
            <div className="glass rounded-xl p-4 border border-white/[0.06] mb-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-surface-400 mb-1.5 block">Category</label>
                  <select
                    className="input text-sm"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-surface-400 mb-1.5 block">Difficulty</label>
                  <select
                    className="input text-sm"
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value)}
                  >
                    {DIFFICULTIES.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-surface-400 mb-1.5 block">Sort By</label>
                  <select
                    className="input text-sm"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                  >
                    {SORT_OPTIONS.map((s) => (
                      <option key={s.id} value={s.id}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </motion.div>

          {query && browseMods.length > 0 && (
            <p className="text-xs text-surface-500 mb-3">
              {browseTotal} result{String(browseTotal) !== '1' && 's'} for &ldquo;{query}&rdquo;
            </p>
          )}

          {browseMods.length > 0 ? (
            <div className="mod-grid">
              {browseMods.map((mod, i) => (
                <ModCard key={mod.id} mod={mod} index={i} />
              ))}
            </div>
          ) : !browseLoading && hasBrowsed ? (
            <EmptyState
              icon={Compass}
              title="No mods found"
              description={query ? `No results for "${query}". Try a different search term.` : 'No mods available yet.'}
            />
          ) : null}

          {browseLoading && (
            <div className="mod-grid mt-6">
              {[...Array(6)].map((_, i) => (
                <ModCardSkeleton key={`skeleton-${i}`} index={i} />
              ))}
            </div>
          )}

          {!browseLoading && browseHasMore && (
            <div ref={sentinelRef} className="h-4" />
          )}

          {!browseLoading && !browseHasMore && browseMods.length > 0 && (
            <p className="text-xs text-surface-500 text-center mt-6">All mods loaded</p>
          )}
        </section>
      </motion.div>
    </div>
  );
}