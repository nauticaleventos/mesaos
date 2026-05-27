import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import {
  generarMenuSemanal, getMondayOfWeek, getMondayNWeeksAgo, buildMealSlots,
  type MenuConfig, type RecipeForMenu, type MenuSlot,
} from '../lib/motorMenu'
import { calcularNivelNevera } from '../lib/nivelNevera'
import type { FridgeItem } from './fridgeStore'

export interface EnrichedMenuEntry {
  id:             string
  day_of_week:    number
  meal_type:      string   // puede ser nombre personalizado: "Merienda mañana"
  meal_time?:     string   // hora configurada: "09:00"
  meal_component: string   // 'completo' | 'proteina' | 'carbohidrato' | 'ensalada' | 'salsa' | 'sobra'
  recipe_id:      string | null
  nombre_custom?: string   // usado cuando recipe_id es null (sobras manuales)
  member_id:      string | null
  is_main_recipe: boolean
  servings:       number
  status:               'planned' | 'cooked' | 'skipped' | 'swapped'
  accion_preparacion?:  'cocinar' | 'calentar' | 'ensamblar' | 'descongelar' | 'preparar_fresco'
  dia_dificil?:         boolean
  rating_prompted?:     boolean
  recipe?:              RecipeForMenu
}

export type { MenuConfig, RecipeForMenu } from '../lib/motorMenu'
export type SwapReason = 'no_ingredientes' | 'no_apetece' | 'muy_dificil' | 'variedad'

