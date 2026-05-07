/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── Tokens que usa toda la app ──────────────────────────────────────
        bg:              '#FBF5E5',   // lino — fondo general
        card:            '#FFFFFF',
        border:          '#E8E8E7',   // equivalente sólido de rgba(44,44,42,0.08)
        accent:          '#E76F51',   // coral — CTAs, branding
        'accent-hover':  '#B84E33',   // coral oscuro
        'accent-light':  '#FFCDB2',   // durazno — fondos suaves, badges
        text:            '#2C2C2A',   // texto principal
        muted:           '#5F5E5A',   // texto secundario
        success:         '#6B7F39',   // oliva
        error:           '#C84B31',

        // ── Tokens nuevos ───────────────────────────────────────────────────
        oliva:           '#6B7F39',
        'oliva-oscuro':  '#4A5A26',
        'oliva-claro':   '#DDE5C2',
        lino:            '#FBF5E5',
        'lino-oscuro':   '#854F0B',
        advertencia:     '#E8B547',
      },
      fontFamily: {
        // Sora en ambas stacks — el código usa font-serif en títulos
        sans:  ['Sora', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        serif: ['Sora', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
