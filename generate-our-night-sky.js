// generate-devotional.js — Multi-provider (DeepSeek → OpenAI → Groq)
// Outputs EXACT schema required by the app.
// Node 18+ (global fetch). No external deps.

import fs from "node:fs/promises";
import path from "node:path";

// ===== Provider order (configurable) =====
const PROVIDERS = (process.env.DEVOTIONAL_PROVIDERS || "deepseek,openai,groq")
  .split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
const PRIMARY_PROVIDER = PROVIDERS[0] || "deepseek";

// ===== Content & cost controls =====
const MAX_TOKENS   = Number(process.env.DEVOTIONAL_MAX_TOKENS || 500);
const TEMPERATURE  = Number(process.env.DEVOTIONAL_TEMPERATURE || 0.7);
const TIMEOUT_MS   = Number(process.env.DEVOTIONAL_TIMEOUT_MS  || 25000);
const MAX_ATTEMPTS = Number(process.env.DEVOTIONAL_MAX_ATTEMPTS || 2);
const WORDS_MIN    = Number(process.env.DEVOTIONAL_WORDS_MIN || 220);
const WORDS_MAX    = Number(process.env.DEVOTIONAL_WORDS_MAX || 320);
const THEME        = process.env.DEVO_THEME || "";

// ===== Provider config =====
const DS = {
  apiKey: process.env.DEEPSEEK_API_KEY,
  model:  process.env.DEEPSEEK_MODEL || "deepseek-chat",
  url:    "https://api.deepseek.com/chat/completions",
};
const OA = {
  apiKey: process.env.OPENAI_API_KEY,
  model:  process.env.OPENAI_MODEL || "gpt-4o-mini",
  url:    "https://api.openai.com/v1/chat/completions",
};
const GQ = {
  apiKey: process.env.GROQ_API_KEY,
  model:  process.env.GROQ_MODEL || "llama-3.1-8b-instant",
  url:    "https://api.groq.com/openai/v1/chat/completions",
};

// ===== Utilities =====
function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }
function seasonFromMonth(m){ // 0-based month, Northern hemisphere default
  return (m<=1||m===11) ? "Winter" : (m<=4) ? "Spring" : (m<=7) ? "Summer" : "Autumn";
}
function isoDateOnly(d=new Date()){ return d.toISOString().slice(0,10); }
function nowIso(){ return new Date().toISOString(); }

