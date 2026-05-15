// ════════════════════════════════════════════════════════════════
// motorMenu.ts — Algoritmo puro de generación de menú semanal
// Sin side effects. Toma todo como input, devuelve el menú.
// ════════════════════════════════════════════════════════════════

import type { FamilyMember } from './types'
import { calcularMatch } from './matchReceta'
import { getFiltrosParaCondiciones } from './condicionesMotor'

export type MealType = 'desayuno' | 'almuerzo' | 'cena' | 'snack' | string
export type MealComponent = 'completo' | 'proteina' | 'carbohidrato' | 'guarnicion' | 'ensalada' | 'salsa' | 'vinagreta'
export type TipoComponente = 'proteina_principal' | 'guarnicion' | 'ensalada' | 'salsa' | 'vinagreta' | 'postre' | 'bebida' | 'merienda' | 'plato_unico'

export interface MenuConfig {
  id:                          string
  family_id:                   string
  planear_desayuno:            boolean
  planear_almuerzo:            boolean
  planear_cena:                boolean
  planear_snacks:              boolean
  distinguir_finde:            boolean
  cocina_frequency?:           'daily' | '2x_week' | '1x_week'
  dias_coccion?:               number[]   // 1=Lun … 7=Dom
  distinguir_dias_especiales?: boolean
  dias_especiales?:            number[]
}

export interface RecipeForMenu {
  id:                      string
  nombre:                  string
  tipo_comida:             string[]
  tipo_componente:         TipoComponente | null   // clasificación explícita desde BD
  etiqueta_practicidad:    'diario' | 'para_lucirme' | 'batch' | null
  dificultad:              'facil' | 'media' | 'dificil' | null
  tiempo_total_min:        number | null
  porciones:               number | null
  imagen_url:              string | null
  ingredientes:            { nombre: string; categoria: string; esencial: boolean }[]
  info_nutricional_aprox:  { calorias_porcion: number } | null
  perfiles: {
    ninos?:            boolean
    vegetariana?:      boolean
    deficit_calorico?: boolean
    embarazadas?:      boolean
    adultos_mayores?:  boolean
    keto?:             boolean
  }
  filtros_nutricionales: {
    sin_gluten?:         boolean
    sin_lacteos?:        boolean
    bajo_sodio?:         boolean
    bajo_azucar?:        boolean
    alto_proteina?:      boolean
    bajo_carbohidratos?: boolean
    alta_fibra?:         boolean
    bajo_grasa?:         boolean
    bajo_potasio?:       boolean
    bajo_purinas?:       boolean
  }
}

export interface ReactionData {
  recipe_id:  string
  member_id:  string
  reaction:   string
  rating:     number | null
}

export interface SuggestionData {
  recipe_id: string
  member_id: string
  status:    string
}

export interface FridgeItemMin {
  name: string
}

/** Asistencia granular: quién come en un slot específico */
export interface SlotAttendance {
  dayOfWeek:          number
  mealType:           MealType
  mealName:           string        // nombre exacto configurado, ej: "Merienda mañana"
  mealTime?:          string        // hora configurada, ej: "09:00"
  memberIds:          string[]
  totalServings:      number
  guestRestrictions:  string[]
}

/**
 * Mapea el nombre de comida del miembro (p.ej. "Merienda mañana") al tipo base del motor.
 * Usado para filtrar recetas por tipo_comida.
 */
export function normalizarTipoComida(mealName: string, hora?: string): MealType {
  const n = mealName.toLowerCase().trim()
  if (n.includes('desayuno'))  return 'desayuno'
  if (n.includes('almuerzo'))  return 'almuerzo'
  if (n.includes('cena'))      return 'cena'
  // Cualquier merienda/snack → 'snack'
  if (n.includes('merienda') || n.includes('snack') || n.includes('onces')) return 'snack'
  // Fallback por hora
  if (hora) {
    const h = parseInt(hora.split(':')[0] ?? '12')
    if (h < 10) return 'desayuno'
    if (h < 15) return 'almuerzo'
    if (h < 18) return 'snack'
    return 'cena'
  }
  return 'snack'
}

/**
 * Genera los meal slots únicos para la semana a partir de las comidas configuradas
 * por los miembros. Fusiona miembros que comparten el mismo nombre de comida.
 * Si los miembros no tienen comidas configuradas, usa los flags del config.
 */
export function buildMealSlots(
  allMembers: FamilyMember[],
  config: MenuConfig,
): { mealName: string; mealType: MealType; mealTime: string }[] {
  // Recolectar comidas únicas de todos los miembros
  const slotMap = new Map<string, { mealType: MealType; mealTime: string }>()

  for (const m of allMembers) {
    const meals = (m.meals_per_day ?? []) as { name: string; time: string }[]
    for (const meal of meals) {
      if (!meal.name) continue
      const key = meal.name.toLowerCase().trim()
      if (!slotMap.has(key)) {
        slotMap.set(key, {
          mealType: normalizarTipoComida(meal.name, meal.time),
          mealTime: meal.time ?? '',
        })
      }
    }
  }

  if (slotMap.size > 0) {
    // Ordenar por hora
    return [...slotMap.entries()]
      .map(([name, { mealType, mealTime }]) => ({
        mealName: name.charAt(0).toUpperCase() + name.slice(1),
        mealType,
        mealTime,
      }))
      .sort((a, b) => (a.mealTime < b.mealTime ? -1 : 1))
  }

  // Fallback: usar flags de config
  const fallback: { mealName: string; mealType: MealType; mealTime: string }[] = []
  if (config.planear_desayuno) fallback.push({ mealName: 'desayuno', mealType: 'desayuno', mealTime: '07:00' })
  if (config.planear_almuerzo) fallback.push({ mealName: 'almuerzo', mealType: 'almuerzo', mealTime: '13:00' })
  if (config.planear_cena)     fallback.push({ mealName: 'cena',     mealType: 'cena',     mealTime: '19:00' })
  if (config.planear_snacks)   fallback.push({ mealName: 'snack',    mealType: 'snack',    mealTime: '16:00' })
  return fallback
}

export interface LeftoverItem {
  ingredient_name: string   // nombre del sobrante (ej: 'pollo asado')
  created_at:      string
}

export interface AlgorithmInput {
  config:          MenuConfig
  allMembers:      FamilyMember[]
  slotAttendance:  SlotAttendance[]   // asistencia por día/comida
  fridgeItems:     FridgeItemMin[]
  allRecipes:      RecipeForMenu[]
  suggestions:     SuggestionData[]
  reactions:       ReactionData[]
  recentRecipeIds: Set<string>
  healthyMode:     boolean
  nivelNevera:     number   // 0-100: % de llenado de la nevera
  leftovers:       LeftoverItem[]  // sobras pendientes de usar
}

