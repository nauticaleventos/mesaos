/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:             '#0c0b09',
        card:           '#161412',
        border:         '#252220',
        accent:         '#e8a020',
        'accent-hover': '#f0b030',
        text:           '#f0ebe0',
        muted:          '#7a7060',
        success:        '#22c55e',
        error:          '#ef4444',
      },
      fontFamily: {
        serif: ['Palatino Linotype', 'Palatino', 'Book Antiqua', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}
