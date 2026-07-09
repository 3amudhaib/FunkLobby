import axios from 'axios';
import { getPrisma } from './PrismaManager';
import { LogManager } from './LogManager';

const GB_API_V11 = 'https://gamebanana.com/apiv11';
const GB_API_CORE = 'https://api.gamebanana.com/Core';
const FNF_GAME_ID = 8694;

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

// Simple in-memory cache to avoid excessive GameBanana API calls
const searchCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 30_000; // 30 seconds

// Rate limiting: track last call time to enforce minimum interval
let lastApiCall = 0;
const MIN_CALL_INTERVAL = 1000; // 1 second between calls

function getCacheKey(params: { query?: string; sortBy?: string; page?: number }): string {
  return `${params.query || ''}_${params.sortBy || 'default'}_${params.page || 1}`;
}

function gameBananaTimestampToIso(...timestamps: unknown[]): string {
  for (const timestamp of timestamps) {
    const numericTimestamp =
      typeof timestamp === 'number'
        ? timestamp
        : typeof timestamp === 'string' && timestamp.trim()
          ? Number(timestamp)
          : NaN;

    if (Number.isFinite(numericTimestamp) && numericTimestamp > 0) {
      const date = new Date(numericTimestamp * 1000);
      if (!Number.isNaN(date.getTime())) return date.toISOString();
    }
  }

  return new Date().toISOString();
}

async function rateLimitedGet(url: string, config: any): Promise<any> {
  const now = Date.now();
  const wait = Math.max(0, MIN_CALL_INTERVAL - (now - lastApiCall));
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastApiCall = Date.now();
  return axios.get(url, config);
}

export class ModSourceManager {
  private static async fetchModDetailsBulk(modIds: number[]): Promise<any[]> {
    if (!modIds.length) return [];
    try {
      const fieldStr = 'name,Owner().name,text,Preview().sSubFeedImageUrl(),Url().sProfileUrl(),Files().aFiles(),date,downloads,Category().name';

      // Sequential requests with rate limiting to avoid GameBanana bans
      const results: any[] = [];
      for (const id of modIds) {
        try {
          const res = await rateLimitedGet(`${GB_API_CORE}/Item/Data`, {
            params: { itemtype: 'Mod', itemid: String(id), fields: fieldStr, format: 'json_min', return_keys: '1' },
            headers: { 'User-Agent': 'FunkLobby/1.0', 'Accept': 'application/json' },
            timeout: 10000,
          });
          if (res.data && !res.data.error) {
            results.push({ id, data: res.data });
          }
        } catch {
          // Skip failed fetches silently
        }
      }

      return results;
    } catch (err) {
      LogManager.warn('Bulk fetch failed for some mods', { error: String(err) });
      return [];
    }
  }

