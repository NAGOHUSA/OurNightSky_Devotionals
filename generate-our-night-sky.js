// generate-our-night-sky.js
// DeepSeek -> OpenAI -> Grok failover, strict JSON output, duplicate guard

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---- Config via ENV (see your workflow YAML) ----
const DEEPSEEK_API_KEY  = process.env.DEEPSEEK_API_KEY || "";
const OPENAI_API_KEY    = process.env.OPENAI_API_KEY   || "";
const GROK_API_KEY      = process.env.GROK_API_KEY     || "";

const DEEPSEEK_API_BASE = (process.env.DEEPSEEK_API_BASE || "https://api.deepseek.com/v1").replace(/\/+$/,"");
const OPENAI_API_BASE   = (process.env.OPENAI_API_BASE   || "https://api.openai.com/v1").replace(/\/+$/,"");
const GROK_API_BASE     = (process.env.GROK_API_BASE     || "https://api.x.ai/v1").replace(/\/+$/,"");

const DEEPSEEK_MODEL    = process.env.DEEPSEEK_MODEL || "deepseek-chat";
const OPENAI_MODEL      = process.env.OPENAI_MODEL   || "gpt-4o-mini";
const GROK_MODEL        = process.env.GROK_MODEL     || "grok-2-latest";

const LOCATION          = process.env.ONS_LOCATION || "Macon, Georgia";
const THEME_DEFAULT     = process.env.ONS_THEME_DEFAULT || "wonder";

// ---- Dates & paths ----
const DATE_UTC   = new Date().toISOString().slice(0, 10); // YYYY-MM-DD in UTC
const OUT_DIR    = path.join(process.cwd(), "devotionals");
const OUT_FILE   = path.join(OUT_DIR, `${DATE_UTC}.json`);

// ---- Helpers ----
function sha256(s) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function extractJson(text) {
  // Try to parse direct JSON first
  try { return JSON.parse(text); } catch {}
  // Try to find the first top-level JSON object in the content
  const start = text.indexOf("{");
  const end   = text.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    const candidate = text.slice(start, end + 1);
    try { return JSON.parse(candidate); } catch {}
  }
  // As a last resort, try to un-fence code blocks
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    try { return JSON.parse(fenced[1]); } catch {}
  }
  return null;
}

async function withTimeout(promise, ms = 30000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    const res = await promise(controller.signal);
    clearTimeout(t);
    return res;
  } catch (e) {
    clearTimeout(t);
    throw e;
  }
}

function buildPrompt() {
  return [
    {
      role: "system",
      content:
        "You are a careful writer who produces Christian devotionals tied to the night's sky. " +
        "You must return ONLY valid JSON following the user's schema—no prose, no extra keys, no markdown."
    },
    {
      role: "user",
      content:
`Write a short, uplifting devotional that blends current night-sky context with Scripture.

Requirements:
- Date (UTC): ${DATE_UTC}
- Location: ${LOCATION}
- Tone: Encouraging, reverent, accessible
- Theme seed (rotate styles as needed): ${THEME_DEFAULT}
- Keep scientific details plausible (e.g., constellations visible in October from mid-northern latitudes, general moon phase, notable meteor showers or planets if seasonally reasonable).

Output JSON ONLY in this schema (no extra fields, no comments):

{
  "app": "Our Night Sky",
  "id": "<uuid-v4 or unique hash>",
  "date": "${DATE_UTC}",
  "title": "<catchy devotional title>",
  "scriptureReference": "<Book Chapter:Verse>",
  "content": "<devotional body in 180-300 words, single paragraph or two short paragraphs>",
  "celestialConnection": "<1-2 sentences connecting the scripture to the night's sky>",
  "theme": "<single word or short phrase>",
  "moonPhase": "<Waxing/Waning/Crescent/Gibbous/Full/New/Unknown>",
  "visiblePlanets": ["<Planet 1>", "<Planet 2>"],
  "createdAt": "<ISO8601 UTC timestamp>"
}`
    }
  ];
}