const RECIPE_SELECT = 'id, nombre, tipo_comida, tipo_componente, etiqueta_practicidad, dificultad, tiempo_total_min, porciones, imagen_url, ingredientes, info_nutricional_aprox, perfiles, filtros_nutricionales'

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
  asignarSobraEnMenu:   (familyId: string, weekStart: string, dayOfWeek: number, mealType: string, nombreCustom: string) => Promise<{ ok: boolean; msg: string }>
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

    // Cargar recetas referenciadas (solo entradas con recipe_id)
    const recipeIds = [...new Set(
      entries.map((e: { recipe_id: string | null }) => e.recipe_id).filter(Boolean) as string[]
    )]
    const { data: recipes } = recipeIds.length > 0
      ? await supabase.from('recipes').select(RECIPE_SELECT).in('id', recipeIds)
      : { data: [] }

    const recipeMap = new Map((recipes ?? []).map(r => [r.id, r]))

    const enriched: EnrichedMenuEntry[] = (entries as {
      id: string; day_of_week: number; meal_type: string; meal_time?: string;
      meal_component: string; recipe_id: string | null; nombre_custom?: string;
      member_id: string | null; is_main_recipe: boolean; servings: number;
      status: string; accion_preparacion?: string; dia_dificil?: boolean; rating_prompted?: boolean;
    }[])
      .filter(e => e.recipe_id === null || recipeMap.has(e.recipe_id))
      .map(e => ({
        ...e,
        meal_component:      e.meal_component ?? 'completo',
        status:              e.status as EnrichedMenuEntry['status'],
        accion_preparacion:  e.accion_preparacion as EnrichedMenuEntry['accion_preparacion'],
        dia_dificil:         e.dia_dificil ?? false,
        rating_prompted:     e.rating_prompted ?? false,
        recipe:              e.recipe_id ? recipeMap.get(e.recipe_id) as RecipeForMenu : undefined,
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

      // Construir SlotAttendance respetando meals_per_day individual de cada miembro.
      // buildMealSlots genera la unión de todos los slots; luego filtramos qué miembros
      // tienen cada slot configurado en su perfil personal.
      const mealSlots = buildMealSlots(allMembers, config)

      // Fallback global para miembros sin meals_per_day configurado
      const globalMealTypes = new Set<string>([
        ...(config.planear_desayuno ? ['desayuno'] : []),
        ...(config.planear_almuerzo ? ['almuerzo'] : []),
        ...(config.planear_cena     ? ['cena']     : []),
        ...(config.planear_snacks   ? ['snack']    : []),
      ])

      const slotAttendance: import('../lib/motorMenu').SlotAttendance[] = []
      for (let day = 1; day <= 7; day++) {
        for (const { mealName, mealType: tipo } of mealSlots) {
          const mealNameNorm = mealName.toLowerCase().trim()

          // Miembros que tienen ESTE slot configurado individualmente
          const membersWithMeal = allMembers.filter(m => {
            const memberMeals = (m.meals_per_day ?? []) as { name: string; time: string }[]
            if (memberMeals.length === 0) {
              // Sin config individual → usar flags globales de la familia
              return globalMealTypes.has(tipo)
            }
            return memberMeals.some(mm => mm.name.toLowerCase().trim() === mealNameNorm)
          })

          // Descontar ausencias
          const presentMembers = membersWithMeal.filter(m =>
            !absenceSet.some((a: { member_id: string; day_of_week: number; meal_type: string }) =>
              a.member_id === m.id && a.day_of_week === day &&
              (a.meal_type === tipo || a.meal_type.toLowerCase() === mealNameNorm)
            )
          )

          const slotGuests = guests.filter((g: { day_of_week: number; meal_type: string }) =>
            g.day_of_week === day && (g.meal_type === tipo || g.meal_type.toLowerCase() === mealNameNorm)
          )
          const guestCount = slotGuests.reduce((s: number, g: { cantidad: number }) => s + g.cantidad, 0)

          // Restricciones de invitados
          const guestRestrictions: string[] = []
          for (const g of slotGuests as { notas: string | null }[]) {
            if (!g.notas) continue
            const n = g.notas.toLowerCase()
            if (n.includes('vegetarian')) guestRestrictions.push('vegetariana')
            if (n.includes('sin gluten') || n.includes('celiaco') || n.includes('celiaca')) guestRestrictions.push('sin_gluten')
            if (n.includes('sin lacteo') || n.includes('lactosa')) guestRestrictions.push('sin_lacteos')
          }

          // Solo agregar el slot si hay al menos un miembro o un invitado
          if (presentMembers.length + guestCount === 0) continue

          slotAttendance.push({
            dayOfWeek:         day,
            mealType:          tipo,
            mealName:          mealName,
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
      const nivelNevera = calcularNivelNevera(fridgeItems).porcentaje

      // Traer sobras pendientes de los últimos 3 días
      const hace3Dias = new Date()
      hace3Dias.setDate(hace3Dias.getDate() - 3)
      const { data: leftoversData } = await supabase
        .from('weekly_leftovers')
        .select('ingredient_name, created_at')
        .eq('family_id', familyId)
        .eq('week_start', weekStart)

      const leftovers = (leftoversData ?? []) as import('../lib/motorMenu').LeftoverItem[]

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
        leftovers,
      })
      set({ progress: 85 })

      // 9. Borrar menú previo de esta semana y guardar el nuevo
      await supabase.from('weekly_menu').delete()
        .eq('family_id', familyId).eq('week_start', weekStart)

      // Calcular acción de preparación según días de cocción configurados
      const diasCoccion = new Set(config.dias_coccion ?? [])
      const decidirAccion = (day: number): string => {
        if (diasCoccion.size === 0 || diasCoccion.has(day)) return 'cocinar'
        // Buscar el día de cocción más reciente
        let diasAtras = 0
        for (let d = day - 1; d >= 1; d--) {
          diasAtras++
          if (diasCoccion.has(d)) break
        }
        if (diasAtras <= 1) return 'calentar'
        if (diasAtras <= 2) return 'calentar'
        return 'descongelar'
      }

      const rows = slots.flatMap(slot =>
        slot.components.map(comp => ({
          family_id:           familyId,
          week_start:          weekStart,
          day_of_week:         slot.dayOfWeek,
          meal_type:           slot.mealName ?? slot.tipo,
          meal_time:           slot.mealTime ?? null,
          meal_component:      comp.component,
          recipe_id:           comp.recipe.id,
          member_id:           comp.memberId,
          is_main_recipe:      comp.component === 'proteina' || comp.component === 'completo',
          servings:            comp.servings,
          status:              'planned',
          accion_preparacion:  (comp.component === 'proteina' || comp.component === 'completo')
                               ? decidirAccion(slot.dayOfWeek)
                               : 'preparar_fresco',
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
          protein_nombre: entry.recipe?.nombre ?? entry.nombre_custom ?? '',
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

    const currentRecipeId = entry.recipe_id

    // Normalizar meal_type: puede llegar como "Almuerzo", "merienda tarde", etc.
    const raw = (entry.meal_type ?? '').toLowerCase()
    const normalizedType = raw.includes('snack') || raw.includes('merienda') || raw.includes('onces')
      ? 'snack'
      : raw.includes('desayuno') || raw.includes('brunch')
        ? 'desayuno'
        : raw.includes('almuerzo') || raw.includes('lunch')
          ? 'almuerzo'
          : raw.includes('cena') || raw.includes('dinner')
            ? 'cena'
            : raw

    const tiposValidos = normalizedType === 'snack'
      ? ['snack', 'merienda']
      : normalizedType === 'desayuno'
        ? ['desayuno', 'brunch']
        : [normalizedType]

    // Usar contains() que es compatible con text[] y jsonb.
    // Para múltiples tipos (snack/merienda) filtramos en JS después.
    let query = supabase
      .from('recipes')
      .select(RECIPE_SELECT)
      .eq('is_active_for_menu', true)

    if (razon === 'muy_dificil') query = query.eq('dificultad', 'facil')

    const { data, error } = await query.limit(400)
    if (error || !data) return []

    const mealComp      = entry.meal_component   // 'proteina' | 'guarnicion' | 'ensalada' | 'salsa' | 'completo' | ...
    const currentTipoC  = entry.recipe?.tipo_componente  // clasificación explícita en BD

    // Filtrar por tipo de comida del slot
    let candidates = (data as RecipeForMenu[])
      .filter(r => tiposValidos.some(t => (r.tipo_comida ?? []).includes(t)) ||
                   // accesorios (salsa/ensalada/guarnicion) tienen tipo_comida=[] — incluir por tipo_componente
                   (currentTipoC && r.tipo_componente === currentTipoC))
      .filter(r => r.id !== currentRecipeId)

    // Para accesorios (guarnición, ensalada, salsa, etc.) filtrar por mismo tipo_componente
    const ACCESORIOS = new Set(['guarnicion', 'ensalada', 'salsa', 'vinagreta', 'sopa'])
    if (mealComp && ACCESORIOS.has(mealComp)) {
      // Buscar por tipo_componente igual al de la receta actual
      const byTC = candidates.filter(r => r.tipo_componente === currentTipoC)
      // Si hay candidatos del mismo tipo_componente, usar solo esos
      if (byTC.length > 0) candidates = byTC
    }

    if (razon === 'no_apetece') {
      const currentName = (entry.recipe?.nombre ?? '').toLowerCase()
      candidates = candidates.filter(r =>
        !r.nombre.toLowerCase().split(' ').some(w => w.length > 4 && currentName.includes(w))
      )
    }

    // Devolver todos los candidatos mezclados — CambiarSheet pagina de 5 en 5
    return candidates.sort(() => Math.random() - 0.5)
  },

  // ── Simplificar las próximas N comidas (modo día difícil) ──────────────────
  simplificarComidas: async (familyId, cuantas) => {
    const todayDate  = new Date()
    // day_of_week 1=lun … 7=dom; getDay() 0=dom
    const jsDay      = todayDate.getDay()
    const todayDow   = jsDay === 0 ? 7 : jsDay

    const horaActual   = todayDate.getHours()
    const minutoActual = todayDate.getMinutes()
    const nowMinutes   = horaActual * 60 + minutoActual

    // Determina si una comida ya pasó.
    // Usa meal_time si está disponible (ej: "16:00") — es la hora que el usuario configuró.
    // Fallback: ventanas típicas por tipo.
    //
    // Ventanas típicas:
    //   Desayuno       06:00–08:00  → pasó a las 08:00
    //   Merienda mañana 09:00–10:00 → pasó a las 10:30
    //   Almuerzo       12:00–14:00  → pasó a las 14:00
    //   Merienda tarde 15:00–16:00  → pasó a las 16:30
    //   Cena           18:00–20:00  → pasó a las 20:00
    //   Snack noche    20:00–21:00  → pasó a las 21:30
    const HORA_CORTE_MIN: Record<string, number> = {
      desayuno:           8  * 60,       // 08:00
      'merienda mañana':  10 * 60 + 30,  // 10:30
      almuerzo:           14 * 60,       // 14:00
      'merienda tarde':   16 * 60 + 30,  // 16:30
      cena:               20 * 60,       // 20:00
      'snack noche':      21 * 60 + 30,  // 21:30
      snack:              16 * 60 + 30,  // 16:30 (genérico)
      merienda:           16 * 60 + 30,
    }
    const yaFuePara = (mealType: string, mealTime?: string): boolean => {
      if (mealTime) {
        // Hora configurada por el usuario + 30 min de gracia
        const [h, m] = mealTime.split(':').map(Number)
        return nowMinutes >= (h * 60 + (m ?? 0)) + 30
      }
      // Fallback por tipo
      const key = mealType.toLowerCase()
      if (HORA_CORTE_MIN[key] !== undefined) return nowMinutes >= HORA_CORTE_MIN[key]
      for (const [k, v] of Object.entries(HORA_CORTE_MIN)) {
        if (key.startsWith(k)) return nowMinutes >= v
      }
      return false
    }

    // Próximos slots no cocinados a partir de ahora
    const upcoming = get().menu
      .filter(e =>
        e.is_main_recipe &&
        e.status === 'planned' &&
        e.recipe_id !== null &&
        (e.day_of_week > todayDow ||
          (e.day_of_week === todayDow && !yaFuePara(e.meal_type, e.meal_time)))
      )
      .sort((a, b) => {
        if (a.day_of_week !== b.day_of_week) return a.day_of_week - b.day_of_week
        // meal_time (ej: "16:00") es la fuente más precisa para ordenar
        if (a.meal_time && b.meal_time) return a.meal_time.localeCompare(b.meal_time)
        if (a.meal_time) return -1
        if (b.meal_time) return 1
        return 0
      })
      .slice(0, cuantas)

    if (upcoming.length === 0) return 0

    // Para cada slot, buscar la receta más fácil y rápida del mismo tipo
    let changed = 0
    const TC_EXCLUIR = new Set(['ensalada', 'salsa', 'vinagreta', 'guarnicion', 'carbohidrato'])

    // Fetch único de TODAS las recetas activas (sin filtro de dificultad)
    // así siempre hay candidatos aunque ninguna tenga dificultad='facil'
    const { data: todasRecetas, error: recipeError } = await supabase
      .from('recipes')
      .select(RECIPE_SELECT)
      .eq('is_active_for_menu', true)
      .limit(500)

    if (recipeError) throw new Error(`recipes query: ${recipeError.message}`)

    for (const entry of upcoming) {
      // Normalizar meal_type igual que buscarAlternativas
      const raw = (entry.meal_type ?? '').toLowerCase()
      const normalizedType = raw.includes('snack') || raw.includes('merienda') || raw.includes('onces')
        ? 'snack'
        : raw.includes('desayuno') || raw.includes('brunch')
          ? 'desayuno'
          : raw.includes('almuerzo')
            ? 'almuerzo'
            : raw.includes('cena')
              ? 'cena'
              : raw

      const tiposValidos = normalizedType === 'snack'
        ? ['snack', 'merienda']
        : normalizedType === 'desayuno'
          ? ['desayuno', 'brunch']
          : [normalizedType]

      const pool = (todasRecetas ?? []).filter((r: RecipeForMenu) =>
        r.id !== entry.recipe_id &&
        Array.isArray(r.tipo_comida) &&
        tiposValidos.some(t => r.tipo_comida.includes(t)) &&
        !TC_EXCLUIR.has(r.tipo_componente ?? '')
      )
      if (pool.length === 0) continue

      // Prioridad: etiqueta_practicidad='diario' → dificultad='facil' → menor tiempo
      const score = (r: RecipeForMenu) => {
        let s = 0
        if (r.etiqueta_practicidad === 'diario') s += 100
        if (r.dificultad === 'facil')             s += 50
        if (r.tiempo_total_min)                   s -= Math.min(r.tiempo_total_min, 60)
        return s
      }
      pool.sort((a, b) => score(b) - score(a))

      // Elegir aleatoriamente entre los 3 mejores candidatos
      const top     = pool.slice(0, Math.min(3, pool.length))
      const chosen  = top[Math.floor(Math.random() * top.length)]
      const { error: updateError } = await supabase
        .from('weekly_menu')
        .update({ recipe_id: chosen.id, status: 'swapped', dia_dificil: true })
        .eq('id', entry.id)

      if (updateError) throw new Error(`weekly_menu update: ${updateError.message}`)

      set(s => ({
        menu: s.menu.map(e => e.id === entry.id
          ? { ...e, recipe_id: chosen.id, status: 'swapped', dia_dificil: true, recipe: chosen as RecipeForMenu }
          : e
        )
      }))
      changed++
    }

    await new Promise(r => setTimeout(r, 300))
    await get().loadMenu(familyId, getMondayOfWeek())

    return changed
  },

  // ── Cambiar receta por una alternativa ──────────────────────────────────────
  cambiarReceta: async (entryId, newRecipeId) => {
    await supabase
      .from('weekly_menu')
      .update({ recipe_id: newRecipeId, status: 'swapped', dia_dificil: false })
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

  asignarSobraEnMenu: async (familyId, weekStart, dayOfWeek, mealType, nombreCustom) => {
    const { data: inserted, error } = await supabase
      .from('weekly_menu')
      .insert({
        family_id:      familyId,
        week_start:     weekStart,
        day_of_week:    dayOfWeek,
        meal_type:      mealType,
        meal_component: 'completo',
        // recipe_id omitido — columna nullable después de migración 017
        nombre_custom:  nombreCustom,
        member_id:      null,
        is_main_recipe: false,
        servings:       1,
        status:         'planned',
      })
      .select()
      .single()

    if (error) {
      return { ok: false, msg: `${error.code}: ${error.message}` }
    }

    if (inserted) {
      const entry: EnrichedMenuEntry = {
        ...(inserted as Omit<EnrichedMenuEntry, 'recipe'>),
        meal_component: 'completo',
        nombre_custom:  nombreCustom,
        status:         'planned',
        recipe:         undefined,
      }
      set(s => ({ menu: [...s.menu, entry] }))
    }
    return { ok: !!inserted, msg: '' }
  },
}))
