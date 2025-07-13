// api/sitemap.js (Corrected Version)
const { createClient } = require('@supabase/supabase-js');

// It's secure to expose the anon key here
const supabaseUrl = 'https://nslmlulajnbinbzurhrz.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zbG1sdWxham5iaW5ienVyaHJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE5NDQzMjcsImV4cCI6MjA2NzUyMDMyN30.M7bF4Hw_dUP8tS7MPJf-sAZQaPBZ7Ar5hf2gde_w1EU';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const WEBSITE_URL = 'https://eerie-grid.vercel.app';

module.exports = async (req, res) => {
    res.setHeader('Content-Type', 'application/xml');
    // Cache for 12 hours
    res.setHeader('Cache-Control', 's-maxage=43200, stale-while-revalidate'); 

    try {
        const { data: stories, error } = await supabase
            .from('stories')
            .select('id, created_at') // FIX: Changed 'updated_at' to 'created_at'
            .eq('is_approved', true);

        if (error) {
            console.error('Supabase query error in sitemap:', error);
            throw error;
        }

        let xml = `<?xml version="1.0" encoding="UTF-8"?>`;
        xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

        // Add static pages
        const staticPages = ['/', '/map.html', '/archive.html', '/codex.html', '/lore.html', '/keepers-note.html'];
        staticPages.forEach(page => {
            xml += `
              <url>
                <loc>${WEBSITE_URL}${page === '/' ? '' : page}</loc>
                <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
                <priority>${page === '/' ? '1.0' : '0.8'}</priority>
              </url>
            `;
        });

        // Add dynamic story pages
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