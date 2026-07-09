import axios from 'axios';
import { getPrisma } from './PrismaManager';
import { LogManager } from './LogManager';

const GB_API_V11 = 'https://gamebanana.com/apiv11';
const GB_API_CORE = 'https://api.gamebanana.com/Core';
const FNF_GAME_ID = 8694;
const USER_AGENT = 'FunkLobby/1.0';
const REQUEST_TIMEOUT = 15000;

const CATEGORY_MAP: Record<string, string> = {
  'Executables': 'Engine',
  'Characters': 'Character',
  'Skins': 'Character',
  'Songs': 'Song',
  'Sound': 'Audio',
  'Other/Misc': 'Other',
  'WIPs': 'WIP',
  'Scripts': 'Script',
  'GUIs': 'UI',
  'Mod Folders': 'Mod',
  'Psych Engine': 'Engine',
};

const CATEGORY_BY_UI: Record<string, string[]> = {};
for (const [gb, ui] of Object.entries(CATEGORY_MAP)) {
  if (!CATEGORY_BY_UI[ui]) CATEGORY_BY_UI[ui] = [];
  CATEGORY_BY_UI[ui].push(gb);
}

const ENGINE_KEYWORDS: Array<{ keywords: string[]; engineId: string }> = [
  { keywords: ['psych engine', 'psychengine'], engineId: 'psych' },
  { keywords: ['kade engine', 'kadeengine', 'kade'], engineId: 'kade' },
  { keywords: ['codename engine', 'codename'], engineId: 'codename' },
  { keywords: ['forever engine', 'forever'], engineId: 'forever' },
  { keywords: ['leather engine', 'leather'], engineId: 'leather' },
  { keywords: ['v-slice', 'vslice'], engineId: 'vslice' },
  { keywords: ['p-slice', 'pslice', 'p slice'], engineId: 'p-slice' },
  { keywords: ['fnf love', 'fnf love engine'], engineId: 'fnf-love' },
  { keywords: ['js engine', 'js engine'], engineId: 'js-engine' },
  { keywords: ['fps plus', 'fpsplus'], engineId: 'fps-plus' },
  { keywords: ['pe achieved'], engineId: 'psych' },
  { keywords: ['popcorn engine', 'popcorn'], engineId: 'psych' },
  { keywords: ['haxe engine'], engineId: 'psych' },
  { keywords: ['flixel'], engineId: 'psych' },
  { keywords: ['ale-psych', 'ale psych'], engineId: 'ale-psych' },
  { keywords: ['basegame', 'base game'], engineId: 'basegame' },
];

type SortId = 'trending' | 'popular' | 'updated' | 'newest' | 'name' | 'downloads';

function apiSortParam(sortBy: string): string | null {
  const map: Record<string, string> = {
    trending: 'default',
    popular: 'downloads',
    downloads: 'downloads',
    updated: 'date_updated',
    newest: 'date_added',
    name: 'title',
  };
  return map[sortBy] || null;
}

function gameBananaTimestampToIso(...timestamps: unknown[]): string {
  for (const ts of timestamps) {
    const numeric = typeof ts === 'number' ? ts
      : typeof ts === 'string' && ts.trim() ? Number(ts) : NaN;
    if (Number.isFinite(numeric) && numeric > 0) {
      const d = new Date(numeric * 1000);
      if (!Number.isNaN(d.getTime())) return d.toISOString();
    }
  }
  return new Date().toISOString();
}

export function detectEngineFromMod(record: any): string {
  const haystack = [
    record._sName || record.name || '',
    record._sDescription || '',
    record._sText || record.text || '',
    (record._aTags || record.tags || []).map((t: any) => typeof t === 'string' ? t : t._sName || t.name || '').join(' '),
  ].join(' ').toLowerCase();

  for (const entry of ENGINE_KEYWORDS) {
    for (const kw of entry.keywords) {
      if (haystack.includes(kw)) {
        return entry.engineId;
      }
    }
  }
  return 'psych';
}

interface SearchParams {
  query?: string;
  category?: string;
  engine?: string;
  sortBy?: string;
  page?: number;
  limit?: number;
}

interface SearchResult {
  mods: any[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  offline?: boolean;
}

let lastApiCall = 0;
const MIN_CALL_INTERVAL = 800;

async function rateLimitedGet(url: string, config: any): Promise<any> {
  const now = Date.now();
  const wait = Math.max(0, MIN_CALL_INTERVAL - (now - lastApiCall));
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastApiCall = Date.now();
  return axios.get(url, config);
}

const searchCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 120_000;
const detailsCache = new Map<number, { data: any; timestamp: number }>();
const DETAILS_CACHE_TTL = 300_000;

function searchCacheKey(p: SearchParams): string {
  return `${p.query || ''}|${p.category || ''}|${p.engine || ''}|${p.sortBy || 'default'}|${p.page || 1}|${p.limit || 30}`;
}

export class GameBananaSearch {

