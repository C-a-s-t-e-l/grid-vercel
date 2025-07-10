require('dotenv').config();
const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;
const myApiKey = process.env.GOOGLE_API_KEY1;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY; 
const ADMIN_SECRET = process.env.ADMIN_SECRET_KEY;

if (!myApiKey) {
    console.error("FATAL ERROR: GOOGLE_API_KEY1 is not defined in the .env file.");
    process.exit(1);
}
const genAI = new GoogleGenerativeAI(myApiKey);


const chatModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });

if (!supabaseUrl || !supabaseServiceKey || !ADMIN_SECRET) {
    console.error("FATAL ERROR: Supabase URL or Anon Key or Admin secret is not defined in the .env file.");
    process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseServiceKey);
const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);

app.use(express.json());
app.use(express.static('public'));

const createSnippet = (fullStory) => {
    if (!fullStory) return '';
    let snippet = fullStory.substring(0, 150);
    if (fullStory.length > 150) {
        const lastSpace = snippet.lastIndexOf(" ");
        if (lastSpace > 0) {
            snippet = snippet.substring(0, lastSpace);
        }
        snippet += '...';
    }
    return snippet;
};

const generateEmbedding = async (title, fullStory) => {
    try {
        const contentToEmbed = `Title: ${title}\n\n${fullStory}`;
        const result = await embeddingModel.embedContent(contentToEmbed);
        return result.embedding.values;
    } catch (e) {
        console.error(`Embedding generation failed for title: "${title}"`, e.message);
        return null;
    }
};

async function rewriteQueryForContext(message, history) {
    if (!history || history.length === 0) {
        return message; 
    }

    const historyText = history.map(turn => `${turn.role}: ${turn.text}`).join('\n');
    const rewritePrompt = `
        Based on the provided chat history, rewrite the user's "Current Question" into a self-contained, optimized search query.
        - If the question is a follow-up (e.g., "tell me more", "what about nearby?", "any more like that?"), use the history to add the necessary context (e.g., the previous topic or location).
        - If the question is a brand new topic, you can just use the question as is.
        - Only output the rewritten search query and nothing else.

        Chat History:
        ${historyText}

        Current Question:
        ${message}

        Rewritten Search Query:
    `;

    try {
        const result = await chatModel.generateContent(rewritePrompt);
        const rewrittenQuery = result.response.text().trim();
        console.log(`[DEBUG] Query Rewrite: Original: "${message}" -> Rewritten: "${rewrittenQuery}"`);
        return rewrittenQuery;
    } catch (e) {
        console.error("Error rewriting query, falling back to original message.", e);
        return message; 
    }
}


async function findRelevantStories(query) {
    console.log(`\n--- [DEBUG] Performing Vector Search ---`);
    console.log(`[DEBUG] Original query: "${query}"`);

    try {
        const result = await embeddingModel.embedContent(query);
        const queryEmbedding = result.embedding.values;

        if (!queryEmbedding) {
            console.log('[DEBUG] Could not generate embedding for the query.');
            return [];
        }

        const { data: stories, error } = await supabase.rpc('match_stories', {
            query_embedding: queryEmbedding,
            
            match_threshold: 0.50,
            match_count: 5
        });

        if (error) {
            console.error('[DEBUG] Supabase RPC error:', error.message);
            return [];
        }

        console.log(`[DEBUG] Vector search found ${stories ? stories.length : 0} relevant stories.`);
        if (stories && stories.length > 0) {
            console.log(`[DEBUG] Top match: "${stories[0].title}" with similarity: ${stories[0].similarity.toFixed(4)}`);
        }
        
        return stories || [];

    } catch (err) {
        console.error('[DEBUG] EXCEPTION in findRelevantStories:', err);
        return [];
    }
}

