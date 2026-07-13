import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Library, Grid3X3, List, Upload, Trash2, HardDrive } from 'lucide-react';
import { ModCard } from '../components/ModCard';
import { ModCover } from '../components/ModCover';
import { SearchBar } from '../components/SearchBar';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import { ImportLocalModModal } from '../components/ImportLocalModModal';
import { InstallToEngineDialog } from '../components/InstallToEngineDialog';
import { useModStore } from '../stores/modStore';
import { CATEGORIES, SORT_OPTIONS } from '../../shared/constants';
import { useTranslation } from '../hooks/useTranslation';

export function LibraryPage() {
  const { t } = useTranslation();
  const { library, fetchLibrary, loading, deleteMod } = useModStore();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [sortBy, setSortBy] = useState('name');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showImportModal, setShowImportModal] = useState(false);
  const [contextMod, setContextMod] = useState<any | null>(null);
  const [contextPos, setContextPos] = useState<{ x: number; y: number } | null>(null);
  const [showInstallDialog, setShowInstallDialog] = useState(false);
  const [installModId, setInstallModId] = useState('');
  const [installModTitle, setInstallModTitle] = useState('');

  useEffect(() => {
    fetchLibrary({ query, category: category === 'All' ? undefined : category, sortBy });
  }, [query, category, sortBy]);

  const handleContextMenu = useCallback((e: React.MouseEvent, mod: any) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMod(mod);
    setContextPos({ x: e.clientX, y: e.clientY });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMod(null);
    setContextPos(null);
  }, []);

  const handleInstallToEngine = useCallback(() => {
    if (!contextMod) return;
    setInstallModId(contextMod.id);
    setInstallModTitle(contextMod.title);
    closeContextMenu();
    setShowInstallDialog(true);
  }, [contextMod, closeContextMenu]);

  const handleDelete = useCallback(async () => {
    if (!contextMod) return;
    const modId = contextMod.id;
    closeContextMenu();
    try {
      await deleteMod(modId);
      await fetchLibrary();
    } catch {}
  }, [contextMod, closeContextMenu, deleteMod, fetchLibrary]);

  return (
    <div className="page-container pt-14">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">{t('library.title')}</h1>
            <p className="text-surface-400 text-sm mt-1">{t('library.subtitle', { count: library.length, plural: library.length !== 1 ? 's' : '' })}</p>
          </div>
          <button className="btn-secondary text-sm" onClick={() => setShowImportModal(true)}>
            <Upload className="w-4 h-4" />
            {t('library.importLocal')}
          </button>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <SearchBar
            value={query}
            onChange={setQuery}
            placeholder={t('library.searchPlaceholder')}
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
            title={t('library.empty')}
            description={query ? t('library.noMatch') : t('library.emptyHint')}
            action={{ label: t('library.browseMods'), onClick: () => window.location.hash = '#/' }}
          />
        ) : (
          <>
            <p className="text-xs text-surface-500 mb-3">{t('library.subtitle', { count: library.length, plural: library.length !== 1 ? 's' : '' })}</p>
            {viewMode === 'grid' ? (
              <div className="mod-grid">
                {library.map((mod, i) => (
                  <div key={mod.id} onContextMenu={(e) => handleContextMenu(e, mod)}>
                    <ModCard
                      mod={mod}
                      index={i}
                    />
                  </div>
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
                    onContextMenu={(e) => handleContextMenu(e, mod)}
                  >
                    <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-surface-800">
                      <ModCover
                        modId={mod.id}
                        coverPath={mod.coverPath}
                        thumbnailUrl={mod.thumbnailUrl}
                        title={mod.title}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-white truncate">{mod.title}</h3>
                      <p className="text-xs text-surface-400">{mod.author} &middot; v{mod.version}</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-surface-500">
                      {mod.engine && <span className="badge-primary text-[10px]">{mod.engine}</span>}
                      {mod.isInstalled && <span className="text-emerald-400">{t('library.installed')}</span>}
                      {mod.isFavorited && <span className="text-red-400">&hearts;</span>}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </>
        )}
      </motion.div>

      {/* Context menu */}
      {contextMod && contextPos && (
        <>
          <div className="fixed inset-0 z-40" onClick={closeContextMenu} />
          <div
            className="fixed z-50 w-56 glass rounded-xl border border-white/[0.06] shadow-xl py-1"
            style={{ left: contextPos.x, top: contextPos.y }}
          >
            <button
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-surface-300 hover:bg-white/5 hover:text-white transition-colors"
              onClick={handleInstallToEngine}
            >
              <HardDrive className="w-3.5 h-3.5" />
              {t('library.installToEngine')}
            </button>
            <div className="h-px bg-white/[0.06] mx-2 my-1" />
            <button
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-white/5 hover:text-red-300 transition-colors"
              onClick={handleDelete}
            >
              <Trash2 className="w-3.5 h-3.5" />
              {t('library.deleteMod')}
            </button>
          </div>
        </>
      )}

      <ImportLocalModModal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
      />

      <InstallToEngineDialog
        open={showInstallDialog}
        onClose={() => setShowInstallDialog(false)}
        modId={installModId}
        modTitle={installModTitle}
      />
    </div>
  );
}
