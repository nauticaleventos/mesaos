import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Recipe } from '../../store/recipesStore'

interface Props {
  receta:       Recipe
  onBack:       () => void
  memberId?:    string
  memberRating?: number
  onRated?:     () => void
}

const DIFICULTAD_COLOR: Record<string, string> = {
  facil:   'bg-green-50 text-green-700 border-green-200',
  media:   'bg-yellow-50 text-yellow-700 border-yellow-200',
  dificil: 'bg-red-50 text-red-700 border-red-200',
}

export default function RecetaDetalle({ receta: r, onBack, memberId, memberRating, onRated }: Props) {
  return (
    <div className="min-h-screen pb-8 max-w-lg mx-auto">
      <div className="sticky top-0 bg-bg/95 backdrop-blur px-4 pt-6 pb-3 z-10">
        <button onClick={onBack}
          className="text-muted text-sm flex items-center gap-1 hover:text-text transition-colors">
          ← Volver
        </button>
      </div>

      <div className="px-4 flex flex-col gap-5">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-serif font-semibold text-text">{r.nombre}</h1>
          {r.descripcion_corta && <p className="text-muted text-sm mt-1">{r.descripcion_corta}</p>}

          <div className="flex flex-wrap gap-2 mt-3">
            {r.tiempo_total_min && <Chip>⏱ {r.tiempo_total_min} min</Chip>}
            {r.porciones && <Chip>👥 {r.porciones} porciones</Chip>}
            {r.dificultad && (
              <span className={`px-2 py-0.5 rounded-full border text-xs ${DIFICULTAD_COLOR[r.dificultad]}`}>
                {r.dificultad}
              </span>
            )}
            {r.costo_estimado && <Chip>💰 Costo {r.costo_estimado}</Chip>}
            {r.origen && <Chip>🌎 {r.origen}</Chip>}
          </div>
        </div>

        {/* Nutrición */}
        {r.info_nutricional_aprox && (
          <div className="card grid grid-cols-4 gap-2 text-center">
            <NutriItem label="Calorías" value={r.info_nutricional_aprox.calorias_porcion} unit="kcal" />
            <NutriItem label="Proteína" value={r.info_nutricional_aprox.proteina_g}       unit="g"    />
            <NutriItem label="Carbos"   value={r.info_nutricional_aprox.carbohidratos_g}  unit="g"    />
            <NutriItem label="Grasa"    value={r.info_nutricional_aprox.grasa_g}          unit="g"    />
          </div>
        )}

        {/* Ingredientes */}
        <div>
          <h2 className="font-semibold text-text mb-2">Ingredientes</h2>
          <div className="flex flex-col gap-1.5">
            {r.ingredientes.map((ing, i) => (
              <div key={i} className="flex items-center gap-2 py-1.5 border-b border-border last:border-0">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${ing.esencial ? 'bg-accent' : 'bg-border'}`} />
                <span className="text-text text-sm flex-1">{ing.nombre}</span>
                {ing.cantidad && (
                  <span className="text-muted text-xs">{ing.cantidad} {ing.unidad ?? ''}</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Pasos */}
        <div>
          <h2 className="font-semibold text-text mb-2">Preparación</h2>
          <div className="flex flex-col gap-3">
            {r.pasos.map((paso, i) => (
              <div key={i} className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-accent text-white text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <p className="text-text text-sm leading-relaxed">{paso}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Tags */}
        {r.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {r.tags.map(t => (
              <span key={t} className="px-2 py-0.5 bg-accent-light text-accent text-xs rounded-full">{t}</span>
            ))}
          </div>
        )}

        {/* Rating */}
        {memberId && (
          <RatingSection
            recipeId={r.id}
            memberId={memberId}
            initial={memberRating}
            onSaved={onRated}
          />
        )}
      </div>
    </div>
  )
}

// ── RatingSection ────────────────────────────────────────────────────────────
const STAR_LABELS = ['', 'No me gustó', 'Regular', 'Estuvo bien', 'Muy buena', '¡Deliciosa!']

function RatingSection({ recipeId, memberId, initial, onSaved }: {
  recipeId: string
  memberId: string
  initial?: number
  onSaved?: () => void
}) {
  const [stars,  setStars]  = useState(initial ?? 0)
  const [hover,  setHover]  = useState(0)
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)

  const save = async (rating: number) => {
    if (saving) return
    setSaving(true)
    await supabase.from('recipe_reactions').upsert({
      recipe_id: recipeId,
      member_id: memberId,
      reaction:  'like',
      rating,
    }, { onConflict: 'recipe_id,member_id' })
    setStars(rating)
    setSaving(false)
    setSaved(true)
    onSaved?.()
    setTimeout(() => setSaved(false), 2500)
  }

  const active = hover || stars

  return (
    <div className="card flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-text">Tu valoración</p>
        {saved && <p className="text-xs text-success">¡Guardada! ✓</p>}
      </div>

      <div className="flex gap-2">
        {[1,2,3,4,5].map(s => (
          <button
            key={s}
            onMouseEnter={() => setHover(s)}
            onMouseLeave={() => setHover(0)}
            onTouchStart={() => save(s)}
            onClick={() => save(s)}
            disabled={saving}
            className="text-4xl transition-transform hover:scale-110 active:scale-90 disabled:opacity-50">
            <span className={s <= active ? 'text-yellow-400' : 'text-gray-200'}>★</span>
          </button>
        ))}
      </div>

      <p className="text-xs text-muted min-h-4">
        {active > 0 ? STAR_LABELS[active] : 'Toca las estrellas para valorar'}
      </p>
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="px-2 py-0.5 bg-white border border-border text-muted text-xs rounded-full">
      {children}
    </span>
  )
}

function NutriItem({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-text font-semibold text-sm">{value}</p>
      <p className="text-muted text-xs">{unit}</p>
      <p className="text-muted text-xs">{label}</p>
    </div>
  )
}
