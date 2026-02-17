/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        gt: {
          green:     '#A2AD1A',
          'green-dark': '#8A9416',
          'green-darker': '#5A612A',
          'green-light': '#C5CE5C',
          'green-50': '#F7F8EC',
          'green-100': '#EEF0D4',
          orange:    '#E06D00',
          'orange-dark': '#C05D00',
          gray:      '#555555',
          'gray-mid':'#CCCCCC',
          'gray-light':'#E5E5E5',
          blue:      '#009BCE',
          red:       '#AD1E15',
        },
      },
    },
  },
  plugins: [],
}