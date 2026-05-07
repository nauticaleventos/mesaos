#!/usr/bin/env node
/**
 * agregar-fotos.js
 * Lee recetas-iniciales.json, busca una foto en Unsplash por receta,
 * y guarda el resultado en recetas-con-fotos.json.
 *
 * Uso:
 *   UNSPLASH_ACCESS_KEY=tu_key node agregar-fotos.js
 *
 * Reanudable: si recetas-con-fotos.json ya existe, salta las recetas
 * que ya tienen imagen_url.
 */

const fs   = require('fs')
const path = require('path')

const ACCESS_KEY  = process.env.UNSPLASH_ACCESS_KEY
const INPUT_FILE  = path.join(__dirname, 'recetas-iniciales.json')
const OUTPUT_FILE = path.join(__dirname, 'recetas-con-fotos.json')

if (!ACCESS_KEY) {
  console.error('\n❌  Falta la API key de Unsplash.')
  console.error('    Corre así:\n')
  console.error('    UNSPLASH_ACCESS_KEY=tu_key node agregar-fotos.js\n')
  process.exit(1)
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

async function searchUnsplash(query) {
  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`
  const res = await fetch(url, {
    headers: { Authorization: `Client-ID ${ACCESS_KEY}` },
  })

  if (res.status === 403) throw new Error('Rate limit alcanzado — espera unos minutos y vuelve a correr')
  if (!res.ok)           throw new Error(`HTTP ${res.status} al buscar "${query}"`)

  const data = await res.json()
  if (!data.results || data.results.length === 0) return null

  const photo = data.results[0]
  return {
    imagen_url: photo.urls.regular,
    imagen_credito: {
      fotografo:  photo.user.name,
      perfil_url: `${photo.user.links.html}?utm_source=mesa_os&utm_medium=referral`,
    },
  }
}

function getQueries(receta) {
  // Orden de especificidad: nombre → origen+food → tipo_comida → fallback
  return [
    receta.nombre,
    receta.origen ? `${receta.origen} food plate` : null,
    receta.tipo_comida?.[0] ? `${receta.tipo_comida[0]} food` : null,
    'latin american food',
  ].filter(Boolean)
}

function saveProgress(template, recetas) {
  fs.writeFileSync(
    OUTPUT_FILE,
    JSON.stringify({ ...template, total_recetas: recetas.length, recetas }, null, 2),
    'utf-8'
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const raw        = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8'))
  const recetas    = raw.recetas
  const total      = recetas.length
  const { recetas: _r, ...template } = raw

  // Cargar progreso previo si existe
  let resultados = []
  if (fs.existsSync(OUTPUT_FILE)) {
    const prev = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8'))
    resultados = prev.recetas ?? []
    console.log(`↩  Retomando desde progreso anterior (${resultados.filter(r => r.imagen_url !== undefined).length} ya procesadas)\n`)
  }

  const yaListas = new Set(
    resultados.filter(r => r.imagen_url !== undefined).map(r => r.nombre)
  )

  let conFoto = 0
  let sinFoto = 0

  for (let i = 0; i < total; i++) {
    const receta = recetas[i]
    const num    = String(i + 1).padStart(3, ' ')

    // Ya procesada en una corrida anterior
    if (yaListas.has(receta.nombre)) {
      const prev = resultados.find(r => r.nombre === receta.nombre)
      if (prev?.imagen_url) conFoto++
      else sinFoto++
      console.log(`Receta ${num}/${total}: ↩  ${receta.nombre}`)
      continue
    }

    // Buscar foto con fallbacks
    const queries = getQueries(receta)
    let foto      = null

    for (const query of queries) {
      try {
        foto = await searchUnsplash(query)
        if (foto) break
        await sleep(300)
      } catch (err) {
        // Si es rate limit, abortar para no perder progreso
        if (err.message.includes('Rate limit')) {
          console.error(`\n⚠️  ${err.message}`)
          saveProgress(template, resultados)
          console.log(`💾 Progreso guardado. Vuelve a correr el script para continuar.`)
          process.exit(0)
        }
        console.error(`  ⚠  Error en query "${query}": ${err.message}`)
      }
    }

    if (foto) {
      console.log(`Receta ${num}/${total}: ✓  ${receta.nombre}`)
      resultados.push({ ...receta, ...foto })
      conFoto++
    } else {
      console.log(`Receta ${num}/${total}: ✗  ${receta.nombre} (sin foto)`)
      resultados.push({ ...receta, imagen_url: null, imagen_credito: null })
      sinFoto++
    }

    // Guardar después de cada receta (reanudable)
    saveProgress(template, resultados)

    // 1 segundo entre peticiones (rate limit: 50/hora)
    if (i < total - 1) await sleep(1000)
  }

  console.log(`\n✅  Listo.`)
  console.log(`   Con foto:  ${conFoto}/${total}`)
  console.log(`   Sin foto:  ${sinFoto}/${total}`)
  console.log(`\n📄  Guardado en: ${OUTPUT_FILE}`)
  console.log(`\nPróximo paso — subir las URLs a Supabase:`)
  console.log(`   SUPABASE_URL=xxx SUPABASE_KEY=xxx node subir-fotos.js\n`)
}

main().catch(err => {
  console.error('\n❌ Error fatal:', err.message)
  process.exit(1)
})
