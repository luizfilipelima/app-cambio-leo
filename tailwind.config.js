/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cambio: {
          bg: '#0F0F0F',
          card: '#1E1E1E',
          input: '#262730',
          accent: '#2E7D32',
          text: '#FFFFFF',
          secondary: '#B3B3B3'
        }
      }
    },
  },
  plugins: [],
}
