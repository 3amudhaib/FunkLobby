export interface GitHubReleaseLike {
  tag_name: string;
  name?: string;
  body?: string;
  published_at?: string;
  html_url?: string;
  assets: Array<{
    name: string;
    browser_download_url: string;
    size: number;
  }>;
}

export interface ReleaseCacheEntry<T> {
  fetchedAt: number;
  data: T | null;
}

export interface LoadReleaseFromCacheOptions<T> {
  readCache: () => Promise<ReleaseCacheEntry<T> | null>;
  writeCache: (entry: ReleaseCacheEntry<T>) => Promise<void>;
  fetchLatest: () => Promise<T | null>;
  ttlMs?: number;
}

export async function loadReleaseFromCache<T>({
  readCache,
  writeCache,
  fetchLatest,
  ttlMs = 6 * 60 * 60 * 1000,
}: LoadReleaseFromCacheOptions<T>): Promise<T | null> {
  const cached = await readCache();
  if (cached?.data && Date.now() - cached.fetchedAt < ttlMs) {
    return cached.data;
  }

  const fresh = await fetchLatest();
  if (!fresh) {
    if (cached?.data) {
      return cached.data;
    }
    return null;
  }

  await writeCache({ fetchedAt: Date.now(), data: fresh });
  return fresh;
}
