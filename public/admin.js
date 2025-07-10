document.addEventListener('DOMContentLoaded', () => {

const adminNav = document.getElementById('admin-nav');
const logoutButton = document.getElementById('logout-button');

    // --- DOM Elements ---
    const authContainer = document.getElementById('auth-container');
    const adminContent = document.getElementById('admin-content');
    const authButton = document.getElementById('auth-button');
    const secretInput = document.getElementById('admin-secret');
    const storiesContainer = document.getElementById('stories-table-container');
    const paginationContainer = document.getElementById('pagination-container');
    
    // Control Elements
    const searchBar = document.getElementById('admin-search-bar');
    const statusFilter = document.getElementById('filter-status');
    const sortSelect = document.getElementById('sort-stories');
    
    // Modal Elements
    const editModal = document.getElementById('edit-story-modal');
    const closeModalButton = document.getElementById('modal-close-button');
    const cancelEditButton = document.getElementById('cancel-edit-button');
    const editStoryForm = document.getElementById('edit-story-form');
    const saveStoryButton = document.getElementById('save-story-button');

    const commentsModal = document.getElementById('comments-modal');
    const commentsModalCloseButton = document.getElementById('comments-modal-close-button');
    const commentsModalTitle = document.getElementById('comments-modal-title');
    const commentsModalListContainer = document.getElementById('comments-modal-list-container');

    let adminSecret = '';
    let fullStoryList = [];
    let currentFilteredList = [];
    let currentPage = 1;
    const storiesPerPage = 10; 

    function checkSession() {
    const savedSecret = sessionStorage.getItem('adminSecretKey');
    if (savedSecret) {
        console.log("Found saved session. Authenticating...");
        authenticate(savedSecret);
    }
}

function logout() {
    sessionStorage.removeItem('adminSecretKey');
    adminSecret = '';
    
    adminContent.classList.add('hidden');
    adminNav.classList.add('hidden');
    authContainer.classList.remove('hidden');
    
    secretInput.value = '';
    
    console.log("User logged out.");
}

    const api = {
        getStories: () => fetch('/api/admin/stories', { headers: { 'X-Admin-Secret': adminSecret } }),
        approveStory: (id) => fetch(`/api/admin/stories/${id}/approve`, { method: 'PATCH', headers: { 'X-Admin-Secret': adminSecret } }),
        updateStory: (id, data) => fetch(`/api/admin/stories/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Admin-Secret': adminSecret }, body: JSON.stringify(data) }),
        deleteStory: (id) => fetch(`/api/admin/stories/${id}`, { method: 'DELETE', headers: { 'X-Admin-Secret': adminSecret } }),
        deleteComment: (id) => fetch(`/api/admin/comments/${id}`, { method: 'DELETE', headers: { 'X-Admin-Secret': adminSecret } }),
    };

    async function initializeAdminPanel() {
        storiesContainer.innerHTML = '<p>Loading stories...</p>';
        try {
            const response = await api.getStories();
            if (!response.ok) {
                 if(response.status === 401) throw new Error('Authentication failed. Check your secret key.');
                 throw new Error(`Failed to fetch stories: ${response.statusText}`);
            }
            
            fullStoryList = await response.json();
            handleFilterAndSort(); 
        } catch (error) {
            storiesContainer.innerHTML = `<p style="color: #ef4444;">Error: ${error.message}</p>`;
        }
    }

    function handleFilterAndSort() {
        let filteredStories = [...fullStoryList];
        const searchTerm = searchBar.value.toLowerCase();
        const currentStatus = statusFilter.value;

        if (currentStatus !== 'all') {
            const isApproved = currentStatus === 'approved';
            filteredStories = filteredStories.filter(story => story.is_approved === isApproved);
        }

        if (searchTerm) {
            filteredStories = filteredStories.filter(story => 
                story.title.toLowerCase().includes(searchTerm) ||
                (story.nickname && story.nickname.toLowerCase().includes(searchTerm)) ||
                story.location_name.toLowerCase().includes(searchTerm)
            );
        }

        const sortBy = sortSelect.value;
        if (sortBy === 'newest') {
            filteredStories.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        } else if (sortBy === 'oldest') {
            filteredStories.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        } else if (sortBy === 'title-az') {
            filteredStories.sort((a, b) => a.title.localeCompare(b.title));
        }
        
        currentFilteredList = filteredStories;
        currentPage = 1;
        renderCurrentPage();
    }

    function renderCurrentPage() {
        renderStoryCards(currentFilteredList, currentPage);
        setupPagination(currentFilteredList);
    }
    
   function renderStoryCards(storiesToRender, page = 1) {
    storiesContainer.innerHTML = '';
    if (storiesToRender.length === 0) {
        storiesContainer.innerHTML = '<p>No stories match the current filters.</p>';
        return;
    }

    const startIndex = (page - 1) * storiesPerPage;
    const endIndex = startIndex + storiesPerPage;
    const paginatedItems = storiesToRender.slice(startIndex, endIndex);

    paginatedItems.forEach(story => {
        const storyCard = document.createElement('div');
        storyCard.className = 'story-card';
        storyCard.dataset.storyId = story.id;
        if (!story.is_approved) {
            storyCard.classList.add('pending');
        }

        const commentsHTML = story.comments.map(comment => `
            <div class="comment-item" data-comment-id="${comment.id}">
                <div class="comment-text">
                    <p>${comment.comment_text}</p>
                    <div class="comment-meta">By: ${comment.nickname} | ${new Date(comment.created_at).toLocaleString()}</div>
                </div>
                <button class="action-delete-comment" data-comment-id="${comment.id}">Delete</button>
            </div>
        `).join('') || '<p>No comments on this story.</p>';

        const hasComments = story.comments.length > 0;

        storyCard.innerHTML = `
            <div class="story-header">
                <h3>${story.title}</h3>
                <div class="story-actions">
                    ${!story.is_approved ? `<button class="action-approve" data-story-id="${story.id}">Approve</button>` : ''}
                    <button class="action-edit" data-story-id="${story.id}">Edit</button>
                    <button class="action-delete-story" data-story-id="${story.id}">Delete Story</button>
                </div>
            </div>
            <div class="story-meta">
                <span><strong>By:</strong> ${story.nickname || 'N/A'}</span>
                <span><strong>Location:</strong> ${story.location_name}</span>
                <span><strong>Submitted:</strong> ${new Date(story.created_at).toLocaleDateString()}</span>
                <span><strong>Status:</strong> ${story.is_approved ? 'Approved' : 'Pending'}</span>
            </div>
            <div class="story-snippet">
                <p>${story.full_story.substring(0, 250)}${story.full_story.length > 250 ? '...' : ''}</p>
            </div>
            <div class="comments-section">
                <h4>
                    <span>Comments (${story.comments.length})</span>
                    ${hasComments ? `<button class="toggle-comments-btn">Show Comments</button>` : ''}
                </h4>
                <div class="comments-list comments-list-collapsible" id="comments-for-${story.id}">
                    ${commentsHTML}
                </div>
            </div>
        `;
        storiesContainer.appendChild(storyCard);
    });
}

    function setupPagination(items) {
        paginationContainer.innerHTML = "";
        const pageCount = Math.ceil(items.length / storiesPerPage);
        if (pageCount <= 1) return;

        const prevButton = document.createElement('button');
        prevButton.innerHTML = '«';
        prevButton.disabled = currentPage === 1;
        prevButton.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                renderCurrentPage();
            }
        });
        paginationContainer.appendChild(prevButton);

        for (let i = 1; i <= pageCount; i++) {
            let button = document.createElement('button');
            button.innerText = i;
            if (currentPage == i) button.classList.add('active');
            button.addEventListener('click', function () {
                currentPage = i;
                renderCurrentPage();
            });
            paginationContainer.appendChild(button);
        }

        const nextButton = document.createElement('button');
        nextButton.innerHTML = '»';
        nextButton.disabled = currentPage === pageCount;
        nextButton.addEventListener('click', () => {
            if (currentPage < pageCount) {
                currentPage++;
                renderCurrentPage();
            }
        });
        paginationContainer.appendChild(nextButton);
    }

    function openEditModal(storyId) {
        const storyData = fullStoryList.find(s => s.id == storyId);
        if (!storyData) return;

        document.getElementById('edit-story-id').value = storyData.id;
        document.getElementById('edit-title').value = storyData.title;
        document.getElementById('edit-nickname').value = storyData.nickname;
        document.getElementById('edit-location').value = storyData.location_name;
        document.getElementById('edit-full-story').value = storyData.full_story;

        editModal.classList.remove('hidden');
    }

    function closeEditModal() {
        editModal.classList.add('hidden');
        editStoryForm.reset();
    }

    function openCommentsModal(storyId) {
    const storyData = fullStoryList.find(s => s.id == storyId);
    if (!storyData) return;

    commentsModalTitle.textContent = `Comments for: "${storyData.title}"`;

    if (storyData.comments.length === 0) {
        commentsModalListContainer.innerHTML = '<p style="padding: 1rem; text-align: center;">No comments on this story.</p>';
    } else {
        const commentsHTML = storyData.comments.map(comment => `
            <div class="comment-item" data-comment-id="${comment.id}">
                <div class="comment-text">
                    <p>${comment.comment_text}</p>
                    <div class="comment-meta">By: ${comment.nickname} | ${new Date(comment.created_at).toLocaleString()}</div>
                </div>
                <button class="action-delete-comment" data-comment-id="${comment.id}">Delete</button>
            </div>
        `).join('');
        commentsModalListContainer.innerHTML = commentsHTML;
    }

    commentsModal.classList.remove('hidden');
}

function closeCommentsModal() {
    commentsModal.classList.add('hidden');
}

    async function handleSaveStory(e) {
        e.preventDefault();
        saveStoryButton.disabled = true;
        saveStoryButton.textContent = 'Saving...';
        
        const storyId = document.getElementById('edit-story-id').value;
        const data = {
            title: document.getElementById('edit-title').value,
            nickname: document.getElementById('edit-nickname').value,
            location_name: document.getElementById('edit-location').value,
            full_story: document.getElementById('edit-full-story').value,
        };

        try {
            const response = await api.updateStory(storyId, data);
            if (!response.ok) throw new Error('Failed to save changes.');
            alert('Story updated successfully.');
            closeEditModal();
            await initializeAdminPanel(); 
        } catch (error) {
            alert(`Error: ${error.message}`);
        } finally {
            saveStoryButton.disabled = false;
            saveStoryButton.textContent = 'Save Changes';
        }
    }

storiesContainer.addEventListener('click', async (e) => {
    const button = e.target.closest('button');
    if (!button) return; 

    const storyCard = button.closest('.story-card');
    const storyId = storyCard ? storyCard.dataset.storyId : null;
    
    if (button.classList.contains('action-delete-comment')) {
        const commentId = button.dataset.commentId;
        if (confirm('Delete this comment?')) {
            const response = await api.deleteComment(commentId);
            if (response.ok) {
                alert('Comment deleted.');
                button.closest('.comment-item').remove();
            } else {
                alert('Failed to delete comment.');
            }
        }
        return; 
    }

    if (!storyId) return; 

    if (button.classList.contains('action-approve')) {
        if (confirm('Approve this story and make it public?')) {
            const response = await api.approveStory(storyId);
            if (response.ok) {
                alert('Story approved.');
                initializeAdminPanel();
            } else {
                alert('Failed to approve story.');
            }
        }
    } else if (button.classList.contains('action-delete-story')) {
        if (confirm('PERMANENTLY delete this story and its comments? This cannot be undone.')) {
             const response = await api.deleteStory(storyId);
             if (response.ok) {
                alert('Story deleted.');
                initializeAdminPanel(); 
             } else {
                alert('Failed to delete story.');
             }
        }
    } else if (button.classList.contains('action-edit')) {
        openEditModal(storyId);
    } else if (button.classList.contains('toggle-comments-btn')) {
       openCommentsModal(storyId);
    }
});
    

commentsModalCloseButton.addEventListener('click', closeCommentsModal);

commentsModal.addEventListener('click', async (e) => {
    if (e.target === commentsModal) {
        closeCommentsModal();
    }

    const deleteButton = e.target.closest('.action-delete-comment');
    if (deleteButton) {
        const commentId = deleteButton.dataset.commentId;
        if (confirm('Are you sure you want to delete this comment?')) {
            const response = await api.deleteComment(commentId);
            if (response.ok) {
                alert('Comment deleted.');
                deleteButton.closest('.comment-item').remove();
                initializeAdminPanel();
            } else {
                alert('Failed to delete comment from modal.');
            }
        }
    }
});

   function authenticate(secret) {
    if (!secret) {
        alert('Please enter the secret key.');
        return;
    }
    adminSecret = secret;
    sessionStorage.setItem('adminSecretKey', secret); 

    authContainer.classList.add('hidden');
    adminContent.classList.remove('hidden');
    adminNav.classList.remove('hidden');
    
    initializeAdminPanel();
}

authButton.addEventListener('click', () => {
    authenticate(secretInput.value);
});
    
    secretInput.addEventListener('keydown', (e) => {
        if(e.key === 'Enter') authButton.click();
    });

    [searchBar, statusFilter, sortSelect].forEach(el => {
        el.addEventListener('input', handleFilterAndSort);
        el.addEventListener('change', handleFilterAndSort);
    });

    editStoryForm.addEventListener('submit', handleSaveStory);
    closeModalButton.addEventListener('click', closeEditModal);
    cancelEditButton.addEventListener('click', closeEditModal);

    logoutButton.addEventListener('click', logout);
    checkSession();
});
