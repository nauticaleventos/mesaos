import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { getMondayOfWeek } from '../lib/motorMenu'
import type { FridgeItem } from './fridgeStore'

export interface ShoppingListItem {
  id:                 string
  shopping_list_id:   string
  ingrediente_nombre: string
  cantidad_total:     number
  unidad:             string
  categoria_pasillo:  string
  en_nevera:          boolean
  faltante:           boolean
  comprado:           boolean
  recetas_origen:     string[]
}

interface ShoppingListState {
  listId:    string | null
  items:     ShoppingListItem[]
  loading:   boolean
  generating: boolean

  loadList:     (familyId: string) => Promise<void>
  generateList: (familyId: string, fridgeItems: FridgeItem[]) => Promise<void>
  toggleComprado: (itemId: string, value: boolean) => Promise<void>
}

// ── Mapeo categoría de ingrediente → pasillo ──────────────────────────────────
const CATEGORIA_A_PASILLO: Record<string, string> = {
  proteina_animal: 'carniceria',
  embutido:        'carniceria',
  lacteo:          'lacteos_huevos',
  vegetal:         'frutas_verduras',
  fruta:           'frutas_verduras',
  grano:           'granos_pastas',
  legumbre:        'granos_pastas',
  condimento:      'aceites_condimentos',
  bebida:          'bebidas',
  snack:           'snacks_dulces',
  otro:            'otros',
}

// Override de pasillo por nombre — corrige categorías inconsistentes en BD
const NOMBRE_A_PASILLO: Record<string, string> = {
  banano: 'frutas_verduras', platano: 'frutas_verduras', mango: 'frutas_verduras',
  fresa: 'frutas_verduras', fresas: 'frutas_verduras', uva: 'frutas_verduras', uvas: 'frutas_verduras',
  kiwi: 'frutas_verduras', pera: 'frutas_verduras', manzana: 'frutas_verduras',
  naranja: 'frutas_verduras', mandarina: 'frutas_verduras', limon: 'frutas_verduras',
  aguacate: 'frutas_verduras', tomate: 'frutas_verduras', cebolla: 'frutas_verduras',
  ajo: 'frutas_verduras', zanahoria: 'frutas_verduras', coliflor: 'frutas_verduras',
  brocoli: 'frutas_verduras', espinaca: 'frutas_verduras', lechuga: 'frutas_verduras',
  pepino: 'frutas_verduras', pimenton: 'frutas_verduras', apio: 'frutas_verduras',
  cilantro: 'frutas_verduras', perejil: 'frutas_verduras', oregano: 'aceites_condimentos',
  sal: 'aceites_condimentos', pimienta: 'aceites_condimentos', comino: 'aceites_condimentos',
  canela: 'aceites_condimentos', azucar: 'aceites_condimentos', panela: 'aceites_condimentos',
  aceite: 'aceites_condimentos', vinagre: 'aceites_condimentos',
  arroz: 'granos_pastas', pasta: 'granos_pastas', harina: 'granos_pastas',
  avena: 'granos_pastas', quinua: 'granos_pastas', lentejas: 'granos_pastas',
  frijol: 'granos_pastas', frijoles: 'granos_pastas', garbanzo: 'granos_pastas',
  leche: 'lacteos_huevos', queso: 'lacteos_huevos', yogurt: 'lacteos_huevos',
  huevo: 'lacteos_huevos', huevos: 'lacteos_huevos', mantequilla: 'lacteos_huevos',
  crema: 'lacteos_huevos',
  pan: 'panaderia', arepa: 'panaderia', tortilla: 'panaderia',
}

// Detectar pescadería por nombre (cuando categoria = proteina_animal pero es pescado)
const PALABRAS_PESCADO = ['pescado','salmon','salmón','tilapia','atun','atún','sardina','bacalao','trucha','merluza','bagre','mojarra','corvina','cachama','robalo']
function esPescado(nombre: string) {
  const n = nombre.toLowerCase()
  return PALABRAS_PESCADO.some(p => n.includes(p))
}