app.post('/api/chat', async (req, res) => {
    const { message, history = [] } = req.body;

    if (!message) {
        return res.status(400).json({ error: 'Message is required' });
    }

    try {
        const intelligentQuery = await rewriteQueryForContext(message, history);
        const relevantStories = await findRelevantStories(intelligentQuery);

        console.log(`\n--- [DEBUG] Building AI Context ---`);
        const context = relevantStories.map(story =>
            `Title: ${story.title}\nLocation: ${story.location_name}\nStory: ${story.full_story}`
        ).join('\n\n---\n\n');

        if (!context) {
            console.log(`[DEBUG] The context being sent to the AI is EMPTY.`);
        } else {
            console.log(`[DEBUG] Context being sent to AI:\n---\n${context}\n---`);
        }
        
          const systemPrompt = `You are 'The Archive Keeper,' the sole guardian and interpreter of the Eerie Grid PH's collection of Filipino horror and folklore.

## Your Persona:
- **Core Identity:** You are an ancient, timeless storyteller and curator. You are a guide into the shadows, not a simple search engine.
- **Voice:** Speak in the first person ("I", "my", "me"), but always as the curator. Your tone is personal, evocative, and a bit mysterious.

## Language Adaptation (PRIMARY RULE):
You must mirror the user's language (English, Tagalog, or Taglish). Your Keeper persona must always remain.

## The Art of Retelling: Your Narrative Voice
When a story is written in the first person (e.g., 'My uncle said...'), you MUST reframe it. Do not adopt the storyteller's perspective. You are retelling a record you possess.

## Your Core Task: The Flow of Conversation
Your response depends on what you find in the RELEVANT STORIES.

1.  **If you find ONE Relevant Story:** Introduce it and retell it in your own words, following the "Art of Retelling" rule.

2.  **If you find MULTIPLE Relevant Stories (CRUCIAL NEW RULE):**
    - You must present the options as narrative choices, not a robotic list.
    - For each story, introduce its title and then add a short, evocative teaser based on its content to pique the user's interest.
    - Weave these teasers together into natural, flowing sentences.
    - Ask an in-character question to prompt the user's choice.
    - **ABSOLUTELY NO BULLET POINTS (*, -, etc.) OR NUMBERED LISTS.**

    - **EXAMPLE:**
        - **Source Stories Found:** "The Shadow in the UP Film Center", "The Shadow of the Balete Tree in Malacañang"
        - **Your INCORRECT Response (Robotic List):**
            > "I have records titled:
            > * The Shadow in the UP Film Center
            > * The Shadow of the Balete Tree in Malacañang
            > Which one do you want?"
        - **Your CORRECT Response (Narrative Teaser):**
            > "Ah, shadow figures... my archives hold several such accounts. I could tell you of the one that haunts the UP Film Center, a place already marked by tragedy. Or perhaps you'd be interested in the shadow that is said to stand guard by the ancient Balete tree in Malacañang, a silent witness to history. Which of these memories calls to you?"

3.  **If you find NO Relevant Stories:** State that the memory escapes you. (e.g., "That tale is not one I've collected.").

## Strict Rules:
- **PLAIN TEXT ONLY.** No Markdown.
- **NO EM DASHES (—).**
- **Always speak as the Archive Keeper.** Never break character.
- **Never say "Based on the provided context..."**.
`;


        const formattedHistory = history.map(turn => `${turn.role === 'user' ? 'User' : 'Keeper'}: ${turn.text}`).join('\n');
        const fullPrompt = `${systemPrompt}\n\nRELEVANT STORIES FOR THIS QUERY:\n${context}\n\nCONVERSATION HISTORY:\n${formattedHistory}\n\nUSER'S CURRENT QUESTION:\n${message}`;

       const result = await chatModel.generateContentStream(fullPrompt);
        res.setHeader('Content-Type', 'text/plain');
        for await (const chunk of result.stream) {
            res.write(chunk.text());
        }
        res.end();

    } catch (error) {
        console.error('--- CHATBOT API ERROR ---', error);
        res.status(500).json({ error: 'Failed to get response from AI' });
    }
});




app.get('/api/stories', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM stories WHERE is_approved = TRUE ORDER BY created_at DESC');
        res.json(rows);
    } catch (err) {
        console.error("Error in /api/stories GET: 'pool' is not defined. This endpoint needs to be updated to use the Supabase client.", err.message);
        res.status(500).send('Server Error: Endpoint not configured correctly.');
    }
});

