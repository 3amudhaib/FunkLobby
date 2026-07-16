import { useEffect, useState, useRef, useCallback } from 'react';

export function EasterEggOverlay() {
  const [visible, setVisible] = useState(false);
  const [imageDataUrl, setImageDataUrl] = useState('');
  const [fadeIn, setFadeIn] = useState(false);
  const progressRef = useRef<((data: { imageDataUrl: string }) => void) | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const onOverlay = useCallback((data: { imageDataUrl: string }) => {
    setImageDataUrl(data.imageDataUrl);
    setVisible(true);
    setTimeout(() => setFadeIn(true), 50);
  }, []);

  const onCleanup = useCallback(() => {
    setFadeIn(false);
    setTimeout(() => {
      setVisible(false);
      setImageDataUrl('');
    }, 500);
  }, []);

  useEffect(() => {
    progressRef.current = onOverlay;
    cleanupRef.current = onCleanup;
    window.electronAPI.onEasterEggOverlay(onOverlay);
    window.electronAPI.onEasterEggCleanup(onCleanup);
    return () => {
      if (progressRef.current) window.electronAPI.removeEasterEggOverlayListener(progressRef.current);
      if (cleanupRef.current) window.electronAPI.removeEasterEggCleanupListener(cleanupRef.current);
    };
  }, [onOverlay, onCleanup]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: fadeIn ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0)',
        transition: 'background-color 1.5s ease',
        pointerEvents: 'auto',
        cursor: 'default',
      }}
    >
      {imageDataUrl && (
        <img
          src={imageDataUrl}
          alt=""
          style={{
            maxWidth: '80%',
            maxHeight: '80%',
            objectFit: 'contain',
            opacity: fadeIn ? 1 : 0,
            transition: 'opacity 2s ease',
          }}
          draggable={false}
        />
      )}
    </div>
  );
}
