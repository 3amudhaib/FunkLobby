import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Download, Play, RefreshCw, Wrench, Trash2,
  FolderOpen, ExternalLink, CheckCircle, AlertCircle,
  Monitor, Shield, Square, Loader2,
} from 'lucide-react';
import { useEngineStore } from '../stores/engineStore';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EngineBanner } from '../components/EngineBanner';
import { useTranslation } from '../hooks/useTranslation';

type Tab = 'all' | 'installed' | 'updates';

export function EnginesPage() {
  const { t } = useTranslation();

  const METHOD_LABELS: Record<string, { label: string; color: string }> = {
    binary: { label: t('engines.autoInstall'), color: 'text-emerald-400 bg-emerald-500/10' },
    source_only: { label: t('engines.sourceOnly'), color: 'text-amber-400 bg-amber-500/10' },
    manual: { label: t('engines.manual'), color: 'text-surface-400 bg-surface-700' },
    direct_download: { label: t('engines.directDl'), color: 'text-primary-400 bg-primary-500/10' },
    unknown_repo: { label: t('engines.noRepo'), color: 'text-red-400 bg-red-500/10' },
    unavailable: { label: t('engines.unavailable'), color: 'text-red-400 bg-red-500/10' },
  };
  const {
    engines, catalog, loading, installProgress, runningEngines,
    fetchEngines, fetchCatalog, installEngine, uninstallEngine,
    launchEngine, stopEngine, detectEngines, checkUpdates, updateEngine,
    repairEngine, verifyEngine, createShortcut, openFolder,
    importExternalEngine, initProgressListener, initRunningStateListener,
  } = useEngineStore();

  const [tab, setTab] = useState<Tab>('all');
  const [actionStates, setActionStates] = useState<Record<string, string>>({});
  const [updateInfos, setUpdateInfos] = useState<Record<string, any>>({});
  const [verifications, setVerifications] = useState<Record<string, any>>({});

  useEffect(() => {
    fetchEngines();
    fetchCatalog();
    const unsub1 = initProgressListener();
    const unsub2 = initRunningStateListener();

    // Listen for async catalog updates (release check results)
    const handleCatalogUpdate = (updatedCatalog: any[]) => {
      useEngineStore.setState({ catalog: updatedCatalog });
    };
    window.electronAPI.onCatalogUpdate(handleCatalogUpdate);

    return () => {
      unsub1();
      unsub2();
      window.electronAPI.removeCatalogUpdateListener(handleCatalogUpdate);
    };
  }, []);

  const getEngineStatus = useCallback((engineType: string) => {
    return engines.find(e => e.type === engineType);
  }, [engines]);

  const handleInstall = async (engineType: string) => {
    setActionStates(prev => ({ ...prev, [engineType]: 'installing' }));
    try {
      await installEngine(engineType);
      setActionStates(prev => ({ ...prev, [engineType]: 'installed' }));
      setTimeout(() => setActionStates(prev => ({ ...prev, [engineType]: '' })), 3000);
    } catch (err: any) {
      setActionStates(prev => ({ ...prev, [engineType]: err.message || 'error' }));
      setTimeout(() => setActionStates(prev => ({ ...prev, [engineType]: '' })), 8000);
    }
  };

  const handleLaunch = async (id: string) => {
    try {
      const result = await launchEngine(id) as any;
      if (result && result.success === false) {
        alert(t('engines.launchFailed'));
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleStopEngine = async (id: string) => {
    try {
      await stopEngine(id);
    } catch { /* ignore */ }
  };

  const isEngineRunning = useCallback((engineId: string) => {
    return runningEngines.has(engineId);
  }, [runningEngines]);

  const handleUninstall = async (id: string) => {
    if (!confirm(t('engines.uninstallConfirm'))) return;
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

  const handleImport = async () => {
    try {
      const result = await importExternalEngine();
      if (result) {
        await fetchEngines();
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const installedEngines = engines.filter(e => e.status === 'installed' || e.status === 'update_available' || e.status === 'broken_installation');
  const importedEngines = engines.filter(e => e.isCustom);
  const officialCatalogEngines = engines.filter(e => !e.isCustom);

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
            <h1 className="text-2xl font-bold text-white">{t('engines.title')}</h1>
            <p className="text-surface-400 text-sm mt-1">
              {t('engines.subtitle', { installed: installedEngines.length, total: catalog.length })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="btn-secondary text-sm"
              onClick={handleImport}
            >
              <Download className="w-3.5 h-3.5 inline mr-1.5" />
              {t('engines.importEngine')}
            </button>
            <button
              className="btn-secondary text-sm"
              onClick={handleDetect}
              disabled={actionStates.detect === 'detecting'}
            >
              <RefreshCw className={`w-3.5 h-3.5 inline mr-1.5 ${actionStates.detect === 'detecting' ? 'animate-spin' : ''}`} />
              {t('engines.autoDetect')}
            </button>
          </div>
        </div>

        <div className="flex gap-2 mb-6">
          {(['all', 'installed', 'updates'] as Tab[]).map(tabName => (
            <button
              key={tabName}
              onClick={() => setTab(tabName)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                tab === tabName
                  ? 'bg-primary-500/20 text-primary-300 border border-primary-500/30'
                  : 'text-surface-400 hover:text-white hover:bg-surface-800'
              }`}
            >
              {tabName === 'all' ? t('engines.all') : tabName === 'installed' ? t('engines.installed') : t('engines.updates')}
              {tabName === 'updates' && Object.values(updateInfos).filter((i: any) => i?.updateAvailable).length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 text-[10px] bg-primary-500 text-white rounded-full">
                  {Object.values(updateInfos).filter((i: any) => i?.updateAvailable).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <LoadingSpinner className="w-8 h-8 text-primary-400 mb-3" />
            <p className="text-surface-400 text-sm">{t('engines.loading')}</p>
          </div>
        ) : displayEngines.length === 0 && tab !== 'all' ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Monitor className="w-12 h-12 text-surface-600 mb-3" />
            <h2 className="text-lg font-medium text-white mb-1">
              {t('engines.empty')}
            </h2>
            <p className="text-surface-400 text-sm max-w-md">
              {t('engines.emptyHint')}
            </p>
          </div>
        ) : (
          <>
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
                    className="card p-5 flex flex-col gap-2 h-full hover:-translate-y-1 hover:shadow-xl hover:shadow-black/30"
                  >
                    <EngineBanner
                      engineId={entry.id}
                      engineName={entry.name}
height={150}
                        className="-mx-5"
                      />
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-semibold text-sm truncate">{entry.name}</h3>
                        <p className="text-surface-400 text-xs mt-1 line-clamp-3 leading-relaxed">{entry.description}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 flex-shrink-0 ml-2">
                        {entry.isCustom && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium text-violet-400 bg-violet-500/10 rounded-full">
                            {t('engines.imported')}
                          </span>
                        )}
                        {entry.installMethod === 'checking' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full text-surface-400 bg-surface-700 animate-pulse">
                            <Loader2 className="w-2.5 h-2.5 animate-spin" />
                            Loading...
                          </span>
                        ) : entry.installMethod && METHOD_LABELS[entry.installMethod] ? (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full ${METHOD_LABELS[entry.installMethod].color}`}>
                            {METHOD_LABELS[entry.installMethod].label}
                          </span>
                        ) : null}
                        {(() => {
                          const s = installed?.status;
                          if (s === 'installed' || s === 'update_available') {
                            return (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium text-emerald-400 bg-emerald-500/10 rounded-full">
                                <CheckCircle className="w-3 h-3" />
                                {installed?.version || t('engines.installed')}
                              </span>
                            );
                          }
                          if (s === 'downloading' || s === 'installing' || actionStates[entry.id] === 'installing') {
                            return (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium text-primary-400 bg-primary-500/10 rounded-full">
                                <LoadingSpinner className="w-3 h-3" />
                                {s === 'downloading' ? t('engines.downloading') : t('engines.installing')}
                              </span>
                            );
                          }
                          if (s === 'corrupted' || s === 'broken_installation') {
                            return (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium text-amber-400 bg-amber-500/10 rounded-full">
                                <AlertCircle className="w-3 h-3" />
                                {t('engines.error')}
                              </span>
                            );
                          }
                          if (s === 'download_failed') {
                            return (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium text-red-400 bg-red-500/10 rounded-full">
                                <AlertCircle className="w-3 h-3" />
                                {t('engines.error')}
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
                          {t('engines.github')}
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
                          {t('engines.website')}
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

                    {actionStates[entry.id] && actionStates[entry.id] !== 'installing' && actionStates[entry.id] !== 'installed' && actionStates[entry.id] !== 'error' && actionStates[entry.id] !== '' && (
                      <div className="flex items-center gap-1.5 p-2 rounded bg-red-500/10 text-red-400 text-[11px]">
                        <AlertCircle className="w-3 h-3 flex-shrink-0" />
                        {actionStates[entry.id]}
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
                        {t('engines.updateAvailable', { current: updateInfo.currentVersion, latest: updateInfo.latestVersion })}
                      </div>
                    )}

                    {verifyResult && !verifyResult.verified && (
                      <div className="flex items-center gap-1.5 p-2 rounded bg-amber-500/10 text-amber-400 text-[11px]">
                        <AlertCircle className="w-3 h-3 flex-shrink-0" />
                        {verifyResult.issues[0] || t('engines.verificationFailed')}
                      </div>
                    )}

                    {installProgress[entry.id] && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-surface-400">
                          <span>{installProgress[entry.id].status === 'downloading' ? t('engines.downloading') : t('engines.installing')}</span>
                          <span>{installProgress[entry.id].percent}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-surface-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary-500 rounded-full transition-all duration-300"
                            style={{ width: `${installProgress[entry.id].percent}%` }}
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2 mt-auto pt-2">
                      {!installed || installed.status === 'not_installed' || installed.status === 'download_failed' ? (
                        <button
                          className="text-xs flex-1 btn-primary"
                          onClick={() => handleInstall(entry.id)}
                          disabled={actionStates[entry.id] === 'installing'}
                        >
                          <Download className="w-3 h-3 inline mr-1" />
                          {actionStates[entry.id] === 'installing' ? t('engines.installing') : installed?.status === 'download_failed' ? t('downloads.retry') : t('engines.install')}
                        </button>
                      ) : (
                        <>
                          {(installed.status === 'installed' || installed.status === 'update_available' || installed.status === 'broken_installation') && (
                            isEngineRunning(installed.id) ? (
                              <button
                                className="btn-secondary text-xs border-emerald-500/50 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                                onClick={() => handleStopEngine(installed.id)}
                                title={t('engines.running')}
                              >
                                <Square className="w-3 h-3" />
                                {t('engines.running')}
                              </button>
                            ) : (
                              <button
                                className="btn-secondary text-xs"
                                onClick={() => handleLaunch(installed.id)}
                                title={t('engines.launch')}
                              >
                                <Play className="w-3 h-3" />
                              </button>
                            )
                          )}
                          <button
                            className="btn-secondary text-xs"
                            onClick={() => handleCheckUpdate(entry.id)}
                            disabled={actionStates[`check_${entry.id}`] === 'checking'}
                             title={t('engines.checkUpdates')}
                          >
                            <RefreshCw className={`w-3 h-3 ${actionStates[`check_${entry.id}`] === 'checking' ? 'animate-spin' : ''}`} />
                          </button>
                          {updateInfo?.updateAvailable && (
                            <button
                              className="btn-primary text-xs"
                              onClick={() => handleUpdate(installed.id)}
                              disabled={actionStates[`update_${installed.id}`] === 'updating'}
                            >
                              {actionStates[`update_${installed.id}`] === 'updating' ? t('engines.updating') : t('engines.update')}
                            </button>
                          )}
                          <button
                            className="btn-secondary text-xs"
                            onClick={() => handleRepair(installed.id)}
                            disabled={actionStates[`repair_${installed.id}`] === 'repairing'}
                            title={t('engines.repair')}
                          >
                            <Wrench className={`w-3 h-3 ${actionStates[`repair_${installed.id}`] === 'repairing' ? 'animate-spin' : ''}`} />
                          </button>
                          {installed.installPath && (
                            <button
                              className="btn-secondary text-xs"
                              onClick={() => openFolder(installed.id)}
                              title={t('engines.openFolder')}
                            >
                              <FolderOpen className="w-3 h-3" />
                            </button>
                          )}
                          <button
                            className="btn-secondary text-xs"
                            onClick={() => handleVerify(installed.id, entry.id)}
                            title={t('engines.verify')}
                          >
                            <Shield className="w-3 h-3" />
                          </button>
                          <button
                            className="btn-secondary text-xs"
                            onClick={() => handleCreateShortcut(installed.id)}
                            title={t('engines.createShortcut')}
                          >
                            <ExternalLink className="w-3 h-3" />
                          </button>
                          <button
                            className="btn-danger text-xs"
                            onClick={() => handleUninstall(installed.id)}
                            title={t('engines.uninstall')}
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

            {/* Imported engines section */}
            {tab === 'all' && importedEngines.length > 0 && (
              <div className="mt-8">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Download className="w-4 h-4 text-violet-400" />
                  {t('engines.importedEngines')}
                  <span className="text-xs text-surface-500 font-normal">({importedEngines.length})</span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {importedEngines.map((engine) => {
                    const updateInfo = updateInfos[engine.type];
                    const verifyResult = verifications[engine.id];

                    return (
                      <motion.div
                        key={engine.id}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="card p-5 flex flex-col gap-2 h-full hover:-translate-y-1 hover:shadow-xl hover:shadow-black/30 border-violet-500/20"
                      >
                        <EngineBanner
                          engineId={engine.type}
                          engineName={engine.name}
height={150}
                        className="-mx-5"
                      />
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-semibold text-sm truncate">{engine.name}</h3>
                            <p className="text-surface-400 text-xs mt-1 line-clamp-3 leading-relaxed">{engine.description}</p>
                          </div>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium text-violet-400 bg-violet-500/10 rounded-full flex-shrink-0 ml-2">
                            {t('engines.imported')}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-[10px] text-surface-500">
                          {engine.version && <span>{t('engines.version', { version: engine.version })}</span>}
                        </div>

                        {engine.error && (
                          <div className="flex items-center gap-1.5 p-2 rounded bg-red-500/10 text-red-400 text-[11px]">
                            <AlertCircle className="w-3 h-3 flex-shrink-0" />
                            {engine.error}
                          </div>
                        )}

                        <div className="flex flex-wrap gap-2 mt-auto pt-2">
                          {isEngineRunning(engine.id) ? (
                            <button
                              className="btn-secondary text-xs border-emerald-500/50 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                              onClick={() => handleStopEngine(engine.id)}
                              title={t('engines.running')}
                            >
                              <Square className="w-3 h-3" />
                              {t('engines.running')}
                            </button>
                          ) : (
                            <button
                              className="btn-secondary text-xs"
                              onClick={() => handleLaunch(engine.id)}
                              title={t('engines.launch')}
                            >
                              <Play className="w-3 h-3" />
                            </button>
                          )}
                          <button
                            className="btn-secondary text-xs"
                            onClick={() => handleRepair(engine.id)}
                            disabled={actionStates[`repair_${engine.id}`] === 'repairing'}
                            title={t('engines.repair')}
                          >
                            <Wrench className={`w-3 h-3 ${actionStates[`repair_${engine.id}`] === 'repairing' ? 'animate-spin' : ''}`} />
                          </button>
                          {engine.installPath && (
                            <button
                              className="btn-secondary text-xs"
                              onClick={() => openFolder(engine.id)}
                              title={t('engines.openFolder')}
                            >
                              <FolderOpen className="w-3 h-3" />
                            </button>
                          )}
                          <button
                            className="btn-secondary text-xs"
                            onClick={() => handleVerify(engine.id, engine.type)}
                            title={t('engines.verify')}
                          >
                            <Shield className="w-3 h-3" />
                          </button>
                          <button
                            className="btn-danger text-xs"
                            onClick={() => handleUninstall(engine.id)}
                            title={t('engines.uninstall')}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
}