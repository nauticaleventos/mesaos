/**
 * actualizar-recetas.js
 *
 * Lee recetas-mesaos-actualizadas.json y sincroniza con Supabase:
 * - Si el nombre ya existe → UPDATE (nombre, ingredientes, tipo_componente, etc.)
 * - Si no existe → INSERT (con visibility='public', is_active_for_menu=true, source='semilla')
 * - Procesa en lotes de 50
 *
 * Uso:
 *   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node recetas-app/actualizar-recetas.js
 *   Agregar --apply para escribir en BD (sin la flag solo hace dry-run)
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DRY_RUN   = !process.argv.includes('--apply')

const supabase = createClient(
  process.env.SUPABASE_URL        ?? '',
  process.env.SUPABASE_SERVICE_KEY ?? '',
)

// ── Leer JSON ─────────────────────────────────────────────────────────────────
const raw  = readFileSync(join(__dirname, 'recetas-mesaos-actualizadas.json'), 'utf8')
const data = JSON.parse(raw)
const recetas = Array.isArray(data) ? data : (data.recetas ?? Object.values(data)[0])

console.log(DRY_RUN
  ? `\n🔍 DRY-RUN — ningún cambio se escribirá. Agregá --apply para confirmar.\n`
  : `\n✏️  APPLY — escribiendo cambios en Supabase.\n`
)
console.log(`📦 Recetas en JSON: ${recetas.length}\n`)

// ── Helpers ───────────────────────────────────────────────────────────────────
function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

/** Construye el objeto a guardar en BD a partir de la receta del JSON */
function buildRow(r, existingId) {
  const row = {
    nombre:                    r.nombre,
    descripcion_corta:         r.descripcion_corta ?? null,
    origen:                    r.origen ?? null,
    tipo_comida:               r.tipo_comida ?? [],
    tipo_componente:           r.tipo_componente ?? null,
    ocasion:                   r.ocasion ?? null,
    tiempo_total_min:          r.tiempo_total_min ?? null,
    tiempo_preparacion_min:    r.tiempo_preparacion_min ?? null,
    tiempo_coccion_min:        r.tiempo_coccion_min ?? null,
    dificultad:                r.dificultad ?? null,
    porciones:                 r.porciones ?? null,
    costo_estimado:            r.costo_estimado ?? null,
    ingredientes:              r.ingredientes ?? [],
    pasos:                     r.pasos ?? [],
    tags:                      r.tags ?? [],
    info_nutricional_aprox:    r.info_nutricional_aprox ?? null,
    perfiles:                  r.perfiles ?? {},
    filtros_nutricionales:     r.filtros_nutricionales ?? {},
  }

  if (existingId) {
    // UPDATE: solo los campos del JSON, preservar id y metadatos de BD
    return { id: existingId, ...row }
  } else {
    // INSERT: campos adicionales de configuración
    return {
      ...row,
      visibility:            'public',
      is_active_for_menu:    true,
      is_base_recipe:        true,
      source:                'semilla',
      created_by_user_id:    null,
      created_in_family_id:  null,
    }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  // 1. Cargar todos los nombres existentes en BD (para lookup rápido)
  console.log('🔎 Cargando nombres existentes en BD...')
  let existingMap = new Map()  // nombre → id
  let from = 0
  const PAGE = 1000

  while (true) {
    const { data: page, error } = await supabase
      .from('recipes')
      .select('id, nombre')
      .range(from, from + PAGE - 1)

    if (error) { console.error('Error cargando BD:', error); process.exit(1) }
    if (!page || page.length === 0) break
    for (const r of page) existingMap.set(r.nombre.trim(), r.id)
    if (page.length < PAGE) break
    from += PAGE
  }

  console.log(`   → ${existingMap.size} recetas en BD\n`)

  // 2. Clasificar cada receta del JSON
  const toUpdate = []
  const toInsert = []

  for (const r of recetas) {
    const existingId = existingMap.get(r.nombre?.trim())
    if (existingId) {
      toUpdate.push(buildRow(r, existingId))
    } else {
      toInsert.push(buildRow(r, null))
    }
  }

  console.log(`📝 A actualizar: ${toUpdate.length}`)
  console.log(`➕ A insertar:   ${toInsert.length}`)
  console.log()

  if (DRY_RUN) {
    // Mostrar muestra
    if (toUpdate.length) {
      console.log('Muestra de actualizaciones:')
      toUpdate.slice(0, 5).forEach(r => console.log(`  ✏️  [UPDATE] ${r.nombre}  tipo_componente=${r.tipo_componente}`))
    }
    if (toInsert.length) {
      console.log('\nMuestra de inserciones:')
      toInsert.slice(0, 5).forEach(r => console.log(`  ➕ [INSERT] ${r.nombre}  tipo_componente=${r.tipo_componente}`))
    }
    console.log('\nAgregá --apply para confirmar los cambios.')
    return
  }

  // 3. Ejecutar UPDATE en lotes
  let updated = 0, updateErrors = 0
  if (toUpdate.length > 0) {
    const lotes = chunk(toUpdate, 50)
    process.stdout.write('Actualizando')
    for (const lote of lotes) {
      const { error } = await supabase.from('recipes').upsert(lote, { onConflict: 'id' })
      if (error) {
        updateErrors++
        console.error('\nError en lote UPDATE:', error.message)
      } else {
        updated += lote.length
        process.stdout.write('.')
      }
    }
    console.log(` ✅ ${updated} actualizadas, ${updateErrors} lotes con error`)
  }

  // 4. Ejecutar INSERT en lotes
  let inserted = 0, insertErrors = 0
  if (toInsert.length > 0) {
    const lotes = chunk(toInsert, 50)
    process.stdout.write('Insertando')
    for (const lote of lotes) {
      const { error } = await supabase.from('recipes').insert(lote)
      if (error) {
        insertErrors++
        console.error('\nError en lote INSERT:', error.message)
        // Intentar de a uno para identificar cuál falla
        for (const r of lote) {
          const { error: e2 } = await supabase.from('recipes').insert(r)
          if (e2) console.error(`  ❌ ${r.nombre}: ${e2.message}`)
          else { inserted++; process.stdout.write('.') }
        }
      } else {
        inserted += lote.length
        process.stdout.write('.')
      }
    }
    console.log(` ✅ ${inserted} insertadas, ${insertErrors} lotes con error`)
  }

  console.log(`\n── Resumen ──────────────────────────────────────────`)
  console.log(`✅ Actualizadas: ${updated}`)
  console.log(`➕ Insertadas:   ${inserted}`)
  const totalErrores = updateErrors + insertErrors
  if (totalErrores > 0) console.log(`❌ Lotes con error: ${totalErrores}`)
  else console.log(`🎉 Sin errores`)
}

main().catch(err => { console.error(err); process.exit(1) })
