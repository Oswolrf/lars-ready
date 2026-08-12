/**
 * Strict Lazy Loading
 * prevents browsers from eager-loading images by using data-src
 */
document.addEventListener("DOMContentLoaded", function () {
    const lazyImages = [].slice.call(document.querySelectorAll("img.lazy-strict"));

    if ("IntersectionObserver" in window) {
        let lazyImageObserver = new IntersectionObserver(function (entries, observer) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    let lazyImage = entry.target;
                    const picture = lazyImage.closest("picture");
                    if (picture) {
                        picture.querySelectorAll("source[data-srcset]").forEach(function (source) {
                            source.srcset = source.dataset.srcset;
                        });
                    }
                    if (lazyImage.dataset.src) {
                        lazyImage.src = lazyImage.dataset.src;
                    }
                    if (lazyImage.dataset.srcset) {
                        lazyImage.srcset = lazyImage.dataset.srcset;
                    }
                    lazyImage.classList.remove("opacity-0");
                    lazyImage.classList.add("opacity-100");
                    lazyImageObserver.unobserve(lazyImage);
                }
            });
        }, {
            rootMargin: "200px 0px" // Start loading 200px before element is visible
        });

        lazyImages.forEach(function (lazyImage) {
            lazyImageObserver.observe(lazyImage);
        });
    } else {
        // Fallback for very old browsers
        lazyImages.forEach(function (lazyImage) {
            const picture = lazyImage.closest("picture");
            if (picture) {
                picture.querySelectorAll("source[data-srcset]").forEach(function (source) {
                    source.srcset = source.dataset.srcset;
                });
            }
            if (lazyImage.dataset.src) {
                lazyImage.src = lazyImage.dataset.src;
            }
            if (lazyImage.dataset.srcset) {
                lazyImage.srcset = lazyImage.dataset.srcset;
            }
            lazyImage.classList.remove("opacity-0");
        });
    }
});
