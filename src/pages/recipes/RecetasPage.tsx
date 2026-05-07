import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFamilyStore } from '../../store/familyStore'
import { useRecipesStore, type Recipe } from '../../store/recipesStore'
import ImportarReceta from '../../components/recipes/ImportarReceta'
import RecetaDetalle from '../../components/recipes/RecetaDetalle'

type Vista = 'lista' | 'importar' | 'detalle'

const DIFICULTAD_COLOR = {
  facil:  'bg-green-50 text-green-700 border-green-200',
  media:  'bg-yellow-50 text-yellow-700 border-yellow-200',
  dificil: 'bg-red-50 text-red-700 border-red-200',
}

const TIPO_ICONS: Record<string, string> = {
  desayuno: '☀️', almuerzo: '🍽️', cena: '🌙',
  snack: '🍎', postre: '🍰', brunch: '🥞',
}

export default function RecetasPage() {
  const navigate              = useNavigate()
  const { family }            = useFamilyStore()
  const { recipes, loading, loadRecipes } = useRecipesStore()
  const [vista, setVista]     = useState<Vista>('lista')
  const [selected, setSelected] = useState<Recipe | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<string>('todos')

  useEffect(() => {
    if (family?.id) loadRecipes(family.id)
  }, [family?.id, loadRecipes])

  const filtradas = recipes.filter(r => {
    const matchBusqueda = !busqueda ||
      r.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      r.tags.some(t => t.toLowerCase().includes(busqueda.toLowerCase())) ||
      (r.origen ?? '').toLowerCase().includes(busqueda.toLowerCase())
    const matchTipo = filtroTipo === 'todos' || r.tipo_comida.includes(filtroTipo)
    return matchBusqueda && matchTipo
  })

  if (vista === 'importar') {
    return (
      <div className="min-h-screen px-4 py-6 max-w-lg mx-auto">
        <button onClick={() => setVista('lista')}
          className="text-muted text-sm mb-5 flex items-center gap-1 hover:text-text transition-colors">
          ← Volver al recetario
        </button>
        <h2 className="text-xl font-serif font-semibold text-text mb-4">Agregar receta</h2>
        <ImportarReceta
          familyId={family?.id ?? ''}
          onSaved={() => { loadRecipes(family?.id ?? ''); setVista('lista') }}
          onCancel={() => setVista('lista')}
        />
      </div>
    )
  }

  if (vista === 'detalle' && selected) {
    return (
      <RecetaDetalle
        receta={selected}
        onBack={() => { setSelected(null); setVista('lista') }}
      />
    )
  }

  return (
    <div className="min-h-screen pb-8 max-w-lg mx-auto">

      {/* Header */}
      <div className="sticky top-0 bg-bg/95 backdrop-blur px-4 pt-6 pb-3 z-10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/')} className="text-muted hover:text-text transition-colors">←</button>
            <h1 className="text-xl font-serif font-semibold text-text">Recetario</h1>
            <span className="text-muted text-sm">({filtradas.length})</span>
          </div>
          <button onClick={() => setVista('importar')}
            className="px-3 py-1.5 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-all">
            + Agregar
          </button>
        </div>

        {/* Búsqueda */}
        <input
          type="search" placeholder="Buscar receta, ingrediente, origen..."
          value={busqueda} onChange={e => setBusqueda(e.target.value)}
          className="mb-2"
        />

        {/* Filtro por tipo */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {['todos','desayuno','almuerzo','cena','snack','postre'].map(t => (
            <button key={t} onClick={() => setFiltroTipo(t)}
              className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-all
                ${filtroTipo === t
                  ? 'bg-accent text-white'
                  : 'bg-white border border-border text-muted hover:border-accent'}`}>
              {t === 'todos' ? 'Todas' : `${TIPO_ICONS[t] ?? ''} ${t.charAt(0).toUpperCase() + t.slice(1)}`}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 flex flex-col gap-3 mt-2">
        {loading && (
          <div className="text-center py-16 text-muted text-sm">Cargando recetas...</div>
        )}

        {!loading && filtradas.length === 0 && (
          <div className="text-center py-16 flex flex-col items-center gap-4">
            <span className="text-5xl">📖</span>
            <div>
              <p className="text-text font-medium">
                {busqueda ? 'No encontré recetas' : 'Recetario vacío'}
              </p>
              <p className="text-muted text-sm mt-1">
                {busqueda ? 'Intenta con otro término' : 'Agrega tu primera receta'}
              </p>
            </div>
            {!busqueda && (
              <button onClick={() => setVista('importar')} className="btn-primary max-w-xs">
                + Agregar receta
              </button>
            )}
          </div>
        )}

        {filtradas.map(r => (
          <button key={r.id} onClick={() => { setSelected(r); setVista('detalle') }}
            className="card text-left flex flex-col gap-2 hover:border-accent transition-all active:scale-95">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-text">{r.nombre}</p>
                {r.descripcion_corta && (
                  <p className="text-muted text-xs mt-0.5 line-clamp-1">{r.descripcion_corta}</p>
                )}
              </div>
              {r.is_base_recipe && (
                <span className="text-xs text-accent bg-accent-light px-2 py-0.5 rounded-full whitespace-nowrap">base</span>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {r.tipo_comida.slice(0,2).map(t => (
                <span key={t} className="text-xs text-muted">
                  {TIPO_ICONS[t] ?? ''} {t}
                </span>
              ))}
              {r.tiempo_total_min && (
                <span className="text-xs text-muted">⏱ {r.tiempo_total_min}min</span>
              )}
              {r.dificultad && (
                <span className={`text-xs px-2 py-0.5 rounded-full border ${DIFICULTAD_COLOR[r.dificultad]}`}>
                  {r.dificultad}
                </span>
              )}
              {r.origen && (
                <span className="text-xs text-muted">🌎 {r.origen}</span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
