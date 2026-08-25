(() => {
    'use strict';

    const STORAGE_KEY = 'lar-de-vies-cookie-consent-v1';
    const BASE_PATH = typeof __LAR_BASE_PATH__ !== 'undefined' ? __LAR_BASE_PATH__ : '/';
    const privacyUrl = `${BASE_PATH === '/' ? '' : BASE_PATH}politica-privacidad/`;

    const readConsent = () => {
        try {
            const value = window.localStorage.getItem(STORAGE_KEY);
            return value ? JSON.parse(value) : null;
        } catch {
            return null;
        }
    };

    const saveConsent = (analytics) => {
        const consent = {
            necessary: true,
            analytics: Boolean(analytics),
            updatedAt: new Date().toISOString(),
        };
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
        } catch {
            // El aviso sigue funcionando aunque el navegador bloquee el almacenamiento.
        }
        window.dispatchEvent(new CustomEvent('lar-de-vies:cookie-consent', { detail: consent }));
        return consent;
    };

    const init = () => {
        if (document.querySelector('[data-cookie-consent]')) return;

        const root = document.createElement('aside');
        root.className = 'cookie-consent';
        root.dataset.cookieConsent = '';
        const hasConsent = Boolean(readConsent());
        root.hidden = false;
        root.innerHTML = `
            <div class="cookie-consent__banner" role="dialog" aria-modal="false" aria-labelledby="cookie-consent-title" aria-describedby="cookie-consent-description">
                <div class="cookie-consent__copy">
                    <p id="cookie-consent-title" class="cookie-consent__title">Tu privacidad importa</p>
                    <p id="cookie-consent-description" class="cookie-consent__text">Usamos cookies técnicas necesarias para que la web funcione y recordar tus preferencias. Las cookies de análisis son opcionales y no se activan sin tu permiso.</p>
                    <a class="cookie-consent__link" href="${privacyUrl}">Más información en la política de privacidad</a>
                </div>
                <div class="cookie-consent__actions">
                    <button type="button" class="cookie-consent__button cookie-consent__button--secondary" data-cookie-reject>Rechazar opcionales</button>
                    <button type="button" class="cookie-consent__button cookie-consent__button--quiet" data-cookie-settings>Configurar</button>
                    <button type="button" class="cookie-consent__button cookie-consent__button--primary" data-cookie-accept>Aceptar todas</button>
                </div>
            </div>
            <div class="cookie-consent__panel" data-cookie-panel hidden role="dialog" aria-modal="true" aria-labelledby="cookie-settings-title">
                <div class="cookie-consent__panel-head">
                    <div>
                        <p class="cookie-consent__eyebrow">Preferencias</p>
                        <h2 id="cookie-settings-title" class="cookie-consent__panel-title">Gestionar cookies</h2>
                    </div>
                    <button type="button" class="cookie-consent__close" data-cookie-close aria-label="Cerrar preferencias">×</button>
                </div>
                <p class="cookie-consent__text">Puedes cambiar estas preferencias en cualquier momento. Las cookies necesarias no se pueden desactivar porque son imprescindibles para el funcionamiento de la web.</p>
                <div class="cookie-consent__category">
                    <div>
                        <p class="cookie-consent__category-title">Cookies necesarias</p>
                        <p class="cookie-consent__category-text">Permiten navegar, reservar y guardar tu elección de cookies.</p>
                    </div>
                    <span class="cookie-consent__status">Siempre activas</span>
                </div>
                <label class="cookie-consent__category cookie-consent__category--toggle" for="cookie-analytics">
                    <span>
                        <span class="cookie-consent__category-title">Cookies de análisis</span>
                        <span class="cookie-consent__category-text">Nos ayudan a entender cómo se utiliza la web para mejorarla.</span>
                    </span>
                    <input id="cookie-analytics" type="checkbox" data-cookie-analytics>
                </label>
                <div class="cookie-consent__panel-actions">
                    <button type="button" class="cookie-consent__button cookie-consent__button--secondary" data-cookie-reject>Rechazar opcionales</button>
                    <button type="button" class="cookie-consent__button cookie-consent__button--primary" data-cookie-save>Guardar preferencias</button>
                </div>
            </div>
            <button type="button" class="cookie-consent__manage" data-cookie-open hidden>Cookies</button>
        `;
        document.body.append(root);

        const banner = root.querySelector('.cookie-consent__banner');
        const panel = root.querySelector('[data-cookie-panel]');
        const analytics = root.querySelector('[data-cookie-analytics]');
        const manage = root.querySelector('[data-cookie-open]');
        banner.hidden = hasConsent;
        manage.hidden = !hasConsent;
        const closePanel = () => {
            panel.hidden = true;
            banner.hidden = false;
            manage.hidden = true;
        };
        const finish = (analyticsEnabled) => {
            saveConsent(analyticsEnabled);
            root.hidden = false;
            banner.hidden = true;
            panel.hidden = true;
            manage.hidden = false;
        };
        const openSettings = () => {
            const consent = readConsent();
            analytics.checked = Boolean(consent?.analytics);
            root.hidden = false;
            banner.hidden = true;
            panel.hidden = false;
            manage.hidden = true;
            panel.querySelector('[data-cookie-close]')?.focus();
        };

        root.querySelectorAll('[data-cookie-accept]').forEach((button) => button.addEventListener('click', () => finish(true)));
        root.querySelectorAll('[data-cookie-reject]').forEach((button) => button.addEventListener('click', () => finish(false)));
        root.querySelector('[data-cookie-settings]')?.addEventListener('click', openSettings);
        root.querySelector('[data-cookie-save]')?.addEventListener('click', () => finish(analytics.checked));
        root.querySelector('[data-cookie-close]')?.addEventListener('click', closePanel);
        manage.addEventListener('click', openSettings);

    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
    else init();
})();
