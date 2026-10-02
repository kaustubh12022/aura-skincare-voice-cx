/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        brand: ['Playfair Display', 'Georgia', 'serif'],
        sans: ['Plus Jakarta Sans', 'Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        aura: {
          bg: '#FAF8F5',
          card: '#FFFFFF',
          cardMuted: '#FCFAF7',
          border: '#EBE5DC',
          borderLight: '#F3EFEA',
          charcoal: '#1C1917',
          body: '#334155',
          muted: '#78716C',
          rose: '#C86D76',
          roseHover: '#B85F68',
          roseLight: '#FDF2F4',
          gold: '#C5A880',
          goldLight: '#F9F5EE',
        },
      },
    },
  },
  plugins: [],
};
