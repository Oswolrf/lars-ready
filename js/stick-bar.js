/**
 * Lar de Víes - Smart Sticky Booking Bar
 * Handles the "Pick Up" behavior: Bar starts in document flow, then sticks to bottom
 * when the viewport bottom reaches it.
 */

document.addEventListener('DOMContentLoaded', () => {
    const stickyBars = document.querySelectorAll('[data-sticky-bar]');

    if (stickyBars.length === 0) return;

    // Store initial positions and create placeholders
    const stickyData = [];

    stickyBars.forEach(bar => {
        // Create placeholder to prevent layout shift
        const placeholder = document.createElement('div');
        // Match dimensions
        placeholder.style.width = '100%';
        placeholder.style.height = bar.offsetHeight + 'px';
        const computedStyle = getComputedStyle(bar);
        placeholder.style.marginTop = computedStyle.marginTop;
        placeholder.style.marginBottom = computedStyle.marginBottom;
        placeholder.style.display = 'none'; // Initially hidden
        placeholder.style.visibility = 'hidden';

        // Insert placeholder before bar
        bar.parentNode.insertBefore(placeholder, bar);

        stickyData.push({
            element: bar,
            placeholder: placeholder,
            isSticky: false,
            initialStyles: {
                position: bar.style.position || getComputedStyle(bar).position,
                bottom: bar.style.bottom || getComputedStyle(bar).bottom,
                left: bar.style.left || getComputedStyle(bar).left,
                transform: bar.style.transform || getComputedStyle(bar).transform,
                zIndex: bar.style.zIndex || getComputedStyle(bar).zIndex,
                width: bar.style.width || getComputedStyle(bar).width
            }
        });
    });

    const handleScroll = () => {
        const viewportHeight = window.innerHeight;
        // Assuming bottom-12 is 48px (3rem)
        const offsetBottom = 48;

        stickyData.forEach(item => {
            const { element, placeholder } = item;

            if (!item.isSticky) {
                // Check if the STATIC element has moved UP past the trigger point
                // Trigger point: When element top visually hits the intended fixed top
                // Fixed Top = Viewport Height - Element Height - Offset

                const rect = element.getBoundingClientRect();
                const fixedTopLimit = viewportHeight - rect.height - offsetBottom;

                // If visual top goes ABOVE (less than) the limit, we should stick (pull it down)
                // Wait, we want to Keep it at Limit if natural < Limit.
                // So if rect.top <= fixedTopLimit -> Stick.

                if (rect.top <= fixedTopLimit) {
                    makeSticky(item);
                }
            } else {
                // Check if the PLACEHOLDER has moved DOWN past the trigger point
                // i.e. we should revert to static
                const rect = placeholder.getBoundingClientRect();
                const fixedTopLimit = viewportHeight - rect.height - offsetBottom;

                if (rect.top > fixedTopLimit) {
                    makeStatic(item);
                }
            }
        });
    };

    function makeSticky(item) {
        if (item.isSticky) return; // Prevent loop

        const { element, placeholder } = item;

        const isAbsolute = item.initialStyles.position === 'absolute';

        if (!isAbsolute) {
            placeholder.style.display = 'block';
        }

        element.style.position = 'fixed';
        // Use class for bottom positioning so footer-collision.js can reset style.bottom safely
        element.classList.add('bottom-12');
        element.style.bottom = '';
        element.style.left = '50%';
        element.style.transform = 'translateX(-50%)';
        element.style.zIndex = '50';
        element.style.mixBlendMode = 'normal';
        // Ensure width is constrained if needed
        element.style.width = '100%';
        element.style.maxWidth = '42rem'; // max-w-2xl (Updated to match new design)

        item.isSticky = true;
    }

    function makeStatic(item) {
        if (!item.isSticky) return;

        const { element, placeholder } = item;

        // Hide placeholder
        placeholder.style.display = 'none';

        // Revert styles
        element.classList.remove('bottom-12');
        element.style.position = item.initialStyles.position;
        element.style.bottom = item.initialStyles.bottom;
        element.style.left = item.initialStyles.left;
        element.style.transform = item.initialStyles.transform;
        element.style.zIndex = item.initialStyles.zIndex;
        element.style.width = item.initialStyles.width;
        element.style.maxWidth = ''; // Clear inline max-width

        item.isSticky = false;
    }

    // Run on scroll
    window.addEventListener('scroll', handleScroll, { passive: true });

    // Initial check (in case we load scrolled down)
    handleScroll();
});
