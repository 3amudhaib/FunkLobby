import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Gamepad2, ExternalLink, Github, RefreshCw, Terminal } from 'lucide-react';
import { LoadingSpinner } from '../components/LoadingSpinner';

export function AboutPage() {
  const [appInfo, setAppInfo] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [updateInfo, setUpdateInfo] = useState<any>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [showLogs, setShowLogs] = useState(false);

  useEffect(() => {
    window.electronAPI.getAppInfo().then(setAppInfo);
    window.electronAPI.getLogs('error').then(setLogs);
  }, []);

  const handleCheckUpdate = async () => {
    setCheckingUpdate(true);
    const info = await window.electronAPI.checkUpdates();
    setUpdateInfo(info);
    setCheckingUpdate(false);
  };

  if (!appInfo) return <div className="page-container pt-14"><LoadingSpinner className="mt-20" /></div>;

  return (
    <div className="page-container pt-14">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center">
            <Gamepad2 className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">FunkLobby</h1>
            <p className="text-surface-400">v{appInfo.version}</p>
          </div>
        </div>

        <div className="card p-6 mb-4">
          <h2 className="text-sm font-semibold text-white mb-3">Application Info</h2>
          <div className="space-y-2">
            <div className="flex justify-between text-sm"><span className="text-surface-400">Version</span><span className="text-white">{appInfo.version}</span></div>
            <div className="flex justify-between text-sm"><span className="text-surface-400">Electron</span><span className="text-white">{appInfo.electron}</span></div>
            <div className="flex justify-between text-sm"><span className="text-surface-400">Node.js</span><span className="text-white">{appInfo.node}</span></div>
            <div className="flex justify-between text-sm"><span className="text-surface-400">Chrome</span><span className="text-white">{appInfo.chrome}</span></div>
          </div>
        </div>

        <div className="card p-6 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-white">Updates</h2>
            <button
              className="btn-secondary text-xs flex items-center gap-1"
              onClick={handleCheckUpdate}
              disabled={checkingUpdate}
            >
              <RefreshCw className={`w-3 h-3 ${checkingUpdate ? 'animate-spin' : ''}`} />
              Check for Updates
            </button>
          </div>
          {updateInfo && (
            <div className={`text-sm p-3 rounded-lg ${updateInfo.hasUpdate ? 'bg-primary-500/10 text-primary-300' : 'bg-emerald-500/10 text-emerald-300'}`}>
              {updateInfo.hasUpdate
                ? `Update available: v${updateInfo.latestVersion}`
                : 'You are on the latest version'}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 mb-6">
          <a
            href={appInfo.repo}
            className="btn-secondary text-sm flex items-center gap-2"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Github className="w-4 h-4" />
            GitHub
            <ExternalLink className="w-3 h-3" />
          </a>
          <button
            className="btn-ghost text-sm flex items-center gap-2"
            onClick={() => setShowLogs(!showLogs)}
          >
            <Terminal className="w-4 h-4" />
            {showLogs ? 'Hide Logs' : 'Show Logs'} ({logs.length})
          </button>
        </div>

        {showLogs && (
          <div className="card p-4 max-h-64 overflow-y-auto">
            <h3 className="text-xs font-semibold text-surface-400 mb-2">Error Logs</h3>
            {logs.length === 0 ? (
              <p className="text-xs text-surface-500">No error logs</p>
            ) : (
              <div className="space-y-1">
                {logs.slice(0, 50).map((log: any) => (
                  <div key={log.id} className="text-[10px] font-mono">
                    <span className="text-red-400">[ERROR]</span>
                    <span className="text-surface-400 ml-1">{new Date(log.createdAt).toLocaleString()}</span>
                    <span className="text-surface-300 ml-1">{log.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
