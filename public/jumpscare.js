   document.addEventListener('DOMContentLoaded', () => {
            const trigger = document.getElementById('jumpscare-trigger');
            const container = document.getElementById('jumpscare-container');
            const audio = document.getElementById('jumpscare-audio');
            const warningText = document.getElementById('warning-text');
            const aftermathText = document.getElementById('aftermath-text');

            let pactMade = false;

            if (trigger && container && audio && warningText && aftermathText) {
                audio.preload = 'auto';
                trigger.addEventListener('click', () => {
                    if (pactMade) return; 
                    container.classList.add('active');
                    audio.currentTime = 0;
                    audio.play();
                    
                    setTimeout(() => {
                        container.classList.remove('active');
                    }, 3000);

                    warningText.style.display = 'none';
                    aftermathText.style.display = 'block';

                   
                    const aftermathParagraphs = aftermathText.querySelectorAll('p, li');
                    aftermathParagraphs.forEach(p => p.classList.add('glitch-active'));
                    
                    pactMade = true;
                });
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