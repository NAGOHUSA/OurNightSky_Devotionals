/**
 * generate-our-night-sky.js
 * Creates a devotional JSON for Our Night Sky.
 */

import fs from "fs";
import path from "path";

// === CONFIG ===
const targetDate = process.env.TARGET_DATE || new Date().toISOString().slice(0, 10);
const force = (process.env.FORCE_OVERWRITE || "false").toLowerCase() === "true";
const outDir = "devotionals";
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, `${targetDate}.json`);

// === SAFETY ===
if (fs.existsSync(outPath) && !force) {
  console.log(`File already exists for ${targetDate}. Use FORCE_OVERWRITE=true to replace.`);
  process.exit(0);
}

// === AI CALLS (fallback chain) ===
import fetch from "node-fetch";

async function callAI(provider, body) {
  try {
    const urls = {
      openai: "https://api.openai.com/v1/chat/completions",
      groq: "https://api.groq.com/openai/v1/chat/completions",
      deepseek: "https://api.deepseek.com/v1/chat/completions",
    };
    const keys = {
      openai: process.env.OPENAI_API_KEY,
      groq: process.env.GROQ_API_KEY,
      deepseek: process.env.DEEPSEEK_API_KEY,
    };
    const res = await fetch(urls[provider], {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${keys[provider]}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`${provider} error ${res.status}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim();
  } catch (err) {
    console.error(`❌ ${provider} failed:`, err.message);
    return null;
  }
}

async function generate() {
  const prompt = `
You are to write a short daily Christian devotional for an app called "Our Night Sky."
Blend scripture with current celestial or seasonal themes, keeping it encouraging and uplifting.
Output in Markdown, with sections:
# Title
## Scripture
## Reflection
## Prayer
`;
  const body = {
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 500,
    temperature: 0.8,
  };

  let content =
    (await callAI("groq", body)) ||
    (await callAI("openai", body)) ||
    (await callAI("deepseek", body));

  if (!content) {
    console.error("All providers failed — cannot generate content.");
    process.exit(1);
  }

  const payload = {
    app: "Our Night Sky",
    date: targetDate,
    provider: "multi-fallback",
    words: content.split(/\s+/).length,
    hemisphere: "Northern",
    content_markdown: content,
  };

  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
  console.log(`✅ Wrote devotional to ${outPath}`);
}

await generate();
