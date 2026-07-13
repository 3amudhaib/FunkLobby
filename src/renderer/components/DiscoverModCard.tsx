import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Download, Heart, ExternalLink, Clock, ThumbsUp, Loader2, FolderOpen } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';
import { useModStore } from '../stores/modStore';

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
  };
  index?: number;
}

export function DiscoverModCard({ mod, index = 0 }: DiscoverModCardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { installMod } = useModStore();
  const [imgError, setImgError] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [justInstalled, setJustInstalled] = useState(false);
  const [isFav, setIsFav] = useState(false);

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
    try {
      const profiles = await window.electronAPI.getProfiles();
      const defaultProfile = profiles.find((p: any) => p.isDefault) || profiles[0];
      if (!defaultProfile) throw new Error('No profile found');
      await installMod(mod.id, defaultProfile.id);
      setJustInstalled(true);
    } catch (err: any) {
      alert(err?.message || 'Installation failed');
    }
    setInstalling(false);
  }, [mod.id, installing, installMod]);

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

  const engineBadge = (() => {
    const e = mod.engine?.toLowerCase() || '';
    if (e === 'unknown' || !e) return null;
    return e;
  })();

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
          <img
            src={mod.thumbnailUrl}
            alt={mod.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
            onError={() => setImgError(true)}
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
      </div>

      <div className="p-3 space-y-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-white truncate group-hover:text-primary-300 transition-colors">
            {mod.title}
          </h3>
          <p className="text-xs text-surface-400 truncate">{mod.author}</p>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {engineBadge && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary-500/10 text-primary-300 border border-primary-500/20">
              {mod.engine}
            </span>
          )}
          {mod.category && mod.category !== 'Other' && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-700/50 text-surface-300 border border-surface-600/30">
              {mod.category}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-[11px] text-surface-400 pt-1">
          {mod.downloadCount > 0 && (
            <span className="flex items-center gap-1"><Download className="w-3 h-3" />{formatCount(mod.downloadCount)}</span>
          )}
          {mod.likeCount > 0 && (
            <span className="flex items-center gap-1"><ThumbsUp className="w-3 h-3" />{formatCount(mod.likeCount)}</span>
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
              disabled={installing}
            >
              {installing ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Download className="w-3 h-3" />
              )}
              {installing ? '' : 'Install'}
            </button>
          ) : (
            <button
              className="btn-secondary text-[10px] h-7 px-2.5 flex-1 flex items-center justify-center gap-1"
              onClick={handleDetails}
            >
              <FolderOpen className="w-3 h-3" /> Open
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
