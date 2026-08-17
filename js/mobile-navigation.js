/** Accesibilidad y cierre del menú móvil basado en <details>. */
(() => {
    const navigation = document.querySelector('[data-mobile-navigation]');
    if (!(navigation instanceof HTMLDetailsElement)) return;
    const summary = navigation.querySelector('summary');
    if (!(summary instanceof HTMLElement)) return;
    const panel = navigation.querySelector('[data-mobile-navigation-panel]');
    if (!(panel instanceof HTMLElement)) return;
    const dialogController = window.LarDeViesDialog;

    const close = () => {
        navigation.open = false;
    };

    const sync = () => {
        summary.setAttribute('aria-expanded', String(navigation.open));
        summary.setAttribute('aria-label', navigation.open ? 'Cerrar menú' : 'Abrir menú');
        document.body.classList.toggle('mobile-navigation-open', navigation.open);

        if (navigation.open) {
            dialogController?.activate(panel, {
                trigger: summary,
                initialFocus: panel.querySelector('a'),
                onRequestClose: close
            });
        } else {
            dialogController?.deactivate(panel);
            panel.setAttribute('aria-hidden', 'true');
        }
    };

    navigation.addEventListener('toggle', sync);
    navigation.addEventListener('click', (event) => {
        if (event.target.closest('a')) close();
    });
    if (!dialogController) {
        document.addEventListener('keydown', (event) => {
            if (event.key !== 'Escape' || !navigation.open) return;
            close();
            summary.focus({ preventScroll: true });
        });
    }
    sync();
})();
