/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        dark: {
          900: '#0a0a0f',
          800: '#0f0f1a',
          700: '#141420',
          600: '#1a1a2e',
          500: '#16213e',
        },
        accent: {
          DEFAULT: '#e11d48',
          hover: '#be123c',
          light: '#fb7185',
        },
        gold: '#f59e0b',
      },
      fontFamily: {
        sans: ['Sora', 'sans-serif'],
        display: ['Bebas Neue', 'cursive'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'pulse-slow': 'pulse 3s infinite',
        'shimmer': 'shimmer 1.5s infinite',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
        slideUp: { '0%': { transform: 'translateY(20px)', opacity: 0 }, '100%': { transform: 'translateY(0)', opacity: 1 } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
      },
    },
  },
  plugins: [],
};
