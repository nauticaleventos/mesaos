import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, SkipForward, Clock, ChefHat, ExternalLink } from 'lucide-react'
import { useMenuStore, type EnrichedMenuEntry } from '../../store/menuStore'
import { useFamilyStore } from '../../store/familyStore'
import type { FamilyMember } from '../../lib/types'
import { DAY_NAMES_FULL } from '../../lib/motorMenu'

interface Props {
  dayOfWeek:   number   // 1-7
  date:        Date
  entries:     EnrichedMenuEntry[]  // solo is_main_recipe=true
  altEntries:  EnrichedMenuEntry[]  // is_main_recipe=false (alternativas)
}

const MEAL_LABELS: Record<string, string> = {
  desayuno: '☀️ Desayuno',
  almuerzo: '🍽️ Almuerzo',
  cena:     '🌙 Cena',
  snack:    '🍎 Snack',
}
const MEAL_ORDER = ['desayuno', 'almuerzo', 'cena', 'snack']

const DIFICULTAD_COLOR: Record<string, string> = {
  facil:   'bg-green-100 text-green-700',
  media:   'bg-yellow-100 text-yellow-700',
  dificil: 'bg-red-100 text-red-700',
}

export default function DiaCard({ dayOfWeek, date, entries, altEntries }: Props) {
  const { marcarCocinada, saltarReceta } = useMenuStore()
  const members = useFamilyStore(s => s.members)

  const isHoy = new Date().toDateString() === date.toDateString()
  const fechaStr = date.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })

  // Agrupar por meal_type en orden
  const porTipo = MEAL_ORDER
    .map(tipo => ({ tipo, entry: entries.find(e => e.meal_type === tipo) }))
    .filter(({ entry }) => !!entry)

  if (porTipo.length === 0) return null

  return (
    <div className={`card flex flex-col gap-4 ${isHoy ? 'border-accent' : ''}`}>
      {/* Header del día */}
      <div className="flex items-center justify-between">
        <div>
          <p className={`font-semibold ${isHoy ? 'text-accent' : 'text-text'}`}>
            {DAY_NAMES_FULL[dayOfWeek]}
            {isHoy && <span className="ml-2 text-xs bg-accent text-white px-2 py-0.5 rounded-full">Hoy</span>}
          </p>
          <p className="text-xs text-muted">{fechaStr}</p>
        </div>
      </div>

      {/* Comidas del día */}
      {porTipo.map(({ tipo, entry }) => {
        if (!entry) return null
        const alts = altEntries.filter(a => a.meal_type === tipo)

        return (
          <RecetaSlot
            key={tipo}
            tipo={tipo}
            entry={entry}
            alts={alts}
            members={members}
            onCocinada={() => marcarCocinada(entry.id)}
            onSaltar={() => saltarReceta(entry.id)}
          />
        )
      })}
    </div>
  )
}

function RecetaSlot({ tipo, entry, alts, members, onCocinada, onSaltar }: {
  tipo:       string
  entry:      EnrichedMenuEntry
  alts:       EnrichedMenuEntry[]
  members:    FamilyMember[]
  onCocinada: () => void
  onSaltar:   () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const navigate = useNavigate()
  const r = entry.recipe
  const isCooked  = entry.status === 'cooked'
  const isSkipped = entry.status === 'skipped'

  return (
    <div className={`rounded-xl overflow-hidden border transition-all
      ${isCooked  ? 'border-oliva/40 bg-oliva-claro/30 opacity-75' : ''}
      ${isSkipped ? 'border-border opacity-40' : ''}
      ${!isCooked && !isSkipped ? 'border-border bg-white' : ''}`}>

      {/* Cabecera del slot */}
      <button type="button" onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 p-3 text-left">

        {/* Foto */}
        <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-accent-light">
          {r.imagen_url ? (
            <img src={r.imagen_url} alt={r.nombre} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ChefHat size={24} color="#E76F51" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted font-medium">{MEAL_LABELS[tipo]}</p>
          <p className="font-semibold text-text text-sm leading-tight mt-0.5 truncate">
            {isSkipped ? <s>{r.nombre}</s> : r.nombre}
          </p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {r.tiempo_total_min && (
              <span className="flex items-center gap-1 text-xs text-muted">
                <Clock size={11} />{r.tiempo_total_min}min
              </span>
            )}
            {r.dificultad && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${DIFICULTAD_COLOR[r.dificultad]}`}>
                {r.dificultad}
              </span>
            )}
            {isCooked && <span className="text-xs text-oliva font-medium">✓ Cocinada</span>}
          </div>
        </div>

        <span className="text-muted text-xs">{expanded ? '▲' : '▼'}</span>
      </button>

      {/* Alternativas */}
      {alts.length > 0 && (
        <div className="px-3 pb-2 -mt-1">
          {alts.map(alt => {
            const m = members.find((mb: FamilyMember) => mb.id === alt.member_id)
            return (
              <p key={alt.id} className="text-xs text-muted">
                {m?.emoji} <strong>{m?.name}</strong>: {alt.recipe.nombre}
              </p>
            )
          })}
        </div>
      )}

      {/* Acciones expandidas */}
      {expanded && !isSkipped && (
        <div className="border-t border-border flex flex-col">
          {/* Ver receta completa */}
          <button onClick={() => navigate(`/receta/${entry.recipe_id}`)}
            className="flex items-center justify-center gap-1.5 py-2.5 text-sm text-accent font-medium hover:bg-accent/5 transition-colors border-b border-border">
            <ExternalLink size={14} /> Ver receta completa
          </button>
          <div className="flex">
          {!isCooked && (
            <button onClick={onCocinada}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm text-oliva font-medium hover:bg-oliva-claro/40 transition-colors">
              <Check size={15} /> La cociné
            </button>
          )}
          {!isCooked && (
            <button onClick={onSaltar}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm text-muted hover:bg-gray-50 transition-colors border-l border-border">
              <SkipForward size={15} /> Saltar
            </button>
          )}
          </div>
        </div>
      )}
    </div>
  )
}
