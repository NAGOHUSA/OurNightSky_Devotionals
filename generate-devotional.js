const fs = require('fs');
const path = require('path');
const axios = require('axios');
const ContentTracker = require('./content-tracker');

// Configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const FORCE_REGENERATE = process.env.FORCE_REGENERATE === 'true';

// Devotionals directory
const DEVOTIONALS_DIR = './devotionals';

// Ensure devotionals directory exists
if (!fs.existsSync(DEVOTIONALS_DIR)) {
    fs.mkdirSync(DEVOTIONALS_DIR, { recursive: true });
}

// Get today's date in YYYY-MM-DD format
function getTodayString() {
    return new Date().toISOString().split('T')[0];
}

// ENHANCED: More accurate moon phase calculation
function calculateAccurateMoonPhase(date) {
    const year = date.getFullYear();
    let month = date.getMonth() + 1;
    let day = date.getDate();
    
    if (month < 3) {
        year--;
        month += 12;
    }
    
    ++month;
    const c = 365.25 * year;
    const e = 30.6 * month;
    let jd = c + e + day - 694039.09;
    jd /= 29.5305882;
    const b = parseInt(jd);
    jd -= b;
    const phaseIndex = Math.round(jd * 8);
    
    const phases = [
        { name: "New Moon", illumination: "0%" },
        { name: "Waxing Crescent", illumination: "25%" },
        { name: "First Quarter", illumination: "50%" },
        { name: "Waxing Gibbous", illumination: "75%" },
        { name: "Full Moon", illumination: "100%" },
        { name: "Waning Gibbous", illumination: "75%" },
        { name: "Last Quarter", illumination: "50%" },
        { name: "Waning Crescent", illumination: "25%" }
    ];
    
    return phases[phaseIndex >= 8 ? 0 : phaseIndex];
}

// ENHANCED: Get astronomical data with better accuracy
function getCurrentAstronomicalData() {
    const today = new Date();
    const month = today.getMonth() + 1;
    const day = today.getDate();
    
    // Accurate moon phase
    const moonData = calculateAccurateMoonPhase(today);
    
    // Season based on month
    let season;
    if (month >= 3 && month <= 5) season = "Spring";
    else if (month >= 6 && month <= 8) season = "Summer";
    else if (month >= 9 && month <= 11) season = "Autumn";
    else season = "Winter";
    
    // ENHANCED: Season-based visible planets (more accurate)
    const planetsBySeason = {
        winter: ["Venus (Evening Star)", "Jupiter", "Mars"],
        spring: ["Venus (Morning Star)", "Mars", "Saturn"],
        summer: ["Saturn", "Mars", "Venus (Morning Star)"],
        autumn: ["Jupiter", "Saturn", "Venus (Evening Star)"]
    };
    
    const seasonKey = season.toLowerCase();
    const visiblePlanets = planetsBySeason[seasonKey].slice(0, 2 + (day % 2)).join(", ");
    
    // ENHANCED: Real celestial events calendar
    const specialEvents = getRealCelestialEvents(month, day, season);
    
    // ENHANCED: Constellation visibility by season
    const constellations = getSeasonalConstellations(season);
    
    // Best viewing time based on moon phase
    const bestViewingTime = moonData.name.includes('Full') ? 
        "After 10:00 PM (moon provides natural light)" : 
        moonData.name.includes('New') ? 
        "9:00 PM - 11:00 PM (excellent dark sky)" : 
        "9:00 PM - 10:30 PM local time";
    
    return {
        moonPhase: moonData.name,
        moonIllumination: moonData.illumination,
        visiblePlanets,
        specialEvents,
        constellations,
        bestViewingTime,
        season,
        location: "Macon, Georgia"
    };
}

