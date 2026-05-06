/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:             '#f7faf5',
        card:           '#ffffff',
        border:         '#dde8d5',
        accent:         '#4a7c59',
        'accent-hover': '#3a6349',
        'accent-light': '#eaf3e4',
        text:           '#1c2b22',
        muted:          '#6b8573',
        success:        '#22c55e',
        error:          '#dc2626',
      },
      fontFamily: {
        serif: ['Palatino Linotype', 'Palatino', 'Book Antiqua', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}
