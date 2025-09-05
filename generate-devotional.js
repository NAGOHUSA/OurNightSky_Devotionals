const fs = require('fs');
const path = require('path');
const axios = require('axios');

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

// Get astronomical data for the current date
function getCurrentAstronomicalData() {
    const today = new Date();
    const month = today.getMonth() + 1; // 0-indexed
    const day = today.getDate();
    
    // Simple moon phase calculation (approximation)
    const year = today.getFullYear();
    const totalDays = Math.floor((today - new Date(year, 0, 1)) / (1000 * 60 * 60 * 24));
    const lunarCycle = 29.53; // days
    const phase = (totalDays % lunarCycle) / lunarCycle;
    
    let moonPhase;
    if (phase < 0.1 || phase > 0.9) moonPhase = "New Moon";
    else if (phase < 0.3) moonPhase = "Waxing Crescent";
    else if (phase < 0.4) moonPhase = "First Quarter";
    else if (phase < 0.6) moonPhase = "Waxing Gibbous";
    else if (phase < 0.7) moonPhase = "Full Moon";
    else if (phase < 0.8) moonPhase = "Waning Gibbous";
    else if (phase < 0.9) moonPhase = "Last Quarter";
    else moonPhase = "Waning Crescent";
    
    // Season based on month
    let season;
    if (month >= 3 && month <= 5) season = "Spring";
    else if (month >= 6 && month <= 8) season = "Summer";
    else if (month >= 9 && month <= 11) season = "Autumn";
    else season = "Winter";
    
    // Visible planets (simplified - varies throughout year)
    const visiblePlanets = [
        "Venus (Evening Star)",
        "Mars",
        "Jupiter", 
        "Saturn"
    ];
    
    // Random selection of 2-3 planets
    const shuffled = visiblePlanets.sort(() => 0.5 - Math.random());
    const selectedPlanets = shuffled.slice(0, Math.floor(Math.random() * 2) + 2);
    
    return {
        moonPhase,
        visiblePlanets: selectedPlanets.join(", "),
        specialEvents: getSpecialEvents(month, day),
        bestViewingTime: "9:00 PM - 11:00 PM local time",
        season
    };
}

// Get special astronomical events
function getSpecialEvents(month, day) {
    const events = [
        "Orion constellation visible in the southern sky",
        "The Big Dipper appears high in the northern sky", 
        "Cassiopeia constellation forms a distinctive 'W' shape",
        "The North Star (Polaris) provides steady guidance",
        "Mars appears as a reddish point of light",
        "Jupiter shines brightly as the 'wandering star'",
        "The Milky Way stretches across the celestial dome",
        "Venus appears as the brilliant evening star",
        "Saturn's rings are visible through binoculars"
    ];
    
    // Return a rotating selection based on day of year
    const dayOfYear = month * 30 + day; // Approximation
    return events[dayOfYear % events.length];
}

