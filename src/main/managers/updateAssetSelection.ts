export interface UpdateAssetLike {
  name: string;
  browser_download_url: string;
  size: number;
}

export function selectPreferredAsset(assets: UpdateAssetLike[], platform = process.platform, arch = process.arch): UpdateAssetLike | null {
  const isWin = platform === 'win32';
  const scored = assets.map(asset => {
    const name = asset.name.toLowerCase();
    let score = 0;

    if (isWin) {
      if (name.endsWith('.exe') || name.endsWith('.msi')) score += 130;
      if (name.endsWith('.zip') || name.endsWith('.7z')) score += 80;
      if (name.includes('setup') || name.includes('installer') || name.includes('nsis')) score += 160;
      if (name.includes('portable')) score += 20;
      if (name.includes('win') || name.includes('windows')) score += 20;
      if (name.includes('x64') || name.includes('64') || name.includes('amd64')) score += 15;
      if (name.includes('x86') || name.includes('32') || name.includes('ia32')) score += 10;
      if (arch === 'arm64' && (name.includes('arm64') || name.includes('aarch64'))) score += 20;
    } else if (platform === 'darwin') {
      if (name.endsWith('.dmg') || name.endsWith('.app')) score += 150;
      if (name.endsWith('.zip')) score += 90;
      if (name.includes('mac') || name.includes('darwin') || name.includes('osx')) score += 50;
    } else {
      if (name.endsWith('.appimage')) score += 150;
      if (name.endsWith('.deb') || name.endsWith('.rpm')) score += 100;
      if (name.includes('linux') || name.includes('ubuntu')) score += 50;
    }

    if (name.includes('source') || name.includes('src')) score -= 200;
    if (name.includes('delta') || name.includes('diff')) score += 20;
    if (name.includes('blockmap') || name.includes('yml')) score -= 200;

    return { asset, score };
  });

  scored.sort((a, b) => b.score - a.score || a.asset.name.localeCompare(b.asset.name));
  return scored[0]?.score > 0 ? scored[0].asset : null;
}
