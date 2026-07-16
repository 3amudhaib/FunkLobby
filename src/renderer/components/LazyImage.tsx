import { useState, useRef, useEffect } from 'react';
import { ImageIcon } from 'lucide-react';

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  fallback?: React.ReactNode;
  cached?: boolean;
}

export function LazyImage({ src, alt, className = '', fallback, cached = true }: LazyImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [visible, setVisible] = useState(false);
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);
  const imgRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const el = imgRef.current;
    if (!el) return;

    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observerRef.current?.disconnect();
        }
      },
      { rootMargin: '200px' }
    );

    observerRef.current.observe(el);

    return () => {
      observerRef.current?.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!visible) return;
    if (!cached) {
      setResolvedSrc(src);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const cachedUrl = await window.electronAPI.getCachedThumbnail(src);
        if (!cancelled) setResolvedSrc(cachedUrl || src);
      } catch {
        if (!cancelled) setResolvedSrc(src);
      }
    })();
    return () => { cancelled = true; };
  }, [visible, src, cached]);

  return (
    <div ref={imgRef} className={`relative overflow-hidden ${className}`}>
      {!loaded && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-surface-800 animate-pulse">
          {fallback || <ImageIcon className="w-6 h-6 text-surface-600" />}
        </div>
      )}
      {visible && resolvedSrc && !error && (
        <img
          src={resolvedSrc}
          alt={alt}
          className={`w-full h-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setLoaded(true)}
          onError={() => { setError(true); setLoaded(true); }}
        />
      )}
    </div>
  );
}
