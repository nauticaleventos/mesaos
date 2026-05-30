import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { getMondayOfWeek } from '../lib/motorMenu'

export type LoncheraComponente = 'principal' | 'fruta' | 'snack' | 'bebida' | 'extra'

const DIA_TO_DOW: Record<string, number> = {
  lun: 1, mar: 2, mie: 3, jue: 4, vie: 5, sab: 6, dom: 7,
}

export const COMPONENTES_CONFIG: Record<LoncheraComponente, { emoji: string; label: string; defaultText: string }> = {
  principal: { emoji: '🍱', label: 'Principal',  defaultText: 'Almuerzo o plato principal' },
  fruta:     { emoji: '🍎', label: 'Fruta',      defaultText: 'Fruta fresca de temporada'  },
  snack:     { emoji: '🍪', label: 'Snack',      defaultText: 'Snack saludable'             },
  bebida:    { emoji: '💧', label: 'Bebida',     defaultText: 'Agua o jugo natural'         },
  extra:     { emoji: '✨', label: 'Extra',      defaultText: 'Extra'                       },
}

export interface LoncheraEntry {
  id:             string
  family_id:      string
  week_start:     string
  day_of_week:    number
  member_id:      string | null
  meal_component: LoncheraComponente
  recipe_id:      string | null
  nombre_custom:  string | null
  status:         'planned' | 'cooked' | 'skipped'
  recipe?:        { id: string; nombre: string; imagen_url?: string | null; tiempo_total_min?: number | null } | null
}

export interface LoncheraMemberConfig {
  member_id:      string
  lleva_lonchera: boolean
  lonchera_hora:  string | null
  lonchera_dias:  string[]
}

interface LoncheraState {
  entries:            LoncheraEntry[]
  configs:            LoncheraMemberConfig[]
  familyLoncheraModo: 'unica' | 'personalizada'
  paisFestivos:       string
  loading:            boolean
  generating:         boolean

  loadLonchera:          (familyId: string) => Promise<void>
  saveMemberConfig:      (familyId: string, cfg: LoncheraMemberConfig) => Promise<void>
  saveFamilyConfig:      (familyId: string, modo: string, pais: string) => Promise<void>
  generarLonchera:       (familyId: string, fridgeNames: string[]) => Promise<void>
  cambiarComponente:     (entryId: string, recipeId: string, nombre: string) => Promise<void>
  quitarComponente:      (entryId: string) => Promise<void>
  agregarExtra:          (familyId: string, dayOfWeek: number, memberId: string | null, recipeId: string | null, nombre: string) => Promise<void>
}

