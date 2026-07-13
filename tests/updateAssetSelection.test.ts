import assert from 'node:assert/strict';
import test from 'node:test';
import { selectPreferredAsset } from '../src/main/managers/updateAssetSelection';

test('prefers setup installer over portable exe and zip archives when present', () => {
  const assets = [
    { name: 'FunkLobby Setup.exe', browser_download_url: 'https://example.com/setup.exe', size: 1200000 },
    { name: 'FunkLobby Portable.exe', browser_download_url: 'https://example.com/portable.exe', size: 1100000 },
    { name: 'FunkLobby-win-x64.zip', browser_download_url: 'https://example.com/app.zip', size: 900000 },
  ];

  const selected = selectPreferredAsset(assets, 'win32', 'x64');
  assert.equal(selected?.name, 'FunkLobby Setup.exe');
});

test('prefers NSIS installer over portable exe when no archive exists', () => {
  const assets = [
    { name: 'FunkLobby Portable.exe', browser_download_url: 'https://example.com/portable.exe', size: 1100000 },
    { name: 'FunkLobby Setup.exe', browser_download_url: 'https://example.com/setup.exe', size: 1200000 },
  ];

  const selected = selectPreferredAsset(assets, 'win32', 'x64');
  assert.equal(selected?.name, 'FunkLobby Setup.exe');
});
