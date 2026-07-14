import { useState, useRef, useEffect } from 'react';

const bannerModules = import.meta.glob('../assets/engines-banner/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const ENGINE_ID_TO_FILENAME: Record<string, string> = {
  psych: 'Psych engine.png',
  codename: 'CodeName engine.png',
  cdev: 'CDEV engine.png',
  'v-slice': 'V-slice.png',
  'fps-plus': 'FPSPlusLogo.png',
  'micd-up': 'MicUpLogo.png',
  yoshicrafter: 'Yoshi engine.png',
  dragon: 'Dragon engine.png',
  shadow: 'Shadow engine.png',
  shattered: 'Shattered engine.png',
  slushi: 'Slush engine.png',
  troll: 'Troll engine.png',
  universe: 'Universe engine.png',
  vanilla: 'Vanilla.png',
  'funkin-plus-plus': 'Plus engine.png',
};

const ENGINE_NAME_TO_FILENAME: Record<string, string> = {
  'Psych Engine': 'Psych engine.png',
  'Codename Engine': 'CodeName engine.png',
  'CDEV Engine': 'CDEV engine.png',
  'V-Slice': 'V-slice.png',
  'FPS Plus': 'FPSPlusLogo.png',
  "Mic'd Up": 'MicUpLogo.png',
  'YoshiCrafter Engine': 'Yoshi engine.png',
  'Dragon Engine': 'Dragon engine.png',
  'Shadow Engine': 'Shadow engine.png',
  'Shattered Engine': 'Shattered engine.png',
  'Slushi Engine': 'Slush engine.png',
  'Troll Engine': 'Troll engine.png',
  'Solar Engine': 'Universe engine.png',
  'Vanilla': 'Vanilla.png',
  'Funkin Plus Plus': 'Plus engine.png',
};

let urlByFilename: Record<string, string> | null = null;
let defaultUrl: string | null = null;

function loadBannerUrls(): void {
  if (urlByFilename) return;
  urlByFilename = {};
  for (const [modulePath, url] of Object.entries(bannerModules)) {
    const filename = modulePath.split('/').pop() || '';
    if (filename === 'default.png') {
      defaultUrl = url as string;
    } else {
      urlByFilename[filename] = url as string;
    }
  }
}

function resolveFilename(engineId?: string, engineName?: string): string | null {
  if (engineId && ENGINE_ID_TO_FILENAME[engineId]) {
    return ENGINE_ID_TO_FILENAME[engineId];
  }
  if (engineName && ENGINE_NAME_TO_FILENAME[engineName]) {
    return ENGINE_NAME_TO_FILENAME[engineName];
  }
  return null;
}

interface EngineBannerProps {
  engineId?: string;
  engineName?: string;
  height?: number;
  className?: string;
}

const loadedImages = new Set<string>();

export function EngineBanner({ engineId, engineName, height = 150, className = '' }: EngineBannerProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [failed, setFailed] = useState(false);
  const mountedRef = useRef(true);
  const defaultBannerUrl = useRef<string | null>(null);

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    loadBannerUrls();
    defaultBannerUrl.current = defaultUrl;

    const filename = resolveFilename(engineId, engineName);
    let bannerUrl = filename && urlByFilename![filename] ? urlByFilename![filename] : null;
    if (!bannerUrl) bannerUrl = defaultBannerUrl.current || null;

    if (!bannerUrl) {
      if (mountedRef.current) { setSrc(null); setVisible(false); setFailed(true); }
      return;
    }

    if (loadedImages.has(bannerUrl)) {
      if (mountedRef.current) { setSrc(bannerUrl); setVisible(true); setFailed(false); }
      return;
    }

    const img = new Image();
    img.onload = () => {
      loadedImages.add(bannerUrl!);
      if (mountedRef.current) { setSrc(bannerUrl); setVisible(true); setFailed(false); }
    };
    img.onerror = () => {
      const fallback = defaultBannerUrl.current;
      if (bannerUrl !== fallback && fallback) {
        if (!loadedImages.has(fallback)) {
          const fbImg = new Image();
          fbImg.onload = () => {
            loadedImages.add(fallback);
            if (mountedRef.current) { setSrc(fallback); setVisible(true); setFailed(false); }
          };
          fbImg.onerror = () => {
            if (mountedRef.current) { setSrc(null); setVisible(false); setFailed(true); }
          };
          fbImg.src = fallback;
        } else {
          if (mountedRef.current) { setSrc(fallback); setVisible(true); setFailed(false); }
        }
      } else {
        if (mountedRef.current) { setSrc(null); setVisible(false); setFailed(true); }
      }
    };
    img.src = bannerUrl;
  }, [engineId, engineName]);

  if (!src || failed) return null;

  return (
    <div
      className={`flex items-center justify-center overflow-hidden ${className}`}
      style={{ height }}
    >
      <img
        src={src}
        alt={engineName || engineId || ''}
        className="max-w-full max-h-full"
        style={{
          objectFit: 'cover',
          opacity: visible ? 1 : 0,
          transition: 'opacity 200ms ease-in-out',
        }}
        onError={() => {
          if (mountedRef.current) setFailed(true);
        }}
      />
    </div>
  );
}