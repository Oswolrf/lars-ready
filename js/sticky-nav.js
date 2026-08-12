/**
 * Lar de Víes - Sticky Navigation Bar
 * Adds a dark transparent backdrop to the navbar when scrolling down.
 */

document.addEventListener('DOMContentLoaded', () => {
    const nav = document.getElementById('main-nav');
    if (!nav) return;

    const scrollThreshold = 100; // Pixels to scroll before activating the backdrop

    const handleScroll = () => {
        if (window.scrollY > scrollThreshold) {
            nav.classList.add('nav-scrolled');
        } else {
            nav.classList.remove('nav-scrolled');
        }
    };

    // Listen for scroll events
    window.addEventListener('scroll', handleScroll, { passive: true });

    // Initial check in case the page loads scrolled down
    handleScroll();
});
