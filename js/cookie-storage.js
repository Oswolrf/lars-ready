export const CONSENT_STORAGE_KEY = 'lar-de-vies-cookie-consent-v1';
export const CONSENT_EVENT = 'lar-de-vies:cookie-consent';

// La AEPD recomienda no conservar una elección más de 24 meses sin volver a preguntar.
const CONSENT_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30 * 24;

export const readConsent = () => {
    try {
        const value = window.localStorage.getItem(CONSENT_STORAGE_KEY);
        const consent = value ? JSON.parse(value) : null;
        if (!consent || typeof consent !== 'object') return null;
        const age = Date.now() - Date.parse(consent.updatedAt);
        if (!Number.isFinite(age) || age < 0 || age > CONSENT_MAX_AGE_MS) return null;
        return consent;
    } catch {
        return null;
    }
};

export const saveConsent = (analytics) => {
    const consent = {
        necessary: true,
        analytics: Boolean(analytics),
        updatedAt: new Date().toISOString(),
    };
    try {
        window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(consent));
    } catch {
        // El aviso sigue funcionando aunque el navegador bloquee el almacenamiento.
    }
    window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: consent }));
    return consent;
};
