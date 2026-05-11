/**
 * clasificar-recetas.mjs
 *
 * Asigna tipo_componente a las recetas que lo tienen NULL en BD,
 * usando la misma heurística mejorada del motor.
 *
 * Uso:
 *   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/clasificar-recetas.mjs
 *   Agregar --apply para escribir en BD (sin la flag: dry-run).
 */

import { createClient } from '@supabase/supabase-js'

const DRY_RUN = !process.argv.includes('--apply')

const sb = createClient(
  process.env.SUPABASE_URL ?? '',
  process.env.SUPABASE_SERVICE_KEY ?? '',
)

// ── Misma heurística que clasificarComponente en motorMenu.ts ─────────────────
function norm(s) {
  return (s ?? '').toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

const PROTEIN_KW = ['pollo','carne','res','cerdo','pescado','atun','salmon','camaron',
  'huevo','huevos','tofu','lentejas','garbanzos','frijol','lomo','pechuga',
  'filete','costilla','chorizo','jamon','sardinas','bacalao','langostino']

const CARB_KW = ['arroz','papa','platano','yuca','pasta','arepa','pan ','quinua',
  'maiz','patacon','pure','coliflor','brocoli','tapioca']

const SALSA_KW = ['salsa ','aderezo','vinagreta','mojo ','chimichurri','hogao']

const DRINK_KW = ['leche','jugo','agua','te ','cafe','smoothie','batido','bebida','limonada','infusion']

function clasificar(recipe) {
  const nombre = norm(recipe.nombre)
  const ings   = recipe.ingredientes ?? []
  const tipo   = recipe.tipo_comida ?? []

  // 1. tipo_comida como señal primaria (más confiable que el nombre)
  if (tipo.includes('bebida') && !tipo.includes('almuerzo') && !tipo.includes('cena')) return 'bebida'
  if (tipo.includes('postre') && !tipo.includes('almuerzo') && !tipo.includes('cena')) return 'postre'
  if (tipo.length > 0 && tipo.every(t => t === 'snack')) return 'merienda'

  // 1b. Nombre empieza con "ensalada" → siempre ensalada (antes que cualquier ratio)
  if (nombre.startsWith('ensalada')) return 'ensalada'
  // Carbs obvios por nombre (antes que ratios, evita que patacones/papa sean salsa)
  if (CARB_KW.some(k => nombre.startsWith(k))) return 'guarnicion'

  // 2. Ratios de ingredientes (más confiable que el nombre para nombres corruptos)
  const cats        = ings.map(i => i.categoria ?? '')
  const total       = cats.length || 1
  const protCount   = cats.filter(c => c === 'proteina_animal' || c === 'embutido').length
  const granoCount  = cats.filter(c => c === 'grano').length
  const veggCount   = cats.filter(c => c === 'vegetal' || c === 'fruta').length
  const legCount    = cats.filter(c => c === 'legumbre').length
  const condCount   = cats.filter(c => c === 'condimento').length

  if (protCount  / total >= 0.30) return 'proteina_principal'
  if ((granoCount + legCount) / total >= 0.40 && protCount / total < 0.2) return 'guarnicion'
  if (veggCount  / total >= 0.55 && protCount / total < 0.15) return 'ensalada'
  if (condCount  / total >= 0.55) return 'salsa'

  // 3. Nombre — solo si los ratios no dieron resultado claro
  // (para nombres corruptos, priorizamos ingredientes)
  if (nombre.includes('ensalada') || nombre.includes('slaw')) return 'ensalada'
  if (SALSA_KW.some(k => nombre.includes(k))) return 'salsa'

  // Carb keywords ANTES de protein keywords para evitar "Pan de coliflor" → proteina
  if (CARB_KW.some(k => nombre.includes(k))) return 'guarnicion'
  if (PROTEIN_KW.some(k => nombre.includes(k)) && !nombre.startsWith('ensalada')) return 'proteina_principal'

  // Sopas y caldos → plato_unico
  if (['sopa ','caldo','sancocho','ajiaco','cuchuco','mondongo','hervido','puchero',
       'consomé','consome','locro','chupe'].some(k => nombre.includes(k))) return 'plato_unico'

  return 'plato_unico'
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(DRY_RUN
    ? '🔍 DRY-RUN — sin cambios en BD. Agregá --apply para confirmar.\n'
    : '✏️  APPLY — escribiendo en Supabase.\n'
  )

  // Cargar recetas sin tipo_componente
  let all = [], from = 0
  while (true) {
    const { data } = await sb.from('recipes')
      .select('id, nombre, tipo_comida, ingredientes, tipo_componente')
      .is('tipo_componente', null)
      .range(from, from + 199)
    if (!data || data.length === 0) break
    all = all.concat(data)
    if (data.length < 200) break
    from += 200
  }

  console.log(`📦 Recetas sin tipo_componente: ${all.length}\n`)

  const dist = {}
  const toUpdate = []

  for (const r of all) {
    const tc = clasificar(r)
    dist[tc] = (dist[tc] ?? 0) + 1
    toUpdate.push({ id: r.id, nombre: r.nombre, tipo_componente: tc })
  }

  console.log('Distribución propuesta:')
  Object.entries(dist).sort(([,a],[,b]) => b-a).forEach(([k,v]) => console.log(`  ${k}: ${v}`))
  console.log()

  // Muestra de 5 por categoría
  console.log('Muestra:')
  const seen = {}
  for (const r of toUpdate) {
    if ((seen[r.tipo_componente] ?? 0) >= 3) continue
    seen[r.tipo_componente] = (seen[r.tipo_componente] ?? 0) + 1
    console.log(`  [${r.tipo_componente}] "${r.nombre}"`)
  }

  if (DRY_RUN) {
    console.log('\nCorré con --apply para confirmar.')
    return
  }

  // Actualizar en lotes de 50
  const chunk = (arr, n) => { const out=[]; for(let i=0;i<arr.length;i+=n) out.push(arr.slice(i,i+n)); return out }
  let updated = 0
  for (const lote of chunk(toUpdate, 50)) {
    await Promise.all(lote.map(r =>
      sb.from('recipes').update({ tipo_componente: r.tipo_componente }).eq('id', r.id)
    ))
    updated += lote.length
    process.stdout.write(`\r✅ ${updated}/${toUpdate.length}...`)
  }
  console.log('\n\n🎉 Clasificación completa.')
}

main().catch(e => { console.error(e); process.exit(1) })
