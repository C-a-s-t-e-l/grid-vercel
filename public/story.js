document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const storyId = urlParams.get('id');
    const from = urlParams.get('from');
    
    const backToArchiveBtn = document.getElementById('back-to-archive-btn');
    const backToGridBtn = document.getElementById('back-to-grid-btn');

    if (from === 'map') {
        const lat = urlParams.get('lat');
        const lng = urlParams.get('lng');
        const zoom = urlParams.get('zoom');

        if (lat && lng && zoom) {
            backToGridBtn.href = `map.html?lat=${lat}&lng=${lng}&zoom=${zoom}`;
            backToGridBtn.style.display = 'inline-block'; 
            backToArchiveBtn.style.display = 'none'; 
        }
    } else if (from === 'archive') {
        const page = urlParams.get('page') || 1;
        backToArchiveBtn.href = `archive.html?page=${page}`;
    }

    const container = document.querySelector('.story-page-container');
    if (storyId) {
        loadStory(storyId);
    } else {
        container.innerHTML = '<h1 style="text-align: center; color: var(--accent-color); padding: 50px;">Story Not Found</h1><p style="text-align: center;">No story ID was provided. Please return to the archive.</p>';
    }
});

async function loadStory(storyId) {
    const container = document.querySelector('.story-page-container');
    try {
        const { data: story, error } = await supabaseClient
            .from('stories')
            .select('*')
            .eq('id', storyId)
            .eq('is_approved', true)
            .single();

        if (error || !story) {
            throw new Error("This story does not exist or has vanished into the ether.");
        }
        populatePage(story);
    } catch (error) {
        container.innerHTML = `<h1 style="text-align: center; color: var(--accent-color); padding: 50px;">Error</h1><p style="text-align: center;">${error.message}</p>`;
    }
}

function populatePage(storyData) {
    document.title = `${storyData.title} - Eerie Grid PH`;
    document.querySelector('meta[name="description"]').content = storyData.snippet || `An eerie tale from the archives about ${storyData.title}.`;

    const header = document.getElementById('story-header');
    const defaultImage = 'https://wallpapers.com/images/hd/ugly-scary-girl-y39u39mmfxeu8eyk.jpg';
    header.style.backgroundImage = `url(${defaultImage})`;

    document.getElementById('story-page-title').textContent = storyData.title;
    document.getElementById('story-page-location').innerHTML = `<i class="fas fa-map-pin"></i> ${storyData.location_name}`;
    document.getElementById('story-page-author').innerHTML = `<i class="fas fa-user-ghost"></i> By: ${storyData.nickname || 'Unknown'}`;
    const dateOptions = { month: 'long', day: 'numeric', year: 'numeric' };
    document.getElementById('story-page-date').innerHTML = `<i class="fas fa-clock"></i> Submitted: ${new Date(storyData.created_at).toLocaleDateString('en-US', dateOptions)}`;

    const fullStoryText = document.getElementById('story-full-text');
    const cleanStoryText = storyData.full_story.replace(/\\n/g, '\n');
    const paragraphs = cleanStoryText.split('\n').filter(p => p.trim() !== '');
    fullStoryText.innerHTML = paragraphs.map(p => `<p>${p}</p>`).join('');

    const facebookBtn = document.getElementById('share-facebook');
    const twitterBtn = document.getElementById('share-twitter');
    const copyLinkBtn = document.getElementById('copy-link-btn');
    const storyUrl = `https://eerie-grid.vercel.app/s/${storyData.id}`;
    const storyTitle = storyData.title;

    if (facebookBtn) {
        facebookBtn.addEventListener('click', () => {
            const shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(storyUrl)}`;
            window.open(shareUrl, '_blank', 'width=600,height=400');
        });
    }

    if (twitterBtn) {
        twitterBtn.addEventListener('click', () => {
            const text = `Check out this eerie story: "${storyTitle}"`;
            const shareUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(storyUrl)}&text=${encodeURIComponent(text)}`;
            window.open(shareUrl, '_blank', 'width=600,height=400');
        });
    }
    
    if (copyLinkBtn) {
        copyLinkBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(storyUrl).then(() => {
                const originalText = copyLinkBtn.innerHTML;
                copyLinkBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
                copyLinkBtn.style.backgroundColor = '#10b981';
                setTimeout(() => {
                    copyLinkBtn.innerHTML = originalText;
                    copyLinkBtn.style.backgroundColor = '';
                }, 2000);
            }).catch(err => {
                console.error('Failed to copy link: ', err);
                alert('Could not copy link to clipboard.');
            });
        });
    }
    const commentStoryIdInput = document.getElementById('comment-story-id');
    commentStoryIdInput.value = storyData.id;
    document.getElementById('comment-nickname').value = localStorage.getItem('eerieGridNickname') || '';
    
    fetchAndDisplayComments(storyData.id);
    setupReactionSystem(storyData.id);

    const reactionButtons = document.querySelectorAll('.reaction-button');
    reactionButtons.forEach(button => {
        button.addEventListener('click', (event) => handleReactionClick(event, storyData.id));
    });
}


