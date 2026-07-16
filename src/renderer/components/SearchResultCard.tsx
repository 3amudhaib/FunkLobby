import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Download, ExternalLink, FolderOpen, Trash2, Loader2, Eye, ThumbsUp, MessageCircle, Play } from 'lucide-react';
import { ModCover } from './ModCover';
import { useModStore } from '../stores/modStore';
import { useEngineStore } from '../stores/engineStore';
import { useTranslation } from '../hooks/useTranslation';
import { getEngineBadge } from '../utils/engineBadges';

interface SearchResultCardProps {
  mod: {
    id: string;
    gameBananaId: number;
    title: string;
    author: string;
    description: string;
    engine: string;
    category: string;
    thumbnailUrl: string;
    sourceUrl: string;
    downloadCount: number;
    viewCount: number;
    likeCount: number;
    updatedAt: string;
    isInstalled: boolean;
    detectedEngines?: string;
  };
  index: number;
  focused?: boolean;
}

export function SearchResultCard({ mod, index, focused }: SearchResultCardProps) {
  const { t } = useTranslation();
  const [installing, setInstalling] = useState(false);
  const [justInstalled, setJustInstalled] = useState(false);
  const [gbStats, setGbStats] = useState<{ likeCount: number; viewCount: number; commentCount: number } | null>(null);
  const [installProgress, setInstallProgress] = useState<{ step: string; percent: number } | null>(null);
  const progressCbRef = useRef<((data: any) => void) | null>(null);
  const { installMod, uninstallMod } = useModStore();
  const { runningEngines, launchMod, engines } = useEngineStore();

  const parsedEngines: Array<{ engineId: string; confidence: number }> = (() => {
    try {
      if (mod.detectedEngines) {
        const parsed = JSON.parse(mod.detectedEngines);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [{ engineId: mod.engine, confidence: 1.0 }];
  })();

  const isEngineRunning = parsedEngines.some((e: { engineId: string }) => runningEngines.has(e.engineId));

  useEffect(() => {
    if (mod.gameBananaId > 0) {
      window.electronAPI.getModStats(mod.gameBananaId).then((stats: any) => {
        if (stats) setGbStats(stats);
      }).catch(() => {});
    }
  }, [mod.gameBananaId]);

  const handleInstall = async () => {
    if (installing) return;
    setInstalling(true);
    setInstallProgress({ step: 'Starting...', percent: 0 });

    const onProgress = (data: any) => setInstallProgress(data);
    progressCbRef.current = onProgress;
    window.electronAPI.onModInstallProgress(onProgress);

    try {
      const profiles = await window.electronAPI.getProfiles();
      const defaultProfile = profiles.find((p: any) => p.isDefault) || profiles[0];
      if (!defaultProfile) throw new Error('No profile found');
      await installMod(mod.id, defaultProfile.id);
      setJustInstalled(true);
      setInstallProgress(null);
    } catch (err: any) {
      setInstallProgress(null);
    }
    window.electronAPI.removeModInstallProgressListener(onProgress);
    progressCbRef.current = null;
    setInstalling(false);
  };

  const handleLaunch = async () => {
    const installedTypes = new Set(engines.filter(en => en.status === 'installed' || en.status === 'update_available').map(en => en.type));
    const bestEngine = parsedEngines.find(e => installedTypes.has(e.engineId));
    const primaryEngine = bestEngine?.engineId || parsedEngines[0]?.engineId || mod.engine;
    try {
      await launchMod(mod.id, primaryEngine);
    } catch {}
  };

  const handleUninstall = async () => {
    try {
      await uninstallMod(mod.id);
    } catch (err: any) {
      console.error('Uninstall failed:', err);
    }
  };

  const handleOpenFolder = async () => {
    try {
      await window.electronAPI.openModFolder(mod.id);
    } catch { /* ignore */ }
  };

  const handleOpenGameBanana = () => {
    if (mod.sourceUrl) {
      window.open(mod.sourceUrl, '_blank');
    }
  };

  const formatCount = (n: number) => {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + t('format.million');
    if (n >= 1_000) return (n / 1_000).toFixed(1) + t('format.thousand');
    return String(n);
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return t('format.unknown');
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch { return t('format.unknown'); }
  };

  const installed = mod.isInstalled || justInstalled;
  const fallbackColor = `hsl(${(mod.title.length * 37) % 360}, 50%, 30%)`;

  const stats = gbStats || { likeCount: mod.likeCount, viewCount: mod.viewCount, commentCount: 0 };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.025, 0.3) }}
      className={`card p-3 flex items-start gap-3 transition-colors ${
        focused ? 'ring-2 ring-primary-500/50 bg-surface-800/70' : 'hover:bg-surface-800/40'
      }`}
    >
      <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-surface-800">
        <ModCover
          modId={mod.id}
          coverPath={(mod as any).coverPath}
          thumbnailUrl={mod.thumbnailUrl}
          title={mod.title}
          fallback="letter"
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm font-medium text-white truncate">{mod.title}</h3>
            <p className="text-xs text-surface-400 truncate">{mod.author}</p>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            {parsedEngines.map((e: { engineId: string; confidence: number }, i: number) => {
              const badge = getEngineBadge(e.engineId);
              return i === 0 ? (
                <span key={e.engineId} className={`text-[10px] px-1.5 py-0.5 rounded border ${badge.bg} ${badge.color} ${badge.border}`}>{badge.label}</span>
              ) : (
                <span key={e.engineId} className="text-[10px] px-1.5 py-0.5 rounded border border-surface-600/30 text-surface-400 bg-surface-700/30">{badge.label}</span>
              );
            })}
            {installed && <span className="badge-primary text-[10px] bg-emerald-500/20 text-emerald-400 border-emerald-500/30">{t('searchResult.installed')}</span>}
          </div>
        </div>

        {mod.description && (
          <p className="text-xs text-surface-500 mt-1.5 line-clamp-2">{mod.description}</p>
        )}

        <div className="flex items-center gap-3 mt-2 text-[11px] text-surface-500 flex-wrap">
          {mod.downloadCount > 0 && (
            <span className="flex items-center gap-1"><Download className="w-3 h-3" />{formatCount(mod.downloadCount)}</span>
          )}
          {stats.viewCount > 0 && (
            <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{formatCount(stats.viewCount)}</span>
          )}
          {stats.likeCount > 0 && (
            <span className="flex items-center gap-1"><ThumbsUp className="w-3 h-3" />{formatCount(stats.likeCount)}</span>
          )}
          {stats.commentCount > 0 && (
            <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" />{formatCount(stats.commentCount)}</span>
          )}
          <span className="ml-auto">{formatDate(mod.updatedAt)}</span>
        </div>

        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          {!installed ? (
            <button
              className="btn-primary text-[11px] h-7 px-3"
              onClick={handleInstall}
              disabled={installing || isEngineRunning}
              title={isEngineRunning ? 'Stop the engine first before installing' : undefined}
            >
              {installing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
              {installing && installProgress ? installProgress.step : installing ? t('searchResult.installing') : t('searchResult.install')}
            </button>
          ) : (
            <>
              <button className="btn-primary text-[11px] h-7 px-3" onClick={handleLaunch}>
                <Play className="w-3 h-3" /> Launch
              </button>
              <button className="btn-secondary text-[11px] h-7 px-3" onClick={handleOpenFolder}>
                <FolderOpen className="w-3 h-3" /> {t('searchResult.open')}
              </button>
              <button className="btn-secondary text-[11px] h-7 px-3" onClick={handleUninstall}>
                <Trash2 className="w-3 h-3" /> {t('searchResult.uninstall')}
              </button>
            </>
          )}
          <button
            className="btn-ghost text-[11px] h-7 px-2 text-surface-400 hover:text-white"
            onClick={handleOpenGameBanana}
            title={t('searchResult.viewOnGB')}
          >
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>
        {installProgress && (
          <div className="mt-2 h-1 bg-surface-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-500 transition-all duration-300 rounded-full"
              style={{ width: `${installProgress.percent}%` }}
            />
          </div>
        )}
      </div>
    </motion.div>
  );
}
