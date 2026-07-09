import { Filter, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchStore } from '../stores/searchStore';

const CATEGORIES = ['All', 'Character', 'Song', 'Engine', 'Script', 'UI', 'Audio', 'Mod', 'WIP', 'Other'];
const SORT_OPTIONS = [
  { id: 'trending', label: 'Trending' },
  { id: 'popular', label: 'Most Downloaded' },
  { id: 'updated', label: 'Recently Updated' },
  { id: 'newest', label: 'Newest' },
  { id: 'name', label: 'Alphabetical' },
];
const ENGINES = [
  { id: '', label: 'All Engines' },
  { id: 'psych', label: 'Psych Engine' },
  { id: 'kade', label: 'Kade Engine' },
  { id: 'codename', label: 'Codename Engine' },
  { id: 'forever', label: 'Forever Engine' },
  { id: 'leather', label: 'Leather Engine' },
  { id: 'vslice', label: 'V-Slice' },
  { id: 'js-engine', label: 'JS Engine' },
  { id: 'fnf-love', label: 'FNF Love' },
  { id: 'fps-plus', label: 'FPS Plus' },
];

interface SearchFiltersProps {
  open: boolean;
  onToggle: () => void;
}

export function SearchFilters({ open, onToggle }: SearchFiltersProps) {
  const { filters, setFilter } = useSearchStore();

  const activeCount = [filters.category !== 'All' ? filters.category : null, filters.engine ? filters.engine : null]
    .filter(Boolean).length;

  return (
    <div>
      <button
        className={`btn-ghost text-sm flex items-center gap-2 relative ${open ? 'text-primary-400' : ''}`}
        onClick={onToggle}
      >
        <Filter className="w-4 h-4" /> Filters
        {activeCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary-500 text-[10px] flex items-center justify-center text-white font-medium">
            {activeCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="glass rounded-xl p-4 border border-white/[0.06] mt-2">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-surface-400 mb-1.5 block">Category</label>
                  <select
                    className="input text-sm w-full"
                    value={filters.category}
                    onChange={(e) => setFilter('category', e.target.value)}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-surface-400 mb-1.5 block">Engine</label>
                  <select
                    className="input text-sm w-full"
                    value={filters.engine}
                    onChange={(e) => setFilter('engine', e.target.value)}
                  >
                    {ENGINES.map((e) => (
                      <option key={e.id} value={e.id}>{e.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-surface-400 mb-1.5 block">Sort By</label>
                  <select
                    className="input text-sm w-full"
                    value={filters.sortBy}
                    onChange={(e) => setFilter('sortBy', e.target.value)}
                  >
                    {SORT_OPTIONS.map((s) => (
                      <option key={s.id} value={s.id}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {activeCount > 0 && (
                <button
                  className="btn-ghost text-xs mt-3 text-surface-400 hover:text-white flex items-center gap-1"
                  onClick={() => {
                    setFilter('category', 'All');
                    setFilter('engine', '');
                    setFilter('sortBy', 'trending');
                  }}
                >
                  <X className="w-3 h-3" /> Clear filters
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
