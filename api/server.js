require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { createClient } = require('@supabase/supabase-js');
const TextToSpeech = require('@google-cloud/text-to-speech');

const app = express();


const myApiKey = process.env.GOOGLE_API_KEY1;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const ADMIN_SECRET = process.env.ADMIN_SECRET_KEY;

if (!myApiKey) {
    console.error("FATAL ERROR: GOOGLE_API_KEY1 is not defined in the .env file.");
    process.exit(1);
}
const genAI = new GoogleGenerativeAI(myApiKey);

const chatModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });

if (!supabaseUrl || !supabaseServiceKey || !ADMIN_SECRET) {
    console.error("FATAL ERROR: Supabase URL or Anon Key or Admin secret is not defined in the .env file.");
    process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseServiceKey);
const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
let ttsClient;

const corsOptions = {
  origin: [
    'https://eerie-grid.vercel.app', 
    'http://127.0.0.1:5500', 
    'http://localhost:3000' 
  ]
};
app.use(cors(corsOptions));

app.use(express.json());
app.use(express.static('public'));



if (process.env.GOOGLE_CREDENTIALS) {

    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    ttsClient = new TextToSpeech.TextToSpeechClient({ credentials });
    console.log("TTS Client initialized with Vercel environment credentials.");
} else {
  
    ttsClient = new TextToSpeech.TextToSpeechClient();
    console.log("TTS Client initialized with local GOOGLE_APPLICATION_CREDENTIALS.");
}

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

app.get('/api/stories/featured', async (req, res) => {
    const { data, error } = await supabase
        .from('stories')
        
        .select('id, title, snippet, location_name, nickname, views')
        .eq('is_approved', true)
       
        .order('views', { ascending: false, nulls: 'last' })
        .limit(4); 

    if (error) {
        return res.status(500).json({ error: error.message });
    }
    res.json(data);
});

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

const isAdmin = (req, res, next) => {
    const secret = req.headers['x-admin-secret'];
    if (secret !== ADMIN_SECRET) {
        return res.status(401).json({ error: 'Unauthorized: Access Denied.' });
    }
    next();
};


app.get('/api/admin/stories', isAdmin, async (req, res) => {
    const { 
        page = 1, 
        limit = 10, 
        status = 'all', 
        search = '',
        sortBy = 'created_at',
        sortOrder = 'desc'
    } = req.query;

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum - 1;

    try {
        let query = adminSupabase
            .from('stories')
            .select('*, comments(*)', { count: 'exact' });

        if (status === 'pending') {
            query = query.eq('is_approved', false);
        } else if (status === 'approved') {
            query = query.eq('is_approved', true);
        }

        if (search) {
            const searchTerm = `%${search}%`;
            query = query.or(`title.ilike.${searchTerm},nickname.ilike.${searchTerm},location_name.ilike.${searchTerm}`);
        }

        query = query
            .order(sortBy, { ascending: sortOrder === 'asc' })
            .range(startIndex, endIndex);

        const { data, error, count } = await query;

        if (error) {
            throw error;
        }

        res.json({ stories: data, totalCount: count });

    } catch (error) {
        console.error('Admin GET stories error:', error);
        return res.status(500).json({ error: error.message });
    }
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

app.get('/api/narrate/:storyId', async (req, res) => {
    const { storyId } = req.params;

   try {
    const { data: story, error } = await supabase
        .from('stories')
        .select('full_story')
        .eq('id', storyId)
        .single();

    if (error || !story) {
        return res.status(404).send('Story not found.');
    }

    let storyText = story.full_story
        .replace(/&/g, '&')
        .replace(/</g, '<')
        .replace(/>/g, '>');

    storyText = storyText.replace(/(\r\n|\n|\r){2,}/g, '\n<break time="600ms"/>\n'); 
    storyText = storyText.replace(/(\r\n|\n|\r)/g, '<break time="600ms"/>'); 

    const ssml = `<speak>${storyText}</speak>`;

    const request = {
        input: { ssml: ssml },
        voice: {
            languageCode: 'fil-PH',
            name: 'fil-PH-Wavenet-D' 
        },
        audioConfig: {
            audioEncoding: 'MP3',
            speakingRate: 1, 
            pitch: -2.5,       
        },
    };
  
    const [response] = await ttsClient.synthesizeSpeech(request);
    const audioContent = response.audioContent;

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', audioContent.length); 
    res.setHeader('Accept-Ranges', 'bytes'); 
    
    res.status(200).send(audioContent);


} catch (err) {
    console.error('--- TTS API ERROR ---', err);
    res.status(500).json({ error: 'Failed to generate narration.' });
}
});

if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`✅ Server is listening for local development at http://localhost:${PORT}`);
        console.log("   Press CTRL+C to stop the server.");
    });
}



module.exports = app;