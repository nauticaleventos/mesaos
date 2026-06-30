import { useEffect, useState, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { RefreshCw, Printer, Share2, Search } from 'lucide-react'
import { useFamilyStore } from '../store/familyStore'
import { useFridgeStore, type FridgeItem } from '../store/fridgeStore'
import { useMenuStore }   from '../store/menuStore'
import { useShoppingListStore, normIngrediente, type ShoppingListItem } from '../store/shoppingListStore'
import { getMondayOfWeek } from '../lib/motorMenu'
import { inventarioTiene } from '../lib/matchReceta'
import BottomNav from '../components/ui/BottomNav'
import { AdNativeCard } from '../components/ads/AdPlaceholders'

const PASILLOS: Record<string, { emoji: string; label: string }> = {
  frutas_verduras:    { emoji: '🥬', label: 'Frutas y verduras' },
  carniceria:         { emoji: '🥩', label: 'Carnicería' },
  pescaderia:         { emoji: '🐟', label: 'Pescadería' },
  lacteos_huevos:     { emoji: '🥛', label: 'Lácteos y huevos' },
  panaderia:          { emoji: '🥖', label: 'Panadería' },
  congelados:         { emoji: '🧊', label: 'Congelados' },
  granos_pastas:      { emoji: '🌾', label: 'Granos y pastas' },
  enlatados:          { emoji: '🥫', label: 'Enlatados' },
  aceites_condimentos:{ emoji: '🫒', label: 'Aceites y condimentos' },
  snacks_dulces:      { emoji: '🍬', label: 'Snacks y dulces' },
  suplementos:        { emoji: '💪', label: 'Suplementos y proteínas' },
  bebidas:            { emoji: '🥤', label: 'Bebidas' },
  aseo_hogar:         { emoji: '🧼', label: 'Aseo' },
  otros:              { emoji: '📦', label: 'Otros' },
}
const PASILLO_ORDER = Object.keys(PASILLOS)

// Filtro = qué incluir · Orden = cómo mostrar (independientes y combinables)
type Filtro = 'todo' | 'proximas' | 'receta' | 'semanas'
type Orden  = 'pasillos' | 'alfabetico'

const CORTE_MIN: Record<string, number> = {
  desayuno: 8 * 60, brunch: 8 * 60,
  'merienda mañana': 10 * 60 + 30, onces: 10 * 60 + 30,
  almuerzo: 14 * 60, comida: 14 * 60,
  merienda: 16 * 60 + 30, 'merienda tarde': 16 * 60 + 30,
  snack: 16 * 60 + 30, 'snack noche': 20 * 60,
  cena: 20 * 60,
}
function corteMeal(mt: string): number {
  const k = mt.toLowerCase()
  if (CORTE_MIN[k] !== undefined) return CORTE_MIN[k]
  for (const [kw, v] of Object.entries(CORTE_MIN)) { if (k.includes(kw)) return v }
  return 14 * 60
}

const DAY_FULL: Record<number, string> = {
  1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves',
  5: 'Viernes', 6: 'Sábado', 7: 'Domingo',
}

function mealLabel(mt: string): string {
  const k = mt.toLowerCase()
  if (k.includes('desayuno') || k.includes('brunch'))       return 'Desayuno'
  if (k.includes('almuerzo') || k.includes('comida'))       return 'Almuerzo'
  if (k.includes('cena'))                                    return 'Cena'
  if (k.includes('merienda') || k.includes('snack') || k.includes('onces')) return 'Merienda'
  return mt.charAt(0).toUpperCase() + mt.slice(1)
}

function formatCantidad(cantidad: number, unidad: string): string {
  if (cantidad === 0) return ''
  const n = Number.isInteger(cantidad) ? cantidad : Math.round(cantidad * 10) / 10
  return `${n} ${unidad}`
}

export default function MercadoPage() {
  const navigate                        = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { family }                      = useFamilyStore()
  const { items: fridgeItems }          = useFridgeStore()
  const { menu, semanasGeneradas, cargarSemanas } = useMenuStore()
  const { listId, items, loading, generating, desglose, semanasMercado, listaDesactualizada, loadList, generateList, setSemanasMercado, toggleComprado } = useShoppingListStore()
  const [expandedItem, setExpandedItem] = useState<string | null>(null)

  const [filtro, setFiltroState] = useState<Filtro>(
    () => (localStorage.getItem('mesa_mercado_filtro') as Filtro) ?? 'todo'
  )
  const [orden, setOrdenState] = useState<Orden>(
    () => (localStorage.getItem('mesa_mercado_orden') as Orden) ?? 'pasillos'
  )
  const [nComidas, setNComidasState] = useState<number>(
    () => parseInt(localStorage.getItem('mesa_mercado_n_comidas') ?? '7', 10)
  )
  const [nComidasStr, setNComidasStr] = useState(
    () => localStorage.getItem('mesa_mercado_n_comidas') ?? '7'
  )
  const [recetaModo, setRecetaModo]     = useState<string>(() => localStorage.getItem('mesa_mercado_receta_filtro') ?? '')
  const [busqueda, setBusqueda]         = useState('')
  const [noUsanExpandido, setNoUsanExpandido] = useState(false)
  const [filtroDefaultAplicado, setFiltroDefaultAplicado] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const setFiltro = (f: Filtro) => { setFiltroState(f); localStorage.setItem('mesa_mercado_filtro', f) }
  const setOrden  = (o: Orden)  => { setOrdenState(o);  localStorage.setItem('mesa_mercado_orden', o) }
  const setNComidas = (n: number) => {
    setNComidasState(n)
    setNComidasStr(String(n))
    localStorage.setItem('mesa_mercado_n_comidas', String(n))
  }

  const recetaFiltro = searchParams.get('receta') ? decodeURIComponent(searchParams.get('receta')!) : null

  const weekStart = getMondayOfWeek()
  const tieneMenu = menu.some(e => e.is_main_recipe)
  const multiSemana = semanasGeneradas.length > 1

  useEffect(() => { if (family?.id) { loadList(family.id); cargarSemanas(family.id) } }, [family?.id])

  // Default de semanas según frecuencia de mercado (solo la primera vez, si no hay selección).
  useEffect(() => {
    if (!family?.id || semanasGeneradas.length === 0 || semanasMercado.length > 0) return
    const fm = family.frecuencia_mercado
    const n = fm === 'mensual' ? semanasGeneradas.length : fm === 'quincenal' ? 2 : 1
    setSemanasMercado(family.id, fridgeItems, semanasGeneradas.slice(0, n))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [family?.id, semanasGeneradas.length])

  // Rango de fechas de una semana: "30/06 al 06/07"
  const rangoSemana = (ws: string): string => {
    const fmt = (iso: string) => { const p = iso.split('-'); return `${p[2]}/${p[1]}` }
    const fin = (() => { const d = new Date(ws + 'T12:00:00'); d.setDate(d.getDate() + 6); return d.toISOString().split('T')[0] })()
    return `${fmt(ws)} al ${fmt(fin)}`
  }
  // Semanas efectivamente incluidas en la lista (vacío = semana actual).
  const semanasActivas = semanasMercado.length ? semanasMercado : (semanasGeneradas.length ? [semanasGeneradas[0]] : [weekStart])
  const toggleSemana = (ws: string) => {
    if (!family?.id) return
    const sel = semanasMercado.length ? semanasMercado : semanasActivas
    const next = sel.includes(ws) ? sel.filter(w => w !== ws) : [...sel, ws].sort()
    if (next.length === 0) return // no permitir 0 semanas
    setSemanasMercado(family.id, fridgeItems, next)
  }

  // ── Recetas del menú para sub-selector ───────────────────────────────────
  const recetasMenu: string[] = useMemo(() => {
    const nombres = menu
      .filter(e => e.is_main_recipe && e.recipe_id !== null && e.recipe?.nombre)
      .map(e => e.recipe!.nombre)
    return [...new Set(nombres)].sort((a, b) => a.localeCompare(b, 'es'))
  }, [menu])

  useEffect(() => {
    if (filtro === 'receta' && !recetaModo && recetasMenu.length > 0) setRecetaModo(recetasMenu[0])
  }, [filtro, recetasMenu, recetaModo])

  // Persistir la receta filtrada
  useEffect(() => { if (recetaModo) localStorage.setItem('mesa_mercado_receta_filtro', recetaModo) }, [recetaModo])

  // Si quedó 'semanas' guardado pero ya no hay multi-semana, volver a 'todo'.
  useEffect(() => { if (filtro === 'semanas' && !multiSemana) setFiltro('todo') }, [filtro, multiSemana])

  // Default inteligente del FILTRO según frecuencia de mercado (una sola vez).
  useEffect(() => {
    if (filtroDefaultAplicado || !family?.id) return
    if (localStorage.getItem('mesa_mercado_filtro')) { setFiltroDefaultAplicado(true); return }
    const fm = family.frecuencia_mercado
    if ((fm === 'mensual' || fm === 'quincenal') && semanasGeneradas.length > 1) setFiltro('semanas')
    else setFiltro('todo')
    setFiltroDefaultAplicado(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [family?.id, semanasGeneradas.length])

  // ── Comidas activas (ordenadas) — base para secciones ───────────────────
  interface MealEntry { dayOfWeek: number; dayLabel: string; mealType: string; mealLabel: string; recipeName: string }

  const activeMeals: MealEntry[] = useMemo(() => {
    const now    = new Date()
    const isoDow = now.getDay() === 0 ? 7 : now.getDay()
    const nowMin = now.getHours() * 60 + now.getMinutes()

    const base = menu.filter(e => e.is_main_recipe && e.recipe_id !== null && e.recipe?.nombre)

    // Dedup helper — un slot = (day_of_week × meal_type), independiente de member_id
    const dedup = (arr: typeof base) => {
      const seen = new Set<string>()
      return arr.filter(e => {
        const k = `${e.day_of_week}::${e.meal_type}`
        if (seen.has(k)) return false
        seen.add(k)
        return true
      })
    }

    const toMealEntry = (e: typeof base[0]) => ({
      dayOfWeek:  e.day_of_week,
      dayLabel:   DAY_FULL[e.day_of_week] ?? '',
      mealType:   e.meal_type,
      mealLabel:  mealLabel(e.meal_type),
      recipeName: e.recipe!.nombre,
    })

    if (filtro === 'proximas') {
      const sorted = base
        .filter(e => {
          if (e.day_of_week > isoDow) return true
          if (e.day_of_week === isoDow) return nowMin < corteMeal(e.meal_type)
          return false
        })
        .filter(e => e.status !== 'skipped' && e.status !== 'cooked')
        .sort((a, b) =>
          a.day_of_week !== b.day_of_week
            ? a.day_of_week - b.day_of_week
            : corteMeal(a.meal_type) - corteMeal(b.meal_type)
        )
      return dedup(sorted).slice(0, nComidas).map(toMealEntry)
    }

    const targetRecipe = filtro === 'receta' ? recetaModo : recetaFiltro
    if (targetRecipe) {
      const sorted = base
        .filter(e => e.recipe!.nombre === targetRecipe)
        .sort((a, b) =>
          a.day_of_week !== b.day_of_week
            ? a.day_of_week - b.day_of_week
            : corteMeal(a.meal_type) - corteMeal(b.meal_type)
        )
      return dedup(sorted).map(toMealEntry)
    }

    return []
  }, [menu, filtro, nComidas, recetaModo, recetaFiltro])

  // Nombres de recetas de las comidas activas (para filtrar items)
  const proximasRecetas: string[] = useMemo(
    () => [...new Set(activeMeals.map(m => m.recipeName))],
    [activeMeals]
  )

  // Map: recipeName → ingredient names (raw, para fallback con nombre de ingrediente)
  const recipeIngMap = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const e of menu) {
      if (!e.is_main_recipe || !e.recipe?.nombre) continue
      const ings = (e.recipe.ingredientes ?? []).filter(i => i.esencial).map(i => i.nombre)
      const existing = map.get(e.recipe.nombre) ?? []
      map.set(e.recipe.nombre, [...new Set([...existing, ...ings])])
    }
    return map
  }, [menu])

  // ── Helpers de matching ───────────────────────────────────────────────────
  // Verifica si un item de lista corresponde a algún ingrediente de una receta
  // Fallback para listas stale donde recetas_origen no matchea el nombre actual
  const itemMatchesRecipe = (itemNom: string, recipeName: string): boolean => {
    const ings = recipeIngMap.get(recipeName) ?? []
    return ings.some(ing => inventarioTiene([{ name: itemNom }], ing).tiene)
  }

  const enFridgeActual = (nom: string) => !inventarioTiene(fridgeItems, nom).tiene

  // ── Filtro de items ──────────────────────────────────────────────────────
  const itemsFiltrados = useMemo(() => {
    return items.filter(i => {
      if (busqueda && !i.ingrediente_nombre.toLowerCase().includes(busqueda.toLowerCase())) return false

      if (recetaFiltro) {
        const match = i.recetas_origen.includes(recetaFiltro) || itemMatchesRecipe(i.ingrediente_nombre, recetaFiltro)
        if (!match) return false
        return i.faltante || enFridgeActual(i.ingrediente_nombre)
      }
      if (filtro === 'proximas') {
        const byReceta = proximasRecetas.some(r => i.recetas_origen.includes(r))
        const byIng    = !byReceta && proximasRecetas.some(r => itemMatchesRecipe(i.ingrediente_nombre, r))
        if (!byReceta && !byIng) return false
        return i.faltante || enFridgeActual(i.ingrediente_nombre)
      }
      if (filtro === 'receta') {
        if (!recetaModo) return false
        const match = i.recetas_origen.includes(recetaModo) || itemMatchesRecipe(i.ingrediente_nombre, recetaModo)
        if (!match) return false
        return i.faltante || enFridgeActual(i.ingrediente_nombre)
      }

      // Pasillos / Alfabético: usar el faltante precalculado
      return i.faltante
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, busqueda, recetaFiltro, filtro, proximasRecetas, recetaModo, fridgeItems, recipeIngMap])

  // ── Contexto inline para modo alfabético ─────────────────────────────────
  const recipeContextMap = useMemo(() => {
    const map = new Map<string, { dayOfWeek: number; mealType: string }[]>()
    for (const e of menu) {
      if (!e.is_main_recipe || !e.recipe?.nombre) continue
      const n = e.recipe.nombre
      if (!map.has(n)) map.set(n, [])
      const list = map.get(n)!
      if (!list.some(x => x.dayOfWeek === e.day_of_week && x.mealType === e.meal_type))
        list.push({ dayOfWeek: e.day_of_week, mealType: e.meal_type })
    }
    return map
  }, [menu])

  const getItemContextAlfa = (item: ShoppingListItem): string => {
    const parts: string[] = []
    for (const rn of item.recetas_origen) {
      const occasions = recipeContextMap.get(rn)
      if (!occasions?.length) continue
      for (const { dayOfWeek, mealType } of occasions)
        parts.push(`${rn} · ${mealLabel(mealType)} ${DAY_FULL[dayOfWeek] ?? ''}`)
    }
    return parts.join(', ')
  }

  // ── Widget nevera: ingredientes del scope vs nevera ──────────────────────
  const scopeIngredientes = useMemo(() => {
    // El scope de la nevera se recalcula según el FILTRO activo.
    const scopeRecipes = new Set<string>()
    if (filtro === 'proximas')                 activeMeals.forEach(m => scopeRecipes.add(m.recipeName))
    else if (filtro === 'receta' && recetaModo) scopeRecipes.add(recetaModo)
    else if (recetaFiltro)                      scopeRecipes.add(recetaFiltro)
    else menu.filter(e => e.is_main_recipe && e.recipe?.nombre).forEach(e => scopeRecipes.add(e.recipe!.nombre))
    const noms = new Set<string>()
    for (const e of menu) {
      if (!e.is_main_recipe || !e.recipe?.nombre || !scopeRecipes.has(e.recipe.nombre)) continue
      for (const ing of (e.recipe.ingredientes ?? [])) noms.add(ing.nombre)
    }
    return [...noms]
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menu, filtro, activeMeals, recetaModo, recetaFiltro])

  const { fridgeUsados, fridgeNoUsados } = useMemo(() => {
    if (fridgeItems.length === 0) return { fridgeUsados: [] as FridgeItem[], fridgeNoUsados: [] as FridgeItem[] }
    const usados: FridgeItem[] = []
    const noUsados: FridgeItem[] = []
    for (const fi of fridgeItems) {
      const seUsa = scopeIngredientes.some(ingNom => inventarioTiene([{ name: fi.name }], ingNom).tiene)
      if (seUsa) usados.push(fi)
      else noUsados.push(fi)
    }
    return { fridgeUsados: usados, fridgeNoUsados: noUsados }
  }, [fridgeItems, scopeIngredientes])

  // ── Agrupación por pasillo (modo pasillos y fallback) ────────────────────
  const porPasillo = useMemo(() => {
    const map = new Map<string, ShoppingListItem[]>()
    if (orden === 'pasillos') {
      for (const item of itemsFiltrados) {
        const p = item.categoria_pasillo
        if (!map.has(p)) map.set(p, [])
        map.get(p)!.push(item)
      }
    } else if (orden === 'alfabetico') {
      const sorted = [...itemsFiltrados].sort((a, b) =>
        a.ingrediente_nombre.localeCompare(b.ingrediente_nombre, 'es')
      )
      if (sorted.length > 0) map.set('_alpha', sorted)
    }
    for (const [p, arr] of map.entries())
      map.set(p, arr.sort((a, b) => a.ingrediente_nombre.localeCompare(b.ingrediente_nombre, 'es')))
    return map
  }, [itemsFiltrados, orden])

  const pasillosConItems = orden === 'pasillos'
    ? PASILLO_ORDER.filter(p => porPasillo.has(p))
    : porPasillo.has('_alpha') ? ['_alpha'] : []

  const totalFaltantes = items.filter(i => i.faltante).length
  const comprados      = items.filter(i => i.comprado).length

  // ── Share / Print ────────────────────────────────────────────────────────
  // Etiqueta del scope (qué incluye) según filtro.
  const scopeLabel = (): string => {
    if (recetaFiltro)            return recetaFiltro
    if (filtro === 'receta')     return recetaModo || 'una receta'
    if (filtro === 'proximas')   return `próximas ${nComidas} comidas`
    if (filtro === 'semanas' && multiSemana) return tituloSemanas.replace(/^Lista para /, '')
    return 'todo el menú'
  }
  const ordenLabel = orden === 'alfabetico' ? 'alfabético' : 'por pasillos'
  const getTitulo    = (): string => `Lista para ${scopeLabel()} (${ordenLabel})`
  const getEncabezado = (): string => `🛒 ${getTitulo()}:\n`

  const getPrintUrl = (): string => {
    // Título combinado (filtro + orden) + params de filtrado de items.
    const t = `&titulo=${encodeURIComponent(getTitulo())}`
    const o = orden === 'alfabetico' ? '&orden=alfabetico' : ''
    if (recetaFiltro)
      return `/mercado/imprimir?receta=${encodeURIComponent(recetaFiltro)}${t}${o}`
    if (filtro === 'receta' && recetaModo)
      return `/mercado/imprimir?receta=${encodeURIComponent(recetaModo)}${t}${o}`
    if (filtro === 'proximas' && proximasRecetas.length > 0)
      return `/mercado/imprimir?recetas=${encodeURIComponent(proximasRecetas.join(','))}&n=${nComidas}${t}${o}`
    return `/mercado/imprimir?x=1${t}${o}`
  }

  const handleShare = async () => {
    const shareItems = items.filter(i => {
      if (!i.faltante || i.comprado) return false
      if (recetaFiltro)        return i.recetas_origen.includes(recetaFiltro)
      if (filtro === 'proximas') return proximasRecetas.some(r => i.recetas_origen.includes(r))
      if (filtro === 'receta')   return recetaModo ? i.recetas_origen.includes(recetaModo) : true
      return true
    })
    const texto = getEncabezado() + shareItems
      .map(i => `• ${i.ingrediente_nombre} ${formatCantidad(i.cantidad_total, i.unidad)}`)
      .join('\n')
    if (navigator.share) await navigator.share({ title: getTitulo(), text: texto })
    else await navigator.clipboard.writeText(texto)
  }

  const handleGenerar = async () => {
    if (!family?.id) return
    await generateList(family.id, fridgeItems, filtro === 'semanas' ? semanasActivas : undefined)
  }

  // D — Regenerar lista manual (respeta el filtro activo).
  const handleRegenerarLista = async () => {
    if (!family?.id) return
    await generateList(family.id, fridgeItems, filtro === 'semanas' ? semanasActivas : undefined)
    setToast('Lista actualizada')
    setTimeout(() => setToast(null), 2500)
  }

  // Opciones del FILTRO (qué incluir). "Por semanas" solo con menú multi-semana.
  const filtroOpciones: { value: Filtro; label: string }[] = [
    { value: 'todo',     label: '🛒 Todo el menú'        },
    { value: 'proximas', label: '⏰ Próximas comidas'     },
    { value: 'receta',   label: '🍽️ Una receta del menú' },
    ...(multiSemana ? [{ value: 'semanas' as Filtro, label: '📅 Por semanas' }] : []),
  ]

  // Título dinámico de la lista según semanas incluidas.
  const tituloSemanas = (() => {
    const sel = semanasActivas
    if (sel.length === 0) return ''
    const idxs = sel.map(ws => semanasGeneradas.indexOf(ws)).filter(i => i >= 0).map(i => i + 1).sort((a, b) => a - b)
    const primera = sel[0], ultima = sel[sel.length - 1]
    const fmt = (iso: string) => { const p = iso.split('-'); return `${p[2]}/${p[1]}` }
    const fin = (() => { const d = new Date(ultima + 'T12:00:00'); d.setDate(d.getDate() + 6); return d.toISOString().split('T')[0] })()
    const rango = `del ${fmt(primera)} al ${fmt(fin)}`
    if (sel.length === semanasGeneradas.length && semanasGeneradas.length > 1) return `Lista para las ${sel.length} semanas (${rango})`
    if (sel.length === 1) return `Lista para semana ${idxs[0] ?? 1} (${rangoSemana(sel[0])})`
    return `Lista para semanas ${idxs.join('-')} (${rango})`
  })()

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen pb-32 max-w-lg mx-auto">
      <BottomNav />

      {/* Header */}
      <div className="sticky top-0 bg-bg/95 backdrop-blur z-10 px-4 pt-6 pb-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-text">🛒 Lista de mercado</h1>
            <p className="text-xs text-muted mt-0.5">
              Semana del {new Date(weekStart + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
              {listId ? ` · ${totalFaltantes} faltantes` : ''}
            </p>
          </div>
          <div className="flex gap-2">
            {listId && (
              <>
                <button onClick={handleShare}
                  className="p-2 rounded-xl border border-border text-muted hover:text-accent hover:border-accent transition-colors">
                  <Share2 size={16} />
                </button>
                <button onClick={() => window.open(getPrintUrl(), '_blank')}
                  className="p-2 rounded-xl border border-border text-muted hover:text-accent hover:border-accent transition-colors">
                  <Printer size={16} />
                </button>
              </>
            )}
            <button onClick={handleGenerar} disabled={generating || !tieneMenu}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-accent text-accent text-sm font-medium hover:bg-accent/5 transition-colors disabled:opacity-40">
              <RefreshCw size={15} className={generating ? 'animate-spin' : ''} />
              {listId ? 'Regenerar' : 'Generar lista'}
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 py-4">

        {/* Sin menú */}
        {!tieneMenu && (
          <div className="card flex flex-col items-center gap-4 py-8 text-center">
            <span className="text-4xl">🍽️</span>
            <div>
              <p className="font-semibold text-text">Generá el menú primero</p>
              <p className="text-muted text-sm mt-1">La lista se arma a partir de las recetas de la semana.</p>
            </div>
            <button onClick={() => navigate('/menu')} className="btn-primary max-w-xs">Ir al menú</button>
          </div>
        )}

        {/* Cargando */}
        {(loading || generating) && (
          <div className="flex items-center justify-center py-16 gap-3 text-muted">
            <div className="flex gap-1">
              {[0,150,300].map(d => (
                <span key={d} className="w-2 h-2 rounded-full bg-accent animate-bounce" style={{ animationDelay: `${d}ms` }} />
              ))}
            </div>
            <span className="text-sm">{generating ? 'Armando lista…' : 'Cargando…'}</span>
          </div>
        )}

        {/* Sin lista generada */}
        {!loading && !generating && tieneMenu && !listId && (
          <div className="card flex flex-col items-center gap-4 py-8 text-center">
            <span className="text-4xl">🛒</span>
            <div>
              <p className="font-semibold text-text">Lista no generada</p>
              <p className="text-muted text-sm mt-1">Tocá "Generar lista" para crear la lista de la semana.</p>
            </div>
          </div>
        )}

        {/* C — Banner: el menú cambió y la lista puede estar desactualizada */}
        {tieneMenu && !loading && !generating && listaDesactualizada && (
          <div className="p-3 rounded-2xl bg-orange-50 border border-orange-200 mb-3 flex items-center gap-2">
            <span>⚠️</span>
            <p className="text-sm text-orange-800 flex-1">Tu menú cambió. La lista puede estar desactualizada.</p>
            <button onClick={handleRegenerarLista} className="text-xs font-semibold text-white bg-orange-500 px-3 py-1.5 rounded-lg whitespace-nowrap">Regenerar ahora</button>
          </div>
        )}

        {/* Selectores: Filtrar (qué incluir) + Ordenar (cómo mostrar) + Regenerar */}
        {tieneMenu && !loading && !generating && !recetaFiltro && (
          <div className="flex flex-col gap-2 mb-3">
            <div className="flex items-end gap-2">
              <div className="flex-1 min-w-0">
                <label className="text-[10px] text-muted font-medium block mb-0.5">Filtrar</label>
                <select value={filtro} onChange={e => setFiltro(e.target.value as Filtro)}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-white text-sm text-text focus:outline-none focus:border-accent">
                  {filtroOpciones.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="w-[42%] min-w-0">
                <label className="text-[10px] text-muted font-medium block mb-0.5">Ordenar</label>
                <select value={orden} onChange={e => setOrden(e.target.value as Orden)}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-white text-sm text-text focus:outline-none focus:border-accent">
                  <option value="pasillos">🛒 Pasillos</option>
                  <option value="alfabetico">🔤 Alfabético</option>
                </select>
              </div>
              <button onClick={handleRegenerarLista} title="Regenerar lista"
                className="flex-shrink-0 w-10 h-[38px] rounded-xl border border-border bg-white text-muted hover:text-accent hover:border-accent flex items-center justify-center transition-all">
                <RefreshCw size={16} />
              </button>
            </div>

            {/* Por semanas: multi-select de checkboxes */}
            {filtro === 'semanas' && (
              <div className="flex flex-col gap-1.5">
                {semanasGeneradas.map((ws, i) => {
                  const marcada = semanasActivas.includes(ws)
                  return (
                    <button key={ws} type="button" onClick={() => toggleSemana(ws)}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border text-left transition-all ${marcada ? 'border-accent bg-accent/5' : 'border-border bg-white'}`}>
                      <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${marcada ? 'bg-accent border-accent' : 'border-border'}`}>
                        {marcada && <span className="text-white text-[10px] font-bold">✓</span>}
                      </span>
                      <span className={`text-sm ${marcada ? 'text-accent font-medium' : 'text-text'}`}>Semana {i + 1} <span className="text-muted text-xs">(del {rangoSemana(ws)})</span></span>
                    </button>
                  )
                })}
                {generating && <p className="text-xs text-muted">Recalculando lista…</p>}
                {!generating && <p className="text-xs text-accent font-medium mt-1">{tituloSemanas}</p>}
              </div>
            )}

            {/* Próximas X: input numérico libre */}
            {filtro === 'proximas' && (
              <div className="flex items-center gap-3">
                <label className="text-xs text-muted font-medium flex-shrink-0">¿Cuántas comidas?</label>
                <input
                  type="number" min={1} max={35}
                  value={nComidasStr}
                  onChange={e => {
                    setNComidasStr(e.target.value)
                    const n = parseInt(e.target.value, 10)
                    if (!isNaN(n) && n >= 1 && n <= 35) setNComidas(n)
                  }}
                  onBlur={e => {
                    const n = parseInt(e.target.value, 10)
                    const clamped = isNaN(n) ? 7 : Math.min(35, Math.max(1, n))
                    setNComidas(clamped)
                  }}
                  className="w-16 px-2 py-1.5 rounded-xl border border-border bg-white text-sm text-center focus:outline-none focus:border-accent"
                />
                {activeMeals.length > 0 && (
                  <span className="text-xs text-muted">{activeMeals.length} comida{activeMeals.length !== 1 ? 's' : ''}</span>
                )}
              </div>
            )}

            {/* Receta: sub-selector */}
            {filtro === 'receta' && (
              recetasMenu.length > 0 ? (
                <select
                  value={recetaModo}
                  onChange={e => setRecetaModo(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-white text-sm text-text focus:outline-none focus:border-accent"
                >
                  {recetasMenu.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              ) : (
                <p className="text-xs text-muted px-1">No hay recetas en el menú activo.</p>
              )
            )}

            {filtro === 'proximas' && activeMeals.length === 0 && (
              <p className="text-xs text-muted px-1">No hay comidas planeadas próximamente.</p>
            )}
          </div>
        )}

        {/* Lista de items */}
        {!loading && !generating && listId && items.length > 0 && (
          <>
            {/* Banner filtro URL (?receta=X desde RecetaPage) */}
            {recetaFiltro && (
              <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-accent/10 border border-accent/30">
                <span className="text-sm">🍽️</span>
                <p className="text-xs text-accent font-medium flex-1 truncate">
                  Ingredientes de: <span className="font-semibold">{recetaFiltro}</span>
                </p>
                <button onClick={() => setSearchParams({})}
                  className="text-xs text-accent/70 hover:text-accent transition-colors flex-shrink-0">
                  Ver todo ×
                </button>
              </div>
            )}

            {/* Búsqueda */}
            <div className="relative mb-3">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="text" placeholder="Buscar ingrediente…"
                value={busqueda} onChange={e => setBusqueda(e.target.value)}
                className="w-full pl-8 pr-3 py-2 rounded-xl border border-border bg-white text-sm focus:outline-none focus:border-accent"
              />
            </div>

            {/* Widget nevera vs filtro */}
            {fridgeItems.length > 0 && (
              <div className="mb-4 rounded-2xl border border-border overflow-hidden">
                {/* Header */}
                <div className="px-4 py-2.5 bg-gray-50 border-b border-border flex items-center gap-2">
                  <span className="text-base">🧊</span>
                  <p className="text-xs font-semibold text-muted uppercase tracking-wider">Tu nevera</p>
                  <span className="ml-auto text-[10px] text-muted">
                    {fridgeUsados.length} en uso · {fridgeNoUsados.length} libre{fridgeNoUsados.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* ✅ Tienes */}
                {fridgeUsados.length > 0 && (
                  <div className="px-4 py-3 border-b border-border/60">
                    <p className="text-[11px] font-semibold text-oliva uppercase tracking-wider mb-2">
                      ✅ Tenés ({fridgeUsados.length})
                    </p>
                    <div className="flex flex-col gap-0.5">
                      {fridgeUsados.map(f => (
                        <p key={f.id} className="text-xs text-muted/70 line-through">{f.name}</p>
                      ))}
                    </div>
                    {fridgeNoUsados.length === 0 && (
                      <p className="text-xs text-oliva font-medium mt-2">¡Toda tu nevera se está usando! 🎉</p>
                    )}
                  </div>
                )}

                {/* ⏸️ No se usan */}
                {fridgeNoUsados.length > 0 && (
                  <div className="px-4 py-3">
                    <button
                      onClick={() => setNoUsanExpandido(v => !v)}
                      className="flex items-center gap-2 w-full text-left"
                    >
                      <p className="text-[11px] font-semibold text-muted uppercase tracking-wider">
                        ⏸️ No se usan ({fridgeNoUsados.length})
                      </p>
                      <span className="ml-auto text-muted text-xs">{noUsanExpandido ? '▲' : '▼'}</span>
                    </button>
                    {noUsanExpandido && (
                      <div className="flex flex-col gap-0.5 mt-2">
                        {fridgeNoUsados.map(f => (
                          <p key={f.id} className="text-xs text-muted">• {f.name}</p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Progreso */}
            {comprados > 0 && (
              <div className="mb-4 p-3 rounded-2xl bg-green-50 border border-green-200">
                <p className="text-sm text-green-700 font-medium">
                  ✓ {comprados} de {totalFaltantes} comprado{comprados !== 1 ? 's' : ''}
                </p>
                <div className="mt-1.5 h-1.5 bg-green-100 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full transition-all"
                    style={{ width: `${Math.round((comprados / totalFaltantes) * 100)}%` }} />
                </div>
              </div>
            )}

            {itemsFiltrados.length === 0 && (
              <p className="text-center text-sm text-muted py-8">
                {filtro === 'proximas' ? 'No hay ingredientes faltantes para las próximas comidas.' :
                 filtro === 'receta'   ? 'No hay ingredientes faltantes para esta receta.' :
                                      'No hay ingredientes faltantes.'}
              </p>
            )}

            {/* ── Pasillos (orden = pasillos) ── */}
            {orden === 'pasillos' && (() => {
              let acumulados = 0
              return pasillosConItems.map(pasillo => {
                const cfg = PASILLOS[pasillo] ?? { emoji: '🔤', label: 'Todos' }
                const pasilloItems = porPasillo.get(pasillo) ?? []
                const todoComprado = pasilloItems.every(i => i.comprado)
                const antes = acumulados
                acumulados += pasilloItems.length
                const mostrarAd = Math.floor(acumulados / 10) > Math.floor(antes / 10)
                return (
                  <div key={pasillo}>
                    <div className={`mb-4 card p-0 overflow-hidden ${todoComprado ? 'opacity-50' : ''}`}>
                      <div className="px-4 py-2.5 bg-gray-50 border-b border-border flex items-center gap-2">
                        <span className="text-base">{cfg.emoji}</span>
                        <p className="text-xs font-semibold text-muted uppercase tracking-wider">{cfg.label}</p>
                        <span className="ml-auto text-xs text-muted">{pasilloItems.filter(i => !i.comprado).length}</span>
                      </div>
                      <div className="flex flex-col">
                        {pasilloItems.map(item => {
                          const proc = desglose[normIngrediente(item.ingrediente_nombre)] ?? []
                          const abierto = expandedItem === item.id
                          return (
                          <div key={item.id} className={`border-b border-border/50 last:border-0 ${item.comprado ? 'bg-gray-50' : ''}`}>
                            <div className="flex items-start gap-3 px-4 py-3">
                              <button onClick={() => toggleComprado(item.id, !item.comprado)}
                                className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-all ${item.comprado ? 'bg-accent border-accent' : 'border-border'}`}>
                                {item.comprado && <span className="text-white text-[10px] font-bold">✓</span>}
                              </button>
                              <button onClick={() => setExpandedItem(abierto ? null : item.id)}
                                className="flex-1 min-w-0 text-left">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`text-sm font-medium ${item.comprado ? 'line-through text-muted' : 'text-text'}`}>
                                    {item.ingrediente_nombre}
                                  </span>
                                  {item.en_nevera && !item.faltante && (
                                    <span className="text-[10px] bg-green-50 text-green-700 border border-green-200 px-1.5 py-0.5 rounded-full">✓ en nevera</span>
                                  )}
                                  {item.en_nevera && item.faltante && (
                                    <span className="text-[10px] bg-yellow-50 text-yellow-700 border border-yellow-200 px-1.5 py-0.5 rounded-full">
                                      {item.cantidad_total > 0 ? `Falta ${Math.round(item.cantidad_total * 10) / 10} ${item.unidad}` : 'Tenés algo'}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  {item.cantidad_total > 0 && (
                                    <span className="text-xs text-muted font-medium">
                                      {formatCantidad(item.cantidad_total, item.unidad)}
                                    </span>
                                  )}
                                  {proc.length > 0 && (
                                    <span className="text-[10px] text-accent">{abierto ? '▴ ocultar' : `▾ de ${proc.length} receta${proc.length > 1 ? 's' : ''}`}</span>
                                  )}
                                </div>
                              </button>
                            </div>
                            {/* Procedencia: de qué recetas viene y cuánto pide cada una */}
                            {abierto && proc.length > 0 && (
                              <div className="px-4 pb-3 pl-12 flex flex-col gap-1.5">
                                {proc.map((p, idx) => (
                                  <div key={p.recipeId + idx} className="flex items-center gap-2 text-xs">
                                    <span className="text-muted flex-1 truncate">
                                      • {p.receta} → <b className="text-text">{formatCantidad(p.cantidad, p.unidad)}</b>
                                      {p.veces > 1 && (
                                        <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${p.veces >= 3 ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-yellow-50 text-yellow-700 border border-yellow-200'}`}>×{p.veces} veces</span>
                                      )}
                                    </span>
                                    <button onClick={() => navigate(`/receta/${p.recipeId}`)}
                                      className="text-accent font-medium whitespace-nowrap hover:underline">Ir a receta →</button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          )
                        })}
                      </div>
                    </div>
                    {mostrarAd && <AdNativeCard />}
                  </div>
                )
              })
            })()}

            {/* ── Alfabético — plano A-Z con contexto inline ── */}
            {orden === 'alfabetico' && (() => {
              const alphaItems = porPasillo.get('_alpha') ?? []
              if (alphaItems.length === 0) return null
              return (
                <div className="card p-0 overflow-hidden">
                  <div className="flex flex-col">
                    {alphaItems.map(item => {
                      const ctx = getItemContextAlfa(item)
                      return (
                        <button key={item.id}
                          onClick={() => toggleComprado(item.id, !item.comprado)}
                          className={`flex items-start gap-3 px-4 py-3 border-b border-border/50 last:border-0 text-left transition-colors ${item.comprado ? 'bg-gray-50' : 'hover:bg-accent/5'}`}>
                          <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-all ${item.comprado ? 'bg-accent border-accent' : 'border-border'}`}>
                            {item.comprado && <span className="text-white text-[10px] font-bold">✓</span>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className={`text-sm font-medium ${item.comprado ? 'line-through text-muted' : 'text-text'}`}>
                              {item.ingrediente_nombre}
                            </span>
                            <div className="flex items-baseline gap-2 mt-0.5 flex-wrap">
                              {item.cantidad_total > 0 && (
                                <span className="text-xs text-muted font-medium">
                                  {formatCantidad(item.cantidad_total, item.unidad)}
                                </span>
                              )}
                              {ctx && (
                                <span className="text-[10px] text-muted">— {ctx}</span>
                              )}
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })()}

            {/* Ya tenés en casa (solo pasillos) */}
            {!recetaFiltro && orden === 'pasillos' && items.filter(i => !i.faltante && i.en_nevera).length > 0 && (
              <div className="mt-2 card p-0 overflow-hidden opacity-60">
                <div className="px-4 py-2.5 bg-green-50 border-b border-border flex items-center gap-2">
                  <span className="text-base">✅</span>
                  <p className="text-xs font-semibold text-green-700 uppercase tracking-wider">Ya tenés en casa</p>
                </div>
                <div className="flex flex-col">
                  {items.filter(i => !i.faltante && i.en_nevera).map(item => (
                    <div key={item.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-border/50 last:border-0">
                      <span className="text-green-500 text-sm">✓</span>
                      <span className="text-sm text-muted line-through">{item.ingrediente_nombre}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-24 left-4 right-4 max-w-sm mx-auto bg-gray-900 text-white text-sm px-4 py-3 rounded-xl shadow-lg z-30 text-center">
          ✅ {toast}
        </div>
      )}
    </div>
  )
}
