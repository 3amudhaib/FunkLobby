import { useState, useRef, useEffect } from 'react';

const bannerModules = import.meta.glob('../assets/engines-banner/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

interface BannerEntry {
  key: string;
  url: string;
}

let bannerEntries: BannerEntry[] | null = null;
let defaultBannerUrl: string | null = null;

function getBannerEntries(): { entries: BannerEntry[]; defaultUrl: string | null } {
  if (bannerEntries) return { entries: bannerEntries, defaultUrl: defaultBannerUrl };

  bannerEntries = [];
  for (const [modulePath, url] of Object.entries(bannerModules)) {
    const filename = modulePath.split('/').pop() || '';
    const resolvedUrl = url as string;

    if (filename === 'default.png') {
      defaultBannerUrl = resolvedUrl;
      continue;
    }

    const stripped = filename
      .replace(/\.png$/i, '')
      .toLowerCase()
      .replace(/\s*engine\s*/g, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();

    if (stripped) {
      bannerEntries.push({ key: stripped, url: resolvedUrl });
    }
  }

  return { entries: bannerEntries, defaultUrl: defaultBannerUrl };
}

function matchBannerUrl(engineName: string): string {
  const { entries, defaultUrl } = getBannerEntries();

  if (!engineName) return defaultUrl || '';

  const stripped = engineName
    .toLowerCase()
    .replace(/\s*engine\s*/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();

  if (!stripped) return defaultUrl || '';

  for (const entry of entries) {
    if (entry.key === stripped) return entry.url;
  }

  for (const entry of entries) {
    if (entry.key.length >= 2) {
      if (stripped.startsWith(entry.key) || entry.key.startsWith(stripped)) {
        return entry.url;
      }
    }
  }

  const engineWords = engineName
    .toLowerCase()
    .split(/[\s_-]+/)
    .map(w => w.replace(/[^a-z0-9]/g, ''))
    .filter(Boolean);

  for (const word of engineWords) {
    if (word.length < 2) continue;
    for (const entry of entries) {
      if (entry.key === word) return entry.url;
    }
  }

  for (const entry of entries) {
    if (entry.key.length >= 5 && stripped.includes(entry.key)) return entry.url;
  }

  return defaultUrl || '';
}

interface EngineBannerProps {
  engineName: string;
  height?: number;
  className?: string;
}

const loadedImages = new Set<string>();

export function EngineBanner({ engineName, height = 90, className = '' }: EngineBannerProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [failed, setFailed] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  const defaultUrl = getBannerEntries().defaultUrl || '';

  useEffect(() => {
    const url = matchBannerUrl(engineName);

    if (!url) {
      if (mountedRef.current) { setSrc(null); setVisible(false); setFailed(true); }
      return;
    }

    if (loadedImages.has(url)) {
      if (mountedRef.current) { setSrc(url); setVisible(true); setFailed(false); }
      return;
    }

    const img = new Image();
    img.onload = () => {
      loadedImages.add(url);
      if (mountedRef.current) { setSrc(url); setVisible(true); setFailed(false); }
    };
    img.onerror = () => {
      if (url !== defaultUrl) {
        const fallback = defaultUrl;
        if (fallback && !loadedImages.has(fallback)) {
          const fallbackImg = new Image();
          fallbackImg.onload = () => {
            loadedImages.add(fallback);
            if (mountedRef.current) { setSrc(fallback); setVisible(true); setFailed(false); }
          };
          fallbackImg.onerror = () => {
            if (mountedRef.current) { setSrc(null); setVisible(false); setFailed(true); }
          };
          fallbackImg.src = fallback;
        } else if (fallback) {
          if (mountedRef.current) { setSrc(fallback); setVisible(true); setFailed(false); }
        }
      } else {
        if (mountedRef.current) { setSrc(null); setVisible(false); setFailed(true); }
      }
    };
    img.src = url;
  }, [engineName, defaultUrl]);

  if (!src || failed) return null;

  return (
    <div
      className={`flex items-center justify-center overflow-hidden ${className}`}
      style={{ height }}
    >
      <img
        src={src}
        alt={engineName}
        className="max-w-full max-h-full"
        style={{
          objectFit: 'contain',
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
