// content-tracker.js
// Scans /devotionals and updates content_tracker.json with a light index.

import fs from "fs";
import path from "path";

const DIR = "devotionals";
const TRACK = "content_tracker.json";

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

const DATE_FILE_REGEX = /^\d{4}-\d{2}-\d{2}\.json$/; // NEW: 2025-10-13.json

function main() {
  if (!fs.existsSync(DIR)) {
    fs.writeFileSync(TRACK, JSON.stringify({ latest: null, count: 0, files: [] }, null, 2));
    console.log("No devotionals yet; wrote empty tracker.");
    return;
  }

  const files = fs
    .readdirSync(DIR)
    .filter((f) => DATE_FILE_REGEX.test(f))
    .sort(); // YYYY-MM-DD.json sorts chronologically

  let latest = null;
  const records = [];

  for (const f of files) {
    const full = path.join(DIR, f);
    const obj = readJson(full);
    if (!obj) continue;
    const record = {
      id: obj.id,
      date: obj.date,
      title: obj.title,
      location: obj.location,
      theme: obj.theme,
      season: obj.season,
      createdAt: obj.createdAt,
      version: obj.version
    };
    records.push({ file: f, ...record });
    latest = record; // last is newest
  }

  const out = {
    latest,
    count: records.length,
    files: records
  };

  fs.writeFileSync(TRACK, JSON.stringify(out, null, 2));
  console.log(`Updated ${TRACK}: ${records.length} items`);
}

main();
