export type InstallMethod = 'binary' | 'source_only' | 'manual' | 'direct_download' | 'unknown_repo' | 'no_releases';

export interface EngineCatalogEntry {
  id: string;
  name: string;
  description: string;
  repoOwner: string | null;
  repoName: string | null;
  downloadType: 'github' | 'direct' | 'manual';
  downloadUrl?: string;
  websiteUrl?: string;
  license?: string;
  features: string[];
  platforms: string[];
  detectFiles: string[];
  maintainers: string[];
  /** Populated at runtime by classifyEngineInstallMethod */
  installMethod?: InstallMethod;
  /** Asset name (or substring) to look for in GitHub releases, e.g. 'Windows64' */
  binaryAssetName?: string;
  /** Expected executable filename (without path), e.g. 'PsychEngine.exe' */
  executableName?: string;
  /** Whether this engine supports automatic install on current platform */
  supported?: boolean;
  /** If not supported, explains why (shown in UI) */
  installDisabledReason?: string;
  /** Validated repository URL (may differ from repoOwner/repoName due to redirects) */
  repoUrl?: string;
}

export interface InstalledEngine {
  id: string;
  name: string;
  type: string;
  version: string | null;
  description: string | null;
  author: string | null;
  repoUrl: string | null;
  websiteUrl: string | null;
  downloadUrl: string | null;
  releaseUrl: string | null;
  installPath: string | null;
  logoUrl: string | null;
  features: string | null;
  platforms: string | null;
  license: string | null;
  status: EngineStatus;
  error: string | null;
  isCustom: boolean;
  isDetected: boolean;
  installedAt: string | null;
  lastUpdatedAt: string | null;
  backupPath: string | null;
  createdAt: string;
  updatedAt: string;
}

export type EngineStatus = 'not_installed' | 'downloading' | 'installing' | 'installed' | 'updating' | 'repairing' | 'error' | 'corrupted' | 'download_failed' | 'broken_installation';

export interface EngineDownloadJob {
  jobId: string;
  engineId: string;
  status: 'pending' | 'downloading' | 'extracting' | 'installing' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  speed: number;
  eta: number;
  error?: string;
  version?: string;
}

export interface EngineUpdateInfo {
  engineId: string;
  currentVersion: string | null;
  latestVersion: string | null;
  updateAvailable: boolean;
  releaseUrl: string | null;
  status: 'checking' | 'up_to_date' | 'update_available' | 'failed' | 'unsupported';
}

export function classifyEngineInstallMethod(entry: EngineCatalogEntry, release: { tag_name: string; assets: Array<{ name: string; browser_download_url: string; size: number }> } | null): InstallMethod {
  if (entry.downloadType === 'manual') return 'manual';
  if (entry.downloadType === 'direct') {
    // Only classify as direct_download if the URL points to a real binary file
    if (entry.downloadUrl && (entry.downloadUrl.endsWith('.zip') || entry.downloadUrl.endsWith('.exe') || entry.downloadUrl.endsWith('.7z') || entry.downloadUrl.endsWith('.love'))) {
      return 'direct_download';
    }
    return 'unknown_repo';
  }
  if (!entry.repoOwner || !entry.repoName) return 'unknown_repo';
  if (!release || !release.assets || release.assets.length === 0) return 'no_releases';

  // Only Windows is supported for automatic installation
  const isWindows = process.platform === 'win32';
  if (!isWindows) return 'source_only';

  const names = release.assets.map(a => a.name.toLowerCase());

  // Strict binary detection: must have an actual .exe file, or a zip/7z
  // that clearly contains a Windows build (not marked as source/debug/linux/mac)
  const hasExe = names.some(n => n.endsWith('.exe'));
  const hasWindowsZip = names.some(n =>
    (n.endsWith('.zip') || n.endsWith('.7z'))
    && !n.includes('source')
    && !n.includes('src')
    && !n.includes('linux')
    && !n.includes('mac')
    && !n.includes('debug')
    && (n.includes('windows') || n.includes('win32') || n.includes('win64') || n.includes('win') || hasExe)
  );

  if (hasExe || hasWindowsZip) return 'binary';

  const hasOnlySource = names.some(n => n.includes('source') || n.includes('src') || n.endsWith('.zip'));
  if (hasOnlySource) return 'source_only';

  return 'no_releases';
}

