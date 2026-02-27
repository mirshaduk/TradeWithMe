/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./app/**/*.{js,ts,jsx,tsx,mdx}",
        "./components/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                background: "#0a0c10",
                surface: "#12151b",
                border: "#1f242f",
                primary: "#3f72af",
                buy: "#00e676",
                sell: "#ff3d00",
                textMain: "#ffffff",
                textMuted: "#a0a4b8"
            },
            animation: {
                'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            }
        },
    },
    plugins: [],
}
