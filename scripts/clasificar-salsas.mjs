// scripts/clasificar-salsas.mjs
// Reclasifica como tipo_componente='salsa' recetas que son salsas/aderezos
// Uso:
//   node scripts/clasificar-salsas.mjs          → dry-run (solo muestra)
//   node scripts/clasificar-salsas.mjs --apply  → aplica cambios en BD

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const APPLY = process.argv.includes('--apply')

// Palabras que identifican salsas/aderezos/complementos
const KEYWORDS = [
  'salsa', 'aderezo', 'vinagreta', 'chimichurri', 'pesto', 'tahini',
  'mayonesa', 'alioli', 'hogao', 'guacamole', 'tzatziki', 'tzatziki',
  'mojo', 'ají', 'aji',
]

// Frases completas a buscar
const PHRASES = [
  'salsa de', 'crema de',
]

// Nombres que son dudosos — podrían ser receta principal o salsa según contexto
const DUDOSOS_KEYWORDS = [
  'mayonesa', 'guacamole', 'crema de',
]

function esDudoso(nombre) {
  const n = nombre.toLowerCase()
  return DUDOSOS_KEYWORDS.some(d => n.includes(d))
}

function matcheaSalsa(nombre) {
  const n = nombre.toLowerCase()
  return KEYWORDS.some(k => n.includes(k)) || PHRASES.some(p => n.includes(p))
}

async function main() {
  console.log(`\n🔍 Buscando recetas candidatas a ser salsas...\n`)

  // Traer todas las recetas activas que no sean ya tipo_componente='salsa'
  const { data, error } = await supabase
    .from('recipes')
    .select('id, nombre, tipo_componente, tipo_comida')
    .neq('tipo_componente', 'salsa')
    .eq('is_active_for_menu', true)
    .order('nombre')

  if (error) { console.error('Error BD:', error.message); process.exit(1) }
  if (!data?.length) { console.log('No se encontraron recetas activas.'); return }

  // Filtrar por nombre
  const candidatas = data.filter(r => matcheaSalsa(r.nombre))

  if (!candidatas.length) {
    console.log('✅ Ninguna receta necesita reclasificación.')
    return
  }

  // Separar en normales y dudosas
  const normales = candidatas.filter(r => !esDudoso(r.nombre))
  const dudosas  = candidatas.filter(r => esDudoso(r.nombre))

  console.log(`📋 RECETAS A RECLASIFICAR → tipo_componente = 'salsa'\n`)
  console.log(`  Total: ${candidatas.length} (${normales.length} claras + ${dudosas.length} dudosas)\n`)

  if (normales.length) {
    console.log(`✅ CLARAS (${normales.length}):`)
    normales.forEach(r => {
      console.log(`  • ${r.nombre}  [era: ${r.tipo_componente ?? 'null'}]`)
    })
  }

  if (dudosas.length) {
    console.log(`\n⚠️  DUDOSAS (${dudosas.length}) — revisar manualmente:`)
    dudosas.forEach(r => {
      console.log(`  • ${r.nombre}  [era: ${r.tipo_componente ?? 'null'}]`)
    })
  }

  if (!APPLY) {
    console.log(`\n─────────────────────────────────────────`)
    console.log(`DRY-RUN — no se hizo ningún cambio.`)
    console.log(`Para aplicar: node scripts/clasificar-salsas.mjs --apply`)
    console.log(`Nota: las DUDOSAS también se reclasifican con --apply.`)
    console.log(`      Si alguna no debe ser salsa, corrégila manualmente después.`)
    return
  }

  // ── APPLY ──────────────────────────────────────────────────────────────────
  console.log(`\n🚀 Aplicando cambios...`)
  let ok = 0, fail = 0

  for (const r of candidatas) {
    const { error: upErr } = await supabase
      .from('recipes')
      .update({ tipo_componente: 'salsa' })
      .eq('id', r.id)

    if (upErr) {
      console.error(`  ✗ ${r.nombre}: ${upErr.message}`)
      fail++
    } else {
      console.log(`  ✓ ${r.nombre}`)
      ok++
    }
  }

  console.log(`\n✅ Listo: ${ok} actualizadas, ${fail} errores`)
}

main().catch(console.error)