function norm(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

// ── Sistema de normalización para lista de compras ───────────────────────────
// Regla: mostrar QUÉ se compra en la tienda, no cómo se prepara en casa.

// Productos que deben mantenerse tal cual (se compran así en la tienda)
const MANTENER_EXACTO = [
  'carne molida','carne de res molida','pollo molido','cerdo molido',
  'tomate cherry','tomates cherry','tomate chonto','tomates chonto',
  'tomate pera','tomates pera','lomo de cerdo','lomo de res',
  'pasta de tomate','pasta de aji','pasta de chile',
  'leche de coco','crema de leche','leche condensada',
  'pan rallado','pan molido','azucar morena','azucar negra',
  'arroz integral','arroz blanco','arroz negro',
  'frijoles negros','frijoles rojos','lentejas verdes','lentejas rojas',
]

// Prefijos de procesamiento → el ingrediente base es lo que viene después
// "jugo de limón" → "limón", "pasta de ajo" → "ajo", "sopera de edulcorante" → "edulcorante"
const PREFIJOS_PROC = [
  'jugo de','zumo de','extracto de','esencia de',
  'pasta de','pure de','puro de','crema de','mantequilla de',
  'harina de','vinagre de','salsa de',
  // Unidades de medida usadas como nombre: "sopera de X" → X
  'cucharada sopera de','cucharadas soperas de',
  'cucharadita de','cucharaditas de',
  'cucharada de','cucharadas de',
  'sopera de','soperas de',
  'taza de','tazas de',
  'pizca de','pizcas de',
]

// Preparaciones que se hacen en CASA (no cambian lo que comprás)
const PREP_CASA = [
  'picado','picada','picados','picadas',
  'rallado','rallada','rallados','ralladas',
  'aplastado','aplastada','aplastados','aplastadas',
  'exprimido','exprimida','exprimidos','exprimidas',
  'triturado','triturada','triturados','trituradas',
  'machacado','machacada','machacados','machacadas',
  'cocido','cocida','cocidos','cocidas',
  'crudo','cruda','crudos','crudas',
  'fresco','fresca','frescos','frescas',
  'seco','seca','secos','secas',
  'troceado','troceada','troceados','troceadas',
  'cortado','cortada','cortados','cortadas',
  'rebanado','rebanada','rebanados','rebanadas',
  'fileteado','fileteada','fileteados','fileteadas',
  'finamente','grueso','gruesa','gruesos','gruesas',
  'mediano','mediana','medianos','medianas',
  'maduro','madura','maduros','maduras',
  'al gusto','al dente',
  'en rodajas','en cubos','en tiras','en juliana','en brunoise',
]

function normIngrediente(s: string): string {
  let n = norm(s)

  // 1. Quitar números y fracciones al inicio: "1/2 cebolla" → "cebolla"
  n = n.replace(/^[\d\/\.,\s]+/, '').trim()

  // 2. Revisar si es un producto especial que mantener exacto
  for (const exacto of MANTENER_EXACTO) {
    if (n.includes(norm(exacto))) return norm(exacto)
  }

  // 3. Quitar prefijos de procesamiento: "jugo de limón" → "limón"
  for (const pref of PREFIJOS_PROC) {
    if (n.startsWith(pref)) {
      n = n.slice(pref.length).trim()
      break
    }
  }

  // 4. Quitar unidades de conteo al inicio: "dientes de ajo" → "ajo"
  n = n.replace(/^(dientes?|hojas?|ramas?|cabezas?|trozos?|filetes?|presas?|manojos?|lonjas?|rodajas?|piezas?|gotas?)\s+de\s+/, '')

  // 5. Quitar preparaciones de casa en cualquier posición
  for (const p of PREP_CASA) {
    n = n.replace(new RegExp(`(^|\\s)${p.replace(/\s+/g,'\\s+')}(\\s|$)`, 'g'), ' ').trim()
  }

  return n.trim()
}

// ── Conversión de unidades a base común ───────────────────────────────────────
type Medida = { cantidad: number; unidad: string }

// Unidades de conteo que equivalen a "unidades" para agrupar ingredientes
const UNIDADES_CONTEO = new Set([
  'diente','dientes','hoja','hojas','rama','ramas','cabeza','cabezas',
  'trozo','trozos','filete','filetes','presa','presas','manojo','manojos',
  'loncha','lonchas','rebanada','rebanadas','pieza','piezas','gota','gotas',
  'pizca','pellizco',
])

function normUnidad(u: string): string {
  const ub = (u ?? '').toLowerCase().trim()
  if (UNIDADES_CONTEO.has(ub)) return 'unidades'
  return ub || 'unidades'
}

function convertirABase(cantidad: number, unidad: string): Medida {
  const u = normUnidad(unidad)
  if (u === 'kg')  return { cantidad: cantidad * 1000, unidad: 'g' }
  if (u === 'l')   return { cantidad: cantidad * 1000, unidad: 'ml' }
  return { cantidad, unidad: u }
}

function convertirDesdeBase(cantidad: number, unidad: string): Medida {
  if (unidad === 'g'  && cantidad >= 1000) return { cantidad: cantidad / 1000, unidad: 'kg' }
  if (unidad === 'ml' && cantidad >= 1000) return { cantidad: cantidad / 1000, unidad: 'l' }
  return { cantidad: Math.round(cantidad * 10) / 10, unidad }
}

// ── Generación de la lista ────────────────────────────────────────────────────
async function buildItems(
  familyId: string,
  fridgeItems: FridgeItem[]
): Promise<Omit<ShoppingListItem, 'id' | 'shopping_list_id'>[]> {

  const weekStart = getMondayOfWeek()

  // 1. Traer el menú activo con recetas e ingredientes
  const { data: menuEntries } = await supabase
    .from('weekly_menu')
    .select('recipe_id, servings, meal_type, recipes(nombre, porciones, ingredientes)')
    .eq('family_id', familyId)
    .eq('week_start', weekStart)
    .eq('is_main_recipe', true)

  if (!menuEntries?.length) return []

  // 2. Acumular ingredientes
  // clave: norm(nombre)::unidad_base → { nombre, cantBase, unidadBase, recetas, categoria }
  const acum = new Map<string, {
    nombre: string; cantBase: number; unidadBase: string
    recetas: Set<string>; categoria: string
  }>()

  for (const entry of menuEntries) {
    const recipe = (entry as Record<string, unknown>).recipes as {
      nombre: string; porciones: number | null; ingredientes: { nombre: string; cantidad: number | null; unidad: string | null; categoria: string; esencial: boolean }[]
    } | null
    if (!recipe) continue

    const scale = (recipe.porciones && recipe.porciones > 0)
      ? (entry.servings ?? 1) / recipe.porciones
      : 1

    for (const ing of (recipe.ingredientes ?? [])) {
      if (!ing.esencial) continue
      const cantRaw = (ing.cantidad ?? 1) * scale
      const { cantidad: cantBase, unidad: unidadBase } = convertirABase(cantRaw, ing.unidad ?? 'unidades')
      // Usar nombre base normalizado como clave para agrupar variantes del mismo ingrediente
      const nombreBase = normIngrediente(ing.nombre)
      const clave = `${nombreBase}::${unidadBase}`

      if (acum.has(clave)) {
        const e = acum.get(clave)!
        e.cantBase += cantBase
        e.recetas.add(recipe.nombre)
      } else {
        acum.set(clave, {
          nombre:     nombreBase,  // mostrar nombre limpio
          cantBase,
          unidadBase,
          recetas:    new Set([recipe.nombre]),
          categoria:  ing.categoria ?? 'otro',
        })
      }
    }
  }

  // 3. Cruzar con nevera
  const fridgeNorm = fridgeItems.map(f => ({
    nombre: norm(f.name),
    cantidad: f.quantity ?? 0,
    unidad:   (f.unit ?? 'unidades').toLowerCase(),
  }))

  const result: Omit<ShoppingListItem, 'id' | 'shopping_list_id'>[] = []

  for (const [, v] of acum.entries()) {
    const { cantidad, unidad } = convertirDesdeBase(v.cantBase, v.unidadBase)

    // Match contra nevera (nombre normalizado, coincidencia parcial)
    const fridgeMatch = fridgeNorm.find(f =>
      f.nombre.includes(norm(v.nombre)) || norm(v.nombre).includes(f.nombre)
    )

    let enNevera = false
    let faltante = true
    let cantFaltante = cantidad

    if (fridgeMatch) {
      enNevera = true
      const { cantidad: fridgeCantBase } = convertirABase(fridgeMatch.cantidad, fridgeMatch.unidad)
      if (fridgeCantBase >= v.cantBase * 0.8) {
        // Tiene suficiente (80% o más)
        faltante = false
        cantFaltante = 0
      } else {
        // Tiene parcial
        cantFaltante = Math.max(0, cantidad - fridgeMatch.cantidad)
      }
    }

    // Pasillo — override por nombre primero, luego por categoria
    const nombreNorm = norm(v.nombre)
    // Buscar override por nombre (palabra exacta o parcial al inicio)
    const overridePasillo = Object.entries(NOMBRE_A_PASILLO).find(([k]) =>
      nombreNorm === k || nombreNorm.startsWith(k + ' ') || nombreNorm.endsWith(' ' + k)
    )?.[1]

    let pasillo = overridePasillo ?? CATEGORIA_A_PASILLO[v.categoria] ?? 'otros'
    if (!overridePasillo && pasillo === 'carniceria' && esPescado(v.nombre)) pasillo = 'pescaderia'
    if (!overridePasillo && norm(v.nombre).includes('huevo')) pasillo = 'lacteos_huevos'
    if (!overridePasillo && (norm(v.nombre).startsWith('aceite'))) pasillo = 'aceites_condimentos'

    result.push({
      ingrediente_nombre: v.nombre,
      cantidad_total:     faltante ? cantFaltante : 0,
      unidad,
      categoria_pasillo:  pasillo,
      en_nevera:          enNevera,
      faltante,
      comprado:           false,
      recetas_origen:     [...v.recetas],
    })
  }

  return result.sort((a, b) => a.categoria_pasillo.localeCompare(b.categoria_pasillo))
}

export const useShoppingListStore = create<ShoppingListState>((set) => ({
  listId:    null,
  items:     [],
  loading:   false,
  generating: false,

  loadList: async (familyId) => {
    set({ loading: true })
    const weekStart = getMondayOfWeek()
    const { data: list } = await supabase
      .from('shopping_lists')
      .select('id')
      .eq('family_id', familyId)
      .eq('week_start', weekStart)
      .maybeSingle()

    if (!list) { set({ listId: null, items: [], loading: false }); return }

    const { data: items } = await supabase
      .from('shopping_list_items')
      .select('*')
      .eq('shopping_list_id', list.id)
      .order('categoria_pasillo')

    set({ listId: list.id, items: (items ?? []) as ShoppingListItem[], loading: false })
  },

  generateList: async (familyId, fridgeItems) => {
    set({ generating: true })
    const weekStart = getMondayOfWeek()

    // Borrar lista anterior de esta semana si existe
    await supabase.from('shopping_lists')
      .delete().eq('family_id', familyId).eq('week_start', weekStart)

    // Crear nueva lista
    const { data: list } = await supabase
      .from('shopping_lists')
      .insert({ family_id: familyId, week_start: weekStart })
      .select('id').single()

    if (!list) { set({ generating: false }); return }

    // Construir items
    const items = await buildItems(familyId, fridgeItems)

    if (items.length > 0) {
      await supabase.from('shopping_list_items').insert(
        items.map(item => ({ ...item, shopping_list_id: list.id }))
      )
    }

    // Recargar
    const { data: savedItems } = await supabase
      .from('shopping_list_items')
      .select('*')
      .eq('shopping_list_id', list.id)
      .order('categoria_pasillo')

    set({ listId: list.id, items: (savedItems ?? []) as ShoppingListItem[], generating: false })
  },

  toggleComprado: async (itemId, value) => {
    await supabase.from('shopping_list_items').update({ comprado: value }).eq('id', itemId)
    set(s => ({ items: s.items.map(i => i.id === itemId ? { ...i, comprado: value } : i) }))
  },
}))
