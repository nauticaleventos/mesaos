import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import {
  generarMenuSemanal, getMondayOfWeek, getMondayNWeeksAgo,
  type MenuConfig, type RecipeForMenu, type MenuSlot,
} from '../lib/motorMenu'
import type { FridgeItem } from './fridgeStore'

export interface EnrichedMenuEntry {
  id:             string
  day_of_week:    number
  meal_type:      string
  meal_component: string   // 'completo' | 'proteina' | 'carbohidrato' | 'ensalada' | 'salsa'
  recipe_id:      string
  member_id:      string | null
  is_main_recipe: boolean
  servings:       number
  status:         'planned' | 'cooked' | 'skipped' | 'swapped'
  recipe:         RecipeForMenu
}

export type { MenuConfig, RecipeForMenu } from '../lib/motorMenu'
export type SwapReason = 'no_ingredientes' | 'no_apetece' | 'muy_dificil' | 'variedad'

const RECIPE_SELECT = 'id, nombre, tipo_comida, tipo_componente, dificultad, tiempo_total_min, porciones, imagen_url, ingredientes, info_nutricional_aprox, perfiles, filtros_nutricionales'

interface MenuState {
  config:     MenuConfig | null
  menu:       EnrichedMenuEntry[]
  loading:    boolean
  generating: boolean
  progress:   number   // 0-100

  loadConfig:           (familyId: string) => Promise<void>
  saveConfig:           (familyId: string, patch: Partial<MenuConfig>) => Promise<void>
  loadMenu:             (familyId: string, weekStart?: string) => Promise<void>
  generarMenu:          (familyId: string, fridgeItems: FridgeItem[], healthyMode: boolean) => Promise<string | null>
  marcarCocinada:       (id: string) => Promise<void>
  saltarReceta:         (id: string) => Promise<void>
  buscarAlternativas:   (entryId: string, razon: SwapReason) => Promise<RecipeForMenu[]>
  cambiarReceta:        (entryId: string, newRecipeId: string) => Promise<void>
  restaurarReceta:      (id: string) => Promise<void>
  simplificarComidas:   (familyId: string, cuantas: number) => Promise<number>
  quitarComponente:     (entryId: string) => Promise<void>
  agregarComponente:    (familyId: string, weekStart: string, dayOfWeek: number, mealType: string, recipeId: string, component: string) => Promise<void>
  replicarEnSemana:     (familyId: string, weekStart: string, fromDay: number, mealType: string, recipeId: string, component: string) => Promise<number>
}

