/**
 * Lar de Víes - Booking Bar Footer Collision Handler
 * Prevents the fixed booking bar from overlapping the footer by adjusting its bottom position.
 */

document.addEventListener('DOMContentLoaded', () => {
    const bookingBarContainer = document.getElementById('booking-bar-container');
    const footer = document.querySelector('footer');

    if (!bookingBarContainer || !footer) {
        // Elements not found, exit silently
        return;
    }

    const handleScroll = () => {
        const footerRect = footer.getBoundingClientRect();
        const viewportHeight = window.innerHeight;

        // Calculate the distance from the top of the footer to the bottom of the viewport
        // Positive value means footer is visible (partially or fully) or above viewport bottom
        const distanceToFooter = viewportHeight - footerRect.top;

        // Default bottom spacing (matches bottom-12 class which is 3rem = 48px)
        const defaultBottom = 48;

        // Extra padding to keep some space between bar and footer content
        const buffer = 20;

        if (distanceToFooter > 0) {
            // Footer is entering or inside the viewport
            // Disable transition to prevent bouncing/fighting with scroll
            bookingBarContainer.classList.remove('transition-all', 'duration-100', 'ease-out');

            // New bottom = distance (how much footer is visible) + buffer
            const newBottom = Math.max(defaultBottom, distanceToFooter + buffer);
            bookingBarContainer.style.bottom = `${newBottom}px`;
        } else {
            // Footer is below viewport
            // Re-enable transition for smooth return/scroll
            bookingBarContainer.classList.add('transition-all', 'duration-100', 'ease-out');
            bookingBarContainer.style.bottom = ''; // Reset to CSS default
        }
    };

    // Run on scroll
    window.addEventListener('scroll', handleScroll, { passive: true });

    // Run on resize
    window.addEventListener('resize', handleScroll, { passive: true });

    // Initial check
    handleScroll();
});
