import { create } from 'zustand';

interface DiscoverMod {
  id: string;
  gameBananaId: number;
  title: string;
  author: string;
  version: string;
  description: string;
  engine: string;
  category: string;
  thumbnailUrl: string;
  bannerUrl: string;
  sourceUrl: string;
  downloadCount: number;
  viewCount: number;
  likeCount: number;
  fileSize: number;
  updatedAt: string;
  createdAt: string;
  isInstalled: boolean;
}

interface SectionData {
  mods: DiscoverMod[];
  loading: boolean;
  loaded: boolean;
}

interface DiscoverState {
  sections: Record<string, SectionData>;
  cachedSections: Record<string, DiscoverMod[]>;
  offline: boolean;

  fetchSection: (section: string) => Promise<void>;
  refreshAll: () => Promise<void>;
  checkOnline: () => boolean;
}

const SECTION_NAMES = ['trending', 'updated', 'popular', 'favorites', 'featured', 'newest'] as const;

function getCachedKey(section: string): string {
  return `discover_${section}`;
}

function loadCache(section: string): DiscoverMod[] | null {
  try {
    const raw = localStorage.getItem(getCachedKey(section));
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function saveCache(section: string, data: DiscoverMod[]) {
  try {
    localStorage.setItem(getCachedKey(section), JSON.stringify(data));
  } catch {}
}

export const useDiscoverStore = create<DiscoverState>((set, get) => ({
  sections: Object.fromEntries(SECTION_NAMES.map(s => [s, { mods: [], loading: false, loaded: false }])) as Record<string, SectionData>,
  cachedSections: {},
  offline: false,

  checkOnline: () => navigator.onLine,

  fetchSection: async (section: string) => {
    const current = get().sections[section];
    if (current?.loaded && !get().offline) return;

    set(s => ({
      sections: { ...s.sections, [section]: { ...s.sections[section], loading: true } },
    }));

    // Show cached immediately
    const cached = loadCache(section);
    if (cached && cached.length > 0) {
      set(s => ({
        sections: { ...s.sections, [section]: { mods: cached, loading: true, loaded: false } },
      }));
    }

    try {
      const mods = await window.electronAPI.discoverGetSection(section);
      const typed: DiscoverMod[] = (mods || []).map((m: any) => ({
        id: m.id,
        gameBananaId: m.gameBananaId,
        title: m.title,
        author: m.author,
        version: m.version || '1.0.0',
        description: m.description || '',
        engine: m.engine || 'unknown',
        category: m.category || 'Other',
        thumbnailUrl: m.thumbnailUrl || '',
        bannerUrl: m.bannerUrl || '',
        sourceUrl: m.sourceUrl || '',
        downloadCount: m.downloadCount || 0,
        viewCount: m.viewCount || 0,
        likeCount: m.likeCount || 0,
        fileSize: m.fileSize || 0,
        updatedAt: m.updatedAt || '',
        createdAt: m.createdAt || '',
        isInstalled: m.isInstalled || false,
      }));

      saveCache(section, typed);

      set(s => ({
        sections: { ...s.sections, [section]: { mods: typed, loading: false, loaded: true } },
        offline: false,
      }));
    } catch {
      // If we have cached data, keep showing it
      const fallback = loadCache(section);
      if (fallback && fallback.length > 0) {
        set(s => ({
          sections: { ...s.sections, [section]: { mods: fallback, loading: false, loaded: true } },
          offline: !navigator.onLine,
        }));
      } else {
        set(s => ({
          sections: { ...s.sections, [section]: { ...s.sections[section], loading: false, loaded: true } },
          offline: !navigator.onLine,
        }));
      }
    }
  },

  refreshAll: async () => {
    const sections = get().sections;
    for (const section of Object.keys(sections)) {
      set(s => ({
        sections: { ...s.sections, [section]: { ...s.sections[section], loaded: false } },
      }));
      await get().fetchSection(section);
    }
  },
}));
