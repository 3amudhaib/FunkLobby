import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Download, Heart, ExternalLink, Clock, ThumbsUp, Loader2, FolderOpen, Eye, MessageCircle, Play } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';
import { useModStore } from '../stores/modStore';
import { useEngineStore } from '../stores/engineStore';
import { getEngineBadge } from '../utils/engineBadges';
import { LazyImage } from './LazyImage';

interface DiscoverModCardProps {
  mod: {
    id: string;
    gameBananaId: number;
    title: string;
    author: string;
    version: string;
    engine: string;
    category: string;
    thumbnailUrl: string;
    sourceUrl: string;
    downloadCount: number;
    likeCount: number;
    fileSize: number;
    updatedAt: string;
    isInstalled: boolean;
    detectedEngines?: string;
  };
  index?: number;
}

interface InstallProgress {
  step: string;
  percent: number;
}

export function DiscoverModCard({ mod, index = 0 }: DiscoverModCardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { installMod } = useModStore();
  const { runningEngines, launchMod, engines } = useEngineStore();
  const [imgError, setImgError] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [justInstalled, setJustInstalled] = useState(false);
  const [isFav, setIsFav] = useState(false);
  const [gbStats, setGbStats] = useState<{ likeCount: number; viewCount: number; commentCount: number } | null>(null);
  const [installProgress, setInstallProgress] = useState<InstallProgress | null>(null);
  const progressCbRef = useRef<((data: InstallProgress) => void) | null>(null);

  useEffect(() => {
    if (mod.gameBananaId > 0) {
      window.electronAPI.getModStats(mod.gameBananaId).then((stats: any) => {
        if (stats) setGbStats(stats);
      }).catch(() => {});
    }
  }, [mod.gameBananaId]);

  // Parse detected engines list (fall back to primary engine if empty or invalid)
  const parsedEngines: Array<{ engineId: string; confidence: number }> = (() => {
    try {
      if (mod.detectedEngines) {
        const parsed = JSON.parse(mod.detectedEngines);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [{ engineId: mod.engine, confidence: 1.0 }];
  })();

  // Check if any compatible engine is currently running
  const isEngineRunning = parsedEngines.some((e: { engineId: string }) => runningEngines.has(e.engineId));

  const fallbackColor = `hsl(${(mod.title.length * 37) % 360}, 50%, 25%)`;

  const formatCount = (n: number) => {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return String(n);
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch { return ''; }
  };

  const handleInstall = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (installing) return;
    setInstalling(true);
    setInstallProgress({ step: 'Starting...', percent: 0 });

    // Listen for install progress
    const onProgress = (data: InstallProgress) => {
      setInstallProgress(data);
    };
    progressCbRef.current = onProgress;
    window.electronAPI.onModInstallProgress(onProgress);

    try {
      const profiles = await window.electronAPI.getProfiles();
      const defaultProfile = profiles.find((p: any) => p.isDefault) || profiles[0];
      if (!defaultProfile) throw new Error('No profile found');
      const result = await installMod(mod.id, defaultProfile.id);
      setJustInstalled(true);
      setInstallProgress(null);
    } catch (err: any) {
      setInstallProgress(null);
    }
    window.electronAPI.removeModInstallProgressListener(onProgress);
    progressCbRef.current = null;
    setInstalling(false);
  }, [mod.id, installing, installMod]);

  const handleLaunch = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    // Pick the best installed engine from detected engines
    const installedTypes = new Set(engines.filter(en => en.status === 'installed' || en.status === 'update_available').map(en => en.type));
    const bestEngine = parsedEngines.find(e => installedTypes.has(e.engineId));
    const primaryEngine = bestEngine?.engineId || parsedEngines[0]?.engineId || mod.engine;
    try {
      await launchMod(mod.id, primaryEngine);
    } catch {}
  }, [mod.id, mod.engine, parsedEngines, launchMod, engines]);

  const handleFavorite = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await window.electronAPI.favoriteMod(mod.id);
      setIsFav(!isFav);
    } catch {}
  }, [mod.id, isFav]);

  const handleDetails = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/gb/${mod.id}`);
  }, [mod.id, navigate]);

  const installed = mod.isInstalled || justInstalled;
  const engineBadge = getEngineBadge(mod.engine);

  const stats = gbStats || { likeCount: mod.likeCount, viewCount: 0, commentCount: 0 };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
      className="card overflow-hidden cursor-pointer group hover:ring-1 hover:ring-primary-500/30 transition-all"
      onClick={() => navigate(`/gb/${mod.id}`)}
    >
      <div className="relative aspect-[16/9] overflow-hidden bg-surface-800">
        {mod.thumbnailUrl && !imgError ? (
          <LazyImage
            src={mod.thumbnailUrl}
            alt={mod.title}
            className="w-full h-full group-hover:scale-105 transition-transform duration-300"
            fallback={
              <div
                className="w-full h-full flex items-center justify-center"
                style={{ backgroundColor: fallbackColor }}
              >
                <span className="text-2xl font-bold text-white/40">
                  {mod.title.charAt(0).toUpperCase()}
                </span>
              </div>
            }
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ backgroundColor: fallbackColor }}
          >
            <span className="text-2xl font-bold text-white/40">
              {mod.title.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        {installed && (
          <span className="absolute top-2 right-2 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            Installed
          </span>
        )}
        {installProgress && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-surface-700">
            <div
              className="h-full bg-primary-500 transition-all duration-300"
              style={{ width: `${installProgress.percent}%` }}
            />
          </div>
        )}
      </div>

      <div className="p-3 space-y-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-white truncate group-hover:text-primary-300 transition-colors">
            {mod.title}
          </h3>
          <p className="text-xs text-surface-400 truncate">{mod.author}</p>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {parsedEngines.map((e: { engineId: string; confidence: number }, i: number) => {
            const badge = getEngineBadge(e.engineId);
            return i === 0 ? (
              <span key={e.engineId} className={`text-[10px] px-1.5 py-0.5 rounded border ${badge.bg} ${badge.color} ${badge.border}`}>
                {badge.label}
              </span>
            ) : (
              <span key={e.engineId} className="text-[10px] px-1.5 py-0.5 rounded border border-surface-600/30 text-surface-400 bg-surface-700/30">
                {badge.label}
              </span>
            );
          })}
          {mod.category && mod.category !== 'Other' && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-700/50 text-surface-300 border border-surface-600/30">
              {mod.category}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-[11px] text-surface-400 pt-1 flex-wrap">
          {mod.downloadCount > 0 && (
            <span className="flex items-center gap-1"><Download className="w-3 h-3" />{formatCount(mod.downloadCount)}</span>
          )}
          {stats.likeCount > 0 && (
            <span className="flex items-center gap-1"><ThumbsUp className="w-3 h-3" />{formatCount(stats.likeCount)}</span>
          )}
          {stats.viewCount > 0 && (
            <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{formatCount(stats.viewCount)}</span>
          )}
          {stats.commentCount > 0 && (
            <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" />{formatCount(stats.commentCount)}</span>
          )}
          <span className="flex items-center gap-1 ml-auto text-surface-500">
            <Clock className="w-3 h-3" />
            {formatDate(mod.updatedAt)}
          </span>
        </div>

        <div className="flex items-center gap-1.5 pt-1">
          {!installed ? (
            <button
              className="btn-primary text-[10px] h-7 px-2.5 flex-1 flex items-center justify-center gap-1"
              onClick={handleInstall}
              disabled={installing || isEngineRunning}
              title={isEngineRunning ? 'Stop the engine first before installing' : undefined}
            >
              {installing ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Download className="w-3 h-3" />
              )}
              {installing && installProgress ? installProgress.step : installing ? '' : 'Install'}
            </button>
          ) : (
            <button
              className="btn-secondary text-[10px] h-7 px-2.5 flex-1 flex items-center justify-center gap-1"
              onClick={handleLaunch}
            >
              <Play className="w-3 h-3" /> Launch
            </button>
          )}
          <button
            className="btn-ghost text-[10px] h-7 w-7 p-0 flex items-center justify-center"
            onClick={handleDetails}
            title="Details"
          >
            <ExternalLink className="w-3 h-3" />
          </button>
          <button
            className={`btn-ghost text-[10px] h-7 w-7 p-0 flex items-center justify-center ${
              isFav ? 'text-red-400' : 'text-surface-400 hover:text-red-400'
            }`}
            onClick={handleFavorite}
            title="Favorite"
          >
            <Heart className={`w-3 h-3 ${isFav ? 'fill-red-400' : ''}`} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
