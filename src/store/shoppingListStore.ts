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

// Detectar pescadería por nombre (cuando categoria = proteina_animal pero es pescado)
const PALABRAS_PESCADO = ['pescado','salmon','salmón','tilapia','atun','atún','sardina','bacalao','trucha','merluza','bagre','mojarra','corvina','cachama','robalo']
function esPescado(nombre: string) {
  const n = nombre.toLowerCase()
  return PALABRAS_PESCADO.some(p => n.includes(p))
}

function norm(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

// ── Conversión de unidades a base común ───────────────────────────────────────
type Medida = { cantidad: number; unidad: string }

function convertirABase(cantidad: number, unidad: string): Medida {
  const u = (unidad ?? '').toLowerCase().trim()
  if (u === 'kg')  return { cantidad: cantidad * 1000, unidad: 'g' }
  if (u === 'l')   return { cantidad: cantidad * 1000, unidad: 'ml' }
  return { cantidad, unidad: u || 'unidades' }
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
      const clave = `${norm(ing.nombre)}::${unidadBase}`

      if (acum.has(clave)) {
        const e = acum.get(clave)!
        e.cantBase += cantBase
        e.recetas.add(recipe.nombre)
      } else {
        acum.set(clave, {
          nombre:     ing.nombre,
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

    // Pasillo
    let pasillo = CATEGORIA_A_PASILLO[v.categoria] ?? 'otros'
    if (pasillo === 'carniceria' && esPescado(v.nombre)) pasillo = 'pescaderia'
    // Huevos → lacteos_huevos
    if (norm(v.nombre).includes('huevo')) pasillo = 'lacteos_huevos'

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
