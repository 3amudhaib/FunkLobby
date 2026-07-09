import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Download, Play, RefreshCw, Wrench, Trash2,
  FolderOpen, ExternalLink, CheckCircle, AlertCircle,
  Clock, FileText, Monitor, Shield, ImageOff,
} from 'lucide-react';
import { useEngineStore } from '../stores/engineStore';
import { LoadingSpinner } from '../components/LoadingSpinner';

type Tab = 'all' | 'installed' | 'updates';

const METHOD_LABELS: Record<string, { label: string; color: string }> = {
  binary: { label: 'Auto-Install', color: 'text-emerald-400 bg-emerald-500/10' },
  source_only: { label: 'Source Only', color: 'text-amber-400 bg-amber-500/10' },
  manual: { label: 'Manual', color: 'text-surface-400 bg-surface-700' },
  direct_download: { label: 'Direct DL', color: 'text-primary-400 bg-primary-500/10' },
  unknown_repo: { label: 'No Repo', color: 'text-red-400 bg-red-500/10' },
  no_releases: { label: 'No Releases', color: 'text-red-400 bg-red-500/10' },
};

export function EnginesPage() {
  const {
    engines, catalog, imageUrls, loading,
    fetchEngines, fetchCatalog, fetchEngineImage, installEngine, uninstallEngine,
    launchEngine, detectEngines, checkUpdates, updateEngine,
    repairEngine, verifyEngine, createShortcut, openFolder,
  } = useEngineStore();

  const [tab, setTab] = useState<Tab>('all');
  const [actionStates, setActionStates] = useState<Record<string, string>>({});
  const [updateInfos, setUpdateInfos] = useState<Record<string, any>>({});
  const [verifications, setVerifications] = useState<Record<string, any>>({});

  useEffect(() => {
    fetchEngines();
    fetchCatalog();
  }, []);

  useEffect(() => {
    catalog.forEach((e: any) => {
      if (!(e.id in imageUrls)) {
        fetchEngineImage(e.id);
      }
    });
  }, [catalog]);

  const getEngineStatus = useCallback((engineType: string) => {
    return engines.find(e => e.type === engineType);
  }, [engines]);

  const handleInstall = async (engineType: string) => {
    setActionStates(prev => ({ ...prev, [engineType]: 'installing' }));
    try {
      await installEngine(engineType);
      setActionStates(prev => ({ ...prev, [engineType]: 'installed' }));
      setTimeout(() => setActionStates(prev => ({ ...prev, [engineType]: '' })), 3000);
    } catch {
      setActionStates(prev => ({ ...prev, [engineType]: 'error' }));
    }
  };

  const handleLaunch = async (id: string) => {
    try {
      const result = await launchEngine(id) as any;
      if (result && result.success === false) {
        alert(`Engine failed to launch (exit code: ${result.exitCode ?? 'unknown'}). The installation may be broken. Try repairing.`);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleUninstall = async (id: string) => {
    if (!confirm('Uninstall this engine?')) return;
    try {
      await uninstallEngine(id);
    } catch { /* ignore */ }
  };

  const handleCheckUpdate = async (engineType: string) => {
    setActionStates(prev => ({ ...prev, [`check_${engineType}`]: 'checking' }));
    try {
      const info = await checkUpdates(engineType);
      setUpdateInfos(prev => ({ ...prev, [engineType]: info }));
    } catch { /* ignore */ }
    setActionStates(prev => ({ ...prev, [`check_${engineType}`]: '' }));
  };

  const handleUpdate = async (id: string) => {
    setActionStates(prev => ({ ...prev, [`update_${id}`]: 'updating' }));
    try {
      await updateEngine(id);
      setActionStates(prev => ({ ...prev, [`update_${id}`]: '' }));
    } catch { /* ignore */ }
  };

  const handleRepair = async (id: string) => {
    setActionStates(prev => ({ ...prev, [`repair_${id}`]: 'repairing' }));
    try {
      await repairEngine(id);
      setActionStates(prev => ({ ...prev, [`repair_${id}`]: '' }));
    } catch { /* ignore */ }
  };

  const handleVerify = async (id: string, engineType: string) => {
    try {
      const result = await verifyEngine(id);
      setVerifications(prev => ({ ...prev, [engineType]: result }));
    } catch { /* ignore */ }
  };

  const handleCreateShortcut = async (id: string) => {
    try {
      await createShortcut(id);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDetect = async () => {
    setActionStates(prev => ({ ...prev, detect: 'detecting' }));
    await detectEngines();
    setActionStates(prev => ({ ...prev, detect: '' }));
  };

  const installedEngines = engines.filter(e => e.status === 'installed' || e.status === 'update_available' || e.status === 'broken_installation');
  const sortedCatalog = [...catalog].sort((a, b) => {
    const aInst = getEngineStatus(a.id);
    const bInst = getEngineStatus(b.id);
    if (aInst && !bInst) return -1;
    if (!aInst && bInst) return 1;
    return a.name.localeCompare(b.name);
  });

  const displayEngines = tab === 'installed'
    ? catalog.filter(e => ['installed', 'update_available', 'broken_installation'].includes(getEngineStatus(e.id)?.status ?? ''))
    : tab === 'updates'
    ? catalog.filter(e => {
        const inst = getEngineStatus(e.id);
        return inst && updateInfos[e.id]?.updateAvailable;
      })
    : sortedCatalog;

  return (
    <div className="page-container pt-14">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Engine Library</h1>
            <p className="text-surface-400 text-sm mt-1">
              {installedEngines.length} of {catalog.length} engines installed
            </p>
          </div>
          <button
            className="btn-secondary text-sm"
            onClick={handleDetect}
            disabled={actionStates.detect === 'detecting'}
          >
            <RefreshCw className={`w-3.5 h-3.5 inline mr-1.5 ${actionStates.detect === 'detecting' ? 'animate-spin' : ''}`} />
            {actionStates.detect === 'detecting' ? 'Scanning...' : 'Auto-Detect'}
          </button>
        </div>

        <div className="flex gap-2 mb-6">
          {(['all', 'installed', 'updates'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                tab === t
                  ? 'bg-primary-500/20 text-primary-300 border border-primary-500/30'
                  : 'text-surface-400 hover:text-white hover:bg-surface-800'
              }`}
            >
              {t === 'all' ? 'All Engines' : t === 'installed' ? 'Installed' : 'Updates'}
              {t === 'updates' && Object.values(updateInfos).filter((i: any) => i?.updateAvailable).length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 text-[10px] bg-primary-500 text-white rounded-full">
                  {Object.values(updateInfos).filter((i: any) => i?.updateAvailable).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {displayEngines.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Monitor className="w-12 h-12 text-surface-600 mb-3" />
            <h2 className="text-lg font-medium text-white mb-1">
              {tab === 'installed' ? 'No engines installed' : tab === 'updates' ? 'All engines up to date' : 'No engines found'}
            </h2>
            <p className="text-surface-400 text-sm max-w-md">
              {tab === 'installed'
                ? 'Install an engine from the catalog below, or click Auto-Detect to scan your system.'
                : 'All installed engines are on their latest version.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {displayEngines.map((entry: any) => {
              const installed = getEngineStatus(entry.id);
              const updateInfo = updateInfos[entry.id];
              const verifyResult = verifications[entry.id];

              return (
                <motion.div
                  key={entry.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="card p-4 flex flex-col gap-3"
                >
                  {imageUrls[entry.id] && (
                    <div className="relative -mx-4 -mt-4 mb-2 overflow-hidden" style={{ height: 128 }}>
                      <img
                        src={imageUrls[entry.id]!}
                        alt={entry.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-semibold text-sm truncate">{entry.name}</h3>
                      <p className="text-surface-400 text-xs mt-0.5 line-clamp-2">{entry.description}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0 ml-2">
                      {entry.installMethod && METHOD_LABELS[entry.installMethod] && (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full ${METHOD_LABELS[entry.installMethod].color}`}>
                          {METHOD_LABELS[entry.installMethod].label}
                        </span>
                      )}
                      {(() => {
                        const s = installed?.status;
                        if (s === 'installed' || s === 'update_available') {
                          return (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium text-emerald-400 bg-emerald-500/10 rounded-full">
                              <CheckCircle className="w-3 h-3" />
                              {(installed?.version) || 'Installed'}
                            </span>
                          );
                        }
                        if (s === 'downloading' || s === 'installing' || actionStates[entry.id] === 'installing') {
                          return (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium text-primary-400 bg-primary-500/10 rounded-full">
                              <LoadingSpinner className="w-3 h-3" />
                              {s === 'downloading' ? 'Downloading...' : 'Installing...'}
                            </span>
                          );
                        }
                        if (s === 'corrupted' || s === 'broken_installation') {
                          return (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium text-amber-400 bg-amber-500/10 rounded-full">
                              <AlertCircle className="w-3 h-3" />
                              {s === 'broken_installation' ? 'Broken' : 'Corrupted'}
                            </span>
                          );
                        }
                        if (s === 'download_failed') {
                          return (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium text-red-400 bg-red-500/10 rounded-full">
                              <AlertCircle className="w-3 h-3" />
                              Failed
                            </span>
                          );
                        }
                        if (s === 'not_installed') {
                          return null;
                        }
                        return null;
                      })()}
                    </div>
                  </div>

                  {entry.features && (
                    <div className="flex flex-wrap gap-1">
                      {(Array.isArray(entry.features) ? entry.features : []).slice(0, 4).map((f: string) => (
                        <span key={f} className="px-1.5 py-0.5 text-[10px] bg-surface-800 text-surface-400 rounded">
                          {f}
                        </span>
                      ))}
                      {(Array.isArray(entry.features) ? entry.features : []).length > 4 && (
                        <span className="px-1.5 py-0.5 text-[10px] bg-surface-800 text-surface-500 rounded">
                          +{(Array.isArray(entry.features) ? entry.features : []).length - 4}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-[10px] text-surface-500">
                    {entry.repoUrl && (
                      <a
                        href={entry.repoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 hover:text-primary-400 transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                        GitHub
                      </a>
                    )}
                    {entry.websiteUrl && (
                      <a
                        href={entry.websiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 hover:text-primary-400 transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Website
                      </a>
                    )}
                    {entry.license && (
                      <span>{entry.license}</span>
                    )}
                  </div>

                  {installed?.error && (
                    <div className="flex items-center gap-1.5 p-2 rounded bg-red-500/10 text-red-400 text-[11px]">
                      <AlertCircle className="w-3 h-3 flex-shrink-0" />
                      {installed.error}
                    </div>
                  )}

                  {!installed && !entry.supported && entry.installDisabledReason && (
                    <div className="flex items-center gap-1.5 p-2 rounded bg-surface-800 text-surface-400 text-[11px]">
                      <AlertCircle className="w-3 h-3 flex-shrink-0" />
                      {entry.installDisabledReason}
                    </div>
                  )}

                  {updateInfo && updateInfo.updateAvailable && (
                    <div className="flex items-center gap-1.5 p-2 rounded bg-primary-500/10 text-primary-300 text-[11px]">
                      <RefreshCw className="w-3 h-3 flex-shrink-0" />
                      Update available: v{updateInfo.currentVersion} v{updateInfo.latestVersion}
                    </div>
                  )}

                  {verifyResult && !verifyResult.verified && (
                    <div className="flex items-center gap-1.5 p-2 rounded bg-amber-500/10 text-amber-400 text-[11px]">
                      <AlertCircle className="w-3 h-3 flex-shrink-0" />
                      {verifyResult.issues[0] || 'Verification failed'}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1.5 mt-auto pt-1">
                    {!installed || installed.status === 'not_installed' || installed.status === 'download_failed' ? (
                      <button
                        className={`text-xs flex-1 ${!entry.supported ? 'btn-disabled' : 'btn-primary'}`}
                        onClick={() => handleInstall(entry.id)}
                        disabled={!entry.supported || actionStates[entry.id] === 'installing'}
                      >
                        <Download className="w-3 h-3 inline mr-1" />
                        {actionStates[entry.id] === 'installing' ? 'Installing...' : installed?.status === 'download_failed' ? 'Retry' : 'Install'}
                      </button>
                    ) : (
                      <>
                        {(installed.status === 'installed' || installed.status === 'update_available' || installed.status === 'broken_installation') && (
                          <button
                            className="btn-secondary text-xs"
                            onClick={() => handleLaunch(installed.id)}
                            title="Launch Engine"
                          >
                            <Play className="w-3 h-3" />
                          </button>
                        )}
                        <button
                          className="btn-secondary text-xs"
                          onClick={() => handleCheckUpdate(entry.id)}
                          disabled={actionStates[`check_${entry.id}`] === 'checking'}
                          title="Check for Updates"
                        >
                          <RefreshCw className={`w-3 h-3 ${actionStates[`check_${entry.id}`] === 'checking' ? 'animate-spin' : ''}`} />
                        </button>
                        {updateInfo?.updateAvailable && (
                          <button
                            className="btn-primary text-xs"
                            onClick={() => handleUpdate(installed.id)}
                            disabled={actionStates[`update_${installed.id}`] === 'updating'}
                          >
                            {actionStates[`update_${installed.id}`] === 'updating' ? 'Updating...' : 'Update'}
                          </button>
                        )}
                        <button
                          className="btn-secondary text-xs"
                          onClick={() => handleRepair(installed.id)}
                          disabled={actionStates[`repair_${installed.id}`] === 'repairing'}
                          title="Repair"
                        >
                          <Wrench className={`w-3 h-3 ${actionStates[`repair_${installed.id}`] === 'repairing' ? 'animate-spin' : ''}`} />
                        </button>
                        {installed.installPath && (
                          <button
                            className="btn-secondary text-xs"
                            onClick={() => openFolder(installed.id)}
                            title="Open Folder"
                          >
                            <FolderOpen className="w-3 h-3" />
                          </button>
                        )}
                        <button
                          className="btn-secondary text-xs"
                          onClick={() => handleVerify(installed.id, entry.id)}
                          title="Verify Files"
                        >
                          <Shield className="w-3 h-3" />
                        </button>
                        <button
                          className="btn-secondary text-xs"
                          onClick={() => handleCreateShortcut(installed.id)}
                          title="Create Shortcut"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </button>
                        <button
                          className="btn-danger text-xs"
                          onClick={() => handleUninstall(installed.id)}
                          title="Uninstall"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
}