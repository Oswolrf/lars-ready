/**
 * Brevo configuration and lazy runtime loader.
 *
 * Preferred HTML contract: remove the eager Brevo `src` script and expose the
 * URL either as `data-brevo-src` on the form or on an empty script placeholder.
 * Existing eager script tags remain supported during migration.
 */
import { t } from './i18n.js';

(() => {
    const DEFAULT_BREVO_SRC = 'https://sibforms.com/forms/end-form/build/main.js';

    window.REQUIRED_CODE_ERROR_MESSAGE = 'Elige un código de país';
    window.LOCALE = 'es';
    window.EMAIL_INVALID_MESSAGE = 'Introduce una dirección de correo válida.';
    window.SMS_INVALID_MESSAGE = 'La información proporcionada no es válida.';
    window.REQUIRED_ERROR_MESSAGE = 'Este campo no puede quedarse vacío.';
    window.GENERIC_INVALID_MESSAGE = 'Revisa la información e inténtalo de nuevo.';
    window.INVALID_NUMBER = 'Introduce un número válido.';
    window.INVALID_DATE = 'Introduce una fecha válida.';
    window.REQUIRED_MULTISELECT_MESSAGE = 'Selecciona al menos una opción.';
    window.translation = {
        common: {
            selectedList: '{quantity} lista seleccionada',
            selectedLists: '{quantity} listas seleccionadas',
            selectedOption: '{quantity} opción seleccionada',
            selectedOptions: '{quantity} opciones seleccionadas'
        }
    };
    window.AUTOHIDE = false;

    const eagerScript = document.querySelector(
        'script[src*="sibforms.com/forms/end-form/build/main.js"]'
    );
    const sourcePlaceholder = document.querySelector('script[data-brevo-src]');
    let runtimeStatus = eagerScript ? 'loading' : 'idle';
    let runtimeScript = eagerScript;
    let runtimePromise;
    let resolveRuntime;
    let rejectRuntime;

    const announceReady = (script) => {
        runtimeStatus = 'ready';
        runtimeScript = script;
        script.dataset.brevoLoaded = 'true';
        resolveRuntime?.(script);
        window.dispatchEvent(new CustomEvent('lar-de-vies:brevo-ready'));
    };

    const announceFailure = (error) => {
        runtimeStatus = 'failed';
        rejectRuntime?.(error);
    };

    const watchRuntime = (script) => {
        runtimePromise = new Promise((resolve, reject) => {
            resolveRuntime = resolve;
            rejectRuntime = reject;
        });
        // A speculative viewport/focus load may fail before a submit handler awaits it.
        // Keep that failure observable through runtimeStatus without creating an
        // unhandled-rejection warning in the page.
        runtimePromise.catch(() => {});
        script.addEventListener('load', () => announceReady(script), { once: true });
        script.addEventListener('error', () => {
            announceFailure(new Error('No se pudo cargar el servicio de newsletter.'));
        }, { once: true });
        return runtimePromise;
    };

    if (eagerScript) watchRuntime(eagerScript);

    const resolveRuntimeSource = (form) => (
        form?.dataset.brevoSrc ||
        sourcePlaceholder?.dataset.brevoSrc ||
        DEFAULT_BREVO_SRC
    );

    const loadBrevo = (form) => {
        if (runtimeStatus === 'ready') return Promise.resolve(runtimeScript);
        if (runtimeStatus === 'loading' && runtimePromise) return runtimePromise;
        if (runtimeStatus === 'failed') {
            // A later explicit submit should be able to recover from a transient
            // network failure instead of leaving the form permanently disabled.
            document.querySelector('script[data-brevo-runtime]')?.remove();
            runtimeStatus = 'idle';
            runtimeScript = undefined;
            runtimePromise = undefined;
            resolveRuntime = undefined;
            rejectRuntime = undefined;
        }

        const source = resolveRuntimeSource(form);
        let parsedSource;
        try {
            parsedSource = new URL(source, window.location.href);
        } catch (_error) {
            return Promise.reject(new Error('La URL del servicio de newsletter no es válida.'));
        }
        if (parsedSource.protocol !== 'https:' || parsedSource.hostname !== 'sibforms.com') {
            return Promise.reject(new Error('El origen del servicio de newsletter no está permitido.'));
        }

        const script = document.createElement('script');
        script.src = parsedSource.href;
        script.async = true;
        script.dataset.brevoRuntime = 'true';
        runtimeStatus = 'loading';
        runtimeScript = script;
        watchRuntime(script);
        document.head.appendChild(script);
        return runtimePromise;
    };

    const initialise = () => {
        const form = document.querySelector('[data-newsletter-form]');
        const successPanel = document.getElementById('success-message');
        const errorPanel = document.getElementById('error-message');
        if (!form || !successPanel || !errorPanel) return;

        const submitButton = form.querySelector('.newsletter-submit');
        const consentCheckbox = form.querySelector('.newsletter-checkbox');
        const emailInput = form.querySelector('input[type="email"]');
        const emailError = document.getElementById('newsletter-email-error');
        const consentError = document.getElementById('newsletter-consent-error');
        const loader = form.querySelector('.newsletter-loader');
        const successText = successPanel.querySelector('.sib-form-message-panel__inner-text');
        const errorText = errorPanel.querySelector('.sib-form-message-panel__inner-text');
        const successMessage = t('Te hemos enviado un correo para confirmar tu suscripción. Revisa tu bandeja de entrada y, si no lo encuentras, la carpeta de spam.');
        const loadingTimeoutMs = 20000;
        let loadingTimeout;
        let loadingRuntime = false;
        let stateObserver;
        let proximityObserver;

        if (successText) successText.textContent = successMessage;

        const syncConsentState = () => {
            if (submitButton) submitButton.disabled = loadingRuntime;
            form.setAttribute('aria-busy', String(loadingRuntime));
        };

        const validateFields = () => {
            let firstInvalid;
            const emailValid = Boolean(emailInput?.value.trim()) && emailInput.validity.valid;
            if (emailInput) emailInput.setAttribute('aria-invalid', String(!emailValid));
            if (emailError) emailError.textContent = emailValid ? '' : t('Introduce una dirección de correo válida.');
            if (!emailValid) firstInvalid = emailInput;

            const consentValid = Boolean(consentCheckbox?.checked);
            if (consentCheckbox) consentCheckbox.setAttribute('aria-invalid', String(!consentValid));
            if (consentError) consentError.textContent = consentValid ? '' : t('Debes aceptar el envío de la newsletter.');
            if (!consentValid && !firstInvalid) firstInvalid = consentCheckbox;
            return { valid: emailValid && consentValid, firstInvalid };
        };

        const stopLoading = () => {
            window.clearTimeout(loadingTimeout);
            loadingTimeout = undefined;
            loader?.classList.add('sib-hide-loader-icon');
            syncConsentState();
        };

        const showRuntimeError = (message, focus = false) => {
            loadingRuntime = false;
            stopLoading();
            if (errorText) errorText.textContent = message;
            errorPanel.classList.add('sib-form-message-panel--active');
            if (focus) {
                errorPanel.tabIndex = -1;
                errorPanel.focus({ preventScroll: true });
            }
        };

        const warmRuntime = () => {
            loadBrevo(form).catch(() => {
                // A proximity preload failure is reported only if the user submits.
            });
        };

        const syncSubmissionState = () => {
            const succeeded = successPanel.classList.contains('sib-form-message-panel--active');
            const failed = errorPanel.classList.contains('sib-form-message-panel--active');

            if (succeeded) {
                loadingRuntime = false;
                stopLoading();
                errorPanel.classList.remove('sib-form-message-panel--active');
                if (successText) successText.textContent = successMessage;
                form.classList.add('newsletter-form--hidden');
                successPanel.tabIndex = -1;
                successPanel.focus({ preventScroll: true });
                stateObserver?.disconnect();
                proximityObserver?.disconnect();
            } else if (failed) {
                loadingRuntime = false;
                stopLoading();
            }
        };

        const startSubmissionTimeout = () => {
            window.clearTimeout(loadingTimeout);
            loader?.classList.remove('sib-hide-loader-icon');
            loadingTimeout = window.setTimeout(() => {
                if (successPanel.classList.contains('sib-form-message-panel--active')) return;
                showRuntimeError(
                    t('La solicitud está tardando demasiado. Comprueba tu conexión e inténtalo de nuevo.')
                );
            }, loadingTimeoutMs);
        };

        form.addEventListener('submit', (event) => {
            const validation = validateFields();
            if (!validation.valid) {
                event.preventDefault();
                event.stopImmediatePropagation();
                syncConsentState();
                validation.firstInvalid?.focus();
                return;
            }

            if (runtimeStatus !== 'ready') {
                event.preventDefault();
                event.stopImmediatePropagation();
                if (loadingRuntime) return;

                loadingRuntime = true;
                loader?.classList.remove('sib-hide-loader-icon');
                syncConsentState();
                const submitter = event.submitter;
                loadBrevo(form).then(() => {
                    loadingRuntime = false;
                    syncConsentState();
                    if (submitter?.isConnected) {
                        form.requestSubmit(submitter);
                    } else {
                        form.requestSubmit();
                    }
                }).catch(() => {
                    showRuntimeError(
                        t('No hemos podido cargar el servicio de suscripción. Comprueba tu conexión e inténtalo de nuevo.'),
                        true
                    );
                });
                return;
            }

            startSubmissionTimeout();
        }, true);

        stateObserver = new MutationObserver(syncSubmissionState);
        stateObserver.observe(successPanel, { attributes: true, attributeFilter: ['class'] });
        stateObserver.observe(errorPanel, { attributes: true, attributeFilter: ['class'] });

        if ('IntersectionObserver' in window && runtimeStatus === 'idle') {
            proximityObserver = new IntersectionObserver((entries) => {
                if (!entries.some((entry) => entry.isIntersecting)) return;
                proximityObserver.disconnect();
                warmRuntime();
            }, { rootMargin: '800px 0px', threshold: 0 });
            proximityObserver.observe(form);
        }

        form.addEventListener('focusin', warmRuntime, { once: true });
        form.addEventListener('pointerenter', warmRuntime, { once: true, passive: true });
        consentCheckbox?.addEventListener('change', syncConsentState);
        consentCheckbox?.addEventListener('change', validateFields);
        emailInput?.addEventListener('input', () => {
            if (emailInput.getAttribute('aria-invalid') === 'true') validateFields();
        });
        syncConsentState();
        syncSubmissionState();

        window.LarDeViesNewsletter = {
            loadBrevo: () => loadBrevo(form),
            getRuntimeStatus: () => runtimeStatus
        };
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialise, { once: true });
    } else {
        initialise();
    }
})();