export interface MenuComponent {
  component:  MealComponent
  recipe:     RecipeForMenu
  memberId:   string | null   // null = toda la familia
  servings:   number
}

export interface MenuSlot {
  dayOfWeek:    number
  tipo:         MealType    // tipo base: 'desayuno' | 'almuerzo' | 'cena' | 'snack'
  mealName?:    string      // nombre configurado por el miembro, ej: "Merienda mañana"
  mealTime?:    string      // hora configurada, ej: "09:00"
  components:   MenuComponent[]   // proteína + carbs por miembro + ensalada
  /** @deprecated usar components */
  principal:    RecipeForMenu
  servings:     number
  alternativas: { memberId: string; recipe: RecipeForMenu }[]
}

// ── Utilidades ────────────────────────────────────────────────────────────────

function normalizar(s: string) { return s.toLowerCase().trim() }

/** True si algún ingrediente de la receta coincide con el texto dado */
function tieneIngrediente(recipe: RecipeForMenu, textos: string[]): boolean {
  const ingNombres = recipe.ingredientes.map(i => normalizar(i.nombre))
  return textos.some(t => ingNombres.some(n => n.includes(normalizar(t)) || normalizar(t).includes(n)))
}

// Mapa de proteína → keywords en nombres de ingredientes
const PROTEIN_KEYWORDS: Record<string, string[]> = {
  'pollo':    ['pollo', 'pechuga', 'muslo', 'contramuslo'],
  'res':      ['res', 'carne de res', 'lomo', 'bistec', 'cuadril', 'costilla de res'],
  'cerdo':    ['cerdo', 'puerco', 'tocino', 'chorizo', 'jamón', 'lomo de cerdo'],
  'pescado':  ['pescado', 'salmón', 'tilapia', 'trucha', 'bacalao', 'atún', 'sardinas'],
  'mariscos': ['mariscos', 'camarón', 'langostino', 'cangrejo', 'calamar', 'mejillón'],
  'huevos':   ['huevo'],
  'frijoles': ['frijol'],
  'lentejas': ['lenteja'],
  'garbanzos':['garbanzo'],
  'tofu':     ['tofu'],
  'soya':     ['soya', 'soja', 'edamame'],
}
const ALL_ANIMALES  = ['pollo', 'res', 'cerdo', 'pescado', 'mariscos', 'huevos']
const ALL_VEGETALES = ['frijoles', 'lentejas', 'garbanzos', 'tofu', 'soya']

/** True si el miembro puede comer esta receta (restricciones absolutas) */
function esCompatibleConMiembro(recipe: RecipeForMenu, m: FamilyMember): boolean {
  // Alergias
  if ((m.allergies ?? []).length && tieneIngrediente(recipe, m.allergies)) return false
  // Prohibidos
  if ((m.prohibited ?? []).length && tieneIngrediente(recipe, m.prohibited)) return false
  // Estilo de alimentación
  const es = m.eating_style
  // vegetarian (lacto-ovo): puede comer huevo y lácteos, no carne ni pescado
  if (es === 'vegetarian') {
    if (recipe.perfiles?.vegetariana === false) return false  // explícitamente no-vegetariana
    // Excluir si tiene proteína animal que NO sea huevo (carne, pescado, mariscos, embutido)
    const tieneCarneOPescado = recipe.ingredientes.some(i =>
      (i.categoria === 'proteina_animal' || i.categoria === 'embutido') &&
      !normalizar(i.nombre).includes('huevo')
    )
    if (tieneCarneOPescado) return false
  }
  // vegan: excluir si no-vegetariana O si tiene cualquier proteína animal (incluye huevo, lácteos)
  if (es === 'vegan' && (recipe.perfiles?.vegetariana === false || tieneProteinaAnimal(recipe))) return false
  if (es === 'keto'        && !recipe.perfiles?.keto)                           return false
  if (es === 'gluten_free' && !recipe.filtros_nutricionales?.sin_gluten)        return false
  if (es === 'lactose_free'&& !recipe.filtros_nutricionales?.sin_lacteos)       return false

  // Condiciones de salud → filtros nutricionales requeridos
  // Lógica: excluir receta si un filtro REQUERIDO está explícitamente en false.
  // Si el campo no existe en la receta (undefined), se da el beneficio de la duda.
  const condicionesSalud = (m as unknown as { condiciones_salud?: string[] }).condiciones_salud
  if (condicionesSalud && condicionesSalud.length > 0) {
    const filtrosRequeridos = getFiltrosParaCondiciones(condicionesSalud)
    for (const filtro of filtrosRequeridos) {
      const val = recipe.filtros_nutricionales?.[filtro as keyof typeof recipe.filtros_nutricionales]
      if (val === false) return false   // explícitamente marcado como NO apto
    }
  }

  // Proteínas que el miembro NO come (diferencia entre todas y las que sí come)
  const animalesQueSiCome  = (m as unknown as { proteinas_animales_que_si_come?: string[] }).proteinas_animales_que_si_come
  const vegetalesQueSiCome = (m as unknown as { proteinas_vegetales_que_si_come?: string[] }).proteinas_vegetales_que_si_come

  const excluidos: string[] = [
    ...(animalesQueSiCome  && animalesQueSiCome.length  > 0 ? ALL_ANIMALES.filter(p  => !animalesQueSiCome.includes(p))  : []),
    ...(vegetalesQueSiCome && vegetalesQueSiCome.length > 0 ? ALL_VEGETALES.filter(p => !vegetalesQueSiCome.includes(p)) : []),
  ]

  if (excluidos.length > 0) {
    const ingNombres = recipe.ingredientes.map(i => normalizar(i.nombre))
    for (const prot of excluidos) {
      const keywords = PROTEIN_KEYWORDS[prot] ?? [prot]
      if (keywords.some(k => ingNombres.some(n => n.includes(k)))) return false
    }
  }

  return true
}

/**
 * Multiplicador de porción por miembro según edad y objetivo.
 * Base = 1 porción estándar de la receta.
 */
export function calcularMultiplicadorPorcion(m: FamilyMember): number {
  const age  = m.age ?? 18
  if (age < 6)  return 0.50   // bebé/niño pequeño
  if (age < 12) return 0.65   // niño escolar
  if (age < 16) return 0.85   // adolescente

  const goal = m.goal
  if (goal === 'deficit' || goal === 'deficit_agresivo') return 0.80
  if (goal === 'volumen' || goal === 'crecimiento')       return 1.15

  return 1.0
}

