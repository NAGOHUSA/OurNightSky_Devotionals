// generate-our-night-sky.js
// Emits the v2.0 schema your iOS app expects, with API fallbacks in order:
// GROK -> OPENAI -> DEEPSEEK

import fs from "fs";
import path from "path";

const TZ = "America/New_York";

// ---------- Config via env ----------
const LOCATION = process.env.ONS_LOCATION || "Macon, Georgia";
const THEME_DEFAULT = "wonder";

const GROK_API_BASE = process.env.GROK_API_BASE || "https://api.x.ai/v1";
const OPENAI_API_BASE = process.env.OPENAI_API_BASE || "https://api.openai.com/v1";
const DEEPSEEK_API_BASE = process.env.DEEPSEEK_API_BASE || "https://api.deepseek.com/v1";

const GROK_MODEL = process.env.GROK_MODEL || "grok-2-mini";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";

const GROK_API_KEY = process.env.GROK_API_KEY || process.env.XAI_API_KEY || "";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || "";

// ---------- Dates ----------
function todayLocalISO(tz = TZ) {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-CA", { timeZone: tz }); // YYYY-MM-DD
  return dateStr;
}

function isoNow() {
  return new Date().toISOString();
}

const DATE = process.env.ONS_DATE || todayLocalISO();

// ---------- Output paths (CHANGED) ----------
const OUT_DIR = path.join("devotionals");
// WRITE FILE AS <YYYY-MM-DD>.json (no "devotional-" prefix)
const OUT_FILE = path.join(OUT_DIR, `${DATE}.json`);

// ---------- Prompt ----------
const systemPrompt = `
You are a Christian devotional writer who blends current night-sky highlights
with Scripture and encouragement. Write *concise* content grounded in visible
celestial events for the user's location and date.

STRICTLY return JSON ONLY, following this schema exactly:
{
  "id": "devotional-YYYY-MM-DD",
  "date": "YYYY-MM-DD",
  "title": "string (max ~80 chars)",
  "content": "1-2 short paragraphs, warm tone, tie sky to faith (200-300 words total)",
  "scriptureReference": "Book Ch:Vs or range (e.g., Job 9:9)",
  "celestialConnection": "1-2 sentences linking specific, likely-visible features",
  "theme": "one-word (e.g., wonder, hope, trust, comfort)",
  "moonPhase": "string",
  "moonIllumination": "percentage like '75%'",
  "visiblePlanets": "comma-separated list or 'None'",
  "specialEvents": "short phrase (or 'None')",
  "constellations": ["1..5 names"],
  "bestViewingTime": "e.g., '9:00 PM - 10:30 PM local time'",
  "season": "Winter|Spring|Summer|Autumn",
  "location": "City, State",
  "createdAt": "ISO timestamp",
  "isFallback": false,
  "version": "2.0"
}

CRITICAL RULES:
- Use the provided date and location.
- Make astronomy plausible for that season/date in the Northern Hemisphere.
- Keep "content" uplifting, theologically sound, and practical.
- Keep within the word targets.
- Return ONLY the JSON object, no backticks, no extra text.
`;

function userPrompt({ date = DATE, location = LOCATION, theme = THEME_DEFAULT }) {
  return `
Date: ${date}
Location: ${location}
Theme (hint): ${theme}

Ensure "id" is "devotional-${date}" and "location" exactly "${location}".
`;
}

// ---------- Helpers ----------
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function extractJson(text) {
  const match = text.match(/\{[\s\S]*\}$/);
  return match ? match[0] : text;
}

function validateShape(obj) {
  const must = [
    "id","date","title","content","scriptureReference","celestialConnection","theme",
    "moonPhase","moonIllumination","visiblePlanets","specialEvents","constellations",
    "bestViewingTime","season","location","createdAt","isFallback","version"
  ];
  for (const k of must) if (!(k in obj)) throw new Error(`Missing field: ${k}`);
  if (!Array.isArray(obj.constellations)) throw new Error("constellations must be array");
  if (obj.version !== "2.0") throw new Error("version must be '2.0'");
}

async function callOpenAICompat({ base, apiKey, model, messages }) {
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
      max_tokens: 700
    })
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText} – ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty content from provider");
  return content;
}

// ---------- Providers in desired order ----------
const providers = [
  {
    name: "GROK",
    enabled: !!GROK_API_KEY,
    call: () =>
      callOpenAICompat({
        base: GROK_API_BASE,
        apiKey: GROK_API_KEY,
        model: GROK_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt({}) }
        ]
      })
  },
  {
    name: "OPENAI",
    enabled: !!OPENAI_API_KEY,
    call: () =>
      callOpenAICompat({
        base: OPENAI_API_BASE,
        apiKey: OPENAI_API_KEY,
        model: OPENAI_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt({}) }
        ]
      })
  },
  {
    name: "DEEPSEEK",
    enabled: !!DEEPSEEK_API_KEY,
    call: () =>
      callOpenAICompat({
        base: DEEPSEEK_API_BASE,
        apiKey: DEEPSEEK_API_KEY,
        model: DEEPSEEK_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt({}) }
        ]
      })
  }
];

async function main() {
  ensureDir(OUT_DIR);

  let lastErr = null;
  let usedProvider = null;
  let raw = null;

  for (const p of providers) {
    if (!p.enabled) continue;
    try {
      usedProvider = p.name;
      raw = await p.call();
      break;
    } catch (err) {
      lastErr = err;
      usedProvider = null;
    }
  }

  if (!raw) {
    const fallback = {
      id: `devotional-${DATE}`,
      date: DATE,
      title: "The Heavens Declare",
      content:
        "Step outside and look up. Even when clouds hide the stars, God's handiwork never ceases. Ask Him to brighten your heart as surely as dawn follows night.",
      scriptureReference: "Psalm 19:1",
      celestialConnection:
        "Autumn evenings often reveal the royal 'W' of Cassiopeia and the Andromeda region rising high in the northeast.",
      theme: THEME_DEFAULT,
      moonPhase: "Unknown",
      moonIllumination: "—",
      visiblePlanets: "Jupiter, Saturn",
      specialEvents: "None",
      constellations: ["Cassiopeia", "Andromeda"],
      bestViewingTime: "9:00 PM - 10:30 PM local time",
      season: "Autumn",
      location: LOCATION,
      createdAt: isoNow(),
      isFallback: true,
      version: "2.0"
    };
    fs.writeFileSync(OUT_FILE, JSON.stringify(fallback, null, 2));
    console.error("All providers failed. Wrote placeholder:", lastErr?.message || lastErr);
    process.exit(0);
  }

  let parsed;
  try {
    parsed = JSON.parse(extractJson(raw));
  } catch (e) {
    const trimmed = extractJson(raw).trim();
    parsed = JSON.parse(trimmed);
  }

  parsed.id = `devotional-${DATE}`;
  parsed.date = DATE;
  parsed.location = LOCATION;
  parsed.createdAt = isoNow();
  parsed.version = "2.0";
  parsed.isFallback = (usedProvider !== "GROK");

  validateShape(parsed);

  fs.writeFileSync(OUT_FILE, JSON.stringify(parsed, null, 2));
  console.log(`Wrote ${OUT_FILE} via ${usedProvider}`);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
