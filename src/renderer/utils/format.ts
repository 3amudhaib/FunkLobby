export function formatBytes(bytes: number, t?: (key: string, params?: any) => string): string {
  if (bytes === 0) return t ? t('format.bytesZero') : '0 B';
  const k = 1024;
  const sizes = t
    ? [t('unit.B'), t('unit.KB'), t('unit.MB'), t('unit.GB')]
    : ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function formatSpeed(bytesPerSec: number, t?: (key: string, params?: any) => string): string {
  if (bytesPerSec === 0) return t ? t('format.speedZero') : '0 B/s';
  const formatted = formatBytes(bytesPerSec, t);
  return t ? t('format.speed', { speed: formatted }) : formatted + '/s';
}

export function formatEta(seconds: number, t?: (key: string, params?: any) => string): string {
  if (seconds <= 0) return t ? t('format.etaDash') : '--';
  if (seconds < 60) return t ? t('format.etaS', { value: seconds }) : `${seconds}s`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (t) return t('format.etaM', { value: m }) + t('format.etaS', { value: s });
    return `${m}m ${s}s`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (t) {
    let result = t('format.etaH', { value: h });
    if (m > 0) result += t('format.etaM', { value: m });
    return result;
  }
  return `${h}h ${m}m`;
}

export function formatDate(dateStr: string | null | undefined, t?: (key: string, params?: any) => string): string {
  if (!dateStr) return t ? t('format.unknown') : 'Unknown';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return t ? t('format.unknown') : 'Unknown';
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return t ? t('format.today') : 'Today';
  if (days === 1) return t ? t('format.yesterday') : 'Yesterday';
  if (days < 7) return t ? t('format.daysAgo', { count: days }) : `${days} days ago`;
  if (days < 30) return t ? t('format.weeksAgo', { count: Math.floor(days / 7) }) : `${Math.floor(days / 7)} weeks ago`;
  if (days < 365) return t ? t('format.monthsAgo', { count: Math.floor(days / 30) }) : `${Math.floor(days / 30)} months ago`;
  return date.toLocaleDateString();
}

export const formatCount = formatNumber;

export function formatNumber(num: number, t?: (key: string, params?: any) => string): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + (t ? t('format.million') : 'M');
  if (num >= 1000) return (num / 1000).toFixed(1) + (t ? t('format.thousand') : 'K');
  return num.toString();
}

export function truncate(str: string, len: number, t?: (key: string, params?: any) => string): string {
  if (str.length <= len) return str;
  return str.slice(0, len) + (t ? t('format.ellipsis') : '...');
}

export function parseJsonArray(str: string): string[] {
  try {
    const parsed = JSON.parse(str);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return str ? str.split(',').map((s) => s.trim()).filter(Boolean) : [];
  }
}

export function classNames(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}
