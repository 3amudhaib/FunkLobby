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
    description: 'The most popular FNF modding engine. Originally used on Mind Games Mod, intended to be a fix for the vanilla version\'s many issues while keeping the casual play aspect. Features extensive Lua scripting, character/stage editors, and comprehensive modding API.',
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
    id: 'kade',
    name: 'Kade Engine',
    description: 'One of the earliest popular FNF engines. Known for its accuracy-focused gameplay features including hitsounds, Mario judge, and combo system. A foundational engine that influenced many others.',
    repoOwner: 'KadeDev',
    repoName: 'Kade-Engine',
    downloadType: 'github',
    websiteUrl: 'https://gamebanana.com/tools/6464',
    license: 'Apache-2.0',
    features: ['Hitsounds', 'Mario Judge', 'Combo System', 'Accuracy Display', 'Custom Keybinds', 'Downscroll', 'Botplay', 'Song Timer'],
    platforms: ['Windows', 'Linux', 'macOS'],
    detectFiles: ['KadeEngine.exe', 'kadeengine.exe'],
    maintainers: ['KadeDev'],
  },
  {
    id: 'codename',
    name: 'Codename Engine',
    description: 'A cross-platform FNF engine aimed at simplifying modding focusing on softcoding, extensibility, and ease of use. Features a built-in mod browser, advanced charting tools, and comprehensive scripting API.',
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
    id: 'forever-legacy',
    name: 'Forever Engine Legacy',
    description: 'An open-source, quality of life and performance driven FNF mod engine. Legacy branch focuses on stability and performance improvements over the base game.',
    repoOwner: 'Yoshubs',
    repoName: 'Forever-Engine-Legacy',
    downloadType: 'github',
    websiteUrl: 'https://gamebanana.com/tools/7248',
    license: 'Apache-2.0',
    features: ['Performance Optimizations', 'Custom Keybinds', 'Options Menu', 'Botplay', 'Practice Mode', 'Song Timer', 'Accuracy Display'],
    platforms: ['Windows', 'Linux', 'macOS'],
    detectFiles: ['ForeverEngineLegacy.exe', 'ForeverEngine.exe'],
    maintainers: ['Yoshubs'],
  },
  {
    id: 'micd-up',
    name: "Mic'd Up Engine",
    description: "A mod to Friday Night Funkin' focused on adding replayability features, new gameplay mechanics, and quality-of-life improvements. Originally named FNF: EX Replayability.",
    repoOwner: 'Verwex',
    repoName: 'Funkin-Mic-d-Up-SC',
    downloadType: 'github',
    websiteUrl: 'https://gamebanana.com/tools/6670',
    license: 'Apache-2.0',
    features: ['Replay System', 'Custom Game Modes', 'New Mechanics', 'Modding Support', 'Accuracy System', 'Custom UI'],
    platforms: ['Windows'],
    detectFiles: ['MicdUp.exe', "Mic'dUp.exe", 'FunkinMicdUp.exe'],
    maintainers: ['Verwex'],
  },
  {
    id: 'andromeda',
    name: 'Andromeda Engine',
    description: 'A fork of Friday Night Funkin with customization and gameplay in mind. Features customizable note skins, a modifier system based on NotITG, and one of the best Lua modchart systems in FNF.',
    repoOwner: 'nebulazorua',
    repoName: 'andromeda-engine-legacy',
    downloadType: 'github',
    websiteUrl: 'https://gamebanana.com/tools/6620',
    license: 'Apache-2.0',
    features: ['Lua Modcharts', 'Custom Note Skins', 'Modifier System', 'Character Editor', 'Scroll Velocities', 'Advanced Options', 'Botplay'],
    platforms: ['Windows', 'Linux', 'macOS'],
    detectFiles: ['AndromedaEngine.exe', 'andromedaengine.exe'],
    maintainers: ['nebulazorua'],
  },
  {
    id: 'enigma',
    name: 'Enigma Engine',
    description: 'A fork of Kade Engine that serves as a love letter to the open source FNF community. Maintains Kade Engine\'s accuracy focus while adding new features and improvements.',
    repoOwner: 'EliteMasterEric',
    repoName: 'EnigmaEngine',
    downloadType: 'github',
    websiteUrl: 'https://gamebanana.com/tools/6939',
    license: 'Apache-2.0',
    features: ['Hitsounds', 'Accuracy Display', 'Custom Keybinds', 'Botplay', 'Modding Support', 'Performance Optimizations'],
    platforms: ['Windows', 'Linux', 'macOS'],
    detectFiles: ['EnigmaEngine.exe', 'enigmaengine.exe'],
    maintainers: ['EliteMasterEric'],
  },
  {
    id: 'leather',
    name: 'Leather Engine',
    description: 'A high-performance FNF engine built on PolyEngine. Designed for maximum performance and compatibility with Psych Engine mods while offering significant speed improvements.',
    repoOwner: 'RiverOaken',
    repoName: 'Leather-Engine',
    downloadType: 'github',
    websiteUrl: 'https://gamebanana.com/tools/7755',
    license: 'Apache-2.0',
    features: ['High Performance', 'Psych Mod Compatible', 'PolyEngine', 'Custom Shaders', 'Modding Support', 'Cross Platform'],
    platforms: ['Windows', 'Linux', 'macOS'],
    detectFiles: ['LeatherEngine.exe', 'leatherengine.exe'],
    maintainers: ['RiverOaken'],
  },
  {
    id: 'yoshicrafter',
    name: 'YoshiCrafter Engine',
    description: 'A fully softcoded FNF engine designed for modding via the mods folder without source compilation. Features a comprehensive modding API, custom states, and .ycemod file format.',
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
    id: 'crow',
    name: 'Crow Engine',
    description: 'An FNF engine focused on modding features and user experience. Built with the modding community in mind.',
    repoOwner: 'EyeDaleHim',
    repoName: 'Crow-Engine',
    downloadType: 'github',
    license: 'Apache-2.0',
    features: ['Modding Support', 'Custom UI', 'Scripting', 'Character Support'],
    platforms: ['Windows'],
    detectFiles: ['CrowEngine.exe', 'crowengine.exe'],
    maintainers: ['EyeDaleHim'],
  },
  {
    id: 'fps-plus',
    name: 'FPS Plus',
    description: 'An FNF engine that unlocks the frame rate and adds various performance and visual enhancements. Focuses on providing a smoother experience with higher FPS caps.',
    repoOwner: 'ThatRozebudDude',
    repoName: 'FPS-Plus-Public',
    downloadType: 'github',
    websiteUrl: 'https://gamebanana.com/tools/6462',
    license: 'Apache-2.0',
    features: ['Unlocked FPS', 'Performance Optimizations', 'Custom Keybinds', 'Botplay', 'Downscroll', 'Song Timer'],
    platforms: ['Windows', 'Linux'],
    detectFiles: ['FunkinFPSPlus.exe', 'FPSPlus.exe'],
    maintainers: ['ThatRozebudDude'],
  },
  {
    id: 'modding-plus',
    name: 'Modding Plus',
    description: 'A modification for FNF that adds more features for modders and players alike. Provides enhanced modding capabilities and quality-of-life improvements.',
    repoOwner: 'TheDrawingCoder-Gamer',
    repoName: 'Funkin',
    downloadType: 'github',
    websiteUrl: 'https://harlessben321.itch.io/fnf-modding-plus',
    license: 'Apache-2.0',
    features: ['Modding Tools', 'Custom Scripts', 'Enhanced Editor', 'HScript Support', 'Quality of Life'],
    platforms: ['Windows'],
    detectFiles: ['ModdingPlus.exe', 'FunkinModdingPlus.exe'],
    maintainers: ['TheDrawingCoder-Gamer'],
  },
  {
    id: 'forever-feather',
    name: 'Forever Engine Feather',
    description: 'An open-source, community driven FNF mod engine based on Forever Engine Legacy. Features a scripting system based on HScript/SScript, events system, and fully softcoded game content.',
    repoOwner: 'Joalor64GH',
    repoName: 'Forever-Engine-Feather',
    downloadType: 'github',
    websiteUrl: 'https://gamebanana.com/tools/7771',
    license: 'Apache-2.0',
    features: ['HScript/SScript Scripting', 'Events System', 'Softcoded Weeks', 'Softcoded Characters', 'Custom States', 'Modding Support'],
    platforms: ['Windows', 'Linux', 'macOS'],
    detectFiles: ['ForeverFeather.exe', 'FeatherEngine.exe'],
    maintainers: ['Joalor64GH', 'BeastlyGhost'],
  },
  {
    id: 'forever-plus',
    name: 'Forever Engine Plus',
    description: 'An enhanced version of Forever Engine with additional features and improvements. Built on the Forever Engine foundation with extra modding capabilities.',
    repoOwner: 'BasedUser',
    repoName: 'Forever-Engine-Plus',
    downloadType: 'github',
    license: 'Apache-2.0',
    features: ['Enhanced Modding', 'Custom Scripts', 'Performance Improvements', 'Quality of Life'],
    platforms: ['Windows', 'Linux'],
    detectFiles: ['ForeverPlus.exe', 'ForeverEnginePlus.exe'],
    maintainers: ['BasedUser'],
  },
  {
    id: 'forever-hybrid',
    name: 'Forever Engine Hybrid',
    description: 'A hybrid fork of Forever Engine that combines Forever Engine Legacy with HScript support and additional features. Brings scripting capabilities to the stable Legacy base.',
    repoOwner: 'some-fnf-archives',
    repoName: 'Forever-Engine-Hybrid',
    downloadType: 'github',
    license: 'Apache-2.0',
    features: ['HScript Support', 'Forever Legacy Base', 'Custom Scripts', 'Modding Support'],
    platforms: ['Windows', 'Linux'],
    detectFiles: ['ForeverHybrid.exe', 'HybridEngine.exe'],
    maintainers: ['some-fnf-archives'],
  },
  {
    id: 'forever-underscore',
    name: 'Forever Engine Underscore',
    description: 'A fork of Forever Engine with unique modifications and enhancements.',
    repoOwner: 'some-fnf-archives',
    repoName: 'Forever-Engine-Underscore',
    downloadType: 'github',
    license: 'Apache-2.0',
    features: ['Modding Support', 'Custom Features', 'Performance Tweaks'],
    platforms: ['Windows', 'Linux'],
    detectFiles: ['ForeverUnderscore.exe', 'UnderscoreEngine.exe'],
    maintainers: ['some-fnf-archives'],
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
    id: 'psych-mint',
    name: 'Psych Engine Mint',
    description: 'A feature extension and maintenance fork of Psych Engine. Keeps the engine up-to-date and maintains mod compatibility with the original Psych Engine while expanding functionality.',
    repoOwner: 'inky03',
    repoName: 'PsychEngineMint',
    downloadType: 'github',
    license: 'Apache-2.0',
    features: ['Psych Compatible', 'Extended Features', 'Maintenance Updates', 'Bug Fixes', 'Lua Scripting'],
    platforms: ['Windows', 'Linux', 'macOS'],
    detectFiles: ['PsychMint.exe', 'PsychEngineMint.exe'],
    maintainers: ['inky03'],
  },
  {
    id: 'dragon',
    name: 'Dragon Engine',
    description: 'A modified version of Psych Engine 0.6.3 with additional features for modding. Focused on providing enhanced modding capabilities while maintaining compatibility.',
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
    description: 'A highly modified version of Psych Engine 0.7.3 with extensive changes and additions. Built on the Psych Engine foundation with significant enhancements.',
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
    id: 'koala',
    name: 'KoalaEngine',
    description: 'An engine fork based on Psych Engine 0.6.3 with unique features and modifications. Used in several notable FNF mods.',
    repoOwner: 'DarkWeBareBears69',
    repoName: 'FNF-KoalaEngine',
    downloadType: 'github',
    license: 'Apache-2.0',
    features: ['Psych Engine Base', 'Mod Organizer', 'Multiple Editors', 'Custom Features', 'Lua Scripting'],
    platforms: ['Windows'],
    detectFiles: ['KoalaEngine.exe', 'koalaengine.exe'],
    maintainers: ['DarkWeBareBears69'],
  },
  {
    id: 'shattered',
    name: 'Shattered-Engine',
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
    id: 'optimized',
    name: 'Optimized Engine',
    description: 'A clean, faster, beginner-friendly FNF engine built for users with minimal modding experience. Focuses on performance and ease of use for creating mods.',
    repoOwner: 'dante-el-gamer',
    repoName: 'optimized-engine',
    downloadType: 'github',
    websiteUrl: 'https://dante-el-gamer.github.io/FNF-optimized-web/',
    license: 'Other',
    features: ['Beginner Friendly', 'Performance Focused', 'Easy Modding', 'Visual Editor'],
    platforms: ['Windows', 'Linux', 'macOS'],
    detectFiles: ['OptimizedEngine.exe'],
    maintainers: ['dante-el-gamer'],
  },
  {
    id: 'slushi',
    name: 'Slushi Engine',
    description: 'An FNF engine that allows you to make modcharts with Modcharting Tools and other SC Engine utilities. Focused on advanced chart creation.',
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
    id: 'cdev',
    name: 'CDEV Engine',
    description: 'An FNF engine intended to fix issues with the base game while adding many features. Built off FNF v0.2.7.1 with modding tools, dark mode, custom states, and HScript support.',
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
    id: 'beat',
    name: 'Beat Engine',
    description: 'An FNF engine focused on rhythm-based gameplay enhancements and modding capabilities.',
    repoOwner: null,
    repoName: null,
    downloadType: 'manual',
    features: ['Modding Support', 'Rhythm Features'],
    platforms: ['Windows'],
    detectFiles: ['BeatEngine.exe'],
    maintainers: [],
  },
  {
    id: 'sarv',
    name: 'Sarv Engine',
    description: 'The engine used in the Mid-Fight Masses mod. Features custom mechanics and assets specific to the Sarvente\'s Mid-Fight Masses experience.',
    repoOwner: null,
    repoName: null,
    downloadType: 'manual',
    websiteUrl: 'https://gamebanana.com/mods/4816',
    features: ['Custom Mechanics', 'Mid-Fight Masses', 'Modding Support'],
    platforms: ['Windows'],
    detectFiles: ['SarvEngine.exe', 'sarvengine.exe'],
    maintainers: [],
  },
  {
    id: 'aether',
    name: 'Aether Engine',
    description: 'An FNF engine written in C++ built in a custom game engine using raylib. Aims to introduce a more flexible way of modding Friday Night Funkin with a completely different tech stack.',
    repoOwner: 'silver984',
    repoName: 'AetherEngine',
    downloadType: 'github',
    license: 'MIT',
    features: ['Custom Game Engine', 'C++ Based', 'Raylib Graphics', 'Flexible Modding', 'Cross Platform'],
    platforms: ['Windows', 'Linux'],
    detectFiles: ['AetherEngine.exe', 'aetherengine.exe'],
    maintainers: ['silver984'],
  },
  {
    id: 'funkin-plus-plus',
    name: 'Funkin Plus Plus',
    description: 'An enhanced FNF engine with greater compatibility, improved features, and availability for mobile. Supports modcharts, advanced video, and multiple languages.',
    repoOwner: 'Psych-Plus-Team',
    repoName: 'FNF-PlusEngine',
    downloadType: 'github',
    license: 'Apache-2.0',
    features: ['Mobile Support', 'Modcharts', 'Advanced Video', 'Multiple Languages', 'Shader Support', 'Enhanced Lua', 'Android Support'],
    platforms: ['Windows', 'Linux', 'macOS', 'Android'],
    detectFiles: ['FunkinPlusPlus.exe', 'PlusEngine.exe'],
    maintainers: ['Psych-Plus-Team'],
  },
  {
    id: 'universe',
    name: 'Universe Engine',
    description: 'A comprehensive FNF engine built on Funkin 0.2.8 with modcharting tools, customizability, easier modding, HScript, custom HScript states, and cleaner UI.',
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
];
