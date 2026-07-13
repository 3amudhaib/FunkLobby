import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Folder, Download, Bell, Zap, Palette, Check, Trash2, Globe } from 'lucide-react';
import { useSettingsStore } from '../stores/settingsStore';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { THEME_PRESETS } from '../../shared/constants';
import { useTranslation } from '../hooks/useTranslation';

export function SettingsPage() {
  const { t } = useTranslation();
  const { settings, fetchSettings, updateSettings, resetSettings, loading } = useSettingsStore();

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleUpdate = async (key: string, value: string) => {
    await updateSettings({ [key]: value });
  };

  const handleSelectFolder = async (key: string) => {
    const result = await window.electronAPI.selectFolder();
    if (result.path) {
      await updateSettings({ [key]: result.path });
    }
  };

  if (loading) return <div className="page-container pt-14"><LoadingSpinner className="mt-20" /></div>;

  return (
    <div className="page-container pt-14">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">{t('settings.title')}</h1>
            <p className="text-surface-400 text-sm mt-1">{t('settings.subtitle')}</p>
          </div>
          <button className="btn-ghost text-sm text-surface-400" onClick={resetSettings}>
            {t('settings.resetToDefault')}
          </button>
        </div>

        <div className="space-y-6 max-w-2xl">
          <section className="card p-5">
            <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Palette className="w-4 h-4 text-yellow-400" />
              {t('settings.appearance')}
            </h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-white mb-2">{t('settings.themePreset')}</p>
                <p className="text-xs text-surface-400 mb-3">{t('settings.chooseTheme')}</p>
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
                    <label className="text-xs text-surface-400 mb-1.5 block">{t('settings.primaryColor')}</label>
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
                    <label className="text-xs text-surface-400 mb-1.5 block">{t('settings.backgroundColor')}</label>
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
                  <p className="text-sm text-white">{t('settings.animations')}</p>
                  <p className="text-xs text-surface-400">{t('settings.animationsDesc')}</p>
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
              {t('settings.paths')}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-surface-400 mb-1.5 block">{t('settings.downloadFolder')}</label>
                <div className="flex items-center gap-2">
                  <input className="input text-sm flex-1" value={settings.downloadFolder || ''} readOnly placeholder={t('settings.downloadFolder')} />
                  <button className="btn-secondary text-sm" onClick={() => handleSelectFolder('downloadFolder')}>{t('settings.browse')}</button>
                </div>
              </div>
              <div>
                <label className="text-xs text-surface-400 mb-1.5 block">{t('settings.gameFolder')}</label>
                <div className="flex items-center gap-2">
                  <input className="input text-sm flex-1" value={settings.gameFolder || ''} readOnly placeholder={t('settings.gameFolder')} />
                  <button className="btn-secondary text-sm" onClick={() => handleSelectFolder('gameFolder')}>{t('settings.browse')}</button>
                </div>
              </div>
            </div>
          </section>

          <section className="card p-5">
            <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Download className="w-4 h-4 text-purple-400" />
              {t('settings.downloads')}
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white">{t('settings.concurrentDownloads')}</p>
                  <p className="text-xs text-surface-400">{t('settings.concurrentDesc')}</p>
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
              {t('settings.language')}
            </h2>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white">{t('settings.interfaceLang')}</p>
                <p className="text-xs text-surface-400">{t('settings.selectLang')}</p>
              </div>
              <select
                className="input text-sm w-36"
                value={settings.language || 'en'}
                onChange={(e) => handleUpdate('language', e.target.value)}
              >
                <option value="en">{t('settings.language.en')}</option>
                <option value="es">{t('settings.language.es')}</option>
                <option value="fr">{t('settings.language.fr')}</option>
                <option value="de">{t('settings.language.de')}</option>
                <option value="ja">{t('settings.language.ja')}</option>
                <option value="pt">{t('settings.language.pt')}</option>
                <option value="ru">{t('settings.language.ru')}</option>
                <option value="zh">{t('settings.language.zh')}</option>
                <option value="ar">{t('settings.language.ar')}</option>
              </select>
            </div>
          </section>

          <section className="card p-5">
            <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Zap className="w-4 h-4 text-orange-400" />
              {t('settings.updates')}
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white">{t('settings.autoUpdateApp')}</p>
                  <p className="text-xs text-surface-400">{t('settings.autoUpdateAppDesc')}</p>
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
                  <p className="text-sm text-white">{t('settings.autoUpdateMods')}</p>
                  <p className="text-xs text-surface-400">{t('settings.autoUpdateModsDesc')}</p>
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
              {t('settings.notifications')}
            </h2>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white">{t('settings.enableNotifications')}</p>
                <p className="text-xs text-surface-400">{t('settings.notificationsDesc')}</p>
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
              {t('settings.dangerZone')}
            </h2>
            <p className="text-xs text-surface-400 mb-3">{t('settings.dangerDesc')}</p>
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
              {t('settings.clearAllData')}
            </button>
          </section>
        </div>
      </motion.div>
    </div>
  );
}
