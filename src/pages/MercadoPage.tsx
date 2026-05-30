import { useEffect, useState } from 'react'
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

  const [busqueda, setBusqueda] = useState('')
  const [orden, setOrden]       = useState<'pasillo' | 'alfabetico'>('pasillo')

  // Filtro por receta (viene del botón "Lista" en RecetaPage: ?receta=NombreReceta)
  const recetaFiltro = searchParams.get('receta') ? decodeURIComponent(searchParams.get('receta')!) : null
  const filtroActivo = recetaFiltro !== null

  const weekStart = getMondayOfWeek()
  const tieneMenu = menu.some(e => e.is_main_recipe)

  useEffect(() => {
    if (family?.id) loadList(family.id)
  }, [family?.id])

  const handleGenerar = async () => {
    if (!family?.id) return
    await generateList(family.id, fridgeItems)
  }

  // Filtrar por búsqueda y/o receta activa
  const itemsFiltrados = items.filter(i =>
    i.faltante &&
    (busqueda === '' || i.ingrediente_nombre.toLowerCase().includes(busqueda.toLowerCase())) &&
    (!recetaFiltro || i.recetas_origen.includes(recetaFiltro))
  )

  // Agrupar por pasillo o alfabético — siempre ordenar dentro de cada grupo
  const porPasillo = new Map<string, ShoppingListItem[]>()
  if (orden === 'pasillo') {
    for (const item of itemsFiltrados) {
      const p = item.categoria_pasillo
      if (!porPasillo.has(p)) porPasillo.set(p, [])
      porPasillo.get(p)!.push(item)
    }
  } else {
    // Orden alfabético — un solo grupo
    const sorted = [...itemsFiltrados].sort((a, b) =>
      a.ingrediente_nombre.localeCompare(b.ingrediente_nombre, 'es')
    )
    if (sorted.length > 0) porPasillo.set('_alpha', sorted)
  }

  // Ordenar alfabéticamente dentro de cada pasillo
  for (const [p, arr] of porPasillo.entries()) {
    porPasillo.set(p, arr.sort((a, b) =>
      a.ingrediente_nombre.localeCompare(b.ingrediente_nombre, 'es')
    ))
  }

  const pasillosConItems = orden === 'pasillo'
    ? PASILLO_ORDER.filter(p => porPasillo.has(p))
    : porPasillo.has('_alpha') ? ['_alpha'] : []

  const totalFaltantes = items.filter(i => i.faltante).length
  const comprados      = items.filter(i => i.comprado).length

  const handleShare = async () => {
    const texto = items
      .filter(i => i.faltante && !i.comprado)
      .map(i => `• ${i.ingrediente_nombre} ${formatCantidad(i.cantidad_total, i.unidad)}`)
      .join('\n')
    if (navigator.share) {
      await navigator.share({ title: 'Lista de mercado mesa.os', text: texto })
    } else {
      await navigator.clipboard.writeText(texto)
    }
  }

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
                <button onClick={() => window.open('/mercado/imprimir', '_blank')}
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
            {/* Banner filtro por receta */}
            {filtroActivo && (
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

            {/* Búsqueda y orden */}
            <div className="flex gap-2 mb-3">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="text" placeholder="Buscar ingrediente…"
                  value={busqueda} onChange={e => setBusqueda(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 rounded-xl border border-border bg-white text-sm focus:outline-none focus:border-accent"
                />
              </div>
              <div className="flex rounded-xl border border-border overflow-hidden text-xs font-medium">
                <button onClick={() => setOrden('pasillo')}
                  className={`px-3 py-2 transition-colors ${orden === 'pasillo' ? 'bg-accent text-white' : 'text-muted hover:bg-gray-50'}`}>
                  Pasillos
                </button>
                <button onClick={() => setOrden('alfabetico')}
                  className={`px-3 py-2 transition-colors ${orden === 'alfabetico' ? 'bg-accent text-white' : 'text-muted hover:bg-gray-50'}`}>
                  A–Z
                </button>
              </div>
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

                        {/* Checkbox */}
                        <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-all ${
                          item.comprado ? 'bg-accent border-accent' : 'border-border'}`}>
                          {item.comprado && <span className="text-white text-[10px] font-bold">✓</span>}
                        </div>

                        {/* Info */}
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
            {items.filter(i => !i.faltante && i.en_nevera).length > 0 && (
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
