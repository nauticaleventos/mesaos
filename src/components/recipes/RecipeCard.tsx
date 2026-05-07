import { useState } from 'react'
import type { Recipe } from '../../store/recipesStore'
import type { FridgeItem } from '../../store/fridgeStore'

interface Props {
  recipe:      Recipe
  fridgeItems: FridgeItem[]
  dragX?:      number
  dragY?:      number
  onStarTap?:  (stars: number) => void
}

const TIPO_ICONS: Record<string, string> = {
  desayuno: '☀️', almuerzo: '🍽️', cena: '🌙',
  snack: '🍎', postre: '🍰', brunch: '🥞',
}

const DIFICULTAD_MAP = {
  facil:   { label: 'Fácil',   icon: '⚡', cls: 'bg-green-600/80' },
  media:   { label: 'Medio',   icon: '🔥', cls: 'bg-yellow-500/80' },
  dificil: { label: 'Difícil', icon: '💪', cls: 'bg-red-600/80' },
} as const

function countMatches(recipe: Recipe, items: FridgeItem[]) {
  const names     = items.map(i => i.name.toLowerCase())
  const essential = recipe.ingredientes.filter(i => i.esencial)
  const have      = essential.filter(ing => {
    const n = ing.nombre.toLowerCase()
    return names.some(f => f.includes(n) || n.includes(f))
  }).length
  return { have, total: essential.length }
}

