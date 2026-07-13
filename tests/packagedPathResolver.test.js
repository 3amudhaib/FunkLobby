const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { resolvePackagedAssetPath } = require('../dist/main/utils/packagedPathResolver');

test('prefers resources path when packaged asset exists there', () => {
  const appPath = 'C:/app';
  const resourcesPath = 'C:/resources';

  const result = resolvePackagedAssetPath(['assets', 'icon.png'], {
    appPath,
    resourcesPath,
    isPackaged: true,
    exists: (candidate) => candidate === path.join(resourcesPath, 'assets', 'icon.png'),
  });

  assert.equal(result, path.join(resourcesPath, 'assets', 'icon.png'));
});

test('falls back to app path when resource path does not contain the asset', () => {
  const appPath = 'C:/app';
  const resourcesPath = 'C:/resources';

  const result = resolvePackagedAssetPath(['assets', 'icon.png'], {
    appPath,
    resourcesPath,
    isPackaged: true,
    exists: (candidate) => candidate === path.join(appPath, 'assets', 'icon.png'),
  });

  assert.equal(result, path.join(appPath, 'assets', 'icon.png'));
});
