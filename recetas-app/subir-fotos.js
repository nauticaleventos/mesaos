#!/usr/bin/env node
/**
 * subir-fotos.js — Actualiza imagen_url + imagen_credito en Supabase
 *
 * Uso:
 *   SUPABASE_URL=https://xxx.supabase.co SUPABASE_KEY=anon_key node subir-fotos.js
 */

import fs   from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname      = path.dirname(fileURLToPath(import.meta.url))
const SUPABASE_URL   = process.env.SUPABASE_URL
const SUPABASE_KEY   = process.env.SUPABASE_KEY
const INPUT          = path.join(__dirname, 'recetas-con-fotos.json')

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('\n❌  Faltan variables.\n    Corre: SUPABASE_URL=xxx SUPABASE_KEY=yyy node subir-fotos.js\n')
  process.exit(1)
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function patch(nombre, imagen_url, imagen_credito) {
  const url = `${SUPABASE_URL}/rest/v1/recipes?nombre=eq.${encodeURIComponent(nombre)}&is_base_recipe=eq.true`
  const res = await fetch(url, {
    method:  'PATCH',
    headers: {
      'Content-Type':  'application/json',
      'apikey':        SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Prefer':        'return=minimal',
    },
    body: JSON.stringify({ imagen_url, imagen_credito }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`HTTP ${res.status}: ${text}`)
  }
}

const raw     = JSON.parse(fs.readFileSync(INPUT, 'utf-8'))
const recetas = raw.recetas.filter(r => r.imagen_url)
const total   = recetas.length

console.log(`\nSubiendo fotos de ${total} recetas a Supabase...\n`)

let ok = 0, err = 0

for (let i = 0; i < recetas.length; i++) {
  const r   = recetas[i]
  const num = String(i + 1).padStart(3, ' ')
  try {
    await patch(r.nombre, r.imagen_url, r.imagen_credito)
    console.log(`Receta ${num}/${total}: ✓  ${r.nombre}`)
    ok++
  } catch (e) {
    console.error(`Receta ${num}/${total}: ✗  ${r.nombre} — ${e.message}`)
    err++
  }
  await sleep(80)
}

console.log(`\n✅  ${ok} actualizadas${err ? `, ${err} errores` : ''}.\n`)
