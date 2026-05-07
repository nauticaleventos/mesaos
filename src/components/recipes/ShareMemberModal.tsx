import { useState } from 'react'
import type { Recipe } from '../../store/recipesStore'
import type { FamilyMember } from '../../lib/types'

interface Props {
  recipe:          Recipe
  currentMemberId: string
  members:         FamilyMember[]
  onShare:         (memberIds: string[]) => void
  onClose:         () => void
}

export default function ShareMemberModal({ recipe, currentMemberId, members, onShare, onClose }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const others = members.filter(m => m.id && m.id !== currentMemberId)

  const toggle = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 px-4 pb-8"
      onClick={e => e.target === e.currentTarget && onClose()}>

      <div className="card w-full max-w-sm flex flex-col gap-4">
        <div>
          <p className="font-semibold text-text">Compartir receta</p>
          <p className="text-muted text-xs mt-0.5 line-clamp-1">{recipe.nombre}</p>
        </div>

        <p className="text-xs text-muted -mt-1">
          Se guardará en la lista "Guardadas" del miembro seleccionado para que la valore.
        </p>

        <div className="flex flex-col gap-2">
          {others.length === 0 && (
            <p className="text-center text-muted text-sm py-4">No hay otros miembros en tu familia.</p>
          )}
          {others.map(m => {
            const sel = selected.has(m.id!)
            return (
              <button
                key={m.id}
                onClick={() => toggle(m.id!)}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left
                  ${sel ? 'border-accent bg-accent-light' : 'border-border hover:border-accent/50'}`}>
                <span className="text-2xl flex-shrink-0">{m.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text">{m.name}</p>
                  <p className="text-xs text-muted">Recibirá la receta en sus Guardadas</p>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs flex-shrink-0
                  ${sel ? 'border-accent bg-accent text-white' : 'border-border'}`}>
                  {sel ? '✓' : ''}
                </div>
              </button>
            )
          })}
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="btn-ghost flex-1 !py-2.5">Cancelar</button>
          <button
            onClick={() => selected.size > 0 && onShare([...selected])}
            disabled={selected.size === 0}
            className="btn-primary flex-1 !py-2.5">
            Compartir {selected.size > 0 ? `(${selected.size})` : ''}
          </button>
        </div>
      </div>
    </div>
  )
}