// ---- Provider calls (each returns string content) ----
async function callDeepSeek(messages) {
  if (!DEEPSEEK_API_KEY) throw new Error("DeepSeek missing API key");
  const url = `${DEEPSEEK_API_BASE}/chat/completions`;
  return withTimeout(async (signal) => {
    const r = await fetch(url, {
      method: "POST",
      signal,
      headers: {
        "Authorization": `Bearer ${DEEPSEEK_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages,
        temperature: 0.7,
        response_format: { type: "json_object" }
      })
    });
    if (!r.ok) throw new Error(`DeepSeek HTTP ${r.status}`);
    const j = await r.json();
    const txt = j?.choices?.[0]?.message?.content?.trim();
    if (!txt) throw new Error("DeepSeek empty content");
    return txt;
  });
}

async function callOpenAI(messages) {
  if (!OPENAI_API_KEY) throw new Error("OpenAI missing API key");
  const url = `${OPENAI_API_BASE}/chat/completions`;
  return withTimeout(async (signal) => {
    const r = await fetch(url, {
      method: "POST",
      signal,
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages,
        temperature: 0.7,
        response_format: { type: "json_object" }
      })
    });
    if (!r.ok) throw new Error(`OpenAI HTTP ${r.status}`);
    const j = await r.json();
    const txt = j?.choices?.[0]?.message?.content?.trim();
    if (!txt) throw new Error("OpenAI empty content");
    return txt;
  });
}

async function callGrok(messages) {
  if (!GROK_API_KEY) throw new Error("Grok missing API key");
  const url = `${GROK_API_BASE}/chat/completions`;
  return withTimeout(async (signal) => {
    const r = await fetch(url, {
      method: "POST",
      signal,
      headers: {
        "Authorization": `Bearer ${GROK_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: GROK_MODEL,
        messages,
        temperature: 0.7,
        // x.ai is generally OpenAI-compatible; if it errors on response_format, remove it:
        response_format: { type: "json_object" }
      })
    });
    if (!r.ok) throw new Error(`Grok HTTP ${r.status}`);
    const j = await r.json();
    const txt = j?.choices?.[0]?.message?.content?.trim();
    if (!txt) throw new Error("Grok empty content");
    return txt;
  });
}

// ---- Main run ----
(async () => {
  try {
    if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

    // Refuse to overwrite today's file if it already exists
    if (fs.existsSync(OUT_FILE)) {
      console.error(`Devotional for today already exists: ${OUT_FILE}`);
      process.exit(1);
    }

    const messages = buildPrompt();

    // Try providers in order: DeepSeek -> OpenAI -> Grok
    const attempts = [
      { name: "DeepSeek", fn: () => callDeepSeek(messages) },
      { name: "OpenAI",   fn: () => callOpenAI(messages) },
      { name: "Grok",     fn: () => callGrok(messages) }
    ];

    let usedProvider = null;
    let rawText = null;

    for (const a of attempts) {
      try {
        rawText = await a.fn();
        usedProvider = a.name;
        break; // success: stop trying others
      } catch (err) {
        console.warn(`[${a.name}] failed: ${(err && err.message) || err}`);
      }
    }

    if (!rawText) {
      console.error("All providers failed. No devotional written.");
      process.exit(1);
    }

    const parsed = extractJson(rawText);
    if (!parsed || typeof parsed !== "object") {
      console.error("Provider returned non-JSON or unparseable JSON.");
      process.exit(1);
    }

    // Normalize + augment fields
    const nowIso = new Date().toISOString();
    parsed.app = "Our Night Sky";
    parsed.date = DATE_UTC;
    parsed.createdAt = parsed.createdAt || nowIso;

    // Add IDs/hashes if missing
    const contentForHash = `${parsed.title || ""}\n${parsed.content || ""}\n${DATE_UTC}`;
    const id = sha256(contentForHash).slice(0, 32);
    parsed.id = parsed.id || id;

    // Provider flags
    parsed.usedProvider = usedProvider;
    parsed.isFallback = !usedProvider; // false if any provider succeeded

    // Basic field sanity
    if (!parsed.title || !parsed.content) {
      console.error("Parsed JSON missing required fields (title/content).");
      process.exit(1);
    }

    // Defense-in-depth: refuse exact duplicate vs yesterday
    const y = new Date(`${DATE_UTC}T00:00:00Z`);
    y.setUTCDate(y.getUTCDate() - 1);
    const yName = y.toISOString().slice(0, 10) + ".json";
    const yPath = path.join(OUT_DIR, yName);

    if (fs.existsSync(yPath)) {
      try {
        const prev = JSON.parse(fs.readFileSync(yPath, "utf8"));
        const prevHash = sha256(`${prev.title || ""}\n${prev.content || ""}`);
        const currHash = sha256(`${parsed.title}\n${parsed.content}`);
        if (prevHash === currHash) {
          console.error("Content matches yesterday — refusing to write duplicate.");
          process.exit(1);
        }
      } catch {
        // ignore read/parse errors of yesterday file
      }
    }

    // Write file
    fs.writeFileSync(OUT_FILE, JSON.stringify(parsed, null, 2), "utf8");
    console.log(`Wrote: ${OUT_FILE} via ${usedProvider}`);
  } catch (err) {
    console.error(`Fatal error: ${(err && err.stack) || err}`);
    process.exit(1);
  }
})();
