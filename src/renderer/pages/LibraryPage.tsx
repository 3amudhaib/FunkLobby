import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Library, Grid3X3, List, Upload } from 'lucide-react';
import { ModCard } from '../components/ModCard';
import { SearchBar } from '../components/SearchBar';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import { ImportLocalModModal } from '../components/ImportLocalModModal';
import { useModStore } from '../stores/modStore';
import { CATEGORIES, SORT_OPTIONS } from '../../shared/constants';

export function LibraryPage() {
  const { library, fetchLibrary, loading } = useModStore();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [sortBy, setSortBy] = useState('name');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showImportModal, setShowImportModal] = useState(false);

  useEffect(() => {
    fetchLibrary({ query, category: category === 'All' ? undefined : category, sortBy });
  }, [query, category, sortBy]);

  return (
    <div className="page-container pt-14">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Library</h1>
            <p className="text-surface-400 text-sm mt-1">{library.length} mods total</p>
          </div>
          <button className="btn-secondary text-sm" onClick={() => setShowImportModal(true)}>
            <Upload className="w-4 h-4" />
            Import Local Mod
          </button>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <SearchBar
            value={query}
            onChange={setQuery}
            placeholder="Search library..."
            className="flex-1 max-w-md"
          />
          <select
            className="input text-sm w-32"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {CATEGORIES.slice(0, 6).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select
            className="input text-sm w-36"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            {SORT_OPTIONS.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
          <div className="flex items-center gap-1 bg-surface-900 rounded-lg border border-surface-700/50 p-1">
            <button
              className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-primary-500/20 text-primary-300' : 'text-surface-400 hover:text-white'}`}
              onClick={() => setViewMode('grid')}
            >
              <Grid3X3 className="w-3.5 h-3.5" />
            </button>
            <button
              className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-primary-500/20 text-primary-300' : 'text-surface-400 hover:text-white'}`}
              onClick={() => setViewMode('list')}
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {loading ? (
          <LoadingSpinner className="mt-12" />
        ) : library.length === 0 ? (
          <EmptyState
            icon={Library}
            title="Your library is empty"
            description={query ? 'No mods match your search.' : 'Add mods from the Discover page to build your library.'}
            action={{ label: 'Browse Mods', onClick: () => window.location.hash = '#/' }}
          />
        ) : (
          <>
            <p className="text-xs text-surface-500 mb-3">{library.length} mods</p>
            {viewMode === 'grid' ? (
              <div className="mod-grid">
                {library.map((mod, i) => (
                  <ModCard key={mod.id} mod={mod} index={i} />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {library.map((mod, i) => (
                  <motion.div
                    key={mod.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.02 }}
                    className="card p-3 flex items-center gap-3 cursor-pointer hover:bg-surface-800/50 transition-colors"
                    onClick={() => window.location.hash = `#/mod/${mod.id}`}
                  >
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary-900/50 to-surface-800 overflow-hidden flex-shrink-0">
                      {mod.thumbnailUrl ? (
                        <img src={mod.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Library className="w-4 h-4 text-surface-500" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-white truncate">{mod.title}</h3>
                      <p className="text-xs text-surface-400">{mod.author} &middot; v{mod.version}</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-surface-500">
                      {mod.engine && <span className="badge-primary text-[10px]">{mod.engine}</span>}
                      {mod.isInstalled && <span className="text-emerald-400">Installed</span>}
                      {mod.isFavorited && <span className="text-red-400">&hearts;</span>}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </>
        )}
      </motion.div>

      <ImportLocalModModal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
      />
    </div>
  );
}
