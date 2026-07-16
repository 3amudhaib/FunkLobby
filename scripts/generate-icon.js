const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const pngToIco = require('png-to-ico').default || require('png-to-ico');

async function main() {
  const srcPath = path.join(__dirname, '..', 'assets', 'icon.png');
  const icoPath = path.join(__dirname, '..', 'assets', 'icon.ico');

  if (!fs.existsSync(srcPath)) {
    console.error('Source icon not found:', srcPath);
    process.exit(1);
  }

  const sizes = [16, 20, 24, 32, 40, 48, 64, 128, 256];
  const tempDir = path.join(__dirname, '..', 'build');
  fs.mkdirSync(tempDir, { recursive: true });

  const tempFiles = [];
  for (const size of sizes) {
    const outPath = path.join(tempDir, `icon_${size}x${size}.png`);
    await sharp(srcPath)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(outPath);
    tempFiles.push(outPath);
  }

  const icoBuffer = await pngToIco(tempFiles);
  fs.writeFileSync(icoPath, icoBuffer);

  for (const f of tempFiles) {
    try { fs.unlinkSync(f); } catch {}
  }

  console.log(`Generated multi-resolution ICO at ${icoPath} with ${sizes.length} sizes`);
}

main().catch(err => { console.error(err); process.exit(1); });
