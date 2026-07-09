import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Play, FolderOpen, MoreVertical, FileInput, FileOutput, Download, Package, Copy, Trash2, ToggleLeft, ToggleRight, Undo2, FolderSync, ShieldCheck, Wrench } from 'lucide-react';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import { GlassDialog } from '../components/GlassDialog';
import { useModStore } from '../stores/modStore';
import { useEngineStore } from '../stores/engineStore';
import { useProfileStore } from '../stores/profileStore';
import { formatBytes, formatDate } from '../utils/format';

export function InstalledPage() {
  const { installed, fetchInstalled, uninstallMod, renameMod, backupMod, exportMod, importMod, enableMod, disableMod, duplicateMod, restoreMod, moveMod } = useModStore();
  const { launchMod } = useEngineStore();
  const { profiles } = useProfileStore();
  const [loading, setLoading] = useState(true);
  const [selectedMod, setSelectedMod] = useState<any>(null);
  const [showMenu, setShowMenu] = useState<string | null>(null);
  const [showRename, setShowRename] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  useEffect(() => {
    fetchInstalled().finally(() => setLoading(false));
  }, []);

  const handleUninstall = async (id: string) => {
    try {
      await uninstallMod(id);
    } catch {}
    setShowMenu(null);
  };

  const handleRename = async () => {
    if (selectedMod && renameValue) {
      try {
        await renameMod(selectedMod.id, renameValue);
      } catch {}
      setShowRename(false);
      setSelectedMod(null);
    }
  };

  const handleLaunch = async (modId: string) => {
    try {
      await launchMod(modId, '');
    } catch {}
  };

  if (loading) return <div className="page-container pt-14"><LoadingSpinner className="mt-20" /></div>;

  return (
    <div className="page-container pt-14">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Installed Mods</h1>
            <p className="text-surface-400 text-sm mt-1">{installed.length} mods installed</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn-secondary text-sm flex items-center gap-2" onClick={() => { importMod().catch(() => {}); }}>
              <FileInput className="w-4 h-4" />
              Import
            </button>
            <button className="btn-primary text-sm flex items-center gap-2" onClick={() => window.electronAPI.openModFolder('')}>
              <FolderOpen className="w-4 h-4" />
              Open Mods Folder
            </button>
          </div>
        </div>

        {installed.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No mods installed"
            description="Install mods from the Home page to see them here."
            action={{ label: 'Browse Mods', onClick: () => window.location.hash = '#/' }}
          />
        ) : (
          <div className="space-y-2">
            {installed.map((mod, i) => (
              <motion.div
                key={mod.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="card p-4 flex items-center gap-4 relative"
              >
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary-900/50 to-surface-800 overflow-hidden flex-shrink-0">
                  {mod.thumbnailUrl ? (
                    <img src={mod.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-5 h-5 text-surface-500" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-white truncate">{mod.title}</h3>
                  <p className="text-[11px] text-surface-400">{mod.author} &middot; v{mod.version}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary-500/10 text-primary-300">
                      {mod.engine}
                    </span>
                    {mod.fileSize > 0 && (
                      <span className="text-[10px] text-surface-500">{formatBytes(mod.fileSize)}</span>
                    )}
                    {mod.installedAt && (
                      <span className="text-[10px] text-surface-500">Installed {formatDate(mod.installedAt)}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    className="p-2 hover:bg-white/5 rounded-lg transition-colors text-surface-400 hover:text-emerald-400"
                    onClick={() => handleLaunch(mod.id)}
                    title="Launch"
                  >
                    <Play className="w-4 h-4" />
                  </button>
                  <button
                    className="p-2 hover:bg-white/5 rounded-lg transition-colors text-surface-400 hover:text-primary-400"
                    onClick={() => window.electronAPI.openModFolder(mod.id)}
                    title="Open folder"
                  >
                    <FolderOpen className="w-4 h-4" />
                  </button>
                  <div className="relative">
                    <button
                      className="p-2 hover:bg-white/5 rounded-lg transition-colors text-surface-400"
                      onClick={() => setShowMenu(showMenu === mod.id ? null : mod.id)}
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    {showMenu === mod.id && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setShowMenu(null)} />
                        <div className="absolute right-0 top-full mt-1 w-48 glass rounded-xl border border-white/[0.06] shadow-xl z-20 py-1">
                          <button
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-surface-300 hover:bg-white/5 hover:text-white transition-colors"
                            onClick={() => { setSelectedMod(mod); setRenameValue(mod.title); setShowRename(true); setShowMenu(null); }}
                          >
                            <Copy className="w-3.5 h-3.5" />
                            Rename
                          </button>
                          <button
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-surface-300 hover:bg-white/5 hover:text-white transition-colors"
                            onClick={async () => { try { await duplicateMod(mod.id); } catch {} setShowMenu(null); }}
                          >
                            <Copy className="w-3.5 h-3.5" />
                            Duplicate
                          </button>
                          {mod.enabled !== false ? (
                            <button
                              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-surface-300 hover:bg-white/5 hover:text-white transition-colors"
                              onClick={async () => { try { await disableMod(mod.id); } catch {} setShowMenu(null); }}
                            >
                              <ToggleLeft className="w-3.5 h-3.5" />
                              Disable
                            </button>
                          ) : (
                            <button
                              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-surface-300 hover:bg-white/5 hover:text-white transition-colors"
                              onClick={async () => { try { await enableMod(mod.id); } catch {} setShowMenu(null); }}
                            >
                              <ToggleRight className="w-3.5 h-3.5" />
                              Enable
                            </button>
                          )}
                          <button
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-surface-300 hover:bg-white/5 hover:text-white transition-colors"
                            onClick={async () => { try { await backupMod(mod.id); } catch {} setShowMenu(null); }}
                          >
                            <Download className="w-3.5 h-3.5" />
                            Backup
                          </button>
                          <button
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-surface-300 hover:bg-white/5 hover:text-white transition-colors"
                            onClick={async () => { try { await exportMod(mod.id); } catch {} setShowMenu(null); }}
                          >
                            <FileOutput className="w-3.5 h-3.5" />
                            Export ZIP
                          </button>
                          <div className="border-t border-white/[0.06] my-1" />
                          <button
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-surface-300 hover:bg-white/5 hover:text-white transition-colors"
                            onClick={async () => { try { const bp = await backupMod(mod.id); if (bp) await restoreMod(mod.id, bp); } catch {} setShowMenu(null); }}
                          >
                            <Undo2 className="w-3.5 h-3.5" />
                            Restore Backup
                          </button>
                          <button
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-surface-300 hover:bg-white/5 hover:text-white transition-colors"
                            onClick={async () => {
                              try {
                                const result = await window.electronAPI.verifyInstallation(mod.id);
                                if (result.verified) {
                                  alert('Mod installation verified successfully.');
                                } else {
                                  alert('Mod files are missing or corrupted. Use Repair to restore from backup.');
                                }
                              } catch {}
                              setShowMenu(null);
                            }}
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            Verify Files
                          </button>
                          <button
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-surface-300 hover:bg-white/5 hover:text-white transition-colors"
                            onClick={async () => {
                              setShowMenu(null);
                              try {
                                const bp = await backupMod(mod.id);
                                if (bp) {
                                  await restoreMod(mod.id, bp);
                                  alert('Mod repaired from backup.');
                                } else {
                                  alert('No backup available to restore from.');
                                }
                              } catch {}
                            }}
                          >
                            <Wrench className="w-3.5 h-3.5" />
                            Repair
                          </button>
                          {profiles.length > 1 && (
                            <button
                              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-surface-300 hover:bg-white/5 hover:text-white transition-colors"
                              onClick={async () => {
                                const other = profiles.find(p => p.id !== mod.profileId);
                                if (other) { try { await moveMod(mod.id, other.id); } catch {} }
                                setShowMenu(null);
                              }}
                            >
                              <FolderSync className="w-3.5 h-3.5" />
                              Move to Profile
                            </button>
                          )}
                          <div className="border-t border-white/[0.06] my-1" />
                          <button
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                            onClick={() => handleUninstall(mod.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Uninstall
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      <GlassDialog
        open={showRename}
        onClose={() => setShowRename(false)}
        title="Rename Mod"
      >
        <input
          className="input text-sm mb-4"
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          placeholder="Mod name"
          autoFocus
          onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); }}
        />
        <div className="flex justify-end gap-2">
          <button className="btn-secondary text-sm" onClick={() => setShowRename(false)}>Cancel</button>
          <button className="btn-primary text-sm" onClick={handleRename}>Rename</button>
        </div>
      </GlassDialog>
    </div>
  );
}
