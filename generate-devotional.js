const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function generateTodaysDevotional() {
    const today = new Date();
    const dateString = today.toISOString().split('T')[0]; // YYYY-MM-DD format
    
    console.log(`🌙 Generating devotional for ${dateString}...`);
    
    // Get celestial info for today
    const celestialInfo = getCelestialInfo(today);
    console.log(`📡 Celestial info: ${celestialInfo.moonPhase}, ${celestialInfo.visiblePlanets}`);
    
    const prompt = createDevotionalPrompt(celestialInfo, today);
    
    try {
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

Format your response as JSON with these fields:
- "title": A peaceful, evocative title
- "content": The main devotional text
- "scriptureReference": A relevant Bible verse reference (book chapter:verse format)
- "celestialConnection": A specific note about tonight's sky observation

Keep the tone gentle, hopeful, and conducive to nighttime prayer and reflection.`
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
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        
        const generatedContent = response.data.choices[0].message.content;
        console.log('🤖 AI Response received');
        
        const devotional = parseDevotionalResponse(generatedContent);
        
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
            scriptureReference: devotional.scriptureReference,
            celestialConnection: devotional.celestialConnection,
            moonPhase: celestialInfo.moonPhase,
            visiblePlanets: celestialInfo.visiblePlanets,
            specialEvents: celestialInfo.specialEvents,
            bestViewingTime: celestialInfo.bestViewingTime,
            season: celestialInfo.season,
            createdAt: new Date().toISOString()
        };
        
        fs.writeFileSync(filePath, JSON.stringify(devotionalData, null, 2));
        
        console.log(`✅ Generated devotional saved to ${filePath}`);
        console.log(`📖 Title: "${devotional.title}"`);
        
    } catch (error) {
        console.error('❌ Error generating devotional:', error.response?.data || error.message);
        
        // Create a fallback devotional so the action doesn't fail
        const fallbackDevotional = createFallbackDevotional(dateString, celestialInfo);
        const devotionalsDir = path.join(__dirname, 'devotionals');
        if (!fs.existsSync(devotionalsDir)) {
            fs.mkdirSync(devotionalsDir);
        }
        
        const filePath = path.join(devotionalsDir, `${dateString}.json`);
        fs.writeFileSync(filePath, JSON.stringify(fallbackDevotional, null, 2));
        
        console.log(`⚠️  Created fallback devotional for ${dateString}`);
    }
}

function getCelestialInfo(date) {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    
    // Calculate moon phase (simplified)
    const moonPhases = [
        'New Moon', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous', 
        'Full Moon', 'Waning Gibbous', 'Third Quarter', 'Waning Crescent'
    ];
    
    // Simple calculation based on day of month (approximation)
    const dayOfMonth = date.getDate();
    const phaseIndex = Math.floor((dayOfMonth / 3.5) % 8);
    const moonPhase = moonPhases[phaseIndex];
    
    // Seasonal planet visibility
    let visiblePlanets, specialEvents, bestViewingTime;
    
    switch(Math.floor((month - 1) / 3)) {
        case 0: // Spring (Mar-May)
            visiblePlanets = "Venus, Jupiter visible in evening sky";
            specialEvents = checkSpringEvents(month, day);
            bestViewingTime = "8:00 PM - 1:00 AM";
            break;
        case 1: // Summer (Jun-Aug)
            visiblePlanets = "Saturn, Mars rising after sunset";
            specialEvents = checkSummerEvents(month, day);
            bestViewingTime = "10:00 PM - 12:00 AM";
            break;
        case 2: // Autumn (Sep-Nov)
            visiblePlanets = "Jupiter, Saturn visible most of night";
            specialEvents = checkAutumnEvents(month, day);
            bestViewingTime = "7:00 PM - 1:00 AM";
            break;
        default: // Winter (Dec-Feb)
            visiblePlanets = "Jupiter, Mars bright in winter sky";
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

function checkSpringEvents(month, day) {
    if (month === 4 && day >= 16 && day <= 25) return "Lyrids Meteor Shower";
    if (month === 5 && day >= 17 && day <= 24) return "Eta Aquariids Meteor Shower";
    return null;
}

function checkSummerEvents(month, day) {
    if (month === 7 && day >= 17 && day <= 24) return "Delta Aquariids Meteor Shower";
    if (month === 8 && day >= 11 && day <= 13) return "Perseids Meteor Shower Peak";
    return null;
}

function checkAutumnEvents(month, day) {
    if (month === 10 && day >= 20 && day <= 22) return "Orionids Meteor Shower";
    if (month === 11 && day >= 17 && day <= 18) return "Leonids Meteor Shower";
    return null;
}

function checkWinterEvents(month, day) {
    if (month === 1 && day >= 1 && day <= 5) return "Quadrantids Meteor Shower";
    if (month === 12 && day >= 13 && day <= 15) return "Geminids Meteor Shower Peak";
    return null;
}

function createDevotionalPrompt(celestialInfo, date) {
    const formatter = new Intl.DateTimeFormat('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    
    return `Create a Christian devotional for tonight (${formatter.format(date)}) that incorporates these celestial observations:

Moon Phase: ${celestialInfo.moonPhase}
Visible Planets: ${celestialInfo.visiblePlanets}
Special Events: ${celestialInfo.specialEvents}
Best Viewing Time: ${celestialInfo.bestViewingTime}
Season: ${celestialInfo.season}

The devotional should help someone find spiritual meaning while observing tonight's sky. Connect these celestial events to themes of faith, hope, God's creation, and His loving care for us.`;
}

function parseDevotionalResponse(jsonString) {
    // Clean up the response
    const cleanedString = jsonString
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();
    
    try {
        return JSON.parse(cleanedString);
    } catch (error) {
        console.log('⚠️  JSON parsing failed, attempting to extract manually');
        
        // Try to extract content manually if JSON parsing fails
        const titleMatch = cleanedString.match(/"title":\s*"([^"]+)"/);
        const contentMatch = cleanedString.match(/"content":\s*"([^"]+)"/);
        const scriptureMatch = cleanedString.match(/"scriptureReference":\s*"([^"]+)"/);
        const celestialMatch = cleanedString.match(/"celestialConnection":\s*"([^"]+)"/);
        
        return {
            title: titleMatch ? titleMatch[1] : "God's Night Canvas",
            content: contentMatch ? contentMatch[1] : "Tonight's sky reminds us of God's infinite creativity and love.",
            scriptureReference: scriptureMatch ? scriptureMatch[1] : "Psalm 19:1",
            celestialConnection: celestialMatch ? celestialMatch[1] : "Look up and marvel at God's handiwork tonight."
        };
    }
}

function createFallbackDevotional(dateString, celestialInfo) {
    const fallbackDevotionals = [
        {
            title: "The Vast Canvas of Creation",
            content: "As you stand beneath the infinite expanse of stars tonight, consider the magnificent canvas that God has painted across the heavens. Each point of light represents not just a distant sun, but a testament to the Creator's boundless creativity and power. The psalmist wrote, 'The heavens declare the glory of God; the skies proclaim the work of his hands.' In this moment of quiet contemplation, allow the vastness above to remind you of God's endless love for you.",
            scriptureReference: "Psalm 19:1",
            celestialConnection: `Tonight's ${celestialInfo.moonPhase.toLowerCase()} creates perfect conditions for reflection.`
        },
        {
            title: "Light in the Darkness",
            content: "The gentle glow of tonight's moon serves as a reminder that even in the darkest moments, God's light finds a way to shine through. Unlike the sun's brilliant rays, the moon offers a softer illumination—one that doesn't overwhelm but instead provides comfort and guidance. In our spiritual journey, there are times when God's presence feels more like moonlight than sunlight: gentle, subtle, but undeniably present.",
            scriptureReference: "Isaiah 60:19-20",
            celestialConnection: `${celestialInfo.visiblePlanets} are visible during ${celestialInfo.bestViewingTime.toLowerCase()}.`
        }
    ];
    
    const selected = fallbackDevotionals[Math.floor(Math.random() * fallbackDevotionals.length)];
    
    return {
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
}

// Run the generator
generateTodaysDevotional();
