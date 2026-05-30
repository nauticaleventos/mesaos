import { useEffect, useState, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { RefreshCw, Printer, Share2, Search } from 'lucide-react'
import { useFamilyStore } from '../store/familyStore'
import { useFridgeStore } from '../store/fridgeStore'
import { useMenuStore }   from '../store/menuStore'
import { useShoppingListStore, type ShoppingListItem } from '../store/shoppingListStore'
import { getMondayOfWeek } from '../lib/motorMenu'
import BottomNav from '../components/ui/BottomNav'
import { AdNativeCard } from '../components/ads/AdPlaceholders'

// ── Config de pasillos ────────────────────────────────────────────────────────
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
  bebidas:            { emoji: '🥤', label: 'Bebidas' },
  aseo_hogar:         { emoji: '🧼', label: 'Aseo' },
  otros:              { emoji: '📦', label: 'Otros' },
}
const PASILLO_ORDER = Object.keys(PASILLOS)

type Modo = 'pasillos' | 'alfabetico' | 'proximas' | 'receta'

// Hora de corte por tipo de comida (en minutos desde medianoche)
const CORTE_MIN: Record<string, number> = {
  desayuno: 8 * 60, brunch: 8 * 60,
  'merienda mañana': 10 * 60 + 30, onces: 10 * 60 + 30,
  almuerzo: 14 * 60, comida: 14 * 60,
  merienda: 16 * 60 + 30, 'merienda tarde': 16 * 60 + 30,
  snack: 16 * 60 + 30, 'snack noche': 20 * 60,
  cena: 20 * 60,
}
function corteMeal(mealType: string): number {
  const k = mealType.toLowerCase()
  if (CORTE_MIN[k] !== undefined) return CORTE_MIN[k]
  for (const [kw, v] of Object.entries(CORTE_MIN)) { if (k.includes(kw)) return v }
  return 14 * 60
}
function sortMeal(mealType: string): number {
  return corteMeal(mealType)
}

function formatCantidad(cantidad: number, unidad: string): string {
  if (cantidad === 0) return ''
  const n = Number.isInteger(cantidad) ? cantidad : Math.round(cantidad * 10) / 10
  return `${n} ${unidad}`
}

