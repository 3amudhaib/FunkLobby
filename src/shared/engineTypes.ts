export type InstallMethod = 'binary' | 'source_only' | 'manual' | 'direct_download' | 'unknown_repo' | 'unavailable' | 'checking';

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
  if (!release) return 'unavailable';

  const assets = release.assets || [];
  if (assets.length === 0) return 'source_only';

  // Only Windows is supported for automatic installation
  const isWindows = process.platform === 'win32';
  if (!isWindows) return 'source_only';

  const names = assets.map(a => a.name.toLowerCase());

  const hasExe = names.some(n => n.endsWith('.exe'));
  const hint = entry.binaryAssetName?.toLowerCase();
  const hasHintMatch = hint ? names.some(n => n.includes(hint)) : false;

  const hasWindowsZip = names.some(n =>
    (n.endsWith('.zip') || n.endsWith('.7z'))
    && !n.includes('source')
    && !n.includes('src')
    && !n.includes('linux')
    && !n.includes('mac')
    && !n.includes('debug')
    && (n.includes('windows') || n.includes('win32') || n.includes('win64') || n.includes('win') || hasExe || hasHintMatch)
  );

  if (hasExe || hasWindowsZip) return 'binary';

  const hasOnlySource = names.some(n => n.includes('source') || n.includes('src'));
  if (hasOnlySource) return 'source_only';

  return 'unavailable';
}

const KNOWN_ENGINES: Array<{
  id: string; name: string; detectFiles: string[]; detectFolders: string[];
  detectFilesAny: string[]; detectContent: string[];
}> = [
  { id: 'psych', name: 'Psych Engine',
    detectFiles: ['PsychEngine.exe', 'psychengine.exe', 'PsychEngine.love'],
    detectFolders: ['psychengine', 'PsychEngine'],
    detectFilesAny: ['psychengine.hx', 'PsychEngine.hx', 'psych-engine'],
    detectContent: ['Psych Engine', 'PsychEngine', 'psychengine'] },
  { id: 'codename', name: 'Codename Engine',
    detectFiles: ['CodenameEngine.exe', 'codenameengine.exe'],
    detectFolders: ['codenameengine', 'CodenameEngine'],
    detectFilesAny: ['CodenameEngine.hx'],
    detectContent: ['Codename Engine', 'CodenameEngine'] },
  { id: 'cdev', name: 'CDEV Engine',
    detectFiles: ['CDEVEngine.exe', 'cdevengine.exe'],
    detectFolders: ['cdev', 'CDEV', 'cdevengine'],
    detectFilesAny: [],
    detectContent: ['CDEV'] },
  { id: 'v-slice', name: 'V-Slice',
    detectFiles: ['V-Slice.exe', 'V-Slice.x86_64', 'vslice', 'VSlice.exe'],
    detectFolders: ['v-slice', 'V-Slice', 'vslice'],
    detectFilesAny: [],
    detectContent: ['V-Slice', 'VSlice', 'v-slice'] },
  { id: 'fps-plus', name: 'FPS Plus',
    detectFiles: ['FPSPlus.exe', 'FPS+_Win64.zip'],
    detectFolders: ['fpsplus', 'FPSPlus', 'FPS Plus'],
    detectFilesAny: [],
    detectContent: ['FPS Plus', 'FPSPlus', 'fps-plus'] },
  { id: 'micd-up', name: "Mic'd Up",
    detectFiles: ["Mic'd Up.exe", 'MicdUp.exe'],
    detectFolders: ["mic'd up", 'micdup', "Mic'd Up"],
    detectFilesAny: [],
    detectContent: ["Mic'd Up", 'MicdUp', 'micd-up'] },
  { id: 'yoshicrafter', name: 'YoshiCrafter Engine',
    detectFiles: ['YoshiCrafterEngine.exe', 'YoshiCrafter.exe'],
    detectFolders: ['yoshicrafter', 'YoshiCrafter', 'YoshiCrafterEngine'],
    detectFilesAny: [],
    detectContent: ['YoshiCrafter', 'Yoshi', 'Yoshi Engine'] },
  { id: 'dragon', name: 'Dragon Engine',
    detectFiles: ['DragonEngine.exe', 'dragonengine.exe'],
    detectFolders: ['dragonengine', 'DragonEngine', 'Dragon Engine'],
    detectFilesAny: [],
    detectContent: ['Dragon Engine', 'DragonEngine'] },
  { id: 'shadow', name: 'Shadow Engine',
    detectFiles: ['ShadowEngine.exe', 'shadowengine.exe'],
    detectFolders: ['shadowengine', 'ShadowEngine', 'Shadow Engine'],
    detectFilesAny: [],
    detectContent: ['Shadow Engine', 'ShadowEngine'] },
  { id: 'shattered', name: 'Shattered Engine',
    detectFiles: ['ShatteredEngine.exe', 'shatteredengine.exe'],
    detectFolders: ['shatteredengine', 'ShatteredEngine'],
    detectFilesAny: [],
    detectContent: ['Shattered Engine', 'ShatteredEngine'] },
  { id: 'slushi', name: 'Slushi Engine',
    detectFiles: ['SlushiEngine.exe', 'slushiengine.exe'],
    detectFolders: ['slushiengine', 'SlushiEngine', 'Slushi Engine'],
    detectFilesAny: [],
    detectContent: ['Slushi Engine', 'SlushiEngine'] },
  { id: 'troll', name: 'Troll Engine',
    detectFiles: ['TrollEngine.exe', 'trollengine.exe'],
    detectFolders: ['trollengine', 'TrollEngine', 'Troll Engine'],
    detectFilesAny: [],
    detectContent: ['Troll Engine', 'TrollEngine'] },
  { id: 'universe', name: 'Solar Engine',
    detectFiles: ['UniverseEngine.exe', 'universeengine.exe', 'SolarEngine.exe', 'solarenengine.exe'],
    detectFolders: ['universeengine', 'UniverseEngine', 'Universe Engine', 'solarenengine', 'SolarEngine', 'Solar Engine'],
    detectFilesAny: [],
    detectContent: ['Universe Engine', 'UniverseEngine', 'Solar Engine', 'SolarEngine'] },
  { id: 'vanilla', name: 'Vanilla',
    detectFiles: ['Funkin.exe', 'funkin.exe', 'Friday Night Funkin.exe'],
    detectFolders: ['funkin', 'Friday Night Funkin'],
    detectFilesAny: [],
    detectContent: ['Friday Night Funkin', 'vanilla fnf'] },
  { id: 'funkin-plus-plus', name: 'Funkin Plus Plus',
    detectFiles: ['FunkinPlusPlus.exe', 'PlusEngine.exe'],
    detectFolders: ['funkinplusplus', 'FunkinPlusPlus', 'PlusEngine'],
    detectFilesAny: [],
    detectContent: ['Funkin Plus Plus', 'Plus Engine', 'FNF-PlusEngine'] },
];

