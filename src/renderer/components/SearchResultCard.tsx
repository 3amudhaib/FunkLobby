import { useState } from 'react';
import { motion } from 'framer-motion';
import { Download, ExternalLink, FolderOpen, Trash2, Loader2, Eye, ThumbsUp } from 'lucide-react';
import { ModCover } from './ModCover';
import { useModStore } from '../stores/modStore';
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
  };
  index: number;
  focused?: boolean;
}

export function SearchResultCard({ mod, index, focused }: SearchResultCardProps) {
  const { t } = useTranslation();
  const [installing, setInstalling] = useState(false);
  const [justInstalled, setJustInstalled] = useState(false);
  const { installMod, uninstallMod } = useModStore();

  const handleInstall = async () => {
    if (installing) return;
    setInstalling(true);
    try {
      const profiles = await window.electronAPI.getProfiles();
      const defaultProfile = profiles.find((p: any) => p.isDefault) || profiles[0];
      if (!defaultProfile) throw new Error('No profile found');
      await installMod(mod.id, defaultProfile.id);
      setJustInstalled(true);
      setTimeout(() => setJustInstalled(false), 2000);
    } catch (err: any) {
      alert(err?.message || 'Installation failed');
    }
    setInstalling(false);
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
            {(() => {
              const badge = getEngineBadge(mod.engine);
              return <span className={`text-[10px] px-1.5 py-0.5 rounded border ${badge.bg} ${badge.color} ${badge.border}`}>{badge.label}</span>;
            })()}
            {installed && <span className="badge-primary text-[10px] bg-emerald-500/20 text-emerald-400 border-emerald-500/30">{t('searchResult.installed')}</span>}
          </div>
        </div>

        {mod.description && (
          <p className="text-xs text-surface-500 mt-1.5 line-clamp-2">{mod.description}</p>
        )}

        <div className="flex items-center gap-3 mt-2 text-[11px] text-surface-500">
          {mod.downloadCount > 0 && (
            <span className="flex items-center gap-1"><Download className="w-3 h-3" />{formatCount(mod.downloadCount)}</span>
          )}
          {mod.viewCount > 0 && (
            <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{formatCount(mod.viewCount)}</span>
          )}
          {mod.likeCount > 0 && (
            <span className="flex items-center gap-1"><ThumbsUp className="w-3 h-3" />{formatCount(mod.likeCount)}</span>
          )}
          <span className="ml-auto">{formatDate(mod.updatedAt)}</span>
        </div>

        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          {!installed ? (
            <button
              className="btn-primary text-[11px] h-7 px-3"
              onClick={handleInstall}
              disabled={installing}
            >
              {installing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
              {installing ? t('searchResult.installing') : t('searchResult.install')}
            </button>
          ) : (
            <>
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
      </div>
    </motion.div>
  );
}
