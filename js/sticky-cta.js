/**
 * Lar de Víes - sticky booking CTA.
 * Opt-out: <body data-sticky-cta="off">.
 */
import { t } from './i18n.js';

(() => {
    const DEFAULT_BOOKING_URL = typeof __LAR_BOOKING_FALLBACK__ === 'string'
        ? __LAR_BOOKING_FALLBACK__
        : '/reservas/#elegir-alojamiento';
    const BOOKING_HOST = 'direct-book.com';
    const PHONE_DISPLAY = '+34 678 655 303';
    const PHONE_HREF = 'tel:+34678655303';
    const PHONE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"'
        + ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'
        + '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6'
        + ' 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81'
        + 'a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45'
        + 'c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>';

    const safeBookingUrl = (value) => {
        try {
            const url = new URL(value, window.location.origin);
            const isChooser = url.origin === window.location.origin
                && /\/reservas\/$/.test(url.pathname)
                && url.hash === '#elegir-alojamiento';
            const isDirectBooking = url.protocol === 'https:'
                && url.hostname === BOOKING_HOST
                && url.pathname.startsWith('/properties/');
            if (isChooser) return `${url.pathname}${url.search}${url.hash}`;
            if (isDirectBooking) return url.href;
            throw new Error('Destino de reserva no permitido');
        } catch (_error) {
            return DEFAULT_BOOKING_URL;
        }
    };

    const init = () => {
        const body = document.body;
        if (!body || body.dataset.stickyCta === 'off') return;
        if (document.getElementById('sticky-cta')) return;

        const bookingUrl = safeBookingUrl(body.dataset.stickyCtaUrl || DEFAULT_BOOKING_URL);
        const bookLabel = body.dataset.stickyCtaLabel || 'Reservar';
        const bookingDirect = body.dataset.stickyCtaDirect || '';

        const bar = document.createElement('div');
        bar.id = 'sticky-cta';
        bar.className = 'sticky-cta';
        bar.setAttribute('aria-hidden', 'true');

        const inner = document.createElement('div');
        inner.className = 'sticky-cta__inner';

        const bookingLink = document.createElement('a');
        bookingLink.className = 'sticky-cta__book';
        bookingLink.href = bookingUrl;
        const isInternalChooser = bookingUrl.startsWith('/');
        if (isInternalChooser) bookingLink.dataset.bookingTrigger = '';
        else {
            bookingLink.target = '_blank';
            bookingLink.rel = 'noopener noreferrer';
        }
        bookingLink.dataset.cta = 'sticky-book';
        if (bookingDirect) bookingLink.dataset.bookingDirect = bookingDirect;
        bookingLink.textContent = bookLabel;

        const phoneLink = document.createElement('a');
        phoneLink.className = 'sticky-cta__phone';
        phoneLink.href = PHONE_HREF;
        phoneLink.setAttribute('aria-label', t('Llamar al {phone}', { phone: PHONE_DISPLAY }));
        phoneLink.dataset.cta = 'sticky-phone';
        phoneLink.innerHTML = `${PHONE_ICON}<span>${PHONE_DISPLAY}</span>`;

        inner.append(bookingLink, phoneLink);
        bar.appendChild(inner);
        body.appendChild(bar);

        const state = { pastHero: false, atFooter: false, menuOpen: false };
        const render = () => {
            const visible = state.pastHero && !state.atFooter && !state.menuOpen;
            bar.classList.toggle('is-visible', visible);
            bar.setAttribute('aria-hidden', String(!visible));
            body.classList.toggle('has-sticky-cta', visible);
        };

        watchHero(state, render);
        watchFooter(state, render);
        watchMobileMenu(state, render);
        render();
    };

    const watchHero = (state, render) => {
        const hero = document.querySelector('.hero-viewport') || document.querySelector('header');
        if (!hero || !('IntersectionObserver' in window)) {
            const onScroll = () => {
                state.pastHero = window.scrollY > window.innerHeight * 0.6;
                render();
            };
            window.addEventListener('scroll', onScroll, { passive: true });
            onScroll();
            return;
        }

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                state.pastHero = !entry.isIntersecting;
                render();
            });
        }, { threshold: 0, rootMargin: '0px 0px -80% 0px' });
        observer.observe(hero);
    };

    const watchFooter = (state, render) => {
        const footer = document.querySelector('footer');
        if (!footer || !('IntersectionObserver' in window)) return;
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                state.atFooter = entry.isIntersecting;
                render();
            });
        }, { threshold: 0 });
        observer.observe(footer);
    };

    const watchMobileMenu = (state, render) => {
        const menu = document.querySelector('[data-mobile-navigation]');
        if (!(menu instanceof HTMLDetailsElement)) return;
        const sync = () => {
            state.menuOpen = menu.open;
            render();
        };
        menu.addEventListener('toggle', sync);
        sync();
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
