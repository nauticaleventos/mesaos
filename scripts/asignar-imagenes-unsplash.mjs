/**
 * asignar-imagenes-unsplash.mjs  v3
 *
 * Estrategia híbrida: agrupa recetas por "huella" de 2 palabras clave.
 * ~100-120 grupos únicos = 2-3 corridas dentro del límite 50/hora de Unsplash.
 *
 * Uso:
 *   node scripts/asignar-imagenes-unsplash.mjs              # dry-run
 *   node scripts/asignar-imagenes-unsplash.mjs --apply      # aplica en BD
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DRY_RUN   = !process.argv.includes('--apply')

try {
  readFileSync(join(__dirname, '../.env'), 'utf8').split('\n').forEach(line => {
    const [k, ...rest] = line.split('=')
    if (k && rest.length && !process.env[k.trim()]) process.env[k.trim()] = rest.join('=').trim()
  })
} catch {}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || ''
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
const UNSPLASH_KEY = process.env.UNSPLASH_ACCESS_KEY || ''
if (!UNSPLASH_KEY) { console.error('Falta UNSPLASH_ACCESS_KEY en .env'); process.exit(1) }

const sb = createClient(SUPABASE_URL, SUPABASE_KEY)

// ── Diccionarios ES → EN ──────────────────────────────────────────────────────
const PROT = {
  'pollo':'chicken', 'pechuga':'chicken breast', 'muslo':'chicken thigh',
  'pavo':'turkey', 'pato':'duck',
  'res':'beef', 'carne':'beef', 'lomo':'beef tenderloin', 'costilla':'ribs',
  'cerdo':'pork', 'chuleta':'pork chop', 'chicharron':'crispy pork',
  'salmon':'salmon', 'salmón':'salmon', 'tilapia':'tilapia', 'pescado':'fish',
  'atun':'tuna', 'atún':'tuna', 'bagre':'catfish', 'bacalao':'cod fish',
  'camarones':'shrimp', 'camaron':'shrimp', 'langostino':'prawn',
  'mariscos':'seafood', 'pulpo':'octopus',
  'huevo':'egg', 'huevos':'eggs',
  'chorizo':'chorizo sausage', 'jamon':'ham',
  'tofu':'tofu', 'lentejas':'lentils', 'frijol':'beans', 'frijoles':'beans',
  'garbanzos':'chickpeas', 'quinua':'quinoa', 'soya':'soy protein',
}
const CARBS = {
  'arroz':'rice', 'pasta':'pasta', 'yuca':'yuca cassava', 'papa':'potato',
  'papas':'potatoes', 'platano':'plantain', 'plátano':'plantain',
  'patacon':'fried plantain', 'patacón':'fried plantain',
  'arepa':'arepa', 'pan':'bread', 'tamal':'tamale', 'empanada':'empanada',
  'pizza':'pizza', 'wrap':'wrap', 'taco':'taco', 'burrito':'burrito',
  'avena':'oatmeal', 'granola':'granola', 'pancake':'pancake',
  'fideos':'noodles',
}
const VEG = {
  'espinaca':'spinach', 'brocoli':'broccoli', 'brócoli':'broccoli',
  'zanahoria':'carrot', 'coliflor':'cauliflower', 'kale':'kale',
  'aguacate':'avocado', 'tomate':'tomato', 'repollo':'cabbage',
  'cebolla':'onion', 'ajo':'garlic', 'pimenton':'bell pepper',
  'pimentón':'bell pepper',
}
const DISH = {
  'sopa':'soup bowl', 'crema':'cream soup', 'caldo':'broth soup',
  'sancocho':'chicken stew', 'ajiaco':'colombian soup', 'cazuela':'seafood stew',
  'sudado':'braised stew', 'seco':'braised dish',
  'ensalada':'fresh salad', 'bowl':'grain bowl', 'ceviche':'ceviche',
  'smoothie':'smoothie drink', 'jugo':'fresh juice',
  'postre':'dessert', 'torta':'cake slice', 'brownie':'chocolate brownie',
  'helado':'ice cream', 'flan':'flan dessert', 'trufa':'truffle sweet',
  'cocada':'coconut sweet', 'compota':'fruit compote',
  'bizcocho':'sponge cake', 'muffin':'muffin baked', 'galleta':'cookie baked',
  'alfajor':'alfajor cookie', 'barritas':'granola bar',
  'bandeja':'bandeja paisa', 'changua':'colombian milk soup',
  'pandebono':'cheese bread', 'almojabana':'cheese roll',
  'guacamole':'guacamole', 'hogao':'tomato sauce',
  'chimichurri':'chimichurri sauce', 'vinagreta':'vinaigrette salad',
}
const COOK = {
  'horno':'baked oven', 'plancha':'grilled', 'frito':'fried crispy',
  'frita':'fried crispy', 'vapor':'steamed', 'asado':'roasted',
  'asada':'roasted', 'saltado':'stir fried', 'curry':'curry spiced',
  'relleno':'stuffed', 'rellena':'stuffed',
}

function norm(s) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ')
}

function findFirst(texto, map) {
  const t = norm(texto)
  for (const [es, en] of Object.entries(map)) {
    const re = new RegExp(`(^|\\s)${es.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`)
    if (re.test(t)) return en
  }
  return null
}

function construirHuella(nombre, tipoComponente) {
  // 1. Plato típico / categoría especial primero
  const dish = findFirst(nombre, DISH)
  const nHasProtein = findFirst(nombre, PROT)
  // Si es un plato completo tipico, usarlo
  if (dish && !['fresh salad', 'grain bowl', 'vinaigrette salad'].includes(dish) && !nHasProtein) {
    return `${dish}`
  }

  const prot = nHasProtein
  const cook = findFirst(nombre, COOK)
  const carb = findFirst(nombre, CARBS)
  const veg  = findFirst(nombre, VEG)

  // 2. Proteína + método cocción (más específico)
  if (prot && cook) return `${prot} ${cook}`
  if (prot && dish && dish !== 'fresh salad') return `${prot} ${dish}`
  if (prot && carb) return `${prot} with ${carb}`
  if (prot && veg)  return `${prot} with ${veg}`
  if (prot)         return `${prot} food plate`

  // 3. Carbo + algo
  if (carb && veg)  return `${carb} with ${veg}`
  if (carb && cook) return `${cook} ${carb}`
  if (carb && dish) return `${carb} ${dish}`
  if (carb)         return `${carb} food`

  // 4. Plato / verdura solos
  if (dish) return `${dish}`
  if (veg)  return `${veg} salad`

  // 5. Fallback por tipo_componente
  const TC_FB = {
    'proteina_principal': 'protein main course',
    'guarnicion':         'side dish plate',
    'ensalada':           'fresh salad bowl',
    'salsa':              'sauce condiment',
    'vinagreta':          'vinaigrette dressing',
    'plato_unico':        'complete meal plate',
    'postre':             'dessert sweet',
    'bebida':             'healthy drink',
    'merienda':           'healthy snack',
  }
  return TC_FB[tipoComponente] ?? 'food meal plate'
}

const photoCache = new Map()
let apiCalls = 0

async function fetchPool(huella) {
  if (photoCache.has(huella)) return photoCache.get(huella)

  if (DRY_RUN) {
    photoCache.set(huella, [`DRY:${huella}`])
    return photoCache.get(huella)
  }

  await new Promise(r => setTimeout(r, 700))
  apiCalls++

  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(huella)}&per_page=15&orientation=landscape&content_filter=high`
  const res  = await fetch(url, { headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` } })

  if (res.status === 429 || res.status === 403) {
    console.log(`\n  ⏳ Rate limit — esperando 65s...`)
    await new Promise(r => setTimeout(r, 65000))
    const r2   = await fetch(url, { headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` } })
    const d2   = r2.ok ? await r2.json() : { results: [] }
    const pool = (d2.results ?? []).map(p => p.urls.regular)
    photoCache.set(huella, pool)
    return pool
  }

  const data = await res.json()
  const pool = (data.results ?? []).map(p => p.urls.regular)
  photoCache.set(huella, pool)
  return pool
}

async function main() {
  console.log(DRY_RUN ? '🔍 DRY-RUN\n' : '✏️  APPLY\n')

  const { data: recipes, error } = await sb
    .from('recipes')
    .select('id, nombre, tipo_componente')
    .is('imagen_url', null)
    .order('tipo_componente')

  if (error) { console.error(error.message); process.exit(1) }
  if (!recipes?.length) { console.log('✅ Todas las recetas tienen imagen.'); return }

  console.log(`Recetas sin imagen: ${recipes.length}`)

  // Agrupar por huella
  const grupos = new Map()
  for (const r of recipes) {
    const h = construirHuella(r.nombre, r.tipo_componente)
    if (!grupos.has(h)) grupos.set(h, [])
    grupos.get(h).push(r)
  }

  const totalGrupos = grupos.size
  console.log(`Grupos únicos: ${totalGrupos} (= llamadas a Unsplash)`)
  if (totalGrupos > 50) {
    console.log(`⚠️  Más de 50 grupos — el script pausará automáticamente cuando llegue al límite.\n`)
  }

  if (DRY_RUN) {
    console.log('\nMuestra de grupos (primeros 25):')
    let shown = 0
    for (const [h, recs] of grupos.entries()) {
      if (shown++ >= 25) break
      const nombres = recs.map(r => r.nombre).slice(0, 2).join(' | ')
      console.log(`  [${recs.length}] "${h}" → ${nombres}`)
    }
    console.log('\nCorré con --apply para aplicar.')
    return
  }

  const updates = []
  let groupCount = 0

  for (const [huella, recs] of grupos.entries()) {
    groupCount++
    process.stdout.write(`\r  [${groupCount}/${totalGrupos}] "${huella.slice(0, 45)}"...`)
    const pool = await fetchPool(huella)

    if (!pool.length) {
      console.log(`\n  ⚠️  Sin fotos: "${huella}" (${recs.length} recetas)`)
      continue
    }

    recs.forEach((r, i) => updates.push({ id: r.id, imagen_url: pool[i % pool.length] }))
  }

  console.log(`\n\nTotal a actualizar: ${updates.length} | Llamadas API: ${apiCalls}`)

  let ok = 0, fail = 0
  for (let i = 0; i < updates.length; i += 50) {
    const lote = updates.slice(i, i + 50)
    await Promise.all(lote.map(async u => {
      const { error: e } = await sb.from('recipes').update({ imagen_url: u.imagen_url }).eq('id', u.id)
      if (e) fail++; else ok++
    }))
    process.stdout.write(`\r✅ ${ok}/${updates.length}...`)
  }

  console.log(`\n\n🎉 Actualizadas: ${ok} | Errores: ${fail}`)
  const { count } = await sb.from('recipes').select('id', { count: 'exact', head: true }).is('imagen_url', null)
  console.log(`📊 Pendientes restantes: ${count ?? 0}`)
}

main().catch(e => { console.error(e); process.exit(1) })
