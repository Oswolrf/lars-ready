/**
 * Shared, user-controlled accommodation carousel.
 * Markup contract: [data-carousel] containing [data-carousel-track],
 * [data-carousel-prev], [data-carousel-next] and [data-carousel-slide].
 */
document.addEventListener('DOMContentLoaded', () => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const promoteImage = (image) => {
        if (!image) return;
        const picture = image.closest('picture');
        picture?.querySelectorAll('source[data-srcset]').forEach((source) => {
            if (source.getAttribute('srcset') !== source.dataset.srcset) {
                source.srcset = source.dataset.srcset;
            }
        });
        if (image.dataset.src && image.getAttribute('src') !== image.dataset.src) {
            image.src = image.dataset.src;
        }
        if (image.dataset.srcset && image.getAttribute('srcset') !== image.dataset.srcset) {
            image.srcset = image.dataset.srcset;
        }
        image.decode?.().catch(() => {
            // A failed speculative decode must not block navigation.
        });
    };

    document.querySelectorAll('[data-carousel]').forEach((root) => {
        const track = root.querySelector('[data-carousel-track]');
        const previousButton = root.querySelector('[data-carousel-prev]');
        const nextButton = root.querySelector('[data-carousel-next]');
        const selectors = Array.from(root.querySelectorAll('[data-carousel-slide]'));
        const slides = track ? Array.from(track.children) : [];
        if (!track || slides.length === 0) return;

        let currentIndex = Math.max(0, selectors.findIndex((button) => (
            button.getAttribute('aria-current') === 'true'
        )));
        let touchStartX;
        let touchStartY;

        root.setAttribute('aria-roledescription', 'carrusel');
        if (!root.hasAttribute('tabindex')) root.tabIndex = 0;
        if (reduceMotion) track.style.transition = 'none';

        slides.forEach((slide, index) => {
            slide.setAttribute('role', 'group');
            slide.setAttribute('aria-roledescription', 'diapositiva');
            if (!slide.hasAttribute('aria-label')) {
                slide.setAttribute('aria-label', `${index + 1} de ${slides.length}`);
            }
        });

        const hydrateSlide = (index) => {
            const slide = slides[(index + slides.length) % slides.length];
            slide?.querySelectorAll('img').forEach(promoteImage);
        };

        const hydrateThumbnail = (index) => {
            selectors[(index + selectors.length) % selectors.length]?.querySelectorAll('img').forEach(promoteImage);
        };

        const hydrateForIndex = (index, includeAdjacent = true) => {
            hydrateSlide(index);
            if (includeAdjacent && root.dataset.carouselPreload === 'adjacent' && slides.length > 1) {
                hydrateSlide(index - 1);
                hydrateSlide(index + 1);
            }
        };

        const update = () => {
            track.style.transform = `translateX(-${currentIndex * 100}%)`;
            slides.forEach((slide, index) => {
                slide.setAttribute('aria-hidden', String(index !== currentIndex));
            });
            selectors.forEach((button, index) => {
                const active = index === currentIndex;
                button.setAttribute('aria-current', String(active));
                button.classList.toggle('active-thumb', active);
                button.classList.toggle('opacity-100', active);
                button.classList.toggle('ring-secondary', active);
                button.classList.toggle('opacity-40', !active);
                button.classList.toggle('ring-transparent', !active);
            });
        };

        const show = (index) => {
            currentIndex = (index + slides.length) % slides.length;
            hydrateForIndex(currentIndex);
            hydrateThumbnail(currentIndex);
            update();
        };

        previousButton?.addEventListener('click', () => show(currentIndex - 1));
        nextButton?.addEventListener('click', () => show(currentIndex + 1));
        selectors.forEach((button, index) => {
            button.addEventListener('click', () => show(index));
        });

        root.addEventListener('keydown', (event) => {
            if (event.key === 'ArrowLeft') {
                event.preventDefault();
                show(currentIndex - 1);
            } else if (event.key === 'ArrowRight') {
                event.preventDefault();
                show(currentIndex + 1);
            } else if (event.key === 'Home') {
                event.preventDefault();
                show(0);
            } else if (event.key === 'End') {
                event.preventDefault();
                show(slides.length - 1);
            }
        });

        track.addEventListener('touchstart', (event) => {
            touchStartX = event.changedTouches[0]?.screenX;
            touchStartY = event.changedTouches[0]?.screenY;
        }, { passive: true });
        track.addEventListener('touchend', (event) => {
            const touchEndX = event.changedTouches[0]?.screenX;
            const touchEndY = event.changedTouches[0]?.screenY;
            if (
                !Number.isFinite(touchStartX) ||
                !Number.isFinite(touchEndX) ||
                !Number.isFinite(touchStartY) ||
                !Number.isFinite(touchEndY)
            ) return;
            const deltaX = touchEndX - touchStartX;
            const deltaY = touchEndY - touchStartY;
            if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY) * 1.25) {
                show(currentIndex + (deltaX < 0 ? 1 : -1));
            }
            touchStartX = undefined;
            touchStartY = undefined;
        }, { passive: true });

        if (root.dataset.carouselPreload === 'adjacent' && slides.length > 1) {
            const hydrateAdjacent = () => {
                hydrateForIndex(currentIndex, true);
                selectors.forEach((_, index) => hydrateThumbnail(index));
            };
            if ('IntersectionObserver' in window) {
                const observer = new IntersectionObserver((entries) => {
                    if (!entries.some((entry) => entry.isIntersecting)) return;
                    hydrateAdjacent();
                    observer.disconnect();
                }, { rootMargin: '100px 0px' });
                observer.observe(root);
            } else {
                window.addEventListener('load', hydrateAdjacent, { once: true });
            }
        }
        update();
    });
});
