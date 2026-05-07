#!/usr/bin/env node
/**
 * subir-fotos.js
 * Lee recetas-con-fotos.json y actualiza imagen_url + imagen_credito
 * en la tabla `recipes` de Supabase (busca por nombre).
 *
 * Uso:
 *   SUPABASE_URL=https://xxx.supabase.co SUPABASE_KEY=tu_anon_key node subir-fotos.js
 */

const fs   = require('fs')
const path = require('path')

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_KEY
const INPUT_FILE   = path.join(__dirname, 'recetas-con-fotos.json')

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('\n❌  Faltan variables de entorno.')
  console.error('    Corre así:\n')
  console.error('    SUPABASE_URL=https://xxx.supabase.co SUPABASE_KEY=tu_key node subir-fotos.js\n')
  process.exit(1)
}

if (!fs.existsSync(INPUT_FILE)) {
  console.error('❌  No existe recetas-con-fotos.json. Corre agregar-fotos.js primero.')
  process.exit(1)
}

async function updateReceta(nombre, imagen_url, imagen_credito) {
  const url  = `${SUPABASE_URL}/rest/v1/recipes?nombre=eq.${encodeURIComponent(nombre)}&is_base_recipe=eq.true`
  const body = JSON.stringify({ imagen_url, imagen_credito })

  const res = await fetch(url, {
    method:  'PATCH',
    headers: {
      'Content-Type':  'application/json',
      'apikey':        SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Prefer':        'return=minimal',
    },
    body,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`HTTP ${res.status}: ${text}`)
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

async function main() {
  const raw     = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8'))
  const recetas = raw.recetas
  const total   = recetas.length

  console.log(`\nSubiendo fotos de ${total} recetas a Supabase...\n`)

  let ok  = 0
  let err = 0

  for (let i = 0; i < recetas.length; i++) {
    const r   = recetas[i]
    const num = String(i + 1).padStart(3, ' ')

    if (!r.imagen_url) {
      console.log(`Receta ${num}/${total}: —  ${r.nombre} (sin foto, se omite)`)
      continue
    }

    try {
      await updateReceta(r.nombre, r.imagen_url, r.imagen_credito)
      console.log(`Receta ${num}/${total}: ✓  ${r.nombre}`)
      ok++
    } catch (e) {
      console.error(`Receta ${num}/${total}: ✗  ${r.nombre} — ${e.message}`)
      err++
    }

    await sleep(100)
  }

  console.log(`\n✅  Listo. ${ok} actualizadas, ${err} errores.`)
}

main().catch(err => {
  console.error('\n❌ Error fatal:', err.message)
  process.exit(1)
})
