(() => {
    const widget = document.querySelector('[data-chat-widget]');
    if (!widget) return;

    const trigger = widget.querySelector('[data-chat-trigger]');
    const panel = widget.querySelector('[data-chat-panel]');
    const closeButton = widget.querySelector('[data-chat-close]');
    const conversation = widget.querySelector('[data-chat-conversation]');
    const suggestions = widget.querySelector('[data-chat-suggestions]');
    const form = widget.querySelector('[data-chat-form]');
    const input = widget.querySelector('[data-chat-input]');
    const sendButton = widget.querySelector('[data-chat-send]');
    const status = widget.querySelector('[data-chat-status]');
    const endpoint = widget.dataset.chatEndpoint || '/api/chat';
    const history = [];
    let busy = false;

    document.body.classList.add('has-chat-widget');

    const scrollToLatest = () => {
        conversation.scrollTop = conversation.scrollHeight;
    };

    const safeSource = (source) => {
        try {
            const url = new URL(source.url, window.location.origin);
            if (url.origin !== window.location.origin) return null;
            if (!url.pathname.startsWith('/')) return null;
            return { title: String(source.title || 'Más información'), href: `${url.pathname}${url.search}${url.hash}` };
        } catch (_error) {
            return null;
        }
    };

    const addMessage = (role, text, sources = []) => {
        const message = document.createElement('div');
        message.className = `chat-widget__message chat-widget__message--${role}`;

        const paragraph = document.createElement('p');
        paragraph.textContent = text;
        message.appendChild(paragraph);

        const validSources = sources.map(safeSource).filter(Boolean);
        if (validSources.length) {
            const sourceList = document.createElement('div');
            sourceList.className = 'chat-widget__sources';
            const label = document.createElement('span');
            label.textContent = 'Más información';
            sourceList.appendChild(label);
            validSources.forEach((source) => {
                const link = document.createElement('a');
                link.href = source.href;
                link.textContent = source.title;
                sourceList.appendChild(link);
            });
            message.appendChild(sourceList);
        }

        conversation.appendChild(message);
        scrollToLatest();
        return message;
    };

    const setOpen = (open) => {
        panel.hidden = !open;
        trigger.setAttribute('aria-expanded', String(open));
        document.body.classList.toggle('chat-widget-open', open);
        if (open) window.setTimeout(() => input.focus(), 0);
        else trigger.focus();
    };

    const setBusy = (nextBusy) => {
        busy = nextBusy;
        input.disabled = busy;
        sendButton.disabled = busy;
        widget.classList.toggle('is-busy', busy);
        status.textContent = busy ? 'Preparando respuesta' : '';
    };

    const submit = async () => {
        const message = input.value.trim();
        if (!message || busy) return;

        const previousHistory = history.slice(-6);
        history.push({ role: 'user', content: message });
        addMessage('user', message);
        input.value = '';
        input.style.height = '';
        suggestions.hidden = true;
        setBusy(true);

        const pending = addMessage('assistant', 'Estoy consultando la información de Lar de Víes…');
        pending.classList.add('chat-widget__message--pending');
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 35000);

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message, history: previousHistory }),
                signal: controller.signal,
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || !payload.answer) {
                throw new Error(payload.message || 'Respuesta no disponible');
            }
            pending.remove();
            addMessage('assistant', payload.answer, Array.isArray(payload.sources) ? payload.sources : []);
            history.push({ role: 'assistant', content: payload.answer });
        } catch (_error) {
            pending.remove();
            addMessage('assistant', 'No he podido conectar 🤍. Inténtalo de nuevo en un momento, o escríbenos a reservas@lardevies.com.');
            status.textContent = 'No se ha podido obtener una respuesta';
        } finally {
            window.clearTimeout(timeout);
            setBusy(false);
            input.focus();
        }
    };

    trigger.addEventListener('click', () => setOpen(panel.hidden));
    closeButton.addEventListener('click', () => setOpen(false));
    form.addEventListener('submit', (event) => {
        event.preventDefault();
        submit();
    });
    input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            form.requestSubmit();
        }
    });
    input.addEventListener('input', () => {
        input.style.height = 'auto';
        input.style.height = `${Math.min(input.scrollHeight, 112)}px`;
    });
    suggestions.addEventListener('click', (event) => {
        const button = event.target.closest('[data-chat-suggestion]');
        if (!button) return;
        input.value = button.dataset.chatSuggestion;
        form.requestSubmit();
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !panel.hidden) setOpen(false);
    });
})();
