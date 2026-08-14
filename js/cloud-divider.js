/**
 * Cloud divider between the home hero and the first content section.
 *
 * Rendering: each cloud is a canvas sprite produced from fractal value
 * noise (fbm), shaped by a soft elliptical falloff and shaded by density,
 * which reads as photographic valley mist rather than a drawn cartoon
 * cloud. Sprites are generated once, deterministically seeded, and shared
 * between the divs that carry the same data-cloud-sprite index.
 *
 * Scroll behaviour: the divider is a zero-height anchor on the seam. While
 * the seam travels the viewport the clouds fade in, hold, then dissolve as
 * the visitor scrolls past — the curve is written to --cloud-fade so all
 * compositing stays in CSS. A gentle parallax offset goes to --cloud-shift
 * (skipped for reduced motion).
 */
(() => {
    const divider = document.querySelector('[data-cloud-divider]');
    if (!divider) return;

    const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    /* ------------------------------------------------------------------ *
     * Sprite generation
     * ------------------------------------------------------------------ */

    const SPRITE_WIDTH = 560;
    const SPRITE_HEIGHT = 224;

    // Deterministic per-seed hash so every visit renders the same sky.
    const makeHash = (seed) => (ix, iy) => {
        let h = ix * 374761393 + iy * 668265263 + seed * 1442695040888963407;
        h = (h ^ (h >> 13)) * 1274126177;
        h ^= h >> 16;
        return ((h >>> 0) % 100000) / 100000;
    };

    const smooth = (t) => t * t * (3 - 2 * t);

    // Value noise with bilinear interpolation, then 5-octave fbm.
    const makeFbm = (seed) => {
        const hash = makeHash(seed);
        const noise = (x, y) => {
            const ix = Math.floor(x);
            const iy = Math.floor(y);
            const fx = smooth(x - ix);
            const fy = smooth(y - iy);
            const a = hash(ix, iy);
            const b = hash(ix + 1, iy);
            const c = hash(ix, iy + 1);
            const d = hash(ix + 1, iy + 1);
            return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
        };
        return (x, y) => {
            let total = 0;
            let amplitude = 0.5;
            let frequency = 1;
            for (let octave = 0; octave < 5; octave += 1) {
                total += amplitude * noise(x * frequency, y * frequency);
                amplitude *= 0.5;
                frequency *= 2.08;
            }
            return total; // ~[0, 1)
        };
    };

    const clamp01 = (value) => Math.min(1, Math.max(0, value));
    const smoothstep = (edge0, edge1, value) => {
        const t = clamp01((value - edge0) / (edge1 - edge0));
        return t * t * (3 - 2 * t);
    };

    const renderSprite = (seed) => {
        const canvas = document.createElement('canvas');
        canvas.width = SPRITE_WIDTH;
        canvas.height = SPRITE_HEIGHT;
        const context = canvas.getContext('2d');
        if (!context) return null;

        const fbm = makeFbm(seed);
        const shadeFbm = makeFbm(seed + 101);
        const image = context.createImageData(SPRITE_WIDTH, SPRITE_HEIGHT);
        const pixels = image.data;

        for (let y = 0; y < SPRITE_HEIGHT; y += 1) {
            const ny = y / SPRITE_HEIGHT;
            for (let x = 0; x < SPRITE_WIDTH; x += 1) {
                const nx = x / SPRITE_WIDTH;

                // Soft elliptical body, slightly lower than centre so the
                // sprite has a fuller base and a wispier crown.
                const dx = (nx - 0.5) / 0.47;
                const dy = (ny - 0.56) / 0.42;
                const body = clamp01(1 - (dx * dx + dy * dy));

                const turbulence = fbm(nx * 5.4, ny * 3.4);
                const density = body * 0.95 + (turbulence - 0.5) * 1.55;
                const alpha = smoothstep(0.22, 0.66, density);
                if (alpha <= 0.004) continue;

                // Denser pockets read darker; light comes from above.
                const pocket = shadeFbm(nx * 5.2 + 3.7, ny * 3.9 + 1.3);
                let brightness = 1
                    - 0.14 * smoothstep(0.5, 0.88, pocket)
                    - 0.08 * smoothstep(0.45, 0.95, ny);
                brightness = clamp01(brightness);

                // Slightly warm white so the mist sits well on the beige
                // paper background as well as the dark forest hero.
                const offset = (y * SPRITE_WIDTH + x) * 4;
                pixels[offset] = Math.round(brightness * 252);
                pixels[offset + 1] = Math.round(brightness * 250);
                pixels[offset + 2] = Math.round(brightness * 246);
                pixels[offset + 3] = Math.round(alpha * 255);
            }
        }

        context.putImageData(image, 0, 0);
        return canvas;
    };

    const paintClouds = () => {
        const holders = divider.querySelectorAll('[data-cloud-sprite]');
        if (!holders.length) return;

        const spriteCache = new Map();
        holders.forEach((holder) => {
            const seed = Number.parseInt(holder.dataset.cloudSprite, 10) || 0;
            if (!spriteCache.has(seed)) {
                spriteCache.set(seed, renderSprite(37 + seed * 59));
            }
            const sprite = spriteCache.get(seed);
            if (sprite) holder.appendChild(cloneSprite(sprite));
        });
    };

    // Canvas cloneNode copies the element but not the bitmap; redraw instead.
    const cloneSprite = (source) => {
        const copy = document.createElement('canvas');
        copy.width = source.width;
        copy.height = source.height;
        copy.getContext('2d')?.drawImage(source, 0, 0);
        return copy;
    };

    /* ------------------------------------------------------------------ *
     * Scroll-linked fade
     * ------------------------------------------------------------------ */

    let ticking = false;

    const ease = (t) => t * t * (3 - 2 * t);

    // Mobile browsers can report window.innerHeight for the full layout
    // viewport (behind a collapsible toolbar) while visualViewport.height
    // reflects what's actually on screen — using the wrong one makes the
    // seam appear already partway up the fade zone on load, so the clouds
    // show up fully visible instead of fading in as the user scrolls.
    const getViewportHeight = () => window.visualViewport?.height || window.innerHeight || 1;

    const update = () => {
        ticking = false;

        const viewportHeight = getViewportHeight();
        // seam = fraction of the viewport height at which the divider sits
        // (1 = bottom edge, 0 = top edge).
        const seam = divider.getBoundingClientRect().top / viewportHeight;

        // Fade in while the seam rises from the bottom edge to 72% of the
        // viewport, stay visible through the middle, fade out between 38%
        // and 6% so the clouds have dissolved before the seam leaves.
        const fadeIn = ease(clamp01((1 - seam) / 0.28));
        const fadeOut = ease(clamp01((seam - 0.06) / 0.32));
        const fade = Math.min(fadeIn, fadeOut);

        divider.style.setProperty('--cloud-fade', fade.toFixed(3));

        if (!reduceMotionQuery.matches) {
            // Entrance: while fading in, the clouds climb from below the
            // seam up to their resting spot (each cloud scales this rise
            // with its own --cloud-rise-factor for a sense of depth).
            const entrance = ease(clamp01((1 - seam) / 0.34));
            const rise = (1 - entrance) * 130;
            divider.style.setProperty('--cloud-rise', `${rise.toFixed(1)}px`);

            // Then a light parallax lag keeps them floating.
            const shift = (seam - 0.5) * 30;
            divider.style.setProperty('--cloud-shift', `${shift.toFixed(1)}px`);
        }
    };

    const requestUpdate = () => {
        if (ticking) return;
        ticking = true;
        window.requestAnimationFrame(update);
    };

    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate, { passive: true });
    // Fires as a mobile browser's toolbar collapses/expands, which changes
    // visualViewport.height without a matching window 'resize' event.
    window.visualViewport?.addEventListener('resize', requestUpdate, { passive: true });
    update();

    // Sprite generation costs a few tens of milliseconds; keep it away
    // from the critical rendering path.
    if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(paintClouds, { timeout: 1500 });
    } else {
        window.setTimeout(paintClouds, 300);
    }
})();
