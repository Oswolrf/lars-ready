/**
 * Conservative, single-shot hero prefetch.
 *
 * Prefetch is allowed only for a fine pointer on an explicitly fast 4G
 * connection, after a sustained 350 ms hover. Keyboard focus and touch never
 * spend bandwidth. New links may provide `data-prefetch-hero="/image.webp"`;
 * the legacy route map remains as a compatibility fallback.
 */
(() => {
    const connection = (
        navigator.connection || navigator.mozConnection || navigator.webkitConnection
    );
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    const reducedData = window.matchMedia('(prefers-reduced-data: reduce)');
    const heroByPath = {
        '/': '/images/home-hero-updated-desktop-2560.webp',
        '/la-casona/': '/images/la-casona-hero-desktop-opt-v2.webp',
        '/las-villas-casitas-independientes/': '/images/las-villas-hero-desktop-opt-v2.webp',
        '/el-entorno/': '/images/entorno-hero-desktop-opt-v2.webp',
        '/reservas/': '/images/reserva-hero-v2.webp',
        '/sobre-nosotros/': '/images/sobre-nosotros-poster.webp'
    };
    let pending;
    let prefetched = false;

    const networkIsExplicitlyFast = () => {
        if (!connection || connection.saveData || reducedData.matches) return false;
        if (String(connection.effectiveType || '').toLowerCase() !== '4g') return false;
        if (Number.isFinite(connection.downlink) && connection.downlink < 5) return false;
        if (Number.isFinite(connection.rtt) && connection.rtt > 180) return false;
        return finePointer.matches;
    };

    const resolveCandidate = (link) => {
        if (!link?.href) return null;
        let target;
        try {
            target = new URL(link.href, window.location.href);
        } catch (_error) {
            return null;
        }

        if (target.origin !== window.location.origin || target.pathname === window.location.pathname) {
            return null;
        }

        const source = link.dataset.prefetchHero || heroByPath[target.pathname];
        if (!source) return null;
        try {
            const asset = new URL(source, window.location.href);
            return asset.origin === window.location.origin ? asset.href : null;
        } catch (_error) {
            return null;
        }
    };

    const cancelPending = (link) => {
        if (!pending || (link && pending.link !== link)) return;
        window.clearTimeout(pending.timer);
        pending = undefined;
    };

    const schedule = (link) => {
        if (prefetched || !networkIsExplicitlyFast()) return;
        const source = resolveCandidate(link);
        if (!source) return;

        cancelPending();
        pending = {
            link,
            timer: window.setTimeout(() => {
                if (prefetched || !networkIsExplicitlyFast()) {
                    pending = undefined;
                    return;
                }
                const prefetch = document.createElement('link');
                prefetch.rel = 'prefetch';
                prefetch.as = 'image';
                prefetch.href = source;
                prefetch.setAttribute('fetchpriority', 'low');
                document.head.appendChild(prefetch);
                prefetched = true;
                pending = undefined;
            }, 350)
        };
    };

    document.addEventListener('pointerover', (event) => {
        const link = event.target.closest?.('a');
        if (!link || link.contains(event.relatedTarget)) return;
        schedule(link);
    }, { passive: true });

    document.addEventListener('pointerout', (event) => {
        const link = event.target.closest?.('a');
        if (!link || link.contains(event.relatedTarget)) return;
        cancelPending(link);
    }, { passive: true });

    window.addEventListener('pagehide', () => cancelPending(), { once: true });
})();