/** Score de inventario usando calcularMatch (esenciales 80% + opcionales 20% + sustituciones) */
function scoreInventario(recipe: RecipeForMenu, fridge: FridgeItemMin[]): number {
  // Sin ingredientes → no podemos verificar disponibilidad → penalizar (no premiar)
  if (recipe.ingredientes.length === 0) return 10
  const result = calcularMatch(recipe.ingredientes, fridge)
  return result.porcentaje
}

/** True si la receta tiene al menos un ingrediente de proteína animal */
function tieneProteinaAnimal(recipe: RecipeForMenu): boolean {
  return recipe.ingredientes.some(i => i.categoria === 'proteina_animal')
}

/** Capa 2: componentes que quiere un miembro según su plantilla */
function plantillaDeComponentes(m: FamilyMember): {
  guarniciones: number
  quiereEnsalada: boolean
  quiereSalsa: boolean
} {
  const p = (m.plantilla_comida as string | undefined) ?? 'clasico_colombiano'
  let guarniciones =
    p === 'lowcarb_keto'  ? 0 :
    p === 'liviano'       ? 1 :
    p === 'personalizado' ? (m.guarniciones_por_comida ?? 1) :
    2   // clasico_colombiano y vegetariano

  // side_prefs retrocompatible: include_carbs=false fuerza 0 guarniciones
  if (m.side_prefs?.include_carbs === false) guarniciones = 0

  const quiereEnsalada = (m as { quiere_ensalada?: boolean }).quiere_ensalada
    ?? (m.side_prefs?.include_salad ?? true)
  const quiereSalsa = (m as { quiere_salsa?: boolean }).quiere_salsa ?? false

  return { guarniciones, quiereEnsalada, quiereSalsa }
}

/**
 * Clasifica una receta como componente de comida.
 * Usa tipo_componente de BD cuando está disponible; heurística como fallback.
 */
export function clasificarComponente(recipe: RecipeForMenu): MealComponent {
  // ── Capa 2: clasificación explícita desde BD ──────────────────────────────
  if (recipe.tipo_componente) {
    switch (recipe.tipo_componente) {
      case 'proteina_principal': return 'proteina'
      case 'guarnicion':         return 'guarnicion'
      case 'ensalada':           return 'ensalada'
      case 'salsa':              return 'salsa'
      case 'vinagreta':          return 'vinagreta'
      case 'plato_unico':        return 'completo'
      case 'postre':             return 'completo'
      case 'bebida':             return 'completo'
      case 'merienda':           return 'completo'
    }
  }

  // ── Fallback: heurística por nombre e ingredientes ────────────────────────
  // ORDEN IMPORTANTE: nombre primero, ratios de ingredientes después.
  // Esto evita que "Arroz con Coco" sea clasificado como salsa por tener
  // muchos condimentos, y que "Pollo con Yuca y Ensalada" sea ensalada.

  const nombre = normalizar(recipe.nombre)

  // 1. Bebidas
  if (recipe.tipo_comida.includes('bebida')) return 'completo'
  if (['leche', 'jugo', 'agua', 'té ', 'te ', 'café', 'cafe', 'smoothie', 'batido',
       'bebida', 'limonada', 'infusion'].some(k => nombre.includes(k))) return 'completo'

  // 2. Proteína por nombre (ANTES de los ratios)
  // Excepción solo si el nombre EMPIEZA con 'ensalada' (ej: "Ensalada de Pollo")
  const proteinKeywords = ['pollo', 'carne', 'res', 'cerdo', 'pescado', 'atún', 'atun', 'salmon', 'salmón',
    'camarón', 'camaron', 'huevo', 'huevos', 'tofu', 'lentejas', 'garbanzos', 'frijol', 'lomo', 'pechuga',
    'filete', 'costilla', 'chorizo', 'jamón', 'jamon', 'sardinas', 'bacalao', 'langostino']
  if (proteinKeywords.some(k => nombre.includes(k)) && !nombre.startsWith('ensalada')) return 'proteina'

  // 3. Guarnición/carbo por nombre (ANTES de ratios — evita que "Arroz con Coco" sea salsa)
  const carbKeywords = ['arroz', 'papa', 'plátano', 'platano', 'yuca', 'pasta', 'arepa', 'pan ', 'quinua',
    'maíz', 'maiz', 'patacón', 'patacon', 'puré', 'pure', 'coliflor', 'brócoli', 'brocoli', 'tapioca']
  if (carbKeywords.some(k => nombre.includes(k))) return 'guarnicion'

  // 4. Ensalada por nombre
  if (nombre.includes('ensalada') || nombre.includes('slaw') ||
      nombre.includes('tabule') || nombre.includes('tabulé')) return 'ensalada'

  // 5. Salsa/aderezo por nombre
  const salsaKeywords = ['salsa ', 'aderezo', 'vinagreta', 'mojo ', 'chimichurri', 'hogao']
  if (salsaKeywords.some(k => nombre.includes(k))) return 'salsa'

  // 6. Ratios de ingredientes (fallback final)
  const cats = recipe.ingredientes.map(i => i.categoria)
  const total = cats.length || 1

  const proteinCount  = cats.filter(c => c === 'proteina_animal' || c === 'embutido').length
  const granoCount    = cats.filter(c => c === 'grano').length
  const veggieCount   = cats.filter(c => c === 'vegetal' || c === 'fruta').length
  const legumbreCount = cats.filter(c => c === 'legumbre').length
  const condCount     = cats.filter(c => c === 'condimento').length

  if (condCount / total >= 0.5) return 'salsa'
  if (proteinCount / total >= 0.30) return 'proteina'
  if ((granoCount + legumbreCount) / total >= 0.35 && proteinCount / total < 0.2) return 'guarnicion'
  if (veggieCount / total >= 0.50 && proteinCount / total < 0.15) return 'ensalada'

  return 'completo'
}

/** Guarnición: carbo o acompañamiento (usa tipo_componente si está disponible) */
const CARBS_KEYWORDS = ['arroz', 'papa', 'plátano', 'platano', 'patacón', 'patacon', 'yuca', 'pasta', 'pan ', 'arepa', 'quinua', 'maíz', 'maiz']
export function esCarbohidratoAcompa(recipe: RecipeForMenu): boolean {
  if (recipe.tipo_componente === 'guarnicion') return true
  if (recipe.tipo_componente) return false  // tipo explícito != guarnicion → no es guarnición
  const nombre = normalizar(recipe.nombre)
  return CARBS_KEYWORDS.some(k => nombre.includes(k)) || ['carbohidrato', 'guarnicion'].includes(clasificarComponente(recipe))
}
// Alias semántico
export const esGuarnicion = esCarbohidratoAcompa

export function esEnsalada(recipe: RecipeForMenu): boolean {
  if (recipe.tipo_componente === 'ensalada') return true
  if (recipe.tipo_componente) return false  // tipo explícito != ensalada → no es ensalada
  const nombre = normalizar(recipe.nombre)
  return nombre.includes('ensalada') || nombre.includes('slaw') || clasificarComponente(recipe) === 'ensalada'
}

