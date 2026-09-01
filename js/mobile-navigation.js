/** Accesibilidad y cierre del menú móvil basado en <details>. */
import { t } from './i18n.js';

(() => {
    const navigation = document.querySelector('[data-mobile-navigation]');
    if (!(navigation instanceof HTMLDetailsElement)) return;
    const summary = navigation.querySelector('summary');
    if (!(summary instanceof HTMLElement)) return;

    const sync = () => {
        summary.setAttribute('aria-expanded', String(navigation.open));
        summary.setAttribute('aria-label', t(navigation.open ? 'Cerrar menú' : 'Abrir menú'));
        document.body.classList.toggle('mobile-navigation-open', navigation.open);
    };

    navigation.addEventListener('toggle', sync);
    navigation.addEventListener('click', (event) => {
        if (event.target.closest('a')) navigation.open = false;
    });
    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape' || !navigation.open) return;
        navigation.open = false;
        summary.focus({ preventScroll: true });
    });
    sync();
})();
