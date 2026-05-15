import { useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useFamilyStore } from '../../store/familyStore'
import type { EnrichedMenuEntry } from '../../store/menuStore'
import RecipePlaceholder from '../recipes/RecipePlaceholder'

const STAR_LABELS = ['', 'No me gustó', 'Regular', 'Estuvo bien', 'Muy buena', '¡Deliciosa!']

interface Props {
  entry:   EnrichedMenuEntry
  onClose: () => void   // cerrar sin guardar (=saltar)
  onSkip:  () => void   // saltar explícito (marca rating_prompted)
  onSaved: () => void   // guardó rating
}

export default function RatingPostCoccionModal({ entry, onClose, onSkip, onSaved }: Props) {
  const { family, members } = useFamilyStore()
  const [stars,   setStars]   = useState(0)
  const [hover,   setHover]   = useState(0)
  const [saving,  setSaving]  = useState(false)
  const [gracias, setGracias] = useState(false)

  const recipe = entry.recipe
  if (!recipe) return null

  const active = hover || stars

  const handleSave = async () => {
    if (stars === 0 || saving || !family?.id) return
    setSaving(true)

    // Usar el primer miembro de la familia como "super usuario"
    const memberId = members[0]?.id ?? null

    await supabase.from('recipe_reactions').upsert(
      {
        recipe_id: entry.recipe_id,
        member_id: memberId,
        family_id: family.id,
        reaction:  'like',
        rating:    stars,
        source:    'cooked_postmeal',
      },
      { onConflict: 'recipe_id,member_id' }
    )

    // Marcar rating_prompted para no volver a preguntar
    await supabase.from('weekly_menu').update({ rating_prompted: true }).eq('id', entry.id)

    setSaving(false)
    setGracias(true)
    setTimeout(onSaved, 1400)
  }

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
        onClick={onClose}
      />
      <div
        className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl shadow-2xl"
        style={{ backgroundColor: '#ffffff', isolation: 'isolate' }}
      >
        <div className="flex flex-col gap-4 p-5 pb-10">

          {/* Handle + close */}
          <div className="flex items-center justify-between">
            <div className="w-10 h-1 rounded-full bg-border mx-auto absolute left-1/2 -translate-x-1/2 top-3" />
            <div />
            <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-gray-100 ml-auto">
              <X size={18} className="text-muted" />
            </button>
          </div>

          {gracias ? (
            /* Estado final */
            <div className="flex flex-col items-center gap-3 py-6">
              <span className="text-5xl">💛</span>
              <p className="font-semibold text-text text-lg">Gracias</p>
              <p className="text-sm text-muted">Tu opinión ayuda a mejorar el menú</p>
            </div>
          ) : (
            <>
              {/* Foto + nombre */}
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-accent-light">
                  {recipe.imagen_url
                    ? <img src={recipe.imagen_url} alt={recipe.nombre} className="w-full h-full object-cover" />
                    : <RecipePlaceholder tipo={(recipe as typeof recipe & { tipo_componente?: string }).tipo_componente} showName={false} className="w-full h-full" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted uppercase tracking-wider mb-0.5">¿Cómo te quedó?</p>
                  <p className="font-semibold text-text leading-snug line-clamp-2">{recipe.nombre}</p>
                </div>
              </div>

              {/* Estrellas */}
              <div className="flex justify-center gap-3 py-2">
                {[1, 2, 3, 4, 5].map(s => (
                  <button
                    key={s}
                    onMouseEnter={() => setHover(s)}
                    onMouseLeave={() => setHover(0)}
                    onTouchStart={() => setStars(s)}
                    onClick={() => setStars(s)}
                    className="text-4xl transition-transform active:scale-90 hover:scale-110 select-none">
                    <span className={s <= active ? 'text-yellow-400' : 'text-gray-200'}>★</span>
                  </button>
                ))}
              </div>

              {active > 0 && (
                <p className="text-center text-muted text-sm -mt-2">
                  {STAR_LABELS[active]}
                </p>
              )}

              {/* Acciones */}
              <button
                onClick={handleSave}
                disabled={stars === 0 || saving}
                className={`btn-primary py-3 transition-opacity ${stars === 0 ? 'opacity-40 cursor-not-allowed' : ''}`}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>

              <button
                onClick={onSkip}
                className="text-center text-xs text-muted hover:text-text transition-colors py-1">
                Saltar
              </button>
            </>
          )}
        </div>
      </div>
    </>
  )
}
