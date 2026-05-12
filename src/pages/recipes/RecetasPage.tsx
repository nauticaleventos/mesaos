import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useFamilyStore } from '../../store/familyStore'
import { useRecipesStore, type Recipe } from '../../store/recipesStore'
import type { FamilyMember } from '../../lib/types'
import SwipeRecetas from '../../components/recipes/SwipeRecetas'
import ShareMemberModal from '../../components/recipes/ShareMemberModal'
import BottomNav from '../../components/ui/BottomNav'
import ImportModal from '../../components/recipes/import/ImportModal'

type Tab      = 'mis' | 'guardadas' | 'descubrir'
type Vista    = 'tabs' | 'importar'
type Categoria =
  | 'todos'      | 'estelares'
  | 'proteina'   | 'guarnicion' | 'ensalada'  | 'sopa'
  | 'plato_unico'| 'postre'     | 'bebida'     | 'merienda'
  | 'desayuno'   | 'almuerzo'   | 'cena'       | 'snack'

const CATEGORIAS: { id: Categoria; emoji: string; label: string }[] = [
  { id: 'todos',       emoji: '🍳', label: 'Todas'         },
  { id: 'estelares',   emoji: '⭐', label: 'Para lucirme'  },
  { id: 'proteina',    emoji: '🍖', label: 'Proteínas'     },
  { id: 'guarnicion',  emoji: '🍚', label: 'Guarniciones'  },
  { id: 'ensalada',    emoji: '🥗', label: 'Ensaladas'     },
  { id: 'sopa',        emoji: '🥄', label: 'Sopas'         },
  { id: 'plato_unico', emoji: '🥘', label: 'Platos únicos' },
  { id: 'postre',      emoji: '🍰', label: 'Postres'       },
  { id: 'bebida',      emoji: '🥤', label: 'Bebidas'       },
  { id: 'merienda',    emoji: '🍿', label: 'Meriendas'     },
  { id: 'desayuno',    emoji: '🍳', label: 'Desayunos'     },
  { id: 'almuerzo',    emoji: '🍽️', label: 'Almuerzos'     },
  { id: 'cena',        emoji: '🌙', label: 'Cenas'          },
  { id: 'snack',       emoji: '🍎', label: 'Snacks'         },
]

const TIPO_ICONS: Record<string, string> = {
  desayuno: '☀️', almuerzo: '🍽️', cena: '🌙',
  snack: '🍎', postre: '🍰', brunch: '🥞',
  bebida: '🥤', smoothie: '🥤', ensalada: '🥗', acompañamiento: '🍚',
}

const DIFICULTAD_COLOR: Record<string, string> = {
  facil:   'bg-green-50 text-green-700 border-green-200',
  media:   'bg-yellow-50 text-yellow-700 border-yellow-200',
  dificil: 'bg-red-50 text-red-700 border-red-200',
}

interface ReactionData { reaction: string; rating?: number }

