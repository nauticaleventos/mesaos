import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, SkipForward, Clock, ChefHat, ExternalLink, RefreshCw, Plus, RotateCcw } from 'lucide-react'
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
  snack:    '🍎 Snack',
}
const MEAL_ORDER = ['desayuno', 'almuerzo', 'cena', 'snack']

const COMPONENT_LABELS: Record<string, string> = {
  proteina:      '🥩 Proteína',
  carbohidrato:  '🍚 Guarnición',
  guarnicion:    '🍚 Guarnición',
  ensalada:      '🥗 Ensalada',
  salsa:         '🫙 Salsa',
  vinagreta:     '🫙 Vinagreta',
  completo:      '',
}

const DIFICULTAD_COLOR: Record<string, string> = {
  facil:   'bg-green-100 text-green-700',
  media:   'bg-yellow-100 text-yellow-700',
  dificil: 'bg-red-100 text-red-700',
}

export default function DiaCard({ dayOfWeek, date, entries, leftovers = [], onAddSobrante }: Props) {
  const { marcarCocinada, saltarReceta } = useMenuStore()
  const members = useFamilyStore(s => s.members)

  const isHoy    = new Date().toDateString() === date.toDateString()
  const fechaStr = date.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })

  // Agrupar por meal_type en orden
  const porTipo = MEAL_ORDER
    .map(tipo => ({
      tipo,
      components: entries.filter(e => e.meal_type === tipo),
    }))
    .filter(({ components }) => components.length > 0)

  if (porTipo.length === 0) return null

  // Entrada principal de cada comida (proteína o completo, member_id=null)
  const mainEntry = (components: EnrichedMenuEntry[]) =>
    components.find(e => e.is_main_recipe && e.member_id === null) ?? components[0]

  return (
    <div className={`card flex flex-col gap-4 ${isHoy ? 'border-accent' : ''}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className={`font-semibold ${isHoy ? 'text-accent' : 'text-text'}`}>
            {DAY_NAMES_FULL[dayOfWeek]}
            {isHoy && <span className="ml-2 text-xs bg-accent text-white px-2 py-0.5 rounded-full">Hoy</span>}
          </p>
          <p className="text-xs text-muted">{fechaStr}</p>
        </div>
      </div>

      {porTipo.map(({ tipo, components }) => {
        const main = mainEntry(components)
        if (!main) return null

        const hasSalad = components.some(c => c.meal_component === 'ensalada')

        // Miembros que comen en este slot:
        // - si hay entries con member_id != null → esos miembros tienen variación propia
        // - el resto come el plato compartido (member_id=null)
        const memberIdsWithAlt = new Set(components.filter(c => c.member_id !== null).map(c => c.member_id!))
        const membersInSlot    = members.filter(m => !memberIdsWithAlt.has(m.id!))

        return (
          <RecetaSlot
            key={tipo}
            tipo={tipo}
            main={main}
            allComponents={components}
            members={members}
            membersInSlot={membersInSlot}
            leftovers={hasSalad ? leftovers : []}
            onAddSobrante={hasSalad ? onAddSobrante : undefined}
            onCocinada={() => marcarCocinada(main.id)}
            onSaltar={() => saltarReceta(main.id)}
          />
        )
      })}
    </div>
  )
}

function RecetaSlot({ tipo, main, allComponents, members, membersInSlot, leftovers, onAddSobrante, onCocinada, onSaltar }: {
  tipo:           string
  main:           EnrichedMenuEntry
  allComponents:  EnrichedMenuEntry[]
  members:        FamilyMember[]
  membersInSlot:  FamilyMember[]
  leftovers:      Leftover[]
  onAddSobrante?: () => void
  onCocinada:     () => void
  onSaltar:       () => void
}) {
  const [expanded,    setExpanded]    = useState(false)
  const [showCambiar, setShowCambiar] = useState(false)
  const navigate            = useNavigate()
  const { restaurarReceta } = useMenuStore()
  const fridgeItems         = useFridgeStore(s => s.items)
  const r         = main.recipe
  const isCooked  = main.status === 'cooked'
  const isSkipped = main.status === 'skipped'

  // Match del plato principal contra nevera
  const mainMatch = calcularMatch(r.ingredientes ?? [], fridgeItems)
  const mainBadge = matchBadge(mainMatch.estado)

  // Componentes extra (guarniciones, ensaladas, salsas)
  const extras = allComponents.filter(e => e.id !== main.id)
  // Variaciones por miembro (mismo componente, distinto miembro)
  const perMember = allComponents.filter(e => e.member_id !== null)

  return (
    <div className={`rounded-xl overflow-hidden border transition-all
      ${isCooked  ? 'border-oliva/40 bg-oliva-claro/30 opacity-75' : ''}
      ${isSkipped ? 'border-border bg-gray-50' : ''}
      ${!isCooked && !isSkipped ? 'border-border bg-white' : ''}`}>

      {/* Cabecera — proteína o plato completo */}
      <button type="button" onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 p-3 text-left">

        <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-accent-light">
          {r.imagen_url ? (
            <img src={r.imagen_url} alt={r.nombre} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ChefHat size={24} color="#E76F51" />
            </div>
          )}
        </div>

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
            {!isCooked && !isSkipped && (
              <span className={`text-xs font-medium ${mainBadge.color}`}>
                {mainBadge.icon} {mainBadge.label}
              </span>
            )}
            {isCooked  && <span className="text-xs text-oliva font-medium">✓ Cocinada</span>}
            {isSkipped && <span className="text-xs text-muted font-medium">↩ Saltada</span>}
          </div>
          {/* Chips de quién come este slot */}
          {membersInSlot.length > 1 && !isSkipped && (
            <div className="flex items-center gap-1 mt-1">
              {membersInSlot.map(m => (
                <span key={m.id} title={m.name ?? ''}
                  className="text-sm leading-none" aria-label={m.name ?? ''}>
                  {m.emoji}
                </span>
              ))}
            </div>
          )}
        </div>

        <span className="text-muted text-xs flex-shrink-0">{expanded ? '▲' : '▼'}</span>
      </button>

      {/* Componentes extra (guarniciones / ensalada / salsa) compartidos */}
      {extras.filter(e => e.member_id === null).length > 0 && (
        <div className="px-3 pb-2 flex flex-col gap-1 border-t border-border/50">
          {extras.filter(e => e.member_id === null).map(comp => {
            const cm = calcularMatch(comp.recipe.ingredientes ?? [], fridgeItems)
            const cb = matchBadge(cm.estado)
            return (
              <button key={comp.id} onClick={() => navigate(`/receta/${comp.recipe_id}`)}
                className="flex items-center gap-2 py-1.5 text-left hover:opacity-80 transition-opacity">
                <span className="text-xs text-muted font-medium w-24 flex-shrink-0">
                  {COMPONENT_LABELS[comp.meal_component] || comp.meal_component}
                </span>
                <span className="text-xs text-text truncate">{comp.recipe.nombre}</span>
                <span className={`text-[10px] flex-shrink-0 ml-1 ${cb.color}`}>{cb.icon}</span>
                <ExternalLink size={10} className="text-muted flex-shrink-0 ml-auto" />
              </button>
            )
          })}
        </div>
      )}

      {/* Sobrantes disponibles para agregar a la ensalada */}
      {leftovers.length > 0 && (
        <div className="px-3 pb-2 flex flex-col gap-1 border-t border-oliva/20 bg-oliva-claro/20">
          <p className="text-[10px] text-oliva font-semibold uppercase tracking-wider pt-1.5">
            + Sobrantes disponibles para la ensalada
          </p>
          <div className="flex flex-wrap gap-1.5 pb-1">
            {leftovers.map(l => (
              <span key={l.id}
                className="px-2.5 py-1 rounded-full bg-oliva/10 border border-oliva/20 text-xs text-oliva font-medium">
                🍗 {l.ingredient_name}{l.quantity ? ` · ${l.quantity}` : ''}
              </span>
            ))}
          </div>
        </div>
      )}
      {leftovers.length === 0 && onAddSobrante && (
        <div className="px-3 pb-2 border-t border-border/40">
          <button onClick={onAddSobrante}
            className="flex items-center gap-1.5 mt-1.5 text-xs text-muted hover:text-oliva transition-colors">
            <Plus size={12} /> Agregar proteína sobrante a esta ensalada
          </button>
        </div>
      )}

      {/* Variaciones por miembro */}
      {perMember.length > 0 && (() => {
        // Separar: platos principales por miembro (desayuno/snack personalizados)
        // vs acompañamientos específicos por miembro (carb/salad en almuerzo/cena)
        const mainPerMember = perMember.filter(e => e.is_main_recipe)
        const sidePerMember = perMember.filter(e => !e.is_main_recipe)

        // Agrupar platos principales por recipe_id para mostrar juntos a quien comparte
        const recipeGroups = new Map<string, { comp: EnrichedMenuEntry; memberIds: string[] }>()
        for (const comp of mainPerMember) {
          if (!recipeGroups.has(comp.recipe_id)) {
            recipeGroups.set(comp.recipe_id, { comp, memberIds: [] })
          }
          recipeGroups.get(comp.recipe_id)!.memberIds.push(comp.member_id!)
        }

        return (
          <>
            {/* Mini-cards por miembro para desayuno/snack */}
            {recipeGroups.size > 0 && (
              <div className="px-3 pb-2 pt-1 flex flex-col gap-2 border-t border-border/50">
                {[...recipeGroups.values()].map(({ comp: c, memberIds }) => {
                  const groupMembers = memberIds.map(id => members.find(mb => mb.id === id)).filter(Boolean) as FamilyMember[]
                  const rc = c.recipe
                  return (
                    <button key={c.recipe_id}
                      onClick={() => navigate(`/receta/${c.recipe_id}`)}
                      className="flex items-center gap-2.5 p-2 rounded-xl border border-border hover:border-accent hover:bg-accent-light/20 transition-all text-left">
                      {/* Imagen */}
                      <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-accent-light">
                        {rc.imagen_url
                          ? <img src={rc.imagen_url} alt={rc.nombre} className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center"><ChefHat size={16} color="#E76F51" /></div>
                        }
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        {/* Emojis de quién come esto */}
                        <div className="flex items-center gap-1 mb-0.5">
                          {groupMembers.map(m => (
                            <span key={m.id} className="text-sm leading-none" title={m.name ?? ''}>{m.emoji}</span>
                          ))}
                          <span className="text-xs text-muted ml-1">
                            {groupMembers.map(m => m.name).join(' y ')}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-text leading-tight line-clamp-1">{rc.nombre}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {rc.tiempo_total_min && (
                            <span className="flex items-center gap-0.5 text-xs text-muted">
                              <Clock size={10} />{rc.tiempo_total_min}min
                            </span>
                          )}
                          {rc.dificultad && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${DIFICULTAD_COLOR[rc.dificultad]}`}>
                              {rc.dificultad}
                            </span>
                          )}
                        </div>
                      </div>
                      <ExternalLink size={12} className="text-muted flex-shrink-0" />
                    </button>
                  )
                })}
              </div>
            )}

            {/* Acompañamientos específicos por miembro (almuerzo/cena) */}
            {sidePerMember.length > 0 && (
              <div className="px-3 pb-2 flex flex-col gap-1">
                {sidePerMember.map(comp => {
                  const m = members.find((mb: FamilyMember) => mb.id === comp.member_id)
                  return (
                    <button key={comp.id} onClick={() => navigate(`/receta/${comp.recipe_id}`)}
                      className="flex items-center gap-1.5 text-xs text-muted text-left hover:opacity-80 transition-opacity">
                      <span>{m?.emoji}</span>
                      <strong className="text-text">{m?.name}</strong>
                      <span className="text-muted">·</span>
                      <span className="text-muted">{COMPONENT_LABELS[comp.meal_component] || ''}</span>
                      <span className="text-text truncate">{comp.recipe.nombre}</span>
                      <ExternalLink size={9} className="flex-shrink-0 ml-auto" />
                    </button>
                  )
                })}
              </div>
            )}
          </>
        )
      })()}

      {/* Acciones expandidas */}
      {expanded && (
        <div className="border-t border-border flex flex-col">
          <button onClick={() => navigate(`/receta/${main.recipe_id}`)}
            className="flex items-center justify-center gap-1.5 py-2.5 text-sm text-accent font-medium hover:bg-accent/5 transition-colors border-b border-border">
            <ExternalLink size={14} /> Ver receta completa
          </button>

          {isSkipped ? (
            /* Opciones para recetas saltadas */
            <div className="flex">
              <button onClick={() => restaurarReceta(main.id)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm text-oliva font-medium hover:bg-oliva-claro/40 transition-colors">
                <RotateCcw size={15} /> Restaurar
              </button>
              <button onClick={() => setShowCambiar(true)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm text-accent font-medium hover:bg-accent/5 transition-colors border-l border-border">
                <RefreshCw size={15} /> Cambiar
              </button>
            </div>
          ) : (
            /* Opciones normales */
            <div className="flex">
              {!isCooked && (
                <button onClick={onCocinada}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm text-oliva font-medium hover:bg-oliva-claro/40 transition-colors">
                  <Check size={15} /> La cociné
                </button>
              )}
              {!isCooked && (
                <button onClick={() => setShowCambiar(true)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm text-accent font-medium hover:bg-accent/5 transition-colors border-l border-border">
                  <RefreshCw size={15} /> Cambiar
                </button>
              )}
              {!isCooked && (
                <button onClick={onSaltar}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm text-muted hover:bg-gray-50 transition-colors border-l border-border">
                  <SkipForward size={15} /> Saltar
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {showCambiar && (
        <CambiarSheet entry={main} onClose={() => setShowCambiar(false)} />
      )}
    </div>
  )
}
