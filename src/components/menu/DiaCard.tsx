import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, SkipForward, Clock, ChefHat, ExternalLink, RefreshCw, RotateCcw } from 'lucide-react'
import { useMenuStore, type EnrichedMenuEntry } from '../../store/menuStore'
import { useFamilyStore } from '../../store/familyStore'
import { useFridgeStore } from '../../store/fridgeStore'
import type { FamilyMember } from '../../lib/types'
import type { Leftover } from '../../store/leftoversStore'
import { DAY_NAMES_FULL } from '../../lib/motorMenu'
import { calcularMatch, matchBadge } from '../../lib/matchReceta'
import CambiarSheet from './CambiarSheet'

interface Props {
  dayOfWeek:      number
  date:           Date
  entries:        EnrichedMenuEntry[]
  leftovers?:     Leftover[]
  onAddSobrante?: () => void
}

const MEAL_LABELS: Record<string, string> = {
  desayuno: '☀️ Desayuno',
  almuerzo: '🍽️ Almuerzo',
  cena:     '🌙 Cena',
  snack:    '🍿 Snack',
}
const MEAL_ORDER = ['desayuno', 'almuerzo', 'cena', 'snack']

const COMPONENT_EMOJI: Record<string, string> = {
  proteina:     '🍖',
  guarnicion:   '🍚',
  carbohidrato: '🍚',
  ensalada:     '🥗',
  completo:     '🍽️',
}

const DIFICULTAD_COLOR: Record<string, string> = {
  facil:   'bg-green-100 text-green-700',
  media:   'bg-yellow-100 text-yellow-700',
  dificil: 'bg-red-100 text-red-700',
}

export default function DiaCard({ dayOfWeek, date, entries, leftovers = [], onAddSobrante }: Props) {
  const { marcarCocinada, saltarReceta, restaurarReceta } = useMenuStore()
  const members  = useFamilyStore(s => s.members)
  const isHoy    = new Date().toDateString() === date.toDateString()
  const fechaStr = date.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })

  const porTipo = MEAL_ORDER
    .map(tipo => ({ tipo, components: entries.filter(e => e.meal_type === tipo) }))
    .filter(({ components }) => components.length > 0)

  if (porTipo.length === 0) return null

  return (
    <div className={`card flex flex-col gap-0 overflow-hidden ${isHoy ? 'border-accent' : ''}`}>
      {/* Cabecera del día */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div>
          <p className={`font-bold text-base ${isHoy ? 'text-accent' : 'text-text'}`}>
            {DAY_NAMES_FULL[dayOfWeek]}
            {isHoy && <span className="ml-2 text-[11px] bg-accent text-white px-2 py-0.5 rounded-full font-medium">Hoy</span>}
          </p>
          <p className="text-xs text-muted">{fechaStr}</p>
        </div>
      </div>

      {/* Comidas */}
      {porTipo.map(({ tipo, components }, idx) => (
        <MealSection
          key={tipo}
          tipo={tipo}
          components={components}
          members={members}
          leftovers={tipo === 'almuerzo' || tipo === 'cena' ? leftovers : []}
          onAddSobrante={onAddSobrante}
          onCocinada={() => {
            const main = components.find(e => e.is_main_recipe && e.member_id === null) ?? components[0]
            if (main) marcarCocinada(main.id)
          }}
          onSaltar={() => {
            const main = components.find(e => e.is_main_recipe && e.member_id === null) ?? components[0]
            if (main) saltarReceta(main.id)
          }}
          onRestaurar={() => {
            const main = components.find(e => e.is_main_recipe && e.member_id === null) ?? components[0]
            if (main) restaurarReceta(main.id)
          }}
          isLast={idx === porTipo.length - 1}
        />
      ))}
    </div>
  )
}

