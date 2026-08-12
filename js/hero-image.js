/** Reveal hero overlays after their image has decoded or finished loading. */
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('img[data-hero-reveal]').forEach((image) => {
        const reveal = () => {
            const container = image.closest('header') || image.parentElement;
            const overlay = container?.querySelector('.hero-overlay');
            if (overlay) overlay.style.opacity = '1';
        };

        if (image.complete && image.naturalWidth > 0) {
            reveal();
        } else {
            image.addEventListener('load', reveal, { once: true });
        }
    });
});
