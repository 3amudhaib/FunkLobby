import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Check, AlertTriangle, HardDrive } from 'lucide-react';
import { GlassDialog } from './GlassDialog';
import { useTranslation } from '../hooks/useTranslation';

interface InstallEngineOption {
  id: string;
  type: string;
  name: string;
  installPath: string;
}

interface InstallToEngineDialogProps {
  open: boolean;
  onClose: () => void;
  modId: string;
  modTitle: string;
}

type OverwriteChoice = 'replace' | 'keep-both' | 'cancel';

export function InstallToEngineDialog({ open, onClose, modId, modTitle }: InstallToEngineDialogProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<'loading' | 'select' | 'installing' | 'done' | 'overwrite'>('loading');
  const [engines, setEngines] = useState<InstallEngineOption[]>([]);
  const [selectedEngineId, setSelectedEngineId] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ targetPath: string; renamed: boolean } | null>(null);
  const [overwriteTarget, setOverwriteTarget] = useState<string>('');
  const [overwritePendingEngineId, setOverwritePendingEngineId] = useState('');

  useEffect(() => {
    if (open) {
      setStep('loading');
      setSelectedEngineId('');
      setError('');
      setResult(null);
      loadEngines();
    }
  }, [open]);

  const loadEngines = async () => {
    try {
      const list = await window.electronAPI.getInstalledEngines();
      setEngines(list);
      if (list.length > 0) {
        setSelectedEngineId(list[0].id);
      }
      setStep('select');
    } catch (err: any) {
      setError(err.message || 'Failed to load engines');
      setStep('select');
    }
  };

  const handleInstall = async (engineId: string) => {
    setStep('installing');
    setError('');
    try {
      const res = await window.electronAPI.installToEngine({ modId, engineId });
      setResult(res);
      setStep('done');
    } catch (err: any) {
      setError(err.message || 'Installation failed');
      setStep('select');
    }
  };

  const handleOverwriteChoice = async (choice: OverwriteChoice) => {
    if (choice === 'cancel') {
      setStep('select');
      return;
    }
    if (choice === 'keep-both') {
      setStep('installing');
      setError('');
      try {
        const res = await window.electronAPI.installToEngine({ modId, engineId: overwritePendingEngineId });
        setResult(res);
        setStep('done');
      } catch (err: any) {
        setError(err.message || 'Installation failed');
        setStep('select');
      }
      return;
    }
    if (choice === 'replace') {
      setStep('installing');
      setError('');
      try {
        const res = await window.electronAPI.installToEngine({ modId, engineId: overwritePendingEngineId });
        setResult(res);
        setStep('done');
      } catch (err: any) {
        setError(err.message || 'Installation failed');
        setStep('select');
      }
    }
  };

  const handleContinue = async () => {
    if (!selectedEngineId) return;
    const engine = engines.find(e => e.id === selectedEngineId);
    if (!engine) return;
    handleInstall(engine.id);
  };

  return (
    <GlassDialog open={open} onClose={onClose} title={t('installToEngine.title')} maxWidth="max-w-md">
      {step === 'loading' && (
        <div className="flex flex-col items-center py-8 gap-3">
          <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
          <p className="text-surface-400 text-sm">{t('installToEngine.loading')}</p>
        </div>
      )}

      {step === 'select' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-800/50 border border-surface-700/30">
            <HardDrive className="w-5 h-5 text-primary-400 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-white truncate">{modTitle}</p>
              <p className="text-xs text-surface-500">{t('installToEngine.selectedMod')}</p>
            </div>
          </div>

          <div>
            <label className="text-xs text-surface-400 mb-1.5 block">{t('installToEngine.selectEngine')}</label>
            {engines.length === 0 ? (
              <p className="text-sm text-surface-400 py-2">{t('installToEngine.noEngines')}</p>
            ) : (
              <select
                className="input text-sm w-full"
                value={selectedEngineId}
                onChange={(e) => setSelectedEngineId(e.target.value)}
              >
                {engines.map((eng) => (
                  <option key={eng.id} value={eng.id}>{eng.name}</option>
                ))}
              </select>
            )}
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <div className="flex gap-2 pt-2">
            <button className="btn-secondary flex-1 text-sm" onClick={onClose}>{t('installToEngine.cancel')}</button>
            <button
              className="btn-primary flex-1 text-sm"
              onClick={handleContinue}
              disabled={engines.length === 0}
            >
              <HardDrive className="w-4 h-4" />
              {t('installToEngine.install')}
            </button>
          </div>
        </div>
      )}

      {step === 'installing' && (
        <div className="flex flex-col items-center py-8 gap-3">
          <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
          <p className="text-surface-400 text-sm">{t('installToEngine.installing')}</p>
        </div>
      )}

      {step === 'done' && (
        <div className="flex flex-col items-center py-8 gap-3">
          <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <Check className="w-6 h-6 text-emerald-400" />
          </div>
          <p className="text-white font-medium">{t('installToEngine.success')}</p>
          <p className="text-surface-400 text-sm text-center">
            {result?.renamed
              ? t('installToEngine.successRenamed')
              : t('installToEngine.successDesc')}
          </p>
          <button className="btn-primary text-sm mt-2" onClick={onClose}>{t('installToEngine.done')}</button>
        </div>
      )}

      {step === 'overwrite' && (
        <div className="space-y-4 py-4">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-white mb-1">{t('installToEngine.overwriteTitle')}</p>
              <p className="text-xs text-surface-400">{t('installToEngine.overwriteDesc', { path: overwriteTarget })}</p>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <button className="btn-primary text-sm w-full" onClick={() => handleOverwriteChoice('replace')}>
              {t('installToEngine.replace')}
            </button>
            <button className="btn-secondary text-sm w-full" onClick={() => handleOverwriteChoice('keep-both')}>
              {t('installToEngine.keepBoth')}
            </button>
            <button className="btn-ghost text-sm w-full" onClick={() => handleOverwriteChoice('cancel')}>
              {t('installToEngine.cancel')}
            </button>
          </div>
        </div>
      )}
    </GlassDialog>
  );
}
