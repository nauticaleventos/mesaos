import { useState } from 'react'
import { supabase } from '../../lib/supabase'

interface Props {
  conflictId:   string
  recipeNombre: string
  memberName:   string
  ratingOwner:  number
  ratingMember: number
  ratingAId:    string
  ratingBId:    string
  onResolved:   () => void
  onClose:      () => void
}

type Choice = 'keep_member' | 'keep_owner' | 'average' | 'ignore'

const CHOICES: { value: Choice; label: string; desc: string }[] = [
  { value: 'keep_member', label: 'Mantener la del miembro',   desc: 'Se usa la valoración del miembro' },
  { value: 'keep_owner',  label: 'Mantener la mía (owner)',   desc: 'Se usa tu valoración' },
  { value: 'average',     label: 'Promedio entre ambas',      desc: 'El motor usa el promedio' },
  { value: 'ignore',      label: 'Ignorar las dos',           desc: 'Hasta nueva cocción' },
]

export default function ConflictoModal({ conflictId, recipeNombre, memberName, ratingOwner, ratingMember, ratingAId, ratingBId, onResolved, onClose }: Props) {
  const [choice, setChoice]   = useState<Choice | null>(null)
  const [loading, setLoading] = useState(false)

  const handleResolve = async () => {
    if (!choice) return
    setLoading(true)

    // Actualizar el conflicto
    await supabase.from('rating_conflicts').update({
      resolution_status: 'resolved',
      resolution_choice: choice,
      resolved_at: new Date().toISOString(),
    }).eq('id', conflictId)

    // Aplicar la resolución
    if (choice === 'keep_member') {
      await supabase.from('recipe_reactions').delete().eq('id', ratingAId)
    } else if (choice === 'keep_owner') {
      await supabase.from('recipe_reactions').delete().eq('id', ratingBId)
    } else if (choice === 'average') {
      const avg = Math.round((ratingOwner + ratingMember) / 2)
      await supabase.from('recipe_reactions').update({ rating: avg }).eq('id', ratingAId)
      await supabase.from('recipe_reactions').delete().eq('id', ratingBId)
    }
    // 'ignore': deja las dos, el motor las maneja

    setLoading(false)
    onResolved()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 px-4 pb-8"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="card w-full max-w-sm flex flex-col gap-4">
        <div>
          <p className="text-xs text-yellow-600 font-medium uppercase tracking-wider">⚠️ Conflicto de valoración</p>
          <p className="font-serif text-lg font-semibold text-text mt-1">{recipeNombre}</p>
          <p className="text-xs text-muted mt-1">
            Vos la marcaste con <strong>{ratingOwner}⭐</strong> pero <strong>{memberName}</strong> la valoró con <strong>{ratingMember}⭐</strong>
            {' '}(diferencia de {Math.abs(ratingOwner - ratingMember)} ⭐). ¿Qué hacemos?
          </p>
        </div>

        <div className="flex flex-col gap-2">
          {CHOICES.map(c => (
            <button key={c.value} type="button" onClick={() => setChoice(c.value)}
              className={`p-3 rounded-xl border-2 text-left transition-all
                ${choice === c.value ? 'border-accent bg-accent-light' : 'border-border hover:border-accent/40'}`}>
              <p className={`text-sm font-medium ${choice === c.value ? 'text-accent' : 'text-text'}`}>{c.label}</p>
              <p className="text-xs text-muted">{c.desc}</p>
            </button>
          ))}
        </div>

        <button onClick={handleResolve} disabled={!choice || loading}
          className={`btn-primary ${!choice ? 'opacity-40 cursor-not-allowed' : ''}`}>
          {loading ? 'Guardando...' : 'Resolver conflicto'}
        </button>

        <button onClick={onClose} className="text-muted text-xs text-center hover:text-text transition-colors py-1">
          Decidir después
        </button>
      </div>
    </div>
  )
}
