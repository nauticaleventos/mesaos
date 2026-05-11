/**
 * normalize-ingredients.mjs
 *
 * Normaliza nombres de ingredientes en todas las recetas de la BD:
 * reemplaza variedades regionales/colombianas por nombres genéricos.
 *
 * Uso:
 *   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/normalize-ingredients.mjs
 *   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/normalize-ingredients.mjs --apply
 *
 * Sin --apply: solo muestra un preview de cambios (modo dry-run).
 * Con --apply: escribe los cambios en Supabase.
 */

import { createClient } from '@supabase/supabase-js'

const DRY_RUN = !process.argv.includes('--apply')

const supabase = createClient(
  process.env.SUPABASE_URL     ?? '',
  process.env.SUPABASE_SERVICE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? '',
)

// ─────────────────────────────────────────────────────────────────────────────
// Diccionario de normalización
// Clave: texto a buscar (lowercase, parcial). Valor: reemplazo.
// Se aplica sobre el nombre completo del ingrediente (lowercase).
// Orden importa: las más específicas primero.
// ─────────────────────────────────────────────────────────────────────────────
const EXACT_MAP = {
  // Plátano — variedades colombianas/centroamericanas
  'plátano hartón':         'plátano',
  'platano harton':         'plátano',
  'plátano dominico':       'plátano',
  'plátano popocho':        'plátano',
  'plátano roatán':         'plátano',
  'plátano roatan':         'plátano',
  'plátano macho':          'plátano',
  'banano criollo':         'banano',
  'banano bocadillo':       'banano',

  // Papa — variedades colombianas
  'papa pastusa':           'papa',
  'papa nevada':            'papa',
  'papa capira':            'papa',
  'papa r-12':              'papa',
  'papa diacol capiro':     'papa',
  'papa criolla pastusa':   'papa criolla',
  'papa criolla capiro':    'papa criolla',
  'papa criolla nevada':    'papa criolla',

  // Tomate — variedades
  'tomate chonto':          'tomate',
  'tomate larga vida':      'tomate',
  'tomate milano':          'tomate',
  'tomate chontaduro':      'tomate',
  'tomate de mesa':         'tomate',
  'tomate cherry maduro':   'tomate cherry',
  'tomate uva':             'tomate cherry',

  // Carne y pollo
  'pollo de engorde':       'pollo',
  'pollo campesino':        'pollo',
  'carne de res criolla':   'carne de res',
  'res criolla':            'carne de res',
  'cerdo criollo':          'cerdo',
  'lomo de cerdo criollo':  'lomo de cerdo',

  // Frutas con variedad
  'mora castilla':          'mora',
  'mora larga':             'mora',
  'mora de castilla':       'mora',
  'maracuyá amarillo':      'maracuyá',
  'maracuyá morado':        'maracuyá',
  'guayaba manzana':        'guayaba',
  'guayaba pera':           'guayaba',
  'guayaba agria':          'guayaba',
  'mango tommy':            'mango',
  'mango criollo':          'mango',
  'mango de azúcar':        'mango',
  'naranja valencia':       'naranja',
  'naranja tangelo':        'naranja',
  'limón tahití':           'limón',
  'limón tahiti':           'limón',
  'limón pajarito':         'limón',
  'mandarina arrayana':     'mandarina',
  'mandarina oneco':        'mandarina',
  'piña manzana':           'piña',
  'piña cayena':            'piña',

  // Frijoles y legumbres — variedades locales
  'frijol cargamanto':      'frijol',
  'frijol bolo':            'frijol',
  'frijol rojo nacional':   'frijol rojo',
  'frijol radical':         'frijol',
  'frijol zaragoza':        'frijol',
  'frijol tío canelo':      'frijol',
  'arveja verde':           'arveja',
  'arveja seca':            'arveja',
  'garbanzo nacional':      'garbanzo',
  'lenteja verde colombiana': 'lenteja',

  // Granos y cereales
  'arroz blanco largograno': 'arroz',
  'arroz parbolizado':      'arroz',
  'maíz pira':              'maíz',
  'maíz blanco trillado':   'maíz',
  'maíz amarillo trillado': 'maíz',

  // Lácteos
  'leche entera pasteurizada': 'leche',
  'leche pasteurizada':     'leche',
  'leche semidescremada':   'leche',
  'crema de leche nacional': 'crema de leche',
  'queso campesino':        'queso fresco',
  'queso costeño':          'queso',
  'queso doble crema':      'queso',
  'queso pera':             'queso',

  // Aceites y grasas
  'aceite vegetal refinado': 'aceite vegetal',
  'aceite de maíz':         'aceite vegetal',
  'aceite de girasol':      'aceite vegetal',
  'aceite de palma':        'aceite vegetal',
  'mantequilla sin sal':    'mantequilla',
  'margarina vegetal':      'mantequilla',

  // Endulzantes
  'panela raspadura':       'panela',
  'panela molida':          'panela',
  'azúcar blanca':          'azúcar',
  'azúcar morena':          'azúcar morena',
  'azúcar refinada':        'azúcar',

  // Yuca y tubérculos
  'yuca casabe':            'yuca',
  'yuca blanca':            'yuca',
  'yuca amarga':            'yuca',
  'ñame espino':            'ñame',
  'ñame criollo':           'ñame',

  // Ingredientes difíciles de conseguir fuera de Colombia
  'jilo':                   'berenjena pequeña',
  'auyama':                 'calabaza',
  'ahuyama':                'calabaza',
  'guatila':                'chayote',
  'cidra':                  'chayote',
  'cubio':                  'papa nabo',
  'ruba':                   'papa nabo',
  'chugua':                 'papa nabo',
  'bore':                   'malanga',
  'balú':                   'frijol de palo',
  'chorizo santarrosano':   'chorizo',
  'hogao':                  'sofrito de tomate y cebolla',
  'suero costeño':          'crema agria',
  'arequipe':               'dulce de leche',
  'bocadillo':              'pasta de guayaba',

  // Hierbas regionales
  'cilantro cimarrón':      'cilantro de monte',
  'cimarrón':               'cilantro de monte',
  'guascas':                'hierbas secas',
  'hierba de azotea':       'hierbas frescas',

  // Ajíes
  'ají dulce cacique':      'ají dulce',
  'ají pimiento':           'pimiento',
  'ají rocoto':             'ají picante',
  'chile chipotle':         'chile ahumado',
  'chile mulato':           'chile seco',

  // Cebolla
  'cebolla cabezona blanca': 'cebolla blanca',
  'cebolla cabezona roja':   'cebolla roja',
  'cebolla cabezona':       'cebolla',
  'cebolla junca':          'cebolla de verdeo',
  'cebolla larga':          'cebolla de verdeo',

  // Condimentos y salsas
  'achiote en semilla':     'achiote',
  'color vegetal':          'achiote',
  'comino molido nacional': 'comino',
  'sal marina fina':        'sal',
  'sal refinada':           'sal',
}

