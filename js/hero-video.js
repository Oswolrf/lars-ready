/**
 * Poster-first hero video loading.
 *
 * Preferred markup keeps network URLs in `data-src`:
 *   <video data-hero-video poster="..." preload="none">
 *     <source data-src="...webm" type="video/webm">
 *     <source data-src="...mp4" type="video/mp4">
 *   </video>
 *
 * For backwards compatibility, existing `src` attributes are moved to
 * `data-src` at startup. Sources are restored only after window.load, an idle
 * period, a positive viewport intersection and a permissive network policy.
 */
(() => {
    const { playbackIsBlocked: policyBlocksPlayback } = require('./hero-video-policy.cjs');
    const VIDEO_SELECTOR = 'video[data-hero-video]';
    const DEFAULT_IDLE_TIMEOUT = 2000;
    const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const connection = (
        navigator.connection || navigator.mozConnection || navigator.webkitConnection
    );
    const states = new Map();

    const playbackIsBlocked = () => (
        policyBlocksPlayback({
            reducedMotion: reduceMotionQuery.matches,
            connection
        })
    );

    const setState = (video, value) => {
        video.dataset.heroState = value;
    };

    const sourceNodes = (video) => [video, ...video.querySelectorAll('source')];

    const parkSources = (video) => {
        let changed = false;

        sourceNodes(video).forEach((node) => {
            const currentSource = node.getAttribute('src');
            if (!currentSource) return;
            if (!node.hasAttribute('data-src')) node.setAttribute('data-src', currentSource);
            node.removeAttribute('src');
            changed = true;
        });

        return changed;
    };

    const restoreSources = (video) => {
        let changed = false;

        sourceNodes(video).forEach((node) => {
            const deferredSource = node.getAttribute('data-src');
            if (!deferredSource || node.hasAttribute('src')) return;
            node.setAttribute('src', deferredSource);
            changed = true;
        });

        return changed;
    };

    const revealPoster = (state) => {
        state.video.style.opacity = '0';
        if (state.poster) state.poster.style.opacity = '1';
    };

    const stopAndPark = (state, reason = 'blocked') => {
        const { video } = state;
        video.pause();
        const changed = parkSources(video);
        state.activated = false;
        state.playing = false;
        if (changed || video.readyState > HTMLMediaElement.HAVE_NOTHING) video.load();
        revealPoster(state);
        setState(video, reason);
    };

    const revealVideoFrame = (state) => {
        const { video, revealAt } = state;
        if (revealAt > 0 && video.currentTime < revealAt) return;
        video.style.opacity = '1';
        if (state.poster) state.poster.style.opacity = '0';
        video.removeEventListener('timeupdate', state.revealWhenReady);
    };

    const playIfEligible = (state) => {
        const { video } = state;
        if (
            !state.idleReady ||
            !state.inViewport ||
            playbackIsBlocked() ||
            document.visibilityState === 'hidden'
        ) {
            video.pause();
            state.playing = false;
            return;
        }

        if (!state.activated) {
            if (!restoreSources(video)) {
                setState(video, 'poster');
                revealPoster(state);
                return;
            }
            state.activated = true;
            setState(video, 'loading');
            video.load();
        }

        if (state.playing && !video.paused) return;

        video.play().then(() => {
            state.playing = true;
            setState(video, 'playing');
            revealVideoFrame(state);
        }).catch(() => {
            state.playing = false;
            setState(video, 'poster');
            revealPoster(state);
        });
    };

    const scheduleAfterLoadAndIdle = (state) => {
        const markIdleReady = () => {
            if (state.idleScheduled) return;
            state.idleScheduled = true;

            const timeout = Number.parseInt(
                state.video.dataset.heroIdleTimeout || DEFAULT_IDLE_TIMEOUT,
                10
            );
            const safeTimeout = Number.isFinite(timeout) && timeout >= 0
                ? Math.min(timeout, 10000)
                : DEFAULT_IDLE_TIMEOUT;
            const ready = () => {
                state.idleReady = true;
                playIfEligible(state);
            };

            if ('requestIdleCallback' in window) {
                window.requestIdleCallback(ready, { timeout: safeTimeout });
            } else {
                window.setTimeout(ready, Math.min(safeTimeout, 1200));
            }
        };

        if (document.readyState === 'complete') {
            markIdleReady();
        } else {
            window.addEventListener('load', markIdleReady, { once: true });
        }
    };

    const initialise = () => {
        const videos = Array.from(document.querySelectorAll(VIDEO_SELECTOR));
        if (videos.length === 0) return;

        const observer = 'IntersectionObserver' in window
            ? new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    const state = states.get(entry.target);
                    if (!state) return;
                    state.inViewport = entry.isIntersecting;
                    if (entry.isIntersecting) {
                        playIfEligible(state);
                    } else {
                        entry.target.pause();
                        state.playing = false;
                        if (state.activated) setState(entry.target, 'paused');
                    }
                });
            }, { threshold: 0.15 })
            : null;

        videos.forEach((video) => {
            video.preload = 'none';
            video.pause();

            const revealAt = Number.parseFloat(video.dataset.heroRevealAt || '0');
            const state = {
                video,
                poster: video.parentElement?.querySelector('.hero-poster') || null,
                revealAt: Number.isFinite(revealAt) && revealAt > 0 ? revealAt : 0,
                revealWhenReady: null,
                activated: false,
                playing: false,
                idleReady: false,
                idleScheduled: false,
                inViewport: observer ? false : true
            };
            state.revealWhenReady = () => revealVideoFrame(state);
            states.set(video, state);

            parkSources(video);
            video.load();
            video.addEventListener('timeupdate', state.revealWhenReady);
            video.addEventListener('error', () => stopAndPark(state, 'error'));
            revealPoster(state);
            setState(video, playbackIsBlocked() ? 'blocked' : 'poster');

            observer?.observe(video);
            scheduleAfterLoadAndIdle(state);
        });

        const applyPolicy = () => {
            states.forEach((state) => {
                if (playbackIsBlocked()) {
                    stopAndPark(state, 'blocked');
                } else {
                    setState(state.video, state.activated ? 'paused' : 'poster');
                    playIfEligible(state);
                }
            });
        };

        const handleVisibility = () => {
            states.forEach((state) => {
                if (document.visibilityState === 'hidden') {
                    state.video.pause();
                    state.playing = false;
                } else {
                    playIfEligible(state);
                }
            });
        };

        if (typeof reduceMotionQuery.addEventListener === 'function') {
            reduceMotionQuery.addEventListener('change', applyPolicy);
        } else {
            reduceMotionQuery.addListener?.(applyPolicy);
        }
        connection?.addEventListener?.('change', applyPolicy);
        document.addEventListener('visibilitychange', handleVisibility);
        window.addEventListener('pageshow', handleVisibility);
        window.addEventListener('pagehide', () => {
            states.forEach((state) => state.video.pause());
        }, { once: true });
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialise, { once: true });
    } else {
        initialise();
    }
})();
