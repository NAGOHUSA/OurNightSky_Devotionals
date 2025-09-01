const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function generateTodaysDevotional() {
    const today = new Date();
    const dateString = today.toISOString().split('T')[0]; // YYYY-MM-DD format
    
    console.log(`🌙 Generating devotional for ${dateString}...`);
    
    // Check if OpenAI API key exists
    if (!process.env.OPENAI_API_KEY) {
        console.error('❌ OPENAI_API_KEY environment variable not set');
        createFallbackDevotional(dateString, getCelestialInfo(today));
        return;
    }
    
    // Get celestial info for today
    const celestialInfo = getCelestialInfo(today);
    console.log(`🔡 Celestial info: ${celestialInfo.moonPhase}, ${celestialInfo.visiblePlanets}`);
    
    const prompt = createDevotionalPrompt(celestialInfo, today);
    
    try {
        console.log('🤖 Calling OpenAI API...');
        
        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
            model: 'gpt-3.5-turbo',
            messages: [
                {
                    role: 'system',
                    content: `You are a thoughtful Christian devotional writer who creates peaceful, reflective content for people observing the night sky. Your devotionals should:
                    
1. Be contemplative and peaceful, suitable for quiet nighttime reflection
2. Connect celestial events to spiritual truths in meaningful ways
3. Include relevant biblical references when appropriate
4. Be 200-300 words in length
5. Use gentle, accessible language that speaks to the heart
6. Focus on God's creation, providence, and love
7. Encourage peaceful meditation and prayer
8. Create UNIQUE content for each day - never repeat the same devotional

Format your response as VALID JSON with these fields:
{
  "title": "A peaceful, evocative title (must be unique)",
  "content": "The main devotional text (200-300 words, unique content)",
  "scriptureReference": "A relevant Bible verse reference (book chapter:verse format)",
  "celestialConnection": "A specific note about tonight's sky observation"
}

IMPORTANT: Each devotional must be completely unique. Never repeat titles or content.`
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            max_tokens: 1000,
            temperature: 0.8 // Increased for more variety
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            timeout: 30000 // 30 second timeout
        });
        
        console.log('✅ OpenAI API response received');
        console.log('📝 Response preview:', response.data.choices[0].message.content.substring(0, 100) + '...');
        
        const generatedContent = response.data.choices[0].message.content;
        const devotional = parseDevotionalResponse(generatedContent);
        
        // Validate that we got unique content
        if (devotional.title === "The Vast Canvas of Creation") {
            console.log('⚠️ Generated content appears to be fallback, retrying...');
            throw new Error('Generated content is not unique');
        }
        
        // Create devotionals directory if it doesn't exist
        const devotionalsDir = path.join(__dirname, 'devotionals');
        if (!fs.existsSync(devotionalsDir)) {
            fs.mkdirSync(devotionalsDir);
            console.log('📁 Created devotionals directory');
        }
        
        // Save to file
        const filePath = path.join(devotionalsDir, `${dateString}.json`);
        
        const devotionalData = {
            id: `devotional-${dateString}`,
            date: dateString,
            title: devotional.title,
            content: devotional.content,
            scriptureReference: devotional.scriptureReference || devotional.scripture_reference, // Handle both formats
            celestialConnection: devotional.celestialConnection || devotional.celestial_connection,
            moonPhase: celestialInfo.moonPhase,
            visiblePlanets: celestialInfo.visiblePlanets,
            specialEvents: celestialInfo.specialEvents,
            bestViewingTime: celestialInfo.bestViewingTime,
            season: celestialInfo.season,
            createdAt: new Date().toISOString(),
            isAIGenerated: true
        };
        
        fs.writeFileSync(filePath, JSON.stringify(devotionalData, null, 2));
        
        console.log(`✅ AI-generated devotional saved to ${filePath}`);
        console.log(`📖 Title: "${devotional.title}"`);
        console.log(`📜 Scripture: ${devotional.scriptureReference || devotional.scripture_reference}`);
        console.log(`🌌 Celestial: ${devotional.celestialConnection || devotional.celestial_connection}`);
        
    } catch (error) {
        console.error('❌ Error generating devotional:');
        console.error('Status:', error.response?.status);
        console.error('Status Text:', error.response?.statusText);
        console.error('Error Data:', error.response?.data);
        console.error('Error Message:', error.message);
        
        // Create a fallback devotional so the action doesn't fail
        createFallbackDevotional(dateString, celestialInfo);
    }
}