export default function RecetasPage() {
  const navigate = useNavigate()
  const { family, members }               = useFamilyStore()
  const { recipes, loading, loadRecipes } = useRecipesStore()

  const [vista, setVista]         = useState<Vista>('tabs')
  const [tab, setTab]             = useState<Tab>('descubrir')
  const [memberIdx, setMemberIdx] = useState(0)
  const [busqueda, setBusqueda]   = useState('')
  const [categoria, setCategoria] = useState<Categoria>('todos')

  // Reacciones del miembro activo
  const [reactions, setReactions] = useState<Record<string, ReactionData>>({})
  // Reacciones de TODOS los miembros: recipe_id → [member_ids que lo guardaron]
  const [allSaved, setAllSaved]   = useState<Record<string, string[]>>({})
  // Receta a compartir
  const [sharing, setSharing]     = useState<Recipe | null>(null)
  // Toast
  const [toast, setToast]         = useState<string | null>(null)

  const member: FamilyMember | undefined = members[memberIdx]

  useEffect(() => {
    if (family?.id) loadRecipes(family.id)
  }, [family?.id, loadRecipes])

  useEffect(() => {
    if (member?.id) loadReactions(member.id)
  }, [member?.id])

  useEffect(() => {
    if (members.length > 0) loadAllSaved()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members.length])

  // ── Loaders ─────────────────────────────────────────────────────────────────

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

  const loadAllSaved = async () => {
    const ids = members.map(m => m.id).filter(Boolean) as string[]
    if (ids.length === 0) return
    const { data } = await supabase
      .from('recipe_reactions')
      .select('recipe_id, member_id')
      .in('member_id', ids)
      .in('reaction', ['like', 'bookmark'])
    const map: Record<string, string[]> = {}
    for (const r of (data ?? []) as { recipe_id: string; member_id: string }[]) {
      if (!map[r.recipe_id]) map[r.recipe_id] = []
      map[r.recipe_id].push(r.member_id)
    }
    setAllSaved(map)
  }

  // ── Acciones ─────────────────────────────────────────────────────────────────

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  const removeFromSaved = async (recipeId: string) => {
    if (!member?.id) return
    await supabase.from('recipe_reactions')
      .delete()
      .eq('recipe_id', recipeId)
      .eq('member_id', member.id)
    setReactions(prev => { const n = { ...prev }; delete n[recipeId]; return n })
    setAllSaved(prev => ({
      ...prev,
      [recipeId]: (prev[recipeId] ?? []).filter(id => id !== member.id),
    }))
    showToast('Receta quitada de Guardadas')
  }

  const shareToMembers = async (recipeId: string, targetIds: string[]) => {
    for (const targetId of targetIds) {
      await supabase.from('recipe_reactions').upsert(
        { recipe_id: recipeId, member_id: targetId, reaction: 'bookmark' },
        { onConflict: 'recipe_id,member_id' }
      )
    }
    setAllSaved(prev => ({
      ...prev,
      [recipeId]: [...new Set([...(prev[recipeId] ?? []), ...targetIds])],
    }))
    const names = targetIds
      .map(id => members.find(m => m.id === id)?.name)
      .filter(Boolean).join(', ')
    showToast(`Compartida con ${names} ✓`)
    setSharing(null)
  }

  const openRecipe = (r: Recipe) => {
    navigate(`/receta/${r.id}${member?.id ? `?m=${member.id}` : ''}`)
  }

  // ── Filtros ──────────────────────────────────────────────────────────────────

  // Mis recetas: recetas que el usuario de esta familia creó
  const misRecetas = recipes.filter(r => r.family_id === family?.id)

  // Guardadas: recetas base (o de otros) que el miembro guardó o le gustaron
  const guardadasRecipes = recipes.filter(r =>
    r.is_base_recipe &&
    (reactions[r.id]?.reaction === 'like' || reactions[r.id]?.reaction === 'bookmark')
  )

  const matchesCategoria = (r: Recipe): boolean => {
    if (categoria === 'todos') return true
    const nombre  = r.nombre.toLowerCase()
    const tc      = (r as unknown as { tipo_componente?: string }).tipo_componente ?? ''

    // Por tipo_componente (más preciso)
    if (categoria === 'estelares'  ) return !!(r as unknown as { es_para_lucirse?: boolean }).es_para_lucirse
    if (categoria === 'proteina'   ) return tc === 'proteina_principal'
    if (categoria === 'guarnicion' ) return tc === 'guarnicion'
    if (categoria === 'ensalada'   ) return tc === 'ensalada' || nombre.includes('ensalada') || nombre.includes('slaw')
    if (categoria === 'plato_unico') return tc === 'plato_unico'
    if (categoria === 'postre'     ) return tc === 'postre'
    if (categoria === 'bebida'     ) return tc === 'bebida' || ['jugo','agua','té','cafe','café','limonada','smoothie','batido'].some(k => nombre.includes(k))
    if (categoria === 'merienda'   ) return tc === 'merienda'
    if (categoria === 'sopa'       ) return ['sopa','crema de','caldo','sancocho','ajiaco','cuchuco','mondongo','mazamorra'].some(k => nombre.includes(k))

    // Por tipo_comida
    if (categoria === 'desayuno') return r.tipo_comida.includes('desayuno')
    if (categoria === 'almuerzo') return r.tipo_comida.includes('almuerzo')
    if (categoria === 'cena'    ) return r.tipo_comida.includes('cena')
    if (categoria === 'snack'   ) return r.tipo_comida.includes('snack')

    return false
  }

  const applySearch = (list: Recipe[]) => {
    let result = categoria !== 'todos' ? list.filter(matchesCategoria) : list
    if (busqueda) result = result.filter(r =>
      r.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      r.tags.some(t => t.toLowerCase().includes(busqueda.toLowerCase()))
    )
    return result
  }

  // Miembros que también guardaron una receta (excluyendo al miembro activo)
  const othersSaved = (recipeId: string): FamilyMember[] => {
    const ids = allSaved[recipeId] ?? []
    return members.filter(m => m.id && m.id !== member?.id && ids.includes(m.id))
  }

  // ── Vista importar ────────────────────────────────────────────────────────────

  if (vista === 'importar') {
    return (
      <ImportModal
        familyId={family?.id ?? ''}
        onSaved={() => { loadRecipes(family?.id ?? ''); setVista('tabs'); setTab('mis') }}
        onClose={() => setVista('tabs')}
      />
    )
  }

  // ── Layout principal ──────────────────────────────────────────────────────────

  const listData      = tab === 'mis' ? misRecetas : guardadasRecipes
  const showGuardadas = tab === 'guardadas'

  return (
    <div className="min-h-screen pb-28 max-w-lg mx-auto overflow-x-hidden">
      <BottomNav />

      {/* Header sticky */}
      <div className="sticky top-0 bg-bg/95 backdrop-blur z-10 px-4 pt-5 pb-3 flex flex-col gap-3">

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/')} className="text-muted hover:text-text transition-colors">←</button>
            <h1 className="text-xl font-semibold text-text">Recetario</h1>
          </div>
          <button
            onClick={() => setVista('importar')}
            className="px-3 py-1.5 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent-hover transition-all">
            + Agregar
          </button>
        </div>

        {/* Selector de miembro */}
        {members.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-0.5">
            {members.map((m, i) => (
              <button key={m.id} onClick={() => setMemberIdx(i)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-all
                  ${memberIdx === i ? 'bg-accent text-white' : 'bg-white border border-border text-muted hover:border-accent'}`}>
                <span>{m.emoji}</span>
                <span>{m.name}</span>
              </button>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          <TabBtn active={tab === 'mis'} onClick={() => setTab('mis')}>
            📖 Mis recetas
            {misRecetas.length > 0 && (
              <span className="ml-1 bg-accent/20 text-accent text-[10px] px-1.5 py-0.5 rounded-full font-semibold">
                {misRecetas.length}
              </span>
            )}
          </TabBtn>
          <TabBtn active={tab === 'guardadas'} onClick={() => setTab('guardadas')}>
            🔖 Guardadas
            {guardadasRecipes.length > 0 && (
              <span className="ml-1 bg-accent/20 text-accent text-[10px] px-1.5 py-0.5 rounded-full font-semibold">
                {guardadasRecipes.length}
              </span>
            )}
          </TabBtn>
          <TabBtn active={tab === 'descubrir'} onClick={() => setTab('descubrir')}>
            ✨ Descubrir
          </TabBtn>
        </div>

        {tab !== 'descubrir' && (
          <>
            {/* Chips de categoría */}
            <div className="flex gap-2 overflow-x-auto pb-0.5 -mx-1 px-1">
              {CATEGORIAS.map(cat => (
                <button key={cat.id}
                  onClick={() => setCategoria(cat.id)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all flex-shrink-0
                    ${categoria === cat.id
                      ? 'bg-accent text-white shadow-sm'
                      : 'bg-white border border-accent text-accent hover:bg-accent/10'}`}>
                  {cat.emoji} {cat.label}
                </button>
              ))}
            </div>
            <input
              type="search"
              placeholder="Buscar receta..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
            />
          </>
        )}
      </div>

      {/* Descubrir */}
      {tab === 'descubrir' && (
        <SwipeRecetas
          embedded
          memberId={member?.id ?? ''}
          onReacted={() => { if (member?.id) { loadReactions(member.id); loadAllSaved() } }}
          onClose={() => setTab('guardadas')}
          onCardTap={openRecipe}
        />
      )}

      {/* Mis recetas / Guardadas */}
      {tab !== 'descubrir' && (
        <div className="px-4 mt-2 flex flex-col gap-3">
          {loading && <p className="text-center py-12 text-muted text-sm">Cargando...</p>}

          {!loading && applySearch(listData).length === 0 && (
            <EmptyState
              tab={tab}
              busqueda={busqueda}
              onDescubrir={() => setTab('descubrir')}
              onAgregar={() => setVista('importar')}
            />
          )}

          {applySearch(listData).map(r => (
            <RecipeRow
              key={r.id}
              recipe={r}
              rating={reactions[r.id]?.rating}
              sharedWith={othersSaved(r.id)}
              onClick={() => openRecipe(r)}
              onRemove={showGuardadas ? () => removeFromSaved(r.id) : undefined}
              onShare={showGuardadas ? () => setSharing(r) : undefined}
            />
          ))}
        </div>
      )}

      {/* Modal compartir */}
      {sharing && member?.id && (
        <ShareMemberModal
          recipe={sharing}
          currentMemberId={member.id}
          members={members}
          onShare={ids => shareToMembers(sharing.id, ids)}
          onClose={() => setSharing(null)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-text text-bg text-sm px-4 py-2.5 rounded-xl shadow-lg z-50 whitespace-nowrap">
          {toast}
        </div>
      )}
    </div>
  )
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function TabBtn({ active, onClick, children }: {
  active: boolean; onClick: () => void; children: React.ReactNode
}) {
  return (
    <button onClick={onClick}
      className={`flex-1 flex items-center justify-center py-1.5 rounded-lg text-xs font-medium transition-all
        ${active ? 'bg-white text-text shadow-sm' : 'text-muted hover:text-text'}`}>
      {children}
    </button>
  )
}

function RecipeRow({ recipe: r, rating, sharedWith, onClick, onRemove, onShare }: {
  recipe:      Recipe
  rating?:     number
  sharedWith?: FamilyMember[]
  onClick:     () => void
  onRemove?:   () => void
  onShare?:    () => void
}) {
  return (
    <div
      onClick={onClick}
      className="card flex flex-col gap-2 cursor-pointer hover:border-accent transition-all active:scale-[0.99]">

      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="font-semibold text-text flex-1">{r.nombre}</p>
            {(r as unknown as { es_para_lucirse?: boolean }).es_para_lucirse && (
              <span className="text-base flex-shrink-0" title="Receta estelar">⭐</span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap mt-1">
            {r.tipo_comida.slice(0, 2).map(t => (
              <span key={t} className="text-xs text-muted">{TIPO_ICONS[t] ?? ''} {t}</span>
            ))}
            {r.tiempo_total_min && <span className="text-xs text-muted">⏱ {r.tiempo_total_min}min</span>}
            {r.dificultad && (
              <span className={`text-xs px-2 py-0.5 rounded-full border ${DIFICULTAD_COLOR[r.dificultad]}`}>
                {r.dificultad}
              </span>
            )}
          </div>
        </div>

        {/* Botones de acción (solo en Guardadas) */}
        {(onRemove || onShare) && (
          <div className="flex gap-0.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
            {onShare && (
              <button onClick={onShare}
                className="p-2 text-muted hover:text-accent transition-colors rounded-lg hover:bg-accent-light"
                title="Compartir con otro miembro">
                <span className="text-base leading-none">↗</span>
              </button>
            )}
            {onRemove && (
              <button onClick={onRemove}
                className="p-2 text-muted hover:text-error transition-colors rounded-lg hover:bg-red-50"
                title="Quitar de Guardadas">
                <span className="text-lg leading-none font-light">×</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Rating del miembro */}
      {rating && (
        <div className="flex gap-0.5 text-sm">
          {[1,2,3,4,5].map(s => (
            <span key={s} style={{ color: s <= rating ? '#EF9F27' : '#E5E7EB' }}>★</span>
          ))}
        </div>
      )}

      {/* También guardada por otros miembros */}
      {sharedWith && sharedWith.length > 0 && (
        <div className="flex items-center gap-1.5 pt-0.5 border-t border-border">
          <span className="text-xs text-muted">También le gusta a</span>
          {sharedWith.map(m => (
            <span key={m.id} className="text-sm" title={m.name}>{m.emoji}</span>
          ))}
        </div>
      )}
    </div>
  )
}

function EmptyState({ tab, busqueda, onDescubrir, onAgregar }: {
  tab: Tab; busqueda: string; onDescubrir: () => void; onAgregar: () => void
}) {
  if (busqueda) return (
    <div className="text-center py-16">
      <p className="text-muted text-sm">No encontré "{busqueda}"</p>
    </div>
  )
  if (tab === 'mis') return (
    <div className="text-center py-16 flex flex-col items-center gap-4">
      <span className="text-5xl">📖</span>
      <div>
        <p className="text-text font-medium">Aún no has creado recetas</p>
        <p className="text-muted text-sm mt-1">Agrega tu primera receta con el botón + Agregar</p>
      </div>
      <button onClick={onAgregar} className="btn-primary max-w-xs">+ Agregar receta</button>
    </div>
  )
  return (
    <div className="text-center py-16 flex flex-col items-center gap-4">
      <span className="text-5xl">🔖</span>
      <div>
        <p className="text-text font-medium">Aún no tienes recetas guardadas</p>
        <p className="text-muted text-sm mt-1">En Descubrir guarda las que te llamen la atención</p>
      </div>
      <button onClick={onDescubrir} className="btn-primary max-w-xs">✨ Ir a Descubrir</button>
    </div>
  )
}
