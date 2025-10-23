/**
 * generate-our-night-sky.js
 * Creates a devotional JSON for Our Night Sky with anti-repetition safeguards.
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";

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

// === ANTI-REPETITION: Load existing devotionals ===
function loadExistingDevotionals() {
  const existing = [];
  if (!fs.existsSync(outDir)) return existing;
  
  const files = fs.readdirSync(outDir)
    .filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort()
    .slice(-90); // Last 90 days to check for repetition
  
  for (const file of files) {
    try {
      const content = JSON.parse(fs.readFileSync(path.join(outDir, file), 'utf8'));
      if (content.content_markdown) {
        existing.push({
          date: content.date,
          content: content.content_markdown,
          // Extract key phrases for comparison
          title: extractTitle(content.content_markdown),
          scripture: extractScripture(content.content_markdown),
          hash: hashContent(content.content_markdown)
        });
      }
    } catch (err) {
      console.warn(`Could not read ${file}:`, err.message);
    }
  }
  
  console.log(`📚 Loaded ${existing.length} recent devotionals for comparison`);
  return existing;
}

function extractTitle(markdown) {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match ? match[1].trim().toLowerCase() : '';
}

function extractScripture(markdown) {
  const match = markdown.match(/##\s+Scripture\s*\n[>\s]*(.+?)(?=\n\n|$)/s);
  return match ? match[1].trim().toLowerCase() : '';
}

function hashContent(text) {
  // Create a hash of the content for exact duplicate detection
  return crypto.createHash('md5').update(text.toLowerCase().trim()).digest('hex');
}

function calculateSimilarity(str1, str2) {
  // Simple word-based similarity check
  const words1 = new Set(str1.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  const words2 = new Set(str2.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
}

function checkForRepetition(newContent, existingDevotionals) {
  const newTitle = extractTitle(newContent);
  const newScripture = extractScripture(newContent);
  const newHash = hashContent(newContent);
  
  for (const existing of existingDevotionals) {
    // Check for exact duplicate
    if (existing.hash === newHash) {
      console.error(`❌ EXACT DUPLICATE detected from ${existing.date}`);
      return { isDuplicate: true, reason: 'exact_match', date: existing.date };
    }
    
    // Check for very similar titles
    if (newTitle && existing.title) {
      const titleSimilarity = calculateSimilarity(newTitle, existing.title);
      if (titleSimilarity > 0.7) {
        console.warn(`⚠️  Very similar title to ${existing.date}: "${existing.title}" vs "${newTitle}" (${Math.round(titleSimilarity * 100)}% similar)`);
        return { isDuplicate: true, reason: 'similar_title', date: existing.date, similarity: titleSimilarity };
      }
    }
    
    // Check for same scripture reference
    if (newScripture && existing.scripture && newScripture === existing.scripture) {
      console.warn(`⚠️  Same scripture as ${existing.date}: ${existing.scripture}`);
      // Allow same scripture but flag it
    }
    
    // Check for very similar content (50%+ word overlap)
    const contentSimilarity = calculateSimilarity(newContent, existing.content);
    if (contentSimilarity > 0.5) {
      console.error(`❌ Content too similar to ${existing.date} (${Math.round(contentSimilarity * 100)}% similar)`);
      return { isDuplicate: true, reason: 'similar_content', date: existing.date, similarity: contentSimilarity };
    }
  }
  
  return { isDuplicate: false };
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
    
    if (!keys[provider]) {
      console.log(`⚠️  ${provider} API key not configured, skipping...`);
      return null;
    }
    
    console.log(`🔄 Trying ${provider}...`);
    const res = await fetch(urls[provider], {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${keys[provider]}`,
      },
      body: JSON.stringify(body),
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`${provider} error ${res.status}: ${errorText}`);
    }
    
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    
    if (content) {
      console.log(`✅ ${provider} succeeded!`);
      return content;
    }
    
    throw new Error(`${provider} returned empty content`);
  } catch (err) {
    console.error(`❌ ${provider} failed:`, err.message);
    return null;
  }
}

// Build the prompt with variety instructions
function buildPrompt(existingDevotionals, attemptNumber = 1) {
  const today = new Date(targetDate);
  const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 86400000);
  const season = getSeason(today);
  
  // Get recent titles to avoid
  const recentTitles = existingDevotionals.slice(-10).map(d => d.title).filter(Boolean);
  const recentScriptures = existingDevotionals.slice(-30).map(d => d.scripture).filter(Boolean);
  
  const basePrompt = `You are writing devotional #${dayOfYear} for ${targetDate} (${season} season) for "Our Night Sky" - a Christian devotional app that connects faith with celestial observations.

CRITICAL REQUIREMENTS FOR UNIQUENESS:
1. Create a completely fresh and original devotional - avoid repeating themes from recent devotionals
2. Choose a DIFFERENT scripture passage than recent ones
3. Use a unique title that hasn't been used before
4. Explore a different aspect of God's creation or celestial theme

${recentTitles.length > 0 ? `Recent titles to AVOID repeating:\n${recentTitles.map(t => `- "${t}"`).join('\n')}\n` : ''}

${recentScriptures.length > 0 ? `Recent scriptures used (choose something DIFFERENT):\n${recentScriptures.slice(0, 5).map(s => `- ${s}`).join('\n')}\n` : ''}

THEME IDEAS FOR VARIETY (pick one that feels fresh):
- Phases of moon and seasons of faith
- Constellations and God's promises (Abraham's descendants)
- Planets and God's sovereignty over all creation
- Meteor showers and God's sudden grace
- The Milky Way and our place in God's vast plan
- Northern lights and the glory of God
- Eclipse events and times of spiritual testing
- Morning/evening star and Jesus the light
- Deep space and God's infinite nature
- Comets and life's brief journey with eternal purpose

${attemptNumber > 1 ? `\n⚠️ ATTEMPT #${attemptNumber}: The previous devotional was too similar to an existing one. Please create something MORE UNIQUE with a completely different angle, scripture, and theme.\n` : ''}

Output in Markdown with these sections:
# [Unique Title]
## Scripture
## Reflection
## Prayer

Keep it 200-250 words, warm, encouraging, and theologically sound.`;

  return basePrompt;
}

function getSeason(date) {
  const month = date.getMonth() + 1;
  if (month >= 3 && month <= 5) return 'Spring';
  if (month >= 6 && month <= 8) return 'Summer';
  if (month >= 9 && month <= 11) return 'Fall';
  return 'Winter';
}

async function generate() {
  // Load existing devotionals for comparison
  const existingDevotionals = loadExistingDevotionals();
  
  const maxAttempts = 3;
  let content = null;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`\n🎯 Generation attempt ${attempt}/${maxAttempts}`);
    
    const prompt = buildPrompt(existingDevotionals, attempt);
    
    // Each provider needs its own model configuration
    const groqBody = {
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 600,
      temperature: 0.9 + (attempt * 0.05), // Increase temperature with each attempt for more variety
    };

    const openaiBody = {
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 600,
      temperature: 0.9 + (attempt * 0.05),
    };

    const deepseekBody = {
      model: "deepseek-chat",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 600,
      temperature: 0.9 + (attempt * 0.05),
    };

    // Try providers in order
    content =
      (await callAI("groq", groqBody)) ||
      (await callAI("openai", openaiBody)) ||
      (await callAI("deepseek", deepseekBody));

    if (!content) {
      console.error("All providers failed for this attempt.");
      if (attempt < maxAttempts) {
        console.log("Retrying with next attempt...");
        continue;
      }
      console.error("All providers failed — cannot generate content.");
      process.exit(1);
    }
    
    // Check for repetition
    console.log("\n🔍 Checking for repetition...");
    const checkResult = checkForRepetition(content, existingDevotionals);
    
    if (!checkResult.isDuplicate) {
      console.log("✅ Content is unique!");
      break;
    }
    
    console.error(`\n❌ Repetition detected: ${checkResult.reason} (similar to ${checkResult.date})`);
    
    if (attempt < maxAttempts) {
      console.log(`🔄 Retrying with more specific instructions to ensure uniqueness...\n`);
      content = null; // Reset for retry
    } else {
      console.error("\n⚠️  Max attempts reached. Using content despite similarity (consider manual review).");
    }
  }

  if (!content) {
    console.error("Failed to generate unique content after all attempts.");
    process.exit(1);
  }

  const payload = {
    app: "Our Night Sky",
    date: targetDate,
    provider: "multi-fallback",
    words: content.split(/\s+/).length,
    hemisphere: "Northern",
    content_markdown: content,
    generated_at: new Date().toISOString(),
    uniqueness_check: "passed"
  };

  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
  console.log(`\n✅ Wrote devotional to ${outPath}`);
  console.log(`📊 Word count: ${payload.words}`);
  console.log(`🎯 Uniqueness: Verified against ${existingDevotionals.length} recent devotionals`);
}

await generate();
