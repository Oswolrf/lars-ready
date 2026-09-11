/** Accesibilidad y cierre del menú móvil basado en <details>. */
import { t } from './i18n.js';

(() => {
    const navigation = document.querySelector('[data-mobile-navigation]');
    if (!(navigation instanceof HTMLDetailsElement)) return;
    const summary = navigation.querySelector('summary');
    if (!(summary instanceof HTMLElement)) return;
    const panel = document.querySelector('[data-mobile-navigation-panel]');
    const closeButton = panel?.querySelector('[data-mobile-navigation-close]');

    const closeMenu = () => {
        navigation.open = false;
        summary.focus({ preventScroll: true });
    };

    const sync = () => {
        const open = navigation.open;
        summary.setAttribute('aria-expanded', String(open));
        summary.setAttribute('aria-label', t(open ? 'Cerrar menú' : 'Abrir menú'));
        document.body.classList.toggle('mobile-navigation-open', open);

        if (!panel) return;
        panel.hidden = !open;
        panel.classList.toggle('hidden', !open);
        panel.setAttribute('aria-hidden', String(!open));

        if (open) {
            window.LarDeViesDialog?.activate(panel, {
                trigger: summary,
                initialFocus: closeButton || panel.querySelector('a'),
                onRequestClose: closeMenu
            });
        } else {
            window.LarDeViesDialog?.deactivate(panel);
        }
    };

    navigation.addEventListener('toggle', sync);
    closeButton?.addEventListener('click', closeMenu);
    panel?.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));
    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape' || !navigation.open) return;
        navigation.open = false;
        summary.focus({ preventScroll: true });
    });
    sync();
})();
