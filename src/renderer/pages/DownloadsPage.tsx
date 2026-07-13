import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { DownloadCloud, Pause, Play, RotateCcw, Trash2 } from 'lucide-react';
import { useDownloadStore } from '../stores/downloadStore';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import { formatBytes, formatSpeed, formatEta } from '../utils/format';
import { useTranslation } from '../hooks/useTranslation';

export function DownloadsPage() {
  const { t } = useTranslation();
  const { queue, fetchQueue, pauseDownload, resumeDownload, cancelDownload, retryDownload, activeDownloads } = useDownloadStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchQueue().finally(() => setLoading(false));
  }, []);

  const statusLabel = (status: string) => {
    const labels: Record<string, string> = {
      completed: t('downloads.completed'),
      downloading: t('downloads.downloading'),
      paused: t('downloads.paused'),
      error: t('downloads.failed'),
      verifying: t('downloads.downloading'),
      queued: t('downloads.inQueue'),
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-emerald-400 bg-emerald-500/10';
      case 'downloading': return 'text-primary-400 bg-primary-500/10';
      case 'paused': return 'text-yellow-400 bg-yellow-500/10';
      case 'error': return 'text-red-400 bg-red-500/10';
      case 'verifying': return 'text-purple-400 bg-purple-500/10';
      default: return 'text-surface-400 bg-surface-700/30';
    }
  };

  function mergeProgress(dl: any) {
    const live = activeDownloads.get(dl.id) || activeDownloads.get(dl.modId);
    if (!live) {
      return dl;
    }
    return {
      ...dl,
      status: live.status ?? dl.status,
      downloadedBytes: live.downloadedBytes ?? dl.downloadedBytes,
      totalBytes: live.totalBytes ?? dl.totalBytes,
      speed: live.speed ?? dl.speed,
      eta: live.eta ?? dl.eta,
      percent: live.percent,
    };
  }

  if (loading) return <div className="page-container pt-14"><LoadingSpinner className="mt-20" /></div>;

  return (
    <div className="page-container pt-14">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">{t('downloads.title')}</h1>
            <p className="text-surface-400 text-sm mt-1">{t('downloads.subtitle', { count: queue.length, plural: queue.length !== 1 ? 's' : '' })}</p>
          </div>
        </div>

        {queue.length === 0 ? (
          <EmptyState
            icon={DownloadCloud}
            title={t('downloads.title')}
            description={t('downloads.emptyHint')}
          />
        ) : (
          <div className="space-y-2">
            {queue.map((dl, i) => {
              const item = mergeProgress(dl);
              const isActive = item.status === 'downloading' || item.status === 'verifying';
              const isPending = item.status === 'pending';
              const knownSize = item.totalBytes > 0;
              const progressPercent = item.percent ?? (knownSize ? Math.round((item.downloadedBytes / item.totalBytes) * 100) : 0);
              const showSpeed = isActive && item.speed > 0;
              const showEta = isActive && item.eta > 0;

              return (
                <motion.div
                  key={dl.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
                  className="card p-4"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-white truncate">{dl.fileName}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${getStatusColor(item.status)}`}>
                          {statusLabel(item.status)}
                        </span>
                        <span className="text-[11px] text-surface-400">
                          {knownSize || item.downloadedBytes > 0
                            ? `${formatBytes(item.downloadedBytes)} / ${formatBytes(item.totalBytes)}`
                            : t('downloads.starting')}
                        </span>
                        {isActive && knownSize && (
                          <span className="text-[11px] text-primary-400 font-medium">
                            {progressPercent}%
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      {item.status === 'downloading' && (
                        <button className="p-1.5 hover:bg-white/5 rounded-lg" onClick={() => pauseDownload(dl.id)} title={t('downloads.pause')}>
                          <Pause className="w-3.5 h-3.5 text-surface-400" />
                        </button>
                      )}
                      {item.status === 'paused' && (
                        <button className="p-1.5 hover:bg-white/5 rounded-lg" onClick={() => resumeDownload(dl.id)} title={t('downloads.resume')}>
                          <Play className="w-3.5 h-3.5 text-surface-400" />
                        </button>
                      )}
                      {item.status === 'error' && (
                        <button className="p-1.5 hover:bg-white/5 rounded-lg" onClick={() => retryDownload(dl.id)} title={t('downloads.retry')}>
                          <RotateCcw className="w-3.5 h-3.5 text-surface-400" />
                        </button>
                      )}
                      <button className="p-1.5 hover:bg-red-500/20 rounded-lg" onClick={() => cancelDownload(dl.id)} title={t('downloads.cancel')}>
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      </button>
                    </div>
                  </div>

                  <div className="progress-bar">
                    <div
                      className={`progress-bar-fill${!knownSize && isActive ? ' progress-bar-indeterminate' : ''}`}
                      style={{ width: knownSize ? `${progressPercent}%` : isActive ? '100%' : '0%' }}
                    />
                  </div>

                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[10px] text-surface-500">
                      {showSpeed ? formatSpeed(item.speed) : isPending ? t('downloads.waitingForSlot') : ''}
                    </span>
                    <span className="text-[10px] text-surface-500">
                      {showEta ? t('downloads.eta', { time: formatEta(item.eta) }) : ''}
                    </span>
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
