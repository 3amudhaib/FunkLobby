const fs = require("fs");
const path = require("path");

const LOCALES_DIR = path.resolve(__dirname, "../src/renderer/locales");

const source = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, "en.json"), "utf8"));
const sourceKeys = Object.keys(source);
const sourceValues = Object.values(source);
const total = sourceKeys.length;

const files = [
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "ja", name: "Japanese" },
  { code: "pt", name: "Portuguese" },
  { code: "ru", name: "Russian" },
  { code: "zh", name: "Chinese" },
  { code: "ar", name: "Arabic" },
];

console.log("Translation Check Report");
console.log("=".repeat(60));
console.log(`English keys: ${total}\n`);

for (const { code, name } of files) {
  const fp = path.join(LOCALES_DIR, `${code}.json`);
  if (!fs.existsSync(fp)) {
    console.log(`${name} (${code}): FILE NOT FOUND`);
    return;
  }
  const locale = JSON.parse(fs.readFileSync(fp, "utf8"));
  let translated = 0;
  let placeholders = 0;
  const stillEnglish = [];

  for (let i = 0; i < total; i++) {
    const key = sourceKeys[i];
    const enVal = sourceValues[i];
    const locVal = locale[key];

    if (locVal === undefined) {
      stillEnglish.push({ key, enVal, reason: "missing" });
      placeholders++;
    } else if (locVal === enVal) {
      stillEnglish.push({ key, enVal, reason: "same as English" });
      placeholders++;
    } else if (
      key !== "app.name" &&
      key !== "app.version" &&
      key !== "format.ellipsis" &&
      locVal.trim() === enVal.trim()
    ) {
      stillEnglish.push({ key, enVal, reason: "same as English (trimmed)" });
      placeholders++;
    } else {
      translated++;
    }
  }

  const pct = ((translated / total) * 100).toFixed(1);
  const status = pct === "100.0" ? "COMPLETE" : `${pct}% done`;

  console.log(`${name} (${code}): ${status}`);
  console.log(`  Translated: ${translated}/${total} keys`);
  if (stillEnglish.length > 0) {
    const sample = stillEnglish.slice(0, 5);
    for (const { key, enVal, reason } of sample) {
      console.log(`    - ${key} (${reason}): "${enVal}"`);
    }
    if (stillEnglish.length > 5) {
      console.log(`    ... and ${stillEnglish.length - 5} more`);
    }
  }
  console.log();
}
