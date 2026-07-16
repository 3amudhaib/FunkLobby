import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Download, Clock, HardDrive, Image, ImageOff, RotateCcw } from 'lucide-react';
import { formatBytes, formatNumber, formatDate } from '../utils/format';
import { ModCover } from './ModCover';
import { useTranslation } from '../hooks/useTranslation';
import { getEngineBadge } from '../utils/engineBadges';

interface ModCardProps {
  mod: any;
  index?: number;
}

export function ModCard({ mod, index = 0 }: ModCardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [showCoverMenu, setShowCoverMenu] = useState(false);
  const [coverVersion, setCoverVersion] = useState(0);

  const handleSetCover = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowCoverMenu(false);
    await window.electronAPI.setCover(mod.id);
    setCoverVersion(v => v + 1);
  };

  const handleRemoveCover = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowCoverMenu(false);
    await window.electronAPI.removeCover(mod.id);
    setCoverVersion(v => v + 1);
  };

  return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: index * 0.05 }}
          className="card card-hover cursor-pointer group overflow-hidden"
          onClick={() => navigate(`/mod/${mod.id}`)}
        >
          <div className="relative aspect-[16/9] overflow-hidden">
            <ModCover
              modId={mod.id}
              coverPath={mod.coverPath}
              thumbnailUrl={mod.thumbnailUrl}
              title={mod.title}
            />
            <div className="absolute top-2 left-2 flex gap-1">
              {mod.isFeatured && (
                <span className="badge-primary text-[10px]">{t('modCard.featured')}</span>
              )}
              {mod.customCover && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  {t('modCard.custom')}
                </span>
              )}
            </div>
            {mod.isInstalled && (
              <span className="absolute top-2 right-2 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {t('modCard.installed')}
              </span>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
            <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="relative">
                <button
                  className="p-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-white text-xs transition-colors"
                  onClick={(e) => { e.stopPropagation(); setShowCoverMenu(!showCoverMenu); }}
                  title={t('modCard.coverOptions')}
                >
                  <Image className="w-3.5 h-3.5" />
                </button>
                {showCoverMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setShowCoverMenu(false); }} />
                    <div className="absolute right-0 top-full mt-1 w-40 glass rounded-xl border border-white/[0.06] shadow-xl z-20 py-1">
                      <button
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-surface-300 hover:bg-white/5 hover:text-white transition-colors"
                        onClick={handleSetCover}
                      >
                        <Image className="w-3.5 h-3.5" />
                        {t('modCard.changeCover')}
                      </button>
                      <button
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-surface-300 hover:bg-white/5 hover:text-white transition-colors"
                        onClick={handleRemoveCover}
                      >
                        <ImageOff className="w-3.5 h-3.5" />
                        {t('modCard.removeCover')}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="p-3">
            <h3 className="text-sm font-semibold text-white truncate group-hover:text-primary-300 transition-colors">
              {mod.title}
            </h3>
            <p className="text-xs text-surface-400 truncate mt-0.5">{mod.author}</p>

            <div className="flex items-center gap-3 mt-2 text-[11px] text-surface-400">
              {mod.downloadCount > 0 && (
                <span className="flex items-center gap-1">
                  <Download className="w-3 h-3" />
                  {formatNumber(mod.downloadCount)}
                </span>
              )}
              {mod.fileSize > 0 && (
               <span className="flex items-center gap-1">
                  <HardDrive className="w-3 h-3" />
                  {formatBytes(mod.fileSize)}
                </span>
              )}
              <span className="flex items-center gap-1 ml-auto">
                <Clock className="w-3 h-3" />
                {formatDate(mod.updatedAt)}
              </span>
            </div>

            <div className="flex items-center gap-1.5 mt-2">
              {(() => {
                const engines: Array<{ engineId: string; confidence: number }> = (() => {
                  try {
                    if (mod.detectedEngines) {
                      const p = JSON.parse(mod.detectedEngines);
                      if (Array.isArray(p) && p.length > 0) return p;
                    }
                  } catch {}
                  return [{ engineId: mod.engine, confidence: 1.0 }];
                })();
                return engines.map((e, i) => {
                  const badge = getEngineBadge(e.engineId);
                  return i === 0 ? (
                    <span key={e.engineId} className={`text-[10px] px-1.5 py-0.5 rounded border ${badge.bg} ${badge.color} ${badge.border}`}>{badge.label}</span>
                  ) : (
                    <span key={e.engineId} className="text-[10px] px-1.5 py-0.5 rounded border border-surface-600/30 text-surface-400 bg-surface-700/30">{badge.label}</span>
                  );
                });
              })()}
              {mod.category && mod.category !== 'Other' && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-700/50 text-surface-300 border border-surface-600/30">
                  {mod.category}
                </span>
              )}
            </div>
          </div>
        </motion.div>
  );
}
