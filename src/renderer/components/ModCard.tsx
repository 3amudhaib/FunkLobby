import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Download, Clock, HardDrive, Trash2, Heart, Play } from 'lucide-react';
import { formatBytes, formatNumber, formatDate } from '../utils/format';
import * as ContextMenu from '@radix-ui/react-context-menu';

interface ModCardProps {
  mod: any;
  index?: number;
}

export function ModCard({ mod, index = 0 }: ModCardProps) {
  const navigate = useNavigate();

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: index * 0.05 }}
          className="card card-hover cursor-pointer group overflow-hidden"
          onClick={() => navigate(`/mod/${mod.id}`)}
        >
          <div className="relative aspect-[16/9] overflow-hidden">
            {mod.thumbnailUrl ? (
              <img
                src={mod.thumbnailUrl}
                alt={mod.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary-900/50 to-surface-800 flex items-center justify-center">
                <HardDrive className="w-8 h-8 text-surface-600" />
              </div>
            )}
            {mod.isFeatured && (
              <span className="absolute top-2 left-2 badge-primary text-[10px]">Featured</span>
            )}
            {mod.isInstalled && (
              <span className="absolute top-2 right-2 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Installed
              </span>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
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
              {mod.engine && (
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
          </div>
        </motion.div>
      </ContextMenu.Trigger>

      <ContextMenu.Portal>
        <ContextMenu.Content className="min-w-[160px] bg-surface-900 border border-surface-700/50 rounded-lg p-1 shadow-xl animate-in fade-in zoom-in duration-200 z-50">
          <ContextMenu.Item className="flex items-center gap-2 px-2 py-1.5 text-sm text-surface-200 hover:bg-primary-500/20 hover:text-white rounded cursor-pointer outline-none transition-colors" onClick={() => navigate(`/mod/${mod.id}`)}>
            <Play className="w-4 h-4" /> View Details
          </ContextMenu.Item>
          {mod.isInstalled && (
            <ContextMenu.Item className="flex items-center gap-2 px-2 py-1.5 text-sm text-red-400 hover:bg-red-500/20 hover:text-red-300 rounded cursor-pointer outline-none transition-colors">
              <Trash2 className="w-4 h-4" /> Uninstall
            </ContextMenu.Item>
          )}
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
