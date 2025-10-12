// generate-devotional.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai').OpenAI || require('openai'); // adjust to your client
const ContentTracker = require('./content-tracker');

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const tracker = new ContentTracker();

const OUT_DIR = path.join(__dirname, 'devotionals');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const today = new Date().toISOString().slice(0, 10);
const outfile = path.join(OUT_DIR, `${today}.md`);

// optional: hard stop if already generated today
if (fs.existsSync(outfile)) {
  console.log(`✅ Devotional for ${today} already exists. Skipping.`);
  process.exit(0);
}

function buildSystemPrompt(blocklist) {
  const avoidScriptures = blocklist?.scriptures?.length
    ? `Avoid these scripture references: ${blocklist.scriptures.join('; ')}.`
    : '';

  const avoidTitlesLike = blocklist?.titles?.length
    ? `Avoid titles similar to: ${blocklist.titles.join('; ')}.`
    : '';

  const avoidPhrases = blocklist?.phrases?.length
    ? `Avoid repeating overused phrases such as: ${blocklist.phrases.join('; ')}.`
    : '';

  return `
You write a short, original daily devotional (title + scripture reference + 250-400 word reflection + 2-3 reflection questions + 1-line prayer).
Requirements:
- Fresh, distinct title (no reuse or near-duplicate of prior days).
- Use a scripture not used in the last 21 days.
- Concrete imagery and specific details; avoid clichés.
- Single, cohesive theme; do not reuse yesterday's phrasing.
${avoidScriptures}
${avoidTitlesLike}
${avoidPhrases}
Return JSON with keys: title, scriptureReference, content, questions (array), prayer, theme.
`.trim();
}

async function callModel(system) {
  const res = await client.chat.completions.create({
    model: 'gpt-4o-mini', // pick your model
    temperature: 0.9,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: `Date: ${today}. Create today's devotional now.` }
    ],
    response_format: { type: 'json_object' }
  });

  const text = res.choices[0].message.content;
  return JSON.parse(text);
}

function format(dev) {
  return `# ${dev.title}

**Scripture:** ${dev.scriptureReference}

${dev.content.trim()}

**Reflect:**
${(dev.questions || []).map((q, i) => `${i + 1}. ${q}`).join('\n')}

**Prayer:** ${dev.prayer}
`;
}

(async () => {
  // Build a small “blocklist” from the last few entries so the prompt explicitly avoids them
  const recentTitles = tracker.data.titles.slice(-10).map(t => t.title);
  const recentScriptures = tracker.data.recentScriptures.slice(-30).map(s => s.reference);

  let system = buildSystemPrompt({
    titles: recentTitles,
    scriptures: recentScriptures
  });

  const MAX_TRIES = 5;
  let attempt = 0;
  let lastError = null;
  let devotional = null;

  while (attempt < MAX_TRIES) {
    attempt += 1;
    console.log(`📝 Generating devotional (attempt ${attempt}/${MAX_TRIES})...`);
    const draft = await callModel(system);

    // normalize/trim fields the model returns
    const candidate = {
      date: today,
      title: (draft.title || '').trim(),
      scriptureReference: (draft.scriptureReference || '').trim(),
      content: (draft.content || '').trim(),
      questions: Array.isArray(draft.questions) ? draft.questions : [],
      prayer: (draft.prayer || '').trim(),
      theme: (draft.theme || '').trim()
    };

    // validate against tracker
    const check = tracker.validate(candidate);
    if (check.ok) {
      devotional = candidate;
      break;
    }

    // tighten instructions based on failure reason
    lastError = check;
    const hints = [];
    if (check.reason?.includes('Title')) {
      hints.push(`Your title was too similar to a previous one ("${check.similar || ''}"). Produce a distinctly different title.`);
    }
    if (check.reason?.includes('Content')) {
      hints.push('Your content overlapped too closely with prior days. Use different imagery, a new angle, and avoid repeating stock phrasing.');
    }
    if (check.reason?.includes('Scripture')) {
      hints.push('Choose a different scripture passage than what you just used.');
    }

    system = buildSystemPrompt({
      titles: [...recentTitles, candidate.title].slice(-15),
      scriptures: [...recentScriptures, candidate.scriptureReference].slice(-45)
    }) + `\n\nAdditional constraint due to previous attempt: ${hints.join(' ')}`;
  }

  // final fallback (still guarantee uniqueness)
  if (!devotional) {
    console.warn(`⚠️ Could not achieve full uniqueness after ${MAX_TRIES} tries. Applying safe fallback.`);
    // mutate title with date stamp to guarantee non-duplicate title
    const safe = await callModel(buildSystemPrompt({
      titles: [...recentTitles, ...recentTitles.map(t => `${t} ${today}`)],
      scriptures: recentScriptures
    }));
    devotional = {
      date: today,
      title: `${(safe.title || 'Daily Devotional').trim()} — ${today}`,
      scriptureReference: (safe.scriptureReference || '').trim(),
      content: (safe.content || '').trim(),
      questions: Array.isArray(safe.questions) ? safe.questions : [],
      prayer: (safe.prayer || '').trim(),
      theme: (safe.theme || '').trim()
    };
  }

  // persist markdown + tracker
  fs.writeFileSync(outfile, format(devotional), 'utf8');
  tracker.record(devotional);

  console.log(`✅ Wrote ${outfile}`);
})();
