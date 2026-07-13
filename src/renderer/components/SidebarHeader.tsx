import { useState, useEffect, useRef } from 'react';
import { useSettingsStore } from '../stores/settingsStore';
import { useTranslation } from '../hooks/useTranslation';

const LOGO_MAP: Record<string, string> = {
  dark: 'dark-light',
  light: 'dark-light',
  midnight: 'midnight-blue',
  forest: 'forest',
  sunset: 'sunset',
  ocean: 'ocean',
};

const logoModules = import.meta.glob('../assets/logos/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as unknown as Record<string, string>;

function resolveLogo(theme: string): string {
  const key = LOGO_MAP[theme] || 'default';
  const entry = Object.entries(logoModules).find(([path]) =>
    path.includes(`/${key}.png`) || path.includes(`\\${key}.png`)
  );
  return entry ? entry[1] : (logoModules[Object.keys(logoModules).find(k => k.includes('/default.png') || k.includes('\\default.png')) ?? ''] || '');
}

interface SidebarHeaderProps {
  collapsed?: boolean;
}

export function SidebarHeader({ collapsed = false }: SidebarHeaderProps) {
  const { t } = useTranslation();
  const theme = useSettingsStore(s => s.settings.theme) || 'dark';
  const [logoSrc, setLogoSrc] = useState<string>('');
  const [loaded, setLoaded] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    const url = resolveLogo(theme);
    if (!url) {
      if (mountedRef.current) { setLogoSrc(''); setLoaded(false); }
      return;
    }
    setLogoSrc(url);
    setLoaded(false);

    const img = new Image();
    img.onload = () => {
      if (mountedRef.current) setLoaded(true);
    };
    img.onerror = () => {
      const fallback = resolveLogo('dark');
      if (mountedRef.current) {
        setLogoSrc(fallback || url);
        setLoaded(true);
      }
    };
    img.src = url;
  }, [theme]);

  if (!logoSrc) {
    return (
      <div className="flex items-center gap-3 px-4 py-4 border-b border-white/[0.06] min-h-[4rem]">
        <div className="w-8 h-8 rounded-lg bg-surface-700 flex items-center justify-center">
          <span className="text-xs text-surface-400">{t('app.name')}</span>
        </div>
        {!collapsed && (
          <h1 className="text-sm font-semibold text-white">{t('app.name')}</h1>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 px-4 py-4 border-b border-white/[0.06] min-h-[4rem]">
      <img
        src={logoSrc}
        alt={t('app.name')}
        className="w-8 h-8 flex-shrink-0 object-contain select-none"
        draggable={false}
        style={{ opacity: loaded ? 1 : 0, transition: 'opacity 0.15s' }}
        onError={(e) => {
          const fallback = resolveLogo('dark');
          if (fallback && (e.target as HTMLImageElement).src !== fallback) {
            (e.target as HTMLImageElement).src = fallback;
          }
        }}
      />
      {!collapsed && (
        <h1 className="text-sm font-semibold text-white truncate">{t('app.name')}</h1>
      )}
    </div>
  );
}