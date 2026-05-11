// ════════════════════════════════════════════════════════════════
// motorMenu.ts — Algoritmo puro de generación de menú semanal
// Sin side effects. Toma todo como input, devuelve el menú.
// ════════════════════════════════════════════════════════════════

import type { FamilyMember } from './types'

export type MealType = 'desayuno' | 'almuerzo' | 'cena' | 'snack'
export type MealComponent = 'completo' | 'proteina' | 'carbohidrato' | 'ensalada' | 'salsa'

export interface MenuConfig {
  id:                string
  family_id:         string
  planear_desayuno:  boolean
  planear_almuerzo:  boolean
  planear_cena:      boolean
  planear_snacks:    boolean
  distinguir_finde:  boolean
  cocina_frequency?: 'daily' | '2x_week' | '1x_week'
}

export interface RecipeForMenu {
  id:                      string
  nombre:                  string
  tipo_comida:             string[]
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
    sin_gluten?:  boolean
    sin_lacteos?: boolean
    bajo_sodio?:  boolean
    bajo_azucar?: boolean
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
  memberIds:          string[]
  totalServings:      number
  guestRestrictions:  string[]   // restricciones detectadas en notas de invitados
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
}

export interface MenuComponent {
  component:  MealComponent
  recipe:     RecipeForMenu
  memberId:   string | null   // null = toda la familia
  servings:   number
}

