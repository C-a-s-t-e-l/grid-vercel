let map;
let currentMarker; 
let allStories = [];
let storyMarkers = {};
let philippinesFocus = true;
const PH_BOUNDS_COORDS = {
    minLat: 4.5, maxLat: 21.2,
    minLng: 116.9, maxLng: 126.6
};
let philippinesMapBounds = null;
let lastClickedLatLng = null; 

const creepyIcon = new L.Icon({
    iconUrl: 'https://static.vecteezy.com/system/resources/previews/019/858/520/non_2x/eye-flat-color-outline-icon-free-png.png', 
    iconSize: [25, 35],               
    iconAnchor: [12, 35],                 
    popupAnchor: [1, -30]              
});

const storyModal = document.getElementById('story-modal');
const modalTitle = document.getElementById('modal-story-title');
const modalLocation = document.getElementById('modal-story-location');
const modalFullStory = document.getElementById('modal-full-story');
const modalCloseButton = document.getElementById('modal-close-button');
const modalAuthor = document.getElementById('modal-story-author'); 


const notificationModal = document.getElementById('notification-modal');
const notificationContent = notificationModal ? notificationModal.querySelector('.notification-modal-content') : null;
const notificationText = document.getElementById('notification-modal-text');
const notificationIcon = document.getElementById('notification-modal-icon');
const notificationCloseBtn = document.getElementById('notification-modal-close');


function openStoryModal(story) {

    if (!storyModal || !modalTitle || !modalLocation || !modalFullStory) {
        console.error('Modal elements not found!');
        return;
    }

     modalTitle.textContent = story.title || 'Untitled Story';
    
    

    modalLocation.innerHTML = `<em><i class="fas fa-map-pin"></i> ${story.location_name || 'Unknown Location'}</em>`;
     modalAuthor.innerHTML = `<em><i class="fas fa-user-ghost"></i> By: ${story.nickname || 'Unknown'}</em>`;
    const cleanStoryText = (story.full_story || '').replace(/\\n/g, '\n');
    const paragraphs = cleanStoryText.split('\n').filter(p => p.trim() !== '');

    modalFullStory.innerHTML = ''; 

    paragraphs.forEach(paragraphText => {
        const p = document.createElement('p');
        p.textContent = paragraphText;
        modalFullStory.appendChild(p);
    });


    const commentStoryIdInput = document.getElementById('comment-story-id');
    if(commentStoryIdInput) {
        commentStoryIdInput.value = story.id;
    }

    const commentNicknameInput = document.getElementById('comment-nickname');
    if(commentNicknameInput){
        commentNicknameInput.value = localStorage.getItem('eerieGridNickname') || '';
    }

    fetchAndDisplayComments(story.id);

    setupReactionSystem(story.id);

    const reactionButtons = document.querySelectorAll('.reaction-button');
    reactionButtons.forEach(button => {
 
        const newButton = button.cloneNode(true);
        newButton.addEventListener('click', (event) => handleReactionClick(event, story.id));
        button.parentNode.replaceChild(newButton, button);
    });

    storyModal.classList.remove('modal-hidden');
    storyModal.classList.add('modal-visible');
}

function showNotificationModal(message, type = 'error') { 
    if (!notificationModal) return;

    notificationText.textContent = message;

    notificationContent.classList.remove('notification-success', 'notification-error');
    notificationIcon.innerHTML = ''; 

    if (type === 'success') {
        notificationContent.classList.add('notification-success');
        notificationIcon.innerHTML = '<i class="fas fa-check-circle"></i>';
    } else { 
        notificationContent.classList.add('notification-error');
        notificationIcon.innerHTML = '<i class="fas fa-exclamation-triangle"></i>';
    }

    notificationModal.classList.add('modal-visible');
}

function hideNotificationModal() {
    if (notificationModal) {
        notificationModal.classList.remove('modal-visible');
    }
}

