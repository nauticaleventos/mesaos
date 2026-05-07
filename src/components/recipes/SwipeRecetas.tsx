import { useState, useRef, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useRecipesStore, type Recipe } from '../../store/recipesStore'
import { useFamilyStore } from '../../store/familyStore'
import type { FamilyMember } from '../../lib/types'

interface Props {
  onClose: () => void
}

type Reaction = 'like' | 'dislike' | 'not_tried'

const TIPO_ICONS: Record<string, string> = {
  desayuno: '☀️', almuerzo: '🍽️', cena: '🌙',
  snack: '🍎', postre: '🍰', brunch: '🥞',
}

export default function SwipeRecetas({ onClose }: Props) {
  const { recipes }  = useRecipesStore()
  const { members }  = useFamilyStore()
  const [memberIdx, setMemberIdx] = useState(0)
  const [queue, setQueue]         = useState<Recipe[]>([])
  const [index, setIndex]         = useState(0)
  const [done, setDone]           = useState(false)
  const [saving, setSaving]       = useState(false)

  // Swipe state
  const cardRef    = useRef<HTMLDivElement>(null)
  const startX     = useRef(0)
  const currentX   = useRef(0)
  const dragging   = useRef(false)
  const [dragX, setDragX]     = useState(0)
  const [leaving, setLeaving] = useState<'left' | 'right' | null>(null)

  const member: FamilyMember | undefined = members[memberIdx]
  const recipe: Recipe | undefined       = queue[index]
  const progress = queue.length > 0 ? Math.round((index / queue.length) * 100) : 0

  // Cargar recetas sin valorar para este miembro
  useEffect(() => {
    if (!member) return
    loadQueue(member.id)
  }, [memberIdx, member?.id])

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
    setDragX(0)
    setLeaving(null)
  }

  const saveReaction = async (reaction: Reaction) => {
    if (!member || !recipe || saving) return
    setSaving(true)
    await supabase.from('recipe_reactions').upsert({
      recipe_id: recipe.id,
      member_id: member.id,
      reaction,
    }, { onConflict: 'recipe_id,member_id' })
    setSaving(false)

    if (index + 1 >= queue.length) {
      setDone(true)
    } else {
      setIndex(i => i + 1)
    }
    setDragX(0)
    setLeaving(null)
  }

  const triggerSwipe = (dir: 'left' | 'right') => {
    setLeaving(dir)
    setTimeout(() => {
      saveReaction(dir === 'right' ? 'like' : 'dislike')
    }, 300)
  }

  // Touch / mouse events
  const onStart = (x: number) => {
    startX.current   = x
    currentX.current = x
    dragging.current = true
  }

  const onMove = (x: number) => {
    if (!dragging.current) return
    currentX.current = x
    setDragX(x - startX.current)
  }

  const onEnd = () => {
    if (!dragging.current) return
    dragging.current = false
    const diff = currentX.current - startX.current
    if (diff > 100)       triggerSwipe('right')
    else if (diff < -100) triggerSwipe('left')
    else                  setDragX(0)
  }

  // Card style durante arrastre
  const rotation = dragX * 0.08
  const cardStyle: React.CSSProperties = leaving
    ? {
        transform: `translateX(${leaving === 'right' ? 400 : -400}px) rotate(${leaving === 'right' ? 20 : -20}deg)`,
        transition: 'transform 0.3s ease',
        opacity: 0,
      }
    : {
        transform: `translateX(${dragX}px) rotate(${rotation}deg)`,
        transition: dragging.current ? 'none' : 'transform 0.2s ease',
      }

  if (members.length === 0) return null

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
              ${memberIdx === i ? 'bg-accent text-white' : 'bg-white border border-border text-muted'}`}>
            <span>{m.emoji}</span>
            <span>{m.name}</span>
          </button>
        ))}
      </div>

      {/* Progreso */}
      {queue.length > 0 && (
        <div className="flex flex-col gap-1 mb-4">
          <div className="w-full bg-border rounded-full h-1.5">
            <div className="bg-accent h-1.5 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs text-muted text-center">{index} de {queue.length} recetas</p>
        </div>
      )}

      {/* Done state */}
      {done && (
        <div className="flex-1 flex flex-col items-center justify-center gap-5 text-center">
          <span className="text-6xl">🎉</span>
          <div>
            <p className="text-xl font-serif font-semibold text-text">¡Listo, {member?.name}!</p>
            <p className="text-muted text-sm mt-1">Ya valoraste todas las recetas disponibles.</p>
          </div>
          <button onClick={onClose} className="btn-primary max-w-xs">Ver recetario</button>
        </div>
      )}

      {/* Card de receta */}
      {!done && recipe && (
        <div className="flex-1 flex flex-col items-center justify-center gap-6">

          {/* Indicadores de swipe */}
          <div className="flex justify-between w-full px-4">
            <div className={`text-2xl font-bold text-error transition-opacity ${dragX < -30 ? 'opacity-100' : 'opacity-20'}`}>
              ✗
            </div>
            <div className={`text-2xl font-bold text-success transition-opacity ${dragX > 30 ? 'opacity-100' : 'opacity-20'}`}>
              ❤️
            </div>
          </div>

          {/* Card */}
          <div
            ref={cardRef}
            style={cardStyle}
            className="card w-full cursor-grab active:cursor-grabbing select-none"
            onMouseDown={e => onStart(e.clientX)}
            onMouseMove={e => onMove(e.clientX)}
            onMouseUp={onEnd}
            onMouseLeave={onEnd}
            onTouchStart={e => onStart(e.touches[0].clientX)}
            onTouchMove={e => { e.preventDefault(); onMove(e.touches[0].clientX) }}
            onTouchEnd={onEnd}
          >
            <div className="flex flex-col gap-3 pointer-events-none">
              <div>
                <p className="font-serif text-xl font-semibold text-text">{recipe.nombre}</p>
                {recipe.descripcion_corta && (
                  <p className="text-muted text-sm mt-1">{recipe.descripcion_corta}</p>
                )}
              </div>

              <div className="flex flex-wrap gap-2 text-xs text-muted">
                {recipe.tipo_comida.slice(0,2).map(t => (
                  <span key={t}>{TIPO_ICONS[t] ?? ''} {t}</span>
                ))}
                {recipe.tiempo_total_min && <span>⏱ {recipe.tiempo_total_min}min</span>}
                {recipe.dificultad && <span>• {recipe.dificultad}</span>}
                {recipe.origen && <span>🌎 {recipe.origen}</span>}
              </div>

              {/* Ingredientes principales */}
              <div>
                <p className="text-xs text-muted font-medium mb-1">Ingredientes principales:</p>
                <div className="flex flex-wrap gap-1">
                  {recipe.ingredientes.filter(i => i.esencial).slice(0,6).map((ing, i) => (
                    <span key={i} className="px-2 py-0.5 bg-accent-light text-accent text-xs rounded-full">
                      {ing.nombre}
                    </span>
                  ))}
                </div>
              </div>

              {recipe.info_nutricional_aprox && (
                <p className="text-xs text-muted">
                  {recipe.info_nutricional_aprox.calorias_porcion} kcal · {recipe.info_nutricional_aprox.proteina_g}g proteína
                </p>
              )}
            </div>
          </div>

          {/* Botones */}
          <div className="flex items-center gap-6">
            <button onClick={() => triggerSwipe('left')}
              className="w-14 h-14 rounded-full bg-white border-2 border-error text-error text-2xl flex items-center justify-center shadow-sm hover:bg-red-50 transition-all active:scale-95">
              ✗
            </button>
            <button onClick={() => saveReaction('not_tried')}
              className="w-10 h-10 rounded-full bg-white border border-border text-muted text-sm flex items-center justify-center shadow-sm hover:bg-gray-50 transition-all active:scale-95"
              title="No lo he probado">
              ?
            </button>
            <button onClick={() => triggerSwipe('right')}
              className="w-14 h-14 rounded-full bg-white border-2 border-success text-success text-2xl flex items-center justify-center shadow-sm hover:bg-green-50 transition-all active:scale-95">
              ❤️
            </button>
          </div>

          <p className="text-xs text-muted text-center">
            Desliza → me gusta · ← no me gusta · ? no lo he probado
          </p>
        </div>
      )}
    </div>
  )
}
