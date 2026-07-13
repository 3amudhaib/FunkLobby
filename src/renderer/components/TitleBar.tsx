import { Minus, Square, X } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';

export function TitleBar() {
  const { t } = useTranslation();
  return (
    <div className="titlebar">
      <div className="flex items-center gap-2 text-surface-400 text-xs">
        <span className="font-semibold" style={{ color: 'var(--theme-primary)' }}>{t('app.name')}</span>
      </div>
      <div className="flex items-center gap-1">
        <button
          className="titlebar-button"
          onClick={() => window.electronAPI.minimizeWindow()}
          aria-label={t('titleBar.minimize')}
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <button
          className="titlebar-button"
          onClick={() => window.electronAPI.maximizeWindow()}
          aria-label={t('titleBar.maximize')}
        >
          <Square className="w-3 h-3" />
        </button>
        <button
          className="titlebar-button hover:bg-red-500/20 hover:text-red-400"
          onClick={() => window.electronAPI.closeWindow()}
          aria-label={t('titleBar.close')}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
