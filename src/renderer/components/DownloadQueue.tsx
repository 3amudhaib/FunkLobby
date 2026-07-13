import { motion, AnimatePresence } from 'framer-motion';
import { X, Pause, Play, RotateCcw, Trash2, DownloadCloud } from 'lucide-react';
import { useDownloadStore } from '../stores/downloadStore';
import { formatBytes, formatSpeed, formatEta } from '../utils/format';
import { useTranslation } from '../hooks/useTranslation';

export function DownloadQueue() {
  const { t } = useTranslation();
  const { activeDownloads, isQueueVisible, setQueueVisible, pauseDownload, resumeDownload, cancelDownload, retryDownload } = useDownloadStore();
  const downloads = Array.from(activeDownloads.values());

  if (!isQueueVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed right-0 top-10 bottom-0 w-80 glass border-l border-white/[0.06] z-50 flex flex-col"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <DownloadCloud className="w-4 h-4 text-primary-400" />
            <span className="text-sm font-semibold text-white">{t('downloadQueue.title')}</span>
            <span className="text-[10px] text-surface-400 bg-surface-800 px-1.5 py-0.5 rounded-full">
              {downloads.length}
            </span>
          </div>
          <button
            className="p-1.5 hover:bg-white/5 rounded-lg transition-colors"
            onClick={() => setQueueVisible(false)}
          >
            <X className="w-3.5 h-3.5 text-surface-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {downloads.length === 0 ? (
            <div className="text-center py-8">
              <DownloadCloud className="w-8 h-8 text-surface-600 mx-auto mb-2" />
              <p className="text-xs text-surface-500">{t('downloadQueue.empty')}</p>
            </div>
          ) : (
            downloads.map((dl) => (
              <div key={dl.downloadId || dl.modId} className="card p-3">
                <div className="flex items-start justify-between mb-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-white truncate">{dl.fileName}</p>
                    <p className="text-[10px] text-surface-400 mt-0.5">
                      {dl.totalBytes > 0 || dl.downloadedBytes > 0
                        ? `${formatBytes(dl.downloadedBytes)} / ${formatBytes(dl.totalBytes)}`
                        : t('downloadQueue.starting')}
                    </p>
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ml-2 flex-shrink-0 ${
                    dl.status === 'downloading' ? 'bg-primary-500/20 text-primary-300' :
                    dl.status === 'paused' ? 'bg-yellow-500/20 text-yellow-300' :
                    dl.status === 'error' ? 'bg-red-500/20 text-red-300' :
                    dl.status === 'completed' ? 'bg-emerald-500/20 text-emerald-300' :
                    'bg-surface-700/50 text-surface-300'
                  }`}>
                    {dl.status}
                  </span>
                </div>

                <div className="progress-bar mb-2">
                  <div
                    className={`progress-bar-fill${!dl.totalBytes && dl.status === 'downloading' ? ' progress-bar-indeterminate' : ''}`}
                    style={{ width: dl.totalBytes ? `${dl.percent || 0}%` : dl.status === 'downloading' ? '100%' : '0%' }}
                  />
                </div>

                <div className="flex items-center justify-between text-[10px] text-surface-400">
                  <span>{formatSpeed(dl.speed)}</span>
                  <span>{t('downloadQueue.eta', { time: formatEta(dl.eta) })}</span>
                </div>

                <div className="flex items-center gap-1 mt-2">
                  {dl.status === 'downloading' && (
                    <button
                      className="p-1 hover:bg-white/5 rounded transition-colors"
                      onClick={() => pauseDownload(dl.downloadId)}
                    >
                      <Pause className="w-3 h-3 text-surface-400" />
                    </button>
                  )}
                  {dl.status === 'paused' && (
                    <button
                      className="p-1 hover:bg-white/5 rounded transition-colors"
                      onClick={() => resumeDownload(dl.downloadId)}
                    >
                      <Play className="w-3 h-3 text-surface-400" />
                    </button>
                  )}
                  {dl.status === 'error' && (
                    <button
                      className="p-1 hover:bg-white/5 rounded transition-colors"
                      onClick={() => retryDownload(dl.downloadId)}
                    >
                      <RotateCcw className="w-3 h-3 text-surface-400" />
                    </button>
                  )}
                  <button
                    className="p-1 hover:bg-red-500/20 rounded transition-colors ml-auto"
                    onClick={() => cancelDownload(dl.downloadId)}
                  >
                    <Trash2 className="w-3 h-3 text-red-400" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
