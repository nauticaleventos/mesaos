import { useState } from 'react'
import type { Recipe } from '../../store/recipesStore'
import type { FridgeItem } from '../../store/fridgeStore'
import RecipePlaceholder from './RecipePlaceholder'

interface Props {
  recipe:      Recipe
  fridgeItems: FridgeItem[]
  dragX?:      number
  dragY?:      number
  onStarTap?:  (stars: number) => void
  onDislike?:  () => void
  onBookmark?: () => void
  onLike?:     () => void
}

const DIFICULTAD_MAP = {
  facil:   { label: 'Fácil',   cls: 'bg-green-600/85' },
  media:   { label: 'Medio',   cls: 'bg-yellow-500/85' },
  dificil: { label: 'Difícil', cls: 'bg-red-600/85' },
} as const

const TIPO_ICONS: Record<string, string> = {
  desayuno: '☀️', almuerzo: '🍽️', cena: '🌙',
  snack: '🍎', postre: '🍰', brunch: '🥞',
}

function countMatches(recipe: Recipe, items: FridgeItem[]) {
  const names     = items.map(i => i.name.toLowerCase())
  const essential = recipe.ingredientes.filter(i => i.esencial)
  const have      = essential.filter(ing => {
    const n = ing.nombre.toLowerCase()
    return names.some(f => f.includes(n) || n.includes(f))
  }).length
  return { have, total: essential.length }
}

const STAR_LABELS = ['', 'No me gustó', 'Regular', 'Estuvo bien', 'Muy buena', '¡Deliciosa!']

