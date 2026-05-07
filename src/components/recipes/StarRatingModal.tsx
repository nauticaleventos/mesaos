import { useState } from 'react'
import type { Recipe } from '../../store/recipesStore'

interface Props {
  recipe:     Recipe
  onRate:     (rating: number) => void
  onNotTried: () => void
  onClose:    () => void
}

const STAR_LABELS = ['', 'No me gustó', 'Regular', 'Estuvo bien', 'Muy buena', '¡Deliciosa!']

export default function StarRatingModal({ recipe, onRate, onNotTried, onClose }: Props) {
  const [step,  setStep]  = useState<'ask' | 'rate'>('ask')
  const [stars, setStars] = useState(0)
  const [hover, setHover] = useState(0)

  const active = hover || stars

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 px-4 pb-8"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="card w-full max-w-sm flex flex-col gap-5">

        {step === 'ask' ? (
          <>
            <div className="text-center pt-1">
              <p className="text-xs text-muted uppercase tracking-wider mb-1">¿Ya la has probado?</p>
              <p className="font-serif text-xl font-semibold text-text">{recipe.nombre}</p>
            </div>

            <div className="flex flex-col gap-2">
              <button onClick={() => setStep('rate')} className="btn-primary">
                Sí, la he probado 👨‍🍳
              </button>
              <button onClick={onNotTried} className="btn-ghost">
                Todavía no → guardar para probar 🔖
              </button>
            </div>

            <button
              onClick={onClose}
              className="text-muted text-xs text-center hover:text-text transition-colors py-1">
              Cancelar
            </button>
          </>
        ) : (
          <>
            <div className="text-center pt-1">
              <p className="text-xs text-muted uppercase tracking-wider mb-1">¿Cuánto te gustó?</p>
              <p className="font-serif text-xl font-semibold text-text">{recipe.nombre}</p>
            </div>

            {/* Stars */}
            <div className="flex justify-center gap-2">
              {[1,2,3,4,5].map(s => (
                <button
                  key={s}
                  onMouseEnter={() => setHover(s)}
                  onMouseLeave={() => setHover(0)}
                  onTouchStart={() => setStars(s)}
                  onClick={() => setStars(s)}
                  className="text-4xl transition-transform active:scale-90 hover:scale-110">
                  <span className={s <= active ? 'text-yellow-400' : 'text-gray-200'}>★</span>
                </button>
              ))}
            </div>

            {active > 0 && (
              <p className="text-center text-muted text-sm -mt-2 min-h-5">
                {STAR_LABELS[active]}
              </p>
            )}

            <button
              onClick={() => stars > 0 && onRate(stars)}
              disabled={stars === 0}
              className={`btn-primary transition-opacity ${stars === 0 ? 'opacity-40 cursor-not-allowed' : ''}`}>
              Guardar valoración ⭐
            </button>

            <button
              onClick={() => setStep('ask')}
              className="text-muted text-xs text-center hover:text-text transition-colors py-1">
              ← Volver
            </button>
          </>
        )}
      </div>
    </div>
  )
}