export const useLoncheraStore = create<LoncheraState>((set, get) => ({
  entries:            [],
  configs:            [],
  familyLoncheraModo: 'unica',
  paisFestivos:       'CO',
  loading:            false,
  generating:         false,

  loadLonchera: async (familyId) => {
    set({ loading: true })
    const weekStart = getMondayOfWeek()

    const [entriesRes, membersRes, familyRes] = await Promise.all([
      supabase.from('weekly_menu')
        .select('id, family_id, week_start, day_of_week, member_id, meal_component, recipe_id, nombre_custom, status')
        .eq('family_id', familyId).eq('week_start', weekStart).eq('meal_type', 'lonchera_escolar'),
      supabase.from('family_members')
        .select('id, lleva_lonchera, lonchera_hora, lonchera_dias').eq('family_id', familyId),
      supabase.from('families')
        .select('lonchera_modo, pais_festivos').eq('id', familyId).single(),
    ])

    const rawEntries = entriesRes.data ?? []
    const recipeIds = [...new Set(rawEntries.map((e: { recipe_id: string | null }) => e.recipe_id).filter(Boolean))] as string[]
    const { data: recipes } = recipeIds.length > 0
      ? await supabase.from('recipes').select('id, nombre, imagen_url, tiempo_total_min').in('id', recipeIds)
      : { data: [] }
    const recipeMap = new Map((recipes ?? []).map(r => [r.id, r]))

    const entries: LoncheraEntry[] = rawEntries.map((e: { id: string; family_id: string; week_start: string; day_of_week: number; member_id: string | null; meal_component: string; recipe_id: string | null; nombre_custom: string | null; status: string }) => ({
      ...e,
      status:         e.status as LoncheraEntry['status'],
      meal_component: e.meal_component as LoncheraComponente,
      recipe:         e.recipe_id ? recipeMap.get(e.recipe_id) ?? null : null,
    }))

    const configs: LoncheraMemberConfig[] = (membersRes.data ?? []).map((m: { id: string; lleva_lonchera?: boolean | null; lonchera_hora?: string | null; lonchera_dias?: string[] | null }) => ({
      member_id:      m.id,
      lleva_lonchera: m.lleva_lonchera ?? false,
      lonchera_hora:  m.lonchera_hora ?? null,
      lonchera_dias:  m.lonchera_dias ?? ['lun', 'mar', 'mie', 'jue', 'vie'],
    }))

    set({
      entries,
      configs,
      familyLoncheraModo: ((familyRes.data?.lonchera_modo ?? 'unica') as 'unica' | 'personalizada'),
      paisFestivos:       familyRes.data?.pais_festivos ?? 'CO',
      loading:            false,
    })
  },

  saveMemberConfig: async (familyId, cfg) => {
    await supabase.from('family_members')
      .update({ lleva_lonchera: cfg.lleva_lonchera, lonchera_hora: cfg.lonchera_hora, lonchera_dias: cfg.lonchera_dias })
      .eq('id', cfg.member_id).eq('family_id', familyId)
    set(s => ({ configs: s.configs.map(c => c.member_id === cfg.member_id ? cfg : c) }))
  },

  saveFamilyConfig: async (familyId, modo, pais) => {
    await supabase.from('families').update({ lonchera_modo: modo, pais_festivos: pais }).eq('id', familyId)
    set({ familyLoncheraModo: modo as 'unica' | 'personalizada', paisFestivos: pais })
  },

  generarLonchera: async (familyId, fridgeNames) => {
    set({ generating: true })
    const weekStart = getMondayOfWeek()
    const { configs } = get()

    const { data: loncheraRecipes } = await supabase
      .from('recipes')
      .select('id, nombre, tipo_componente, apta_lonchera')
      .eq('apta_lonchera', true)
      .eq('is_active_for_menu', true)

    const all = loncheraRecipes ?? []
    const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    const byTipo = (comps: string[]) => all.filter(r => comps.includes(r.tipo_componente ?? ''))
    const preferFridge = (arr: typeof all) => {
      if (!fridgeNames.length) return arr
      const fridgeNorms = fridgeNames.map(norm)
      const has  = arr.filter(r => fridgeNorms.some(f => norm(r.nombre).includes(f) || f.includes(norm(r.nombre).split(' ')[0])))
      return has.length > 0 ? has : arr
    }
    const pick = (arr: typeof all): typeof all[0] | null =>
      arr.length > 0 ? arr[Math.floor(Math.random() * arr.length)] : null

    const principals = preferFridge(byTipo(['plato_unico', 'proteina_principal']))
    const snacks     = byTipo(['merienda'])
    const bebidas    = byTipo(['bebida'])

    await supabase.from('weekly_menu').delete()
      .eq('family_id', familyId).eq('week_start', weekStart).eq('meal_type', 'lonchera_escolar')

    const activeConfigs = configs.filter(c => c.lleva_lonchera)
    const rows: object[] = []

    for (const cfg of activeConfigs) {
      const dias = cfg.lonchera_dias.length > 0 ? cfg.lonchera_dias : ['lun', 'mar', 'mie', 'jue', 'vie']
      for (const dia of dias) {
        const dow = DIA_TO_DOW[dia]
        if (!dow) continue
        const comps: { comp: LoncheraComponente; r: typeof all[0] | null; custom: string }[] = [
          { comp: 'principal', r: pick(principals), custom: COMPONENTES_CONFIG.principal.defaultText },
          { comp: 'fruta',     r: null,             custom: 'Fruta fresca de temporada' },
          { comp: 'snack',     r: pick(snacks),     custom: COMPONENTES_CONFIG.snack.defaultText },
          { comp: 'bebida',    r: pick(bebidas),    custom: COMPONENTES_CONFIG.bebida.defaultText },
        ]
        for (const { comp, r, custom } of comps) {
          rows.push({
            family_id: familyId, week_start: weekStart, day_of_week: dow,
            meal_type: 'lonchera_escolar', meal_component: comp,
            recipe_id: r?.id ?? null, nombre_custom: r?.nombre ?? custom,
            member_id: cfg.member_id, is_main_recipe: comp === 'principal',
            servings: 1, status: 'planned',
          })
        }
      }
    }

    if (rows.length > 0) await supabase.from('weekly_menu').insert(rows)
    await get().loadLonchera(familyId)
    set({ generating: false })
  },

  cambiarComponente: async (entryId, recipeId, nombre) => {
    await supabase.from('weekly_menu').update({ recipe_id: recipeId, nombre_custom: nombre }).eq('id', entryId)
    set(s => ({ entries: s.entries.map(e => e.id === entryId ? { ...e, recipe_id: recipeId, nombre_custom: nombre } : e) }))
  },

  quitarComponente: async (entryId) => {
    await supabase.from('weekly_menu').delete().eq('id', entryId)
    set(s => ({ entries: s.entries.filter(e => e.id !== entryId) }))
  },

  agregarExtra: async (familyId, dayOfWeek, memberId, recipeId, nombre) => {
    const weekStart = getMondayOfWeek()
    const { data } = await supabase.from('weekly_menu').insert({
      family_id: familyId, week_start: weekStart, day_of_week: dayOfWeek,
      meal_type: 'lonchera_escolar', meal_component: 'extra',
      recipe_id: recipeId, nombre_custom: nombre,
      member_id: memberId, is_main_recipe: false, servings: 1, status: 'planned',
    }).select().single()
    if (data) set(s => ({ entries: [...s.entries, { ...data, meal_component: 'extra' as const, recipe: null }] }))
  },
}))