export default function RecipeCard({ recipe, fridgeItems, dragX = 0, dragY = 0, onStarTap, onDislike, onBookmark, onLike }: Props) {
  const [imgLoaded, setImgLoaded]       = useState(false)
  const [imgError, setImgError]         = useState(false)
  const [selectedStars, setSelectedStars] = useState(0)
  const [poppingStar, setPoppingStar]   = useState<number | null>(null)

  const imgSrc = recipe.imagen_url ?? null
  const dif  = recipe.dificultad ? DIFICULTAD_MAP[recipe.dificultad] : null
  const nut  = recipe.info_nutricional_aprox
  const { have, total } = countMatches(recipe, fridgeItems)
  const tags = recipe.ingredientes.filter(i => i.esencial).slice(0, 4)
  const tipos = recipe.tipo_comida.slice(0, 2)
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
    <div className="card overflow-hidden p-0 w-full select-none shadow-lg flex flex-col">

      {/* ── Foto — 55% de la altura ── */}
      <div className="relative overflow-hidden" style={{ height: '52vw', maxHeight: '280px', minHeight: '180px' }}>
        {imgSrc && !imgError && (
          <img
            src={imgSrc}
            alt={recipe.nombre}
            className={`w-full h-full object-cover transition-opacity duration-500 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
          />
        )}
        {(!imgSrc || !imgLoaded || imgError) && (
          <RecipePlaceholder
            tipo={(recipe as Recipe & { tipo_componente?: string }).tipo_componente}
            nombre={recipe.nombre}
            showName
            className="absolute inset-0"
          />
        )}

        {/* Swipe overlays */}
        <div className={`absolute inset-0 bg-green-500/35 flex items-center justify-center transition-opacity pointer-events-none ${showLike ? 'opacity-100' : 'opacity-0'}`}>
          <span className="text-white text-2xl font-black border-[3px] border-white rounded-xl px-4 py-1.5 -rotate-12 drop-shadow-lg">ME GUSTA</span>
        </div>
        <div className={`absolute inset-0 bg-red-500/35 flex items-center justify-center transition-opacity pointer-events-none ${showDislike ? 'opacity-100' : 'opacity-0'}`}>
          <span className="text-white text-2xl font-black border-[3px] border-white rounded-xl px-4 py-1.5 rotate-12 drop-shadow-lg">PASO</span>
        </div>
        <div className={`absolute inset-0 bg-blue-500/35 flex items-center justify-center transition-opacity pointer-events-none ${showBookmark ? 'opacity-100' : 'opacity-0'}`}>
          <span className="text-white text-2xl font-black border-[3px] border-white rounded-xl px-4 py-1.5 drop-shadow-lg">GUARDAR</span>
        </div>

        {/* Badges */}
        {dif && (
          <div className={`absolute top-3 left-3 ${dif.cls} text-white text-xs font-semibold px-2.5 py-1 rounded-lg`}>
            {dif.label}
          </div>
        )}
        {recipe.tiempo_total_min && (
          <div className="absolute top-3 right-3 bg-black/55 text-white text-xs font-semibold px-2.5 py-1 rounded-lg">
            ⏱ {recipe.tiempo_total_min}min
          </div>
        )}
        {recipe.imagen_credito && imgLoaded && (
          <a href={recipe.imagen_credito.perfil_url} target="_blank" rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="absolute bottom-2 left-2 text-white/60 text-[9px] hover:text-white/90 transition-colors"
            style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>
            📷 {recipe.imagen_credito.fotografo}
          </a>
        )}
        {total > 0 && (
          <div className="absolute bottom-2 right-2 bg-black/50 text-white text-[10px] px-2 py-0.5 rounded-full">
            {have >= total ? '✅' : have > 0 ? '🟡' : '🛒'} {have}/{total}
          </div>
        )}
      </div>

      {/* ── Contenido ── */}
      <div className="px-4 pt-3 pb-2 flex flex-col gap-2.5">

        {/* Nombre + origen */}
        <div>
          <p className="font-serif text-xl font-semibold text-text leading-tight">{recipe.nombre}</p>
          <p className="text-muted text-xs mt-0.5">
            {[recipe.origen && `🌎 ${recipe.origen}`, tipos].filter(Boolean).join(' · ')}
          </p>
        </div>

        {/* Descripción */}
        {recipe.descripcion_corta && (
          <p className="text-muted text-sm leading-snug line-clamp-2">{recipe.descripcion_corta}</p>
        )}

        {/* Tags ingredientes */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((ing, i) => (
              <span key={i} className="px-2.5 py-0.5 text-xs rounded-full font-medium"
                style={{ background: 'rgba(231,111,81,0.1)', color: '#B84E33' }}>
                {ing.nombre}
              </span>
            ))}
          </div>
        )}

        {/* Macros */}
        {nut && (
          <div className="flex items-end justify-between">
            <div>
              <span className="text-2xl font-bold text-text">{nut.calorias_porcion}</span>
              <span className="text-xs text-muted ml-1">kcal</span>
            </div>
            <div className="flex gap-4 text-center">
              <Macro label="Prot"  value={nut.proteina_g}      color="#3B82F6" />
              <Macro label="Carbs" value={nut.carbohidratos_g} color="#CA8A04" />
              <Macro label="Grasa" value={nut.grasa_g}         color="#EF4444" />
            </div>
          </div>
        )}
      </div>

      {/* ── Separador + Estrellas ── */}
      <div className="px-4 pt-1 pb-3 border-t border-border/60 flex flex-col gap-2">
        <p className="text-xs text-muted text-center mt-2">
          {selectedStars > 0 ? STAR_LABELS[selectedStars] : 'Toca para puntuar si ya la probaste'}
        </p>
        <div className="flex justify-center gap-2">
          {[1,2,3,4,5].map(s => (
            <button key={s}
              onMouseDown={e => handleStarInteract(e, s)}
              onTouchStart={e => handleStarInteract(e, s)}
              style={{
                transform:  poppingStar === s ? 'scale(1.4)' : 'scale(1)',
                transition: 'transform 0.15s ease-out',
                color:      s <= selectedStars ? '#EF9F27' : '#D1D5DB',
                fontSize:   '2rem',
                lineHeight: 1,
                background: 'transparent',
                border:     'none',
                cursor:     'pointer',
                padding:    '2px',
              }}>
              ★
            </button>
          ))}
        </div>
      </div>

      {/* ── 3 botones de acción ── */}
      <div className="px-5 pb-5 flex items-center justify-center gap-8">
        {/* X — no me gusta */}
        <ActionBtn color="#B84E33" onClick={onDislike} label="✕" />
        {/* Bookmark — guardar */}
        <ActionBtn color="#5C8AA8" onClick={onBookmark} label="📑" />
        {/* Corazón — me gusta */}
        <ActionBtn color="#6B7F39" onClick={onLike} label="♥" />
      </div>
    </div>
  )
}

function Macro({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-sm font-semibold" style={{ color }}>{value}g</span>
      <span className="text-[10px] text-muted">{label}</span>
    </div>
  )
}

function ActionBtn({ color, onClick, label }: { color: string; onClick?: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); onClick?.() }}
      style={{
        width:           '56px',
        height:          '56px',
        borderRadius:    '50%',
        background:      color,
        border:          'none',
        cursor:          'pointer',
        fontSize:        '22px',
        color:           'white',
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        boxShadow:       '0 4px 12px rgba(0,0,0,0.18)',
        flexShrink:      0,
        transition:      'transform 0.12s ease',
      }}
      onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.9)' }}
      onMouseUp={e   => { e.currentTarget.style.transform = 'scale(1)' }}
      onTouchStart={e => { e.currentTarget.style.transform = 'scale(0.9)' }}
      onTouchEnd={e   => { e.currentTarget.style.transform = 'scale(1)' }}
    >
      {label}
    </button>
  )
}
