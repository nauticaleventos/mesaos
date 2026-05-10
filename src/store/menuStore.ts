import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import {
  generarMenuSemanal, getMondayOfWeek, getMondayNWeeksAgo,
  type MenuConfig, type RecipeForMenu, type MenuSlot,
} from '../lib/motorMenu'
import type { FridgeItem } from './fridgeStore'

export interface EnrichedMenuEntry {
  id:            string
  day_of_week:   number
  meal_type:     string
  recipe_id:     string
  member_id:     string | null
  is_main_recipe:boolean
  servings:      number
  status:        'planned' | 'cooked' | 'skipped' | 'swapped'
  recipe:        RecipeForMenu
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
      // Config por defecto — se crea al guardar
      set({
        config: {
          id: '',
          family_id:        familyId,
          planear_desayuno: false,
          planear_almuerzo: true,
          planear_cena:     true,
          planear_snacks:   false,
          distinguir_finde: true,
        }
      })
    }
  },

  // ── Guardar configuración ───────────────────────────────────────────────────
  saveConfig: async (familyId, patch) => {
    const current = get().config
    const updated = { ...current, ...patch, family_id: familyId }

    const { data, error } = await supabase
      .from('menu_config')
      .upsert({ ...updated }, { onConflict: 'family_id' })
      .select()
      .single()

    if (!error && data) set({ config: data as MenuConfig })
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
      id: string; day_of_week: number; meal_type: string; recipe_id: string;
      member_id: string | null; is_main_recipe: boolean; servings: number; status: string
    }[])
      .filter(e => recipeMap.has(e.recipe_id))
      .map(e => ({
        ...e,
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

      // 2. Miembros activos esta semana
      const { data: attendance } = await supabase
        .from('weekly_attendance')
        .select('member_id, is_active, guests_extra, family_members(*)')
        .eq('family_id', familyId)
        .eq('week_start', weekStart)

      const { data: allMembersRaw } = await supabase
        .from('family_members')
        .select('*')
        .eq('family_id', familyId)

      const allMembers = allMembersRaw ?? []

      // Si no hay registros de asistencia, todos los miembros están activos
      const activeMembers = attendance && attendance.length > 0
        ? attendance
            .filter((a: { is_active: boolean }) => a.is_active)
            .map((a: { family_members: unknown }) => a.family_members as { id: string; [key: string]: unknown })
            .filter(Boolean)
        : allMembers

      const totalGuests = attendance?.reduce((sum: number, a: { is_active: boolean; guests_extra: number }) =>
        a.is_active ? sum + (a.guests_extra ?? 0) : sum, 0) ?? 0
      const totalServings = activeMembers.length + totalGuests
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
      const memberIds = activeMembers.map((m: { id: string }) => m.id).filter(Boolean) as string[]
      const { data: suggestions } = memberIds.length > 0
        ? await supabase.from('recipe_suggestions').select('recipe_id, member_id, status')
            .in('member_id', memberIds).eq('status', 'pending')
        : { data: [] }
      set({ progress: 45 })

      // 5. Reacciones de la familia
      const { data: reactions } = memberIds.length > 0
        ? await supabase.from('recipe_reactions').select('recipe_id, member_id, reaction, rating')
            .in('member_id', memberIds)
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
        activeMembers: activeMembers as { id: string; allergies: string[]; prohibited: string[]; eating_style: string }[] as Parameters<typeof generarMenuSemanal>[0]['activeMembers'],
        totalServings: Math.max(1, totalServings),
        fridgeItems:   fridgeItems.map(f => ({ name: f.name })),
        allRecipes,
        suggestions:   suggestions ?? [],
        reactions:     reactions ?? [],
        recentRecipeIds,
        healthyMode,
      })
      set({ progress: 85 })

      // 9. Borrar menú previo de esta semana y guardar el nuevo
      await supabase.from('weekly_menu').delete()
        .eq('family_id', familyId).eq('week_start', weekStart)

      const rows = slots.flatMap(slot => {
        const principal = {
          family_id:     familyId,
          week_start:    weekStart,
          day_of_week:   slot.dayOfWeek,
          meal_type:     slot.tipo,
          recipe_id:     slot.principal.id,
          member_id:     null,
          is_main_recipe:true,
          servings:      slot.servings,
          status:        'planned',
        }
        const alts = slot.alternativas.map(alt => ({
          family_id:     familyId,
          week_start:    weekStart,
          day_of_week:   slot.dayOfWeek,
          meal_type:     slot.tipo,
          recipe_id:     alt.recipe.id,
          member_id:     alt.memberId,
          is_main_recipe:false,
          servings:      1,
          status:        'planned',
        }))
        return [principal, ...alts]
      })

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