function getCelestialInfo(date) {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    
    // More accurate moon phase calculation
    const moonPhase = calculateMoonPhase(date);
    
    // Seasonal planet visibility with more variety
    let visiblePlanets, specialEvents, bestViewingTime;
    
    // Add some randomization based on the date to create variety
    const dateVariation = (day + month) % 4;
    
    switch(Math.floor((month - 1) / 3)) {
        case 0: // Spring (Mar-May)
            const springPlanets = [
                "Venus, Jupiter visible in evening sky",
                "Mars, Saturn rising after midnight",
                "Jupiter, Venus bright in western horizon",
                "Saturn, Mars visible most of night"
            ];
            visiblePlanets = springPlanets[dateVariation];
            specialEvents = checkSpringEvents(month, day);
            bestViewingTime = "8:00 PM - 1:00 AM";
            break;
        case 1: // Summer (Jun-Aug)
            const summerPlanets = [
                "Saturn, Mars rising after sunset",
                "Jupiter, Venus visible in twilight",
                "Mars, Saturn bright in southern sky",
                "Venus, Jupiter setting in west"
            ];
            visiblePlanets = summerPlanets[dateVariation];
            specialEvents = checkSummerEvents(month, day);
            bestViewingTime = "10:00 PM - 12:00 AM";
            break;
        case 2: // Autumn (Sep-Nov)
            const autumnPlanets = [
                "Jupiter, Saturn visible most of night",
                "Mars, Venus bright in evening sky",
                "Saturn, Jupiter high in southern sky",
                "Venus, Mars setting in western sky"
            ];
            visiblePlanets = autumnPlanets[dateVariation];
            specialEvents = checkAutumnEvents(month, day);
            bestViewingTime = "7:00 PM - 1:00 AM";
            break;
        default: // Winter (Dec-Feb)
            const winterPlanets = [
                "Jupiter, Mars bright in winter sky",
                "Saturn, Venus visible in evening",
                "Mars, Jupiter high overhead",
                "Venus, Saturn low in western sky"
            ];
            visiblePlanets = winterPlanets[dateVariation];
            specialEvents = checkWinterEvents(month, day);
            bestViewingTime = "6:00 PM - 2:00 AM";
    }
    
    const seasons = ['Winter', 'Winter', 'Spring', 'Spring', 'Summer', 'Summer', 
                    'Summer', 'Summer', 'Autumn', 'Autumn', 'Autumn', 'Winter'];
    
    return {
        moonPhase,
        visiblePlanets,
        specialEvents: specialEvents || "Clear skies perfect for stargazing",
        bestViewingTime,
        season: seasons[month - 1]
    };
}

// More accurate moon phase calculation
function calculateMoonPhase(date) {
    const moonPhases = [
        'New Moon', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous', 
        'Full Moon', 'Waning Gibbous', 'Third Quarter', 'Waning Crescent'
    ];
    
    // Known new moon date: January 11, 2024
    const knownNewMoon = new Date('2024-01-11');
    const lunarMonth = 29.53058867; // days
    
    const daysDiff = (date - knownNewMoon) / (1000 * 60 * 60 * 24);
    const lunarCycle = daysDiff / lunarMonth;
    const currentCycle = lunarCycle - Math.floor(lunarCycle);
    
    const phaseIndex = Math.round(currentCycle * 8) % 8;
    return moonPhases[phaseIndex];
}

function checkSpringEvents(month, day) {
    if (month === 4 && day >= 16 && day <= 25) return "Lyrids Meteor Shower";
    if (month === 5 && day >= 17 && day <= 24) return "Eta Aquariids Meteor Shower";
    if (month === 3 && day === 20) return "Spring Equinox";
    return null;
}

function checkSummerEvents(month, day) {
    if (month === 7 && day >= 17 && day <= 24) return "Delta Aquariids Meteor Shower";
    if (month === 8 && day >= 11 && day <= 13) return "Perseids Meteor Shower Peak";
    if (month === 6 && day === 21) return "Summer Solstice";
    return null;
}

function checkAutumnEvents(month, day) {
    if (month === 10 && day >= 20 && day <= 22) return "Orionids Meteor Shower";
    if (month === 11 && day >= 17 && day <= 18) return "Leonids Meteor Shower";
    if (month === 9 && day === 22) return "Autumn Equinox";
    return null;
}

function checkWinterEvents(month, day) {
    if (month === 1 && day >= 1 && day <= 5) return "Quadrantids Meteor Shower";
    if (month === 12 && day >= 13 && day <= 15) return "Geminids Meteor Shower Peak";
    if (month === 12 && day === 21) return "Winter Solstice";
    return null;
}