// Generate devotional content using OpenAI
async function generateDevotionalContent(astronomicalData) {
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
    
    const prompt = `Create a Christian devotional for tonight (${dateString}) that incorporates these celestial observations:

Moon Phase: ${astronomicalData.moonPhase}
Visible Planets: ${astronomicalData.visiblePlanets}
Special Events: ${astronomicalData.specialEvents}
Best Viewing Time: ${astronomicalData.bestViewingTime}
Season: ${astronomicalData.season}

The devotional should:
1. Be peaceful and contemplative, suitable for quiet nighttime reflection
2. Connect tonight's celestial events to spiritual truths in meaningful ways
3. Include a relevant biblical reference
4. Be 250-350 words in length
5. Use gentle, accessible language that speaks to the heart
6. Focus on God's creation, providence, and love
7. Encourage peaceful meditation and prayer

Format your response as JSON with these exact fields:
- "title": A peaceful, evocative title (50 characters or less)
- "content": The main devotional text (250-350 words)
- "scriptureReference": A relevant Bible verse reference (book chapter:verse format)
- "celestialConnection": A specific note about tonight's sky observation (2-3 sentences)

Keep the tone gentle, hopeful, and conducive to nighttime prayer and reflection.`;

    try {
        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: 'gpt-3.5-turbo',
            messages: [
                {
                    role: 'system',
                    content: 'You are a thoughtful Christian devotional writer who creates peaceful, reflective content for people observing the night sky. Always respond with valid JSON only, no additional text.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            max_tokens: 800,
            temperature: 0.7
        }, {
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        let content = response.data.choices[0].message.content.trim();
        
        // Clean up the response - remove markdown formatting if present
        content = content.replace(/```json\s*/, '').replace(/```\s*$/, '');
        
        // Parse the JSON response
        const devotionalData = JSON.parse(content);
        
        // Validate required fields
        if (!devotionalData.title || !devotionalData.content || !devotionalData.scriptureReference) {
            throw new Error('Missing required fields in AI response');
        }
        
        return devotionalData;
        
    } catch (error) {
        console.error('OpenAI API Error:', error.response?.data || error.message);
        throw error;
    }
}

// Create fallback devotional if AI generation fails
function createFallbackDevotional(astronomicalData) {
    const today = getTodayString();
    
    const fallbackTitles = [
        "God's Faithful Light",
        "Night's Silent Testimony", 
        "Celestial Reflections",
        "Under Heaven's Canopy",
        "Stars of Promise"
    ];
    
    const fallbackContents = [
        `Tonight's sky speaks of God's faithfulness in ways that transcend our earthly concerns. The ${astronomicalData.moonPhase.toLowerCase()} reminds us that even in seasons of change, divine love remains constant. As ${astronomicalData.visiblePlanets} shine above, we're reminded that God has numbered every star and calls each by name. In this ${astronomicalData.season.toLowerCase()} evening, let the vastness of creation draw your heart to the intimate love of our Creator. The same God who set the celestial bodies in motion cares deeply for your every need. Take a moment to step outside during ${astronomicalData.bestViewingTime.toLowerCase()} and let the night sky remind you of promises that never fail. Tonight's special feature, ${astronomicalData.specialEvents.toLowerCase()}, serves as a gentle reminder that divine order persists even when our world feels chaotic. Rest in the knowledge that the One who created this magnificent display holds you in perfect love.`,
        
        `As darkness settles and tonight's ${astronomicalData.moonPhase.toLowerCase()} appears, we're invited into a sacred rhythm of rest and reflection. The ${astronomicalData.visiblePlanets} visible this evening remind us that we are part of something far greater than ourselves—a cosmic story of divine love unfolding since the beginning of time. In this ${astronomicalData.season.toLowerCase()} season, God's creation continues its ancient dance of beauty and order. Tonight, as you observe ${astronomicalData.specialEvents.toLowerCase()}, remember that the same creative power that spoke these wonders into existence speaks words of love and hope over your life. The best viewing time, ${astronomicalData.bestViewingTime.toLowerCase()}, offers a perfect opportunity for prayer and meditation. Let the silence of the night sky draw you into deeper communion with your Creator, where peace transcends understanding and love casts out all fear.`
    ];
    
    const fallbackScriptures = [
        "Psalm 8:3-4",
        "Genesis 1:16", 
        "Psalm 19:1",
        "Isaiah 40:26",
        "Psalm 147:4"
    ];
    
    const fallbackConnections = [
        `Tonight's ${astronomicalData.moonPhase.toLowerCase()} and ${astronomicalData.visiblePlanets} serve as faithful witnesses to God's unchanging character. Even as seasons change, His love remains constant.`,
        `Look for ${astronomicalData.specialEvents.toLowerCase()} tonight during ${astronomicalData.bestViewingTime.toLowerCase()}—a reminder that divine beauty persists even in dark times.`
    ];
    
    // Use day of year to rotate through options
    const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 1)) / (1000 * 60 * 60 * 24));
    
    return {
        title: fallbackTitles[dayOfYear % fallbackTitles.length],
        content: fallbackContents[dayOfYear % fallbackContents.length],
        scriptureReference: fallbackScriptures[dayOfYear % fallbackScriptures.length],
        celestialConnection: fallbackConnections[dayOfYear % fallbackConnections.length]
    };
}

// Main generation function
async function generateTodaysDevotional() {
    const today = getTodayString();
    const filePath = path.join(DEVOTIONALS_DIR, `${today}.json`);
    
    // Check if devotional already exists (unless force regenerate)
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
        // Get current astronomical data
        const astronomicalData = getCurrentAstronomicalData();
        console.log('🌌 Astronomical data gathered:', astronomicalData);
        
        let devotionalContent;
        
        try {
            // Try to generate using AI
            console.log('🤖 Attempting AI generation...');
            devotionalContent = await generateDevotionalContent(astronomicalData);
            console.log('✅ AI generation successful!');
        } catch (error) {
            console.log('⚠️  AI generation failed, using fallback:', error.message);
            devotionalContent = createFallbackDevotional(astronomicalData);
        }
        
        // Create the complete devotional object
        const devotional = {
            id: `devotional-${today}`,
            date: today,
            title: devotionalContent.title,
            content: devotionalContent.content,
            scriptureReference: devotionalContent.scriptureReference,
            celestialConnection: devotionalContent.celestialConnection,
            moonPhase: astronomicalData.moonPhase,
            visiblePlanets: astronomicalData.visiblePlanets,
            specialEvents: astronomicalData.specialEvents,
            bestViewingTime: astronomicalData.bestViewingTime,
            season: astronomicalData.season,
            createdAt: new Date().toISOString(),
            isFallback: !OPENAI_API_KEY || OPENAI_API_KEY === ''
        };
        
        // Write to file
        fs.writeFileSync(filePath, JSON.stringify(devotional, null, 2));
        
        console.log('🎉 Devotional generated successfully!');
        console.log(`📖 Title: ${devotional.title}`);
        console.log(`📜 Scripture: ${devotional.scriptureReference}`);
        console.log(`🌙 Moon Phase: ${devotional.moonPhase}`);
        console.log(`📏 Content Length: ${devotional.content.length} characters`);
        console.log(`📁 Saved to: ${filePath}`);
        
    } catch (error) {
        console.error('❌ Error generating devotional:', error);
        process.exit(1);
    }
}

// Run if called directly
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
