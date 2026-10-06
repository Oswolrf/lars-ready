import { CONSENT_EVENT, readConsent } from './cookie-storage.js';

// Google Analytics 4 solo se carga después de que el visitante acepte las cookies de análisis.
// Sin identificador de medición en el build (__LAR_GA_ID__ vacío) este módulo no hace nada.
(() => {
    'use strict';

    const MEASUREMENT_ID = typeof __LAR_GA_ID__ !== 'undefined' ? __LAR_GA_ID__ : '';
    if (!MEASUREMENT_ID) return;

    let loaded = false;

    const gtag = function () {
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push(arguments);
    };

    const expireCookie = (name, domain) => {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0; path=/${domain ? `; domain=${domain}` : ''}; SameSite=Lax`;
    };

    const deleteAnalyticsCookies = () => {
        const names = document.cookie
            .split(';')
            .map((entry) => entry.split('=')[0].trim())
            .filter((name) => name === '_ga' || name.startsWith('_ga_'));
        const parts = window.location.hostname.split('.');
        for (const name of names) {
            expireCookie(name);
            for (let index = 0; index < parts.length - 1; index += 1) {
                expireCookie(name, `.${parts.slice(index).join('.')}`);
            }
        }
    };

    const enable = () => {
        window[`ga-disable-${MEASUREMENT_ID}`] = false;
        if (loaded) {
            gtag('consent', 'update', { analytics_storage: 'granted' });
            return;
        }
        loaded = true;
        gtag('consent', 'default', {
            analytics_storage: 'denied',
            ad_storage: 'denied',
            ad_user_data: 'denied',
            ad_personalization: 'denied',
        });
        gtag('consent', 'update', { analytics_storage: 'granted' });
        gtag('js', new Date());
        gtag('config', MEASUREMENT_ID, {
            allow_google_signals: false,
            allow_ad_personalization_signals: false,
        });
        const script = document.createElement('script');
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(MEASUREMENT_ID)}`;
        document.head.append(script);
    };

    const disable = () => {
        window[`ga-disable-${MEASUREMENT_ID}`] = true;
        if (loaded) gtag('consent', 'update', { analytics_storage: 'denied' });
        deleteAnalyticsCookies();
    };

    window.addEventListener(CONSENT_EVENT, (event) => {
        if (event.detail?.analytics) enable();
        else disable();
    });

    if (readConsent()?.analytics) enable();
})();
