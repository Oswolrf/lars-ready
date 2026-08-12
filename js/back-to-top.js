/** Threshold-based back-to-top control with one rAF-batched scroll read. */
document.addEventListener('DOMContentLoaded', () => {
    const button = document.getElementById('back-to-top');
    if (!button) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let framePending = false;
    let visible;

    const render = () => {
        framePending = false;
        const nextVisible = window.scrollY > 600;
        if (nextVisible === visible) return;
        visible = nextVisible;
        button.classList.toggle('opacity-0', !visible);
        button.classList.toggle('pointer-events-none', !visible);
        button.classList.toggle('opacity-100', visible);
        button.classList.toggle('pointer-events-auto', visible);
        button.setAttribute('aria-hidden', String(!visible));
        button.tabIndex = visible ? 0 : -1;
    };

    const scheduleRender = () => {
        if (framePending) return;
        framePending = true;
        window.requestAnimationFrame(render);
    };

    window.addEventListener('scroll', scheduleRender, { passive: true });
    window.addEventListener('pageshow', scheduleRender);
    button.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: reduceMotion.matches ? 'auto' : 'smooth'
        });
    });

    render();
});
