const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Enhanced devotional themes including mental health and daily struggles
const DEVOTIONAL_THEMES = [
    // Original astronomy themes
    "God's creation and cosmic design",
    "Light overcoming darkness",
    "Navigation and guidance from above",
    "The vastness of God's love",
    "Seasons and celestial cycles",
    
    // Mental health and wellness themes
    "Finding peace in anxiety through God's presence",
    "Overcoming depression with heavenly hope",
    "Managing stress through celestial meditation",
    "Recovery and healing under God's watchful sky",
    "Breaking free from addictive patterns",
    "Dealing with grief and loss through starlight comfort",
    "Building resilience through cosmic perspective",
    "Calming racing thoughts with night sky meditation",
    "Finding purpose during difficult seasons",
    "Overcoming loneliness through connection with creation",
    
    // Daily struggle themes
    "Work-life balance reflected in day-night cycles",
    "Financial worries and trusting divine provision",
    "Relationship conflicts and cosmic harmony",
    "Parenting challenges and guiding stars",
    "Health concerns and the Creator's healing power",
    "Career transitions and navigating by faith",
    "Forgiveness and the fresh start of dawn",
    "Patience during waiting periods",
    "Courage for difficult decisions",
    "Hope during seemingly impossible situations"
];

async function generateTodaysDevotional() {
    const today = new Date();
    const dateString = today.toISOString().split('T')[0];
    
    console.log(`🌙 Generating devotional for ${dateString}...`);
    
    // Check if devotional already exists
    const filePath = path.join(__dirname, 'devotionals', `${dateString}.json`);
    if (fs.existsSync(filePath) && process.env.FORCE_REGENERATE !== 'true') {
        console.log(`📚 Devotional for ${dateString} already exists. Skipping generation.`);
        return;
    }
    
    // Load existing devotionals to check for uniqueness
    const existingDevotionals = await loadExistingDevotionals();
    console.log(`📖 Loaded ${existingDevotionals.length} existing devotionals for uniqueness checking`);
    
    // Get celestial info and theme for today
    const celestialInfo = getCelestialInfo(today);
    const selectedTheme = selectThemeForDate(today);
    
    console.log(`🔬 Selected theme: ${selectedTheme}`);
    console.log(`🌕 Celestial info: ${celestialInfo.moonPhase}, ${celestialInfo.visiblePlanets}`);
    
    const prompt = createEnhancedDevotionalPrompt(celestialInfo, today, selectedTheme, existingDevotionals);
    
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
        attempts++;
        console.log(`🎯 Attempt ${attempts} of ${maxAttempts}`);
        
        try {
            const response = await axios.post('https://api.openai.com/v1/chat/completions', {
                model: 'gpt-3.5-turbo',  // Using gpt-3.5-turbo for cost efficiency
                messages: [
                    {
                        role: 'system',
                        content: getEnhancedSystemPrompt()
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                max_tokens: 1000,
                temperature: 0.8
            }, {
                headers: {
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });
            
            const generatedContent = response.data.choices[0].message.content;
            console.log('🤖 AI Response received');
            
            const devotional = parseDevotionalResponse(generatedContent);
            
            // Check for uniqueness
            if (isContentUnique(devotional, existingDevotionals)) {
                await saveDevotional(devotional, dateString, celestialInfo, selectedTheme);
                console.log('✅ Unique devotional generated and saved!');
                return;
            } else {
                console.log(`⚠️  Content not unique enough, retrying... (attempt ${attempts})`);
                if (attempts === maxAttempts) {
                    console.log('⚠️  Max attempts reached, using fallback with modifications');
                    const fallbackDevotional = createEnhancedFallbackDevotional(dateString, celestialInfo, selectedTheme);
                    await saveDevotional(fallbackDevotional, dateString, celestialInfo, selectedTheme);
                }
            }
            
        } catch (error) {
            console.error('❌ Error generating devotional:', error.message);
            if (attempts === maxAttempts) {
                console.log('🔄 Using enhanced fallback devotional');
                const fallbackDevotional = createEnhancedFallbackDevotional(dateString, celestialInfo, selectedTheme);
                await saveDevotional(fallbackDevotional, dateString, celestialInfo, selectedTheme);
            }
        }
    }
}

function getEnhancedSystemPrompt() {
    return `You are a compassionate Christian devotional writer who specializes in connecting celestial observations with spiritual growth and mental wellness. Your devotionals serve people who may be struggling with anxiety, depression, addiction recovery, daily stress, and life challenges.

Your devotionals should:

1. Be contemplative and peaceful, suitable for quiet nighttime reflection
2. Connect celestial events to spiritual truths in meaningful, fresh ways
3. Address real-life struggles with empathy and biblical wisdom
4. Include relevant biblical references that offer hope and healing
5. Be 250-350 words in length for depth and engagement
6. Use gentle, accessible language that speaks to hurting hearts
7. Focus on God's creation, providence, love, and healing power
8. Offer practical encouragement for mental health and daily struggles
9. Provide comfort for anxiety, depression, grief, addiction recovery, and stress
10. Always end with a sense of hope and God's presence

CRITICAL: Each devotional must be completely unique. Avoid recycling phrases, similar metaphors, or repeated concepts. Be creative and original in your approach.

Format your response as JSON with these fields:
- "title": An original, evocative title (never used before)
- "content": The main devotional text with fresh insights
- "scriptureReference": A relevant Bible verse reference
- "celestialConnection": A specific note about tonight's sky observation

Keep the tone gentle, hopeful, and conducive to nighttime prayer and healing reflection.`;
}

function createEnhancedDevotionalPrompt(celestialInfo, date, theme, existingDevotionals) {
    const formatter = new Intl.DateTimeFormat('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    
    // Create a list of used titles to avoid
    const usedTitles = existingDevotionals.map(d => d.title).slice(-30);
    
    return `Create a Christian devotional for tonight (${formatter.format(date)}) that incorporates these celestial observations:

Moon Phase: ${celestialInfo.moonPhase}
Visible Planets: ${celestialInfo.visiblePlanets}
Special Events: ${celestialInfo.specialEvents}
Best Viewing Time: ${celestialInfo.bestViewingTime}
Season: ${celestialInfo.season}

THEME TO ADDRESS: ${theme}

UNIQUENESS REQUIREMENTS:
- Avoid these recently used titles: ${usedTitles.slice(-10).join(', ')}
- Create completely original metaphors and spiritual connections
- Use fresh language and unique perspectives

The devotional should help someone find spiritual meaning while observing tonight's sky, while addressing the specified theme with biblical hope and practical encouragement for mental wellness and daily struggles.`;
}

function selectThemeForDate(date) {
    // Use date-based selection to ensure variety
    const dayOfYear = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
    const themeIndex = dayOfYear % DEVOTIONAL_THEMES.length;
    return DEVOTIONAL_THEMES[themeIndex];
}

async function loadExistingDevotionals() {
    const devotionalsDir = path.join(__dirname, 'devotionals');
    const devotionals = [];
    
    if (!fs.existsSync(devotionalsDir)) {
        return devotionals;
    }
    
    const files = fs.readdirSync(devotionalsDir).filter(file => file.endsWith('.json'));
    
    for (const file of files.slice(-50)) { // Only check last 50 files for performance
        try {
            const filePath = path.join(devotionalsDir, file);
            const content = fs.readFileSync(filePath, 'utf8');
            const devotional = JSON.parse(content);
            devotionals.push(devotional);
        } catch (error) {
            console.warn(`⚠️  Could not load ${file}:`, error.message);
        }
    }
    
    return devotionals.sort((a, b) => new Date(b.date) - new Date(a.date));
}

function isContentUnique(newDevotional, existingDevotionals) {
    // Check title uniqueness
    const titleExists = existingDevotionals.some(d => 
        d.title && d.title.toLowerCase() === newDevotional.title.toLowerCase()
    );
    
    if (titleExists) {
        console.log('❌ Title already exists');
        return false;
    }
    
    // Check for similar content (basic similarity check)
    const newWords = newDevotional.content.toLowerCase().split(/\W+/).filter(w => w.length > 4);
    
    for (const existing of existingDevotionals.slice(0, 20)) { // Check last 20
        if (!existing.content) continue;
        
        const existingWords = existing.content.toLowerCase().split(/\W+/).filter(w => w.length > 4);
        const commonWords = newWords.filter(word => existingWords.includes(word));
        const similarity = commonWords.length / Math.max(newWords.length, existingWords.length);
        
        if (similarity > 0.4) { // More than 40% similar
            console.log(`❌ Content too similar to devotional from ${existing.date} (${Math.round(similarity * 100)}% similar)`);
            return false;
        }
    }
    
    console.log('✅ Content passes uniqueness check');
    return true;
}

function createEnhancedFallbackDevotional(dateString, celestialInfo, theme) {
    const fallbackDevotionals = {
        "Finding peace in anxiety through God's presence": {
            title: "Cosmic Calm in Anxious Moments",
            content: "When anxiety threatens to overwhelm your heart tonight, step outside and gaze upward at the infinite canvas above. The same God who keeps each star in its appointed place holds your anxious thoughts with tender care. Anxiety whispers lies about tomorrow's uncertainties, but the night sky declares eternal truths about God's unchanging faithfulness. Each twinkling light represents a promise kept across millennia—the same constancy available to your restless heart. In this moment of celestial peace, breathe deeply and remember that the Creator of the universe knows your name and cares about every worry that keeps you awake. Let the gentle rhythm of the cosmos slow your racing pulse and remind you that you are held securely in hands that shaped galaxies. Your anxiety is not stronger than the One who commands the morning stars to sing together.",
            scriptureReference: "Philippians 4:6-7"
        },
        
        "Overcoming depression with heavenly hope": {
            title: "Stars Pierce the Deepest Darkness",
            content: "Depression can feel like being trapped under a moonless, starless sky—a darkness so complete that hope seems impossible. But even on the cloudiest night, billions of stars continue to shine above the veil, waiting for their light to break through. Tonight's celestial display reminds us that light persists even when we cannot see it. Your current darkness is not permanent; it is not your final destination. The same creative force that ignites distant suns wants to kindle hope in your weary soul. Depression lies to you about your worth, your future, your purpose—but the God who scattered stars like diamonds across velvet knows the truth about who you are. You are not forgotten in your pain. Each star tonight whispers your name with love, declaring that you are precious, that your story is not over, that dawn will come again to your spirit.",
            scriptureReference: "Psalm 30:5"
        },
        
        "Recovery and healing under God's watchful sky": {
            title: "New Constellations of Recovery",
            content: "Recovery is like learning to read the night sky all over again. Old patterns and addictive behaviors once seemed like fixed stars, unchangeable points of reference in your life. But tonight, as you look up with clearer eyes, you can begin to trace new constellations of hope, healing, and healthy choices. Each night of sobriety is like adding another star to a new pattern of living—sometimes barely visible, sometimes brilliantly clear, but always there. The God who created order from chaos in the cosmos is doing the same work in your life, day by day, choice by choice. Your recovery may feel fragile, like starlight that could be extinguished by clouds, but remember that those stars burn with nuclear fire, and your healing is powered by divine love that will never fade. Tonight, celebrate this moment of clarity, this gift of presence, this opportunity to chart a new course by the light of grace.",
            scriptureReference: "2 Corinthians 5:17"
        }
    };
    
    // Get fallback or use first one
    const selectedFallback = fallbackDevotionals[theme] || fallbackDevotionals[Object.keys(fallbackDevotionals)[0]];
    
    return {
        id: `devotional-${dateString}`,
        date: dateString,
        title: selectedFallback.title,
        content: selectedFallback.content,
        scriptureReference: selectedFallback.scriptureReference,
        celestialConnection: `Tonight's ${celestialInfo.moonPhase.toLowerCase()} creates perfect conditions for reflection and spiritual growth.`,
        moonPhase: celestialInfo.moonPhase,
        visiblePlanets: celestialInfo.visiblePlanets,
        specialEvents: celestialInfo.specialEvents,
        bestViewingTime: celestialInfo.bestViewingTime,
        season: celestialInfo.season,
        createdAt: new Date().toISOString(),
        isEnhancedFallback: true
    };
}

async function saveDevotional(devotional, dateString, celestialInfo, theme) {
    // Create devotionals directory if it doesn't exist
    const devotionalsDir = path.join(__dirname, 'devotionals');
    if (!fs.existsSync(devotionalsDir)) {
        fs.mkdirSync(devotionalsDir);
        console.log('📁 Created devotionals directory');
    }
    
    const filePath = path.join(devotionalsDir, `${dateString}.json`);
    
    const devotionalData = {
        id: devotional.id || `devotional-${dateString}`,
        date: dateString,
        title: devotional.title,
        content: devotional.content,
        scriptureReference: devotional.scriptureReference,
        celestialConnection: devotional.celestialConnection,
        moonPhase: celestialInfo.moonPhase,
        visiblePlanets: celestialInfo.visiblePlanets,
        specialEvents: celestialInfo.specialEvents,
        bestViewingTime: celestialInfo.bestViewingTime,
        season: celestialInfo.season,
        createdAt: new Date().toISOString(),
        theme: theme,
        isEnhanced: true
    };
    
    fs.writeFileSync(filePath, JSON.stringify(devotionalData, null, 2));
    
    console.log(`✅ Devotional saved: ${filePath}`);
    console.log(`📖 Title: ${devotionalData.title}`);
    console.log(`🎯 Theme: ${theme}`);
    console.log(`📝 Content Length: ${devotionalData.content.length} characters`);
    
    // Record in content tracker if available
    try {
        if (fs.existsSync(path.join(__dirname, 'content-tracker.js'))) {
            const ContentTracker = require('./content-tracker.js');
            const tracker = new ContentTracker();
            tracker.recordDevotional(devotionalData);
        }
    } catch (error) {
        console.warn('⚠️  Could not update content tracker:', error.message);
    }
}

// Celestial calculation functions
function getCelestialInfo(date) {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    
    // Moon phase calculation (simplified)
    const moonPhases = ['New Moon', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous', 
                       'Full Moon', 'Waning Gibbous', 'Last Quarter', 'Waning Crescent'];
    const dayOfMonth = date.getDate();
    const phaseIndex = Math.floor((dayOfMonth - 1) * 8 / 30);
    const moonPhase = moonPhases[phaseIndex] || 'New Moon';
    
    // Visible planets (simplified seasonal visibility)
    const seasons = ['Winter', 'Winter', 'Spring', 'Spring', 'Spring', 'Summer', 
                    'Summer', 'Summer', 'Fall', 'Fall', 'Fall', 'Winter'];
    const season = seasons[month - 1];
    
    const planetsBySeasons = {
        'Winter': 'Jupiter, Mars',
        'Spring': 'Venus, Saturn',
        'Summer': 'Jupiter, Saturn', 
        'Fall': 'Mars, Venus'
    };
    const visiblePlanets = planetsBySeasons[season];
    
    // Special events
    let specialEvents = checkSeasonalEvents(month, day);
    if (!specialEvents) specialEvents = 'None';
    
    // Best viewing time
    const bestViewingTime = moonPhase === 'New Moon' ? 
        'Late evening for deep sky objects' : 
        'Early evening before moonrise';
    
    return {
        moonPhase,
        visiblePlanets,
        specialEvents,
        bestViewingTime,
        season
    };
}

function checkSeasonalEvents(month, day) {
    // Meteor showers and special events
    const events = {
        1: { 1: 'Quadrantids Meteor Shower Peak', 5: 'Quadrantids end' },
        4: { 20: 'Lyrids Meteor Shower begins', 25: 'Lyrids peak' },
        5: { 17: 'Eta Aquariids begin', 24: 'Eta Aquariids peak' },
        7: { 17: 'Delta Aquariids begin', 30: 'Delta Aquariids peak' },
        8: { 11: 'Perseids Meteor Shower peak', 24: 'Perseids end' },
        10: { 20: 'Orionids peak', 27: 'Orionids end' },
        11: { 17: 'Leonids peak', 24: 'Leonids end' },
        12: { 13: 'Geminids peak', 17: 'Geminids end' }
    };
    
    return events[month] && events[month][day] ? events[month][day] : null;
}

function parseDevotionalResponse(jsonString) {
    const cleanedString = jsonString
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();
    
    try {
        return JSON.parse(cleanedString);
    } catch (error) {
        console.log('⚠️  JSON parsing failed, attempting to extract manually');
        
        const titleMatch = cleanedString.match(/"title":\s*"([^"]+)"/);
        const contentMatch = cleanedString.match(/"content":\s*"([^"]+)"/);
        const scriptureMatch = cleanedString.match(/"scriptureReference":\s*"([^"]+)"/);
        const celestialMatch = cleanedString.match(/"celestialConnection":\s*"([^"]+)"/);
        
        return {
            title: titleMatch ? titleMatch[1] : "God's Healing Light",
            content: contentMatch ? contentMatch[1] : "Tonight's sky reminds us of God's infinite creativity and healing love.",
            scriptureReference: scriptureMatch ? scriptureMatch[1] : "Psalm 147:3",
            celestialConnection: celestialMatch ? celestialMatch[1] : "Look up and find comfort in God's faithful handiwork tonight."
        };
    }
}

// Run the enhanced generator
console.log('🚀 Starting Enhanced OurNightSky Devotional Generator...');
generateTodaysDevotional().then(() => {
    console.log('✨ Enhanced devotional generation complete!');
}).catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
});
