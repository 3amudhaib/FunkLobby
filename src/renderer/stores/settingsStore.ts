import { create } from 'zustand';
import { DEFAULT_SETTINGS } from '../../shared/constants';

interface SettingsState {
  settings: Record<string, string>;
  loading: boolean;

  fetchSettings: () => Promise<void>;
  updateSettings: (settings: Record<string, string>) => Promise<void>;
  resetSettings: () => Promise<void>;
  getSetting: (key: string, defaultVal?: string) => string;
}

const defaults: Record<string, string> = {};
for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
  defaults[k] = String(v);
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: {},
  loading: false,

  fetchSettings: async () => {
    try {
      set({ loading: true });
      const settings = await window.electronAPI.getSettings();
      set({ settings, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  updateSettings: async (newSettings) => {
    try {
      const current = get().settings;
      const merged = { ...current, ...newSettings };
      await window.electronAPI.updateSettings(merged);
      set({ settings: merged });
    } catch {}
  },

  resetSettings: async () => {
    try {
      await window.electronAPI.resetSettings();
      set({ settings: { ...defaults } });
    } catch {}
  },

  getSetting: (key, defaultVal = '') => {
    return get().settings[key] || defaultVal;
  },
}));
