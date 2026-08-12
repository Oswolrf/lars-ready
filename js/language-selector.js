/** Accessible behaviour shared by the desktop and mobile language menus. */
(() => {
    const selectors = Array.from(document.querySelectorAll('[data-language-selector]'))
        .filter((element) => element instanceof HTMLDetailsElement);
    if (selectors.length === 0) return;

    const close = (selector, restoreFocus = false) => {
        if (!selector.open) return;
        selector.open = false;
        if (restoreFocus) selector.querySelector('summary')?.focus({ preventScroll: true });
    };

    selectors.forEach((selector) => {
        const summary = selector.querySelector('summary');
        selector.addEventListener('toggle', () => {
            summary?.setAttribute('aria-expanded', String(selector.open));
            if (!selector.open) return;
            selectors.forEach((candidate) => {
                if (candidate !== selector) close(candidate);
            });
        });
        summary?.setAttribute('aria-expanded', String(selector.open));
    });

    document.addEventListener('pointerdown', (event) => {
        selectors.forEach((selector) => {
            if (!selector.contains(event.target)) close(selector);
        });
    });

    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        const openSelector = selectors.find((selector) => selector.open);
        if (!openSelector) return;
        event.stopImmediatePropagation();
        close(openSelector, true);
    });
})();
