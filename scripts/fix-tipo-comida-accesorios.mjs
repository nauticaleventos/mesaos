// scripts/fix-tipo-comida-accesorios.mjs
// Limpia tipo_comida de salsas, vinagretas, ensaladas y guarniciones.
// Estos no son platos principales — tipo_comida = [] (aparecen solo via botón +)
//
// Uso:
//   node scripts/fix-tipo-comida-accesorios.mjs          → dry-run
//   node scripts/fix-tipo-comida-accesorios.mjs --apply  → aplica en BD

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const APPLY = process.argv.includes('--apply')

const ACCESORIOS = ['salsa', 'vinagreta', 'ensalada', 'guarnicion']

console.log(APPLY ? '🔧 APLICANDO cambios...' : '🔍 DRY-RUN (pasar --apply para aplicar)')

const { data: recipes, error } = await supabase
  .from('recipes')
  .select('id, nombre, tipo_componente, tipo_comida')
  .in('tipo_componente', ACCESORIOS)

if (error) { console.error('Error leyendo recetas:', error); process.exit(1) }

console.log(`\nRecetas a corregir: ${recipes.length}`)
for (const r of recipes) {
  console.log(`  ${r.tipo_componente.padEnd(12)} ${r.nombre.slice(0,40).padEnd(42)} tipo_comida: [${r.tipo_comida?.join(', ')}] → []`)
}

if (!APPLY) {
  console.log('\n⚠️  Dry-run — pasar --apply para aplicar')
  process.exit(0)
}

const ids = recipes.map(r => r.id)
const { error: updateError } = await supabase
  .from('recipes')
  .update({ tipo_comida: [] })
  .in('id', ids)

if (updateError) {
  console.error('Error actualizando:', updateError)
  process.exit(1)
}

console.log(`\n✅ ${ids.length} recetas actualizadas — tipo_comida = []`)
