import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Gamepad2, ExternalLink, Github, RefreshCw, Terminal } from 'lucide-react';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { useTranslation } from '../hooks/useTranslation';

export function AboutPage() {
  const { t } = useTranslation();
  const [appInfo, setAppInfo] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [updateInfo, setUpdateInfo] = useState<any>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [showLogs, setShowLogs] = useState(false);

  const refreshLogs = async () => {
    const allLogs = await window.electronAPI.getLogs();
    setLogs(allLogs);
  };

  useEffect(() => {
    window.electronAPI.getAppInfo().then(setAppInfo);
    refreshLogs();
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
            <h1 className="text-2xl font-bold text-white">{t('app.name')}</h1>
            <p className="text-surface-400">{t('about.version', { version: appInfo.version })}</p>
          </div>
        </div>

        <div className="card p-6 mb-4">
          <h2 className="text-sm font-semibold text-white mb-3">{t('about.section')}</h2>
          <div className="space-y-2">
            <div className="flex justify-between text-sm"><span className="text-surface-400">{t('about.versionLabel')}</span><span className="text-white">{appInfo.version}</span></div>
            <div className="flex justify-between text-sm"><span className="text-surface-400">{t('about.electron')}</span><span className="text-white">{appInfo.electron}</span></div>
            <div className="flex justify-between text-sm"><span className="text-surface-400">{t('about.node')}</span><span className="text-white">{appInfo.node}</span></div>
            <div className="flex justify-between text-sm"><span className="text-surface-400">{t('about.chrome')}</span><span className="text-white">{appInfo.chrome}</span></div>
          </div>
        </div>

        <div className="card p-6 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-white">{t('about.checkUpdates')}</h2>
            <button
              className="btn-secondary text-xs flex items-center gap-1"
              onClick={handleCheckUpdate}
              disabled={checkingUpdate}
            >
              <RefreshCw className={`w-3 h-3 ${checkingUpdate ? 'animate-spin' : ''}`} />
              {t('about.checkUpdates')}
            </button>
          </div>
          {updateInfo && (
            <div className={`text-sm p-3 rounded-lg ${updateInfo.hasUpdate ? 'bg-primary-500/10 text-primary-300' : 'bg-emerald-500/10 text-emerald-300'}`}>
              {updateInfo.hasUpdate
                ? t('about.updateAvailable', { version: updateInfo.latestVersion })
                : t('about.upToDate')}
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
            {t('about.repository')}
            <ExternalLink className="w-3 h-3" />
          </a>
          <button
            className="btn-ghost text-sm flex items-center gap-2"
            onClick={() => setShowLogs(!showLogs)}
          >
            <Terminal className="w-4 h-4" />
            {t('about.logs', { action: showLogs ? t('about.close') : t('about.open'), count: logs.length })}
          </button>
        </div>

        {showLogs && (
          <div className="card p-4 max-h-80 overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-surface-400">{t('about.errorLogs')}</h3>
              <button
                className="text-[10px] text-primary-300 hover:text-primary-200"
                onClick={refreshLogs}
              >
                تحديث
              </button>
            </div>
            {logs.length === 0 ? (
              <p className="text-xs text-surface-500">{t('about.noLogs')}</p>
            ) : (
              <div className="space-y-2">
                {logs.slice(0, 100).map((log: any) => {
                  const details = typeof log.details === 'string'
                    ? (() => {
                        try { return JSON.parse(log.details); } catch { return log.details; }
                      })()
                    : log.details;
                  const detailsText = typeof details === 'string' ? details : JSON.stringify(details, null, 2);

                  return (
                    <div key={log.id} className="rounded-md border border-surface-800 bg-surface-950/60 p-2 text-[10px] font-mono">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`rounded px-1.5 py-0.5 ${log.level === 'error' ? 'bg-red-500/20 text-red-300' : log.level === 'warn' ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                          {log.level}
                        </span>
                        <span className="text-surface-400">{(() => { try { const d = new Date(log.createdAt); return isNaN(d.getTime()) ? 'Unknown time' : d.toLocaleString(); } catch { return 'Unknown time'; } })()}</span>
                      </div>
                      <div className="text-surface-200 mt-1">{log.message}</div>
                      {detailsText && (
                        <pre className="mt-1 whitespace-pre-wrap break-all text-[9px] text-surface-500">{detailsText}</pre>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
