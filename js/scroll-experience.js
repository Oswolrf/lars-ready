/**
 * Lightweight, native scroll reveals.
 *
 * This module deliberately has no Lenis, GSAP or animation-frame ticker. It
 * uses one IntersectionObserver and the Web Animations API, then unobserves
 * content after its first reveal. Existing animation classes keep working;
 * new markup may use `data-scroll-reveal` and optional numeric data attributes:
 * `data-reveal-distance`, `data-reveal-duration` and `data-reveal-delay`.
 */
(() => {
    const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const registered = new Map();
    let observer;

    const toBoundedNumber = (value, fallback, minimum, maximum) => {
        const parsed = Number.parseFloat(value);
        if (!Number.isFinite(parsed)) return fallback;
        return Math.min(maximum, Math.max(minimum, parsed));
    };

    const register = (element, overrides = {}) => {
        if (!element || registered.has(element)) return;

        const distance = toBoundedNumber(
            element.dataset.revealDistance,
            overrides.distance ?? 40,
            0,
            120
        );
        const duration = toBoundedNumber(
            element.dataset.revealDuration,
            overrides.duration ?? 650,
            0,
            2000
        );
        const delay = toBoundedNumber(
            element.dataset.revealDelay,
            overrides.delay ?? 0,
            0,
            1200
        );

        registered.set(element, {
            distance,
            duration,
            delay,
            revealed: false,
            originalTransform: element.style.transform
        });
    };

    const reveal = (element, immediate = false) => {
        const state = registered.get(element);
        if (!state || state.revealed) return;
        state.revealed = true;
        observer?.unobserve(element);

        element.style.opacity = '1';
        element.style.visibility = 'visible';
        element.style.transform = state.originalTransform;
        element.dataset.scrollState = 'revealed';

        if (immediate || reduceMotionQuery.matches || typeof element.animate !== 'function') return;

        // Preserve class-driven transforms (for example Tailwind hover:translate)
        // after the entrance animation has finished.
        const computedTransform = window.getComputedStyle(element).transform;
        const restingTransform = computedTransform === 'none' ? 'none' : computedTransform;
        const enteringTransform = restingTransform === 'none'
            ? `translate3d(0, ${state.distance}px, 0)`
            : `${restingTransform} translate3d(0, ${state.distance}px, 0)`;

        element.animate([
            {
                opacity: 0,
                transform: enteringTransform
            },
            { opacity: 1, transform: restingTransform }
        ], {
            duration: state.duration,
            delay: state.delay,
            easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
            fill: 'backwards'
        });
    };

    const revealEverything = () => {
        observer?.disconnect();
        registered.forEach((_state, element) => reveal(element, true));
        document.documentElement.style.scrollBehavior = 'auto';
    };

    const collectTargets = () => {
        document.querySelectorAll(
            '.animate-on-scroll, .animate-slide-up, [data-scroll-reveal]'
        ).forEach((element) => register(element));

        document.querySelectorAll('.animate-stagger-container').forEach((container) => {
            container.querySelectorAll('.animate-stagger-item').forEach((element, index) => {
                register(element, { distance: 30, duration: 560, delay: Math.min(index * 75, 450) });
            });
        });

        document.querySelectorAll('#biodiversity .material-icon, #biodiversity .material-symbols-outlined').forEach((element, index) => {
            register(element, { distance: 24, duration: 500, delay: Math.min(index * 70, 350) });
        });

        const philosophyTitle = document.querySelector('section.bg-primary-dark h2');
        register(philosophyTitle, { distance: 24, duration: 760 });

        // Keep footer navigation visible: content at the page bottom may never
        // reach the observer's inset reveal area on taller viewports.
    };

    const initialise = () => {
        collectTargets();
        if (registered.size === 0) return;

        if (reduceMotionQuery.matches || !('IntersectionObserver' in window)) {
            revealEverything();
            return;
        }

        document.documentElement.style.scrollBehavior = 'smooth';
        registered.forEach((state, element) => {
            element.style.opacity = '0';
            element.style.visibility = 'visible';
            element.style.transform = `translate3d(0, ${state.distance}px, 0)`;
            element.dataset.scrollState = 'pending';
        });

        observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) reveal(entry.target);
            });
        }, {
            rootMargin: '0px 0px -12% 0px',
            threshold: 0.05
        });

        registered.forEach((_state, element) => observer.observe(element));
    };

    const handleMotionPreference = () => {
        if (reduceMotionQuery.matches) revealEverything();
    };

    if (typeof reduceMotionQuery.addEventListener === 'function') {
        reduceMotionQuery.addEventListener('change', handleMotionPreference);
    } else {
        reduceMotionQuery.addListener?.(handleMotionPreference);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialise, { once: true });
    } else {
        initialise();
    }
})();
