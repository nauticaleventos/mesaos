import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useFamilyStore } from '../../store/familyStore'
import { useRecipesStore, type Recipe } from '../../store/recipesStore'
import ImportarReceta from '../../components/recipes/ImportarReceta'
import RecetaDetalle from '../../components/recipes/RecetaDetalle'
import SwipeRecetas from '../../components/recipes/SwipeRecetas'

type Tab   = 'mis' | 'guardadas' | 'descubrir'
type Vista = 'tabs' | 'detalle' | 'importar'

const TIPO_ICONS: Record<string, string> = {
  desayuno: '☀️', almuerzo: '🍽️', cena: '🌙',
  snack: '🍎', postre: '🍰', brunch: '🥞',
}

const DIFICULTAD_COLOR: Record<string, string> = {
  facil:   'bg-green-50 text-green-700 border-green-200',
  media:   'bg-yellow-50 text-yellow-700 border-yellow-200',
  dificil: 'bg-red-50 text-red-700 border-red-200',
}

interface ReactionData { reaction: string; rating?: number }

export default function RecetasPage() {
  const navigate = useNavigate()
  const { family, members }                    = useFamilyStore()
  const { recipes, loading, loadRecipes }      = useRecipesStore()

  const [vista, setVista]         = useState<Vista>('tabs')
  const [tab, setTab]             = useState<Tab>('descubrir')
  const [memberIdx, setMemberIdx] = useState(0)
  const [selected, setSelected]   = useState<Recipe | null>(null)
  const [busqueda, setBusqueda]   = useState('')
  const [reactions, setReactions] = useState<Record<string, ReactionData>>({})

  const member = members[memberIdx]

  useEffect(() => {
    if (family?.id) loadRecipes(family.id)
  }, [family?.id, loadRecipes])

  useEffect(() => {
    if (member?.id) loadReactions(member.id)
  }, [member?.id])

  const loadReactions = async (memberId: string) => {
    const { data } = await supabase
      .from('recipe_reactions')
      .select('recipe_id, reaction, rating')
      .eq('member_id', memberId)
    const map: Record<string, ReactionData> = {}
    for (const r of (data ?? []) as { recipe_id: string; reaction: string; rating?: number }[]) {
      map[r.recipe_id] = { reaction: r.reaction, rating: r.rating }
    }
    setReactions(map)
  }

  const likedRecipes = recipes.filter(r => reactions[r.id]?.reaction === 'like')
  const savedRecipes = recipes.filter(r => reactions[r.id]?.reaction === 'bookmark')

  const applySearch = (list: Recipe[]) =>
    !busqueda ? list : list.filter(r =>
      r.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      r.tags.some(t => t.toLowerCase().includes(busqueda.toLowerCase()))
    )

  const openRecipe = (r: Recipe) => { setSelected(r); setVista('detalle') }

  // ── Vistas secundarias ──────────────────────────────────────────────────

  if (vista === 'importar') {
    return (
      <div className="min-h-screen px-4 py-6 max-w-lg mx-auto">
        <button onClick={() => setVista('tabs')}
          className="text-muted text-sm mb-5 flex items-center gap-1 hover:text-text transition-colors">
          ← Volver
        </button>
        <h2 className="text-xl font-serif font-semibold text-text mb-4">Agregar receta</h2>
        <ImportarReceta
          familyId={family?.id ?? ''}
          onSaved={() => { loadRecipes(family?.id ?? ''); setVista('tabs') }}
          onCancel={() => setVista('tabs')}
        />
      </div>
    )
  }

  if (vista === 'detalle' && selected) {
    return (
      <RecetaDetalle
        receta={selected}
        memberId={member?.id}
        memberRating={reactions[selected.id]?.rating}
        onBack={() => { setSelected(null); setVista('tabs') }}
        onRated={() => member?.id && loadReactions(member.id)}
      />
    )
  }

  // ── Layout principal ────────────────────────────────────────────────────
  const listData = tab === 'mis' ? likedRecipes : savedRecipes

  return (
    <div className="min-h-screen pb-8 max-w-lg mx-auto">

      {/* Header sticky */}
      <div className="sticky top-0 bg-bg/95 backdrop-blur z-10 px-4 pt-5 pb-3 flex flex-col gap-3">

        {/* Título + botón agregar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/')} className="text-muted hover:text-text transition-colors">←</button>
            <h1 className="text-xl font-serif font-semibold text-text">Recetario</h1>
          </div>
          <button
            onClick={() => setVista('importar')}
            className="px-3 py-1.5 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-all">
            + Agregar
          </button>
        </div>

        {/* Selector de miembro */}
        {members.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-0.5">
            {members.map((m, i) => (
              <button key={m.id} onClick={() => setMemberIdx(i)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-all
                  ${memberIdx === i
                    ? 'bg-accent text-white'
                    : 'bg-white border border-border text-muted hover:border-accent'}`}>
                <span>{m.emoji}</span>
                <span>{m.name}</span>
              </button>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          <TabBtn active={tab === 'mis'} onClick={() => setTab('mis')}>
            ❤️ Mis recetas
            {likedRecipes.length > 0 && (
              <span className="ml-1 bg-accent/20 text-accent text-[10px] px-1.5 py-0.5 rounded-full font-semibold">
                {likedRecipes.length}
              </span>
            )}
          </TabBtn>
          <TabBtn active={tab === 'guardadas'} onClick={() => setTab('guardadas')}>
            🔖 Guardadas
            {savedRecipes.length > 0 && (
              <span className="ml-1 bg-accent/20 text-accent text-[10px] px-1.5 py-0.5 rounded-full font-semibold">
                {savedRecipes.length}
              </span>
            )}
          </TabBtn>
          <TabBtn active={tab === 'descubrir'} onClick={() => setTab('descubrir')}>
            ✨ Descubrir
          </TabBtn>
        </div>

        {/* Buscador — solo en mis/guardadas */}
        {tab !== 'descubrir' && (
          <input
            type="search"
            placeholder="Buscar receta..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
        )}
      </div>

      {/* ── Contenido por tab ── */}

      {tab === 'descubrir' && (
        <SwipeRecetas
          embedded
          memberId={member?.id ?? ''}
          onReacted={() => member?.id && loadReactions(member.id)}
          onClose={() => setTab('mis')}
        />
      )}

      {tab !== 'descubrir' && (
        <div className="px-4 mt-2 flex flex-col gap-3">
          {loading && <p className="text-center py-12 text-muted text-sm">Cargando recetas...</p>}

          {!loading && applySearch(listData).length === 0 && (
            <EmptyState tab={tab} busqueda={busqueda} onDescubrir={() => setTab('descubrir')} />
          )}

          {applySearch(listData).map(r => (
            <RecipeRow
              key={r.id}
              recipe={r}
              rating={reactions[r.id]?.rating}
              onClick={() => openRecipe(r)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Sub-componentes ──────────────────────────────────────────────────────────

function TabBtn({ active, onClick, children }: {
  active:   boolean
  onClick:  () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center py-1.5 rounded-lg text-xs font-medium transition-all
        ${active ? 'bg-white text-text shadow-sm' : 'text-muted hover:text-text'}`}>
      {children}
    </button>
  )
}

function RecipeRow({ recipe: r, rating, onClick }: { recipe: Recipe; rating?: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="card text-left flex flex-col gap-2 hover:border-accent transition-all active:scale-95">
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-text">{r.nombre}</p>
        {r.is_base_recipe && (
          <span className="text-xs text-accent bg-accent-light px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">base</span>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {r.tipo_comida.slice(0, 2).map(t => (
          <span key={t} className="text-xs text-muted">{TIPO_ICONS[t] ?? ''} {t}</span>
        ))}
        {r.tiempo_total_min && <span className="text-xs text-muted">⏱ {r.tiempo_total_min}min</span>}
        {r.dificultad && (
          <span className={`text-xs px-2 py-0.5 rounded-full border ${DIFICULTAD_COLOR[r.dificultad]}`}>
            {r.dificultad}
          </span>
        )}
        {r.origen && <span className="text-xs text-muted">🌎 {r.origen}</span>}
      </div>

      {rating && (
        <div className="flex gap-0.5 text-sm">
          {[1,2,3,4,5].map(s => (
            <span key={s} className={s <= rating ? 'text-yellow-400' : 'text-gray-200'}>★</span>
          ))}
        </div>
      )}
    </button>
  )
}

function EmptyState({ tab, busqueda, onDescubrir }: { tab: Tab; busqueda: string; onDescubrir: () => void }) {
  if (busqueda) {
    return (
      <div className="text-center py-16">
        <p className="text-muted text-sm">No encontré "{busqueda}"</p>
      </div>
    )
  }
  return (
    <div className="text-center py-16 flex flex-col items-center gap-4">
      <span className="text-5xl">{tab === 'mis' ? '❤️' : '🔖'}</span>
      <div>
        <p className="text-text font-medium">
          {tab === 'mis' ? 'Aún no tienes recetas favoritas' : 'No tienes recetas guardadas'}
        </p>
        <p className="text-muted text-sm mt-1">
          {tab === 'mis'
            ? 'En Descubrir puedes indicar cuáles te gustan'
            : 'Guarda las recetas que quieres probar'}
        </p>
      </div>
      <button onClick={onDescubrir} className="btn-primary max-w-xs">
        ✨ Ir a Descubrir
      </button>
    </div>
  )
}
