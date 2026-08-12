/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./*.html",
        "./villas/*.html",
        "./suites/*.html",
        "./js/**/*.js",
        "./scripts/build_static.js",
        "./src/templates/**/*.njk",
    ],
    darkMode: "class",
    theme: {
        extend: {
            colors: {
                "primary": "rgba(var(--color-primary) / <alpha-value>)",
                "primary-dark": "rgba(var(--color-primary-dark) / <alpha-value>)",
                "secondary": "rgba(var(--color-secondary) / <alpha-value>)",
                "background-light": "rgba(var(--color-background-light) / <alpha-value>)",
                "background-dark": "rgba(var(--color-background-dark) / <alpha-value>)",
                "text-slate": "#56616A",
                "stone-light": "#e6e4e0",

                // Specifics for Casona/Villas potentially used as utility
                "text-main": "#2e3b31",
                "text-muted": "#4b5a4e",
            },
            fontFamily: {
                "display": ["Inter", "sans-serif"],
                "sans": ["Lora", "serif"],
            },
            borderRadius: { "DEFAULT": "0.5rem", "lg": "1rem", "xl": "1.5rem", "2xl": "2rem", "full": "9999px" },
            backgroundImage: {
                'paper-texture': "radial-gradient(circle at 20% 10%, rgba(88, 111, 92, 0.045) 0, transparent 38%), radial-gradient(circle at 80% 90%, rgba(88, 111, 92, 0.035) 0, transparent 36%)",
            }
        },
    },
    plugins: [
        require('@tailwindcss/forms'),
        require('@tailwindcss/container-queries'),
    ],
}
