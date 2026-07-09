
import { Minus, Square, X } from 'lucide-react';

export function TitleBar() {
  return (
    <div className="titlebar">
      <div className="flex items-center gap-2 text-surface-400 text-xs">
        <span className="font-semibold" style={{ color: 'var(--theme-primary)' }}>FunkLobby</span>
      </div>
      <div className="flex items-center gap-1">
        <button
          className="titlebar-button"
          onClick={() => window.electronAPI.minimizeWindow()}
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <button
          className="titlebar-button"
          onClick={() => window.electronAPI.maximizeWindow()}
        >
          <Square className="w-3 h-3" />
        </button>
        <button
          className="titlebar-button hover:bg-red-500/20 hover:text-red-400"
          onClick={() => window.electronAPI.closeWindow()}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