if (notificationModal && notificationCloseBtn) {
    notificationCloseBtn.addEventListener('click', hideNotificationModal);
    notificationModal.addEventListener('click', (event) => {

        if (event.target === notificationModal) {
            hideNotificationModal();
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

    const emojiMap = {
        spooked: '😱',
        intriguing: '🤔',
        tragic: '😥',
        believable: '🧐',
        absurd: '😂'
    };

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
        if (button.dataset.reaction === userReaction) {
            button.classList.add('selected');
        } else {
            button.classList.remove('selected');
        }
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
        const displayContainer = document.getElementById('reaction-display');
        if (displayContainer) displayContainer.innerHTML = '<span class="reaction-count">?</span>';
    }
}

async function handleReactionClick(event, storyId) {
    const button = event.currentTarget;
    const reactionType = button.dataset.reaction;
    const userId = getOrCreateUserId();

    const isAlreadySelected = button.classList.contains('selected');

    if (isAlreadySelected) {
        try {
            const { error } = await supabaseClient
                .from('reactions')
                .delete()
                .eq('story_id', storyId)
                .eq('user_id', userId);
            
            if (error) throw error;
            await setupReactionSystem(storyId);
        } catch (err) {
            console.error("Error deleting reaction:", err.message);
        }
    } else {
        try {
            const { error } = await supabaseClient
                .from('reactions')
                .upsert({
                    story_id: storyId,
                    user_id: userId,
                    reaction_type: reactionType
                }, { onConflict: 'story_id, user_id' }); 

            if (error) throw error;
            await setupReactionSystem(storyId);
        } catch (err) {
            console.error("Error upserting reaction:", err.message);
        }
    }
}


function closeStoryModal() {
    if (!storyModal) return;
    storyModal.classList.remove('modal-visible');
}

if (modalCloseButton) {
    modalCloseButton.addEventListener('click', closeStoryModal);
}

if (storyModal) {
    storyModal.addEventListener('click', function(event) {
        if (event.target === storyModal) {   
            closeStoryModal();
        }
    });
 
    window.addEventListener('keydown', function(event) {
        if (event.key === 'Escape' && storyModal.classList.contains('modal-visible')) {
            closeStoryModal();
        }
    });
}

function initMap() {
    const philippinesCenter = [12.8797, 121.7740];
    const initialZoom = 6;
    map = L.map('map').setView(philippinesCenter, initialZoom);

    const southWest = L.latLng(PH_BOUNDS_COORDS.minLat, PH_BOUNDS_COORDS.minLng);
    const northEast = L.latLng(PH_BOUNDS_COORDS.maxLat, PH_BOUNDS_COORDS.maxLng);
    philippinesMapBounds = L.latLngBounds(southWest, northEast);

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles © Esri', maxZoom: 18
    }).addTo(map);
    L.tileLayer('https://services.arcgisonline.com/arcgis/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles © Esri', maxZoom: 18
    }).addTo(map);
    L.tileLayer('https://services.arcgisonline.com/arcgis/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles © Esri', maxZoom: 18
    }).addTo(map);

    if (map) {
        lastClickedLatLng = map.getCenter();
    }

    map.on('click', function(event) {
        placeMarkerAndGetLocationName(event);
        lastClickedLatLng = event.latlng;
    });

    const provider = new GeoSearch.OpenStreetMapProvider({
        params: { countrycodes: philippinesFocus ? 'ph' : '' },
    });

    const searchControl = new GeoSearch.GeoSearchControl({
        provider: provider, style: 'bar', showMarker: true, showPopup: false,
        marker: { icon: creepyIcon, draggable: false },
        autoClose: true, keepResult: true, searchLabel: 'Search haunted locations...',
        notFoundMessage: 'Sorry, that place is too elusive to find.',
    });
    map.addControl(searchControl);

    map.on('geosearch/showlocation', function (result) {
        if (currentMarker) {
            currentMarker.remove();
            currentMarker = null;
            document.getElementById('latitude').value = '';
            document.getElementById('longitude').value = '';
            document.getElementById('locationName').value = '';
        }
        lastClickedLatLng = L.latLng(result.location.y, result.location.x); 
    });

    const mapLoadingOverlay = document.querySelector('.map-loading-overlay');
    if (mapLoadingOverlay) {
        mapLoadingOverlay.style.display = 'none';
    }
}