function createDevotionalPrompt(celestialInfo, date) {
    const formatter = new Intl.DateTimeFormat('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    
    return `Create a UNIQUE Christian devotional for tonight (${formatter.format(date)}) that incorporates these celestial observations:

Moon Phase: ${celestialInfo.moonPhase}
Visible Planets: ${celestialInfo.visiblePlanets}
Special Events: ${celestialInfo.specialEvents}
Best Viewing Time: ${celestialInfo.bestViewingTime}
Season: ${celestialInfo.season}

REQUIREMENTS:
- This must be completely UNIQUE content - never use the title "The Vast Canvas of Creation" or similar generic titles
- Create original content that hasn't been used before
- Make it specific to tonight's date: ${formatter.format(date)}
- Connect the specific celestial events above to spiritual truths
- Be contemplative and peaceful for nighttime reflection
- Include a relevant Bible verse reference
- 200-300 words of original content

The devotional should help someone find spiritual meaning while observing tonight's sky. Connect these celestial events to themes of faith, hope, God's creation, and His loving care for us.`;
}

function parseDevotionalResponse(jsonString) {
    // Clean up the response more thoroughly
    let cleanedString = jsonString
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .replace(/^\s*[\r\n]/gm, '') // Remove empty lines
        .trim();
    
    // Try to find JSON within the response if it's wrapped in text
    const jsonMatch = cleanedString.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        cleanedString = jsonMatch[0];
    }
    
    try {
        const parsed = JSON.parse(cleanedString);
        console.log('✅ Successfully parsed JSON response');
        return parsed;
    } catch (error) {
        console.log('⚠️ JSON parsing failed, attempting manual extraction');
        console.log('Raw response:', cleanedString);
        
        // Try to extract content manually if JSON parsing fails
        const titleMatch = cleanedString.match(/"title"\s*:\s*"([^"]+)"/i);
        const contentMatch = cleanedString.match(/"content"\s*:\s*"([^"]+)"/i);
        const scriptureMatch = cleanedString.match(/"scriptureReference"\s*:\s*"([^"]+)"/i) ||
                              cleanedString.match(/"scripture_reference"\s*:\s*"([^"]+)"/i);
        const celestialMatch = cleanedString.match(/"celestialConnection"\s*:\s*"([^"]+)"/i) ||
                              cleanedString.match(/"celestial_connection"\s*:\s*"([^"]+)"/i);
        
        return {
            title: titleMatch ? titleMatch[1] : `Night Reflections for ${new Date().toLocaleDateString()}`,
            content: contentMatch ? contentMatch[1] : "Tonight's sky reminds us of God's infinite creativity and love. Each star tells a story of His faithfulness.",
            scriptureReference: scriptureMatch ? scriptureMatch[1] : "Psalm 19:1",
            celestialConnection: celestialMatch ? celestialMatch[1] : "Look up and marvel at God's handiwork tonight."
        };
    }
}

function createFallbackDevotional(dateString, celestialInfo) {
    console.log('⚠️ Creating fallback devotional...');
    
    // Create more varied fallback devotionals based on date
    const date = new Date(dateString);
    const dayOfYear = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
    
    const fallbackDevotionals = [
        {
            title: "God's Celestial Timepiece",
            content: "Tonight, as we observe the heavens, we witness God's perfect timepiece in motion. The moon in its current phase and the planets in their ordained paths remind us that our Creator is a God of order and precision. Just as the celestial bodies follow their appointed courses, we too can trust that God has a perfect plan for our lives. The vastness of space doesn't diminish His personal care for each of us, but rather magnifies it. How amazing that the God who set the stars in place also knows the number of hairs on our heads.",
            scriptureReference: "Jeremiah 31:35-36",
            celestialConnection: `Tonight's ${celestialInfo.moonPhase.toLowerCase()} and visible planets create a perfect backdrop for contemplating God's sovereignty.`
        },
        {
            title: "Whispers in the Night Sky",
            content: "In the gentle silence of the night, God speaks to us through His creation. The soft glow of celestial bodies offers a different kind of revelation than the bold brightness of day. Tonight's sky invites us into quiet communion with our Creator. As we gaze upward, we join countless generations who have found comfort and direction in these same stars. The consistency of their light reminds us of God's unchanging nature and His promises that endure forever.",
            scriptureReference: "Psalm 8:3-4",
            celestialConnection: `${celestialInfo.visiblePlanets} shine as beacons of God's faithfulness during ${celestialInfo.bestViewingTime.toLowerCase()}.`
        },
        {
            title: "The Language of Light",
            content: "Every photon that reaches our eyes tonight began its journey across vast distances, carrying with it a message from the depths of space. In the same way, God's love travels across any distance to reach our hearts. The ancient light of stars reminds us that God's word is eternal, transcending time and space. Tonight's celestial display is a love letter written in light, reminding us that we are cherished beyond measure by the One who spoke these wonders into existence.",
            scriptureReference: "Isaiah 55:11",
            celestialConnection: `The special beauty of tonight's sky during ${celestialInfo.season.toLowerCase()} speaks of God's perfect timing in all things.`
        }
    ];
    
    // Select based on day of year for variety
    const selected = fallbackDevotionals[dayOfYear % fallbackDevotionals.length];
    
    const devotionalsDir = path.join(__dirname, 'devotionals');
    if (!fs.existsSync(devotionalsDir)) {
        fs.mkdirSync(devotionalsDir);
    }
    
    const devotionalData = {
        id: `devotional-${dateString}`,
        date: dateString,
        title: selected.title,
        content: selected.content,
        scriptureReference: selected.scriptureReference,
        celestialConnection: selected.celestialConnection,
        moonPhase: celestialInfo.moonPhase,
        visiblePlanets: celestialInfo.visiblePlanets,
        specialEvents: celestialInfo.specialEvents,
        bestViewingTime: celestialInfo.bestViewingTime,
        season: celestialInfo.season,
        createdAt: new Date().toISOString(),
        isFallback: true
    };
    
    const filePath = path.join(devotionalsDir, `${dateString}.json`);
    fs.writeFileSync(filePath, JSON.stringify(devotionalData, null, 2));
    
    console.log(`⚠️ Created fallback devotional for ${dateString}: "${selected.title}"`);
}

// Run the generator
generateTodaysDevotional();