// ENHANCED: Real celestial events by date
function getRealCelestialEvents(month, day, season) {
    const dateKey = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    // Actual annual astronomical events
    const celestialCalendar = {
        "01-03": "Quadrantids Meteor Shower peak",
        "04-22": "Lyrid Meteor Shower peak",
        "05-06": "Eta Aquarids Meteor Shower peak",
        "08-12": "Perseid Meteor Shower peak - one of the year's best",
        "10-21": "Orionid Meteor Shower peak",
        "11-17": "Leonid Meteor Shower peak",
        "12-13": "Geminid Meteor Shower peak - the year's most spectacular",
        "03-20": "Spring Equinox - equal day and night",
        "06-21": "Summer Solstice - longest day of the year",
        "09-22": "Autumn Equinox - harvest moon season begins",
        "12-21": "Winter Solstice - longest night for stargazing"
    };
    
    if (celestialCalendar[dateKey]) {
        return celestialCalendar[dateKey];
    }
    
    // Season-specific events (more variety)
    const seasonalEvents = {
        winter: [
            "Orion constellation dominates the southern sky",
            "The Winter Circle asterism prominently visible",
            "Sirius, the brightest star, shines brilliantly",
            "The Pleiades star cluster glows overhead",
            "Betelgeuse's red glow marks Orion's shoulder"
        ],
        spring: [
            "The Big Dipper reaches its highest point",
            "Leo constellation takes center stage",
            "The Spring Triangle guides night travelers",
            "Arcturus rises as spring's brightest star",
            "Virgo constellation stretches across the meridian"
        ],
        summer: [
            "The Summer Triangle dominates overhead",
            "The Milky Way stretches across the entire sky",
            "Scorpius curves through the southern horizon",
            "Antares glows red like Mars in Scorpius",
            "Sagittarius points toward the galactic center"
        ],
        autumn: [
            "The Great Square of Pegasus marks the season",
            "Andromeda Galaxy visible to careful observers",
            "Fomalhaut shines as autumn's lone bright star",
            "Cassiopeia forms its distinctive W shape overhead",
            "The Summer Triangle sets in the western sky"
        ]
    };
    
    const events = seasonalEvents[season.toLowerCase()] || seasonalEvents.winter;
    return events[day % events.length];
}

// ENHANCED: Get constellations by season
function getSeasonalConstellations(season) {
    const constellationsBySeason = {
        Winter: ["Orion", "Taurus", "Gemini", "Canis Major", "Auriga"],
        Spring: ["Leo", "Virgo", "Boötes", "Cancer", "Ursa Major"],
        Summer: ["Cygnus", "Lyra", "Aquila", "Scorpius", "Sagittarius"],
        Autumn: ["Pegasus", "Andromeda", "Cassiopeia", "Perseus", "Aquarius"]
    };
    return constellationsBySeason[season] || constellationsBySeason.Winter;
}