export function esSalsa(recipe: RecipeForMenu): boolean {
  if (recipe.tipo_componente === 'salsa' || recipe.tipo_componente === 'vinagreta') return true
  if (recipe.tipo_componente) return false  // tipo explícito → no es salsa
  return clasificarComponente(recipe) === 'salsa'
}

/** Detecta si dos recetas son "similares" por nombre (evita duplicados temáticos) */
export function sonSimilares(a: string, b: string): boolean {
  const words = (s: string) => normalizar(s).split(/\s+/).filter(w => w.length > 3)
  const wa = words(a), wb = words(b)
  const common = wa.filter(w => wb.includes(w))
  if (common.length === 0) return false
  // Si comparten 2+ palabras significativas → misma preparación base
  if (common.length >= 2) return true
  // Si la palabra compartida es la "estrella" (primera palabra sustantiva del nombre) → similar
  // Ej: "Avena con chía y plátano" vs "Avena nocturna con cacao" → ambas son avena
  const primeraA = wa[0], primeraB = wb[0]
  if (primeraA && primeraB && primeraA === primeraB) return true
  return false
}

/** Calcular score combinado para una receta en un slot dado */
function calcularScore(
  recipe:            RecipeForMenu,
  input:             AlgorithmInput,
  usedThisWeek:      Set<string>,
  proteinDaysUsed:   number,
  activeMemberIds:   Set<string>,
  isDayFinde:        boolean,
  tipo:              MealType,
): number {
  // Filtro base de tipo_comida
  if (!recipe.tipo_comida.includes(tipo === 'snack' ? 'snack' : tipo)) return -1

  // Excluir bebidas de almuerzo y cena (leche de ajonjolí, jugos, etc. no son platos principales)
  if (tipo === 'almuerzo' || tipo === 'cena') {
    if (recipe.tipo_comida.includes('bebida')) return -1
    const n = normalizar(recipe.nombre)
    const esBebida = ['leche', 'jugo', 'agua', 'té ', 'te ', 'café', 'cafe',
      'smoothie', 'batido', 'bebida', 'limonada', 'infusion', 'zumo', 'refresco',
      'tizana', 'chicha', 'aguapanela', 'agua de'].some(k => n.includes(k))
    if (esBebida) return -1
  }

  // Variedad: no repetir misma semana
  if (usedThisWeek.has(recipe.id)) return -1

  // Dificultad según día
  if (input.config.distinguir_finde) {
    if (!isDayFinde && recipe.dificultad === 'dificil') return -1
    if (isDayFinde  && recipe.dificultad === 'facil')   return -1
  }

  // Modo saludable
  if (input.healthyMode) {
    if (!recipe.filtros_nutricionales?.bajo_sodio)  return -1
    if (!recipe.filtros_nutricionales?.bajo_azucar) return -1
  }

  // Dislike de algún miembro activo → excluir
  const hasDislike = input.reactions.some(r =>
    r.recipe_id === recipe.id &&
    r.reaction === 'dislike' &&
    activeMemberIds.has(r.member_id)
  )
  if (hasDislike) return -1

  // Score de inventario — peso según nivel de nevera
  const sInventario = scoreInventario(recipe, input.fridgeItems)

  // Threshold escalonado: nevera llena → excluir recetas sin match
  const nv = input.nivelNevera ?? 0
  if (nv >= 60 && sInventario < 50) return -1   // nevera llena: excluir si <50% match
  if (nv >= 40 && sInventario < 30) return -1   // nevera media: excluir si <30% match
  if (nv >= 20 && sInventario < 15) return -1   // nevera baja: excluir si <15% match

  // Score de sugerencias (20%)
  const hasSuggestion = input.suggestions.some(s =>
    s.recipe_id === recipe.id &&
    s.status === 'pending' &&
    activeMemberIds.has(s.member_id)
  )
  const sRatings = input.reactions.filter(r =>
    r.recipe_id === recipe.id && r.rating != null && activeMemberIds.has(r.member_id)
  )
  const hasBookmark = input.reactions.some(r =>
    r.recipe_id === recipe.id && r.reaction === 'bookmark' && activeMemberIds.has(r.member_id)
  )
  const sSugerencia = hasSuggestion ? 100 : hasBookmark ? 50 : 0

  // Score de rating (20%)
  const sRating = sRatings.length
    ? (sRatings.reduce((sum, r) => sum + (r.rating ?? 0), 0) / sRatings.length) * 20
    : 50  // neutro si no hay ratings

  // Score de variedad (15%): recetas recientes bajan puntaje
  const sVariedad = input.recentRecipeIds.has(recipe.id) ? 20 : 100

  // Bonus por ingredientes favoritos del miembro (10%)
  const activeMembers = input.allMembers.filter(m => activeMemberIds.has(m.id!))
  const lovesBonus = activeMembers.some(m =>
    (m.loves ?? []).some(loved => tieneIngrediente(recipe, [loved]))
  ) ? 100 : 0

  // Bonus por recetas favoritas — match exacto por ID (más confiable que nombre)
  const favRecipeBonus = activeMembers.some(m =>
    (m.favorite_recipes ?? []).includes(recipe.id)
  ) ? 60 : 0  // suma fija, no porcentual

  // Penalty si ya usamos mucha proteína animal esta semana
  const sProtein = tieneProteinaAnimal(recipe) && proteinDaysUsed >= 3 ? -30 : 0

  // Bonus por sobras: +200 si la receta usa algún sobrante pendiente
  const leftovers = input.leftovers ?? []
  const sobrasBonus = leftovers.length > 0 && leftovers.some(lft => {
    const lftNorm = lft.ingredient_name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    return tieneIngrediente(recipe, [lftNorm])
  }) ? 200 : 0

  // Peso de inventario escala con nivel de nevera
  const nv2 = input.nivelNevera ?? 0
  const pesoInventario = nv2 >= 60 ? 0.60 : nv2 >= 40 ? 0.50 : 0.40
  const pesoOtros      = 1 - pesoInventario

  // Ruido aleatorio ±8 para romper empates y generar variedad en cada regeneración
  const sRandom = (Math.random() - 0.5) * 16

  return (
    sInventario  * pesoInventario +
    sSugerencia  * (0.20 * pesoOtros / 0.65) +
    sRating      * (0.20 * pesoOtros / 0.65) +
    sVariedad    * (0.15 * pesoOtros / 0.65) +
    lovesBonus   * (0.10 * pesoOtros / 0.65) +
    sobrasBonus  +
    sProtein     +
    favRecipeBonus +
    sRandom
  )
}