// Palabras "ruido" a eliminar del final del nombre si no cambian el significado
const NOISE_SUFFIXES = [
  ' fresco', ' fresca',
  ' natural', ' artesanal',
  ' cruda', ' crudo',
  ' de primera calidad',
  ' de calidad',
  ' orgánico', ' orgánica',
  ' pasteurizado', ' pasteurizada',
  ' importado', ' importada',
  ' nacional',
]

// ─────────────────────────────────────────────────────────────────────────────

function normalizeNombre(nombre) {
  let n = nombre.trim().toLowerCase()

  // 1. Exact match en el diccionario
  if (EXACT_MAP[n]) return EXACT_MAP[n]

  // 2. Partial match: si el nombre contiene exactamente una de las claves
  for (const [key, val] of Object.entries(EXACT_MAP)) {
    if (n === key) return val
    // Match al inicio + posible variante de grafía
    if (n.startsWith(key + ' ') || n.endsWith(' ' + key)) return val
  }

  // 3. Eliminar sufijos de ruido
  for (const suffix of NOISE_SUFFIXES) {
    if (n.endsWith(suffix)) {
      n = n.slice(0, -suffix.length).trim()
      break
    }
  }

  // 4. Re-capitalizar primera letra
  return n.charAt(0).toUpperCase() + n.slice(1)
}

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log(DRY_RUN
    ? '🔍 Modo DRY-RUN — ningún cambio se escribirá. Agrega --apply para confirmar.\n'
    : '✏️  Modo APPLY — se escribirán los cambios en Supabase.\n'
  )

  // Paginación para traer todas las recetas
  let allRecipes = []
  let from = 0
  const pageSize = 200

  while (true) {
    const { data, error } = await supabase
      .from('recipes')
      .select('id, nombre, ingredientes')
      .range(from, from + pageSize - 1)

    if (error) { console.error('Error fetching recipes:', error); process.exit(1) }
    if (!data || data.length === 0) break
    allRecipes = allRecipes.concat(data)
    if (data.length < pageSize) break
    from += pageSize
  }

  console.log(`📦 Recetas cargadas: ${allRecipes.length}\n`)

  let totalChanges = 0
  const recipesToUpdate = []

  for (const recipe of allRecipes) {
    if (!Array.isArray(recipe.ingredientes)) continue

    const newIngredientes = recipe.ingredientes.map(ing => {
      const normalized = normalizeNombre(ing.nombre)
      if (normalized !== ing.nombre) {
        return { ...ing, nombre: normalized }
      }
      return ing
    })

    const changed = newIngredientes.some((ing, i) => ing.nombre !== recipe.ingredientes[i].nombre)
    if (!changed) continue

    // Mostrar diff
    console.log(`📝 ${recipe.nombre} (${recipe.id.slice(0, 8)})`)
    for (let i = 0; i < recipe.ingredientes.length; i++) {
      const before = recipe.ingredientes[i].nombre
      const after  = newIngredientes[i].nombre
      if (before !== after) {
        console.log(`   ${before}  →  ${after}`)
        totalChanges++
      }
    }
    console.log()

    recipesToUpdate.push({ id: recipe.id, ingredientes: newIngredientes })
  }

  console.log(`\n── Total: ${totalChanges} cambios en ${recipesToUpdate.length} recetas ──\n`)

  if (DRY_RUN) {
    console.log('Revisá los cambios arriba y correlo con --apply para confirmar.')
    return
  }

  // Aplicar en lotes de 20
  let updated = 0
  for (const batch of chunk(recipesToUpdate, 20)) {
    await Promise.all(
      batch.map(r =>
        supabase.from('recipes').update({ ingredientes: r.ingredientes }).eq('id', r.id)
      )
    )
    updated += batch.length
    process.stdout.write(`\r✅ Actualizadas ${updated}/${recipesToUpdate.length} recetas...`)
  }
  console.log('\n\n🎉 ¡Normalización completa!')
}

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

main().catch(err => { console.error(err); process.exit(1) })
