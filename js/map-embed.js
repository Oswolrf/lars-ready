// Google Maps solo se carga cuando la persona visitante lo pide: el iframe no tiene src hasta entonces.
(() => {
    'use strict';

    document.querySelectorAll('[data-map-embed]').forEach((embed) => {
        const frame = embed.querySelector('iframe[data-map-src]');
        const consent = embed.querySelector('[data-map-consent]');
        const button = embed.querySelector('[data-map-load]');
        if (!frame || !consent || !button) return;

        button.addEventListener('click', () => {
            frame.src = frame.dataset.mapSrc;
            frame.hidden = false;
            consent.hidden = true;
        });
    });
})();
