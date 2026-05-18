/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Pacer brand palette
        accent:  '#f5a623', // amber — CTAs, highlights, route line
        'accent-dim': '#d4901d',
        bg:      '#0f0f0f', // true black — main background
        surface: '#1c1c1e', // elevated cards / overlays
        muted:   '#3a3a3c', // borders, dividers
        faint:   '#888888', // secondary text, labels
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.25rem',
      },
    },
  },
  plugins: [],
}
