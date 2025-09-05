// Lazy Loading Implementation
class LazyImageLoader {
    constructor() {
        this.images = [];
        this.observer = null;
        this.init();
    }

    init() {
        // Create Intersection Observer
        this.observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.loadImage(entry.target);
                }
            });
        }, {
            rootMargin: '50px 0px', // Start loading 50px before the image enters the viewport
            threshold: 0.01
        });

        // Find all images with loading="lazy"
        this.images = document.querySelectorAll('img[loading="lazy"]');

        // Observe each image
        this.images.forEach(img => {
            this.observer.observe(img);
        });
    }

    loadImage(img) {
        // Get the actual image source
        const src = img.dataset.src || img.src;

        // Create a new image to preload
        const newImg = new Image();

        newImg.onload = () => {
            // Image loaded successfully
            img.src = src;
            img.classList.add('loaded');
            img.removeAttribute('loading');
            img.removeAttribute('data-src');

            // Stop observing this image
            this.observer.unobserve(img);
        };

        newImg.onerror = () => {
            // Handle loading error
            console.warn('Failed to load image:', src);
            img.classList.add('loaded'); // Still mark as loaded to remove loading animation
            this.observer.unobserve(img);
        };

        // Start loading the image
        newImg.src = src;
    }

    // Method to manually add images to lazy loading
    addImage(img) {
        if (img.hasAttribute('loading') && img.getAttribute('loading') === 'lazy') {
            this.observer.observe(img);
        }
    }

    // Method to refresh the observer (useful for dynamically added images)
    refresh() {
        this.images = document.querySelectorAll('img[loading="lazy"]');
        this.images.forEach(img => {
            if (!img.classList.contains('loaded')) {
                this.observer.observe(img);
            }
        });
    }
}

// Initialize lazy loading when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize if browser supports Intersection Observer
    if ('IntersectionObserver' in window) {
        window.lazyImageLoader = new LazyImageLoader();
    } else {
        // Fallback for older browsers - load all images immediately
        const lazyImages = document.querySelectorAll('img[loading="lazy"]');
        lazyImages.forEach(img => {
            const src = img.dataset.src || img.src;
            img.src = src;
            img.classList.add('loaded');
            img.removeAttribute('loading');
            img.removeAttribute('data-src');
        });
    }
});

// Utility function to convert regular images to lazy loading
function makeImageLazy(imgElement, src) {
    if (!imgElement) return;

    // Set loading attribute and data-src
    imgElement.setAttribute('loading', 'lazy');
    imgElement.setAttribute('data-src', src);

    // Set a placeholder src or transparent pixel
    imgElement.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

    // Add to lazy loader if it exists
    if (window.lazyImageLoader) {
        window.lazyImageLoader.addImage(imgElement);
    }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { LazyImageLoader, makeImageLazy };
}
