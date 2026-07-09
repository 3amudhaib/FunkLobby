import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export function useKeyboardShortcuts() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if the user is typing in an input or textarea
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        // Exception: Escape should blur the input
        if (e.key === 'Escape') {
          (document.activeElement as HTMLElement).blur();
        }
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'f':
            e.preventDefault();
            navigate('/');
            setTimeout(() => {
              const searchInput = document.querySelector('input[placeholder="Search mods..."]') as HTMLInputElement;
              if (searchInput) searchInput.focus();
            }, 100);
            break;
          case 'd':
            e.preventDefault();
            navigate('/downloads');
            break;
          case 'l':
            e.preventDefault();
            navigate('/library');
            break;
          case 's':
            e.preventDefault();
            navigate('/settings');
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);
}
