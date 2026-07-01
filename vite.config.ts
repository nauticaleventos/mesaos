import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'

// Elimina atributo crossorigin del HTML generado — fix para Safari móvil
function removeCrossorigin(): Plugin {
  return {
    name: 'remove-crossorigin',
    transformIndexHtml(html) {
      return html
        .replace(/<script type="module" crossorigin/g, '<script type="module"')
        .replace(/<link rel="stylesheet" crossorigin/g, '<link rel="stylesheet"')
    },
  }
}

// Inyecta el script de verificación de Google AdSense SOLO en build de producción
// (Vercel). `apply: 'build'` => no corre en `npm run dev` = "modo desarrollo sin AdSense".
// Se inserta como tag literal en el <head> para que quede en el HTML estático y sea
// visible en view-source (que es lo que lee el crawler de Google para verificar).
function injectAdsense(): Plugin {
  const ADSENSE_CLIENT = 'ca-pub-6667486885009649'
  return {
    name: 'inject-adsense',
    apply: 'build',
    transformIndexHtml(html) {
      const tag = `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}" crossorigin="anonymous"></script>`
      return html.replace('</head>', `    ${tag}\n  </head>`)
    },
  }
}

export default defineConfig({
  plugins: [react(), removeCrossorigin(), injectAdsense()],
  optimizeDeps: {
    include: ['date-holidays'],
  },
})
