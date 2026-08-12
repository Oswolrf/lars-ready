/** Mejora progresiva del selector estático de alojamiento. */
(() => {
    const dialog = document.querySelector('[data-booking-dialog]');
    if (!(dialog instanceof HTMLDialogElement) || typeof dialog.showModal !== 'function') return;

    const closeButton = dialog.querySelector('[data-dialog-close]');

    const open = (trigger) => {
        if (dialog.open) return;
        dialog.__bookingTrigger = trigger;
        document.body.classList.add('booking-modal-open');
        dialog.showModal();
        closeButton?.focus({ preventScroll: true });
    };

    const close = () => {
        if (dialog.open) dialog.close();
    };

    document.addEventListener('click', (event) => {
        const trigger = event.target.closest('[data-booking-trigger]');
        if (!trigger || trigger.closest('[data-booking-dialog]')) return;
        event.preventDefault();
        open(trigger);
    });

    closeButton?.addEventListener('click', close);
    dialog.addEventListener('click', (event) => {
        if (event.target === dialog) close();
    });
    dialog.addEventListener('close', () => {
        document.body.classList.remove('booking-modal-open');
        const trigger = dialog.__bookingTrigger;
        dialog.__bookingTrigger = null;
        if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus({ preventScroll: true });
    });
})();
