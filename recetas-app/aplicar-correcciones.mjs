/**
 * aplicar-correcciones.mjs
 *
 * Lee el Excel auditado y aplica las correcciones de tipo_componente a Supabase.
 *
 * Uso:
 *   node scripts/aplicar-correcciones.mjs              # dry-run
 *   node scripts/aplicar-correcciones.mjs --apply      # aplica en BD
 */

import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DRY_RUN   = !process.argv.includes('--apply')

// Leer .env
const envPath = join(__dirname, '../.env')
try {
  readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [k, ...rest] = line.split('=')
    if (k && rest.length && !process.env[k.trim()]) process.env[k.trim()] = rest.join('=').trim()
  })
} catch {}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''

const sb = createClient(SUPABASE_URL, SUPABASE_KEY)

const VALID_TC = new Set([
  'proteina_principal','guarnicion','ensalada','salsa',
  'vinagreta','plato_unico','postre','bebida','merienda'
])

function normalizar(tc) {
  if (!tc) return null
  const t = tc.toString().trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')  // quitar acentos
    .replace(/\s+/g, '_')
  if (VALID_TC.has(t)) return t
  // Aliases comunes
  const alias = {
    'proteina': 'proteina_principal',
    'protein':  'proteina_principal',
    'garnicion': 'guarnicion',
    'guarnicion': 'guarnicion',
    'ensalada':  'ensalada',
    'salsa':     'salsa',
    'plato_unico': 'plato_unico',
    'platounico':  'plato_unico',
    'postre':    'postre',
    'bebida':    'bebida',
    'merienda':  'merienda',
  }
  return alias[t] ?? null
}

async function main() {
  console.log(DRY_RUN
    ? '🔍 DRY-RUN — mostrando cambios sin aplicar. Usá --apply para confirmar.\n'
    : '✏️  APPLY — aplicando correcciones en Supabase.\n'
  )

  // Leer Excel
  const xlsxPath = join(__dirname, '../recetas-app/recetas-auditoria2.xlsx')
  const wb  = XLSX.readFile(xlsxPath)
  const ws  = wb.Sheets['Recetas']
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 })

  // Cargar tipo_componente original desde BD
  const { data: originales } = await sb
    .from('recipes').select('id, tipo_componente, nombre')
  const origMap = new Map((originales ?? []).map(r => [r.id, r.tipo_componente]))

  // Detectar cambios
  const cambios    = []
  const eliminados = []
  const errores    = []

  for (const row of rows.slice(1)) {
    const id     = row[3]?.toString().trim()
    const nombre = row[4]?.toString().trim()
    const tcExcel = row[5]?.toString().trim()
    const accion  = row[1]?.toString().trim().toUpperCase()

    if (!id || !nombre) continue

    if (accion === 'ELIMINAR') {
      eliminados.push({ id, nombre })
      continue
    }

    const tcNorm = normalizar(tcExcel)
    const tcOrig = origMap.get(id)

    if (tcNorm && tcOrig && tcNorm !== tcOrig) {
      cambios.push({ id, nombre, de: tcOrig, a: tcNorm })
    } else if (tcExcel && !tcNorm) {
      errores.push({ id, nombre, valor: tcExcel })
    }
  }

  console.log(`📊 Cambios detectados: ${cambios.length}`)
  console.log(`🗑️  Eliminaciones: ${eliminados.length}`)
  console.log(`⚠️  Valores no reconocidos: ${errores.length}`)

  // Distribución
  const dist = {}
  cambios.forEach(c => { dist[c.a] = (dist[c.a] ?? 0) + 1 })
  console.log('\nDistribución de cambios:')
  Object.entries(dist).sort((a,b)=>b[1]-a[1]).forEach(([k,v]) => console.log(`  → ${k}: ${v}`))

  if (errores.length) {
    console.log('\nValores no reconocidos (no se aplican):')
    errores.forEach(e => console.log(`  "${e.valor}" | ${e.nombre}`))
  }

  if (DRY_RUN) {
    console.log('\nMuestra de cambios a aplicar:')
    cambios.slice(0, 20).forEach(c => console.log(`  [${c.de}] → [${c.a}] | ${c.nombre}`))
    console.log('\nCorré con --apply para confirmar.')
    return
  }

  // ── Aplicar cambios en lotes ────────────────────────────────────────────────
  console.log('\nAplicando...')
  let ok = 0, fail = 0

  // Agrupar por tipo_componente destino para hacer menos queries
  const porTipo = new Map()
  for (const c of cambios) {
    if (!porTipo.has(c.a)) porTipo.set(c.a, [])
    porTipo.get(c.a).push(c.id)
  }

  for (const [tc, ids] of porTipo.entries()) {
    // Lotes de 50
    for (let i = 0; i < ids.length; i += 50) {
      const lote = ids.slice(i, i + 50)
      const { error } = await sb
        .from('recipes')
        .update({ tipo_componente: tc })
        .in('id', lote)
      if (error) {
        console.error(`  ❌ Error en lote ${tc}:`, error.message)
        fail += lote.length
      } else {
        ok += lote.length
        process.stdout.write(`\r  ✅ ${ok}/${cambios.length} actualizadas...`)
      }
    }
  }

  // Eliminaciones
  for (const e of eliminados) {
    const { error } = await sb.from('recipes').delete().eq('id', e.id)
    if (error) {
      console.error(`\n  ❌ Error eliminando ${e.nombre}:`, error.message)
      fail++
    } else {
      ok++
      console.log(`\n  🗑️  Eliminada: ${e.nombre}`)
    }
  }

  console.log(`\n\n🎉 Listo.`)
  console.log(`  Actualizadas: ${ok}`)
  console.log(`  Errores: ${fail}`)
  console.log(`  No reconocidos (sin cambio): ${errores.length}`)
}

main().catch(e => { console.error(e); process.exit(1) })
