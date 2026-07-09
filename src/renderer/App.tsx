import { useEffect } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Sidebar } from './components/Sidebar';
import { TitleBar } from './components/TitleBar';
import { DownloadQueue } from './components/DownloadQueue';
import { useDownloadEvents } from './hooks/useDownloadEvents';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useSettingsStore } from './stores/settingsStore';
import { useEngineStore } from './stores/engineStore';
import { useProfileStore } from './stores/profileStore';
import { useDownloadStore } from './stores/downloadStore';
import { THEME_PRESETS } from '../shared/constants';
import { HomePage } from './pages/HomePage';
import { InstalledPage } from './pages/InstalledPage';
import { EnginesPage } from './pages/EnginesPage';
import { DownloadsPage } from './pages/DownloadsPage';
import { LibraryPage } from './pages/LibraryPage';
import { ProfilesPage } from './pages/ProfilesPage';
import { FavoritesPage } from './pages/FavoritesPage';
import { SettingsPage } from './pages/SettingsPage';
import { AboutPage } from './pages/AboutPage';
import { ModDetailPage } from './pages/ModDetailPage';
import { UpdatePage } from './pages/UpdatePage';

function AppContent() {
  const { settings, fetchSettings } = useSettingsStore();
  const { fetchEngines, detectEngines } = useEngineStore();
  const { fetchProfiles } = useProfileStore();
  const { isQueueVisible } = useDownloadStore();

  useDownloadEvents();
  useKeyboardShortcuts();

  useEffect(() => {
    fetchSettings();
    fetchEngines();
    detectEngines();
    fetchProfiles();
  }, []);

  useEffect(() => {
    const root = document.documentElement;

    if (settings.theme === 'light') {
      root.classList.add('light');
    } else {
      root.classList.remove('light');
    }

    // Get preset colors or custom colors
    let primary: string, bg: string, surface: string;
    if (settings.theme === 'custom') {
      primary = settings.customPrimary || '#3b82f6';
      bg = settings.customBg || '#020617';
      surface = '#0f172a';
    } else {
      const preset = THEME_PRESETS.find((p) => p.id === settings.theme);
      if (preset) {
        primary = preset.colors.primary;
        bg = preset.colors.bg;
        surface = preset.colors.surface;
        root.style.setProperty('--theme-accent', preset.colors.accent || primary);
      } else {
        const fallback = THEME_PRESETS[0];
        primary = fallback.colors.primary;
        bg = fallback.colors.bg;
        surface = fallback.colors.surface;
      }
    }

    root.style.setProperty('--theme-primary', primary);
    root.style.setProperty('--theme-bg', bg);
    root.style.setProperty('--theme-surface', surface);
  }, [settings.theme, settings.customPrimary, settings.customBg]);

  return (
    <div className="h-screen flex">
      <TitleBar />
      <Sidebar />
      <main className={`flex-1 overflow-y-auto ml-56 ${isQueueVisible ? 'mr-80' : ''}`}>
        <AnimatePresence mode="wait">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/installed" element={<InstalledPage />} />
            <Route path="/engines" element={<EnginesPage />} />
            <Route path="/downloads" element={<DownloadsPage />} />
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/profiles" element={<ProfilesPage />} />
            <Route path="/favorites" element={<FavoritesPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/updates" element={<UpdatePage />} />
            <Route path="/mod/:id" element={<ModDetailPage />} />
          </Routes>
        </AnimatePresence>
      </main>
      <DownloadQueue />
    </div>
  );
}

export function App() {
  return (
    <HashRouter>
      <AppContent />
    </HashRouter>
  );
}