async function placeMarkerAndGetLocationName(mapClickEvent) { 
    const latlng = mapClickEvent.latlng;
    if (currentMarker) currentMarker.remove();
    currentMarker = L.marker([latlng.lat, latlng.lng], { icon: creepyIcon }).addTo(map);

    document.getElementById('latitude').value = latlng.lat.toFixed(6);
    document.getElementById('longitude').value = latlng.lng.toFixed(6);

    const locationNameInput = document.getElementById('locationName'); 
    locationNameInput.value = "Fetching location..."; 

    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latlng.lat}&lon=${latlng.lng}`);
        if (!response.ok) throw new Error(`Nominatim: ${response.status}`);
        const data = await response.json();
        locationNameInput.value = data.display_name || "Location name not found";
    } catch (error) {
        console.error("Reverse geocoding error:", error);
        locationNameInput.value = "Error fetching location";
    }
}

function displayMarkers(storiesToDisplay) {
    for (const storyId in storyMarkers) {
        if (storyMarkers.hasOwnProperty(storyId)) {
            storyMarkers[storyId].remove(); 
        }
    }
    storyMarkers = {}; 

   storiesToDisplay.forEach(story => {
    if (story.latitude && story.longitude) {
        const marker = L.marker([story.latitude, story.longitude], { icon: creepyIcon }).addTo(map);
        storyMarkers[story.id] = marker; 
        marker.on('click', () => {
            openStoryModal(story);
        });
    }
});
}

function updateMapFocus() { 
    const toggleButton = document.getElementById('toggle-world-button');
    if (map) lastClickedLatLng = map.getCenter(); 

    if (philippinesFocus) {
        if (map && philippinesMapBounds) map.setMaxBounds(philippinesMapBounds);
        if (toggleButton) toggleButton.textContent = 'Open up the Horrors of the World';
       const phStories = allStories.filter(story =>
    story.latitude >= PH_BOUNDS_COORDS.minLat && story.latitude <= PH_BOUNDS_COORDS.maxLat &&
    story.longitude >= PH_BOUNDS_COORDS.minLng && story.longitude <= PH_BOUNDS_COORDS.maxLng
);
        displayMarkers(phStories); 
    } else { 
        if (map) map.setMaxBounds(null);
        if (toggleButton) toggleButton.textContent = 'Focus on Philippines';
        displayMarkers(allStories); 
    }
}

async function handleStorySubmit(event) {
    event.preventDefault();
    const submitButton = document.querySelector('#storyForm button[type="submit"]');
    submitButton.disabled = true;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';

    const storyData = {
        title: document.getElementById('title').value,
        full_story: document.getElementById('fullStory').value, 
        nickname: document.getElementById('nickname').value,
        email: document.getElementById('email').value,
        latitude: parseFloat(document.getElementById('latitude').value),
        longitude: parseFloat(document.getElementById('longitude').value),
        location_name: document.getElementById('locationName').value, 
    };

    if (!storyData.title || !storyData.full_story || !storyData.nickname || !storyData.latitude || !storyData.longitude || !storyData.location_name) {
        showNotificationModal('Please fill in all fields and select a location on the map by clicking on an area.');
        submitButton.disabled = false;
        submitButton.innerHTML = '<i class="fas fa-paper-plane"></i> Add to the Grim Record';
        return;
    }

    localStorage.setItem('eerieGridNickname', storyData.nickname);

    try {
        const response = await fetch('/api/stories', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
         
            body: JSON.stringify({
                title: storyData.title,
                fullStory: storyData.full_story, 
                nickname: storyData.nickname,
                email: storyData.email,
                latitude: storyData.latitude,
                longitude: storyData.longitude,
                locationName: storyData.location_name, 
            }),
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.msg || 'An error occurred.');
        }

        showNotificationModal('Your whisper has crossed the veil. It now echoes in the space between worlds, awaiting judgment.');
        document.getElementById('storyForm').reset();
        document.getElementById('nickname').value = localStorage.getItem('eerieGridNickname') || '';
        if (currentMarker) {
            currentMarker.remove();
            currentMarker = null;
        }

    } catch (error) {
        console.error('Submission failed:', error);
        showNotificationModal(`Submission failed: ${error.message}`);
    } finally {
        submitButton.disabled = false;
        submitButton.innerHTML = '<i class="fas fa-paper-plane"></i> Add to the Grim Record';
    }
}

async function fetchAndDisplayComments(storyId) {
    const commentsContainer = document.getElementById('comments-container');
    if (!commentsContainer) return;

    commentsContainer.innerHTML = '<p>Loading echoes...</p>';

    try {
        const { data, error } = await supabaseClient
            .from('comments')
            .select('*')
            .eq('story_id', storyId)
            .order('created_at', { ascending: true });

        if (error) throw error;

        if (data.length === 0) {
            commentsContainer.innerHTML = '<p>No echoes yet. Be the first to leave a whisper.</p>';
        } else {
            commentsContainer.innerHTML = data.map(comment => {
                const commentDate = new Date(comment.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });
                return `
                    <div class="comment-card">
                        <p class="comment-text">${escapeHTML(comment.comment_text)}</p>
                        <p class="comment-meta">By <span class="comment-author">${escapeHTML(comment.nickname)}</span> on <span class="comment-date">${commentDate}</span></p>
                    </div>
                `;
            }).join('');
        }
    } catch (err) {
        commentsContainer.innerHTML = '<p>Could not load the echoes from the beyond.</p>';
        console.error('Error fetching comments:', err.message);
    }
}

function escapeHTML(str) {
    return str.replace(/[&<>"']/g, function (match) {
        return {
            '&': '&',
            '<': '<',
            '>': '>',
            '"': '"',
            "'": "'"
        }[match];
    });
}

function checkUrlForStory() {
    const params = new URLSearchParams(window.location.search);
    const storyId = params.get('story');
    const noModalFlag = params.get('no_modal'); 
    if (storyId) {
        const storyToView = allStories.find(s => s.id == storyId);
        if (storyToView && storyToView.latitude && storyToView.longitude) {
            
            map.setView([storyToView.latitude, storyToView.longitude], 15);

  
            if (noModalFlag !== 'true') {
                openStoryModal(storyToView);
            }
            
        } else {
            console.warn(`Story with ID "${storyId}" not found or has no coordinates.`);
        }
    }
}

async function fetchAndDisplayStories() {
    try {
        const { data, error } = await supabaseClient
            .from('stories')
            .select('*')
            .eq('is_approved', true); 

        if (error) {
            throw error;
        }

        allStories = data; 
        updateMapFocus(); 
        checkUrlForStory();

    } catch (error) {
        console.error('Failed to fetch stories:', error.message);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    initMap(); 

    const togglePostFormButton = document.getElementById('toggle-post-form-button');
    const formColumn = document.getElementById('form-column'); 

    if (togglePostFormButton && formColumn) {
        togglePostFormButton.addEventListener('click', () => {
            formColumn.classList.toggle('hidden-form');
            togglePostFormButton.textContent = formColumn.classList.contains('hidden-form') 
                ? 'Post New Story' 
                : 'Hide Submission Form';
        });
    }

    const toggleButton = document.getElementById('toggle-world-button');
    if (toggleButton) {
        toggleButton.addEventListener('click', () => {
            philippinesFocus = !philippinesFocus;
            updateMapFocus();
        });
    }

     const storyForm = document.getElementById('storyForm');
    if (storyForm) {
        storyForm.addEventListener('submit', handleStorySubmit);
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
                const { data, error } = await supabaseClient
                    .from('comments')
                    .insert([
                        { story_id: storyId, nickname: nickname, comment_text: commentText }
                    ]);

                if (error) throw error;
                
                document.getElementById('comment-text').value = '';
                await fetchAndDisplayComments(storyId); 

            } catch (err) {
                showNotificationModal('Could not submit comment. The spirits are restless.');
                console.error('Error submitting comment:', err.message);
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = 'Submit Comment';
            }
        });
    }
    document.getElementById('nickname').value = localStorage.getItem('eerieGridNickname') || ''; 
    fetchAndDisplayStories();
    updateMapFocus(); 
    checkUrlForStory(); 
});