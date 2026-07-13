import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FolderOpen, Loader2, Check, X, Image } from 'lucide-react';

import { GlassDialog } from './GlassDialog';
import { useModStore } from '../stores/modStore';
import { useTranslation } from '../hooks/useTranslation';

interface ImportLocalModModalProps {
  open: boolean;
  onClose: () => void;
}
export function ImportLocalModModal({ open, onClose }: ImportLocalModModalProps) {
  const { t } = useTranslation();
  const { fetchLibrary } = useModStore();
  const [step, setStep] = useState<'select' | 'configure' | 'saving' | 'done'>('select');
  const [folderPath, setFolderPath] = useState('');
  const [folderName, setFolderName] = useState('');
  const [modName, setModName] = useState('');
  const [coverPath, setCoverPath] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setStep('select');
      setFolderPath('');
      setFolderName('');
      setModName('');
      setCoverPath('');
      setError('');

      selectFolder();
    }
  }, [open]);

  const selectFolder = async () => {
    try {
      setStep('select');
      const result = await window.electronAPI.selectLocalModFolder();
      if (result.canceled) {
        onClose();
        return;
      }
      setFolderPath(result.folderPath);
      setFolderName(result.folderName);
      setModName(result.folderName);
      setStep('configure');
    } catch {
      setError(t('importLocalMod.failed'));
      onClose();
    }
  };

  const selectCover = async () => {
    const result = await window.electronAPI.selectFile([{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]);
    if (!result.canceled && result.path) {
      setCoverPath(result.path);
    }
  };

  const handleSave = async () => {
    if (!modName.trim()) { setError(t('importLocalMod.nameRequired')); return; }
    setError('');
    setStep('saving');
    try {
      const savedMod = await window.electronAPI.saveLocalMod({
        name: modName.trim(),
        sourceFolder: folderPath,
      });
      if (coverPath) {
        try { await window.electronAPI.setCover(savedMod.id); } catch {}
      }
      await fetchLibrary();
      setStep('done');
    } catch (err: any) {
      setError(err.message || t('importLocalMod.failed'));
      setStep('configure');
    }
  };

  return (
    <GlassDialog open={open} onClose={onClose} title={t('importLocalMod.title')} maxWidth="max-w-md">
      {step === 'select' && (
        <div className="flex flex-col items-center py-8 gap-3">
          <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
          <p className="text-surface-400 text-sm">{t('importLocalMod.selecting')}</p>
        </div>
      )}

      {step === 'configure' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-800/50 border border-surface-700/30">
            <FolderOpen className="w-5 h-5 text-primary-400 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-white truncate">{folderName}</p>
              <p className="text-xs text-surface-500 truncate">{folderPath}</p>
            </div>
          </div>

          <div>
            <label className="text-xs text-surface-400 mb-1.5 block">{t('importLocalMod.modName')}</label>
            <input
              className="input text-sm w-full"
              value={modName}
              onChange={(e) => setModName(e.target.value)}
              placeholder={t('importLocalMod.namePlaceholder')}
            />
          </div>

          <div>
            <label className="text-xs text-surface-400 mb-1.5 block">{t('importLocalMod.coverImage')}</label>
            <button className="btn-secondary text-sm w-full flex items-center justify-center gap-2" onClick={selectCover}>
              <Image className="w-4 h-4" />
              {coverPath ? t('importLocalMod.changeCover') : t('importLocalMod.selectCover')}
            </button>
            {coverPath && (
              <p className="text-xs text-surface-500 mt-1 truncate">{coverPath}</p>
            )}
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <div className="flex gap-2 pt-2">
            <button className="btn-secondary flex-1 text-sm" onClick={onClose}>{t('importLocalMod.cancel')}</button>
            <button className="btn-primary flex-1 text-sm" onClick={handleSave}>
              <Check className="w-4 h-4" />
              {t('importLocalMod.addToLibrary')}
            </button>
          </div>
        </div>
      )}

      {step === 'saving' && (
        <div className="flex flex-col items-center py-8 gap-3">
          <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
          <p className="text-surface-400 text-sm">{t('importLocalMod.saving')}</p>
        </div>
      )}

      {step === 'done' && (
        <div className="flex flex-col items-center py-8 gap-3">
          <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <Check className="w-6 h-6 text-emerald-400" />
          </div>
          <p className="text-white font-medium">{t('importLocalMod.success')}</p>
          <p className="text-surface-400 text-sm text-center">{t('importLocalMod.successDesc', { name: modName })}</p>
          <button className="btn-primary text-sm mt-2" onClick={onClose}>{t('importLocalMod.done')}</button>
        </div>
      )}
    </GlassDialog>
  );
}
