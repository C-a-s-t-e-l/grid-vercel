const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);


const WEBSITE_URL = 'https://eerie-grid.vercel.app';

module.exports = async (req, res) => {
    res.setHeader('Content-Type', 'application/xml');
  
    res.setHeader('Cache-Control', 's-maxage=43200, stale-while-revalidate'); 

    try {
        const { data: stories, error } = await supabase
            .from('stories')
            .select('id, created_at') 
            .eq('is_approved', true);

        if (error) {
            console.error('Supabase query error in sitemap:', error);
            throw error;
        }

        let xml = `<?xml version="1.0" encoding="UTF-8"?>`;
        xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

        const staticPages = ['/', '/map.html', '/archive.html', '/codex.html', '/artifacts.html', '/keepers-note.html'];
        staticPages.forEach(page => {
            xml += `
              <url>
                <loc>${WEBSITE_URL}${page === '/' ? '' : page}</loc>
                <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
                <priority>${page === '/' ? '1.0' : '0.8'}</priority>
              </url>
            `;
        });

        stories.forEach(story => {
            xml += `
              <url>
                <loc>${WEBSITE_URL}/s/${story.id}</loc>
                <lastmod>${new Date(story.created_at).toISOString().split('T')[0]}</lastmod>
                <priority>0.7</priority>
              </url>
            `;
        });
        
        xml += `</urlset>`;
        
        res.status(200).send(xml);

    } catch (e) {
        console.error("Sitemap generation error:", e);
        res.status(500).send('Error generating sitemap.');
    }
};