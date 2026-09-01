import { getLocale, localePath, t } from './i18n.js';

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
    const pageContext = window.location.pathname;
    const isRuralPradoPage = /\/rural-prado\/?$/i.test(pageContext);
    const sessionKey = `lar-de-vies-chat-session-v3-${getLocale()}`;
    const maxTranscriptMessages = 16;
    const maxHistoryMessages = 6;

    const sanitizeMessages = (value, limit) => {
        if (!Array.isArray(value)) return [];
        return value.slice(-limit).flatMap((message) => {
            if (!message || !['user', 'assistant'].includes(message.role)) return [];
            const text = String(message.text || message.content || '').trim().slice(0, 1200);
            if (!text) return [];
            const sources = Array.isArray(message.sources)
                ? message.sources.slice(0, 4).flatMap((source) => {
                    if (!source || typeof source.url !== 'string') return [];
                    return [{ title: String(source.title || t('Más información')).slice(0, 120), url: source.url.slice(0, 500) }];
                })
                : [];
            return [{ role: message.role, text, content: text, sources }];
        });
    };

    const readSession = () => {
        try {
            const saved = JSON.parse(window.sessionStorage.getItem(sessionKey) || 'null');
            if (!saved || saved.version !== 2) return null;
            const savedHistory = sanitizeMessages(saved.history, maxHistoryMessages)
                .map(({ role, content }) => ({ role, content }));
            const savedHistoryToken = typeof saved.historyToken === 'string'
                ? saved.historyToken.slice(0, 128)
                : '';
            return {
                open: saved.open === true,
                messages: sanitizeMessages(saved.messages, maxTranscriptMessages),
                history: savedHistory.length && !savedHistoryToken ? [] : savedHistory,
                historyToken: savedHistoryToken,
            };
        } catch (_error) {
            return null;
        }
    };

    const restoredSession = readSession();
    const history = restoredSession?.history || [];
    let historyToken = restoredSession?.historyToken || '';
    let transcript = [];
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
            const pathname = /^\/(?:en|de)(?:\/|$)/i.test(url.pathname) ? url.pathname : localePath(url.pathname);
            return { title: t(String(source.title || 'Más información')), href: `${pathname}${url.search}${url.hash}` };
        } catch (_error) {
            return null;
        }
    };

    const persistSession = () => {
        try {
            window.sessionStorage.setItem(sessionKey, JSON.stringify({
                version: 2,
                open: !panel.hidden,
                messages: transcript.slice(-maxTranscriptMessages),
                history: history.slice(-maxHistoryMessages),
                historyToken,
            }));
        } catch (_error) {
            // El chat sigue funcionando aunque el navegador bloquee sessionStorage.
        }
    };

    const addMessage = (role, text, sources = [], options = {}) => {
        const { record = true, persist = true } = options;
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
            label.textContent = t('Más información');
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
        if (record) {
            transcript.push({
                role,
                text: String(text).slice(0, 1200),
                sources: validSources.map((source) => ({ title: source.title, url: source.href })),
            });
            transcript = transcript.slice(-maxTranscriptMessages);
        }
        if (persist) persistSession();
        scrollToLatest();
        return message;
    };

    const restoreConversation = () => {
        if (restoredSession?.messages.length) {
            conversation.replaceChildren();
            restoredSession.messages.forEach((message) => {
                addMessage(message.role, message.text, message.sources, { persist: false });
            });
        } else {
            const welcome = conversation.querySelector('.chat-widget__message--assistant p')?.textContent?.trim();
            if (welcome) transcript = [{ role: 'assistant', text: welcome, sources: [] }];
        }
        suggestions.hidden = transcript.some((message) => message.role === 'user');
    };

    const setOpen = (open, manageFocus = true) => {
        panel.hidden = !open;
        trigger.setAttribute('aria-expanded', String(open));
        document.body.classList.toggle('chat-widget-open', open);
        persistSession();
        if (!manageFocus) return;
        if (open) window.setTimeout(() => input.focus(), 0);
        else trigger.focus();
    };

    const setBusy = (nextBusy) => {
        busy = nextBusy;
        input.disabled = busy;
        sendButton.disabled = busy;
        widget.classList.toggle('is-busy', busy);
        status.textContent = busy ? t('Preparando respuesta') : '';
    };

    const submit = async () => {
        const message = input.value.trim();
        if (!message || busy) return;

        const previousHistory = history.slice(-6);
        const previousHistoryToken = historyToken;
        history.push({ role: 'user', content: message });
        addMessage('user', message);
        input.value = '';
        input.style.height = '';
        suggestions.hidden = true;
        setBusy(true);

        const pendingLabel = isRuralPradoPage
            ? t('Estoy consultando la información de Rural Prado…')
            : t('Estoy consultando la información de nuestros alojamientos…');
        const pending = addMessage('assistant', pendingLabel, [], { record: false, persist: false });
        pending.classList.add('chat-widget__message--pending');
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 35000);

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message,
                    history: previousHistory,
                    historyToken: previousHistoryToken,
                    page: pageContext,
                }),
                signal: controller.signal,
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || !payload.answer) {
                throw new Error(payload.message || 'Respuesta no disponible');
            }
            pending.remove();
            historyToken = String(payload.historyToken || '').slice(0, 128);
            if (!historyToken) throw new Error('La respuesta no incluye la firma del historial');
            history.push({ role: 'assistant', content: payload.answer });
            addMessage('assistant', payload.answer, Array.isArray(payload.sources) ? payload.sources : []);
        } catch (_error) {
            pending.remove();
            history.splice(0, history.length, ...previousHistory);
            historyToken = previousHistoryToken;
            addMessage('assistant', t('No he podido conectar. Inténtalo de nuevo en un momento, o escríbenos a reservas@lardevies.com.'));
            status.textContent = t('No se ha podido obtener una respuesta');
        } finally {
            window.clearTimeout(timeout);
            setBusy(false);
            input.focus();
        }
    };

    restoreConversation();
    setOpen(restoredSession?.open === true, false);

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
