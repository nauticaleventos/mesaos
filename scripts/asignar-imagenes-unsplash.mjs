/**
 * asignar-imagenes-unsplash.mjs
 *
 * Asigna imágenes de Unsplash a recetas que no tienen imagen_url.
 * Agrupa por keyword para minimizar llamadas API (≤50/hora).
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

// Leer .env
try {
  readFileSync(join(__dirname, '../.env'), 'utf8').split('\n').forEach(line => {
    const [k, ...rest] = line.split('=')
    if (k && rest.length && !process.env[k.trim()]) process.env[k.trim()] = rest.join('=').trim()
  })
} catch {}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || ''
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
const UNSPLASH_KEY = process.env.UNSPLASH_ACCESS_KEY || 'iB43hLvYzVEwCP52_pK0ejcoSOAfBpsNfMFK3zjs158'

const sb = createClient(SUPABASE_URL, SUPABASE_KEY)

// ── Mapa de keywords → término de búsqueda en inglés ─────────────────────────
// Unsplash da mejores resultados en inglés para comidas
const KEYWORD_MAP = {
  // Proteínas
  'pollo':       'grilled chicken food',
  'pechuga':     'chicken breast food',
  'res':         'beef steak food',
  'carne':       'beef food plate',
  'cerdo':       'pork food plate',
  'costilla':    'pork ribs food',
  'lomo':        'pork loin food',
  'chuleta':     'pork chop food',
  'pescado':     'fish fillet food',
  'salmon':      'salmon fillet food',
  'atun':        'tuna food plate',
  'tilapia':     'tilapia fish food',
  'camarones':   'shrimp food plate',
  'langostino':  'prawn seafood plate',
  'huevo':       'eggs food breakfast',
  'huevos':      'eggs food breakfast',
  'tofu':        'tofu healthy food',
  'chorizo':     'chorizo sausage food',
  'jamon':       'ham food plate',
  // Legumbres
  'lentejas':    'lentil soup food',
  'frijol':      'beans food latin',
  'garbanzos':   'chickpea food plate',
  'quinua':      'quinoa healthy food',
  // Carbohidratos / acompañamientos
  'arroz':       'rice food plate',
  'pasta':       'pasta food plate',
  'arepa':       'arepa colombian food',
  'papa':        'potato food plate',
  'yuca':        'yuca cassava food',
  'platano':     'plantain food latin',
  'patacon':     'fried plantain food',
  'pan':         'bread food artisan',
  'tapioca':     'tapioca food',
  // Verduras / ensaladas
  'ensalada':    'salad fresh food',
  'espinaca':    'spinach salad food',
  'coliflor':    'cauliflower food',
  'brocoli':     'broccoli food',
  'zanahoria':   'carrot food',
  // Sopas / caldos
  'sopa':        'soup bowl food',
  'sancocho':    'chicken stew soup latin',
  'ajiaco':      'colombian chicken soup',
  'caldo':       'broth soup food',
  'crema':       'cream soup food',
  // Platos típicos colombianos
  'bandeja':     'bandeja paisa colombian food',
  'changua':     'colombian breakfast soup',
  'pandebono':   'colombian cheese bread',
  'empanada':    'empanada latin food',
  'tamale':      'tamale latin food',
  'tamal':       'tamale latin food',
  'almojabana':  'colombian cheese roll',
  // Desayunos
  'avena':       'oatmeal breakfast food',
  'granola':     'granola breakfast bowl',
  'tostada':     'toast breakfast food',
  'pancake':     'pancake breakfast food',
  // Bebidas
  'jugo':        'fresh juice drink',
  'smoothie':    'smoothie healthy drink',
  'limonada':    'lemonade drink',
  'cafe':        'coffee drink breakfast',
  'leche':       'milk drink food',
  'agua':        'infused water drink',
  // Postres
  'postre':      'dessert sweet food',
  'torta':       'cake dessert food',
  'flan':        'flan dessert food',
  'helado':      'ice cream dessert',
  'brownie':     'brownie chocolate dessert',
  // Salsas
  'guacamole':   'guacamole dip food',
  'salsa':       'tomato sauce cooking',
  'chimichurri': 'chimichurri sauce food',
  'hogao':       'tomato sauce food',
  // Bowls / wraps
  'bowl':        'grain bowl healthy food',
  'wrap':        'wrap sandwich food',
  'burrito':     'burrito mexican food',
}

// Fallback por tipo_componente
const TC_FALLBACK = {
  'proteina_principal': 'protein food plate healthy',
  'guarnicion':         'side dish food plate',
  'ensalada':           'salad fresh vegetables',
  'salsa':              'tomato sauce cooking plate',
  'vinagreta':          'vinaigrette dressing salad',
  'plato_unico':        'complete meal plate food',
  'postre':             'dessert sweet food',
  'bebida':             'healthy drink food',
  'merienda':           'snack healthy food',
}

function normalizar(s) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

// Matching por palabra completa (no "res" dentro de "caprese" o "fresco")
function matchWord(texto, kw) {
  const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^a-z])${escaped}([^a-z]|$)`).test(texto)
}

function extraerKeyword(nombre) {
  const n = normalizar(nombre)
  // Iterar de más largo a más corto para evitar matches parciales
  const kwsSorted = Object.keys(KEYWORD_MAP).sort((a, b) => b.length - a.length)
  for (const kw of kwsSorted) {
    if (matchWord(n, kw)) return kw
  }
  return null
}

// ── Cache de fotos por término ────────────────────────────────────────────────
const photoCache = new Map()  // term → string[]

async function fetchPhotos(term) {
  if (photoCache.has(term)) return photoCache.get(term)

  await new Promise(r => setTimeout(r, 300))  // respetar rate-limit

  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(term)}&per_page=15&orientation=landscape&content_filter=high`
  const res  = await fetch(url, { headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` } })

  if (!res.ok) {
    console.warn(`  ⚠️  Unsplash ${res.status} para "${term}"`)
    photoCache.set(term, [])
    return []
  }

  const data   = await res.json()
  const photos = (data.results ?? []).map(p => p.urls.regular)
  photoCache.set(term, photos)
  return photos
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(DRY_RUN
    ? '🔍 DRY-RUN — sin cambios en BD. Usá --apply para confirmar.\n'
    : '✏️  APPLY — asignando imágenes en Supabase.\n'
  )

  // 1. Traer recetas sin imagen
  const { data: recipes, error } = await sb
    .from('recipes')
    .select('id, nombre, tipo_componente')
    .is('imagen_url', null)
    .eq('is_active_for_menu', true)

  if (error) { console.error('Error Supabase:', error.message); process.exit(1) }
  console.log(`Recetas sin imagen: ${recipes.length}\n`)

  // 2. Agrupar por keyword para minimizar llamadas API
  const groups = new Map()  // keyword → [recipe]
  const fallbackGroup = []

  for (const r of recipes) {
    const kw = extraerKeyword(r.nombre)
    if (kw) {
      if (!groups.has(kw)) groups.set(kw, [])
      groups.get(kw).push(r)
    } else {
      fallbackGroup.push(r)
    }
  }

  console.log(`Keywords únicos: ${groups.size} | Sin keyword: ${fallbackGroup.length}`)
  console.log(`Llamadas Unsplash estimadas: ${groups.size + new Set(fallbackGroup.map(r => r.tipo_componente)).size}\n`)

  // 3. Asignar fotos
  const updates = []  // { id, imagen_url }
  let apiCalls = 0

  for (const [kw, recs] of groups.entries()) {
    const term   = KEYWORD_MAP[kw]
    const photos = await fetchPhotos(term)
    apiCalls++

    if (photos.length === 0) {
      console.warn(`  ⚠️  Sin fotos para keyword "${kw}" (${recs.length} recetas)`)
      continue
    }

    recs.forEach((r, i) => {
      const url = photos[i % photos.length]
      updates.push({ id: r.id, imagen_url: url })
      if (DRY_RUN) console.log(`  [DRY] "${r.nombre}" → ${kw} → ${url.slice(0, 60)}...`)
    })
  }

  // Fallback por tipo_componente
  const tcSeen = new Map()
  for (const r of fallbackGroup) {
    const tc   = r.tipo_componente ?? 'plato_unico'
    const term = TC_FALLBACK[tc] ?? 'food plate meal'

    if (!tcSeen.has(tc)) {
      const photos = await fetchPhotos(term)
      tcSeen.set(tc, photos)
      apiCalls++
    }

    const photos = tcSeen.get(tc) ?? []
    if (photos.length === 0) continue

    const idx = updates.length % photos.length
    updates.push({ id: r.id, imagen_url: photos[idx] })
    if (DRY_RUN) console.log(`  [DRY-TC] "${r.nombre}" (${tc}) → ${photos[idx].slice(0, 60)}...`)
  }

  console.log(`\nTotal: ${updates.length} recetas → imágenes asignadas | Llamadas API: ${apiCalls}`)

  if (DRY_RUN) {
    console.log('\nCorré con --apply para confirmar.')
    return
  }

  // 4. Actualizar en lotes de 50
  let ok = 0, fail = 0
  for (let i = 0; i < updates.length; i += 50) {
    const lote = updates.slice(i, i + 50)
    await Promise.all(lote.map(async u => {
      const { error: e } = await sb.from('recipes').update({ imagen_url: u.imagen_url }).eq('id', u.id)
      if (e) { fail++; console.error(`  ✗ ${u.id}: ${e.message}`) }
      else ok++
    }))
    process.stdout.write(`\r✅ ${ok}/${updates.length}...`)
  }

  console.log(`\n\n🎉 Listo. Actualizadas: ${ok} | Errores: ${fail}`)
}

main().catch(e => { console.error(e); process.exit(1) })