async function fetchAndDisplayComments(storyId) {
    const commentsContainer = document.getElementById('comments-container');
    if (!commentsContainer) return;
    commentsContainer.innerHTML = '<p>Loading echoes...</p>';
    try {
        const { data, error } = await supabaseClient
            .from('comments').select('*').eq('story_id', storyId).order('created_at', { ascending: true });
        if (error) throw error;
        if (data.length === 0) {
            commentsContainer.innerHTML = '<p class="no-comments">No echoes yet. Be the first to leave a whisper.</p>';
        } else {
            commentsContainer.innerHTML = data.map(comment => {
                const commentDateTime = new Date(comment.created_at).toLocaleString('en-US', {
                    year: 'numeric', month: 'short', day: 'numeric',
                    hour: 'numeric', minute: '2-digit', hour12: true 
                });
                return `
                    <div class="comment-card">
                        <p class="comment-text">${linkify(comment.comment_text)}</p> 
                        <p class="comment-meta">
                            By <span class="comment-author">${escapeHTML(comment.nickname)}</span> 
                            on <span class="comment-date">${commentDateTime}</span>
                        </p>
                    </div>`;
            }).join('');
        }
    } catch (err) {
        commentsContainer.innerHTML = '<p class="no-comments">Could not load the echoes from the beyond.</p>';
        console.error('Error fetching comments:', err.message);
    }
}

const commentForm = document.getElementById('comment-form');
if (commentForm) {
    commentForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitButton = commentForm.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Submitting...';
        const storyId = document.getElementById('comment-story-id').value;
        const nickname = document.getElementById('comment-nickname').value;
        const commentText = document.getElementById('comment-text').value;
        localStorage.setItem('eerieGridNickname', nickname);
        try {
            const { error } = await supabaseClient
                .from('comments').insert([{ story_id: storyId, nickname: nickname, comment_text: commentText }]);
            if (error) throw error;
            document.getElementById('comment-text').value = '';
            fetchAndDisplayComments(storyId);
        } catch (err) {
            alert('Could not submit comment. The spirits are restless.');
            console.error('Error submitting comment:', err.message);
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Submit Comment';
        }
    });
}

function getOrCreateUserId() {
    let userId = localStorage.getItem('eerieGridUserId');
    if (!userId) {
        userId = self.crypto.randomUUID();
        localStorage.setItem('eerieGridUserId', userId);
    }
    return userId;
}

function displayReactionCounts(counts) {
    const displayContainer = document.getElementById('reaction-display');
    if (!displayContainer) return;
    const emojiMap = { spooked: '😱', intriguing: '🤔', tragic: '😥', believable: '🧐', absurd: '😂' };
    if (!counts || counts.length === 0) {
        displayContainer.innerHTML = '';
        return;
    }
    displayContainer.innerHTML = counts.map(item =>
        `<span class="reaction-count">${emojiMap[item.reaction_type] || '?'} ${item.reaction_count}</span>`
    ).join('');
}

function updateReactionButtons(userReaction) {
    const buttons = document.querySelectorAll('.reaction-button');
    buttons.forEach(button => {
        button.classList.toggle('selected', button.dataset.reaction === userReaction);
    });
}

async function setupReactionSystem(storyId) {
    const userId = getOrCreateUserId();
    try {
        const [countsResult, userReactionResult] = await Promise.all([
            supabaseClient.rpc('get_reaction_counts', { story_id_to_check: storyId }),
            supabaseClient.from('reactions').select('reaction_type').eq('story_id', storyId).eq('user_id', userId).maybeSingle()
        ]);
        if (countsResult.error) throw countsResult.error;
        if (userReactionResult.error) throw userReactionResult.error;
        displayReactionCounts(countsResult.data);
        const userReaction = userReactionResult.data ? userReactionResult.data.reaction_type : null;
        updateReactionButtons(userReaction);
    } catch (err) {
        console.error("Error setting up reactions:", err.message);
    }
}

async function handleReactionClick(event, storyId) {
    const button = event.currentTarget;
    const reactionType = button.dataset.reaction;
    const userId = getOrCreateUserId();
    const isAlreadySelected = button.classList.contains('selected');
    try {
        if (isAlreadySelected) {
            await supabaseClient.from('reactions').delete().eq('story_id', storyId).eq('user_id', userId);
        } else {
            await supabaseClient.from('reactions').upsert({
                story_id: storyId, user_id: userId, reaction_type: reactionType
            }, { onConflict: 'story_id, user_id' });
        }
        await setupReactionSystem(storyId);
    } catch (err) {
        console.error("Error handling reaction:", err.message);
    }
}

function escapeHTML(str) {
  const p = document.createElement("p");
  p.textContent = str;
  return p.innerHTML;
}

function linkify(text) {
  const escapedText = escapeHTML(text);
  const urlRegex = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])|(\bwww\.[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
  return escapedText.replace(urlRegex, function(url) {
    const hyperLink = url.startsWith('www.') ? 'http://' + url : url;
    return `<a href="${hyperLink}" target="_blank" rel="noopener noreferrer" style="color: white;">${url}</a>`;
  });
}