import { useState, useRef, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useRecipesStore, type Recipe } from '../../store/recipesStore'
import { useFamilyStore } from '../../store/familyStore'
import { useFridgeStore } from '../../store/fridgeStore'
import RecipeCard from './RecipeCard'
import StarRatingModal from './StarRatingModal'

interface Props {
  onClose:     () => void
  embedded?:   boolean
  memberId?:   string
  onReacted?:  () => void
  onCardTap?:  (recipe: Recipe) => void
}

type Reaction  = 'like' | 'dislike' | 'bookmark'
type Direction = 'left' | 'right' | 'up'

export default function SwipeRecetas({ onClose, embedded = false, memberId: externalMemberId, onReacted, onCardTap }: Props) {
  const { recipes }            = useRecipesStore()
  const { members }            = useFamilyStore()
  const { items: fridgeItems } = useFridgeStore()

  const [memberIdx, setMemberIdx] = useState(0)
  const standaloneMember          = members[memberIdx]
  const effectiveMemberId         = embedded ? externalMemberId : standaloneMember?.id

  const [queue, setQueue]         = useState<Recipe[]>([])
  const [index, setIndex]         = useState(0)
  const [done, setDone]           = useState(false)
  const [saving, setSaving]       = useState(false)
  const [showModal, setShowModal] = useState(false)

  // Drag
  const startX   = useRef(0)
  const startY   = useRef(0)
  const currentX = useRef(0)
  const currentY = useRef(0)
  const dragging = useRef(false)

  const [dragX, setDragX]     = useState(0)
  const [dragY, setDragY]     = useState(0)
  const [leaving, setLeaving] = useState<Direction | null>(null)

  // Star rating pending
  const ratingTimerRef              = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [pendingRating, setPendingRating] = useState<number | null>(null)

  const recipe: Recipe | undefined = queue[index]
  const progress = queue.length > 0 ? Math.round((index / queue.length) * 100) : 0

  useEffect(() => {
    if (effectiveMemberId) loadQueue(effectiveMemberId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveMemberId, recipes.length])

  const loadQueue = async (memberId: string) => {
    if (recipes.length === 0) return  // esperar a que carguen las recetas
    const { data: rated } = await supabase
      .from('recipe_reactions')
      .select('recipe_id')
      .eq('member_id', memberId)
    const ratedIds = new Set((rated ?? []).map((r: { recipe_id: string }) => r.recipe_id))
    const pending  = recipes.filter(r => !ratedIds.has(r.id))
    setQueue(pending)
    setIndex(0)
    setDone(pending.length === 0)
    resetDrag()
  }

  const resetDrag = () => {
    setDragX(0); setDragY(0); setLeaving(null); setShowModal(false)
    setPendingRating(null)
    if (ratingTimerRef.current) { clearTimeout(ratingTimerRef.current); ratingTimerRef.current = null }
  }

  const advance = () => {
    const next = index + 1
    if (next >= queue.length) setDone(true)
    else setIndex(next)
    resetDrag()
    onReacted?.()
  }

  const saveReaction = async (reaction: Reaction, rating?: number) => {
    if (!effectiveMemberId || !recipe || saving) return
    setSaving(true)
    const payload: Record<string, unknown> = { recipe_id: recipe.id, member_id: effectiveMemberId, reaction }
    if (rating) payload.rating = rating
    await supabase.from('recipe_reactions').upsert(payload, { onConflict: 'recipe_id,member_id' })
    setSaving(false)
    advance()
  }

  const triggerLeave = (dir: Direction) => {
    if (saving || leaving) return
    if (dir === 'right') {
      // Swipe right = like sin rating (flujo rápido)
      setLeaving('right')
      setTimeout(() => saveReaction('like'), 320)
      return
    }
    setLeaving(dir)
    setTimeout(() => saveReaction(dir === 'left' ? 'dislike' : 'bookmark'), 320)
  }

  // Star tap: fill estrellas → 400ms → guardar como ya_probada
  const handleStarTap = (stars: number) => {
    if (saving || leaving) return
    if (ratingTimerRef.current) clearTimeout(ratingTimerRef.current)
    setPendingRating(stars)
    ratingTimerRef.current = setTimeout(() => {
      setLeaving('right')
      setTimeout(() => saveReaction('like', stars), 320)
      setPendingRating(null)
      ratingTimerRef.current = null
    }, 400)
  }

  // Swipe handlers
  const onStart = (x: number, y: number) => {
    if (leaving || showModal) return
    startX.current = x; startY.current = y
    currentX.current = x; currentY.current = y
    dragging.current = true
  }

  const onMove = (x: number, y: number) => {
    if (!dragging.current) return
    currentX.current = x; currentY.current = y
    setDragX(x - startX.current)
    setDragY(y - startY.current)
  }

  const onEnd = () => {
    if (!dragging.current) return
    dragging.current = false
    const adX = Math.abs(currentX.current - startX.current)
    const adY = Math.abs(currentY.current - startY.current)

    // Tap simple → abrir detalle
    if (adX < 8 && adY < 8) {
      if (recipe) onCardTap?.(recipe)
      setDragX(0); setDragY(0)
      return
    }

    const sdX = currentX.current - startX.current
    const sdY = currentY.current - startY.current
    if (sdY < -80 && Math.abs(sdY) > Math.abs(sdX)) triggerLeave('up')
    else if (sdX > 100) triggerLeave('right')
    else if (sdX < -100) triggerLeave('left')
    else { setDragX(0); setDragY(0) }
  }

  // Card style
  const cardStyle: React.CSSProperties = leaving
    ? {
        transform:
          leaving === 'right' ? 'translateX(160%) rotate(20deg)' :
          leaving === 'left'  ? 'translateX(-160%) rotate(-20deg)' :
                                'translateY(-150%) rotate(-6deg)',
        transition: 'transform 0.35s ease, opacity 0.35s ease',
        opacity: 0,
      }
    : {
        transform:  `translateX(${dragX}px) translateY(${dragY < 0 ? dragY * 0.3 : 0}px) rotate(${dragX * 0.06}deg)`,
        transition: dragging.current ? 'none' : 'transform 0.22s ease',
        cursor:     'grab',
      }

  if (members.length === 0) return null

  // ── Contenido compartido entre modos ────────────────────────────────────
  const cardContent = (
    <>
      {/* Progreso */}
      {queue.length > 0 && (
        <div className="flex flex-col gap-1 mb-2">
          <div className="w-full bg-border rounded-full h-1.5">
            <div className="bg-accent h-1.5 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs text-muted text-center">{index} de {queue.length} recetas por valorar</p>
        </div>
      )}

      {/* Done */}
      {done && (
        <div className="flex flex-col items-center justify-center gap-5 text-center py-12">
          <span className="text-6xl">🎉</span>
          <div>
            <p className="text-xl font-serif font-semibold text-text">¡Ya valoraste todo!</p>
            <p className="text-muted text-sm mt-1">
              {embedded ? 'Revisa tus favoritas en la pestaña ❤️' : 'Ya valoraste todas las recetas disponibles.'}
            </p>
          </div>
          <button onClick={onClose} className="btn-primary max-w-xs">
            {embedded ? '❤️ Ver mis recetas' : 'Ver recetario'}
          </button>
        </div>
      )}

      {/* Card + botones */}
      {!done && recipe && (
        <div className="flex flex-col items-center gap-5">
          {/* Feedback de pendingRating */}
          {pendingRating !== null && (
            <p className="text-xs text-accent font-medium animate-pulse">
              {'★'.repeat(pendingRating)}{'☆'.repeat(5 - pendingRating)} — guardando...
            </p>
          )}

          {/* Tarjeta draggable — botones de acción están dentro de RecipeCard */}
          <div
            style={cardStyle}
            className="w-full active:cursor-grabbing"
            onMouseDown={e  => onStart(e.clientX, e.clientY)}
            onMouseMove={e  => onMove(e.clientX, e.clientY)}
            onMouseUp={onEnd}
            onMouseLeave={onEnd}
            onTouchStart={e => onStart(e.touches[0].clientX, e.touches[0].clientY)}
            onTouchMove={e  => { e.preventDefault(); onMove(e.touches[0].clientX, e.touches[0].clientY) }}
            onTouchEnd={onEnd}
          >
            <RecipeCard
              recipe={recipe}
              fridgeItems={fridgeItems}
              dragX={dragX}
              dragY={dragY}
              onStarTap={handleStarTap}
              onDislike={() => !saving && triggerLeave('left')}
              onBookmark={() => !saving && triggerLeave('up')}
              onLike={() => !saving && triggerLeave('right')}
            />
          </div>
        </div>
      )}
    </>
  )

  // ── Modo embebido ────────────────────────────────────────────────────────
  if (embedded) {
    return (
      <div className="px-4 pt-3 pb-6 flex flex-col gap-3">
        {cardContent}
        {showModal && recipe && (
          <StarRatingModal recipe={recipe}
            onRate={r => { setLeaving('right'); setTimeout(() => saveReaction('like', r), 320) }}
            onNotTried={() => { setLeaving('up'); setTimeout(() => saveReaction('bookmark'), 320) }}
            onClose={() => { setShowModal(false); setDragX(0); setDragY(0) }} />
        )}
      </div>
    )
  }

  // ── Modo standalone ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col max-w-lg mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-serif font-semibold text-text">¿Qué te gusta?</h2>
        <button onClick={onClose} className="text-muted hover:text-text transition-colors text-sm">✕ Cerrar</button>
      </div>
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {members.map((m, i) => (
          <button key={m.id} onClick={() => setMemberIdx(i)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-all
              ${memberIdx === i ? 'bg-accent text-white' : 'bg-white border border-border text-muted hover:border-accent'}`}>
            <span>{m.emoji}</span><span>{m.name}</span>
          </button>
        ))}
      </div>
      <div className="flex-1 flex flex-col justify-center gap-5">{cardContent}</div>
      {showModal && recipe && (
        <StarRatingModal recipe={recipe}
          onRate={r => { setLeaving('right'); setTimeout(() => saveReaction('like', r), 320) }}
          onNotTried={() => { setLeaving('up'); setTimeout(() => saveReaction('bookmark'), 320) }}
          onClose={() => { setShowModal(false); setDragX(0); setDragY(0) }} />
      )}
    </div>
  )
}
