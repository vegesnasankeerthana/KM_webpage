/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
        },
      },
      animation: {
        'bounce-slow': 'bounce 1.2s infinite',
        'pulse-ring':  'pulseRing 2s infinite',
      },
      keyframes: {
        pulseRing: {
          '0%,100%': { boxShadow: '0 0 0 0 rgba(37,99,235,0.3)' },
          '50%':     { boxShadow: '0 0 0 16px rgba(37,99,235,0)' },
        },
      },
    },
  },
  plugins: [],
}
