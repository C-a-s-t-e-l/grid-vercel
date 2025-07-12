require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');


const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

module.exports = async (req, res) => {
    const { id } = req.query;

    if (!id) {
        return res.status(400).send('Story ID is required');
    }

    try {
        const { data: story, error } = await supabase
            .from('stories')
            .select('title, snippet') 
            .eq('id', id)
            .single();

        if (error || !story) {
            res.setHeader('Location', '/index.html');
            return res.status(302).end();
        }

        
        const htmlResponse = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${story.title} - Eerie Grid PH</title>
                
                <!-- Open Graph / Facebook -->
                <meta property="og:type" content="article">
                <meta property="og:url" content="https://eerie-grid.vercel.app/story.html?id=${id}">
                <meta property="og:title" content="${story.title}">
                <meta property="og:description" content="${story.snippet}">
                <meta property="og:image" content="https://www.maptive.com/wp-content/uploads/2024/07/The-Pentagram-Kazakhstan.png">
                
                <!-- Twitter -->
                <meta property="twitter:card" content="summary_large_image">
                <meta property="twitter:url" content="https://eerie-grid.vercel.app/story.html?id=${id}">
                <meta property="twitter:title" content="${story.title}">
                <meta property="twitter:description" content="${story.snippet}">
                <meta property="twitter:image" content="https://www.maptive.com/wp-content/uploads/2024/07/The-Pentagram-Kazakhstan.png">

                <!-- A script to redirect real users who might land here -->
                <script>
                    window.location.href = "/story.html?id=${id}";
                </script>
            </head>
            <body>
                <h1>${story.title}</h1>
                <p>${story.snippet}</p>
                <p>Loading the full story...</p>
            </body>
            </html>
        `;

        res.setHeader('Content-Type', 'text/html');
        return res.status(200).send(htmlResponse);

    } catch (e) {
        console.error("OG Handler Error:", e);
        res.setHeader('Location', '/index.html');
        return res.status(302).end();
    }
};