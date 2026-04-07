        lucide.createIcons();

        // Smooth reveal on scroll (Simple implementation)
        const observerOptions = {
            threshold: 0.1
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('opacity-100');
                    entry.target.classList.remove('translate-y-10');
                    entry.target.classList.add('translate-y-0');
                }
            });
        }, observerOptions);

        document.querySelectorAll('section').forEach(section => {
            section.classList.add('transition-all', 'duration-1000', 'ease-out', 'opacity-0', 'translate-y-10');
            observer.observe(section);
        });

        // Immediately show Hero
        document.querySelector('section').classList.remove('opacity-0', 'translate-y-10');
