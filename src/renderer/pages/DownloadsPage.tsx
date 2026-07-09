import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { DownloadCloud, Pause, Play, RotateCcw, Trash2 } from 'lucide-react';
import { useDownloadStore } from '../stores/downloadStore';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import { formatBytes, formatSpeed, formatEta } from '../utils/format';

export function DownloadsPage() {
  const { queue, fetchQueue, pauseDownload, resumeDownload, cancelDownload, retryDownload, activeDownloads } = useDownloadStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchQueue().finally(() => setLoading(false));
  }, []);

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

  if (loading) return <div className="page-container pt-14"><LoadingSpinner className="mt-20" /></div>;

  return (
    <div className="page-container pt-14">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Downloads</h1>
            <p className="text-surface-400 text-sm mt-1">{queue.length} items in history</p>
          </div>
        </div>

        {queue.length === 0 ? (
          <EmptyState
            icon={DownloadCloud}
            title="No downloads yet"
            description="Downloads will appear here when you download mods."
          />
        ) : (
          <div className="space-y-2">
            {queue.map((dl, i) => (
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
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${getStatusColor(dl.status)}`}>
                        {dl.status.charAt(0).toUpperCase() + dl.status.slice(1)}
                      </span>
                      <span className="text-[11px] text-surface-400">
                        {formatBytes(dl.downloadedBytes)} / {formatBytes(dl.totalBytes)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    {dl.status === 'downloading' && (
                      <button className="p-1.5 hover:bg-white/5 rounded-lg" onClick={() => pauseDownload(dl.id)} title="Pause">
                        <Pause className="w-3.5 h-3.5 text-surface-400" />
                      </button>
                    )}
                    {dl.status === 'paused' && (
                      <button className="p-1.5 hover:bg-white/5 rounded-lg" onClick={() => resumeDownload(dl.id)} title="Resume">
                        <Play className="w-3.5 h-3.5 text-surface-400" />
                      </button>
                    )}
                    {dl.status === 'error' && (
                      <button className="p-1.5 hover:bg-white/5 rounded-lg" onClick={() => retryDownload(dl.id)} title="Retry">
                        <RotateCcw className="w-3.5 h-3.5 text-surface-400" />
                      </button>
                    )}
                    <button className="p-1.5 hover:bg-red-500/20 rounded-lg" onClick={() => cancelDownload(dl.id)} title="Cancel">
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    </button>
                  </div>
                </div>

                <div className="progress-bar">
                  <div
                    className="progress-bar-fill"
                    style={{ width: `${dl.totalBytes > 0 ? (dl.downloadedBytes / dl.totalBytes * 100) : 0}%` }}
                  />
                </div>

                <div className="flex items-center justify-between mt-2">
                  <span className="text-[10px] text-surface-500">{formatSpeed(dl.speed)}</span>
                  <span className="text-[10px] text-surface-500">ETA: {formatEta(dl.eta)}</span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
