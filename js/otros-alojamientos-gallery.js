(() => {
    const modal = document.getElementById('gallery-modal');
    if (!modal) return;

    const galleries = {
        ameiro: {
            title: 'Ameiro',
            images: [
                { src: 'images/AMEIRO/AMEIRO1.jpeg', thumb: 'thumb:images/AMEIRO/AMEIRO1.jpeg', alt: 'Zona de estar y cocina de Ameiro' },
                { src: 'images/AMEIRO/AMEIRO2.jpeg', thumb: 'thumb:images/AMEIRO/AMEIRO2.jpeg', alt: 'Cocina y vistas de Ameiro' }
            ]
        },
        salgueiro: {
            title: 'Salgueiro',
            images: [
                { src: 'images/SALGUEIRO/SALGUEIRO1.jpg', thumb: 'thumb:images/SALGUEIRO/SALGUEIRO1.jpg', alt: 'Dormitorio de Salgueiro' },
                { src: 'images/SALGUEIRO/SALGUEIRO2.jpg', thumb: 'thumb:images/SALGUEIRO/SALGUEIRO2.jpg', alt: 'Baño de Salgueiro' },
                { src: 'images/SALGUEIRO/SALGUEIRO3.jpg', thumb: 'thumb:images/SALGUEIRO/SALGUEIRO3.jpg', alt: 'Comedor de Salgueiro' },
                { src: 'images/SALGUEIRO/SALGUEIRO4.jpg', thumb: 'thumb:images/SALGUEIRO/SALGUEIRO4.jpg', alt: 'Zona de estar de Salgueiro' },
                { src: 'images/SALGUEIRO/SALGUEIRO5.jpg', thumb: 'thumb:images/SALGUEIRO/SALGUEIRO5.jpg', alt: 'Dormitorio de Salgueiro' },
                { src: 'images/SALGUEIRO/SALGUEIRO6.jpg', thumb: 'thumb:images/SALGUEIRO/SALGUEIRO6.jpg', alt: 'Espejo y ducha del baño de Salgueiro' },
                { src: 'images/SALGUEIRO/SALGUEIRO7.jpg', thumb: 'thumb:images/SALGUEIRO/SALGUEIRO7.jpg', alt: 'Detalle del comedor de Salgueiro' },
                { src: 'images/SALGUEIRO/SALGUEIRO8.jpg', thumb: 'thumb:images/SALGUEIRO/SALGUEIRO8.jpg', alt: 'Dormitorio de Salgueiro' },
                { src: 'images/SALGUEIRO/SALGUEIRO9.jpg', thumb: 'thumb:images/SALGUEIRO/SALGUEIRO9.jpg', alt: 'Mesa del comedor de Salgueiro' },
                { src: 'images/SALGUEIRO/SALGUEIRO10.jpg', thumb: 'thumb:images/SALGUEIRO/SALGUEIRO10.jpg', alt: 'Zona de estar de Salgueiro' },
                { src: 'images/SALGUEIRO/SALGUEIRO11.jpg', thumb: 'thumb:images/SALGUEIRO/SALGUEIRO11.jpg', alt: 'Dormitorio de Salgueiro' }
            ]
        },
        bidueira: {
            title: 'Bidueira',
            images: [
                { src: 'images/BIDUEIRA/BIDUEIRA 1.jpeg', thumb: 'thumb:images/BIDUEIRA/BIDUEIRA 1.jpeg', alt: 'Dormitorio de Bidueira' },
                { src: 'images/BIDUEIRA/BIDUEIRA 2.jpeg', thumb: 'thumb:images/BIDUEIRA/BIDUEIRA 2.jpeg', alt: 'Zona de estar y cocina de Bidueira' },
                { src: 'images/BIDUEIRA/BIDUEIRA3.jpeg', thumb: 'thumb:images/BIDUEIRA/BIDUEIRA3.jpeg', alt: 'Detalle interior de Bidueira' }
            ]
        },
        carballo: {
            title: 'Carballo',
            images: [
                { src: 'images/CARBALLO/CARBALLO1.jpeg', thumb: 'thumb:images/CARBALLO/CARBALLO1.jpeg', alt: 'Dormitorio de Carballo' },
                { src: 'images/CARBALLO/CARBALLO2.jpeg', thumb: 'thumb:images/CARBALLO/CARBALLO2.jpeg', alt: 'Interior de Carballo' },
                { src: 'images/CARBALLO/CARBALLO3.jpeg', thumb: 'thumb:images/CARBALLO/CARBALLO3.jpeg', alt: 'Detalle del dormitorio de Carballo' },
                { src: 'images/CARBALLO/CARBALLO4.jpeg', thumb: 'thumb:images/CARBALLO/CARBALLO4.jpeg', alt: 'Detalle decorativo de Carballo' }
            ]
        },
        castaneiro: {
            title: 'Castañeiro',
            images: [
                { src: 'images/Castañeiro/Castaéiro 3.jpeg', thumb: 'thumb:images/Castañeiro/Castaéiro 3.jpeg', alt: 'Dormitorio de Castañeiro' },
                { src: 'images/Castañeiro/Castañeiro 2.jpeg', thumb: 'thumb:images/Castañeiro/Castañeiro 2.jpeg', alt: 'Interior de Castañeiro' },
                { src: 'images/Castañeiro/Castañeiro 4.jpeg', thumb: 'thumb:images/Castañeiro/Castañeiro 4.jpeg', alt: 'Detalle del dormitorio de Castañeiro' },
                { src: 'images/Castañeiro/WhatsApp Image 2026-08-05 at 22.20.28.jpeg', thumb: 'thumb:images/Castañeiro/WhatsApp Image 2026-08-05 at 22.20.28.jpeg', alt: 'Detalle interior de Castañeiro' }
            ]
        }
    };

    const renderInlineCarousels = () => {
        document.querySelectorAll('[data-rural-gallery]').forEach((root) => {
            const key = root.dataset.ruralGallery;
            const gallery = galleries[key];
            if (!gallery) return;

            const carousel = document.createElement('div');
            carousel.className = 'rural-gallery__carousel';
            carousel.dataset.carousel = '';
            carousel.dataset.galleryKey = key;
            carousel.dataset.carouselPreload = 'adjacent';
            carousel.setAttribute('role', 'region');
            carousel.setAttribute('aria-label', `Galería de ${gallery.title}`);

            const track = document.createElement('div');
            track.className = 'rural-gallery__track';
            track.dataset.carouselTrack = '';
            track.setAttribute('aria-live', 'polite');
            gallery.images.forEach((item, index) => {
                const slide = document.createElement('div');
                slide.className = 'rural-gallery__slide';
                const image = document.createElement('img');
                image.className = 'stay-image';
                image.src = encodeURI(item.src);
                image.alt = item.alt;
                image.loading = index === 0 ? 'eager' : 'lazy';
                slide.appendChild(image);
                track.appendChild(slide);
            });
            carousel.appendChild(track);

            const previousButton = document.createElement('button');
            previousButton.type = 'button';
            previousButton.className = 'rural-gallery__control rural-gallery__control--prev';
            previousButton.dataset.carouselPrev = '';
            previousButton.setAttribute('aria-label', 'Imagen anterior');
            previousButton.textContent = '‹';
            carousel.appendChild(previousButton);

            const nextButton = document.createElement('button');
            nextButton.type = 'button';
            nextButton.className = 'rural-gallery__control rural-gallery__control--next';
            nextButton.dataset.carouselNext = '';
            nextButton.setAttribute('aria-label', 'Imagen siguiente');
            nextButton.textContent = '›';
            carousel.appendChild(nextButton);

            const openButton = document.createElement('button');
            openButton.type = 'button';
            openButton.className = 'rural-gallery__open';
            openButton.dataset.galleryOpen = key;
            openButton.setAttribute('aria-label', `Abrir galería completa de ${gallery.title}`);
            openButton.textContent = 'Ver fotos';
            carousel.appendChild(openButton);

            const footer = document.createElement('div');
            footer.className = 'rural-gallery__footer';
            const dots = document.createElement('div');
            dots.className = 'rural-gallery__dots';
            dots.setAttribute('role', 'group');
            dots.setAttribute('aria-label', 'Seleccionar imagen');
            gallery.images.forEach((item, index) => {
                const dot = document.createElement('button');
                dot.type = 'button';
                dot.className = 'rural-gallery__dot';
                dot.dataset.carouselSlide = String(index);
                dot.setAttribute('aria-label', `Ver imagen ${index + 1} de ${gallery.title}`);
                dot.setAttribute('aria-current', String(index === 0));
                dots.appendChild(dot);
            });
            footer.appendChild(dots);
            const counter = document.createElement('span');
            counter.className = 'rural-gallery__count';
            counter.dataset.carouselCount = '';
            counter.textContent = `1 / ${gallery.images.length}`;
            footer.appendChild(counter);
            carousel.appendChild(footer);
            root.replaceChildren(carousel);
        });
    };

    renderInlineCarousels();

    const title = document.getElementById('gallery-modal-title');
    const image = document.getElementById('gallery-modal-image');
    const thumbs = document.getElementById('gallery-modal-thumbs');
    const count = document.getElementById('gallery-modal-count');
    const closeButton = modal.querySelector('button[data-gallery-close]');
    let activeGallery;
    let activeIndex = 0;

    const getThumbnailSource = (item) => {
        if (!item?.thumb || item.thumb.startsWith('thumb:')) return item?.src || '';
        return item.thumb;
    };

    const hydrateAdjacentThumbnails = () => {
        const length = activeGallery.images.length;
        const allowed = new Set([activeIndex, (activeIndex - 1 + length) % length, (activeIndex + 1) % length]);
        thumbs.querySelectorAll('button').forEach((button, index) => {
            const thumbnail = button.querySelector('img');
            if (allowed.has(index) && thumbnail && !thumbnail.getAttribute('src')) {
                thumbnail.src = encodeURI(getThumbnailSource(activeGallery.images[index]));
            }
        });
    };

    const setImage = (index) => {
        activeIndex = (index + activeGallery.images.length) % activeGallery.images.length;
        const item = activeGallery.images[activeIndex];
        image.removeAttribute('srcset');
        image.removeAttribute('sizes');
        image.src = encodeURI(item.src);
        image.alt = item.alt;
        image.loading = 'eager';
        image.decoding = 'async';
        count.textContent = `${activeIndex + 1} / ${activeGallery.images.length}`;
        hydrateAdjacentThumbnails();
        thumbs.querySelectorAll('button').forEach((thumb, thumbIndex) => {
            thumb.setAttribute('aria-current', String(thumbIndex === activeIndex));
        });
        thumbs.querySelector('button[aria-current="true"]')?.scrollIntoView({ block: 'nearest', inline: 'center' });
    };

    const openGallery = (key, trigger) => {
        activeGallery = galleries[key];
        if (!activeGallery) return;
        title.textContent = activeGallery.title;
        thumbs.replaceChildren();
        activeGallery.images.forEach((item, index) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'gallery-thumb';
            button.setAttribute('aria-label', `Ver imagen ${index + 1} de ${activeGallery.title}`);
            button.setAttribute('aria-current', 'false');
            const thumb = document.createElement('img');
            thumb.alt = '';
            thumb.loading = 'eager';
            thumb.src = encodeURI(getThumbnailSource(item));
            button.appendChild(thumb);
            button.addEventListener('click', () => setImage(index));
            thumbs.appendChild(button);
        });
        modal.hidden = false;
        modal.dataset.galleryKey = key;
        document.body.classList.add('gallery-open');
        setImage(0);
        window.LarDeViesDialog?.activate(modal, {
            trigger,
            initialFocus: closeButton,
            onRequestClose: closeGallery
        });
    };

    function closeGallery() {
        if (modal.hidden) return;
        modal.hidden = true;
        document.body.classList.remove('gallery-open');
        window.LarDeViesDialog?.deactivate(modal);
    }

    document.querySelectorAll('[data-gallery-open]').forEach((trigger) => {
        trigger.addEventListener('click', () => openGallery(trigger.dataset.galleryOpen, trigger));
    });

    modal.addEventListener('click', (event) => {
        if (event.target.closest('[data-gallery-close]')) closeGallery();
    });
    modal.querySelector('[data-gallery-prev]').addEventListener('click', () => setImage(activeIndex - 1));
    modal.querySelector('[data-gallery-next]').addEventListener('click', () => setImage(activeIndex + 1));

    document.addEventListener('keydown', (event) => {
        if (modal.hidden) return;
        if (event.key === 'ArrowLeft') {
            event.preventDefault();
            setImage(activeIndex - 1);
        }
        if (event.key === 'ArrowRight') {
            event.preventDefault();
            setImage(activeIndex + 1);
        }
        if (event.key === 'Home') {
            event.preventDefault();
            setImage(0);
        }
        if (event.key === 'End') {
            event.preventDefault();
            setImage(activeGallery.images.length - 1);
        }
    });
})();
