import { t } from './i18n.js';
import galleries from './rural-gallery-data.cjs';

(() => {

    const renderInlineCarousels = () => {
        document.querySelectorAll('[data-rural-gallery]').forEach((root) => {
            if (root.querySelector('[data-carousel]')) return;
            const key = root.dataset.ruralGallery;
            const gallery = galleries[key];
            if (!gallery) return;

            const carousel = document.createElement('div');
            carousel.className = 'rural-gallery__carousel';
            carousel.dataset.carousel = '';
            carousel.dataset.carouselPreload = 'adjacent';
            carousel.setAttribute('role', 'region');
            carousel.setAttribute('aria-label', t('Galería de {title}', { title: gallery.title }));

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
            previousButton.setAttribute('aria-label', t('Imagen anterior'));
            previousButton.textContent = '‹';
            carousel.appendChild(previousButton);

            const nextButton = document.createElement('button');
            nextButton.type = 'button';
            nextButton.className = 'rural-gallery__control rural-gallery__control--next';
            nextButton.dataset.carouselNext = '';
            nextButton.setAttribute('aria-label', t('Imagen siguiente'));
            nextButton.textContent = '›';
            carousel.appendChild(nextButton);

            const footer = document.createElement('div');
            footer.className = 'rural-gallery__footer';
            const dots = document.createElement('div');
            dots.className = 'rural-gallery__dots';
            dots.setAttribute('role', 'group');
            dots.setAttribute('aria-label', t('Seleccionar imagen'));
            gallery.images.forEach((item, index) => {
                const dot = document.createElement('button');
                dot.type = 'button';
                dot.className = 'rural-gallery__dot';
                dot.dataset.carouselSlide = String(index);
                dot.setAttribute('aria-label', t('Ver imagen {number} de {title}', { number: index + 1, title: gallery.title }));
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