  static async searchMods(params: SearchParams): Promise<SearchResult> {
    const page = params.page || 1;
    const limit = Math.min(params.limit || 30, 50);

    const cacheKey = searchCacheKey(params);
    const cached = searchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }

    try {
      const apiParams: Record<string, any> = {
        '_aFilters[Generic_Game]': FNF_GAME_ID,
        '_nPage': page,
        '_nPerpage': limit,
      };

      if (params.query) {
        apiParams['_sSearch'] = params.query;
      }

      const sortField = apiSortParam(params.sortBy || 'trending');
      if (sortField) {
        apiParams['_sSort'] = sortField;
      }

      const resp = await rateLimitedGet(`${GB_API_V11}/Mod/Index`, {
        params: apiParams,
        headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' },
        timeout: REQUEST_TIMEOUT,
      });

      const records: any[] = resp.data._aRecords || [];
      const total = resp.data._aMetadata?._nRecordCount || records.length;

      let mods = records.map((r: any) => {
        const gbCat = r._aRootCategory?._sName || 'Other';
        const mappedCat = CATEGORY_MAP[gbCat] || gbCat;
        return {
          id: `gb_${r._idRow}`,
          gameBananaId: r._idRow,
          title: r._sName || 'Unknown Mod',
          author: r._aSubmitter?._sName || 'Unknown Author',
          version: r._sVersion || '1.0.0',
          description: r._sDescription || r._sText || '',
          engine: detectEngineFromMod(r),
          category: mappedCat,
          gbCategory: gbCat,
          thumbnailUrl: buildThumbnailUrl(r._aPreviewMedia),
          bannerUrl: buildBannerUrl(r._aPreviewMedia),
          sourceUrl: r._sProfileUrl || `https://gamebanana.com/mods/${r._idRow}`,
          sourceType: 'gamebanana',
          downloadCount: r._nDownloadCount || 0,
          viewCount: r._nViewCount || 0,
          likeCount: r._nLikeCount || 0,
          fileSize: 0,
          updatedAt: gameBananaTimestampToIso(r._tsDateUpdated, r._tsDateAdded),
          createdAt: gameBananaTimestampToIso(r._tsDateAdded),
          isInstalled: false,
        };
      });

      mods = this.filterMods(mods, params);

      const modIds = mods.map((m: any) => m.gameBananaId).filter(Boolean);
      const installed = await this.getInstalledStatus(modIds);
      mods = mods.map((m: any) => ({ ...m, isInstalled: installed.has(m.gameBananaId) }));

      const result: SearchResult = {
        mods,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };

      searchCache.set(cacheKey, { data: result, timestamp: Date.now() });
      return result;

    } catch (err: any) {
      LogManager.warn('GameBanana API search failed, falling back to local DB', {
        error: err.message,
      });
      return this.fallbackToLocalDB(params);
    }
  }

  static async getModDetails(gameBananaId: number): Promise<any | null> {
    const cached = detailsCache.get(gameBananaId);
    if (cached && Date.now() - cached.timestamp < DETAILS_CACHE_TTL) {
      return cached.data;
    }
    try {
      const res = await rateLimitedGet(`${GB_API_CORE}/Item/Data`, {
        params: {
          itemtype: 'Mod',
          itemid: String(gameBananaId),
          fields: 'name,Owner().name,text,Preview().sSubFeedImageUrl(),Url().sProfileUrl(),Files().aFiles(),date,downloads,Category().name',
          format: 'json_min',
          return_keys: '1',
        },
        headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' },
        timeout: 10000,
      });
      if (res.data && !res.data.error) {
        detailsCache.set(gameBananaId, { data: res.data, timestamp: Date.now() });
        return res.data;
      }
      return null;
    } catch {
      return null;
    }
  }

  static async getModDownloadUrl(gameBananaId: number): Promise<string | null> {
    const detail = await this.getModDetails(gameBananaId);
    if (!detail) return null;
    const files = detail['Files().aFiles()'] || {};
    const firstFile = Object.values(files)[0] as any;
    return firstFile?._sDownloadUrl || null;
  }

  static async getFeaturedMods() {
    return (await this.searchMods({ sortBy: 'downloads', limit: 10 })).mods;
  }

  static async getTrendingMods() {
    return (await this.searchMods({ sortBy: 'trending', limit: 10 })).mods;
  }

  static async getPopularMods() {
    return (await this.searchMods({ sortBy: 'popular', limit: 10 })).mods;
  }