// ── Función principal ─────────────────────────────────────────────────────────

// Máximo de veces que puede repetir un acompañamiento en la semana
export const MAX_ACCOMPA_WEEK = 2

export function generarMenuSemanal(input: AlgorithmInput): MenuSlot[] {
  const { config, allMembers, slotAttendance, allRecipes } = input

  const result:             MenuSlot[] = []
  const usedThisWeek         = new Set<string>()    // almuerzo/cena platos principales
  const usedThisWeekProtOnly = new Set<string>()    // solo proteínas (para acompañamientos)
  const carbWeekTrack  = new Map<string, { count: number; lastDay: number }>()
  const saladWeekTrack = new Map<string, { count: number; lastDay: number }>()
  // Desayuno/snack: cada miembro tiene su propio historial semanal
  const usedPerMember  = new Map<string, Set<string>>()
  let   proteinDaysUsed = 0
  let   usedYesterdayNames: string[] = []  // nombres del día anterior para evitar repetir

  // Construir lista de comidas a planificar (respeta meals_per_day de miembros)
  const mealSlots = buildMealSlots(allMembers, config)

  // ── Reglas de practicidad ─────────────────────────────────────────────────
  const TIEMPO_MAX: Record<string, number> = {
    desayuno: 20,
    almuerzo: 45,
    cena:     25,
    snack:    10,
  }

  /** Filtra recetas según etiqueta_practicidad y tiempo máximo del slot */
  function filtrarPorPracticidad(
    recetas: RecipeForMenu[],
    tipo: MealType,
    isDayFinde: boolean,
    fallback = false
  ): RecipeForMenu[] {
    const tiempoMax = isDayFinde ? null : (TIEMPO_MAX[tipo] ?? null)

    const aptas = recetas.filter(r => {
      // batch nunca aparece como plato principal del menú
      if (r.etiqueta_practicidad === 'batch') return false
      // entre semana: solo 'diario'
      if (!isDayFinde && r.etiqueta_practicidad === 'para_lucirme') return false
      // tiempo máximo entre semana
      if (tiempoMax && r.tiempo_total_min && r.tiempo_total_min > tiempoMax) return false
      return true
    })

    // Fallback: si no hay candidatas, ampliar gradualmente
    if (aptas.length === 0 && !fallback) {
      // Paso 1: ignorar tiempo pero mantener etiqueta
      const sinTiempo = recetas.filter(r => r.etiqueta_practicidad !== 'batch' && (!isDayFinde ? r.etiqueta_practicidad !== 'para_lucirme' : true))
      if (sinTiempo.length > 0) return sinTiempo
      // Paso 2: ignorar todo excepto batch
      return recetas.filter(r => r.etiqueta_practicidad !== 'batch')
    }

    return aptas
  }

  for (let day = 1; day <= 7; day++) {
    const isDayFinde     = day >= 6
    const usedToday      = new Set<string>()   // resetea cada día — evita repetir en mismo día
    const usedTodayNames: string[] = []         // para detectar recetas similares en el mismo día

    for (const { mealName, mealType: tipo, mealTime } of mealSlots) {
      // Buscar por mealName exacto primero (distingue "Merienda mañana" de "Merienda tarde"),
      // luego por mealType como fallback para slots sin nombre custom
      const slot = slotAttendance.find(s =>
        s.dayOfWeek === day && s.mealName.toLowerCase() === mealName.toLowerCase()
      ) ?? slotAttendance.find(s =>
        s.dayOfWeek === day && s.mealType === tipo
      )
      const slotMemberIds  = slot?.memberIds  ?? allMembers.map(m => m.id!)
      const slotServings   = slot?.totalServings ?? allMembers.length
      const slotMembers    = allMembers.filter(m => slotMemberIds.includes(m.id!))
      const activeMemberIds= new Set(slotMemberIds)

      // Si no hay nadie en este slot, saltar
      if (slotServings === 0 || slotMembers.length === 0) continue

      // Restricciones extra de invitados (por notas)
      const guestRestrictions = slot?.guestRestrictions ?? []
      void mealTime // usado en el resultado final

      // ── DESAYUNO Y SNACK: optimizado para preparación ──────────────────────
      // Estrategia: (1) encontrar la receta que MÁS gente puede compartir,
      // (2) quien necesite variación → solo recetas rápidas/fáciles,
      // (3) bonus batch si la familia cocina 1–2 veces por semana.
      if (tipo === 'desayuno' || tipo === 'snack') {
        const isBatch = config.cocina_frequency === '1x_week' || config.cocina_frequency === '2x_week'

        // Pool general: compatible con al menos un miembro, tipo correcto, no usada hoy ni ayer
        // Para desayuno: excluir guarniciones y ensaladas sueltas (no son platos de desayuno)
        const TC_INVALIDOS_DESAYUNO = new Set(['guarnicion', 'ensalada', 'salsa', 'vinagreta'])
        const poolBase = filtrarPorPracticidad(allRecipes, tipo, isDayFinde)
        const pool = poolBase.filter(r => {
          if (!r.tipo_comida.includes(tipo)) return false
          if (tipo === 'desayuno' && r.tipo_componente && TC_INVALIDOS_DESAYUNO.has(r.tipo_componente)) return false
          if (usedToday.has(r.id)) return false
          if (guestRestrictions.includes('vegetariana') && !r.perfiles?.vegetariana) return false
          if (guestRestrictions.includes('sin_gluten')  && !r.filtros_nutricionales?.sin_gluten)  return false
          if (guestRestrictions.includes('sin_lacteos') && !r.filtros_nutricionales?.sin_lacteos) return false
          // No repetir preparación del día anterior
          if (usedYesterdayNames.some(n => sonSimilares(r.nombre, n))) return false
          return slotMembers.some(m => esCompatibleConMiembro(r, m))
        })

        // 1. Receta base: la que maximiza el score sumado + bonus por cantidad de personas que la comparten
        let baseRecipe: RecipeForMenu | null = null
        let baseScore  = -Infinity

        for (const r of pool) {
          let sumScore = 0; let compatCount = 0
          for (const m of slotMembers) {
            if (!esCompatibleConMiembro(r, m)) continue
            const mUsed = usedPerMember.get(m.id!) ?? new Set<string>()
            if (mUsed.has(r.id)) continue
            const s = calcularScore(r, input, mUsed, 0, new Set([m.id!]), isDayFinde, tipo)
            if (s >= 0) { sumScore += s; compatCount++ }
          }
          if (compatCount === 0) continue
          // Bonus por preparación compartida: más personas → menos trabajo
          // ×50 por persona + 100 extra si la receta es compatible con TODOS (máxima preferencia)
          const shareBonus    = compatCount * 50
          const allShareBonus = compatCount === slotMembers.length ? 100 : 0
          // Bonus batch: recetas fáciles/rápidas se priorizan si se cocina poco
          const batchBonus = isBatch && (r.dificultad === 'facil' || (r.tiempo_total_min ?? 999) <= 20) ? 25 : 0
          const combined = sumScore + shareBonus + allShareBonus + batchBonus
          if (combined > baseScore) { baseScore = combined; baseRecipe = r }
        }

        // Fallback: pool agotado por deduplicación semanal → permitir repetición
        if (!baseRecipe) {
          for (const r of pool) {
            let sumScore = 0; let compatCount = 0
            for (const m of slotMembers) {
              if (!esCompatibleConMiembro(r, m)) continue
              const mUsed = new Set<string>()   // ignorar historial semanal
              const s = calcularScore(r, input, mUsed, 0, new Set([m.id!]), isDayFinde, tipo)
              if (s >= 0) { sumScore += s; compatCount++ }
            }
            if (compatCount === 0) continue
            const combined = sumScore + compatCount * 50 + (compatCount === slotMembers.length ? 100 : 0)
            if (combined > baseScore) { baseScore = combined; baseRecipe = r }
          }
        }

        if (!baseRecipe) continue

        usedToday.add(baseRecipe.id)
        usedTodayNames.push(baseRecipe.nombre)

        // 2. Asignar base a quien le va bien; detectar quién necesita variante
        const onBase: string[]    = []
        const needAlt: FamilyMember[] = []

        for (const m of slotMembers) {
          const mUsed = usedPerMember.get(m.id!) ?? new Set<string>()
          const canEat = esCompatibleConMiembro(baseRecipe, m) && !mUsed.has(baseRecipe.id)
          const baseS  = canEat
            ? calcularScore(baseRecipe, input, mUsed, 0, new Set([m.id!]), isDayFinde, tipo)
            : -1
          if (baseS >= 0) {
            onBase.push(m.id!)
            const u = new Set(mUsed); u.add(baseRecipe.id); usedPerMember.set(m.id!, u)
          } else {
            needAlt.push(m)
          }
        }

        // 3. Variantes para quienes no se adaptan a la base
        //    → solo recetas RÁPIDAS/FÁCILES, distintas a la base y entre sí
        const altUsed  = new Set<string>([baseRecipe.id])
        const altMap   = new Map<string, RecipeForMenu>()   // memberId → recipe

        for (const m of needAlt) {
          const mUsed = usedPerMember.get(m.id!) ?? new Set<string>()
          // Excluir recetas similares a la base O a alternativas ya asignadas hoy
          const noSimilarHoy = (r: RecipeForMenu) =>
            !usedTodayNames.some(n => sonSimilares(r.nombre, n)) &&
            !usedYesterdayNames.some(n => sonSimilares(r.nombre, n))

          // Candidatas simples primero (≤25min o fácil); si no hay, abrir más
          const simple = pool.filter(r =>
            esCompatibleConMiembro(r, m) && !mUsed.has(r.id) &&
            !usedToday.has(r.id) && !altUsed.has(r.id) &&
            noSimilarHoy(r) &&
            (r.dificultad === 'facil' || (r.tiempo_total_min ?? 999) <= 25)
          )
          const broader = pool.filter(r =>
            esCompatibleConMiembro(r, m) && !mUsed.has(r.id) &&
            !usedToday.has(r.id) && !altUsed.has(r.id) &&
            noSimilarHoy(r)
          )
          const candidates = simple.length > 0 ? simple : broader

          let best: RecipeForMenu | null = null, bestS = -Infinity
          for (const r of candidates) {
            const s = calcularScore(r, input, mUsed, 0, new Set([m.id!]), isDayFinde, tipo)
            if (s > bestS) { bestS = s; best = r }
          }

          if (best) {
            altMap.set(m.id!, best)
            altUsed.add(best.id)
            usedToday.add(best.id)
            usedTodayNames.push(best.nombre)
            const u = new Set(mUsed); u.add(best.id); usedPerMember.set(m.id!, u)
          } else {
            // Fallback: unirlos a la base aunque no sea ideal
            onBase.push(m.id!)
            const u = new Set(mUsed); u.add(baseRecipe.id); usedPerMember.set(m.id!, u)
          }
        }

        // 4. Construir componentes
        // memberId=null significa "toda la familia" — solo usarlo cuando el slot
        // incluye a TODOS los miembros de la familia (no un subconjunto como "solo Sarah")
        const components: MenuComponent[] = []
        const slotEsTodaLaFamilia = slotMembers.length === allMembers.length

        if (onBase.length === slotMembers.length && slotEsTodaLaFamilia) {
          components.push({ component: 'completo', recipe: baseRecipe, memberId: null, servings: slotServings })
        } else {
          for (const id of onBase) {
            components.push({ component: 'completo', recipe: baseRecipe, memberId: id, servings: 1 })
          }
        }

        // Agrupar alternativas por receta para unir a quienes coinciden
        const altGroups = new Map<string, { recipe: RecipeForMenu; ids: string[] }>()
        for (const [id, r] of altMap) {
          if (!altGroups.has(r.id)) altGroups.set(r.id, { recipe: r, ids: [] })
          altGroups.get(r.id)!.ids.push(id)
        }
        for (const { recipe, ids } of altGroups.values()) {
          for (const id of ids) {
            components.push({ component: 'completo', recipe, memberId: id, servings: 1 })
          }
        }

        if (components.length === 0) continue
        result.push({ dayOfWeek: day, tipo, mealName, mealTime, components, servings: slotServings, alternativas: [], principal: baseRecipe })
        continue
      }

      // ── ALMUERZO Y CENA: proteína compartida + acompañamientos por miembro ──

      // Filtrar por practicidad y tiempo máximo según el día
      const recipesPracticidad = filtrarPorPracticidad(allRecipes, tipo, isDayFinde)

      // Filtrar recetas compatibles con los miembros presentes en este slot
      const compatibleConTodos = recipesPracticidad.filter(r => {
        if (!slotMembers.every(m => esCompatibleConMiembro(r, m))) return false
        // Aplicar restricciones de invitados
        if (guestRestrictions.includes('vegetariana') && !r.perfiles?.vegetariana) return false
        if (guestRestrictions.includes('sin_gluten')  && !r.filtros_nutricionales?.sin_gluten)  return false
        if (guestRestrictions.includes('sin_lacteos') && !r.filtros_nutricionales?.sin_lacteos) return false
        return true
      })
      const compatibleConAlguno = recipesPracticidad.filter(r =>
        slotMembers.some(m => esCompatibleConMiembro(r, m))
      )

      // Buscar mejor receta
      let bestScore  = -Infinity
      let bestRecipe: RecipeForMenu | null = null

      for (const r of compatibleConTodos) {
        const score = calcularScore(r, input, usedThisWeek, proteinDaysUsed, activeMemberIds, isDayFinde, tipo)
        if (score > bestScore) { bestScore = score; bestRecipe = r }
      }
      if (!bestRecipe || bestScore < 0) {
        for (const r of compatibleConAlguno) {
          const score = calcularScore(r, input, usedThisWeek, proteinDaysUsed, activeMemberIds, isDayFinde, tipo)
          if (score > bestScore) { bestScore = score; bestRecipe = r }
        }
      }
      if (!bestRecipe) continue

      // Registrar el ganador inicial como plato principal (impide que repita como plato)
      usedThisWeek.add(bestRecipe.id)
      usedToday.add(bestRecipe.id)
      usedTodayNames.push(bestRecipe.nombre)
      if (tieneProteinaAnimal(bestRecipe)) proteinDaysUsed++
      // Si el ganador inicial ya es proteína, registrar también en el set de proteínas
      const initialComp = clasificarComponente(bestRecipe)
      if (initialComp === 'proteina' || initialComp === 'completo') {
        usedThisWeekProtOnly.add(bestRecipe.id)
      }

      // Alternativas para miembros incompatibles — siempre buscar PROTEÍNA primero
      const alternativas: MenuSlot['alternativas'] = []
      const altUsedIds = new Set<string>([bestRecipe.id])

      for (const m of slotMembers) {
        if (esCompatibleConMiembro(bestRecipe, m)) continue

        // 1. Buscar proteína compatible con este miembro
        const proteinCandidates = allRecipes.filter(r =>
          !altUsedIds.has(r.id) &&
          esCompatibleConMiembro(r, m) &&
          !r.tipo_comida.includes('bebida') &&
          (clasificarComponente(r) === 'proteina' || r.tipo_componente === 'proteina_principal')
        )
        let altScore = -Infinity, altRecipe: RecipeForMenu | null = null
        for (const r of proteinCandidates) {
          const s = calcularScore(r, input, usedThisWeek, proteinDaysUsed, new Set([m.id!]), isDayFinde, tipo)
          if (s > altScore) { altScore = s; altRecipe = r }
        }

        // 2. Fallback: si no hay proteína disponible, buscar plato completo
        if (!altRecipe) {
          for (const r of allRecipes) {
            if (altUsedIds.has(r.id) || !esCompatibleConMiembro(r, m)) continue
            const s = calcularScore(r, input, usedThisWeek, proteinDaysUsed, new Set([m.id!]), isDayFinde, tipo)
            if (s > altScore) { altScore = s; altRecipe = r }
          }
        }

        if (altRecipe) {
          alternativas.push({ memberId: m.id!, recipe: altRecipe })
          altUsedIds.add(altRecipe.id)
          usedThisWeek.add(altRecipe.id)
          usedThisWeekProtOnly.add(altRecipe.id)
        }
      }

      // IDs de miembros incompatibles — se excluyen de los acompañamientos familiares
      const incompatibleIds = new Set(alternativas.map(a => a.memberId))

      // ── Construir componentes del slot ──────────────────────────────────────
      const components: MenuComponent[] = []

      // ── Determinar si desglosa en componentes o plato único ─────────────────
      // Para almuerzo/cena: siempre buscar proteína ancla primero
      let mainComponent = clasificarComponente(bestRecipe)

      // Si el "mejor" no es proteína/completo (p.ej. una bebida o carbo ganó el score),
      // buscar explícitamente una proteína entre los compatibles
      if ((tipo === 'almuerzo' || tipo === 'cena') && mainComponent !== 'proteina' && mainComponent !== 'completo') {
        const proteinaCandidates = compatibleConTodos.filter(r =>
          clasificarComponente(r) === 'proteina' &&
          !r.tipo_comida.includes('bebida') &&
          !usedThisWeek.has(r.id)
        )
        let bestProt: RecipeForMenu | null = null, bestProtScore = -Infinity
        for (const r of proteinaCandidates) {
          const s = calcularScore(r, input, usedThisWeek, proteinDaysUsed, activeMemberIds, isDayFinde, tipo)
          if (s > bestProtScore) { bestProtScore = s; bestProt = r }
        }
        if (bestProt) {
          bestRecipe    = bestProt
          mainComponent = 'proteina'
          // ── FIX: registrar el fallback protein en ambos sets ─────────────
          // Sin esto, la misma proteína podía ganar en almuerzo Y cena del mismo día
          usedThisWeek.add(bestProt.id)
          usedThisWeekProtOnly.add(bestProt.id)
          if (!usedToday.has(bestProt.id)) {
            usedToday.add(bestProt.id)
            usedTodayNames.push(bestProt.nombre)
          }
        } else {
          mainComponent = 'completo'
        }
      }

      if (mainComponent === 'completo') {
        // Plato único para todos (proteína no encontrada → se sirve como plato completo)
        components.push({ component: mainComponent, recipe: bestRecipe, memberId: null, servings: slotServings })
        for (const alt of alternativas) {
          components.push({ component: mainComponent, recipe: alt.recipe, memberId: alt.memberId, servings: 1 })
        }
      } else {
        // ── Almuerzo/cena: proteína + guarniciones + ensalada + salsa opcional ─
        // La proteína base solo es para los miembros COMPATIBLES con ella
        const compatibleServings = slotMembers.filter(m => !incompatibleIds.has(m.id!)).length || slotServings
        components.push({ component: 'proteina', recipe: bestRecipe, memberId: null, servings: compatibleServings })

        // Filtro base de acompañamientos: no repetir mismo día, no consecutivos, máx 2/semana
        const filterAcompa = (track: Map<string, { count: number; lastDay: number }>, r: RecipeForMenu) => {
          if (usedToday.has(r.id)) return false
          if (r.id === bestRecipe.id) return false
          if (usedTodayNames.some(n => sonSimilares(r.nombre, n))) return false
          const t = track.get(r.id)
          if (!t) return true
          if (t.count >= MAX_ACCOMPA_WEEK) return false
          if (day - t.lastDay <= 1) return false
          return true
        }

        const guarnicionPool = allRecipes.filter(r => esGuarnicion(r) && filterAcompa(carbWeekTrack, r))
        const saladPool      = allRecipes.filter(r => esEnsalada(r)   && filterAcompa(saladWeekTrack, r))
        const salsaPool      = allRecipes.filter(r => esSalsa(r) && !usedToday.has(r.id) && r.id !== bestRecipe.id)

        // Acompañamientos familiares: solo miembros que comen la proteína base
        // (los incompatibles reciben su propia comida completa más abajo)
        const compatibleMembers = slotMembers.filter(m => !incompatibleIds.has(m.id!))
        const membersWantG1   = compatibleMembers.filter(m => plantillaDeComponentes(m).guarniciones >= 1)
        const membersWantG2   = compatibleMembers.filter(m => plantillaDeComponentes(m).guarniciones >= 2)
        const membersWantSalad = compatibleMembers.filter(m => plantillaDeComponentes(m).quiereEnsalada)
        const membersWantSalsa = compatibleMembers.filter(m => plantillaDeComponentes(m).quiereSalsa)

        // Guarnición 1
        let guarn1: RecipeForMenu | null = null
        if (membersWantG1.length > 0 && guarnicionPool.length > 0) {
          let bestS = -Infinity
          for (const r of guarnicionPool) {
            const s = calcularScore(r, input, usedThisWeekProtOnly, proteinDaysUsed,
              new Set(membersWantG1.map(m => m.id!)), isDayFinde, tipo)
            if (s > bestS) { bestS = s; guarn1 = r }
          }
          if (guarn1) {
            const servings = membersWantG1.length
            if (servings === slotMembers.length) {
              components.push({ component: 'guarnicion', recipe: guarn1, memberId: null, servings })
            } else {
              for (const m of membersWantG1) {
                components.push({ component: 'guarnicion', recipe: guarn1, memberId: m.id!, servings: 1 })
              }
            }
            usedToday.add(guarn1.id); usedTodayNames.push(guarn1.nombre)
            const ct = carbWeekTrack.get(guarn1.id) ?? { count: 0, lastDay: 0 }
            carbWeekTrack.set(guarn1.id, { count: ct.count + 1, lastDay: day })
          }
        }

        // Guarnición 2 (distinta de la 1ª)
        if (membersWantG2.length > 0) {
          const pool2 = guarnicionPool.filter(r => r.id !== guarn1?.id)
          let bestG2: RecipeForMenu | null = null, bestS2 = -Infinity
          for (const r of pool2) {
            const s = calcularScore(r, input, usedThisWeekProtOnly, proteinDaysUsed,
              new Set(membersWantG2.map(m => m.id!)), isDayFinde, tipo)
            if (s > bestS2) { bestS2 = s; bestG2 = r }
          }
          if (bestG2) {
            const servings = membersWantG2.length
            if (servings === slotMembers.length) {
              components.push({ component: 'guarnicion', recipe: bestG2, memberId: null, servings })
            } else {
              for (const m of membersWantG2) {
                components.push({ component: 'guarnicion', recipe: bestG2, memberId: m.id!, servings: 1 })
              }
            }
            usedToday.add(bestG2.id); usedTodayNames.push(bestG2.nombre)
            const ct = carbWeekTrack.get(bestG2.id) ?? { count: 0, lastDay: 0 }
            carbWeekTrack.set(bestG2.id, { count: ct.count + 1, lastDay: day })
          }
        }

        // Ensalada
        if (membersWantSalad.length > 0 && saladPool.length > 0) {
          let bestSalad: RecipeForMenu | null = null, bestSs = -Infinity
          for (const r of saladPool) {
            const s = calcularScore(r, input, usedThisWeekProtOnly, proteinDaysUsed,
              new Set(membersWantSalad.map(m => m.id!)), isDayFinde, tipo)
            if (s > bestSs) { bestSs = s; bestSalad = r }
          }
          if (bestSalad) {
            const servings = membersWantSalad.length
            if (servings === slotMembers.length) {
              components.push({ component: 'ensalada', recipe: bestSalad, memberId: null, servings })
            } else {
              for (const m of membersWantSalad) {
                components.push({ component: 'ensalada', recipe: bestSalad, memberId: m.id!, servings: 1 })
              }
            }
            usedToday.add(bestSalad.id); usedTodayNames.push(bestSalad.nombre)
            const st = saladWeekTrack.get(bestSalad.id) ?? { count: 0, lastDay: 0 }
            saladWeekTrack.set(bestSalad.id, { count: st.count + 1, lastDay: day })
          }
        }

        // Salsa / vinagreta (opcional por plantilla)
        if (membersWantSalsa.length > 0 && salsaPool.length > 0) {
          let bestSalsa: RecipeForMenu | null = null, bestSss = -Infinity
          for (const r of salsaPool) {
            const s = calcularScore(r, input, usedThisWeekProtOnly, proteinDaysUsed,
              new Set(membersWantSalsa.map(m => m.id!)), isDayFinde, tipo)
            if (s > bestSss) { bestSss = s; bestSalsa = r }
          }
          if (bestSalsa) {
            components.push({ component: 'salsa', recipe: bestSalsa, memberId: null, servings: membersWantSalsa.length })
          }
        }

        // Comida completa para miembros incompatibles: proteína + acompañamientos propios
        for (const alt of alternativas) {
          const m = slotMembers.find(mb => mb.id === alt.memberId)
          if (!m) continue

          // Proteína del miembro
          components.push({ component: 'proteina', recipe: alt.recipe, memberId: m.id!, servings: 1 })

          // Acompañamientos según SU plantilla (no la familiar)
          const pMember = plantillaDeComponentes(m)
          const memberUsed = new Set([alt.recipe.id, bestRecipe.id])

          if (pMember.guarniciones >= 1) {
            const mg1 = guarnicionPool.find(r => !memberUsed.has(r.id) && esCompatibleConMiembro(r, m))
            if (mg1) { components.push({ component: 'guarnicion', recipe: mg1, memberId: m.id!, servings: 1 }); memberUsed.add(mg1.id) }
          }
          if (pMember.guarniciones >= 2) {
            const mg2 = guarnicionPool.find(r => !memberUsed.has(r.id) && esCompatibleConMiembro(r, m))
            if (mg2) { components.push({ component: 'guarnicion', recipe: mg2, memberId: m.id!, servings: 1 }); memberUsed.add(mg2.id) }
          }
          if (pMember.quiereEnsalada) {
            const ms = saladPool.find(r => !memberUsed.has(r.id) && esCompatibleConMiembro(r, m))
            if (ms) { components.push({ component: 'ensalada', recipe: ms, memberId: m.id!, servings: 1 }) }
          }
        }
      }

      result.push({ dayOfWeek: day, tipo, mealName, mealTime, components, principal: bestRecipe, servings: slotServings, alternativas })
    }
    // Actualizar historial del día anterior para el siguiente día
    usedYesterdayNames = [...usedTodayNames]
  }

  return result
}

// ── Helpers de fecha ──────────────────────────────────────────────────────────

export function getMondayOfWeek(date = new Date()): string {
  const d   = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().split('T')[0]
}

export function getMondayNWeeksAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n * 7)
  return getMondayOfWeek(d)
}

export const DAY_NAMES = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
export const DAY_NAMES_FULL = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
