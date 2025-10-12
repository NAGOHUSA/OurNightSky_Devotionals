// content-tracker.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class ContentTracker {
  constructor() {
    this.trackerFile = path.join(__dirname, 'content_tracker.json');
    this.data = this.load();
  }

  load() {
    if (fs.existsSync(this.trackerFile)) {
      try {
        return JSON.parse(fs.readFileSync(this.trackerFile, 'utf8'));
      } catch {
        /* fallthrough and rebuild */
      }
    }
    return {
      // historical lists (kept for compatibility)
      titles: [],
      keyPhrases: [],
      scriptureReferences: [],
      themes: [],
      // new, explicit uniqueness sets
      contentHashes: [],     // [{ hash, dateUsed }]
      recentScriptures: [],  // rolling window [{ reference, dateUsed }]
      lastUpdated: new Date().toISOString(),
      totalDevotionals: 0
    };
  }

  save() {
    this.data.lastUpdated = new Date().toISOString();
    this.data.totalDevotionals = this.data.titles.length;
    fs.writeFileSync(this.trackerFile, JSON.stringify(this.data, null, 2));
  }

  // --- Helpers ---
  normalize(text) {
    return (text || '')
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  sim(a, b) {
    const A = new Set(this.normalize(a).split(/\W+/).filter(w => w.length > 3));
    const B = new Set(this.normalize(b).split(/\W+/).filter(w => w.length > 3));
    const inter = [...A].filter(x => B.has(x)).length;
    const uni = new Set([...A, ...B]).size || 1;
    return inter / uni;
  }

  hash(text) {
    return crypto.createHash('sha1').update(this.normalize(text)).digest('hex');
  }

  // --- Checks ---
  isTitleUnique(newTitle, threshold = 0.7) {
    const n = this.normalize(newTitle);
    for (const t of this.data.titles) {
      const m = this.normalize(t.title);
      if (n === m) return { ok: false, reason: 'Exact title match', similar: t.title };
      if (this.sim(n, m) > threshold) {
        return { ok: false, reason: 'Title too similar', similar: t.title };
      }
    }
    return { ok: true };
  }

  isContentFresh(content) {
    const h = this.hash(content);
    const already = this.data.contentHashes.find(x => x.hash === h);
    if (already) {
      return { ok: false, reason: 'Content body duplicated', similarDate: already.dateUsed };
    }
    return { ok: true };
  }

  isScriptureFresh(reference, lookbackDays = 21) {
    if (!reference) return { ok: true };
    const cutoff = Date.now() - lookbackDays * 86400000;
    const recent = this.data.recentScriptures.filter(s => new Date(s.dateUsed).getTime() >= cutoff);
    const usedRecently = recent.find(s => this.normalize(s.reference) === this.normalize(reference));
    if (usedRecently) {
      return { ok: false, reason: `Scripture used in last ${lookbackDays} days`, lastUsed: usedRecently.dateUsed };
    }
    return { ok: true };
  }

  // One-shot validator (title + content + scripture)
  validate(devotional) {
    const titleCheck = this.isTitleUnique(devotional.title);
    if (!titleCheck.ok) return { ok: false, ...titleCheck };

    const contentCheck = this.isContentFresh(devotional.content);
    if (!contentCheck.ok) return { ok: false, ...contentCheck };

    const scriptureCheck = this.isScriptureFresh(devotional.scriptureReference);
    if (!scriptureCheck.ok) return { ok: false, ...scriptureCheck };

    return { ok: true };
  }

  // --- Record after passing all checks ---
  record(devotional) {
    const date = devotional.date || new Date().toISOString().slice(0, 10);

    this.data.titles.push({
      title: devotional.title,
      dateUsed: date,
      theme: devotional.theme || 'general'
    });

    this.data.contentHashes.push({
      hash: this.hash(devotional.content),
      dateUsed: date
    });

    if (devotional.scriptureReference) {
      this.data.scriptureReferences.push({
        reference: devotional.scriptureReference,
        dateUsed: date,
        theme: devotional.theme || 'general'
      });
      this.data.recentScriptures.push({
        reference: devotional.scriptureReference,
        dateUsed: date
      });
      // keep recentScriptures manageable (last 180 entries ~ 6 months daily)
      if (this.data.recentScriptures.length > 180) {
        this.data.recentScriptures = this.data.recentScriptures.slice(-180);
      }
    }

    if (devotional.theme) {
      this.data.themes.push({
        category: devotional.theme,
        dateUsed: date,
        title: devotional.title
      });
    }

    this.save();
  }
}

module.exports = ContentTracker;
