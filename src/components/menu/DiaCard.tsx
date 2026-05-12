import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, SkipForward, Clock, ChefHat, ExternalLink, RefreshCw, RotateCcw, Plus, Trash2 } from 'lucide-react'
import { useMenuStore, type EnrichedMenuEntry } from '../../store/menuStore'
import { useFamilyStore } from '../../store/familyStore'
import { useFridgeStore } from '../../store/fridgeStore'
import { supabase } from '../../lib/supabase'
import type { FamilyMember } from '../../lib/types'
import type { Leftover } from '../../store/leftoversStore'
import { DAY_NAMES_FULL, getMondayOfWeek } from '../../lib/motorMenu'
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
  completo:     '',
}

const DIFICULTAD_COLOR: Record<string, string> = {
  facil:   'bg-green-100 text-green-700',
  media:   'bg-yellow-100 text-yellow-700',
  dificil: 'bg-red-100 text-red-700',
}

// Agrupa entradas por recipe_id y acumula los member_ids de quienes la comen
function agruparPorReceta(entries: EnrichedMenuEntry[], allMembers: FamilyMember[]): {
  entry:      EnrichedMenuEntry
  memberIds:  (string | null)[]  // null = todos sin alternativa
  members:    FamilyMember[]
}[] {
  const map = new Map<string, { entry: EnrichedMenuEntry; memberIds: (string | null)[] }>()

  for (const e of entries) {
    if (map.has(e.recipe_id)) {
      map.get(e.recipe_id)!.memberIds.push(e.member_id)
    } else {
      map.set(e.recipe_id, { entry: e, memberIds: [e.member_id] })
    }
  }

  return [...map.values()].map(({ entry, memberIds }) => {
    const hasNull = memberIds.includes(null)
    const specificIds = memberIds.filter((id): id is string => id !== null)
    const resolvedMembers = hasNull
      ? allMembers  // null = toda la familia
      : allMembers.filter(m => specificIds.includes(m.id!))
    return { entry, memberIds, members: resolvedMembers }
  })
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

      {porTipo.map(({ tipo, components }, idx) => (
        <MealSection
          key={tipo}
          tipo={tipo}
          dayOfWeek={dayOfWeek}
          components={components}
          members={members}
          leftovers={tipo === 'almuerzo' || tipo === 'cena' ? leftovers : []}
          onAddSobrante={onAddSobrante}
          onCocinada={() => {
            const main = components.find(e => e.is_main_recipe) ?? components[0]
            if (main) marcarCocinada(main.id)
          }}
          onSaltar={() => {
            const main = components.find(e => e.is_main_recipe) ?? components[0]
            if (main) saltarReceta(main.id)
          }}
          onRestaurar={() => {
            const main = components.find(e => e.is_main_recipe) ?? components[0]
            if (main) restaurarReceta(main.id)
          }}
          isLast={idx === porTipo.length - 1}
        />
      ))}
    </div>
  )
}

