/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0f0f1a',
        card: '#1a1a2e',
        border: '#2a2a4a',
        accent: '#00d4aa',
        danger: '#ff6b6b',
        warn: '#f39c12',
        muted: '#6b7280',
      },
      fontFamily: {
        sans: ['-apple-system', 'SF Pro Display', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
