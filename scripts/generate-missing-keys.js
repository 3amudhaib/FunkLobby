const fs = require("fs");
const path = require("path");

const LOCALES_DIR = path.resolve(__dirname, "../src/renderer/locales");
const LANG = process.argv[2];
const OUTPUT = process.argv[3];

if (!LANG) {
  console.error("Usage: node scripts/generate-missing-keys.js <lang> [output-file]");
  console.error("Example: node scripts/generate-missing-keys.js fr");
  process.exit(1);
}

const source = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, "en.json"), "utf8"));
const targetPath = path.join(LOCALES_DIR, `${LANG}.json`);

let target = {};
if (fs.existsSync(targetPath)) {
  target = JSON.parse(fs.readFileSync(targetPath, "utf8"));
}

// Keys to skip (metadata/formatting)
const skipKeys = new Set(["app.name", "app.version", "format.ellipsis"]);

const missing = {};
let count = 0;
for (const [key, val] of Object.entries(source)) {
  if (skipKeys.has(key)) continue;
  const existing = target[key];
  if (existing === undefined || existing === val) {
    missing[key] = val;
    count++;
  }
}

const outPath = OUTPUT || path.join(LOCALES_DIR, `${LANG}-missing.json`);
fs.writeFileSync(outPath, JSON.stringify(missing, null, 2) + "\n", "utf8");
console.log(`Found ${count} missing/English keys for "${LANG}"`);
console.log(`Written to: ${outPath}`);
