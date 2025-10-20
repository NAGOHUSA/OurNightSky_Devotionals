function approxMoonPhaseISO(dateStr) {
  // Very rough phase from date; 29.53-day synodic month
  const d = new Date(dateStr + "T00:00:00Z");
  const knownNew = new Date("2025-09-03T00:00:00Z"); // seed; adjust occasionally
  const days = (d - knownNew) / 86400000;
  const phase = ((days % 29.53) + 29.53) % 29.53;
  if (phase < 1.0) return "New";
  if (phase < 6.4) return "Waxing Crescent";
  if (phase < 8.9) return "First Quarter";
  if (phase < 14.8) return "Waxing Gibbous";
  if (phase < 15.8) return "Full";
  if (phase < 22.1) return "Waning Gibbous";
  if (phase < 24.7) return "Last Quarter";
  return "Waning Crescent";
}

function pick(arr, i) { return arr[i % arr.length]; }

function localFallbackDevotional({dateUTC, location, theme}) {
  const seeds = [
    {ref:"Psalm 19:1", tag:"Glory"},
    {ref:"Psalm 8:3-4", tag:"Wonder"},
    {ref:"Isaiah 40:26", tag:"Strength"},
    {ref:"Genesis 1:16", tag:"Creation"},
    {ref:"Philippians 2:15", tag:"Shine"},
    {ref:"James 1:17", tag:"Gifts"},
  ];
  const constellations = ["Cassiopeia","Andromeda","Cygnus","Pegasus","Perseus","Aquarius","Capricornus","Pisces"];
  const planetsSets = [
    ["Jupiter","Saturn"],
    ["Venus","Jupiter"],
    ["Mars","Jupiter"],
    ["Saturn","Mars"],
    ["Venus","Saturn"],
  ];
  const n = parseInt(crypto.createHash("sha256").update(dateUTC).digest("hex").slice(0,8),16);
  const seed = pick(seeds, n);
  const cons = pick(constellations, n);
  const visPlanets = pick(planetsSets, n);
  const phase = approxMoonPhaseISO(dateUTC);

  const title = `${seed.tag} in the Night`;
  const scriptureReference = seed.ref;
  const themeOut = theme || seed.tag.toLowerCase();
  const celestialConnection = `Under ${cons} and a ${phase} Moon, we remember ${scriptureReference} in ${location}.`;
  const content = `As we look up on ${dateUTC}, the sky invites us to ${themeOut.toLowerCase()}.
Even without a telescope, you can step outside, breathe, and notice the quiet order God set above us.
Let this be your prayer: “Lord, tune my heart to see what You reveal in creation and to trust what You have promised in Your Word.”`;

  const body = content.replace(/\n+/g," ").trim();
  const id = crypto.createHash("sha256").update(`${dateUTC}|${title}|${scriptureReference}|${body}`).digest("hex").slice(0,32);

  return {
    app: "Our Night Sky",
    id,
    date: dateUTC,
    title,
    scriptureReference,
    content: body,
    celestialConnection,
    theme: themeOut,
    moonPhase: phase.includes(" ") ? phase.split(" ")[0] : phase,
    visiblePlanets: visPlanets,
    createdAt: new Date().toISOString(),
    usedProvider: null,
    isFallback: true,
    fallbackType: "local"
  };
}
