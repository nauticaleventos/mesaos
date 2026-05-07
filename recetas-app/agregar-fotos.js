#!/usr/bin/env node
/**
 * agregar-fotos.js — Busca fotos en Unsplash para cada receta y guarda recetas-con-fotos.json
 *
 * Uso:
 *   UNSPLASH_ACCESS_KEY=tu_key node agregar-fotos.js
 *
 * Reanudable: salta las recetas que ya tienen imagen_url en recetas-con-fotos.json
 */

import fs   from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname  = path.dirname(fileURLToPath(import.meta.url))
const ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY
const INPUT      = path.join(__dirname, 'recetas-iniciales.json')
const OUTPUT     = path.join(__dirname, 'recetas-con-fotos.json')

if (!ACCESS_KEY) {
  console.error('\n❌  Falta UNSPLASH_ACCESS_KEY.\n    Corre: UNSPLASH_ACCESS_KEY=tu_key node agregar-fotos.js\n')
  process.exit(1)
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function searchUnsplash(query) {
  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`
  const res = await fetch(url, { headers: { Authorization: `Client-ID ${ACCESS_KEY}` } })
  if (res.status === 403) throw new Error('Rate limit alcanzado — espera unos minutos y vuelve a correr')
  if (!res.ok)            throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  if (!data.results?.length) return null
  const p = data.results[0]
  return {
    imagen_url:     p.urls.regular,
    imagen_credito: {
      fotografo:  p.user.name,
      perfil_url: `${p.user.links.html}?utm_source=mesa_os&utm_medium=referral`,
    },
  }
}

function getQueries(r) {
  return [
    r.nombre,
    r.origen  ? `${r.origen} food plate` : null,
    r.tipo_comida?.[0] ? `${r.tipo_comida[0]} food` : null,
    'latin american food plate',
  ].filter(Boolean)
}

function save(template, recetas) {
  fs.writeFileSync(OUTPUT, JSON.stringify({ ...template, total_recetas: recetas.length, recetas }, null, 2))
}

// ── Main ─────────────────────────────────────────────────────────────────────
const raw     = JSON.parse(fs.readFileSync(INPUT, 'utf-8'))
const recetas = raw.recetas
const total   = recetas.length
const { recetas: _drop, ...template } = raw

let resultados = []
if (fs.existsSync(OUTPUT)) {
  resultados = JSON.parse(fs.readFileSync(OUTPUT, 'utf-8')).recetas ?? []
  const prev = resultados.filter(r => r.imagen_url !== undefined).length
  if (prev) console.log(`↩  Retomando (${prev} ya procesadas)\n`)
}

const yaListas = new Set(resultados.filter(r => r.imagen_url !== undefined).map(r => r.nombre))
let conFoto = resultados.filter(r => r.imagen_url).length
let sinFoto = resultados.filter(r => r.imagen_url === null).length

for (let i = 0; i < total; i++) {
  const r   = recetas[i]
  const num = String(i + 1).padStart(3, ' ')

  if (yaListas.has(r.nombre)) {
    console.log(`Receta ${num}/${total}: ↩  ${r.nombre}`)
    continue
  }

  let foto = null
  for (const q of getQueries(r)) {
    try {
      foto = await searchUnsplash(q)
      if (foto) break
      await sleep(200)
    } catch (err) {
      if (err.message.includes('Rate limit')) {
        save(template, resultados)
        console.error(`\n⚠️  ${err.message}\n💾 Progreso guardado. Vuelve a correr.\n`)
        process.exit(0)
      }
    }
  }

  if (foto) {
    console.log(`Receta ${num}/${total}: ✓  ${r.nombre}`)
    resultados.push({ ...r, ...foto })
    conFoto++
  } else {
    console.log(`Receta ${num}/${total}: ✗  ${r.nombre} (sin foto)`)
    resultados.push({ ...r, imagen_url: null, imagen_credito: null })
    sinFoto++
  }

  save(template, resultados)
  if (i < total - 1) await sleep(1000)
}

console.log(`\n✅  Con foto: ${conFoto}/${total}  |  Sin foto: ${sinFoto}/${total}`)
console.log(`📄  Guardado en: ${OUTPUT}`)
console.log(`\nPróximo paso:`)
console.log(`  SUPABASE_URL=https://sstvwynwmbnyyzircrlw.supabase.co SUPABASE_KEY=eyJ... node subir-fotos.js\n`)
