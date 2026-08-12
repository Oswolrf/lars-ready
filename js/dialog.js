/**
 * Accessible dialog state shared by the mobile menu, booking selector and
 * image galleries. Callers remain responsible for their visual open/closed
 * classes; this module owns focus, Escape, background inertness and scroll.
 */
(() => {
    if (window.LarDeViesDialog) return;

    const FOCUSABLE_SELECTOR = [
        'a[href]',
        'button:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])'
    ].join(',');

    let activeState;

    const getFocusableElements = (container) => (
        Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter((element) => {
            if (element.closest('[hidden], [inert]')) return false;
            const style = window.getComputedStyle(element);
            return style.visibility !== 'hidden' && style.display !== 'none';
        })
    );

    const setBackgroundInert = (dialog) => {
        const elements = Array.from(document.body.children).filter((element) => (
            element !== dialog && !element.contains(dialog)
        ));

        return elements.map((element) => {
            const previous = {
                element,
                inert: element.inert,
                ariaHidden: element.getAttribute('aria-hidden')
            };
            element.inert = true;
            element.setAttribute('aria-hidden', 'true');
            return previous;
        });
    };

    const restoreBackground = (entries) => {
        entries.forEach(({ element, inert, ariaHidden }) => {
            element.inert = inert;
            if (ariaHidden === null) {
                element.removeAttribute('aria-hidden');
            } else {
                element.setAttribute('aria-hidden', ariaHidden);
            }
        });
    };

    const deactivate = (dialog, { restoreFocus = true } = {}) => {
        if (!activeState || activeState.dialog !== dialog) return;

        document.removeEventListener('keydown', activeState.handleKeydown, true);
        restoreBackground(activeState.background);
        document.body.style.overflow = activeState.bodyOverflow;
        document.body.style.paddingRight = activeState.bodyPaddingRight;
        dialog.setAttribute('aria-hidden', 'true');

        const trigger = activeState.trigger;
        activeState = undefined;
        if (restoreFocus && trigger?.isConnected && typeof trigger.focus === 'function') {
            trigger.focus({ preventScroll: true });
        }
    };

    const activate = (dialog, {
        trigger = document.activeElement,
        initialFocus,
        onRequestClose
    } = {}) => {
        if (!dialog) return;
        if (activeState?.dialog === dialog) {
            const focusTarget = initialFocus || getFocusableElements(dialog)[0] || dialog;
            focusTarget.focus({ preventScroll: true });
            return;
        }
        if (activeState && activeState.dialog !== dialog) {
            deactivate(activeState.dialog, { restoreFocus: false });
        }

        if (!dialog.hasAttribute('tabindex')) dialog.tabIndex = -1;
        dialog.setAttribute('aria-hidden', 'false');
        const focusTarget = initialFocus || getFocusableElements(dialog)[0] || dialog;
        focusTarget.focus({ preventScroll: true });

        const state = {
            dialog,
            trigger,
            background: setBackgroundInert(dialog),
            bodyOverflow: document.body.style.overflow,
            bodyPaddingRight: document.body.style.paddingRight,
            handleKeydown: null
        };

        state.handleKeydown = (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                onRequestClose?.();
                return;
            }

            if (event.key !== 'Tab') return;
            const focusable = getFocusableElements(dialog);
            if (focusable.length === 0) {
                event.preventDefault();
                dialog.focus({ preventScroll: true });
                return;
            }

            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };

        activeState = state;
        const scrollbarWidth = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
        if (scrollbarWidth > 0) {
            const currentPadding = Number.parseFloat(window.getComputedStyle(document.body).paddingRight) || 0;
            document.body.style.paddingRight = `${currentPadding + scrollbarWidth}px`;
        }
        document.body.style.overflow = 'hidden';
        document.addEventListener('keydown', state.handleKeydown, true);
    };

    window.LarDeViesDialog = { activate, deactivate };
})();
