document.addEventListener('DOMContentLoaded', () => {
    const gridContainer = document.getElementById('artifact-grid');
    const modal = document.getElementById('artifact-modal');
    const modalCloseBtn = document.getElementById('artifact-modal-close-button');
    const modalImage = document.getElementById('modal-artifact-image');
    const modalTitle = document.getElementById('modal-artifact-title');
    const modalThreatLevel = document.getElementById('modal-artifact-threat-level');
    const modalOrigin = document.getElementById('modal-artifact-origin');
    const modalDescription = document.getElementById('modal-artifact-description');
    const modalProperties = document.getElementById('modal-artifact-properties');
    const modalHandling = document.getElementById('modal-artifact-handling');

    async function fetchAndDisplayArtifacts() {
        if (!gridContainer) return;
        gridContainer.innerHTML = '<p class="loading-text">Unsealing the Vault...</p>';

        try {
            const { data: artifacts, error } = await supabaseClient
                .from('artifacts')
                .select('*')
                .order('name', { ascending: true });

            if (error) throw error;
            
            displayArtifacts(artifacts);

        } catch (err) {
            console.error("Error fetching artifacts:", err);
            gridContainer.innerHTML = '<p class="loading-text">The Vault remains sealed. The connection is unstable.</p>';
        }
    }

    function displayArtifacts(artifacts) {
        if (!artifacts || artifacts.length === 0) {
            gridContainer.innerHTML = '<p class="loading-text">The Vault is currently empty.</p>';
            return;
        }
        gridContainer.innerHTML = artifacts.map(artifact => `
            <div class="artifact-card" data-id="${artifact.id}" role="button" tabindex="0">
                <img src="${artifact.image_url || 'images/placeholder.png'}" alt="${artifact.name}" class="artifact-card-img">
                <div class="artifact-card-content">
                    <h2 class="artifact-card-title">${artifact.name}</h2>
                    <div class="artifact-card-threat-level threat-${(artifact.threat_level || 'unknown').toLowerCase()}">
                        Threat Level: ${artifact.threat_level || 'Unknown'}
                    </div>
                </div>
            </div>
        `).join('');
    }
    
    function populateModal(artifact) {
        modalImage.src = artifact.image_url || 'images/placeholder.png';
        modalImage.alt = artifact.name;
        modalTitle.textContent = artifact.name;

        const threatLevel = artifact.threat_level || 'Unknown';
        modalThreatLevel.textContent = `Classification: ${threatLevel}`;
        modalThreatLevel.className = `modal-artifact-threat-level threat-${threatLevel.toLowerCase()}`;
        
        modalOrigin.innerHTML = `<p>${(artifact.origin || 'Origin unknown.').replace(/\n/g, '</p><p>')}</p>`;
        modalDescription.innerHTML = `<p>${(artifact.description || 'No physical description on file.').replace(/\n/g, '</p><p>')}</p>`;
        modalProperties.innerHTML = `<p>${(artifact.properties || 'Paranormal properties are unverified or unknown.').replace(/\n/g, '</p><p>')}</p>`;
        modalHandling.innerHTML = `<p>${(artifact.acquisition_and_handling || 'No standard acquisition or handling protocols exist.').replace(/\n/g, '</p><p>')}</p>`;
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
        const card = e.target.closest('.artifact-card');
        if (!card) return;

        const artifactId = card.dataset.id;
        try {
            const { data: artifactData, error } = await supabaseClient
                .from('artifacts')
                .select('*')
                .eq('id', artifactId)
                .single();
            
            if (error) throw error;

            if (artifactData) {
                populateModal(artifactData);
                openModal();
            }
        } catch(err) {
            console.error("Error fetching single artifact:", err);
            alert("Could not retrieve the file from the vault.");
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

    document.getElementById('currentYearArtifacts').textContent = new Date().getFullYear();
    const navToggle = document.querySelector('.nav-toggle');
    const navMenu = document.querySelector('.nav-menu');
    if (navToggle && navMenu) {
        navToggle.addEventListener('click', () => {
            const isExpanded = navToggle.getAttribute('aria-expanded') === 'true' || false;
            navToggle.setAttribute('aria-expanded', !isExpanded);
            navMenu.classList.toggle('active');
        });
    }
    
    fetchAndDisplayArtifacts();
});