function MealSection({ tipo, components, members, leftovers, onAddSobrante, onCocinada, onSaltar, onRestaurar, isLast }: {
  tipo:           string
  components:     EnrichedMenuEntry[]
  members:        FamilyMember[]
  leftovers:      Leftover[]
  onAddSobrante?: () => void
  onCocinada:     () => void
  onSaltar:       () => void
  onRestaurar:    () => void
  isLast:         boolean
}) {
  const navigate         = useNavigate()
  const fridgeItems      = useFridgeStore(s => s.items)
  const [expanded, setExpanded] = useState(false)
  const [showCambiar, setShowCambiar] = useState(false)

  const main    = components.find(e => e.is_main_recipe && e.member_id === null) ?? components[0]
  if (!main) return null

  const isCooked  = main.status === 'cooked'
  const isSkipped = main.status === 'skipped'

  // Separar componentes: ignorar salsas/vinagretas (van implícitas en la proteína)
  const familyComponents = components.filter(e =>
    e.member_id === null &&
    e.meal_component !== 'salsa' &&
    e.meal_component !== 'vinagreta'
  )
  const altComponents = components.filter(e => e.member_id !== null)

  // IDs de miembros con alternativa
  const altMemberIds = new Set(altComponents.map(a => a.member_id!))

  // Miembros sin alternativa = comen el plato familiar
  const membersFamilia = members.filter(m => !altMemberIds.has(m.id!))

  // Footnotes: miembros con alternativa
  const altProteins = altComponents.filter(a => a.is_main_recipe)

  const hasSalad   = components.some(c => c.meal_component === 'ensalada')
  const hasProtein = components.some(c => c.meal_component === 'proteina' || c.meal_component === 'completo')
  const hasOnlySides = !hasProtein && components.some(c =>
    c.meal_component === 'ensalada' || c.meal_component === 'guarnicion'
  )

  return (
    <div className={`${!isLast ? 'border-b border-border/60' : ''}`}>
      {/* Encabezado de comida */}
      <div className="px-4 pt-3 pb-1">
        <p className={`text-xs font-bold uppercase tracking-widest ${isCooked ? 'text-muted' : 'text-accent'}`}>
          {MEAL_LABELS[tipo]}
        </p>
        <div className="h-px bg-border/50 mt-1.5" />
      </div>

      {/* Filas de componentes */}
      <div className={`flex flex-col gap-0 px-4 pb-2 ${isCooked ? 'opacity-60' : ''} ${isSkipped ? 'opacity-40' : ''}`}>
        {familyComponents.map((comp) => {
          const isMain = comp.is_main_recipe
          const r    = comp.recipe
          const cm   = calcularMatch(r.ingredientes ?? [], fridgeItems)
          const badge = matchBadge(cm.estado)
          const emoji = COMPONENT_EMOJI[comp.meal_component] ?? '•'
          const isSimple = tipo === 'desayuno' || tipo === 'snack'

          // Para desayuno/snack: no mostrar emoji de componente
          return (
            <button key={comp.id}
              onClick={() => navigate(`/receta/${comp.recipe_id}`)}
              className="flex items-start gap-2.5 py-2.5 text-left hover:opacity-80 transition-opacity border-b border-border/30 last:border-0">

              {/* Emoji componente (solo almuerzo/cena) */}
              {!isSimple && (
                <span className="text-base leading-none mt-0.5 w-5 flex-shrink-0">{emoji}</span>
              )}

              {/* Imagen solo en desayuno/snack (plato principal) */}
              {isSimple && (
                <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-accent-light">
                  {r.imagen_url
                    ? <img src={r.imagen_url} alt={r.nombre} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center"><ChefHat size={16} color="#E76F51" /></div>
                  }
                </div>
              )}

              <div className="flex-1 min-w-0">
                {/* Nombre */}
                <p className={`text-sm leading-snug ${isMain ? 'font-semibold text-text' : 'font-medium text-text/90'}`}>
                  {isSkipped ? <s>{r.nombre}</s> : r.nombre}
                </p>

                {/* Metadata */}
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {isMain && r.tiempo_total_min && (
                    <span className="flex items-center gap-0.5 text-xs text-muted">
                      <Clock size={10} />{r.tiempo_total_min}min
                    </span>
                  )}
                  {isMain && r.dificultad && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${DIFICULTAD_COLOR[r.dificultad]}`}>
                      {r.dificultad}
                    </span>
                  )}
                  {!isCooked && !isSkipped && (
                    <span className={`text-[10px] font-medium ${badge.color}`}>{badge.icon}</span>
                  )}
                </div>

                {/* Miembros que comen este componente */}
                {isMain && membersFamilia.length > 0 && (
                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                    {membersFamilia.length > 3
                      ? <span className="text-xs text-muted">Familia ({membersFamilia.length})</span>
                      : membersFamilia.map(m => (
                          <span key={m.id} title={m.name ?? ''} className="text-sm leading-none">{m.emoji}</span>
                        ))
                    }
                    {/* Footnote si hay alternativas */}
                    {altProteins.length > 0 && isMain && (
                      <span className="text-[10px] text-muted ml-1">
                        {altProteins.map(a => {
                          const m = members.find(mb => mb.id === a.member_id)
                          return m ? <span key={a.id}>{m.emoji}¹</span> : null
                        })}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <ExternalLink size={12} className="text-muted flex-shrink-0 mt-1" />
            </button>
          )
        })}

        {/* Notas al pie — alternativas por miembro */}
        {altProteins.length > 0 && (
          <div className="flex flex-col gap-1 pt-1 pl-7">
            {altProteins.map(alt => {
              const m = members.find(mb => mb.id === alt.member_id)
              if (!m) return null
              return (
                <button key={alt.id}
                  onClick={() => navigate(`/receta/${alt.recipe_id}`)}
                  className="flex items-center gap-2 text-left hover:opacity-80 transition-opacity">
                  <span className="text-sm">{m.emoji}</span>
                  <span className="text-xs text-muted">
                    <span className="text-muted">¹</span> {m.name}:
                  </span>
                  <span className="text-xs text-text font-medium truncate">{alt.recipe.nombre}</span>
                  <ExternalLink size={10} className="text-muted flex-shrink-0" />
                </button>
              )
            })}
          </div>
        )}

        {/* Sobrantes */}
        {leftovers.length > 0 && hasSalad && (
          <div className="flex flex-wrap gap-1.5 pt-1 pl-7">
            {leftovers.map(l => (
              <span key={l.id}
                className="px-2 py-1 rounded-full bg-oliva/10 border border-oliva/20 text-xs text-oliva font-medium">
                🍗 {l.ingredient_name}{l.quantity ? ` · ${l.quantity}` : ''}
              </span>
            ))}
          </div>
        )}

        {/* Botón agregar proteína */}
        {!isSkipped && hasOnlySides && (
          <button onClick={onAddSobrante}
            className="flex items-center gap-1.5 pt-1 pl-7 text-xs text-accent font-medium hover:opacity-70">
            + Agregar proteína
          </button>
        )}
      </div>

      {/* Acciones */}
      {!expanded ? (
        <button onClick={() => setExpanded(true)}
          className="w-full px-4 py-2 text-xs text-muted text-center hover:text-text transition-colors">
          ···
        </button>
      ) : (
        <div className="border-t border-border flex">
          <button onClick={() => navigate(`/receta/${main.recipe_id}`)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs text-accent font-medium hover:bg-accent/5 transition-colors border-r border-border">
            <ExternalLink size={12} /> Ver receta
          </button>

          {isSkipped ? (
            <>
              <button onClick={() => { onRestaurar(); setExpanded(false) }}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs text-oliva font-medium hover:bg-oliva-claro/40 transition-colors border-r border-border">
                <RotateCcw size={12} /> Restaurar
              </button>
              <button onClick={() => setShowCambiar(true)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs text-accent font-medium hover:bg-accent/5 transition-colors">
                <RefreshCw size={12} /> Cambiar
              </button>
            </>
          ) : (
            <>
              {!isCooked && (
                <button onClick={() => { onCocinada(); setExpanded(false) }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs text-oliva font-medium hover:bg-oliva-claro/40 transition-colors border-r border-border">
                  <Check size={12} /> La cociné
                </button>
              )}
              <button onClick={() => setShowCambiar(true)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs text-accent font-medium hover:bg-accent/5 transition-colors">
                <RefreshCw size={12} /> Cambiar
              </button>
              {!isCooked && (
                <button onClick={() => { onSaltar(); setExpanded(false) }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs text-muted font-medium hover:bg-gray-50 transition-colors border-l border-border">
                  <SkipForward size={12} /> Saltar
                </button>
              )}
            </>
          )}
        </div>
      )}

      {showCambiar && (
        <CambiarSheet
          entry={main}
          onClose={() => setShowCambiar(false)}
        />
      )}
    </div>
  )
}
