import { useState, useEffect } from 'react';
import { HardDrive, Image as ImageIcon } from 'lucide-react';

interface ModCoverProps {
  modId: string;
  coverPath?: string | null;
  thumbnailUrl?: string;
  title: string;
  className?: string;
  fallback?: 'icon' | 'gradient' | 'letter';
}

export function ModCover({ modId, coverPath, thumbnailUrl, title, className = '', fallback = 'icon' }: ModCoverProps) {
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (coverPath) {
      setResolvedSrc(`cover://${encodeURI(coverPath)}`);
    } else {
      setResolvedSrc(null);
    }
  }, [coverPath]);

  const imgSrc = resolvedSrc || thumbnailUrl;

  if (!imgSrc) {
    return (
      <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br from-primary-800 to-purple-800 ${className}`}>
        {fallback === 'letter' ? (
          <span className="text-2xl font-bold text-white/50">{title.charAt(0).toUpperCase()}</span>
        ) : (
          <HardDrive className="w-8 h-8 text-white/50" />
        )}
      </div>
    );
  }

  return (
    <div className={`relative w-full h-full ${className}`}>
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-surface-800">
          <ImageIcon className="w-6 h-6 text-surface-600 animate-pulse" />
        </div>
      )}
      <img
        src={imgSrc}
        alt={title}
        className={`w-full h-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={(e) => {
          setLoaded(true);
          (e.target as HTMLImageElement).style.display = 'none';
        }}
      />
    </div>
  );
}