export const ENGINE_CATALOG: EngineCatalogEntry[] = [
  {
    id: 'psych',
    name: 'Psych Engine',
    description: 'The most popular FNF modding engine. Features extensive Lua scripting, character/stage editors, and comprehensive modding API.',
    repoOwner: 'ShadowMario',
    repoName: 'FNF-PsychEngine',
    downloadType: 'github',
    websiteUrl: 'https://gamebanana.com/tools/6466',
    license: 'Apache-2.0',
    features: ['Lua Scripting', 'Character Editor', 'Stage Editor', 'Week Editor', 'Modding Menu', 'Custom Note Skins', 'Downscroll', 'Botplay', 'Chart Editor', 'Cutscene Support'],
    platforms: ['Windows', 'Linux', 'macOS'],
    detectFiles: ['PsychEngine.exe', 'psychengine.exe', 'PsychEngine.love'],
    maintainers: ['ShadowMario'],
  },
  {
    id: 'codename',
    name: 'Codename Engine',
    description: 'A cross-platform FNF engine simplifying modding with softcoding, extensibility, and ease of use. Features a built-in mod browser, advanced charting tools, and comprehensive scripting API.',
    repoOwner: 'CodenameCrew',
    repoName: 'CodenameEngine',
    downloadType: 'github',
    websiteUrl: 'https://gamebanana.com/tools/7555',
    license: 'Apache-2.0',
    features: ['HScript Scripting', 'Built-in Mod Browser', 'Advanced Chart Editor', 'Character Editor', 'Stage Editor', 'Custom Notes', 'Custom Events', 'Mobile Support'],
    platforms: ['Windows', 'Linux', 'macOS'],
    detectFiles: ['CodenameEngine.exe', 'codenameengine.exe'],
    maintainers: ['CodenameCrew'],
  },
  {
    id: 'cdev',
    name: 'CDEV Engine',
    description: 'An FNF engine fixing base game issues while adding modding tools, dark mode, custom states, and HScript support.',
    repoOwner: 'corecathx',
    repoName: 'FNF-CDEV-Engine',
    downloadType: 'github',
    websiteUrl: 'https://core5570ryt.github.io/FNF-CDEV-Engine/',
    license: 'Apache-2.0',
    features: ['Modding Tools', 'Dark Mode', 'Custom States', 'HScript Support', 'Chart Editor', 'Character Editor', 'Stage Editor', 'Week Editor'],
    platforms: ['Windows', 'Linux'],
    detectFiles: ['CDEVEngine.exe', 'cdevengine.exe'],
    maintainers: ['corecathx'],
  },
  {
    id: 'yoshicrafter',
    name: 'YoshiCrafter Engine',
    description: 'A fully softcoded FNF engine for modding via the mods folder without source compilation. Features a comprehensive modding API and .ycemod file format.',
    repoOwner: 'CodenameCrew',
    repoName: 'YoshiCrafterEngine',
    downloadType: 'github',
    websiteUrl: 'https://yoshicrafter29.github.io/YoshiCrafterEngine-Doc/',
    license: 'Apache-2.0',
    features: ['Full Mod Support', 'HScript Scripting', 'Custom States', 'Custom Keybinds', 'Botplay', 'Custom Note Skins', 'Developer Mode', 'Freeplay Statistics'],
    platforms: ['Windows', 'Linux', 'macOS'],
    detectFiles: ['YoshiCrafterEngine.exe', 'YoshiCrafter.exe'],
    maintainers: ['YoshiCrafter29', 'CodenameCrew'],
  },
  {
    id: 'dragon',
    name: 'Dragon Engine',
    description: 'A modified version of Psych Engine 0.6.3 with additional features focused on enhanced modding capabilities while maintaining compatibility.',
    repoOwner: 'DibyoExcel',
    repoName: 'Dragon-Engine',
    downloadType: 'github',
    websiteUrl: 'https://dibyoexcel.github.io/Dragon-Engine/',
    license: 'Apache-2.0',
    features: ['Psych Engine Base', 'Enhanced Modding', 'Custom Features', 'Lua Scripting'],
    platforms: ['Windows', 'Linux', 'macOS'],
    detectFiles: ['DragonEngine.exe', 'dragonengine.exe'],
    maintainers: ['DibyoExcel'],
  },
  {
    id: 'shadow',
    name: 'Shadow Engine',
    description: 'A highly modified version of Psych Engine 0.7.3 with extensive enhancements in scripting, custom UI, and new features.',
    repoOwner: 'ShadowEngineTeam',
    repoName: 'FNF-Shadow-Engine',
    downloadType: 'github',
    license: 'Apache-2.0',
    features: ['Psych Engine Base', 'Extensive Modifications', 'Enhanced Scripting', 'Custom UI', 'New Features'],
    platforms: ['Windows'],
    detectFiles: ['ShadowEngine.exe', 'shadowengine.exe'],
    maintainers: ['ShadowEngineTeam'],
  },
  {
    id: 'shattered',
    name: 'Shattered Engine',
    description: 'A fork of Psych Engine with unique modifications and enhancements for modding.',
    repoOwner: 'natesway',
    repoName: 'FNF-Shattered-Engine',
    downloadType: 'github',
    license: 'Apache-2.0',
    features: ['Psych Engine Base', 'Custom Modifications', 'Scripting'],
    platforms: ['Windows'],
    detectFiles: ['ShatteredEngine.exe', 'shatteredengine.exe'],
    maintainers: ['natesway'],
  },
  {
    id: 'slushi',
    name: 'Slushi Engine',
    description: 'An FNF engine for creating modcharts with Modcharting Tools and SC Engine utilities. Focused on advanced chart creation.',
    repoOwner: 'Slushi-Github',
    repoName: 'Slushi-Engine',
    downloadType: 'github',
    license: 'Apache-2.0',
    features: ['Modcharting Tools', 'SC Engine Utilities', 'Advanced Charts', 'Scripting'],
    platforms: ['Windows'],
    detectFiles: ['SlushiEngine.exe', 'slushiengine.exe'],
    maintainers: ['Slushi-Github'],
  },
  {
    id: 'troll',
    name: 'Troll Engine',
    description: 'An FNF engine focused on providing unique gameplay experiences and modding capabilities.',
    repoOwner: 'riconuts',
    repoName: 'FNF-Troll-Engine',
    downloadType: 'github',
    license: 'Apache-2.0',
    features: ['Modding Support', 'Custom Mechanics', 'Scripting'],
    platforms: ['Windows'],
    detectFiles: ['TrollEngine.exe', 'trollengine.exe'],
    maintainers: ['riconuts'],
  },
  {
    id: 'universe',
    name: 'Universe Engine',
    description: 'A comprehensive FNF engine with modcharting tools, HScript, custom states, cleaner UI, and cross-platform support.',
    repoOwner: 'Team-UniverseEngine',
    repoName: 'Universe-Engine',
    downloadType: 'github',
    websiteUrl: 'https://universe-engine.netlify.app/',
    license: 'Apache-2.0',
    features: ['Modcharting Tools', 'HScript', 'Custom States', 'Cleaner UI', 'Customizability', 'Cross Platform'],
    platforms: ['Windows', 'Linux', 'macOS'],
    detectFiles: ['UniverseEngine.exe', 'universeengine.exe'],
    maintainers: ['Team-UniverseEngine'],
  },
  {
    id: 'v-slice',
    name: 'V-Slice',
    description: 'A high-performance FNF engine focused on stability, compatibility, and modern modding features. Built for speed and reliability across all platforms.',
    repoOwner: 'yourloser',
    repoName: 'V-Slice',
    downloadType: 'github',
    websiteUrl: 'https://github.com/yourloser/V-Slice',
    license: 'Apache-2.0',
    features: ['High Performance', 'Modding Support', 'Cross Platform', 'Stability', 'Lightweight'],
    platforms: ['Windows', 'Linux', 'macOS'],
    detectFiles: ['V-Slice.exe', 'V-Slice.x86_64', 'vslice'],
    maintainers: ['yourloser'],
  },
  {
    id: 'funkin-plus-plus',
    name: 'Funkin Plus Plus',
    description: 'An enhanced FNF engine with greater compatibility, mobile support, modcharts, advanced video, and multiple languages.',
    repoOwner: 'Psych-Plus-Team',
    repoName: 'FNF-PlusEngine',
    downloadType: 'github',
    license: 'Apache-2.0',
    features: ['Mobile Support', 'Modcharts', 'Advanced Video', 'Multiple Languages', 'Shader Support', 'Enhanced Lua', 'Android Support'],
    platforms: ['Windows', 'Linux', 'macOS', 'Android'],
    detectFiles: ['FunkinPlusPlus.exe', 'PlusEngine.exe'],
    maintainers: ['Psych-Plus-Team'],
  },
];
