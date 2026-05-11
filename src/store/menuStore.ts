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

export type { MenuConfig } from '../lib/motorMenu'

interface MenuState {
  config:     MenuConfig | null
  menu:       EnrichedMenuEntry[]
  loading:    boolean
  generating: boolean
  progress:   number   // 0-100

  loadConfig:     (familyId: string) => Promise<void>
  saveConfig:     (familyId: string, patch: Partial<MenuConfig>) => Promise<void>
  loadMenu:       (familyId: string, weekStart?: string) => Promise<void>
  generarMenu:    (familyId: string, fridgeItems: FridgeItem[], healthyMode: boolean) => Promise<string | null>
  marcarCocinada: (id: string) => Promise<void>
  saltarReceta:   (id: string) => Promise<void>
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
      .select('id, nombre, tipo_comida, dificultad, tiempo_total_min, porciones, imagen_url, ingredientes, info_nutricional_aprox, perfiles, filtros_nutricionales')
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
        .select('id, nombre, tipo_comida, dificultad, tiempo_total_min, porciones, imagen_url, ingredientes, info_nutricional_aprox, perfiles, filtros_nutricionales')
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

  // ── Marcar cocinada ─────────────────────────────────────────────────────────
  marcarCocinada: async (id) => {
    await supabase.from('weekly_menu').update({ status: 'cooked' }).eq('id', id)
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
}))