export const ENGINE_CATALOG: EngineCatalogEntry[] = KNOWN_ENGINES.map((e) => ({
  id: e.id,
  name: e.name,
  description: getDescription(e.id),
  repoOwner: getRepoOwner(e.id),
  repoName: getRepoName(e.id),
  downloadType: getDownloadType(e.id),
  downloadUrl: getDownloadUrl(e.id),
  websiteUrl: getWebsiteUrl(e.id),
  license: 'Apache-2.0',
  features: getFeatures(e.id),
  platforms: getPlatforms(e.id),
  detectFiles: e.detectFiles,
  maintainers: [],
}));

export const ENGINE_DETECT_CONFIG = KNOWN_ENGINES;

function getDescription(id: string): string {
  const map: Record<string, string> = {
    psych: 'The most popular FNF modding engine with Lua scripting and comprehensive modding API.',
    codename: 'A cross-platform FNF engine simplifying modding with softcoding and built-in mod browser.',
    cdev: 'An FNF engine fixing base game issues with modding tools and HScript support.',
    'v-slice': 'A high-performance FNF engine focused on stability and modern modding features.',
    'fps-plus': 'An enhanced FNF engine with FPS improvements and additional features.',
    'micd-up': "A modified FNF engine with Mic'd Up features and improvements.",
    yoshicrafter: 'A fully softcoded FNF engine with comprehensive modding API.',
    dragon: 'A modified Psych Engine with enhanced modding capabilities.',
    shadow: 'A highly modified Psych Engine with extensive enhancements.',
    shattered: 'A fork of Psych Engine with unique modifications.',
    slushi: 'An FNF engine focused on modcharting tools and advanced chart creation.',
    troll: 'An FNF engine focused on unique gameplay experiences.',
    universe: 'A comprehensive FNF engine (formerly Universe Engine) with modcharting tools, HScript, and cross-platform support.',
    vanilla: 'The original Friday Night Funkin\' base game.',
    'funkin-plus-plus': 'An enhanced FNF engine with mobile support and advanced features.',
  };
  return map[id] || 'An FNF engine for modding.';
}

function getRepoOwner(id: string): string | null {
  const map: Record<string, string> = {
    psych: 'ShadowMario', codename: 'CodenameCrew', cdev: 'corecathx',
    yoshicrafter: 'CodenameCrew', dragon: 'DibyoExcel', shadow: 'ShadowEngineTeam',
    shattered: 'natesway', slushi: 'Slushi-Github', troll: 'troll-slaiyers',
    universe: 'Team-SolarEngine', 'v-slice': 'Psych-Slice', 'funkin-plus-plus': 'Psych-Plus-Team',
    'fps-plus': 'ThatRozebudDude', 'micd-up': 'Verwex', vanilla: 'FunkinCrew',
  };
  return map[id] || null;
}

