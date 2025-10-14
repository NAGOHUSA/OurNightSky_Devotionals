# OurNightSky_Devotionals
## Output Contract (v2.0)

Each run writes `devotionals/devotional-YYYY-MM-DD.json` with shape:

- `id`: `"devotional-YYYY-MM-DD"`
- `date`: `YYYY-MM-DD`
- `title`: string
- `content`: 200–300 words, markdown-safe single field
- `scriptureReference`: `"Book C:V"`
- `celestialConnection`: 1–2 sentences
- `theme`: one word (e.g., `wonder`)
- `moonPhase`: string
- `moonIllumination`: percentage string like `"75%"`
- `visiblePlanets`: comma list or `"None"`
- `specialEvents`: short phrase or `"None"`
- `constellations`: 1–5 items
- `bestViewingTime`: `"H:MM AM/PM - H:MM AM/PM local time"`
- `season`: `"Winter|Spring|Summer|Autumn"`
- `location`: `"City, State"`
- `createdAt`: ISO timestamp
- `isFallback`: boolean (true if not GROK)
- `version`: `"2.0"`