export default function RecipeCard({ recipe, fridgeItems, dragX = 0, dragY = 0, onStarTap }: Props) {
  const [imgLoaded, setImgLoaded]       = useState(false)
  const [imgError, setImgError]         = useState(false)
  const [selectedStars, setSelectedStars] = useState(0)
  const [poppingStar, setPoppingStar]   = useState<number | null>(null)

  const imgSrc = recipe.imagen_url
    ?? `https://source.unsplash.com/featured/800x400/?${encodeURIComponent(recipe.nombre.split(' ').slice(0,3).join(' ') + ' food')}`
  const dif    = recipe.dificultad ? DIFICULTAD_MAP[recipe.dificultad] : null
  const nut    = recipe.info_nutricional_aprox
  const { have, total } = countMatches(recipe, fridgeItems)
  const tags   = recipe.ingredientes.filter(i => i.esencial).slice(0, 4)
  const tipos  = recipe.tipo_comida.slice(0, 2)
    .map(t => `${TIPO_ICONS[t] ?? ''} ${t.charAt(0).toUpperCase() + t.slice(1)}`)
    .join(' · ')

  const showLike     = dragX > 40
  const showDislike  = dragX < -40
  const showBookmark = dragY < -40

  const handleStarInteract = (e: React.MouseEvent | React.TouchEvent, n: number) => {
    e.stopPropagation()
    e.preventDefault()
    setSelectedStars(n)
    setPoppingStar(n)
    setTimeout(() => setPoppingStar(null), 150)
    onStarTap?.(n)
  }

  return (
    <div className="card overflow-hidden p-0 w-full select-none shadow-lg">

      {/* 1. Nombre + 2. Origen/tipo */}
      <div className="px-4 pt-4 pb-3">
        <p className="font-serif text-xl font-medium text-text leading-tight">{recipe.nombre}</p>
        <p className="text-muted text-xs mt-1">
          {[recipe.origen && `🌎 ${recipe.origen}`, tipos].filter(Boolean).join(' · ')}
        </p>
      </div>

      {/* 3. Foto */}
      <div className="relative h-44 bg-accent-light overflow-hidden">
        {!imgError && (
          <img
            src={imgSrc}
            alt={recipe.nombre}
            className={`w-full h-full object-cover transition-opacity duration-500 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
          />
        )}
        {(!imgLoaded || imgError) && (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-accent-light to-accent/40">
            <span className="text-6xl">{TIPO_ICONS[recipe.tipo_comida[0]] ?? '🍽️'}</span>
          </div>
        )}

        {/* Swipe overlays */}
        <div className={`absolute inset-0 bg-green-500/30 flex items-center justify-center transition-opacity duration-100 pointer-events-none ${showLike ? 'opacity-100' : 'opacity-0'}`}>
          <span className="text-white text-xl font-black border-[3px] border-white rounded-xl px-3 py-1 -rotate-12 drop-shadow-lg">ME GUSTA</span>
        </div>
        <div className={`absolute inset-0 bg-red-500/30 flex items-center justify-center transition-opacity duration-100 pointer-events-none ${showDislike ? 'opacity-100' : 'opacity-0'}`}>
          <span className="text-white text-xl font-black border-[3px] border-white rounded-xl px-3 py-1 rotate-12 drop-shadow-lg">PASO</span>
        </div>
        <div className={`absolute inset-0 bg-blue-500/30 flex items-center justify-center transition-opacity duration-100 pointer-events-none ${showBookmark ? 'opacity-100' : 'opacity-0'}`}>
          <span className="text-white text-xl font-black border-[3px] border-white rounded-xl px-3 py-1 drop-shadow-lg">🔖 GUARDAR</span>
        </div>

        {/* Badges */}
        {dif && (
          <div className={`absolute top-2 left-2 ${dif.cls} text-white text-xs font-semibold px-2 py-1 rounded-lg`}>
            {dif.icon} {dif.label}
          </div>
        )}
        {recipe.tiempo_total_min && (
          <div className="absolute top-2 right-2 bg-black/50 text-white text-xs font-semibold px-2 py-1 rounded-lg">
            ⏱ {recipe.tiempo_total_min}min
          </div>
        )}
        {recipe.is_base_recipe && (
          <div className="absolute bottom-2 right-2 bg-accent/90 text-white text-xs px-2 py-0.5 rounded-full">
            base
          </div>
        )}

        {/* Crédito Unsplash (requerido por sus términos) */}
        {recipe.imagen_credito && imgLoaded && (
          <a
            href={recipe.imagen_credito.perfil_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="absolute bottom-2 left-2 text-white/60 text-[9px] hover:text-white/90 transition-colors"
            style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>
            📷 {recipe.imagen_credito.fotografo}
          </a>
        )}
      </div>

      {/* 4–7. Contenido */}
      <div className="px-4 py-3 flex flex-col gap-3">

        {/* 4. Descripción */}
        {recipe.descripcion_corta && (
          <p className="text-muted text-sm leading-snug">{recipe.descripcion_corta}</p>
        )}

        {/* 5. Tags ingredientes */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((ing, i) => (
              <span key={i} className="px-2.5 py-0.5 bg-accent-light text-accent text-xs rounded-full font-medium">
                {ing.nombre}
              </span>
            ))}
          </div>
        )}

        {/* 6. Macros */}
        {nut && (
          <div className="flex items-end justify-between">
            <div>
              <span className="text-3xl font-bold text-text">{nut.calorias_porcion}</span>
              <span className="text-sm text-muted ml-1">kcal</span>
            </div>
            <div className="flex gap-4 text-center pb-0.5">
              <Macro label="Prot"  value={nut.proteina_g}      color="text-blue-600" />
              <Macro label="Carbs" value={nut.carbohidratos_g} color="text-yellow-600" />
              <Macro label="Grasa" value={nut.grasa_g}         color="text-red-500" />
            </div>
          </div>
        )}

        {/* 7. Rating community + fridge match */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <div className="flex gap-0.5 text-sm">
              {[1,2,3,4,5].map(s => (
                <span key={s} className={s <= Math.round(recipe.rating_promedio ?? 0) ? 'text-yellow-400' : 'text-gray-200'}>★</span>
              ))}
            </div>
            <span className="text-xs text-muted">
              {recipe.rating_promedio ? recipe.rating_promedio.toFixed(1) : 'Sin valoraciones'}
            </span>
          </div>
          {total > 0 && (
            <span className="text-xs text-muted whitespace-nowrap">
              {have >= total ? '✅' : have > 0 ? '🟡' : '🛒'} {have}/{total} ingredientes
            </span>
          )}
        </div>

        {/* Separador */}
        <div className="border-t border-border pt-3">
          {/* Texto guía */}
          <p className="text-xs text-muted text-center mb-2.5">
            Toca para puntuar si ya la probaste
          </p>

          {/* 5 estrellas tappables */}
          <div className="flex justify-center gap-3">
            {[1,2,3,4,5].map(s => (
              <button
                key={s}
                onMouseDown={e => handleStarInteract(e, s)}
                onTouchStart={e => handleStarInteract(e, s)}
                style={{
                  transform:  poppingStar === s ? 'scale(1.35)' : 'scale(1)',
                  transition: 'transform 0.15s ease-out',
                  color:      s <= selectedStars ? '#EF9F27' : '#E5E7EB',
                  fontSize:   '2rem',
                  lineHeight: 1,
                }}
                className="leading-none">
                ★
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function Macro({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className={`text-sm font-semibold ${color}`}>{value}g</span>
      <span className="text-[10px] text-muted">{label}</span>
    </div>
  )
}
