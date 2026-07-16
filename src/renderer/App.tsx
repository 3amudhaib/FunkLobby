import { useEffect, useState } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Sidebar } from './components/Sidebar';
import { TitleBar } from './components/TitleBar';
import { DownloadQueue } from './components/DownloadQueue';
import { SmartScreenNotice } from './components/SmartScreenNotice';
import { WelcomeDialog } from './components/WelcomeDialog';
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
import { GameBananaModDetailPage } from './pages/GameBananaModDetailPage';
import { UpdatePage } from './pages/UpdatePage';
import { DiagnosticsPage } from './pages/DiagnosticsPage';
import { EasterEggOverlay } from './components/EasterEggOverlay';

function AppContent() {
  const { settings, loading, fetchSettings, updateSettings } = useSettingsStore();
  const { fetchEngines, detectEngines } = useEngineStore();
  const { fetchProfiles } = useProfileStore();
  const { isQueueVisible } = useDownloadStore();
  const [showSmartScreen, setShowSmartScreen] = useState(false);
  const [showWelcomeScreen, setShowWelcomeScreen] = useState(false);

  useDownloadEvents();
  useKeyboardShortcuts();

  useEffect(() => {
    fetchSettings();
    fetchEngines();
    detectEngines();
    fetchProfiles();
  }, []);

  useEffect(() => {
    if (!loading && settings.smartScreenDismissed !== 'true') {
      setShowSmartScreen(true);
    }
  }, [loading, settings.smartScreenDismissed]);

  // Show welcome dialog only on first launch
  useEffect(() => {
    if (!loading && settings.welcomeShown !== 'true') {
      setShowWelcomeScreen(true);
    }
  }, [loading, settings.welcomeShown]);

  const handleSmartScreenDismiss = async (dontShowAgain: boolean) => {
    if (dontShowAgain) {
      await updateSettings({ smartScreenDismissed: 'true' });
    }
    setShowSmartScreen(false);
  };

  const handleWelcomeDismiss = async () => {
    await updateSettings({ welcomeShown: 'true' });
    setShowWelcomeScreen(false);
  };

  useEffect(() => {
    const root = document.documentElement;

    if (settings.theme === 'light') {
      root.classList.add('light');
    } else {
      root.classList.remove('light');
    }

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
    <>
      <SmartScreenNotice open={showSmartScreen} onDismiss={handleSmartScreenDismiss} />
      <WelcomeDialog open={showWelcomeScreen} onDismiss={handleWelcomeDismiss} />
      <div className="h-screen flex">
      <TitleBar />
      <Sidebar />
      <main className={`flex-1 overflow-y-auto ml-56 ${isQueueVisible ? 'mr-80' : ''}`}>
        <div className="mx-4 mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          <p className="leading-6">
            Please note that there may be some errors or issues with the app; if you encounter any, please send details to this email address:{' '}
            <a href="mailto:kinimation28@gmail.com" className="font-medium underline decoration-amber-400 underline-offset-2">
              kinimation28@gmail.com
            </a>
          </p>
        </div>
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
            <Route path="/diagnostics" element={<DiagnosticsPage />} />
            <Route path="/updates" element={<UpdatePage />} />
            <Route path="/mod/:id" element={<ModDetailPage />} />
            <Route path="/gb/:id" element={<GameBananaModDetailPage />} />
          </Routes>
        </AnimatePresence>
      </main>
      <DownloadQueue />
    </div>
    <EasterEggOverlay />
    </>
  );
}

export function App() {
  return (
    <HashRouter>
      <AppContent />
    </HashRouter>
  );
}