function MealSection({ tipo, dayOfWeek, components, members, leftovers, onAddSobrante, onCocinada, onSaltar, onRestaurar, isLast }: {
  tipo:           string
  dayOfWeek:      number
  components:     EnrichedMenuEntry[]
  members:        FamilyMember[]
  leftovers:      Leftover[]
  onAddSobrante?: () => void
  onCocinada:     () => void
  onSaltar:       () => void
  onRestaurar:    () => void
  isLast:         boolean
}) {
  const navigate    = useNavigate()
  const fridgeItems = useFridgeStore(s => s.items)
  const family      = useFamilyStore(s => s.family)
  const { quitarComponente, agregarComponente } = useMenuStore()
  const [expanded, setExpanded]           = useState(false)
  const [showCambiar, setShowCambiar]     = useState(false)
  const [showAgregar, setShowAgregar]     = useState(false)
  const [busquedaAgregar, setBusquedaAgregar] = useState('')
  const [recetasAgregar, setRecetasAgregar]   = useState<{id:string;nombre:string;tipo_componente:string}[]>([])
  const [tipoAgregar, setTipoAgregar]     = useState<'guarnicion'|'ensalada'>('guarnicion')

  const buscarParaAgregar = async (q: string, tc: string) => {
    if (!q.trim()) { setRecetasAgregar([]); return }
    const { data } = await supabase.from('recipes')
      .select('id, nombre, tipo_componente')
      .eq('tipo_componente', tc)
      .ilike('nombre', `%${q}%`)
      .eq('is_active_for_menu', true)
      .limit(8)
    setRecetasAgregar(data ?? [])
  }

  // Ignorar salsas/vinagretas como componente visible
  const visibles = components.filter(e =>
    e.meal_component !== 'salsa' && e.meal_component !== 'vinagreta'
  )

  const main = visibles.find(e => e.is_main_recipe) ?? visibles[0]
  if (!main) return null

  const isCooked  = main.status === 'cooked'
  const isSkipped = main.status === 'skipped'

  const isSimple = tipo === 'desayuno' || tipo === 'snack'

  // ── DESAYUNO / SNACK: agrupar por receta única ────────────────────────────
  // Cada miembro puede tener su propia receta o compartir una.
  // Mostrar cada receta UNA vez con los emojis de quienes la comen debajo.
  if (isSimple) {
    const grupos = agruparPorReceta(visibles, members)
    return (
      <div className={`${!isLast ? 'border-b border-border/60' : ''}`}>
        <div className="px-4 pt-3 pb-1">
          <p className={`text-xs font-bold uppercase tracking-widest ${isCooked ? 'text-muted' : 'text-accent'}`}>
            {MEAL_LABELS[tipo]}
          </p>
          <div className="h-px bg-border/50 mt-1.5" />
        </div>

        <div className={`flex flex-col gap-0 px-4 pb-2 ${isCooked ? 'opacity-60' : ''} ${isSkipped ? 'opacity-40' : ''}`}>
          {grupos.map(({ entry: e, members: eMembers }) => {
            const r    = e.recipe
            const cm   = calcularMatch(r.ingredientes ?? [], fridgeItems)
            const badge = matchBadge(cm.estado)
            return (
              <button key={e.recipe_id}
                onClick={() => navigate(`/receta/${e.recipe_id}`)}
                className="flex items-start gap-3 py-2.5 text-left hover:opacity-80 transition-opacity border-b border-border/30 last:border-0">
                {/* Imagen */}
                <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-accent-light">
                  {r.imagen_url
                    ? <img src={r.imagen_url} alt={r.nombre} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center"><ChefHat size={16} color="#E76F51" /></div>
                  }
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-text leading-snug">
                    {isSkipped ? <s>{r.nombre}</s> : r.nombre}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {r.tiempo_total_min && (
                      <span className="flex items-center gap-0.5 text-xs text-muted">
                        <Clock size={10} />{r.tiempo_total_min}min
                      </span>
                    )}
                    {r.dificultad && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${DIFICULTAD_COLOR[r.dificultad]}`}>
                        {r.dificultad}
                      </span>
                    )}
                    {!isCooked && !isSkipped && (
                      <span className={`text-[10px] font-medium ${badge.color}`}>{badge.icon}</span>
                    )}
                  </div>
                  {/* Emojis miembros */}
                  <div className="flex items-center gap-1 mt-1">
                    {eMembers.length > 3
                      ? <span className="text-xs text-muted">Familia ({eMembers.length})</span>
                      : eMembers.map(m => (
                          <span key={m.id} title={m.name ?? ''} className="text-sm leading-none">{m.emoji}</span>
                        ))
                    }
                  </div>
                </div>
                <ExternalLink size={12} className="text-muted flex-shrink-0 mt-1" />
              </button>
            )
          })}
        </div>

        <AccionesRow
          expanded={expanded} onExpand={() => setExpanded(e => !e)}
          isCooked={isCooked} isSkipped={isSkipped}
          onVerReceta={() => navigate(`/receta/${main.recipe_id}`)}
          onCocinada={() => { onCocinada(); setExpanded(false) }}
          onSaltar={() => { onSaltar(); setExpanded(false) }}
          onRestaurar={() => { onRestaurar(); setExpanded(false) }}
          onCambiar={() => setShowCambiar(true)}
        />
        {showCambiar && <CambiarSheet entry={main} onClose={() => setShowCambiar(false)} />}
      </div>
    )
  }

  // ── ALMUERZO / CENA: componentes ordenados (proteína → guarnición → ensalada) ──
  // Agrupar por (meal_component, recipe_id) para no repetir si varios miembros comen lo mismo
  const componentOrder = ['proteina', 'completo', 'guarnicion', 'carbohidrato', 'ensalada']
  const visiblesSorted = [...visibles].sort((a, b) =>
    (componentOrder.indexOf(a.meal_component) + 1 || 99) -
    (componentOrder.indexOf(b.meal_component) + 1 || 99)
  )

  // Agrupar por (component_type + recipe_id) para deduplicar
  const componentGroups = new Map<string, { entry: EnrichedMenuEntry; members: FamilyMember[] }>()
  for (const e of visiblesSorted) {
    const key = `${e.meal_component}::${e.recipe_id}`
    if (componentGroups.has(key)) {
      if (e.member_id) {
        const m = members.find(mb => mb.id === e.member_id)
        if (m) componentGroups.get(key)!.members.push(m)
      }
    } else {
      const eMembers = e.member_id === null
        ? [] // se calculan después
        : [members.find(mb => mb.id === e.member_id)].filter(Boolean) as FamilyMember[]
      componentGroups.set(key, { entry: e, members: eMembers })
    }
  }

  // Para entradas con member_id=null, inferir quiénes comen: todos menos los que tienen alternativa
  const altMemberIds = new Set(visibles.filter(e => e.member_id !== null && e.is_main_recipe).map(e => e.member_id!))
  const membersFamilia = members.filter(m => !altMemberIds.has(m.id!))

  const hasSalad   = components.some(c => c.meal_component === 'ensalada')
  const hasProtein = components.some(c => c.meal_component === 'proteina' || c.meal_component === 'completo')
  const hasOnlySides = !hasProtein

  return (
    <div className={`${!isLast ? 'border-b border-border/60' : ''}`}>
      <div className="px-4 pt-3 pb-1">
        <p className={`text-xs font-bold uppercase tracking-widest ${isCooked ? 'text-muted' : 'text-accent'}`}>
          {MEAL_LABELS[tipo]}
        </p>
        <div className="h-px bg-border/50 mt-1.5" />
      </div>

      <div className={`flex flex-col px-4 pb-2 ${isCooked ? 'opacity-60' : ''} ${isSkipped ? 'opacity-40' : ''}`}>
        {[...componentGroups.values()].map(({ entry: e, members: eMembers }) => {
          const r     = e.recipe
          const cm    = calcularMatch(r.ingredientes ?? [], fridgeItems)
          const badge = matchBadge(cm.estado)
          const emoji = COMPONENT_EMOJI[e.meal_component] ?? ''
          // Si member_id=null, mostrar miembros de la familia (sin alternativa)
          const displayMembers = e.member_id === null ? membersFamilia : eMembers

          return (
            <div key={`${e.meal_component}::${e.recipe_id}`}
              className="flex items-start gap-2.5 py-2.5 border-b border-border/30 last:border-0">
              {/* Emoji componente */}
              <span className="text-base leading-none mt-0.5 w-5 flex-shrink-0">{emoji}</span>

              <button className="flex-1 min-w-0 text-left hover:opacity-80 transition-opacity"
                onClick={() => navigate(`/receta/${e.recipe_id}`)}>
                <p className={`text-sm leading-snug ${e.is_main_recipe ? 'font-semibold text-text' : 'font-medium text-text/90'}`}>
                  {isSkipped ? <s>{r.nombre}</s> : r.nombre}
                </p>
                {e.is_main_recipe && (
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {r.tiempo_total_min && (
                      <span className="flex items-center gap-0.5 text-xs text-muted">
                        <Clock size={10} />{r.tiempo_total_min}min
                      </span>
                    )}
                    {r.dificultad && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${DIFICULTAD_COLOR[r.dificultad]}`}>
                        {r.dificultad}
                      </span>
                    )}
                    {!isCooked && !isSkipped && (
                      <span className={`text-[10px] font-medium ${badge.color}`}>{badge.icon}</span>
                    )}
                  </div>
                )}
                {displayMembers.length > 0 && (
                  <div className="flex items-center gap-1 mt-1">
                    {displayMembers.length > 3
                      ? <span className="text-xs text-muted">Familia ({displayMembers.length})</span>
                      : displayMembers.map(m => (
                          <span key={m.id} title={m.name ?? ''} className="text-sm leading-none">{m.emoji}</span>
                        ))
                    }
                  </div>
                )}
              </button>

              {/* Botón quitar componente (solo guarnición/ensalada, no proteína principal) */}
              {!e.is_main_recipe && !isCooked && !isSkipped && (
                <button onClick={() => quitarComponente(e.id)}
                  className="p-1 rounded-lg hover:bg-red-50 hover:text-red-500 text-muted transition-colors flex-shrink-0"
                  title="Quitar">
                  <Trash2 size={13} />
                </button>
              )}
              {e.is_main_recipe && <ExternalLink size={12} className="text-muted flex-shrink-0 mt-1" />}
            </div>
          )
        })}

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

        {/* Agregar proteína */}
        {!isSkipped && hasOnlySides && (
          <button onClick={onAddSobrante}
            className="flex items-center gap-1.5 pt-1 pl-7 text-xs text-accent font-medium hover:opacity-70">
            + Agregar proteína
          </button>
        )}

        {/* Agregar guarnición/ensalada */}
        {!isSkipped && !isCooked && (tipo === 'almuerzo' || tipo === 'cena') && (
          <div className="pt-2 pl-7">
            {!showAgregar ? (
              <div className="flex gap-3">
                <button onClick={() => { setTipoAgregar('guarnicion'); setShowAgregar(true); setBusquedaAgregar('') }}
                  className="flex items-center gap-1 text-xs text-muted hover:text-accent transition-colors font-medium">
                  <Plus size={11} /> Guarnición
                </button>
                <button onClick={() => { setTipoAgregar('ensalada'); setShowAgregar(true); setBusquedaAgregar('') }}
                  className="flex items-center gap-1 text-xs text-muted hover:text-accent transition-colors font-medium">
                  <Plus size={11} /> Ensalada
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5 bg-gray-50 rounded-xl p-2.5 border border-border">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-text">
                    Agregar {tipoAgregar === 'guarnicion' ? '🍚 guarnición' : '🥗 ensalada'}
                  </p>
                  <button onClick={() => { setShowAgregar(false); setRecetasAgregar([]) }}
                    className="text-xs text-muted hover:text-text">✕</button>
                </div>
                <input
                  className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-border bg-white focus:outline-none focus:border-accent"
                  placeholder="Buscar receta..."
                  value={busquedaAgregar}
                  onChange={e => { setBusquedaAgregar(e.target.value); buscarParaAgregar(e.target.value, tipoAgregar) }}
                  autoFocus
                />
                {recetasAgregar.map(r => (
                  <button key={r.id}
                    onClick={async () => {
                      if (!family?.id) return
                      await agregarComponente(family.id, getMondayOfWeek(), dayOfWeek, tipo, r.id, tipoAgregar)
                      setShowAgregar(false); setRecetasAgregar([])
                    }}
                    className="text-left text-xs px-2 py-1.5 rounded-lg hover:bg-accent/10 hover:text-accent transition-colors text-text">
                    {r.nombre}
                  </button>
                ))}
                {busquedaAgregar && recetasAgregar.length === 0 && (
                  <p className="text-xs text-muted text-center py-1">Sin resultados</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <AccionesRow
        expanded={expanded} onExpand={() => setExpanded(e => !e)}
        isCooked={isCooked} isSkipped={isSkipped}
        onVerReceta={() => navigate(`/receta/${main.recipe_id}`)}
        onCocinada={() => { onCocinada(); setExpanded(false) }}
        onSaltar={() => { onSaltar(); setExpanded(false) }}
        onRestaurar={() => { onRestaurar(); setExpanded(false) }}
        onCambiar={() => setShowCambiar(true)}
      />
      {showCambiar && <CambiarSheet entry={main} onClose={() => setShowCambiar(false)} />}
    </div>
  )
}

function AccionesRow({ expanded, onExpand, isCooked, isSkipped, onVerReceta, onCocinada, onSaltar, onRestaurar, onCambiar }: {
  expanded:    boolean
  onExpand:    () => void
  isCooked:    boolean
  isSkipped:   boolean
  onVerReceta: () => void
  onCocinada:  () => void
  onSaltar:    () => void
  onRestaurar: () => void
  onCambiar:   () => void
}) {
  if (!expanded) {
    return (
      <button onClick={onExpand}
        className="w-full px-4 py-1.5 text-xs text-muted text-center hover:text-text transition-colors">
        ···
      </button>
    )
  }
  return (
    <div className="border-t border-border flex">
      <button onClick={onVerReceta}
        className="flex-1 flex items-center justify-center gap-1 py-2.5 text-xs text-accent font-medium hover:bg-accent/5 transition-colors border-r border-border">
        <ExternalLink size={12} /> Ver receta
      </button>
      {isSkipped ? (
        <>
          <button onClick={onRestaurar}
            className="flex-1 flex items-center justify-center gap-1 py-2.5 text-xs text-oliva font-medium hover:bg-oliva-claro/40 transition-colors border-r border-border">
            <RotateCcw size={12} /> Restaurar
          </button>
          <button onClick={onCambiar}
            className="flex-1 flex items-center justify-center gap-1 py-2.5 text-xs text-accent font-medium hover:bg-accent/5 transition-colors">
            <RefreshCw size={12} /> Cambiar
          </button>
        </>
      ) : (
        <>
          {!isCooked && (
            <button onClick={onCocinada}
              className="flex-1 flex items-center justify-center gap-1 py-2.5 text-xs text-oliva font-medium hover:bg-oliva-claro/40 transition-colors border-r border-border">
              <Check size={12} /> La cociné
            </button>
          )}
          <button onClick={onCambiar}
            className="flex-1 flex items-center justify-center gap-1 py-2.5 text-xs text-accent font-medium hover:bg-accent/5 transition-colors border-r border-border">
            <RefreshCw size={12} /> Cambiar
          </button>
          {!isCooked && (
            <button onClick={onSaltar}
              className="flex-1 flex items-center justify-center gap-1 py-2.5 text-xs text-muted font-medium hover:bg-gray-50 transition-colors">
              <SkipForward size={12} /> Saltar
            </button>
          )}
        </>
      )}
    </div>
  )
}
