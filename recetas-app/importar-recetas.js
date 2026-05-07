import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const SUPABASE_URL      = 'https://sstvwynwmbnyyzircrlw.supabase.co'
const SERVICE_ROLE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzdHZ3eW53bWJueXl6aXJjcmx3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODA3Njg3MCwiZXhwIjoyMDkzNjUyODcwfQ.IpGEgmcMotnLqyKldxagamj0Ceri6_gbh4NPvECiAKk'


const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
})

async function main() {
  const data    = JSON.parse(readFileSync('recetas-iniciales.json', 'utf-8'))
  const recetas = data.recetas

  console.log(`\n📖 Importando ${recetas.length} recetas a Supabase...\n`)

  let ok = 0, fail = 0

  for (const r of recetas) {
    const row = {
      nombre:                r.nombre,
      descripcion_corta:     r.descripcion_corta,
      origen:                r.origen,
      tipo_comida:           r.tipo_comida ?? [],
      ocasion:               r.ocasion ?? [],
      tiempo_total_min:      r.tiempo_total_min,
      tiempo_preparacion_min: r.tiempo_preparacion_min,
      tiempo_coccion_min:    r.tiempo_coccion_min,
      dificultad:            r.dificultad,
      porciones:             r.porciones,
      costo_estimado:        r.costo_estimado,
      ingredientes:          r.ingredientes ?? [],
      pasos:                 r.pasos ?? [],
      tags:                  r.tags ?? [],
      info_nutricional_aprox: r.info_nutricional_aprox ?? {},
      is_base_recipe:        true,
      family_id:             null,
    }

    const { error } = await supabase.from('recipes').insert(row)
    if (error) {
      console.error(`  ✗ ${r.nombre}: ${error.message}`)
      fail++
    } else {
      console.log(`  ✓ ${r.nombre}`)
      ok++
    }
  }

  console.log(`\n📊 ${ok} importadas, ${fail} fallidas\n`)
}

main().catch(e => { console.error(e); process.exit(1) })
