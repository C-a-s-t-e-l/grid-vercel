document.addEventListener('DOMContentLoaded', () => {
   
    const trigger = document.getElementById('jumpscare-trigger');
    const container = document.getElementById('jumpscare-container');
    const audio = document.getElementById('jumpscare-audio');
    const aftermathAudio = document.getElementById('aftermath-audio');
    const warningText = document.getElementById('warning-text');
    const aftermathText = document.getElementById('aftermath-text');

    const FADE_OUT_DURATION_SECONDS = 5; 
    const FADE_INTERVAL_MS = 100;

    let pactMade = false;
    let fadeInterval = null;

    if (trigger && container && audio && aftermathAudio && warningText && aftermathText) {
        audio.preload = 'auto';
        aftermathAudio.preload = 'auto';

        trigger.addEventListener('click', () => {
            if (pactMade) return;
            
            audio.currentTime = 0;
            audio.volume = 1.0;
            audio.play();

            container.classList.add('active');
            setTimeout(() => {
                container.classList.remove('active');
            }, 3000);

            audio.onended = () => {
               
                if (fadeInterval) clearInterval(fadeInterval); 
                aftermathAudio.currentTime = 0;
                aftermathAudio.volume = 1.0;
                aftermathAudio.play();

                const aftermathTimeUpdateHandler = () => {
                    const timeRemaining = aftermathAudio.duration - aftermathAudio.currentTime;
                    if (timeRemaining <= FADE_OUT_DURATION_SECONDS) {
                        startAftermathFadeOut();
                        aftermathAudio.removeEventListener('timeupdate', aftermathTimeUpdateHandler);
                    }
                };
                aftermathAudio.addEventListener('timeupdate', aftermathTimeUpdateHandler);
            };

            warningText.style.display = 'none';
            aftermathText.style.display = 'block';
            const aftermathParagraphs = aftermathText.querySelectorAll('p, li');
            aftermathParagraphs.forEach(p => p.classList.add('glitch-active'));
            
            pactMade = true;
        });
    }

    function startAftermathFadeOut() {
        const steps = (FADE_OUT_DURATION_SECONDS * 1000) / FADE_INTERVAL_MS;
        const volumeDecrement = aftermathAudio.volume / steps;

        fadeInterval = setInterval(() => {
            aftermathAudio.volume = Math.max(0, aftermathAudio.volume - volumeDecrement);

            if (aftermathAudio.volume === 0) {
                clearInterval(fadeInterval);
                aftermathAudio.pause();
            }
        }, FADE_INTERVAL_MS);
    }

    const warningSection = document.getElementById('section-warning');
    const initialParagraphs = warningText.querySelectorAll('p');
    window.addEventListener('scroll', () => {
        if (pactMade) return; 
        const rect = warningSection.getBoundingClientRect();
        if (rect.top <= window.innerHeight && rect.bottom >= 0) {
            initialParagraphs.forEach(p => p.classList.add('glitch-active'));
        } else {
            initialParagraphs.forEach(p => p.classList.remove('glitch-active'));
        }
    });
});