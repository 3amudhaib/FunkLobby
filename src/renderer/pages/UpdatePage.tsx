import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Download, RefreshCw, CheckCircle, AlertCircle,
  Package, ArrowUp, RotateCcw,
  ChevronDown, ChevronUp, Settings2, Cloud,
} from 'lucide-react';
import { useUpdateStore } from '../stores/updateStore';
import { useTranslation } from '../hooks/useTranslation';


export function UpdatePage() {
  const { t } = useTranslation();
  const {
    status, info, progress, error, channel, autoUpdate,
    checkUpdates, downloadUpdate, installUpdate, setChannel, setAutoUpdate,
  } = useUpdateStore();
  const [showNotes, setShowNotes] = useState(false);
  const [channelOpen, setChannelOpen] = useState(false);

  useEffect(() => {
    checkUpdates(true);
  }, []);

  const isChecking = status === 'checking';
  const isDownloading = status === 'downloading';
  const isInstalling = status === 'installing';
  const isLoading = isChecking || isDownloading || isInstalling;

  const progressPct = progress?.percent || 0;
  const progressSpeed = progress?.bytesPerSecond || 0;

  const speedStr = progressSpeed > 1024 * 1024
    ? `${(progressSpeed / 1024 / 1024).toFixed(1)} ${t('unit.MB')}/s`
    : progressSpeed > 1024
    ? `${(progressSpeed / 1024).toFixed(1)} ${t('unit.KB')}/s`
    : `${progressSpeed} ${t('unit.B')}/s`;

  const sizeStr = (bytes: number) => {
    if (bytes > 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} ${t('unit.GB')}`;
    if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} ${t('unit.MB')}`;
    if (bytes > 1024) return `${(bytes / 1024).toFixed(1)} ${t('unit.KB')}`;
    return `${bytes} ${t('unit.B')}`;
  };

  return (
    <div className="page-container pt-14">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-6">
          <div>
<h1 className="text-2xl font-bold text-white">{t('updates.title')}</h1>
             <p className="text-surface-400 text-sm mt-1">{t('updates.subtitle')}</p>
          </div>
          <button
            className="btn-secondary text-sm"
            onClick={() => checkUpdates(true)}
            disabled={isLoading}
          >
            <RefreshCw className={`w-3.5 h-3.5 inline mr-1.5 ${isChecking ? 'animate-spin' : ''}`} />
            {isChecking ? t('updates.checking') : t('updates.check')}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="card p-5">
              <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <Package className="w-4 h-4 text-primary-400" />
                {t('updates.title')}
              </h2>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="p-3 rounded-lg bg-surface-800/50">
                    <p className="text-[11px] text-surface-400 uppercase tracking-wider mb-1">{t('updates.current')}</p>
                  <p className="text-lg font-bold text-white">{info?.currentVersion || t('updates.dash')}</p>
                </div>
                <div className="p-3 rounded-lg bg-surface-800/50">
                    <p className="text-[11px] text-surface-400 uppercase tracking-wider mb-1">{t('updates.latest')}</p>
                  <p className="text-lg font-bold text-white">{info?.latestVersion || t('updates.dash')}</p>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-surface-800/50 mb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {status === 'up_to_date' && (
                      <>
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                        <span className="text-sm text-emerald-400 font-medium">{t('updates.upToDate')}</span>
                      </>
                    )}
                    {status === 'available' && (
                      <>
                        <ArrowUp className="w-4 h-4 text-primary-400" />
                        <span className="text-sm text-primary-400 font-medium">
                          {t('updates.available', { current: info?.currentVersion || '—', latest: info?.latestVersion || '—' })}
                        </span>
                      </>
                    )}
                    {status === 'downloaded' && (
                      <>
                        <Download className="w-4 h-4 text-emerald-400" />
                        <span className="text-sm text-emerald-400 font-medium">{t('updates.installUpdate')}</span>
                      </>
                    )}
                    {status === 'downloading' && (
                      <span className="text-sm text-primary-400 font-medium">{t('updates.downloadUpdate')}</span>
                    )}
                    {status === 'installing' && (
                      <span className="text-sm text-amber-400 font-medium">{t('updates.installing')}</span>
                    )}
                    {status === 'error' && (
                      <>
                        <AlertCircle className="w-4 h-4 text-red-400" />
                        <span className="text-sm text-red-400 font-medium">{error || t('updates.installUpdate')}</span>
                      </>
                    )}
                    {status === 'idle' && (
                      <span className="text-sm text-surface-400">{t('updates.check')}</span>
                    )}
                  </div>
                  {info?.releaseUrl && status !== 'idle' && (
                    <a
                      href={info.releaseUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-primary-400 hover:text-primary-300"
                    >
                      {t('updates.viewOnGithub')}
                    </a>
                  )}
                </div>
              </div>

              {isDownloading && progress && (
                <div className="mb-4">
                  <div className="flex justify-between text-[11px] text-surface-400 mb-1">
                    <span>{sizeStr(progress.transferred)} / {sizeStr(progress.total)}</span>
                    <span>{speedStr}</span>
                  </div>
                  <div className="w-full h-1.5 bg-surface-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary-500 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, progressPct)}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-surface-500 mt-1">{progressPct}%</p>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {status === 'available' && (
                  <button
                    className="btn-primary text-xs"
                    onClick={downloadUpdate}
                    disabled={isLoading}
                  >
                    <Download className="w-3 h-3 inline mr-1" />
                    {isLoading ? t('updates.downloading') : t('updates.download')}
                  </button>
                )}
                {status === 'downloaded' && (
                  <button
                    className="btn-primary text-xs"
                    onClick={installUpdate}
                    disabled={isLoading}
                  >
                    <RotateCcw className="w-3 h-3 inline mr-1" />
                    {isInstalling ? t('updates.installing') : t('updates.installUpdate')}
                  </button>
                )}
                <button
                  className="btn-secondary text-xs"
                  onClick={() => checkUpdates(true)}
                  disabled={isLoading}
                >
                  <RefreshCw className={`w-3 h-3 inline mr-1 ${isChecking ? 'animate-spin' : ''}`} />
                  {t('updates.check')}
                </button>
              </div>
            </div>

            {info?.releaseNotes && (
              <div className="card p-5">
                <button
                  className="flex items-center justify-between w-full text-left"
                  onClick={() => setShowNotes(!showNotes)}
                >
                  <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                    <ChevronDown className="w-4 h-4 text-primary-400" />
                    {t('updates.changelog')}
                  </h2>
                  {showNotes ? <ChevronUp className="w-4 h-4 text-surface-400" /> : <ChevronDown className="w-4 h-4 text-surface-400" />}
                </button>
                {showNotes && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-3 text-[12px] text-surface-300 leading-relaxed whitespace-pre-wrap max-h-80 overflow-y-auto"
                  >
                    {info.releaseNotes}
                  </motion.div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="card p-5">
              <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-primary-400" />
                {t('updates.title')}
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="flex items-center justify-between cursor-pointer">
                    <div>
                      <p className="text-sm text-white">{t('updates.autoUpdate')}</p>
                      <p className="text-[11px] text-surface-400">{t('updates.autoUpdateDesc')}</p>
                    </div>
                    <button
                      className={`relative w-10 h-5 rounded-full transition-colors ${autoUpdate ? 'bg-primary-500' : 'bg-surface-600'}`}
                      onClick={() => setAutoUpdate(!autoUpdate)}
                    >
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${autoUpdate ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                  </label>
                </div>

                <div>
                  <label className="text-sm text-white block mb-2">{t('updates.updateChannel')}</label>
                  <div className="relative">
                    <button
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-surface-800 text-sm text-white border border-surface-700/50"
                      onClick={() => setChannelOpen(!channelOpen)}
                    >
                      <span className="capitalize">{channel}</span>
                      <ChevronDown className="w-3.5 h-3.5 text-surface-400" />
                    </button>
                    {channelOpen && (
                      <div className="absolute top-full mt-1 w-full rounded-lg bg-surface-800 border border-surface-700/50 shadow-xl z-10 overflow-hidden">
                        {(['stable', 'beta'] as const).map(c => (
                          <button
                            key={c}
                            className={`w-full px-3 py-2 text-xs text-left hover:bg-surface-700 transition-colors ${channel === c ? 'text-primary-400 bg-primary-500/10' : 'text-surface-300'}`}
                            onClick={() => { setChannel(c); setChannelOpen(false); }}
                          >
                            <span className="capitalize font-medium">{c}</span>
                            <p className="text-[10px] text-surface-500 mt-0.5">
                              {c === 'stable' ? t('updates.stableDesc') : t('updates.betaDesc')}
                            </p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="card p-5">
              <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <Cloud className="w-4 h-4 text-primary-400" />
                {t('updates.title')}
              </h2>
              <div className="text-[11px] text-surface-400 space-y-2">
                <p>{t('updates.security')}</p>
                <p>{t('updates.backupInfo')}</p>
                <p>{t('updates.rollbackInfo')}</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}