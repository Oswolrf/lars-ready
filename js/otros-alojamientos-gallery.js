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

    const title = document.getElementById('gallery-modal-title');
    const image = document.getElementById('gallery-modal-image');
    const thumbs = document.getElementById('gallery-modal-thumbs');
    const count = document.getElementById('gallery-modal-count');
    const closeButton = modal.querySelector('button[data-gallery-close]');
    let activeGallery;
    let activeIndex = 0;

    const hydrateAdjacentThumbnails = () => {
        const length = activeGallery.images.length;
        const allowed = new Set([activeIndex, (activeIndex - 1 + length) % length, (activeIndex + 1) % length]);
        thumbs.querySelectorAll('button').forEach((button, index) => {
            const thumbnail = button.querySelector('img');
            if (allowed.has(index) && thumbnail && !thumbnail.src) thumbnail.src = activeGallery.images[index].thumb;
        });
    };

    const setImage = (index) => {
        activeIndex = (index + activeGallery.images.length) % activeGallery.images.length;
        const item = activeGallery.images[activeIndex];
        image.src = encodeURI(item.src);
        image.alt = item.alt;
        count.textContent = `${activeIndex + 1} / ${activeGallery.images.length}`;
        hydrateAdjacentThumbnails();
        thumbs.querySelectorAll('button').forEach((thumb, thumbIndex) => {
            thumb.setAttribute('aria-current', String(thumbIndex === activeIndex));
        });
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
            thumb.dataset.src = item.thumb;
            thumb.alt = '';
            thumb.loading = 'lazy';
            button.appendChild(thumb);
            button.addEventListener('click', () => setImage(index));
            thumbs.appendChild(button);
        });
        modal.hidden = false;
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
        if (event.key === 'ArrowLeft') setImage(activeIndex - 1);
        if (event.key === 'ArrowRight') setImage(activeIndex + 1);
    });
})();
