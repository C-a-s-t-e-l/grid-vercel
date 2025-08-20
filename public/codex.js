document.addEventListener('DOMContentLoaded', () => {
    const gridContainer = document.getElementById('codex-grid');
    const modal = document.getElementById('codex-modal');
    const modalCloseBtn = document.getElementById('codex-modal-close-button');
    const modalImage = document.getElementById('modal-codex-image');
    const modalTitle = document.getElementById('modal-codex-title');
    const modalDescription = document.getElementById('modal-codex-description');
    const modalCharacteristics = document.getElementById('modal-codex-characteristics');
    const modalWarning = document.getElementById('modal-codex-warning');

    async function fetchAndDisplayCreatures() {
        if (!gridContainer) return;
        gridContainer.innerHTML = '<p class="loading-text">Accessing the bestiary...</p>';

        try {
            const { data: creatures, error } = await supabaseClient
                .from('codex_entries')
                .select('*')
                .order('name', { ascending: true });

            if (error) throw error;
            
            displayCreatures(creatures);

        } catch (err) {
            console.error("Error fetching codex entries:", err);
            gridContainer.innerHTML = '<p class="loading-text">Failed to access the bestiary. The connection is severed.</p>';
        }
    }

    function displayCreatures(creatures) {
        if (!creatures || creatures.length === 0) {
            gridContainer.innerHTML = '<p class="loading-text">The bestiary is empty.</p>';
            return;
        }
        gridContainer.innerHTML = creatures.map(creature => `
            <div class="codex-card" data-id="${creature.id}" role="button" tabindex="0">
                <img src="${creature.image_url || 'images/placeholder.png'}" alt="${creature.name}" class="codex-card-img">
                <div class="codex-card-content">
                    <h2 class="codex-card-title">${creature.name}</h2>
                    <p class="codex-card-tagline">${creature.tagline}</p>
                </div>
            </div>
        `).join('');
    }
    
    function populateModal(creature) {
        modalImage.src = creature.image_url || 'images/placeholder.png';
        modalImage.alt = creature.name;
        modalTitle.textContent = creature.name;
        modalDescription.innerHTML = `<p>${(creature.description || '').replace(/\n/g, '</p><p>')}</p>`;
        
        if (creature.characteristics && Array.isArray(creature.characteristics)) {
             modalCharacteristics.innerHTML = creature.characteristics.map(item => `<li>${item}</li>`).join('');
        } else {
             modalCharacteristics.innerHTML = '<li>No specific characteristics on file.</li>';
        }

        modalWarning.textContent = creature.countermeasures || 'No specific countermeasures on file. Proceed with extreme caution.';
    }

    function openModal() {
        modal.classList.add('modal-visible');
        document.body.style.overflow = 'hidden';
    }

    function closeModal() {
        modal.classList.remove('modal-visible');
        document.body.style.overflow = '';
    }
    
    gridContainer.addEventListener('click', async (e) => {
        const card = e.target.closest('.codex-card');
        if (!card) return;

        const creatureId = card.dataset.id;
        try {
            const { data: creatureData, error } = await supabaseClient
                .from('codex_entries')
                .select('*')
                .eq('id', creatureId)
                .single();
            
            if (error) throw error;

            if (creatureData) {
                populateModal(creatureData);
                openModal();
            }
        } catch(err) {
            console.error("Error fetching single creature:", err);
            alert("Could not retrieve the file from the archive.");
        }
    });

    modalCloseBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('modal-visible')) {
            closeModal();
        }
    });

    document.getElementById('currentYearMap').textContent = new Date().getFullYear();
    const navToggle = document.querySelector('.nav-toggle');
    const navMenu = document.querySelector('.nav-menu');
    if (navToggle && navMenu) {
        navToggle.addEventListener('click', () => {
            const isExpanded = navToggle.getAttribute('aria-expanded') === 'true' || false;
            navToggle.setAttribute('aria-expanded', !isExpanded);
            navMenu.classList.toggle('active');
        });
    }
    
    fetchAndDisplayCreatures();
});