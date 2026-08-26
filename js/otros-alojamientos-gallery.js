(() => {
    const galleries = {
        ameiro: {
            title: 'Ameiro',
            images: [
                { src: 'images/AMEIRO/AMEIRO1.jpeg', thumb: 'thumb:images/AMEIRO/AMEIRO1.jpeg', alt: 'Zona de estar y comedor de Ameiro' },
                { src: 'images/AMEIRO/AMEIRO2.jpeg', thumb: 'thumb:images/AMEIRO/AMEIRO2.jpeg', alt: 'Dormitorio de Ameiro' },
                { src: 'images/AMEIRO/AMEIRO3.jpeg', thumb: 'thumb:images/AMEIRO/AMEIRO3.jpeg', alt: 'Cocina de Ameiro' }
            ]
        },
        salgueiro: {
            title: 'Salgueiro',
            images: [
                { src: 'images/SALGUEIRO/SALGUEIRO1.jpeg', thumb: 'thumb:images/SALGUEIRO/SALGUEIRO1.jpeg', alt: 'Dormitorio de Salgueiro' },
                { src: 'images/SALGUEIRO/SALGUEIRO2.jpeg', thumb: 'thumb:images/SALGUEIRO/SALGUEIRO2.jpeg', alt: 'Baño de Salgueiro' },
                { src: 'images/SALGUEIRO/SALGUEIRO3.jpeg', thumb: 'thumb:images/SALGUEIRO/SALGUEIRO3.jpeg', alt: 'Comedor de Salgueiro' },
                { src: 'images/SALGUEIRO/SALGUEIRO4.jpeg', thumb: 'thumb:images/SALGUEIRO/SALGUEIRO4.jpeg', alt: 'Zona de estar y cocina de Salgueiro' },
                { src: 'images/SALGUEIRO/SALGUEIRO5.jpg', thumb: 'thumb:images/SALGUEIRO/SALGUEIRO5.jpg', alt: 'Dormitorio de Salgueiro' },
                { src: 'images/SALGUEIRO/SALGUEIRO6.jpg', thumb: 'thumb:images/SALGUEIRO/SALGUEIRO6.jpg', alt: 'Baño de Salgueiro' },
                { src: 'images/SALGUEIRO/SALGUEIRO7.jpg', thumb: 'thumb:images/SALGUEIRO/SALGUEIRO7.jpg', alt: 'Comedor de Salgueiro' },
                { src: 'images/SALGUEIRO/SALGUEIRO8.jpeg', thumb: 'thumb:images/SALGUEIRO/SALGUEIRO8.jpeg', alt: 'Dormitorio de Salgueiro' },
                { src: 'images/SALGUEIRO/SALGUEIRO9.jpg', thumb: 'thumb:images/SALGUEIRO/SALGUEIRO9.jpg', alt: 'Comedor de Salgueiro' },
                { src: 'images/SALGUEIRO/SALGUEIRO10.jpeg', thumb: 'thumb:images/SALGUEIRO/SALGUEIRO10.jpeg', alt: 'Zona de estar de Salgueiro' },
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
                { src: 'images/Castañeiro/Castañeiro 2.jpeg', thumb: 'thumb:images/Castañeiro/Castañeiro 2.jpeg', alt: 'Dormitorio y zona de lectura de Castañeiro' },
                { src: 'images/Castañeiro/Castañeiro 4.jpeg', thumb: 'thumb:images/Castañeiro/Castañeiro 4.jpeg', alt: 'Cocina y comedor de Castañeiro' },
                { src: 'images/Castañeiro/WhatsApp Image 2026-08-05 at 22.20.28.jpeg', thumb: 'thumb:images/Castañeiro/WhatsApp Image 2026-08-05 at 22.20.28.jpeg', alt: 'Zona de estar y comedor de Castañeiro' },
                { src: 'images/Castañeiro/Castañeiro 5.jpeg', thumb: 'thumb:images/Castañeiro/Castañeiro 5.jpeg', alt: 'Comedor con vistas de Castañeiro' }
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
})();