// ENHANCED: Generate with uniqueness checking
async function generateDevotionalContent(astronomicalData, tracker) {
    if (!OPENAI_API_KEY || OPENAI_API_KEY === '') {
        throw new Error('OpenAI API key not provided');
    }
    
    const currentDate = new Date();
    const dateString = currentDate.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    
    // Get usage data for uniqueness
    const usageReport = tracker.getUsageReport();
    const recentTitles = usageReport.recentActivity.lastWeekTitles;
    const mostUsedScriptures = usageReport.recentActivity.mostUsedScriptures.map(s => s.reference);
    
    const themes = ["faithfulness", "peace", "providence", "light", "order", "seasons", "timelessness", "wonder", "grace"];
    const todayTheme = themes[currentDate.getDate() % themes.length];
    
    const prompt = `Create a unique Christian devotional for tonight (${dateString}) in ${astronomicalData.location}.

TONIGHT'S REAL SKY:
• Moon: ${astronomicalData.moonPhase} (${astronomicalData.moonIllumination} illuminated)
• Visible Planets: ${astronomicalData.visiblePlanets}
• Special Event: ${astronomicalData.specialEvents}
• Constellations: ${astronomicalData.constellations.join(', ')}
• Best Viewing: ${astronomicalData.bestViewingTime}
• Season: ${astronomicalData.season}

UNIQUENESS REQUIREMENTS:
• DO NOT use titles similar to: ${recentTitles.slice(0, 5).join(', ')}
• AVOID these overused scriptures: ${mostUsedScriptures.join(', ')}
• Create FRESH metaphors and spiritual connections
• Use SPECIFIC details from tonight's actual sky
• Primary theme: ${todayTheme}

DEVOTIONAL REQUIREMENTS:
1. Connect tonight's SPECIFIC celestial events to profound spiritual truths
2. Be peaceful and contemplative for quiet nighttime reflection
3. Include a relevant biblical reference (avoid common overused passages)
4. Be 280-350 words (substantial and meaningful)
5. Use poetic, evocative language that creates wonder
6. Focus on God's creation, providence, presence, and love
7. Make celestial connection SPECIFIC to visible objects tonight
8. Encourage prayer and meditation

Format as JSON:
{
  "title": "Unique poetic title (40-60 characters)",
  "content": "Main devotional (280-350 words)",
  "scriptureReference": "Book Chapter:Verse",
  "celestialConnection": "Specific observation guide for tonight (2-3 sentences)",
  "theme": "${todayTheme}"
}

Make this memorable and deeply moving. Avoid clichés. Be specific about tonight's sky.`;

    let maxAttempts = 3;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const response = await axios.post('https://api.openai.com/v1/chat/completions', {
                model: 'gpt-4-turbo-preview',
                messages: [
                    {
                        role: 'system',
                        content: 'You are an award-winning Christian devotional writer who creates profound, unique content. Never repeat yourself. Always craft fresh metaphors. Respond ONLY with valid JSON.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                max_tokens: 1000,
                temperature: 0.85,
                presence_penalty: 0.6,
                frequency_penalty: 0.6
            }, {
                headers: {
                    'Authorization': `Bearer ${OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            let content = response.data.choices[0].message.content.trim();
            content = content.replace(/```json\s*/, '').replace(/```\s*$/, '');
            
            const devotionalData = JSON.parse(content);
            
            if (!devotionalData.title || !devotionalData.content || !devotionalData.scriptureReference) {
                throw new Error('Missing required fields');
            }
            
            // Check uniqueness
            const titleCheck = tracker.isTitleUnique(devotionalData.title);
            const contentCheck = tracker.isContentUnique(devotionalData.content);
            
            if (!titleCheck.unique && attempt < maxAttempts) {
                console.log(`⚠️  Attempt ${attempt}: Title not unique, regenerating...`);
                continue;
            }
            
            if (!contentCheck.unique && attempt < maxAttempts) {
                console.log(`⚠️  Attempt ${attempt}: Overused phrases detected, regenerating...`);
                continue;
            }
            
            console.log('✅ Unique devotional generated!');
            return devotionalData;
            
        } catch (error) {
            console.error(`❌ Attempt ${attempt} failed:`, error.message);
            if (attempt === maxAttempts) throw error;
        }
    }
    
    throw new Error('Failed to generate unique devotional');
}

// ENHANCED: Better fallback with real data
function createFallbackDevotional(astronomicalData) {
    const fallbacks = [
        {
            title: "The Eternal Watchman",
            content: `Tonight, as ${astronomicalData.moonPhase.toLowerCase()} illuminates the darkness at ${astronomicalData.moonIllumination}, consider the faithfulness of our Creator. The heavens continue their ancient dance—${astronomicalData.visiblePlanets} shine steadily, and ${astronomicalData.specialEvents.toLowerCase()}. In this ${astronomicalData.season.toLowerCase()} evening, the cosmos reminds us that God's promises are as reliable as the stars themselves. When everything in life feels uncertain, look up. The same God who positioned each celestial body with mathematical precision holds your life with tender care. Tonight's sky over ${astronomicalData.location} is a love letter written in starlight, reminding you that you are seen, known, and cherished by the Creator of galaxies. Step outside during ${astronomicalData.bestViewingTime.toLowerCase()} and let the vastness humble you, the beauty inspire you, and the order reassure you that divine love never fails.`,
            scriptureReference: "Psalm 147:4",
            celestialConnection: `Look for ${astronomicalData.constellations[0]} tonight, along with ${astronomicalData.visiblePlanets}. The ${astronomicalData.moonPhase.toLowerCase()} provides ${astronomicalData.moonIllumination === "100%" ? "brilliant" : "gentle"} lighting for observing God's handiwork.`,
            theme: "faithfulness"
        },
        {
            title: "Whispers in the Cosmic Cathedral",
            content: `The night sky transforms into a vast cathedral tonight. With ${astronomicalData.moonPhase.toLowerCase()} serving as heaven's lantern at ${astronomicalData.moonIllumination} brightness, ${astronomicalData.visiblePlanets} become altar candles in the cosmic sanctuary. ${astronomicalData.specialEvents} serves as tonight's celestial sermon, preached without words yet heard by every searching heart. In this ${astronomicalData.season.toLowerCase()} season over ${astronomicalData.location}, creation's testimony grows louder in the quiet hours. Ancient light from distant stars reaches your eyes tonight—photons that began their journey years ago, arriving at precisely this moment to remind you of timeless truth. God speaks through the grandeur above, inviting you into deeper communion. During ${astronomicalData.bestViewingTime.toLowerCase()}, find a quiet spot and simply be present. Let the majesty overhead draw your spirit toward the Divine presence that fills every inch of space yet dwells intimately within your heart.`,
            scriptureReference: "Job 9:9",
            celestialConnection: `${astronomicalData.constellations.slice(0, 2).join(' and ')} grace tonight's sky. ${astronomicalData.visiblePlanets} shine as faithful witnesses to God's creative power across ${astronomicalData.season.toLowerCase()} evenings.`,
            theme: "wonder"
        }
    ];
    
    const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 1)) / (1000 * 60 * 60 * 24));
    return fallbacks[dayOfYear % fallbacks.length];
}

