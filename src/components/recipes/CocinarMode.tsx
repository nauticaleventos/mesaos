import { useState } from 'react'
import type { Recipe } from '../../store/recipesStore'

interface Props {
  recipe:     Recipe
  onClose:    () => void
  onFinished: (rating: number) => void
}

const STAR_LABELS = ['', 'No me quedó bien', 'Regular', 'Bien 👌', 'Muy buena 😋', '¡Perfecta! 🤩']

export default function CocinarMode({ recipe, onClose, onFinished }: Props) {
  const [step, setStep]             = useState(0)
  const [showRating, setShowRating] = useState(false)
  const [stars, setStars]           = useState(0)
  const [hover, setHover]           = useState(0)

  const total  = recipe.pasos.length
  const isLast = step === total - 1
  const pct    = Math.round(((step + 1) / total) * 100)

  const goNext = () => {
    if (isLast) setShowRating(true)
    else setStep(s => s + 1)
  }

  const goPrev = () => {
    if (step > 0) setStep(s => s - 1)
  }

  const handleFinish = () => {
    if (stars > 0) onFinished(stars)
    else onClose()
  }

  return (
    <div className="fixed inset-0 bg-bg z-50 flex flex-col max-w-lg mx-auto">

      {/* Rating final */}
      {showRating ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-8 text-center">
          <span className="text-6xl">🍳</span>
          <div>
            <p className="text-2xl font-serif font-semibold text-text">¡Lo lograste!</p>
            <p className="text-muted text-sm mt-1">{recipe.nombre}</p>
          </div>

          <div>
            <p className="text-sm font-medium text-text mb-4">¿Cómo te quedó?</p>
            <div className="flex gap-3 justify-center">
              {[1,2,3,4,5].map(s => (
                <button
                  key={s}
                  onMouseEnter={() => setHover(s)}
                  onMouseLeave={() => setHover(0)}
                  onClick={() => setStars(s)}
                  style={{ fontSize: '2.5rem', transition: 'transform 0.15s ease', transform: stars === s || hover === s ? 'scale(1.25)' : 'scale(1)' }}>
                  <span style={{ color: s <= (hover || stars) ? '#EF9F27' : '#E5E7EB' }}>★</span>
                </button>
              ))}
            </div>
            {(hover || stars) > 0 && (
              <p className="text-muted text-sm mt-3">{STAR_LABELS[hover || stars]}</p>
            )}
          </div>

          <button
            onClick={handleFinish}
            className={`btn-primary w-full max-w-xs ${stars === 0 ? 'opacity-40' : ''}`}>
            {stars > 0 ? 'Guardar y terminar' : 'Terminar sin valorar'}
          </button>
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-6 pb-3">
            <button onClick={onClose} className="text-muted hover:text-text transition-colors text-2xl leading-none">
              ✕
            </button>
            <span className="text-sm text-muted font-medium">Paso {step + 1} de {total}</span>
            <div className="w-8" />
          </div>

          {/* Barra de progreso */}
          <div className="px-5 mb-2">
            <div className="w-full bg-border rounded-full h-1.5">
              <div className="bg-accent h-1.5 rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
            </div>
          </div>

          {/* Paso actual */}
          <div className="flex-1 flex flex-col items-center justify-center px-8 gap-6">
            <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center shadow-lg">
              <span className="text-white text-2xl font-bold">{step + 1}</span>
            </div>
            <p className="text-text text-xl leading-relaxed text-center font-medium">
              {recipe.pasos[step]}
            </p>
          </div>

          {/* Navegación */}
          <div className="flex gap-3 px-5 pb-8 pt-4">
            <button
              onClick={goPrev}
              disabled={step === 0}
              className="flex-1 py-3.5 rounded-xl border border-border text-text font-semibold text-sm disabled:opacity-30 hover:bg-gray-50 transition-all active:scale-95">
              ← Anterior
            </button>
            <button
              onClick={goNext}
              className="flex-1 py-3.5 rounded-xl bg-accent text-white font-semibold text-sm hover:bg-accent-hover transition-all active:scale-95 shadow-sm">
              {isLast ? '¡Listo! →' : 'Siguiente →'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
