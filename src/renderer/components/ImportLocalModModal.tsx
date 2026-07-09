import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FolderOpen, Loader2, Check } from 'lucide-react';
import { GlassDialog } from './GlassDialog';
import { useModStore } from '../stores/modStore';

interface EngineOption {
  id: string;
  name: string;
}

interface ImportLocalModModalProps {
  open: boolean;
  onClose: () => void;
}

export function ImportLocalModModal({ open, onClose }: ImportLocalModModalProps) {
  const { fetchLibrary } = useModStore();
  const [step, setStep] = useState<'select' | 'configure' | 'saving' | 'done'>('select');
  const [folderPath, setFolderPath] = useState('');
  const [folderName, setFolderName] = useState('');
  const [engines, setEngines] = useState<EngineOption[]>([]);
  const [modName, setModName] = useState('');
  const [selectedEngine, setSelectedEngine] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setStep('select');
      setFolderPath('');
      setFolderName('');
      setEngines([]);
      setModName('');
      setSelectedEngine('');
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
      setEngines(result.engines);
      setSelectedEngine(result.engines.length > 0 ? result.engines[0].id : '');
      setStep('configure');
    } catch {
      setError('Failed to select folder');
      onClose();
    }
  };

  const handleSave = async () => {
    if (!modName.trim()) { setError('Please enter a mod name'); return; }
    if (!selectedEngine) { setError('Please select an engine'); return; }
    setError('');
    setStep('saving');
    try {
      await window.electronAPI.saveLocalMod({
        name: modName.trim(),
        sourceFolder: folderPath,
        engine: selectedEngine,
      });
      await fetchLibrary();
      setStep('done');
    } catch (err: any) {
      setError(err.message || 'Failed to save mod');
      setStep('configure');
    }
  };

  return (
    <GlassDialog open={open} onClose={onClose} title="Import Local Mod" maxWidth="max-w-md">
      {step === 'select' && (
        <div className="flex flex-col items-center py-8 gap-3">
          <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
          <p className="text-surface-400 text-sm">Opening folder selector...</p>
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
            <label className="text-xs text-surface-400 mb-1.5 block">Mod Name</label>
            <input
              className="input text-sm w-full"
              value={modName}
              onChange={(e) => setModName(e.target.value)}
              placeholder="Enter a name for this mod"
            />
          </div>

          <div>
            <label className="text-xs text-surface-400 mb-1.5 block">Engine</label>
            <select
              className="input text-sm w-full"
              value={selectedEngine}
              onChange={(e) => setSelectedEngine(e.target.value)}
            >
              {engines.map((eng) => (
                <option key={eng.id} value={eng.id}>{eng.name}</option>
              ))}
            </select>
            <p className="text-xs text-surface-500 mt-1">
              {selectedEngine === 'standalone'
                ? 'This mod runs on its own without a base engine.'
                : 'The FNF engine this mod is built for.'}
            </p>
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}

          <div className="flex gap-2 pt-2">
            <button className="btn-secondary flex-1 text-sm" onClick={onClose}>Cancel</button>
            <button className="btn-primary flex-1 text-sm" onClick={handleSave}>
              <Check className="w-4 h-4" />
              Add to Library
            </button>
          </div>
        </div>
      )}

      {step === 'saving' && (
        <div className="flex flex-col items-center py-8 gap-3">
          <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
          <p className="text-surface-400 text-sm">Copying mod folder and saving...</p>
        </div>
      )}

      {step === 'done' && (
        <div className="flex flex-col items-center py-8 gap-3">
          <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <Check className="w-6 h-6 text-emerald-400" />
          </div>
          <p className="text-white font-medium">Mod imported successfully!</p>
          <p className="text-surface-400 text-sm text-center">{modName} has been added to your library.</p>
          <button className="btn-primary text-sm mt-2" onClick={onClose}>Done</button>
        </div>
      )}
    </GlassDialog>
  );
}