export const useMenuStore = create<MenuState>((set, get) => ({
  config:     null,
  menu:       [],
  loading:    false,
  generating: false,
  progress:   0,

  // ── Cargar configuración ────────────────────────────────────────────────────
  loadConfig: async (familyId) => {
    const { data } = await supabase
      .from('menu_config')
      .select('*')
      .eq('family_id', familyId)
      .maybeSingle()

    if (data) {
      set({ config: data as MenuConfig })
    } else {
      set({
        config: {
          id: '',
          family_id:         familyId,
          planear_desayuno:  false,
          planear_almuerzo:  true,
          planear_cena:      true,
          planear_snacks:    false,
          distinguir_finde:  true,
          cocina_frequency:  'daily',
        }
      })
    }
  },

  // ── Guardar configuración ───────────────────────────────────────────────────
  saveConfig: async (familyId, patch) => {
    const current = get().config
    // Actualizar estado localmente de inmediato (UX optimista)
    const optimistic = { ...current, ...patch, family_id: familyId } as MenuConfig
    set({ config: optimistic })

    // Persistir en BD — excluir id vacío para que Supabase lo genere
    const { id, ...rest } = optimistic
    const upsertData = id ? optimistic : { ...rest }

    const { data } = await supabase
      .from('menu_config')
      .upsert(upsertData, { onConflict: 'family_id' })
      .select()
      .single()

    if (data) set({ config: data as MenuConfig })
  },

  // ── Cargar menú de la semana actual ────────────────────────────────────────
  loadMenu: async (familyId, weekStart) => {
    const ws = weekStart ?? getMondayOfWeek()
    set({ loading: true })

    const { data: entries } = await supabase
      .from('weekly_menu')
      .select('*')
      .eq('family_id', familyId)
      .eq('week_start', ws)
      .order('day_of_week')
      .order('meal_type')

    if (!entries || entries.length === 0) { set({ menu: [], loading: false }); return }

    // Cargar recetas referenciadas
    const recipeIds = [...new Set(entries.map((e: { recipe_id: string }) => e.recipe_id))]
    const { data: recipes } = await supabase
      .from('recipes')
      .select(RECIPE_SELECT)
      .in('id', recipeIds)

    const recipeMap = new Map((recipes ?? []).map(r => [r.id, r]))

    const enriched: EnrichedMenuEntry[] = (entries as {
      id: string; day_of_week: number; meal_type: string; meal_component: string;
      recipe_id: string; member_id: string | null; is_main_recipe: boolean;
      servings: number; status: string
    }[])
      .filter(e => recipeMap.has(e.recipe_id))
      .map(e => ({
        ...e,
        meal_component: e.meal_component ?? 'completo',
        status: e.status as EnrichedMenuEntry['status'],
        recipe: recipeMap.get(e.recipe_id) as RecipeForMenu,
      }))

    set({ menu: enriched, loading: false })
  },

  // ── Generar menú semanal ────────────────────────────────────────────────────
  generarMenu: async (familyId, fridgeItems, healthyMode) => {
    set({ generating: true, progress: 0 })
    const weekStart = getMondayOfWeek()

    try {
      // 1. Config
      const config = get().config
      if (!config) return 'Configuración no cargada'
      set({ progress: 5 })

      // 2. Todos los miembros + asistencia granular + invitados
      const [{ data: allMembersRaw }, { data: absences }, { data: guestRows }] = await Promise.all([
        supabase.from('family_members').select('*').eq('family_id', familyId),
        supabase.from('weekly_attendance').select('member_id, day_of_week, meal_type')
          .eq('family_id', familyId).eq('week_start', weekStart).eq('is_eating', false),
        supabase.from('weekly_guests').select('day_of_week, meal_type, cantidad, notas')
          .eq('family_id', familyId).eq('week_start', weekStart),
      ])

      const allMembers = (allMembersRaw ?? []) as import('../lib/types').FamilyMember[]
      const absenceSet = absences ?? []
      const guests     = guestRows ?? []

      // Construir SlotAttendance para cada día × comida activa
      const mealTypes: import('../lib/motorMenu').MealType[] = []
      if (config.planear_desayuno) mealTypes.push('desayuno')
      if (config.planear_almuerzo) mealTypes.push('almuerzo')
      if (config.planear_cena)     mealTypes.push('cena')
      if (config.planear_snacks)   mealTypes.push('snack')

      const slotAttendance: import('../lib/motorMenu').SlotAttendance[] = []
      for (let day = 1; day <= 7; day++) {
        for (const meal of mealTypes) {
          const presentMembers = allMembers.filter(m =>
            !absenceSet.some((a: { member_id: string; day_of_week: number; meal_type: string }) =>
              a.member_id === m.id && a.day_of_week === day && a.meal_type === meal
            )
          )
          const slotGuests = guests.filter((g: { day_of_week: number; meal_type: string }) =>
            g.day_of_week === day && g.meal_type === meal
          )
          const guestCount = slotGuests.reduce((s: number, g: { cantidad: number }) => s + g.cantidad, 0)

          // Detectar restricciones en notas de invitados
          const guestRestrictions: string[] = []
          for (const g of slotGuests as { notas: string | null }[]) {
            if (!g.notas) continue
            const n = g.notas.toLowerCase()
            if (n.includes('vegetarian')) guestRestrictions.push('vegetariana')
            if (n.includes('sin gluten') || n.includes('celiaco') || n.includes('celiaca')) guestRestrictions.push('sin_gluten')
            if (n.includes('sin lacteo') || n.includes('lactosa')) guestRestrictions.push('sin_lacteos')
          }

          slotAttendance.push({
            dayOfWeek:         day,
            mealType:          meal as import('../lib/motorMenu').MealType,
            memberIds:         presentMembers.map(m => m.id!),
            totalServings:     presentMembers.length + guestCount,
            guestRestrictions,
          })
        }
      }
      set({ progress: 15 })

      // 3. Recetas disponibles (campos mínimos para el algoritmo)
      const { data: recipes } = await supabase
        .from('recipes')
        .select(RECIPE_SELECT)
        .eq('is_active_for_menu', true)
        .not('tipo_comida', 'is', null)

      const allRecipes = (recipes ?? []) as RecipeForMenu[]
      set({ progress: 35 })

      // 4. Sugerencias pendientes
      const memberIds = allMembers.map(m => m.id!).filter(Boolean)
      const { data: suggestions } = memberIds.length > 0
        ? await supabase.from('recipe_suggestions').select('recipe_id, member_id, status')
            .in('member_id', memberIds).eq('status', 'pending')
        : { data: [] }
      set({ progress: 45 })

      // 5. Reacciones de la familia
      const { data: reactions } = memberIds.length > 0
        ? await supabase.from('recipe_reactions').select('recipe_id, member_id, reaction, rating')
            .in('member_id', memberIds as string[])
        : { data: [] }
      set({ progress: 55 })

      // 6. Recetas usadas en últimas 2 semanas
      const { data: recentMenus } = await supabase
        .from('weekly_menu')
        .select('recipe_id')
        .eq('family_id', familyId)
        .gte('week_start', getMondayNWeeksAgo(2))
        .lt('week_start', weekStart)

      const recentRecipeIds = new Set((recentMenus ?? []).map((m: { recipe_id: string }) => m.recipe_id))
      set({ progress: 65 })

      // 7. Validación: suficientes recetas
      if (allRecipes.length < 30) {
        set({ generating: false, progress: 0 })
        return `Necesitas más recetas para generar el menú (tienes ${allRecipes.length}, mínimo 30).`
      }

      // 8. Correr el algoritmo
      // Calcular nivel de nevera para threshold escalonado
      const totalItems = fridgeItems.length
      const nivelNevera = Math.min(100, Math.round((totalItems / 20) * 100))

      const slots: MenuSlot[] = generarMenuSemanal({
        config,
        allMembers,
        slotAttendance,
        fridgeItems:    fridgeItems.map(f => ({ name: f.name })),
        allRecipes,
        suggestions:    suggestions ?? [],
        reactions:      reactions ?? [],
        recentRecipeIds,
        healthyMode,
        nivelNevera,
      })
      set({ progress: 85 })

      // 9. Borrar menú previo de esta semana y guardar el nuevo
      await supabase.from('weekly_menu').delete()
        .eq('family_id', familyId).eq('week_start', weekStart)

      const rows = slots.flatMap(slot =>
        slot.components.map(comp => ({
          family_id:      familyId,
          week_start:     weekStart,
          day_of_week:    slot.dayOfWeek,
          meal_type:      slot.tipo,
          meal_component: comp.component,
          recipe_id:      comp.recipe.id,
          member_id:      comp.memberId,
          is_main_recipe: comp.component === 'proteina' || comp.component === 'completo',
          servings:       comp.servings,
          status:         'planned',
        }))
      )

      await supabase.from('weekly_menu').insert(rows)
      set({ progress: 100 })

      // 10. Recargar el menú
      await get().loadMenu(familyId, weekStart)
      set({ generating: false, progress: 0 })
      return null

    } catch (e) {
      set({ generating: false, progress: 0 })
      return String(e)
    }
  },

  // ── Marcar cocinada + auto-registrar sobra de proteína ──────────────────────
  marcarCocinada: async (id) => {
    await supabase.from('weekly_menu').update({ status: 'cooked' }).eq('id', id)

    // Si es una proteína o plato completo, registrar sobra automáticamente
    const entry = get().menu.find(e => e.id === id)
    if (entry && entry.is_main_recipe && (entry.meal_component === 'proteina' || entry.meal_component === 'completo')) {
      const { data: wm } = await supabase
        .from('weekly_menu').select('family_id').eq('id', id).maybeSingle()
      if (wm?.family_id) {
        await supabase.from('leftover_proteins').insert({
          family_id:      wm.family_id,
          recipe_id:      entry.recipe_id,
          protein_nombre: entry.recipe.nombre,
          cooking_date:   new Date().toISOString().split('T')[0],
          available:      true,
        })
      }
    }

    set(s => ({
      menu: s.menu.map(e => e.id === id ? { ...e, status: 'cooked' } : e)
    }))
  },

  // ── Saltar receta ───────────────────────────────────────────────────────────
  saltarReceta: async (id) => {
    await supabase.from('weekly_menu').update({ status: 'skipped' }).eq('id', id)
    set(s => ({
      menu: s.menu.map(e => e.id === id ? { ...e, status: 'skipped' } : e)
    }))
  },

  // ── Restaurar receta saltada ─────────────────────────────────────────────────
  restaurarReceta: async (id) => {
    await supabase.from('weekly_menu').update({ status: 'planned' }).eq('id', id)
    set(s => ({
      menu: s.menu.map(e => e.id === id ? { ...e, status: 'planned' } : e)
    }))
  },

  // ── Buscar alternativas para cambiar una receta ─────────────────────────────
  buscarAlternativas: async (entryId, razon) => {
    const entry = get().menu.find(e => e.id === entryId)
    if (!entry) return []

    const usedIds = new Set(get().menu.map(e => e.recipe_id))

    let query = supabase
      .from('recipes')
      .select(RECIPE_SELECT)
      .eq('is_active_for_menu', true)
      .not('tipo_comida', 'is', null)

    if (razon === 'muy_dificil') query = query.eq('dificultad', 'facil')

    const { data } = await query.limit(80)
    if (!data) return []

    const mealType = entry.meal_type
    let candidates = (data as RecipeForMenu[]).filter(r =>
      !usedIds.has(r.id) &&
      r.tipo_comida?.includes(mealType)
    )

    // Para "no_apetece": excluir recetas con nombre similar a la actual
    if (razon === 'no_apetece') {
      const currentName = entry.recipe.nombre.toLowerCase()
      candidates = candidates.filter(r =>
        !r.nombre.toLowerCase().split(' ').some(w => w.length > 4 && currentName.includes(w))
      )
    }

    // Mezclar aleatoriamente y devolver 5
    return candidates.sort(() => Math.random() - 0.5).slice(0, 5)
  },

  // ── Simplificar las próximas N comidas (modo día difícil) ──────────────────
  simplificarComidas: async (_familyId, cuantas) => {
    const todayDate  = new Date()
    // day_of_week 1=lun … 7=dom; getDay() 0=dom
    const jsDay      = todayDate.getDay()
    const todayDow   = jsDay === 0 ? 7 : jsDay

    // Orden cronológico de comidas dentro de la semana
    const MEAL_ORDER  = ['desayuno', 'almuerzo', 'cena', 'snack']

    // Próximos slots no cocinados a partir de hoy
    const upcoming = get().menu
      .filter(e =>
        e.is_main_recipe &&
        e.status === 'planned' &&
        (e.day_of_week > todayDow ||
          (e.day_of_week === todayDow))
      )
      .sort((a, b) => {
        if (a.day_of_week !== b.day_of_week) return a.day_of_week - b.day_of_week
        return MEAL_ORDER.indexOf(a.meal_type) - MEAL_ORDER.indexOf(b.meal_type)
      })
      .slice(0, cuantas)

    if (upcoming.length === 0) return 0

    // Para cada slot, buscar la receta más fácil y rápida del mismo tipo
    let changed = 0
    for (const entry of upcoming) {
      const { data } = await supabase
        .from('recipes')
        .select(RECIPE_SELECT)
        .eq('is_active_for_menu', true)
        .eq('dificultad', 'facil')
        .contains('tipo_comida', [entry.meal_type])
        .order('tiempo_total_min', { ascending: true, nullsFirst: false })
        .limit(10)

      const candidates = (data ?? [] as RecipeForMenu[]).filter(r => r.id !== entry.recipe_id)
      if (candidates.length === 0) continue

      const chosen = candidates[Math.floor(Math.random() * Math.min(3, candidates.length))]
      await supabase
        .from('weekly_menu')
        .update({ recipe_id: chosen.id, status: 'swapped' })
        .eq('id', entry.id)

      set(s => ({
        menu: s.menu.map(e => e.id === entry.id
          ? { ...e, recipe_id: chosen.id, status: 'swapped', recipe: chosen as RecipeForMenu }
          : e
        )
      }))
      changed++
    }

    return changed
  },

  // ── Cambiar receta por una alternativa ──────────────────────────────────────
  cambiarReceta: async (entryId, newRecipeId) => {
    await supabase
      .from('weekly_menu')
      .update({ recipe_id: newRecipeId, status: 'swapped' })
      .eq('id', entryId)

    const { data: recipe } = await supabase
      .from('recipes')
      .select(RECIPE_SELECT)
      .eq('id', newRecipeId)
      .single()

    if (recipe) {
      set(s => ({
        menu: s.menu.map(e => e.id === entryId
          ? { ...e, recipe_id: newRecipeId, status: 'swapped', recipe: recipe as RecipeForMenu }
          : e
        )
      }))
    }
  },

  quitarComponente: async (entryId) => {
    const { error } = await supabase.from('weekly_menu').delete().eq('id', entryId)
    if (error) {
      console.error('Error al quitar componente:', error.message)
      return
    }
    set(s => ({ menu: s.menu.filter(e => e.id !== entryId) }))
  },

  agregarComponente: async (familyId, weekStart, dayOfWeek, mealType, recipeId, component) => {
    const { data: recipe } = await supabase
      .from('recipes').select(RECIPE_SELECT).eq('id', recipeId).single()
    if (!recipe) return

    const { data: inserted } = await supabase
      .from('weekly_menu')
      .insert({
        family_id:      familyId,
        week_start:     weekStart,
        day_of_week:    dayOfWeek,
        meal_type:      mealType,
        meal_component: component,
        recipe_id:      recipeId,
        member_id:      null,
        is_main_recipe: false,
        servings:       1,
        status:         'planned',
      })
      .select()
      .single()

    if (inserted) {
      const entry: EnrichedMenuEntry = {
        ...(inserted as Omit<EnrichedMenuEntry, 'recipe'>),
        meal_component: component,
        status: 'planned',
        recipe: recipe as RecipeForMenu,
      }
      set(s => ({ menu: [...s.menu, entry] }))
    }
  },

  // Replica un componente agregado en todos los días restantes de la semana que tengan ese meal_type
  replicarEnSemana: async (familyId, weekStart, fromDay, mealType, recipeId, component) => {
    const { data: recipe } = await supabase.from('recipes').select(RECIPE_SELECT).eq('id', recipeId).single()
    if (!recipe) return 0

    const existingDays = new Set(
      get().menu
        .filter(e => e.meal_type === mealType && e.recipe_id === recipeId && e.meal_component === component)
        .map(e => e.day_of_week)
    )
    // Días que tienen ese meal_type pero aún no tienen esta receta
    const diasConSlot = [...new Set(get().menu.filter(e => e.meal_type === mealType && e.day_of_week !== fromDay).map(e => e.day_of_week))]
    const diasAgregar = diasConSlot.filter(d => !existingDays.has(d))

    let added = 0
    for (const day of diasAgregar) {
      const { data: inserted } = await supabase.from('weekly_menu').insert({
        family_id: familyId, week_start: weekStart, day_of_week: day,
        meal_type: mealType, meal_component: component, recipe_id: recipeId,
        member_id: null, is_main_recipe: false, servings: 1, status: 'planned',
      }).select().single()
      if (inserted) {
        const entry: EnrichedMenuEntry = { ...(inserted as Omit<EnrichedMenuEntry, 'recipe'>), meal_component: component, status: 'planned', recipe: recipe as RecipeForMenu }
        set(s => ({ menu: [...s.menu, entry] }))
        added++
      }
    }
    return added
  },
}))
