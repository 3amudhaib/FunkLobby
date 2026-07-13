import { useSettingsStore } from '../stores/settingsStore';
import en from '../locales/en.json';
import es from '../locales/es.json';
import fr from '../locales/fr.json';
import de from '../locales/de.json';
import ja from '../locales/ja.json';
import pt from '../locales/pt.json';
import ru from '../locales/ru.json';
import zh from '../locales/zh.json';
import ar from '../locales/ar.json';

const localeCache: Record<string, Record<string, string>> = {
  en: en as Record<string, string>,
  es: es as Record<string, string>,
  fr: fr as Record<string, string>,
  de: de as Record<string, string>,
  ja: ja as Record<string, string>,
  pt: pt as Record<string, string>,
  ru: ru as Record<string, string>,
  zh: zh as Record<string, string>,
  ar: ar as Record<string, string>,
};

function interpolate(text: string, params?: Record<string, string | number>): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (_, key) => {
    const val = params[key];
    return val != null ? String(val) : `{${key}}`;
  });
}

export function useTranslation() {
  const language = useSettingsStore(s => s.settings.language || 'en');

  const t = (key: string, params?: Record<string, string | number>): string => {
    let text = localeCache[language]?.[key];
    if (text === undefined) {
      text = localeCache['en']?.[key];
    }
    if (text === undefined) return key;
    return interpolate(text, params);
  };

  return { t, language };
}
