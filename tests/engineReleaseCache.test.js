const test = require('node:test');
const assert = require('node:assert/strict');

const { loadReleaseFromCache } = require('../dist/main/managers/engineReleaseCache.js');

test('fetches and caches release data when no cache exists', async () => {
  let readCalls = 0;
  let writeCalls = 0;
  const fetched = { tag_name: 'v1.2.3', assets: [] };

  const result = await loadReleaseFromCache({
    cacheFile: '/tmp/release.json',
    readCache: async () => {
      readCalls += 1;
      return null;
    },
    writeCache: async () => {
      writeCalls += 1;
    },
    fetchLatest: async () => fetched,
  });

  assert.equal(result?.tag_name, 'v1.2.3');
  assert.equal(readCalls, 1);
  assert.equal(writeCalls, 1);
});
