require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

module.exports = async (req, res) => {
  const { id } = req.query;

  const isHumanNavigation = req.headers["sec-fetch-dest"] === "document";

  if (isHumanNavigation) {
    res.setHeader("Location", `/story.html?id=${id || ""}`);
    return res.status(302).end();
  }

  if (!id) {
    return res.status(400).send("Story ID is required for bot preview.");
  }

  try {
    const { data: story, error } = await supabase
      .from("stories")
      .select("title, snippet, created_at")
      .eq("id", id)
      .single();

    if (error || !story) {
      console.warn(`Story with ID ${id} not found for bot request.`);
      return res.status(404).send("Story not found.");
    }

    const canonicalUrl = `https://eerie-grid.vercel.app/s/${id}`;

    const htmlResponse = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <title>${story.title.replace(/"/g, '"')} - Eerie Grid PH</title>
                <meta name="description" content="${story.snippet.replace(
                  /"/g,
                  '"'
                )}">

                <meta property="og:title" content="${story.title.replace(
                  /"/g,
                  '"'
                )}">
                <meta property="og:description" content="${story.snippet.replace(
                  /"/g,
                  '"'
                )}">
                <meta property="og:url" content="${canonicalUrl}">
                <meta property="og:image" content="https://www.maptive.com/wp-content/uploads/2024/07/The-Pentagram-Kazakhstan.png">
                <meta property="og:type" content="article">
                <meta property="og:site_name" content="Eerie Grid PH">

                <meta name="twitter:card" content="summary_large_image">
                <meta name="twitter:title" content="${story.title.replace(
                  /"/g,
                  '"'
                )}">
                <meta name="twitter:description" content="${story.snippet.replace(
                  /"/g,
                  '"'
                )}">

                <script type="application/ld+json">
                {
                  "@context": "https://schema.org",
                  "@type": "Article",
                  "headline": "${story.title.replace(/"/g, '\\"')}",
                  "description": "${story.snippet.replace(/"/g, '\\"')}",
                  "image": "https://www.maptive.com/wp-content/uploads/2024/07/The-Pentagram-Kazakhstan.png",
                  "author": { "@type": "Person", "name": "Community Contributor" },
                  "publisher": {
                    "@type": "Organization",
                    "name": "Eerie Grid PH",
                    "logo": { "@type": "ImageObject", "url": "https://eerie-grid.vercel.app/images/keeper_icon.png" }
                  },
                  "datePublished": "${new Date(
                    story.created_at || Date.now()
                  ).toISOString()}"
                }
                </script>
            </head>
            <body>
                <h1>${story.title}</h1>
                <p>${story.snippet}</p>
                <p>Read the full story at <a href="${canonicalUrl}">${canonicalUrl}</a></p>
            </body>
            </html>
        `;

    res.setHeader("Content-Type", "text/html");
    return res.status(200).send(htmlResponse);
  } catch (e) {
    console.error("OG Handler Error:", e);
    return res.status(500).send("Server error generating preview.");
  }
};
