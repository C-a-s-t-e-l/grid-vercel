require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const BOT_UA_REGEX = /Twitterbot|facebookexternalhit|LinkedInBot|Pinterest|WhatsApp|Discordbot|TelegramBot/i;

module.exports = async (req, res) => {
    const userAgent = req.headers['user-agent'];
    const { id } = req.query;

    if (!BOT_UA_REGEX.test(userAgent)) {
        res.setHeader('Location', `/story.html?id=${id || ''}`);
        return res.status(302).end();
    }
    
    if (!id) {
        return res.status(400).send('Story ID is required for bot preview.');
    }

    try {
        const { data: story, error } = await supabase
            .from('stories')
            .select('title, snippet')
            .eq('id', id)
            .single();

        if (error || !story) {
            return res.status(404).send('Story not found.');
        }
        
        const canonicalUrl = `https://eerie-grid.vercel.app/s/${id}`;
        
        const htmlResponse = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <title>${story.title}</title>
                <meta property="og:title" content="${story.title}">
                <meta property="og:description" content="${story.snippet}">
                <meta property="og:url" content="${canonicalUrl}">
                <meta property="og:image" content="https://www.maptive.com/wp-content/uploads/2024/07/The-Pentagram-Kazakhstan.png">
                <meta property="og:type" content="article">
                <meta name="twitter:card" content="summary_large_image">
            </head>
            <body>
                <h1>${story.title}</h1>
                <p>${story.snippet}</p>
            </body>
            </html>
        `;

        res.setHeader('Content-Type', 'text/html');
        return res.status(200).send(htmlResponse);

    } catch (e) {
        console.error("OG Handler Error:", e);
        return res.status(500).send('Server error generating preview.');
    }
};