function getRepoName(id: string): string | null {
  const map: Record<string, string> = {
    psych: 'FNF-PsychEngine', codename: 'CodenameEngine', cdev: 'FNF-CDEV-Engine',
    yoshicrafter: 'YoshiCrafterEngine', dragon: 'Dragon-Engine', shadow: 'FNF-Shadow-Engine',
    shattered: 'FNF-Shattered-Engine', slushi: 'Slushi-Engine', troll: 'FNF-Troll-Engine',
    universe: 'Solar-Engine-Archive', 'v-slice': 'P-Slice', 'funkin-plus-plus': 'FNF-PlusEngine',
    'fps-plus': 'FPS-Plus-Public', 'micd-up': 'Funkin-Mic-d-Up-SC', vanilla: 'Funkin',
  };
  return map[id] || null;
}

function getDownloadType(id: string): 'github' | 'direct' | 'manual' {
  const manual: string[] = [];
  return manual.includes(id) ? 'manual' : 'github';
}

function getDownloadUrl(id: string): string | undefined {
  const map: Record<string, string> = {
    // To enable auto-download for manual/source-only engines, add a
    // direct .zip download URL here. Example:
    //   forever: 'https://example.com/ForeverEngine.zip',
    //   'fps-plus': 'https://example.com/FPSPlus.zip',
    //   'micd-up': 'https://example.com/MicdUp.zip',
  };
  return map[id];
}

function getWebsiteUrl(id: string): string | undefined {
  const map: Record<string, string> = {
    psych: 'https://gamebanana.com/tools/6466', codename: 'https://gamebanana.com/tools/7555',
    cdev: 'https://core5570ryt.github.io/FNF-CDEV-Engine/',
    yoshicrafter: 'https://yoshicrafter29.github.io/YoshiCrafterEngine-Doc/',
    dragon: 'https://dibyoexcel.github.io/Dragon-Engine/',
    universe: 'https://solarengine.net',
    'v-slice': 'https://github.com/Psych-Slice/P-Slice',
    'fps-plus': 'https://gamebanana.com/mods/44201',
    'micd-up': 'https://gamebanana.com/tools/9009',
    vanilla: 'https://github.com/FunkinCrew/Funkin/releases',
  };
  return map[id];
}

function getFeatures(id: string): string[] {
  const map: Record<string, string[]> = {
    psych: ['Lua Scripting', 'Character Editor', 'Stage Editor', 'Chart Editor', 'Modding Menu'],
    codename: ['HScript Scripting', 'Mod Browser', 'Chart Editor', 'Mobile Support'],
    cdev: ['Modding Tools', 'Dark Mode', 'Custom States', 'HScript'],
    'v-slice': ['High Performance', 'Stability', 'Cross Platform', 'Lightweight'],
    'fps-plus': ['FPS Boost', 'Performance', 'Smooth Gameplay'],
    'micd-up': ['Voice Chat', 'Mic Features', 'Custom Mechanics'],
    yoshicrafter: ['Full Mod Support', 'HScript', 'Custom States', 'Botplay'],
    dragon: ['Psych Base', 'Enhanced Modding', 'Lua Scripting'],
    shadow: ['Psych Base', 'Enhanced Scripting', 'Custom UI'],
    shattered: ['Psych Base', 'Custom Modifications'],
    slushi: ['Modcharting Tools', 'Advanced Charts'],
    troll: ['Custom Mechanics', 'Modding Support'],
    universe: ['Modcharting Tools', 'HScript', 'Custom States', 'Cross Platform'],
    vanilla: ['Base Game', 'Original Content'],
    'funkin-plus-plus': ['Mobile Support', 'Modcharts', 'Multiple Languages', 'Shader Support'],
  };
  return map[id] || ['Modding Support'];
}

function getPlatforms(id: string): string[] {
  const map: Record<string, string[]> = {
    psych: ['Windows', 'Linux', 'macOS'], codename: ['Windows', 'Linux', 'macOS'],
    cdev: ['Windows', 'Linux'], yoshicrafter: ['Windows', 'Linux', 'macOS'],
    dragon: ['Windows', 'Linux', 'macOS'], shadow: ['Windows'], shattered: ['Windows'],
    slushi: ['Windows'], troll: ['Windows'], universe: ['Windows', 'Linux', 'macOS'],
    'v-slice': ['Windows', 'Linux', 'macOS'], 'funkin-plus-plus': ['Windows', 'Linux', 'macOS', 'Android'],
    vanilla: ['Windows', 'Linux', 'macOS'],
  };
  return map[id] || ['Windows'];
}