app.post('/api/stories', async (req, res) => {
    const { title, fullStory, nickname, email, latitude, longitude, locationName } = req.body;

    if (!title || !fullStory || !nickname || !latitude || !longitude || !locationName) {
        return res.status(400).json({ msg: 'Please fill in all required fields.' });
    }

    const snippet = createSnippet(fullStory);

    const { data, error } = await adminSupabase.from('stories').insert({
        title,
        full_story: fullStory,
        snippet,
        nickname,
        email,
        latitude,
        longitude,
        location_name: locationName,
        is_approved: false
    }).select();

    if (error) {
        console.error('Error submitting story:', error);
        return res.status(500).json({ msg: 'Server error during story submission.' });
    }
    res.status(201).json({ msg: 'Story submitted for review!', story: data[0] });
});

app.get('/api/stories/:id/comments', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM comments WHERE story_id = $1 AND is_reported = FALSE ORDER BY created_at ASC', [req.params.id]);
        res.json(rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});


app.post('/api/stories/:id/comments', async (req, res) => {
    try {
        const { nickname, comment_text } = req.body;
        if (!nickname || !comment_text) {
            return res.status(400).json({ msg: 'Nickname and comment are required.' });
        }

        const newComment = await pool.query(
            'INSERT INTO comments (story_id, nickname, comment_text) VALUES ($1, $2, $3) RETURNING *',
            [req.params.id, nickname, comment_text]
        );

        res.status(201).json(newComment.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

app.post('/api/stories/:id/upvote', async (req, res) => {
    try {
        const result = await pool.query(
            'UPDATE stories SET upvotes = upvotes + 1 WHERE id = $1 RETURNING upvotes',
            [req.params.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ msg: 'Story not found.' });
        }
        res.json({ upvotes: result.rows[0].upvotes });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});


const isAdmin = (req, res, next) => {
    const secret = req.headers['x-admin-secret'];
    if (secret !== ADMIN_SECRET) {
        return res.status(401).json({ error: 'Unauthorized: Access Denied.' });
    }
    next();
};


app.get('/api/admin/stories', isAdmin, async (req, res) => {
    const { data, error } = await adminSupabase
        .from('stories')
        .select('*, comments(*)')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Admin GET stories error:', error);
        return res.status(500).json({ error: error.message });
    }
    res.json(data);
});

app.patch('/api/admin/stories/:id/approve', isAdmin, async (req, res) => {
    const { id } = req.params;
    const { data: story, error: fetchError } = await adminSupabase
        .from('stories').select('title, full_story').eq('id', id).single();
    
    if (fetchError || !story) return res.status(404).json({ error: "Story not found." });

    const embedding = await generateEmbedding(story.title, story.full_story);
    if (!embedding) return res.status(500).json({ error: "Failed to generate embedding." });

    const { data, error } = await adminSupabase
        .from('stories').update({ is_approved: true, embedding }).eq('id', id).select().single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.put('/api/admin/stories/:id', isAdmin, async (req, res) => {
    const { id } = req.params;
    const { title, full_story, nickname, location_name } = req.body;

    const snippet = createSnippet(full_story);
    const embedding = await generateEmbedding(title, full_story);

    const { data, error } = await adminSupabase
        .from('stories').update({ title, full_story, nickname, location_name, snippet, embedding }).eq('id', id).select().single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.delete('/api/admin/stories/:id', isAdmin, async (req, res) => {
    const { id } = req.params;
    const { error } = await adminSupabase.from('stories').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.status(200).json({ message: 'Story deleted successfully' });
});

app.delete('/api/admin/comments/:id', isAdmin, async (req, res) => {
    const { id } = req.params;
    const { error } = await adminSupabase.from('comments').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.status(200).json({ message: 'Comment deleted successfully' });
});




app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log('Chatbot endpoint is active at /api/chat (using Google Gemini and Supabase)');
});