import { t } from './i18n.js';

document.addEventListener('DOMContentLoaded', () => {
    const lightbox = document.getElementById('lightbox');
    const lightboxImage = document.getElementById('lightbox-img');
    const previousButton = document.getElementById('lightbox-prev');
    const nextButton = document.getElementById('lightbox-next');
    const closeButton = lightbox?.querySelector('[data-lightbox-close]');
    const thumbnailsContainer = document.getElementById('lightbox-thumbnails');
    if (!lightbox || !lightboxImage || !previousButton || !nextButton || !thumbnailsContainer) return;

    let galleryImages = [];
    let currentGalleryIndex = 0;
    let closeTimer;

    const updateNavigation = () => {
        const hasMultipleImages = galleryImages.length > 1;
        previousButton.classList.toggle('hidden', !hasMultipleImages);
        nextButton.classList.toggle('hidden', !hasMultipleImages);
    };

    const updateThumbnailHighlight = () => {
        thumbnailsContainer.querySelectorAll('button').forEach((button, index) => {
            button.setAttribute('aria-current', String(index === currentGalleryIndex));
            const image = button.querySelector('img');
            image?.classList.toggle('border-white', index === currentGalleryIndex);
            image?.classList.toggle('opacity-100', index === currentGalleryIndex);
            image?.classList.toggle('border-transparent', index !== currentGalleryIndex);
            image?.classList.toggle('opacity-60', index !== currentGalleryIndex);
        });
    };

    const showImage = (index) => {
        if (galleryImages.length === 0) return;
        currentGalleryIndex = (index + galleryImages.length) % galleryImages.length;
        lightboxImage.src = galleryImages[currentGalleryIndex];
        lightboxImage.alt = `Imagen ${currentGalleryIndex + 1} de ${galleryImages.length}`;
        updateThumbnailHighlight();
    };

    const generateThumbnails = () => {
        thumbnailsContainer.replaceChildren();
        thumbnailsContainer.classList.toggle('hidden', galleryImages.length <= 1);
        galleryImages.forEach((src, index) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.setAttribute('aria-label', t('Ver imagen {number}', { number: index + 1 }));
            button.setAttribute('aria-current', String(index === currentGalleryIndex));

            const thumbnail = document.createElement('img');
            thumbnail.src = src;
            thumbnail.alt = '';
            thumbnail.className = 'w-16 h-16 md:w-20 md:h-20 object-cover rounded cursor-pointer transition-all duration-200 border-2 flex-shrink-0';
            button.appendChild(thumbnail);
            button.addEventListener('click', () => showImage(index));
            thumbnailsContainer.appendChild(button);
        });
        updateThumbnailHighlight();
    };

    const openLightbox = (src, trigger, images = []) => {
        if (!src) return;
        window.clearTimeout(closeTimer);
        galleryImages = images.length > 0 ? images : [src];
        currentGalleryIndex = Math.max(0, galleryImages.indexOf(src));
        generateThumbnails();
        updateNavigation();
        showImage(currentGalleryIndex);
        lightbox.classList.remove('hidden');
        void lightbox.offsetWidth;
        lightbox.classList.remove('opacity-0');
        lightboxImage.classList.remove('scale-95');
        window.LarDeViesDialog?.activate(lightbox, {
            trigger,
            initialFocus: closeButton || previousButton,
            onRequestClose: closeLightbox
        });
    };

    function closeLightbox() {
        if (lightbox.classList.contains('hidden')) return;
        lightbox.classList.add('opacity-0');
        lightboxImage.classList.add('scale-95');
        window.LarDeViesDialog?.deactivate(lightbox);
        closeTimer = window.setTimeout(() => {
            lightbox.classList.add('hidden');
            lightboxImage.removeAttribute('src');
            lightboxImage.alt = '';
            galleryImages = [];
            thumbnailsContainer.replaceChildren();
            thumbnailsContainer.classList.add('hidden');
        }, 300);
    }

    document.querySelectorAll('[data-lightbox-trigger]').forEach((trigger) => {
        trigger.addEventListener('click', (event) => {
            event.preventDefault();
            const image = trigger.querySelector('img');
            if (image?.src) openLightbox(image.src, trigger);
        });
    });

    closeButton?.addEventListener('click', closeLightbox);
    previousButton.addEventListener('click', () => showImage(currentGalleryIndex - 1));
    nextButton.addEventListener('click', () => showImage(currentGalleryIndex + 1));
    lightbox.addEventListener('click', (event) => {
        if (event.target === lightbox) closeLightbox();
    });
    document.addEventListener('keydown', (event) => {
        if (lightbox.classList.contains('hidden')) return;
        if (event.key === 'ArrowRight') showImage(currentGalleryIndex + 1);
        if (event.key === 'ArrowLeft') showImage(currentGalleryIndex - 1);
    });
});
