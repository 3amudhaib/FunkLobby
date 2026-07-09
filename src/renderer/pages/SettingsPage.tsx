import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Sun, Moon, Folder, Monitor, Download, RefreshCw, Bell, Zap, Palette, Check, Trash2, Globe, Database, Eraser } from 'lucide-react';
import { useSettingsStore } from '../stores/settingsStore';
import { useEngineStore } from '../stores/engineStore';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { THEME_PRESETS } from '../../shared/constants';

export function SettingsPage() {
  const { settings, fetchSettings, updateSettings, resetSettings, loading } = useSettingsStore();
  const { engines, fetchEngines, detectEngines } = useEngineStore();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
    fetchEngines();
    window.electronAPI.getCacheSize().then(size => {
      const el = (id: string, bytes: number) => {
        const e = document.getElementById(id);
        if (e) e.textContent = bytes > 0 ? `${(bytes / 1024).toFixed(1)} KB` : 'Empty';
      };
      el('cache-api-size', size.api);
      el('cache-thumb-size', size.thumbnails);
      el('cache-total-size', size.total);
    });
  }, []);

  const handleUpdate = async (key: string, value: string) => {
    setSaving(true);
    await updateSettings({ [key]: value });
    setSaving(false);
  };

  const handleSelectFolder = async (key: string) => {
    const result = await window.electronAPI.selectFolder();
    if (result.path) {
      await updateSettings({ [key]: result.path });
    }
  };

  const handleDetectEngines = async () => {
    await detectEngines();
  };

  if (loading) return <div className="page-container pt-14"><LoadingSpinner className="mt-20" /></div>;

  return (
    <div className="page-container pt-14">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Settings</h1>
            <p className="text-surface-400 text-sm mt-1">Configure your FunkLobby experience</p>
          </div>
          <button className="btn-ghost text-sm text-surface-400" onClick={resetSettings}>
            Reset to Default
          </button>
        </div>

        <div className="space-y-6 max-w-2xl">
          <section className="card p-5">
            <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Palette className="w-4 h-4 text-yellow-400" />
              Appearance
            </h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-white mb-2">Theme Preset</p>
                <p className="text-xs text-surface-400 mb-3">Choose a color scheme or create your own</p>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {THEME_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => handleUpdate('theme', preset.id)}
                      className={`relative p-3 rounded-lg border text-left transition-all ${
                        settings.theme === preset.id
                          ? 'border-primary-500 bg-primary-500/10 ring-1 ring-primary-500/30'
                          : 'border-surface-700/50 bg-surface-800/50 hover:border-surface-600'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: preset.colors.primary }} />
                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: preset.colors.bg }} />
                      </div>
                      <p className="text-xs font-medium text-white">{preset.name}</p>
                      <p className="text-[10px] text-surface-500 leading-tight mt-0.5">{preset.description}</p>
                      {settings.theme === preset.id && (
                        <Check className="w-3 h-3 text-primary-400 absolute top-2 right-2" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {settings.theme === 'custom' && (
                <div className="space-y-3 pt-2">
                  <div>
                    <label className="text-xs text-surface-400 mb-1.5 block">Primary Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        className="w-9 h-9 rounded border border-surface-700/50 bg-surface-800 cursor-pointer"
                        value={settings.customPrimary || '#3b82f6'}
                        onChange={(e) => handleUpdate('customPrimary', e.target.value)}
                      />
                      <input
                        className="input text-sm flex-1 font-mono"
                        value={settings.customPrimary || '#3b82f6'}
                        onChange={(e) => handleUpdate('customPrimary', e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-surface-400 mb-1.5 block">Background Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        className="w-9 h-9 rounded border border-surface-700/50 bg-surface-800 cursor-pointer"
                        value={settings.customBg || '#020617'}
                        onChange={(e) => handleUpdate('customBg', e.target.value)}
                      />
                      <input
                        className="input text-sm flex-1 font-mono"
                        value={settings.customBg || '#020617'}
                        onChange={(e) => handleUpdate('customBg', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <div>
                  <p className="text-sm text-white">Animations</p>
                  <p className="text-xs text-surface-400">Enable smooth animations and transitions</p>
                </div>
                <button
                  className={`w-10 h-5 rounded-full transition-colors relative ${settings.animations === 'true' ? 'bg-primary-500' : 'bg-surface-600'}`}
                  onClick={() => handleUpdate('animations', settings.animations === 'true' ? 'false' : 'true')}
                >
                  <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform ${settings.animations === 'true' ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
            </div>
          </section>

          <section className="card p-5">
            <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Folder className="w-4 h-4 text-blue-400" />
              Paths
            </h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-surface-400 mb-1.5 block">Download Folder</label>
                <div className="flex items-center gap-2">
                  <input className="input text-sm flex-1" value={settings.downloadFolder || ''} readOnly placeholder="Default downloads folder" />
                  <button className="btn-secondary text-sm" onClick={() => handleSelectFolder('downloadFolder')}>Browse</button>
                </div>
              </div>
              <div>
                <label className="text-xs text-surface-400 mb-1.5 block">Game Folder</label>
                <div className="flex items-center gap-2">
                  <input className="input text-sm flex-1" value={settings.gameFolder || ''} readOnly placeholder="Auto-detect or select manually" />
                  <button className="btn-secondary text-sm" onClick={() => handleSelectFolder('gameFolder')}>Browse</button>
                </div>
              </div>
            </div>
          </section>

          <section className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Monitor className="w-4 h-4 text-emerald-400" />
                Engines
              </h2>
              <button className="btn-secondary text-xs" onClick={handleDetectEngines}>
                <RefreshCw className="w-3 h-3 inline mr-1" />
                Auto-Detect
              </button>
            </div>

            {engines.length > 0 ? (
              <div className="space-y-2">
                {engines.map((engine: any) => (
                  <div key={engine.id} className="flex items-center justify-between p-3 rounded-lg bg-surface-800/50">
                    <div>
                      <p className="text-sm text-white">{engine.name}</p>
                      <p className="text-xs text-surface-400">{engine.path}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {engine.isDetected && <span className="text-[10px] text-emerald-400">Auto-detected</span>}
                      <span className="text-xs text-surface-500">{engine.version || 'Unknown'}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-surface-400">No engines detected. Click Auto-Detect to scan your system.</p>
            )}

            <div className="mt-4">
              <label className="text-xs text-surface-400 mb-1.5 block">Default Engine</label>
              <select
                className="input text-sm"
                value={settings.defaultEngine || 'psych'}
                onChange={(e) => handleUpdate('defaultEngine', e.target.value)}
              >
                <option value="psych">Psych Engine</option>
                <option value="kade">Kade Engine</option>
                <option value="codename">Codename Engine</option>
                <option value="forever">Forever Engine</option>
                <option value="leather">Leather Engine</option>
                <option value="vslice">V-Slice</option>
              </select>
            </div>
          </section>

          <section className="card p-5">
            <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Download className="w-4 h-4 text-purple-400" />
              Downloads
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white">Concurrent Downloads</p>
                  <p className="text-xs text-surface-400">Maximum simultaneous downloads</p>
                </div>
                <select
                  className="input text-sm w-20"
                  value={settings.concurrentDownloads || '3'}
                  onChange={(e) => handleUpdate('concurrentDownloads', e.target.value)}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          <section className="card p-5">
            <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Globe className="w-4 h-4 text-sky-400" />
              Language
            </h2>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white">Interface Language</p>
                <p className="text-xs text-surface-400">Select your preferred language</p>
              </div>
              <select
                className="input text-sm w-36"
                value={settings.language || 'en'}
                onChange={(e) => handleUpdate('language', e.target.value)}
              >
                <option value="en">English</option>
                <option value="es">Español</option>
                <option value="fr">Français</option>
                <option value="de">Deutsch</option>
                <option value="ja">日本語</option>
                <option value="pt">Português</option>
                <option value="ru">Русский</option>
                <option value="zh">中文</option>
              </select>
            </div>
          </section>

          <section className="card p-5">
            <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Database className="w-4 h-4 text-cyan-400" />
              Cache
            </h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white">API Response Cache</p>
                  <p className="text-xs text-surface-400">Cached GameBanana API responses</p>
                </div>
                <p className="text-xs text-surface-400 font-mono" id="cache-api-size">-</p>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white">Thumbnail Cache</p>
                  <p className="text-xs text-surface-400">Cached mod thumbnails and images</p>
                </div>
                <p className="text-xs text-surface-400 font-mono" id="cache-thumb-size">-</p>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-white/5">
                <div>
                  <p className="text-sm text-white">Total Cache</p>
                  <p className="text-xs text-surface-400 font-mono" id="cache-total-size">-</p>
                </div>
                <button
                  className="btn-ghost text-sm text-surface-400 hover:text-white"
                  onClick={async () => {
                    await window.electronAPI.clearCache('all');
                    const size = await window.electronAPI.getCacheSize();
                    const el = (id: string, bytes: number) => {
                      const e = document.getElementById(id);
                      if (e) e.textContent = bytes > 0 ? `${(bytes / 1024).toFixed(1)} KB` : 'Empty';
                    };
                    el('cache-api-size', size.api);
                    el('cache-thumb-size', size.thumbnails);
                    el('cache-total-size', size.total);
                  }}
                >
                  <Eraser className="w-3.5 h-3.5 inline mr-1" />
                  Clear Cache
                </button>
              </div>
            </div>
          </section>

          <section className="card p-5">
            <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Zap className="w-4 h-4 text-orange-400" />
              Updates
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white">Auto-Update App</p>
                  <p className="text-xs text-surface-400">Automatically check for FNF Hub updates</p>
                </div>
                <button
                  className={`w-10 h-5 rounded-full transition-colors relative ${settings.autoUpdate === 'true' ? 'bg-primary-500' : 'bg-surface-600'}`}
                  onClick={() => handleUpdate('autoUpdate', settings.autoUpdate === 'true' ? 'false' : 'true')}
                >
                  <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform ${settings.autoUpdate === 'true' ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white">Auto-Update Mods</p>
                  <p className="text-xs text-surface-400">Automatically check for mod updates</p>
                </div>
                <button
                  className={`w-10 h-5 rounded-full transition-colors relative ${settings.autoUpdateMods === 'true' ? 'bg-primary-500' : 'bg-surface-600'}`}
                  onClick={() => handleUpdate('autoUpdateMods', settings.autoUpdateMods === 'true' ? 'false' : 'true')}
                >
                  <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform ${settings.autoUpdateMods === 'true' ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
            </div>
          </section>

          <section className="card p-5">
            <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Bell className="w-4 h-4 text-pink-400" />
              Notifications
            </h2>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white">Enable Notifications</p>
                <p className="text-xs text-surface-400">Show desktop notifications for downloads and updates</p>
              </div>
              <button
                className={`w-10 h-5 rounded-full transition-colors relative ${settings.notifications === 'true' ? 'bg-primary-500' : 'bg-surface-600'}`}
                onClick={() => handleUpdate('notifications', settings.notifications === 'true' ? 'false' : 'true')}
              >
                <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform ${settings.notifications === 'true' ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
          </section>

          <section className="card p-5 border-red-500/20">
            <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-red-400" />
              Danger Zone
            </h2>
            <p className="text-xs text-surface-400 mb-3">Permanently delete all mods, downloads, profiles, engines, and reset all settings.</p>
            <button
              className="btn-danger text-sm"
              onClick={async () => {
                const result = await window.electronAPI.clearAllData();
                if (result.success) {
                  window.location.reload();
                }
              }}
            >
              <Trash2 className="w-3.5 h-3.5 inline mr-1.5" />
              Clear All Data
            </button>
          </section>
        </div>
      </motion.div>
    </div>
  );
}