// Main generation function
async function generateTodaysDevotional() {
    const today = getTodayString();
    const filePath = path.join(DEVOTIONALS_DIR, `${today}.json`);
    
    const tracker = new ContentTracker();
    
    if (fs.existsSync(filePath) && !FORCE_REGENERATE) {
        console.log(`✅ Devotional for ${today} already exists. Skipping generation.`);
        console.log('   Use FORCE_REGENERATE=true to override.');
        return;
    }
    
    if (FORCE_REGENERATE) {
        console.log(`🔄 Force regenerating devotional for ${today}`);
    } else {
        console.log(`📝 Generating new devotional for ${today}`);
    }
    
    try {
        const astronomicalData = getCurrentAstronomicalData();
        console.log('🌌 Astronomical data gathered:');
        console.log('   Moon:', astronomicalData.moonPhase, astronomicalData.moonIllumination);
        console.log('   Planets:', astronomicalData.visiblePlanets);
        console.log('   Event:', astronomicalData.specialEvents);
        
        let devotionalContent;
        
        try {
            console.log('🤖 Attempting AI generation with uniqueness checking...');
            devotionalContent = await generateDevotionalContent(astronomicalData, tracker);
            console.log('✅ AI generation successful!');
        } catch (error) {
            console.log('⚠️  AI generation failed, using enhanced fallback:', error.message);
            devotionalContent = createFallbackDevotional(astronomicalData);
        }
        
        const devotional = {
            id: `devotional-${today}`,
            date: today,
            title: devotionalContent.title,
            content: devotionalContent.content,
            scriptureReference: devotionalContent.scriptureReference,
            celestialConnection: devotionalContent.celestialConnection,
            theme: devotionalContent.theme || 'general',
            moonPhase: astronomicalData.moonPhase,
            moonIllumination: astronomicalData.moonIllumination,
            visiblePlanets: astronomicalData.visiblePlanets,
            specialEvents: astronomicalData.specialEvents,
            constellations: astronomicalData.constellations,
            bestViewingTime: astronomicalData.bestViewingTime,
            season: astronomicalData.season,
            location: astronomicalData.location,
            createdAt: new Date().toISOString(),
            isFallback: !OPENAI_API_KEY || OPENAI_API_KEY === '',
            version: '2.0'
        };
        
        tracker.recordDevotional(devotional);
        
        fs.writeFileSync(filePath, JSON.stringify(devotional, null, 2));
        
        console.log('🎉 Devotional generated successfully!');
        console.log(`📖 Title: ${devotional.title}`);
        console.log(`📜 Scripture: ${devotional.scriptureReference}`);
        console.log(`🌙 Moon: ${devotional.moonPhase} (${devotional.moonIllumination})`);
        console.log(`🪐 Planets: ${devotional.visiblePlanets}`);
        console.log(`✨ Event: ${devotional.specialEvents}`);
        console.log(`📏 Content: ${devotional.content.length} characters`);
        console.log(`💾 Saved to: ${filePath}`);
        
        const report = tracker.getUsageReport();
        console.log('\n📊 Tracker Stats:');
        console.log(`   Total: ${report.overview.totalDevotionals}`);
        console.log(`   Unique titles: ${report.overview.uniqueTitles}`);
        console.log(`   Scripture variety: ${report.overview.scriptureCoverage}`);
        
    } catch (error) {
        console.error('❌ Error generating devotional:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    generateTodaysDevotional()
        .then(() => {
            console.log('🌟 Devotional generation complete!');
        })
        .catch((error) => {
            console.error('💥 Fatal error:', error);
            process.exit(1);
        });
}

module.exports = {
    generateTodaysDevotional,
    getCurrentAstronomicalData,
    createFallbackDevotional
};