export interface MenuSlot {
  dayOfWeek:    number
  tipo:         MealType
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

/** True si el miembro puede comer esta receta (restricciones absolutas) */
function esCompatibleConMiembro(recipe: RecipeForMenu, m: FamilyMember): boolean {
  // Alergias
  if ((m.allergies ?? []).length && tieneIngrediente(recipe, m.allergies)) return false
  // Prohibidos
  if ((m.prohibited ?? []).length && tieneIngrediente(recipe, m.prohibited)) return false
  // Estilo de alimentación
  const es = m.eating_style
  if ((es === 'vegetarian' || es === 'vegan') && !recipe.perfiles?.vegetariana) return false
  if (es === 'keto'        && !recipe.perfiles?.keto)                           return false
  if (es === 'gluten_free' && !recipe.filtros_nutricionales?.sin_gluten)        return false
  if (es === 'lactose_free'&& !recipe.filtros_nutricionales?.sin_lacteos)       return false
  return true
}

/** Score de inventario (0-100): qué % de ingredientes esenciales están en nevera */
function scoreInventario(recipe: RecipeForMenu, fridge: FridgeItemMin[]): number {
  const esenciales = recipe.ingredientes.filter(i => i.esencial)
  if (esenciales.length === 0) return 60
  const fridgeNames = fridge.map(f => normalizar(f.name))
  const have = esenciales.filter(ing =>
    fridgeNames.some(f => f.includes(normalizar(ing.nombre)) || normalizar(ing.nombre).includes(f))
  ).length
  return Math.round((have / esenciales.length) * 100)
}

/** True si la receta tiene al menos un ingrediente de proteína animal */
function tieneProteinaAnimal(recipe: RecipeForMenu): boolean {
  return recipe.ingredientes.some(i => i.categoria === 'proteina_animal')
}

/**
 * Clasifica una receta como componente de comida.
 * Heurística basada en categorías de ingredientes dominantes.
 */
export function clasificarComponente(recipe: RecipeForMenu): MealComponent {
  const nombre = normalizar(recipe.nombre)

  // Bebidas → excluir de slots de comida principal
  if (recipe.tipo_comida.includes('bebida')) return 'completo'  // se tratará como inválido en filtros
  if (['leche', 'jugo', 'agua', 'té ', 'te ', 'café', 'cafe', 'smoothie', 'batido', 'bebida', 'limonada', 'infusion'].some(k => nombre.includes(k))) return 'completo'

  const cats = recipe.ingredientes.map(i => i.categoria)
  const total = cats.length || 1

  const proteinCount  = cats.filter(c => c === 'proteina_animal' || c === 'embutido').length
  const granoCount    = cats.filter(c => c === 'grano').length
  const veggieCount   = cats.filter(c => c === 'vegetal' || c === 'fruta').length
  const legumbreCount = cats.filter(c => c === 'legumbre').length
  const condCount     = cats.filter(c => c === 'condimento').length

  // Salsas y bases líquidas (mayoría condimentos)
  if (condCount / total >= 0.5) return 'salsa'

  // Proteína dominante
  if (proteinCount / total >= 0.30) return 'proteina'

  // Nombre sugiere proteína
  const proteinKeywords = ['pollo', 'carne', 'res', 'cerdo', 'pescado', 'atún', 'atun', 'salmon', 'salmón',
    'camarón', 'camaron', 'huevo', 'huevos', 'tofu', 'lentejas', 'garbanzos', 'frijol', 'lomo', 'pechuga',
    'filete', 'costilla', 'cerdo', 'chorizo', 'jamón', 'jamon', 'sardinas', 'bacalao', 'langostino']
  if (proteinKeywords.some(k => nombre.includes(k)) && !nombre.includes('ensalada')) return 'proteina'

  // Carbohidrato
  if ((granoCount + legumbreCount) / total >= 0.35 && proteinCount / total < 0.2) return 'carbohidrato'
  const carbKeywords = ['arroz', 'papa', 'plátano', 'platano', 'yuca', 'pasta', 'arepa', 'pan ', 'quinua', 'maíz', 'maiz', 'patacón', 'patacon']
  if (carbKeywords.some(k => nombre.includes(k)) && proteinCount / total < 0.2) return 'carbohidrato'

  // Ensalada/vegetal
  if (veggieCount / total >= 0.50 && proteinCount / total < 0.15) return 'ensalada'
  if (nombre.includes('ensalada') || nombre.includes('slaw')) return 'ensalada'

  return 'completo'
}

/** Recetas de carbohidratos simples como acompañamiento */
const CARBS_KEYWORDS = ['arroz', 'papa', 'plátano', 'platano', 'patacón', 'patacon', 'yuca', 'pasta', 'pan ', 'arepa', 'quinua', 'maíz', 'maiz']
export function esCarbohidratoAcompa(recipe: RecipeForMenu): boolean {
  const nombre = normalizar(recipe.nombre)
  return CARBS_KEYWORDS.some(k => nombre.includes(k)) || clasificarComponente(recipe) === 'carbohidrato'
}
export function esEnsalada(recipe: RecipeForMenu): boolean {
  const nombre = normalizar(recipe.nombre)
  return nombre.includes('ensalada') || nombre.includes('slaw') || clasificarComponente(recipe) === 'ensalada'
}

/** Detecta si dos recetas son "similares" por nombre (evita duplicados temáticos) */
export function sonSimilares(a: string, b: string): boolean {
  const words = (s: string) => normalizar(s).split(/\s+/).filter(w => w.length > 3)
  const wa = words(a), wb = words(b)
  const common = wa.filter(w => wb.includes(w))
  return common.length >= 2
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

  // Score de inventario (40%)
  const sInventario = scoreInventario(recipe, input.fridgeItems)

  // Score de sugerencias (25%)
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

  // Penalty si ya usamos mucha proteína animal esta semana
  const sProtein = tieneProteinaAnimal(recipe) && proteinDaysUsed >= 3 ? -30 : 0

  return (
    sInventario  * 0.40 +
    sSugerencia  * 0.25 +
    sRating      * 0.20 +
    sVariedad    * 0.15 +
    sProtein
  )
}

// ── Función principal ─────────────────────────────────────────────────────────

export function generarMenuSemanal(input: AlgorithmInput): MenuSlot[] {
  const { config, allMembers, slotAttendance, allRecipes } = input

  const result:       MenuSlot[] = []
  const usedThisWeek             = new Set<string>()
  let proteinDaysUsed            = 0

  for (let day = 1; day <= 7; day++) {
    const isDayFinde     = day >= 6
    const usedToday      = new Set<string>()   // resetea cada día — evita repetir en mismo día
    const usedTodayNames: string[] = []         // para detectar recetas similares en el mismo día

    const mealTypes: MealType[] = []
    if (config.planear_desayuno) mealTypes.push('desayuno')
    if (config.planear_almuerzo) mealTypes.push('almuerzo')
    if (config.planear_cena)     mealTypes.push('cena')
    if (config.planear_snacks)   mealTypes.push('snack')

    for (const tipo of mealTypes) {
      // Obtener asistencia específica para este día/comida
      const slot = slotAttendance.find(s => s.dayOfWeek === day && s.mealType === tipo)
      const slotMemberIds  = slot?.memberIds  ?? allMembers.map(m => m.id!)
      const slotServings   = slot?.totalServings ?? allMembers.length
      const slotMembers    = allMembers.filter(m => slotMemberIds.includes(m.id!))
      const activeMemberIds= new Set(slotMemberIds)

      // Si no hay nadie en este slot, saltar
      if (slotServings === 0 || slotMembers.length === 0) continue

      // Restricciones extra de invitados (por notas)
      const guestRestrictions = slot?.guestRestrictions ?? []

      // Filtrar recetas compatibles con los miembros presentes en este slot
      const compatibleConTodos = allRecipes.filter(r => {
        if (!slotMembers.every(m => esCompatibleConMiembro(r, m))) return false
        // Aplicar restricciones de invitados
        if (guestRestrictions.includes('vegetariana') && !r.perfiles?.vegetariana) return false
        if (guestRestrictions.includes('sin_gluten')  && !r.filtros_nutricionales?.sin_gluten)  return false
        if (guestRestrictions.includes('sin_lacteos') && !r.filtros_nutricionales?.sin_lacteos) return false
        return true
      })
      const compatibleConAlguno = allRecipes.filter(r =>
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

      usedThisWeek.add(bestRecipe.id)
      usedToday.add(bestRecipe.id)
      usedTodayNames.push(bestRecipe.nombre)
      if (tieneProteinaAnimal(bestRecipe)) proteinDaysUsed++

      // Alternativas para miembros incompatibles
      const alternativas: MenuSlot['alternativas'] = []
      for (const m of slotMembers) {
        if (esCompatibleConMiembro(bestRecipe, m)) continue
        let altScore = -Infinity, altRecipe: RecipeForMenu | null = null
        for (const r of allRecipes) {
          if (r.id === bestRecipe.id || !esCompatibleConMiembro(r, m)) continue
          const s = calcularScore(r, input, usedThisWeek, proteinDaysUsed, new Set([m.id!]), isDayFinde, tipo)
          if (s > altScore) { altScore = s; altRecipe = r }
        }
        if (altRecipe) alternativas.push({ memberId: m.id!, recipe: altRecipe })
      }

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
          bestRecipe = bestProt
          mainComponent = 'proteina'
        } else {
          // No se encontró proteína → tratar como plato completo en lugar de etiquetar mal
          mainComponent = 'completo'
        }
      }

      if (mainComponent === 'completo' || tipo === 'desayuno' || tipo === 'snack') {
        // Plato único para todos
        components.push({ component: mainComponent, recipe: bestRecipe, memberId: null, servings: slotServings })
        for (const alt of alternativas) {
          components.push({ component: mainComponent, recipe: alt.recipe, memberId: alt.memberId, servings: 1 })
        }
      } else {
        // Almuerzo/cena con proteína + acompañamientos por miembro
        components.push({ component: 'proteina', recipe: bestRecipe, memberId: null, servings: slotServings })

        // Acompañamientos por miembro según side_prefs
        const carbRecipes  = allRecipes.filter(r =>
          esCarbohidratoAcompa(r) &&
          !usedThisWeek.has(r.id) &&
          !usedToday.has(r.id) &&
          r.id !== bestRecipe.id &&
          !usedTodayNames.some(n => sonSimilares(r.nombre, n))
        )
        const saladRecipes = allRecipes.filter(r =>
          esEnsalada(r) &&
          !usedThisWeek.has(r.id) &&
          !usedToday.has(r.id) &&
          r.id !== bestRecipe.id &&
          !usedTodayNames.some(n => sonSimilares(r.nombre, n))
        )

        // Carbohidrato: uno compartido para quienes lo quieren
        const membersWantCarbs = slotMembers.filter(m => m.side_prefs?.include_carbs !== false)
        if (membersWantCarbs.length > 0 && carbRecipes.length > 0) {
          let bestCarb: RecipeForMenu | null = null, bestCarbScore = -Infinity
          for (const r of carbRecipes) {
            const s = calcularScore(r, input, usedThisWeek, proteinDaysUsed,
              new Set(membersWantCarbs.map(m => m.id!)), isDayFinde, tipo)
            if (s > bestCarbScore) { bestCarbScore = s; bestCarb = r }
          }
          if (bestCarb) {
            const carbServings = membersWantCarbs.length
            if (carbServings === slotMembers.length) {
              components.push({ component: 'carbohidrato', recipe: bestCarb, memberId: null, servings: carbServings })
            } else {
              for (const m of membersWantCarbs) {
                components.push({ component: 'carbohidrato', recipe: bestCarb, memberId: m.id!, servings: 1 })
              }
            }
            usedToday.add(bestCarb.id)
            usedThisWeek.add(bestCarb.id)
            usedTodayNames.push(bestCarb.nombre)
          }
        }

        // Ensalada: compartida para quienes la quieren
        const membersWantSalad = slotMembers.filter(m => m.side_prefs?.include_salad !== false)
        if (membersWantSalad.length > 0 && saladRecipes.length > 0) {
          let bestSalad: RecipeForMenu | null = null, bestSaladScore = -Infinity
          for (const r of saladRecipes) {
            const s = calcularScore(r, input, usedThisWeek, proteinDaysUsed,
              new Set(membersWantSalad.map(m => m.id!)), isDayFinde, tipo)
            if (s > bestSaladScore) { bestSaladScore = s; bestSalad = r }
          }
          if (bestSalad) {
            components.push({ component: 'ensalada', recipe: bestSalad, memberId: null, servings: membersWantSalad.length })
            usedToday.add(bestSalad.id)
            usedThisWeek.add(bestSalad.id)
            usedTodayNames.push(bestSalad.nombre)
          }
        }

        // Alternativas de proteína para incompatibles
        for (const alt of alternativas) {
          components.push({ component: 'proteina', recipe: alt.recipe, memberId: alt.memberId, servings: 1 })
        }
      }

      result.push({ dayOfWeek: day, tipo, components, principal: bestRecipe, servings: slotServings, alternativas })
    }
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
