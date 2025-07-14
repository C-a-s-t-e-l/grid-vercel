document.addEventListener('DOMContentLoaded', () => {

    let totalStories = 0;
    const storiesPerPage = 9;

    const urlParams = new URLSearchParams(window.location.search);
    let currentPage = parseInt(urlParams.get('page')) || 1;

    const storyListContainer = document.getElementById('story-list-container');
    const paginationContainer = document.getElementById('pagination-container');
    const searchBar = document.getElementById('story-search-bar');
    const sortSelect = document.getElementById('sort-stories');

    function formatDate(dateString) {
        const options = { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true };
        const date = new Date(dateString);
        const formattedDate = new Intl.DateTimeFormat('en-US', options).format(date);
        return formattedDate.replace(' at', ' -').replace(/(AM|PM)/g, (match) => match.toLowerCase());
    }

  async function fetchAndRenderStories(page = 1) {
    if (!storyListContainer) return;
    storyListContainer.innerHTML = '<p class="no-results">The spirits are gathering the tales...</p>';
    currentPage = page;

    const newUrl = `${window.location.pathname}?page=${currentPage}`;
    window.history.pushState({ path: newUrl }, '', newUrl);

    try {
        const searchTerm = searchBar.value;
        const sortValue = sortSelect.value; 
        const sortParts = sortValue.split('-'); 
        const sortColumn = sortParts[0]; 
        const sortAscending = sortParts[1] === 'asc' || sortParts[1] === 'az'; 

        let query = supabaseClient
            .from('stories')
            .select('id, title, location_name, nickname, snippet, created_at', { count: 'exact' })
            .eq('is_approved', true);

        if (searchTerm) {
            query = query.or(`title.ilike.%${searchTerm}%,nickname.ilike.%${searchTerm}%,location_name.ilike.%${searchTerm}%,snippet.ilike.%${searchTerm}%`);
        }

        const startIndex = (page - 1) * storiesPerPage;
        query = query
            .order(sortColumn, { ascending: sortAscending }) 
            .range(startIndex, startIndex + storiesPerPage - 1);

        const { data, error, count } = await query;

        if (error) throw error;
        
        totalStories = count;
        renderStories(data);
        setupPagination();

    } catch (error) {
        console.error('Failed to fetch stories:', error.message);
        storyListContainer.innerHTML = '<p class="no-results">Failed to load the archive. The spirits are not responding...</p>';
    }
}



    function renderStories(storiesToRender) {
        storyListContainer.innerHTML = '';
        if (!storiesToRender || storiesToRender.length === 0) {
            storyListContainer.innerHTML = '<p class="no-results">No stories found. The spirits are quiet...</p>';
            return;
        }

        storiesToRender.forEach(story => {
            const formattedDate = formatDate(story.created_at);
            const caseTag = `Archive #${String(story.id).padStart(4, '0')} - ${formattedDate}`;
            const storyLink = `story.html?id=${story.id}&from=archive&page=${currentPage}`;

            const storyCard = `
                <div class="story-card" data-story-id="${story.id}">
                    <p class="story-card-casetag">${caseTag}</p>
                    <div class="story-card-content">
                        <p class="story-card-location"><i class="fas fa-map-pin"></i>${story.location_name}</p>
                        <h3 class="story-card-title">${story.title}</h3>
                        <p class="story-card-author">By: ${story.nickname || 'Unknown'}</p>
                        <p class="story-card-snippet">${story.snippet}</p>
                    </div>
                    <div class="story-card-actions">
                        <a href="${storyLink}" class="eerie-button primary btn-read">
                            <i class="fas fa-book-open"></i> Read Full Story
                        </a>
                    </div>
                </div>
            `;
            storyListContainer.innerHTML += storyCard;
        });
    }

    if (storyListContainer) {
    storyListContainer.addEventListener('click', function(event) {
        const storyLink = event.target.closest('a.btn-read');

        if (!storyLink) {
            return; 
        }
        
        event.preventDefault(); 
        const returnPath = {
            from: 'archive',
            page: currentPage 
        };

        sessionStorage.setItem('returnPath', JSON.stringify(returnPath));

        window.location.href = storyLink.href;
    });
}

    function setupPagination() {
        if (!paginationContainer) return;
        paginationContainer.innerHTML = "";
        
        const pageCount = Math.ceil(totalStories / storiesPerPage);
        if (pageCount <= 1) return;

        paginationContainer.appendChild(createNavButton('«', currentPage > 1 ? currentPage - 1 : 1, currentPage === 1));

        const pagesToShow = [];
        const boundaryCount = 1; 
        const totalVisibleButtons = 7; 

        if (pageCount <= totalVisibleButtons + 2) {
            for (let i = 1; i <= pageCount; i++) {
                pagesToShow.push(i);
            }
        } else {
            pagesToShow.push(1);
            
            let start = Math.max(2, currentPage - boundaryCount);
            let end = Math.min(pageCount - 1, currentPage + boundaryCount);

            if (currentPage - boundaryCount > 2) {
                pagesToShow.push('...');
            }

            for (let i = start; i <= end; i++) {
                pagesToShow.push(i);
            }

            if (currentPage + boundaryCount < pageCount - 1) {
                pagesToShow.push('...');
            }

            pagesToShow.push(pageCount);
        }

        pagesToShow.forEach(page => {
            if (page === '...') {
                paginationContainer.appendChild(createEllipsis());
            } else {
                paginationContainer.appendChild(createPageButton(page));
            }
        });

        paginationContainer.appendChild(createNavButton('»', currentPage < pageCount ? currentPage + 1 : pageCount, currentPage === pageCount));
    }

    function createPageButton(page) {
        const button = document.createElement('button');
        button.innerText = page;
        if (currentPage === page) button.classList.add('active');
        button.addEventListener('click', () => fetchAndRenderStories(page));
        return button;
    }
    
    function createNavButton(text, page, isDisabled) {
        const button = document.createElement('button');
        button.innerHTML = text;
        button.disabled = isDisabled;
        button.addEventListener('click', () => fetchAndRenderStories(page));
        return button;
    }

    function createEllipsis() {
        const ellipsis = document.createElement('span');
        ellipsis.innerText = '...';
        ellipsis.style.padding = '8px 12px';
        ellipsis.style.color = 'var(--text-muted)';
        return ellipsis;
    }

    function debounce(func, delay) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    }

    if (searchBar) {
        searchBar.addEventListener('input', debounce(() => fetchAndRenderStories(1), 500));
    }
    if (sortSelect) {
        sortSelect.addEventListener('change', () => fetchAndRenderStories(1));
    }
    
    fetchAndRenderStories(currentPage); 
});