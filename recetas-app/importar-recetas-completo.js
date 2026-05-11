import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const SUPABASE_URL     = process.env.SUPABASE_URL     ?? 'https://sstvwynwmbnyyzircrlw.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
  ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzdHZ3eW53bWJueXl6aXJjcmx3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODA3Njg3MCwiZXhwIjoyMDkzNjUyODcwfQ.IpGEgmcMotnLqyKldxagamj0Ceri6_gbh4NPvECiAKk'

const LOTE    = 50
const ARCHIVO = 'recetas-mesaos-completo.json'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
})

async function main() {
  const recetas = JSON.parse(readFileSync(ARCHIVO, 'utf-8'))
  console.log(`\n📖 ${recetas.length} recetas encontradas en el archivo\n`)

  // Cargar nombres existentes para deduplicación
  console.log('🔍 Cargando recetas existentes...')
  const { data: existentes, error: errEx } = await supabase
    .from('recipes')
    .select('nombre')
  if (errEx) { console.error('Error cargando existentes:', errEx.message); process.exit(1) }

  const nombresExistentes = new Set(
    (existentes ?? []).map(r => r.nombre.toLowerCase().trim())
  )
  console.log(`   ${nombresExistentes.size} recetas ya en BD\n`)

  let importadas = 0, saltadas = 0, errores = 0

  // Procesar en lotes
  for (let i = 0; i < recetas.length; i += LOTE) {
    const lote     = recetas.slice(i, i + LOTE)
    const filas    = []
    const saltadasLote = []

    for (const r of lote) {
      const nombre = (r.nombre ?? '').trim()
      if (!nombre) { errores++; continue }

      if (nombresExistentes.has(nombre.toLowerCase())) {
        saltadas++
        saltadasLote.push(nombre)
        continue
      }

      filas.push({
        nombre,
        descripcion_corta:      r.descripcion_corta ?? null,
        origen:                 r.origen ?? null,
        tipo_comida:            r.tipo_comida ?? [],
        ocasion:                r.ocasion ?? [],
        tiempo_total_min:       r.tiempo_total_min ?? null,
        tiempo_preparacion_min: r.tiempo_preparacion_min ?? null,
        tiempo_coccion_min:     r.tiempo_coccion_min ?? null,
        dificultad:             r.dificultad ?? null,
        porciones:              r.porciones ?? null,
        costo_estimado:         r.costo_estimado ?? null,
        ingredientes:           r.ingredientes ?? [],
        pasos:                  r.pasos ?? [],
        tags:                   r.tags ?? [],
        info_nutricional_aprox: r.info_nutricional_aprox ?? null,
        perfiles:               r.perfiles ?? {},
        filtros_nutricionales:  r.filtros_nutricionales ?? {},
        imagen_url:             r.imagen_url ?? null,
        imagen_credito:         r.imagen_credito ?? null,
        is_base_recipe:         true,
        rating_promedio:        null,
        family_id:              null,
        // Campos Oleada 1
        visibility:             'public',
        is_active_for_menu:     true,
        created_by_user_id:     null,
        created_in_family_id:   null,
        source:                 'semilla',
      })

      nombresExistentes.add(nombre.toLowerCase())
    }

    if (saltadasLote.length > 0) {
      console.log(`   ⏭  Saltadas (duplicadas): ${saltadasLote.join(', ')}`)
    }

    if (filas.length === 0) {
      console.log(`Lote ${Math.floor(i/LOTE)+1}: todas duplicadas, siguiente...`)
      continue
    }

    const { error: errInsert } = await supabase.from('recipes').insert(filas)
    if (errInsert) {
      console.error(`❌ Error en lote ${Math.floor(i/LOTE)+1}:`, errInsert.message)
      errores += filas.length
    } else {
      importadas += filas.length
      console.log(`✅ Importadas ${importadas} de ${recetas.length}...`)
    }
  }

  console.log('\n══════════════════════════════')
  console.log('📊 RESULTADO FINAL')
  console.log('══════════════════════════════')
  console.log(`✅ Importadas:  ${importadas}`)
  console.log(`⏭  Saltadas:   ${saltadas}`)
  console.log(`❌ Errores:    ${errores}`)
  console.log(`📁 Total:      ${recetas.length}`)
  console.log('══════════════════════════════\n')
}

main().catch(e => { console.error('Error fatal:', e); process.exit(1) })