async function postJSON(url, body, headers, timeoutMs){
  const controller = new AbortController();
  const timer = setTimeout(()=>controller.abort(), timeoutMs);
  try{
    const res = await fetch(url, { method:"POST", signal:controller.signal,
      headers:{ "Content-Type":"application/json", ...headers },
      body: JSON.stringify(body)
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text };
  } finally { clearTimeout(timer); }
}

function buildMessagesForJSON({dateISO, theme, seasonGuess}) {
  const system = [
    "You are a Christian devotional writer and astronomy explainer.",
    `Write a short daily devotional ${WORDS_MIN}-${WORDS_MAX} words, warm and theologically sound.`,
    "Return ONLY a single JSON object (no markdown, no code fences).",
    "JSON keys (exactly these, all required):",
    "id, date, title, content, scriptureReference, celestialConnection, moonPhase, visiblePlanets, specialEvents, bestViewingTime, season, createdAt, isFallback",
    "- id: 'devotional-YYYY-MM-DD' (match the date)",
    "- date: YYYY-MM-DD (same as provided date)",
    "- title: <= 6 words, title-case",
    `- content: ${WORDS_MIN}-${WORDS_MAX} words, a single paragraph; no headings; pastoral and practical`,
    "- scriptureReference: single verse like 'Psalm 19:1' (no verse text here)",
    "- celestialConnection: one sentence linking the sky to faith; include the viewing window",
    "- moonPhase: one of: New Moon, Waxing Crescent, First Quarter, Waxing Gibbous, Full Moon, Waning Gibbous, Last Quarter, Waning Crescent",
    "- visiblePlanets: comma-separated list like 'Saturn, Jupiter, Mars' (or '' if none)",
    "- specialEvents: a short phrase ('' if none)",
    "- bestViewingTime: like '9:00 PM - 11:00 PM local time'",
    `- season: '${seasonGuess}' if suitable, otherwise the correct season`,
    "- createdAt: valid ISO 8601 timestamp (UTC now)",
    "- isFallback: boolean, true if the primary model failed and a backup wrote this; else false.",
    "Constraints:",
    "- Any quoted Scripture inside content must be <= 50 words.",
    "- Use correct capitalization for planet names and times.",
    "- Do not include markdown or extra fields."
  ].join(" ");
  const user = [
    `date: ${dateISO}`,
    theme ? `theme: ${theme}` : "",
    "Primary focus: connect tonight's sky to faith in one cohesive paragraph."
  ].join("\n").trim();

  return [{ role:"system", content: system }, { role:"user", content: user }];
}

function parseContentFromResponse(jsonText){
  try { return JSON.parse(jsonText); } catch { return null; }
}

function normalizeOutput(o, {dateISO, createdAtISO, isFallback}) {
  const id = `devotional-${dateISO}`;
  const out = {
    id,
    date: dateISO,
    title: String(o.title || "").trim(),
    content: String(o.content || "").trim(),
    scriptureReference: String(o.scriptureReference || "").trim(),
    celestialConnection: String(o.celestialConnection || "").trim(),
    moonPhase: String(o.moonPhase || "").trim(),
    visiblePlanets: Array.isArray(o.visiblePlanets) ? o.visiblePlanets.join(", ") : String(o.visiblePlanets || "").trim(),
    specialEvents: String(o.specialEvents || "").trim(),
    bestViewingTime: String(o.bestViewingTime || "").trim(),
    season: String(o.season || "").trim(),
    createdAt: createdAtISO,
    isFallback: Boolean(
      typeof o.isFallback === "boolean" ? o.isFallback : isFallback
    ),
  };

  // Minimal required fixes:
  // Ensure required fields present; if missing, set safe defaults.
  if (!out.title) out.title = "Daily Reflection";
  if (!out.scriptureReference) out.scriptureReference = "Psalm 19:1";
  if (!out.moonPhase) out.moonPhase = "First Quarter";
  if (!out.bestViewingTime) out.bestViewingTime = "9:00 PM - 11:00 PM local time";
  if (!out.season) out.season = seasonFromMonth(new Date(dateISO).getUTCMonth());
  if (!out.createdAt) out.createdAt = createdAtISO;

  return out;
}

async function callProvider({name, url, model, apiKey, messages}) {
  if (!apiKey) throw new Error(`MISSING_KEY_${name.toUpperCase()}`);
  for (let attempt=1; attempt<=MAX_ATTEMPTS; attempt++){
    const { ok, status, text } = await postJSON(
      url,
      { model, messages, temperature: TEMPERATURE, max_tokens: MAX_TOKENS },
      { Authorization: `Bearer ${apiKey}` },
      TIMEOUT_MS
    );
    if (!ok){
      if (status === 402) throw Object.assign(new Error(`${name}_402`), { code:"INSUFFICIENT_BALANCE" });
      if (status === 429 || status === 408 || (status>=500 && status<=599)){
        if (attempt < MAX_ATTEMPTS){
          const d = 800 * (2 ** (attempt - 1)) + Math.floor(Math.random()*250);
          console.warn(`[${name}] transient ${status}; retry in ${d}ms`);
          await sleep(d);
          continue;
        }
      }
      throw new Error(`[${name}] error ${status}: ${text}`);
    }
    const obj = parseContentFromResponse(text);
    if (!obj || typeof obj !== "object") throw new Error(`[${name}] invalid JSON shape`);
    return obj;
  }
  throw new Error(`[${name}] exhausted retries`);
}

async function main() {
  const dateISO = isoDateOnly();
  const createdAtISO = nowIso();
  const seasonGuess = seasonFromMonth(new Date(dateISO).getUTCMonth());

  const messages = buildMessagesForJSON({ dateISO, theme: THEME, seasonGuess });

  const providers = {
    deepseek: { name:"deepseek", url:DS.url, model:DS.model, apiKey:DS.apiKey },
    openai:   { name:"openai",   url:OA.url, model:OA.model, apiKey:OA.apiKey },
    groq:     { name:"groq",     url:GQ.url, model:GQ.model, apiKey:GQ.apiKey },
  };

  let usedProvider = null;
  let rawObj = null;
  const errors = [];

  for (const key of PROVIDERS){
    const p = providers[key];
    if (!p){ console.warn(`Unknown provider "${key}" — skipping`); continue; }
    try{
      rawObj = await callProvider({ ...p, messages });
      usedProvider = key;
      break;
    } catch(e){
      errors.push(`${key}: ${e.code || ""} ${e.message}`);
      console.warn(`Provider ${key} failed: ${e.message}`);
      continue;
    }
  }

  if (!rawObj) throw new Error(`All providers failed. Details: ${errors.join(" | ")}`);

  const isFallback = (usedProvider !== PRIMARY_PROVIDER);
  const normalized = normalizeOutput(rawObj, { dateISO, createdAtISO, isFallback });

  // Final: write EXACT file shape
  const outDir = path.resolve("devotionals");
  await fs.mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, `${dateISO}.json`);
  await fs.writeFile(outPath, JSON.stringify(normalized, null, 2), "utf-8");

  console.log(`✅ Wrote ${outPath} via ${usedProvider} (isFallback=${normalized.isFallback})`);
}

main().catch(err => {
  console.error("❌ Generation failed:", err);
  process.exit(1);
});