export default function MercadoPage() {
  const navigate                  = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { family }                = useFamilyStore()
  const { items: fridgeItems }    = useFridgeStore()
  const { menu }                  = useMenuStore()
  const { listId, items, loading, generating, loadList, generateList, toggleComprado } = useShoppingListStore()

  // ── Modo de vista (persistido) ─────────────────────────────────────────────
  const [modo, setModoState] = useState<Modo>(
    () => (localStorage.getItem('mesa_mercado_modo') as Modo) ?? 'pasillos'
  )
  const [nComidas, setNComidasState] = useState<number>(
    () => parseInt(localStorage.getItem('mesa_mercado_n_comidas') ?? '5', 10)
  )
  const [recetaModo, setRecetaModo] = useState<string>('')
  const [busqueda, setBusqueda]     = useState('')

  const setModo = (m: Modo) => { setModoState(m); localStorage.setItem('mesa_mercado_modo', m) }
  const setNComidas = (n: number) => { setNComidasState(n); localStorage.setItem('mesa_mercado_n_comidas', String(n)) }

  // ?receta=X desde RecetaPage (tiene prioridad sobre el modo)
  const recetaFiltro = searchParams.get('receta') ? decodeURIComponent(searchParams.get('receta')!) : null

  const weekStart = getMondayOfWeek()
  const tieneMenu = menu.some(e => e.is_main_recipe)

  useEffect(() => {
    if (family?.id) loadList(family.id)
  }, [family?.id])

  // ── Recetas del menú para sub-selector ────────────────────────────────────
  const recetasMenu: string[] = useMemo(() => {
    const nombres = menu
      .filter(e => e.is_main_recipe && e.recipe_id !== null && e.recipe?.nombre)
      .map(e => e.recipe!.nombre)
    return [...new Set(nombres)].sort((a, b) => a.localeCompare(b, 'es'))
  }, [menu])

  // Seleccionar primera receta por defecto cuando cambia el modo
  useEffect(() => {
    if (modo === 'receta' && !recetaModo && recetasMenu.length > 0) {
      setRecetaModo(recetasMenu[0])
    }
  }, [modo, recetasMenu])

  // ── Próximas N comidas ────────────────────────────────────────────────────
  const proximasRecetas: string[] = useMemo(() => {
    if (modo !== 'proximas') return []
    const now    = new Date()
    const isoDow = now.getDay() === 0 ? 7 : now.getDay()
    const nowMin = now.getHours() * 60 + now.getMinutes()

    const futuras = menu
      .filter(e => e.is_main_recipe && e.recipe_id !== null && e.status === 'planned' && e.recipe?.nombre)
      .filter(e => {
        if (e.day_of_week > isoDow) return true
        if (e.day_of_week === isoDow) return nowMin < corteMeal(e.meal_type)
        return false
      })
      .sort((a, b) => {
        if (a.day_of_week !== b.day_of_week) return a.day_of_week - b.day_of_week
        return sortMeal(a.meal_type) - sortMeal(b.meal_type)
      })
      .slice(0, nComidas)

    return [...new Set(futuras.map(e => e.recipe!.nombre))]
  }, [menu, modo, nComidas])

  // ── Filtro de items ───────────────────────────────────────────────────────
  const itemsFiltrados = useMemo(() => {
    return items.filter(i => {
      if (!i.faltante) return false
      if (busqueda && !i.ingrediente_nombre.toLowerCase().includes(busqueda.toLowerCase())) return false
      // URL param tiene prioridad
      if (recetaFiltro) return i.recetas_origen.includes(recetaFiltro)
      if (modo === 'proximas') return proximasRecetas.some(r => i.recetas_origen.includes(r))
      if (modo === 'receta')   return recetaModo ? i.recetas_origen.includes(recetaModo) : true
      return true
    })
  }, [items, busqueda, recetaFiltro, modo, proximasRecetas, recetaModo])

  // ── Agrupación por pasillo ────────────────────────────────────────────────
  const usarPasillos = modo === 'pasillos' || modo === 'proximas' || modo === 'receta'

  const porPasillo = useMemo(() => {
    const map = new Map<string, ShoppingListItem[]>()
    if (usarPasillos) {
      for (const item of itemsFiltrados) {
        const p = item.categoria_pasillo
        if (!map.has(p)) map.set(p, [])
        map.get(p)!.push(item)
      }
    } else {
      const sorted = [...itemsFiltrados].sort((a, b) =>
        a.ingrediente_nombre.localeCompare(b.ingrediente_nombre, 'es')
      )
      if (sorted.length > 0) map.set('_alpha', sorted)
    }
    for (const [p, arr] of map.entries()) {
      map.set(p, arr.sort((a, b) => a.ingrediente_nombre.localeCompare(b.ingrediente_nombre, 'es')))
    }
    return map
  }, [itemsFiltrados, usarPasillos])

  const pasillosConItems = usarPasillos
    ? PASILLO_ORDER.filter(p => porPasillo.has(p))
    : porPasillo.has('_alpha') ? ['_alpha'] : []

  const totalFaltantes = items.filter(i => i.faltante).length
  const comprados      = items.filter(i => i.comprado).length

  // ── Share / Print helpers ─────────────────────────────────────────────────
  const getTitulo = (): string => {
    if (recetaFiltro)                   return `Ingredientes para ${recetaFiltro}`
    if (modo === 'receta' && recetaModo) return `Ingredientes para ${recetaModo}`
    if (modo === 'proximas')             return `Lista próximas ${nComidas} comidas`
    if (modo === 'alfabetico')           return 'Lista de mercado (A-Z)'
    return 'Lista de mercado mesa.os'
  }

  const getEncabezado = (): string => {
    if (recetaFiltro)                   return `🍽️ Ingredientes para ${recetaFiltro}:\n`
    if (modo === 'receta' && recetaModo) return `🍽️ Ingredientes para ${recetaModo}:\n`
    if (modo === 'proximas')             return `⏰ Lista para las próximas ${nComidas} comidas:\n`
    if (modo === 'alfabetico')           return '🛒 Lista de mercado (A-Z):\n'
    return '🛒 Lista de mercado:\n'
  }

  const getPrintUrl = (): string => {
    if (recetaFiltro)
      return `/mercado/imprimir?receta=${encodeURIComponent(recetaFiltro)}`
    if (modo === 'receta' && recetaModo)
      return `/mercado/imprimir?receta=${encodeURIComponent(recetaModo)}`
    if (modo === 'proximas' && proximasRecetas.length > 0)
      return `/mercado/imprimir?recetas=${encodeURIComponent(proximasRecetas.join(','))}&n=${nComidas}`
    if (modo === 'alfabetico')
      return '/mercado/imprimir?modo=alfabetico'
    return '/mercado/imprimir'
  }

  const handleShare = async () => {
    const shareItems = items.filter(i => {
      if (!i.faltante || i.comprado) return false
      if (recetaFiltro) return i.recetas_origen.includes(recetaFiltro)
      if (modo === 'proximas') return proximasRecetas.some(r => i.recetas_origen.includes(r))
      if (modo === 'receta')   return recetaModo ? i.recetas_origen.includes(recetaModo) : true
      return true
    })
    const texto = getEncabezado() + shareItems
      .map(i => `• ${i.ingrediente_nombre} ${formatCantidad(i.cantidad_total, i.unidad)}`)
      .join('\n')
    if (navigator.share) {
      await navigator.share({ title: getTitulo(), text: texto })
    } else {
      await navigator.clipboard.writeText(texto)
    }
  }

  const handleGenerar = async () => {
    if (!family?.id) return
    await generateList(family.id, fridgeItems)
  }

  // ── Modo label para el selector ───────────────────────────────────────────
  const modoOpciones: { value: Modo; label: string }[] = [
    { value: 'pasillos',   label: '🛒 Pasillos del super' },
    { value: 'alfabetico', label: '🔤 Orden alfabético'   },
    { value: 'proximas',   label: '⏰ Próximas comidas'   },
    { value: 'receta',     label: '🍽️ Una receta del menú' },
  ]

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
              {[0,150,300].map(d => <span key={d} className="w-2 h-2 rounded-full bg-accent animate-bounce" style={{ animationDelay: `${d}ms` }} />)}
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

        {/* Lista */}
        {!loading && !generating && listId && items.length > 0 && (
          <>
            {/* Banner filtro por receta (URL param desde RecetaPage) */}
            {recetaFiltro && (
              <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-accent/10 border border-accent/30">
                <span className="text-sm">🍽️</span>
                <p className="text-xs text-accent font-medium flex-1 truncate">
                  Ingredientes de: <span className="font-semibold">{recetaFiltro}</span>
                </p>
                <button onClick={() => setSearchParams({})} className="text-xs text-accent/70 hover:text-accent transition-colors flex-shrink-0">
                  Ver todo ×
                </button>
              </div>
            )}

            {/* Selector de modo (oculto cuando hay filtro URL activo) */}
            {!recetaFiltro && (
              <div className="flex flex-col gap-2 mb-3">
                <select
                  value={modo}
                  onChange={e => setModo(e.target.value as Modo)}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-white text-sm text-text focus:outline-none focus:border-accent"
                >
                  {modoOpciones.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>

                {/* Sub-selector: próximas N comidas */}
                {modo === 'proximas' && (
                  <select
                    value={nComidas}
                    onChange={e => setNComidas(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-white text-sm text-text focus:outline-none focus:border-accent"
                  >
                    <option value={3}>3 comidas</option>
                    <option value={5}>5 comidas</option>
                    <option value={7}>7 comidas</option>
                    <option value={14}>14 comidas</option>
                  </select>
                )}

                {/* Sub-selector: una receta del menú */}
                {modo === 'receta' && (
                  recetasMenu.length > 0 ? (
                    <select
                      value={recetaModo}
                      onChange={e => setRecetaModo(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-border bg-white text-sm text-text focus:outline-none focus:border-accent"
                    >
                      {recetasMenu.map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-xs text-muted px-1">No hay recetas en el menú activo.</p>
                  )
                )}

                {/* Info modo próximas */}
                {modo === 'proximas' && proximasRecetas.length === 0 && (
                  <p className="text-xs text-muted px-1">No hay comidas planeadas próximamente.</p>
                )}
                {modo === 'proximas' && proximasRecetas.length > 0 && (
                  <p className="text-[11px] text-muted px-1 truncate">
                    Recetas: {proximasRecetas.join(', ')}
                  </p>
                )}
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

            {/* Sin items para el filtro activo */}
            {itemsFiltrados.length === 0 && (
              <p className="text-center text-sm text-muted py-8">
                {modo === 'proximas' ? 'No hay ingredientes faltantes para las próximas comidas.' :
                 modo === 'receta'   ? 'No hay ingredientes faltantes para esta receta.' :
                                      'No hay ingredientes faltantes.'}
              </p>
            )}

            {/* Secciones por pasillo — ad nativo cada 10 ítems */}
            {(() => {
              let acumulados = 0
              return pasillosConItems.map(pasillo => {
                const cfg = PASILLOS[pasillo] ?? { emoji: '🔤', label: 'Todos' }
                const pasilloItems = porPasillo.get(pasillo) ?? []
                const todoComprado = pasilloItems.every(i => i.comprado)
                const esAlpha = pasillo === '_alpha'
                const antes = acumulados
                acumulados += pasilloItems.length
                const mostrarAd = Math.floor(acumulados / 10) > Math.floor(antes / 10)

                return (
                  <div key={pasillo}>
                    <div className={`mb-4 card p-0 overflow-hidden ${todoComprado ? 'opacity-50' : ''}`}>
                      {!esAlpha && (
                        <div className="px-4 py-2.5 bg-gray-50 border-b border-border flex items-center gap-2">
                          <span className="text-base">{cfg.emoji}</span>
                          <p className="text-xs font-semibold text-muted uppercase tracking-wider">{cfg.label}</p>
                          <span className="ml-auto text-xs text-muted">{pasilloItems.filter(i => !i.comprado).length}</span>
                        </div>
                      )}
                      <div className="flex flex-col">
                        {pasilloItems.map(item => (
                          <button key={item.id}
                            onClick={() => toggleComprado(item.id, !item.comprado)}
                            className={`flex items-start gap-3 px-4 py-3 border-b border-border/50 last:border-0 text-left transition-colors ${item.comprado ? 'bg-gray-50' : 'hover:bg-accent/5'}`}>
                            <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-all ${
                              item.comprado ? 'bg-accent border-accent' : 'border-border'}`}>
                              {item.comprado && <span className="text-white text-[10px] font-bold">✓</span>}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-sm font-medium ${item.comprado ? 'line-through text-muted' : 'text-text'}`}>
                                  {item.ingrediente_nombre}
                                </span>
                                {item.en_nevera && !item.faltante && (
                                  <span className="text-[10px] bg-green-50 text-green-700 border border-green-200 px-1.5 py-0.5 rounded-full">✓ en nevera</span>
                                )}
                                {item.en_nevera && item.faltante && (
                                  <span className="text-[10px] bg-yellow-50 text-yellow-700 border border-yellow-200 px-1.5 py-0.5 rounded-full">
                                    {item.cantidad_total > 0
                                      ? `Falta ${Math.round(item.cantidad_total * 10) / 10} ${item.unidad}`
                                      : 'Tenés algo'}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                {item.cantidad_total > 0 && (
                                  <span className="text-xs text-muted font-medium">
                                    {formatCantidad(item.cantidad_total, item.unidad)}
                                  </span>
                                )}
                                {item.recetas_origen.length > 0 && (
                                  <span className="text-[10px] text-muted truncate max-w-[200px]">
                                    para: {item.recetas_origen.slice(0, 2).join(', ')}{item.recetas_origen.length > 2 ? '…' : ''}
                                  </span>
                                )}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                    {mostrarAd && <AdNativeCard />}
                  </div>
                )
              })
            })()}

            {/* Items ya en nevera sin faltar */}
            {!recetaFiltro && modo === 'pasillos' && items.filter(i => !i.faltante && i.en_nevera).length > 0 && (
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
    </div>
  )
}