  static async syncGameBananaMods(query?: string): Promise<number> {
    try {
      const result = await this.searchMods({ query, sortBy: 'popular', limit: 50 });
      const prisma = getPrisma();
      for (const mod of result.mods) {
        try {
          const existing = await prisma.mod.findFirst({ where: { sourceUrl: mod.sourceUrl } });
          if (existing) {
            await prisma.mod.update({
              where: { id: existing.id },
              data: {
                title: mod.title,
                author: mod.author,
                description: mod.description,
                thumbnailUrl: mod.thumbnailUrl,
                bannerUrl: mod.bannerUrl,
                downloadCount: mod.downloadCount,
                category: mod.category,
                engine: mod.engine,
                updatedAt: mod.updatedAt,
              },
            });
          } else {
            await prisma.mod.create({
              data: {
                id: mod.id,
                title: mod.title,
                author: mod.author,
                version: mod.version,
                description: mod.description,
                engine: mod.engine,
                category: mod.category,
                thumbnailUrl: mod.thumbnailUrl,
                bannerUrl: mod.bannerUrl,
                sourceUrl: mod.sourceUrl,
                sourceType: mod.sourceType,
                downloadCount: mod.downloadCount,
                fileSize: mod.fileSize,
                tags: '', characters: '', songs: '', difficulty: 'Normal',
                screenshots: '', videos: '', dependencies: '', requirements: '',
                changelog: '', homepage: mod.sourceUrl,
              },
            });
          }
        } catch { /* skip upsert errors */ }
      }
      return result.mods.length;
    } catch {
      return 0;
    }
  }

  static detectEngineFromMod(record: any): string {
    return detectEngineFromMod(record);
  }

  static clearCache() {
    searchCache.clear();
    detailsCache.clear();
  }

  private static async getInstalledStatus(gameBananaIds: number[]): Promise<Set<number>> {
    if (!gameBananaIds.length) return new Set();
    const set = new Set<number>();
    try {
      const prisma = getPrisma();
      const urls = gameBananaIds.map(id => `https://gamebanana.com/mods/${id}`);
      const mods = await prisma.mod.findMany({
        where: { sourceUrl: { in: urls } },
        select: { sourceUrl: true, isInstalled: true },
      });
      for (const m of mods) {
        if (m.isInstalled) {
          const match = m.sourceUrl?.match(/gamebanana\.com\/mods\/(\d+)/);
          if (match) set.add(Number(match[1]));
        }
      }
    } catch { /* ignore */ }
    return set;
  }

  private static filterMods(mods: any[], params: SearchParams): any[] {
    let filtered = mods;

    if (params.category && params.category !== 'All') {
      const gbCats = CATEGORY_BY_UI[params.category];
      if (gbCats) {
        filtered = filtered.filter((m: any) => gbCats.includes(m.gbCategory));
      }
    }

    if (params.engine) {
      const eng = params.engine.toLowerCase();
      filtered = filtered.filter((m: any) =>
        m.engine.toLowerCase() === eng ||
        m.description.toLowerCase().includes(eng)
      );
    }

    return filtered;
  }

  private static async fallbackToLocalDB(params: SearchParams): Promise<SearchResult> {
    const page = params.page || 1;
    const limit = Math.min(params.limit || 30, 50);
    try {
      const prisma = getPrisma();
      const where: any = {};
      if (params.query) {
        where.OR = [
          { title: { contains: params.query } },
          { author: { contains: params.query } },
        ];
      }
      const [mods, total] = await Promise.all([
        prisma.mod.findMany({ where, skip: (page - 1) * limit, take: limit }),
        prisma.mod.count({ where }),
      ]);
      return { mods: mods || [], total: total || 0, page, limit, totalPages: Math.ceil((total || 0) / limit), offline: true };
    } catch {
      return { mods: [], total: 0, page, limit, totalPages: 0, offline: true };
    }
  }
}

function buildThumbnailUrl(media: any): string {
  try {
    const img = media?._aImages?.[0];
    if (img?._sBaseUrl && img?._sFile) return `${img._sBaseUrl}/${img._sFile}`;
    const vid = media?._aVideos?.[0];
    if (vid?._sBaseUrl && vid?._sFile) return `${vid._sBaseUrl}/${vid._sFile}`;
  } catch { /* ignore */ }
  return '';
}

function buildBannerUrl(media: any): string {
  try {
    const img = media?._aImages?.[1];
    if (img?._sBaseUrl && img?._sFile) return `${img._sBaseUrl}/${img._sFile}`;
    const img0 = media?._aImages?.[0];
    if (img0?._sBaseUrl && img0?._sFile) return `${img0._sBaseUrl}/${img0._sFile}`;
  } catch { /* ignore */ }
  return '';
}