  static async searchMods(params: {
    query?: string; category?: string; sortBy?: string; page?: number; limit?: number;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 30;

    let sortFilter = 'default';
    if (params.sortBy === 'trending') sortFilter = 'trending';
    else if (params.sortBy === 'popular') sortFilter = 'downloads';
    else if (params.sortBy === 'updated') sortFilter = 'updated';
    else if (params.sortBy === 'newest') sortFilter = 'new';
    else if (params.sortBy === 'name') sortFilter = 'name';

    // Check cache first
    const cacheKey = getCacheKey({ query: params.query, sortBy: params.sortBy, page });
    const cached = searchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }

    try {
      const apiParams: any = {
        '_aFilters[Generic_Game]': FNF_GAME_ID,
        '_nPage': page,
        '_nPerpage': limit,
      };

      if (params.query) {
        apiParams['_sSearchString'] = params.query;
      }
      
      if (sortFilter === 'trending') apiParams['_sSort'] = 'default';
      else if (sortFilter === 'downloads') apiParams['_sSort'] = 'downloads';
      else if (sortFilter === 'updated') apiParams['_sSort'] = 'date_updated';
      else if (sortFilter === 'new') apiParams['_sSort'] = 'date_added';
      else if (sortFilter === 'name') apiParams['_sSort'] = 'title';

      LogManager.info(`Searching GameBanana API: ${JSON.stringify(apiParams)}`);

      const resp = await rateLimitedGet(`${GB_API_V11}/Mod/Index`, {
        params: apiParams,
        headers: { 'User-Agent': 'FunkLobby/1.0', 'Accept': 'application/json' },
        timeout: 15000,
      });

      const records = resp.data._aRecords || [];
      const total = resp.data._aMetadata?._nRecordCount || 0;

      // Extract basic info
      const basicMods = records.map((r: any) => {
        const catName = r._aRootCategory?._sName || 'Other';
        return {
          id: `gb_${r._idRow}`,
          sourceId: r._idRow,
          title: r._sName || 'Unknown Mod',
          author: r._aSubmitter?._sName || 'Unknown Author',
          version: r._sVersion || '1.0.0',
          description: r._sDescription || '',
          engine: 'psych',
          category: CATEGORY_MAP[catName] || catName,
          thumbnailUrl: [r._aPreviewMedia?._aImages?.[0]?._sBaseUrl, r._aPreviewMedia?._aImages?.[0]?._sFile].filter(Boolean).join('/') || '',
          bannerUrl: [r._aPreviewMedia?._aImages?.[1]?._sBaseUrl, r._aPreviewMedia?._aImages?.[1]?._sFile].filter(Boolean).join('/') || '',
          sourceUrl: r._sProfileUrl || `https://gamebanana.com/mods/${r._idRow}`,
          sourceType: 'gamebanana',
          updatedAt: gameBananaTimestampToIso(r._tsDateUpdated, r._tsDateAdded),
          downloadCount: r._nViewCount || 0, // Fallback to view count temporarily
          fileSize: 0,
        };
      });

      // Try fetching details to get download urls and correct sizes
      const modIds = basicMods.map((m: any) => m.sourceId);
      const details = await this.fetchModDetailsBulk(modIds);
      
      const prisma = getPrisma();
      
      const finalMods = [];

      for (const mod of basicMods) {
        const detail = details.find(d => d.id === mod.sourceId)?.data;
        if (detail) {
          mod.description = detail.text || mod.description;
          mod.downloadCount = detail.downloads || mod.downloadCount;
          
          const files = detail['Files().aFiles()'] || {};
          const firstFile = Object.values(files)[0] as any;
          if (firstFile) {
            mod.fileSize = firstFile._nFilesize || 0;
            (mod as any).downloadUrl = firstFile._sDownloadUrl;
          }
        }

        try {
          const existing = await prisma.mod.findFirst({ where: { sourceUrl: mod.sourceUrl } });
          let dbMod;
          if (existing) {
            dbMod = await prisma.mod.update({
              where: { id: existing.id },
              data: {
                title: mod.title,
                author: mod.author,
                description: mod.description,
                thumbnailUrl: mod.thumbnailUrl,
                bannerUrl: mod.bannerUrl,
                fileSize: mod.fileSize,
                downloadCount: mod.downloadCount,
                category: mod.category,
                updatedAt: mod.updatedAt,
              },
            });
          } else {
            dbMod = await prisma.mod.create({
              data: {
                title: mod.title,
                author: mod.author,
                description: mod.description,
                sourceUrl: mod.sourceUrl,
                sourceType: mod.sourceType,
                thumbnailUrl: mod.thumbnailUrl,
                bannerUrl: mod.bannerUrl,
                fileSize: mod.fileSize,
                downloadCount: mod.downloadCount,
                category: mod.category,
                engine: mod.engine,
                version: mod.version,
                tags: '', characters: '', songs: '', difficulty: 'Normal',
                screenshots: '', videos: '', dependencies: '', requirements: '',
                changelog: '', homepage: mod.sourceUrl,
              },
            });
          }
          finalMods.push({ ...dbMod, downloadUrl: (mod as any).downloadUrl });
        } catch (e) {
          LogManager.error('Failed to upsert mod', { error: String(e) });
          finalMods.push(mod); // Fallback to memory
        }
      }

      const result = { mods: finalMods, total, page, limit, totalPages: Math.ceil(total / limit) };
      searchCache.set(cacheKey, { data: result, timestamp: Date.now() });
      return result;

    } catch (err) {
      LogManager.warn('GameBanana API search failed, using local cache', { error: String(err) });
      
      // Offline fallback
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
        prisma.mod.count({ where })
      ]);

      return { mods, total, page, limit, totalPages: Math.ceil(total / limit), offline: true };
    }
  }

  static async getFeaturedMods() {
    return (await this.searchMods({ sortBy: 'popular', limit: 10 })).mods;
  }

  static async getTrendingMods() {
    return (await this.searchMods({ sortBy: 'trending', limit: 10 })).mods;
  }

  static async getPopularMods() {
    return (await this.searchMods({ sortBy: 'popular', limit: 10 })).mods;
  }

  static async getRecentlyPlayedMods(userId?: string) {
    const prisma = getPrisma();
    const installs = await prisma.install.findMany({
      where: { lastPlayedAt: { not: null } },
      orderBy: { lastPlayedAt: 'desc' },
      take: 10,
      include: { mod: true },
    });
    return installs.map((i: any) => i.mod);
  }

  static async syncGameBananaMods(query?: string): Promise<number> {
    try {
      LogManager.info('Syncing mods from GameBanana');
      const result = await this.searchMods({ query, sortBy: 'popular', limit: 50 });
      const count = result.mods.length;
      LogManager.info(`Sync complete: ${count} mods`);
      return count;
    } catch (err) {
      LogManager.error('Sync failed', { error: String(err) });
      return 0;
    }
  }
}
