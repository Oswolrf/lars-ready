/** Lar de Víes - accessible mobile navigation overlay. */
document.addEventListener('DOMContentLoaded', () => {
    const button = document.getElementById('mobile-menu-btn');
    const menu = document.getElementById('mobile-menu');
    const closeButton = document.getElementById('mobile-menu-close');
    if (!button || !menu) return;

    const setMenuOpen = (open, restoreFocus = true) => {
        menu.classList.toggle('hidden', !open);
        menu.setAttribute('aria-hidden', String(!open));
        button.setAttribute('aria-expanded', String(open));

        if (open) {
            window.LarDeViesDialog?.activate(menu, {
                trigger: button,
                initialFocus: closeButton || menu.querySelector('a'),
                onRequestClose: () => setMenuOpen(false)
            });
        } else {
            window.LarDeViesDialog?.deactivate(menu, { restoreFocus });
        }
    };

    setMenuOpen(false, false);
    button.addEventListener('click', () => {
        setMenuOpen(button.getAttribute('aria-expanded') !== 'true');
    });
    closeButton?.addEventListener('click', () => setMenuOpen(false));
    menu.querySelectorAll('a').forEach((link) => {
        link.addEventListener('click', () => setMenuOpen(false, false));
    });
});
