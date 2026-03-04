/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'Segoe UI', 'sans-serif']
      },
      colors: {
        lol: {
          gold: '#C8AA6E',
          'gold-light': '#F0E6D3',
          blue: '#0BC4E3',
          dark: '#010A13',
          'dark-2': '#0A1428',
          'panel': '#0D1117'
        }
      }
    }
  },
  plugins: []
}
