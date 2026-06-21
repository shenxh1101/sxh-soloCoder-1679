/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    container: { center: true, padding: '1rem' },
    extend: {
      colors: {
        primary: {
          50: '#eef4fb',
          100: '#d6e4f3',
          200: '#aac8e7',
          300: '#7aa5d5',
          400: '#4e82c1',
          500: '#2e63a6',
          600: '#1e4b85',
          700: '#1e3a5f',
          800: '#152a46',
          900: '#0f1e32',
        },
        accent: {
          50: '#e0f7fa',
          100: '#b3eff5',
          200: '#80e4ec',
          300: '#4dd8e2',
          400: '#26cdd9',
          500: '#00bcd4',
          600: '#00a9c0',
          700: '#0094a8',
          800: '#007e8f',
          900: '#005b66',
        },
        warning: { 500: '#ff9800', 600: '#f57c00' },
        success: { 500: '#4caf50', 600: '#388e3c' },
        danger: { 500: '#f44336', 600: '#d32f2f' },
        bg: { page: '#f0f4f8', card: '#ffffff', sidebar: '#1e3a5f' },
      },
      fontFamily: {
        sans: ['"Noto Sans SC"', '"Source Han Sans CN"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'Consolas', 'monospace'],
      },
      boxShadow: {
        card: '0 4px 20px rgba(30,58,95,0.08)',
        cardHover: '0 8px 30px rgba(30,58,95,0.14)',
        button: '0 2px 8px rgba(30,58,95,0.2)',
      },
      keyframes: {
        fadeInUp: { '0%': { opacity: 0, transform: 'translateY(10px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
        pulseRing: { '0%': { boxShadow: '0 0 0 0 rgba(0,188,212,0.5)' }, '70%': { boxShadow: '0 0 0 10px rgba(0,188,212,0)' }, '100%': { boxShadow: '0 0 0 0 rgba(0,188,212,0)' } },
        shimmer: { '0%': { backgroundPosition: '-1000px 0' }, '100%': { backgroundPosition: '1000px 0' } },
      },
      animation: {
        fadeInUp: 'fadeInUp 0.4s ease-out both',
        pulseRing: 'pulseRing 2s infinite',
        shimmer: 'shimmer 2s linear infinite',
      },
      borderRadius: { card: '12px', button: '8px' },
    },
  },
  plugins: [],
};
