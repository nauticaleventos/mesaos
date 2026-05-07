import { useState, useRef, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useRecipesStore, type Recipe } from '../../store/recipesStore'
import { useFamilyStore } from '../../store/familyStore'
import { useFridgeStore } from '../../store/fridgeStore'
import RecipeCard from './RecipeCard'
import StarRatingModal from './StarRatingModal'

interface Props {
  onClose:    () => void
  // Modo embebido (dentro de RecetasPage)
  embedded?:  boolean
  memberId?:  string
  onReacted?: () => void
}

type Reaction  = 'like' | 'dislike' | 'bookmark'
type Direction = 'left' | 'right' | 'up'

export default function SwipeRecetas({ onClose, embedded = false, memberId: externalMemberId, onReacted }: Props) {
  const { recipes }            = useRecipesStore()
  const { members }            = useFamilyStore()
  const { items: fridgeItems } = useFridgeStore()

  // Standalone: miembro manejado internamente
  const [memberIdx, setMemberIdx] = useState(0)
  const standaloneMember          = members[memberIdx]
  const effectiveMemberId         = embedded ? externalMemberId : standaloneMember?.id

  const [queue, setQueue]         = useState<Recipe[]>([])
  const [index, setIndex]         = useState(0)
  const [done, setDone]           = useState(false)
  const [saving, setSaving]       = useState(false)
  const [showModal, setShowModal] = useState(false)

  // Drag refs
  const startX   = useRef(0)
  const startY   = useRef(0)
  const currentX = useRef(0)
  const currentY = useRef(0)
  const dragging = useRef(false)

  const [dragX, setDragX]     = useState(0)
  const [dragY, setDragY]     = useState(0)
  const [leaving, setLeaving] = useState<Direction | null>(null)

  const recipe: Recipe | undefined = queue[index]
  const progress = queue.length > 0 ? Math.round((index / queue.length) * 100) : 0

  useEffect(() => {
    if (effectiveMemberId) loadQueue(effectiveMemberId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveMemberId])

  const loadQueue = async (memberId: string) => {
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
    const payload: Record<string, unknown> = {
      recipe_id: recipe.id,
      member_id: effectiveMemberId,
      reaction,
    }
    if (rating) payload.rating = rating
    await supabase.from('recipe_reactions').upsert(payload, { onConflict: 'recipe_id,member_id' })
    setSaving(false)
    advance()
  }

  const triggerLeave = (dir: Direction) => {
    if (saving || leaving) return
    if (dir === 'right') {
      setShowModal(true)
      setDragX(0); setDragY(0)
      return
    }
    setLeaving(dir)
    setTimeout(() => saveReaction(dir === 'left' ? 'dislike' : 'bookmark'), 320)
  }

  const handleRate      = (rating: number) => { setLeaving('right'); setTimeout(() => saveReaction('like', rating), 320) }
  const handleNotTried  = () => { setLeaving('up'); setTimeout(() => saveReaction('bookmark'), 320) }

  // ── Drag handlers ────────────────────────────────────────────────────────
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
    const diffX = currentX.current - startX.current
    const diffY = currentY.current - startY.current
    if (diffY < -80 && Math.abs(diffY) > Math.abs(diffX)) triggerLeave('up')
    else if (diffX > 100) triggerLeave('right')
    else if (diffX < -100) triggerLeave('left')
    else { setDragX(0); setDragY(0) }
  }

  // ── Card style ───────────────────────────────────────────────────────────
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

  // ── Sin miembros ─────────────────────────────────────────────────────────
  if (members.length === 0) return null

  const cardAndButtons = (
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
              {embedded ? 'Revisa tus recetas favoritas en la pestaña ❤️' : 'Ya valoraste todas las recetas disponibles.'}
            </p>
          </div>
          <button onClick={onClose} className="btn-primary max-w-xs">
            {embedded ? '❤️ Ver mis recetas' : 'Ver recetario'}
          </button>
        </div>
      )}

      {/* Card */}
      {!done && recipe && (
        <div className="flex flex-col items-center gap-5">
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
            <RecipeCard recipe={recipe} fridgeItems={fridgeItems} dragX={dragX} dragY={dragY} />
          </div>

          {/* Botones */}
          <div className="flex items-center justify-center gap-6">
            <ActionBtn onClick={() => triggerLeave('left')} disabled={saving} size="lg"
              className="border-red-400 text-red-500 hover:bg-red-50">✗</ActionBtn>
            <ActionBtn onClick={() => triggerLeave('up')} disabled={saving} size="md"
              className="border-blue-300 text-blue-500 hover:bg-blue-50">🔖</ActionBtn>
            <ActionBtn onClick={() => triggerLeave('right')} disabled={saving} size="lg"
              className="border-green-400 text-green-500 hover:bg-green-50">❤️</ActionBtn>
          </div>

          <p className="text-xs text-muted text-center">← no me gusta · 🔖 guardar · me gusta →</p>
        </div>
      )}
    </>
  )

  // ── Modo embebido ────────────────────────────────────────────────────────
  if (embedded) {
    return (
      <div className="px-4 pt-3 pb-6 flex flex-col gap-3">
        {cardAndButtons}
        {showModal && recipe && (
          <StarRatingModal recipe={recipe} onRate={handleRate} onNotTried={handleNotTried}
            onClose={() => { setShowModal(false); setDragX(0); setDragY(0) }} />
        )}
      </div>
    )
  }

  // ── Modo standalone (pantalla completa) ──────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col max-w-lg mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-serif font-semibold text-text">¿Qué te gusta?</h2>
        <button onClick={onClose} className="text-muted hover:text-text transition-colors text-sm">✕ Cerrar</button>
      </div>

      {/* Selector de miembro */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {members.map((m, i) => (
          <button key={m.id} onClick={() => setMemberIdx(i)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-all
              ${memberIdx === i ? 'bg-accent text-white' : 'bg-white border border-border text-muted hover:border-accent'}`}>
            <span>{m.emoji}</span>
            <span>{m.name}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 flex flex-col justify-center gap-5">
        {cardAndButtons}
      </div>

      {showModal && recipe && (
        <StarRatingModal recipe={recipe} onRate={handleRate} onNotTried={handleNotTried}
          onClose={() => { setShowModal(false); setDragX(0); setDragY(0) }} />
      )}
    </div>
  )
}

// ── ActionBtn ────────────────────────────────────────────────────────────────
function ActionBtn({ onClick, disabled, size, className, children }: {
  onClick:   () => void
  disabled?: boolean
  size:      'md' | 'lg'
  className: string
  children:  React.ReactNode
}) {
  const dim = size === 'lg' ? 'w-16 h-16 text-2xl' : 'w-11 h-11 text-lg'
  return (
    <button onClick={onClick} disabled={disabled}
      className={`${dim} rounded-full bg-white border-2 flex items-center justify-center
        shadow-md transition-all active:scale-90 disabled:opacity-40 ${className}`}>
      {children}
    </button>
  )
}
