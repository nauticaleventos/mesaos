import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, SkipForward, Clock, ExternalLink, RefreshCw, RotateCcw, Plus, Trash2 } from 'lucide-react'
import RecipePlaceholder from '../recipes/RecipePlaceholder'
import { useMenuStore, type EnrichedMenuEntry } from '../../store/menuStore'
import { useFamilyStore } from '../../store/familyStore'
import { useFridgeStore } from '../../store/fridgeStore'
import { supabase } from '../../lib/supabase'
import type { FamilyMember } from '../../lib/types'
import { DAY_NAMES_FULL, getMondayOfWeek, calcularMultiplicadorPorcion } from '../../lib/motorMenu'
import { calcularMatch, matchBadge } from '../../lib/matchReceta'
import CambiarSheet from './CambiarSheet'
import RatingPostCoccionModal from './RatingPostCoccionModal'
import { inferirEmojisReceta, multToFraccion } from '../../lib/porcionEmoji'

interface Props {
  dayOfWeek:      number
  date:           Date
  entries:        EnrichedMenuEntry[]
  onAddSobrante?: () => void
}

const MEAL_LABELS: Record<string, string> = {
  desayuno:         '☀️ Desayuno',
  almuerzo:         '🍽️ Almuerzo',
  cena:             '🌙 Cena',
  snack:            '🍿 Snack',
  merienda:         '🍎 Merienda',
  'merienda mañana':  '🌅 Merienda mañana',
  'merienda tarde':   '☕ Merienda tarde',
  'snack noche':      '🌙 Snack noche',
}
const MEAL_ORDER = ['desayuno', 'merienda mañana', 'almuerzo', 'merienda tarde', 'cena', 'snack noche', 'snack', 'merienda']

function getMealLabel(tipo: string, hora?: string): string {
  const key = tipo.toLowerCase()
  const label = MEAL_LABELS[key] ?? `🍴 ${tipo.charAt(0).toUpperCase() + tipo.slice(1)}`
  if (hora) {
    const [h, m] = hora.split(':')
    const hNum   = parseInt(h)
    const ampm   = hNum < 12 ? 'am' : 'pm'
    const h12    = hNum === 0 ? 12 : hNum > 12 ? hNum - 12 : hNum
    return `${label} · ${h12}:${m} ${ampm}`
  }
  return label
}

const ACCION_BADGE: Record<string, { icon: string; label: string; color: string }> = {
  cocinar:        { icon: '🔪', label: 'Cocinar hoy',    color: 'text-accent' },
  calentar:       { icon: '🔥', label: 'Calentar',       color: 'text-orange-500' },
  descongelar:    { icon: '❄️', label: 'Descongelar',    color: 'text-blue-500' },
  ensamblar:      { icon: '🥗', label: 'Ensamblar',      color: 'text-oliva' },
  preparar_fresco:{ icon: '⚡', label: 'Rápida',         color: 'text-muted' },
}

const COMPONENT_EMOJI: Record<string, string> = {
  proteina:     '🍖',
  guarnicion:   '🍚',
  carbohidrato: '🍚',
  ensalada:     '🥗',
  salsa:        '🫙',
  bebida:       '🥤',
  completo:     '',
}

const DIFICULTAD_COLOR: Record<string, string> = {
  facil:   'bg-green-100 text-green-700',
  media:   'bg-yellow-100 text-yellow-700',
  dificil: 'bg-red-100 text-red-700',
}

// Tipos de componentes que se pueden agregar por tipo de comida
const OPCIONES_AGREGAR: Record<string, { tc: string; label: string; emoji: string }[]> = {
  desayuno: [
    { tc: 'desayuno',          label: 'Receta desayuno', emoji: '☀️' },
    { tc: 'libre',             label: 'Cualquier receta',emoji: '🍽️' },
    { tc: 'bebida',            label: 'Bebida',          emoji: '🥤' },
  ],
  snack: [
    { tc: 'merienda',          label: 'Merienda',        emoji: '🍿' },
    { tc: 'libre',             label: 'Cualquier receta',emoji: '🍽️' },
    { tc: 'bebida',            label: 'Bebida',          emoji: '🥤' },
  ],
  almuerzo: [
    { tc: 'guarnicion',        label: 'Guarnición',      emoji: '🍚' },
    { tc: 'sopa',              label: 'Sopa',            emoji: '🍲' },
    { tc: 'ensalada',          label: 'Ensalada',        emoji: '🥗' },
    { tc: 'salsa',             label: 'Salsa',           emoji: '🫙' },
    { tc: 'libre',             label: 'Cualquier receta',emoji: '🍽️' },
    { tc: 'bebida',            label: 'Bebida',          emoji: '🥤' },
  ],
  cena: [
    { tc: 'guarnicion',        label: 'Guarnición',      emoji: '🍚' },
    { tc: 'sopa',              label: 'Sopa',            emoji: '🍲' },
    { tc: 'ensalada',          label: 'Ensalada',        emoji: '🥗' },
    { tc: 'salsa',             label: 'Salsa',           emoji: '🫙' },
    { tc: 'libre',             label: 'Cualquier receta',emoji: '🍽️' },
    { tc: 'bebida',            label: 'Bebida',          emoji: '🥤' },
  ],
}

function agruparPorReceta(entries: EnrichedMenuEntry[], allMembers: FamilyMember[]): {
  entry: EnrichedMenuEntry; members: FamilyMember[]
}[] {
  const map = new Map<string, { entry: EnrichedMenuEntry; memberIds: (string | null)[] }>()
  for (const e of entries) {
    if (e.recipe_id === null) continue  // custom entries se renderizan aparte
    if (map.has(e.recipe_id)) {
      map.get(e.recipe_id)!.memberIds.push(e.member_id)
    } else {
      map.set(e.recipe_id, { entry: e, memberIds: [e.member_id] })
    }
  }
  return [...map.values()].map(({ entry, memberIds }) => {
    const hasNull = memberIds.includes(null)
    const specificIds = memberIds.filter((id): id is string => id !== null)
    const resolvedMembers = hasNull ? allMembers : allMembers.filter(m => specificIds.includes(m.id!))
    return { entry, members: resolvedMembers }
  })
}

// ── Modal de ajustes de porción ──────────────────────────────────────────────
function AjustesPorcionModal({
  recipeName, sharedMembers, onClose,
}: {
  recipeName: string
  sharedMembers: FamilyMember[]
  onClose: () => void
}) {
  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4 pointer-events-none">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm pointer-events-auto" style={{ backgroundColor: '#ffffff', isolation: 'isolate' }}>
          <div className="flex flex-col gap-3 p-5">

            <div className="flex items-center justify-between">
              <p className="font-semibold text-gray-900">📊 Ajustes de porción</p>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
            </div>
            <p className="text-xs text-gray-500 truncate">{recipeName}</p>

            <div className="flex flex-col gap-2 pt-1">
              {sharedMembers.map(m => {
                const mult    = calcularMultiplicadorPorcion(m)
                const etiqueta = mult < 1 ? 'porción reducida' : mult > 1 ? 'porción extra' : 'porción estándar'
                const color    = mult < 1 ? 'text-blue-600 bg-blue-50' : mult > 1 ? 'text-green-700 bg-green-50' : 'text-gray-600 bg-gray-50'
                return (
                  <div key={m.id} className="flex items-center justify-between py-2 px-3 rounded-xl bg-gray-50">
                    <div className="flex items-center gap-2">
                      <span className="text-xl leading-none">{m.emoji}</span>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{m.name}</p>
                        {m.age && <p className="text-xs text-gray-400">{m.age} años</p>}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">×{mult.toFixed(2)}</p>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${color}`}>
                        {etiqueta}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>

            <p className="text-[11px] text-gray-400 text-center pt-1">
              Sugerencias según edad y objetivo. Ajustá según lo que ves.
            </p>
          </div>
        </div>
      </div>
    </>
  )
}

export default function DiaCard({ dayOfWeek, date, entries, onAddSobrante }: Props) {
  const { marcarCocinada, saltarReceta, restaurarReceta } = useMenuStore()
  const members   = useFamilyStore(s => s.members)
  const menuConfig = useMenuStore(s => s.config)
  const isHoy    = new Date().toDateString() === date.toDateString()
  const fechaStr = date.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
  const esDiaCoccion = (menuConfig?.dias_coccion ?? []).includes(dayOfWeek)

  // Agrupar por meal_type, ordenar: primero por MEAL_ORDER, luego por hora si es custom
  const tiposUnicos = [...new Set(entries.map(e => e.meal_type))]
  const porTipo = tiposUnicos
    .map(tipo => ({
      tipo,
      mealTime: entries.find(e => e.meal_type === tipo)?.meal_time,
      components: entries.filter(e => e.meal_type === tipo),
    }))
    .filter(({ components }) => components.length > 0)
    .sort((a, b) => {
      const iA = MEAL_ORDER.indexOf(a.tipo.toLowerCase())
      const iB = MEAL_ORDER.indexOf(b.tipo.toLowerCase())
      if (iA !== -1 && iB !== -1) return iA - iB
      if (iA !== -1) return -1
      if (iB !== -1) return 1
      // ambos custom → ordenar por hora
      return (a.mealTime ?? '99') < (b.mealTime ?? '99') ? -1 : 1
    })

  if (porTipo.length === 0) return null

  return (
    <div className={`card flex flex-col gap-0 overflow-hidden ${isHoy ? 'border-accent' : ''}`}>
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div>
          <p className={`font-bold text-base ${isHoy ? 'text-accent' : 'text-text'}`}>
            {DAY_NAMES_FULL[dayOfWeek]}
            {isHoy && <span className="ml-2 text-[11px] bg-accent text-white px-2 py-0.5 rounded-full font-medium">Hoy</span>}
          </p>
          <p className="text-xs text-muted">{fechaStr}</p>
        </div>
        {esDiaCoccion && (
          <span className="text-[11px] font-semibold text-accent flex items-center gap-1">🔪 Cocinar</span>
        )}
      </div>

      {porTipo.map(({ tipo, mealTime, components }, idx) => (
        <MealSection
          key={tipo}
          tipo={tipo}
          mealTime={mealTime}
          dayOfWeek={dayOfWeek}
          components={components}
          members={members}
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

function MealSection({ tipo, mealTime, dayOfWeek, components, members, onAddSobrante, onCocinada, onSaltar, onRestaurar, isLast }: {
  tipo:           string
  mealTime?:      string
  dayOfWeek:      number
  components:     EnrichedMenuEntry[]
  members:        FamilyMember[]
  onAddSobrante?: () => void
  onCocinada:     () => void
  onSaltar:       () => void
  onRestaurar:    () => void
  isLast:         boolean
}) {
  const navigate    = useNavigate()
  const fridgeItems = useFridgeStore(s => s.items)
  const family      = useFamilyStore(s => s.family)
  const { quitarComponente, agregarComponente, replicarEnSemana } = useMenuStore()

  const [expanded, setExpanded]           = useState(false)
  const [showCambiar, setShowCambiar]     = useState(false)
  const [ratingEntry, setRatingEntry]     = useState<import('../../store/menuStore').EnrichedMenuEntry | null>(null)
  const [showAgregar, setShowAgregar]     = useState(false)
  const [showOpciones, setShowOpciones]   = useState(false)
  const [tipoAgregar, setTipoAgregar]     = useState('')
  const [busquedaAgregar, setBusquedaAgregar] = useState('')
  const [recetasAgregar, setRecetasAgregar]   = useState<{id:string;nombre:string}[]>([])
  const [ultimoAgregado, setUltimoAgregado]   = useState<{recipeId:string;component:string;nombre:string} | null>(null)

  // Cerrar el popover de opciones al click fuera
  useEffect(() => {
    if (!showOpciones) return
    const close = () => setShowOpciones(false)
    const id = setTimeout(() => document.addEventListener('click', close), 0)
    return () => { clearTimeout(id); document.removeEventListener('click', close) }
  }, [showOpciones])
  const [replicando, setReplicando]           = useState(false)
  const [ajustesRecipe, setAjustesRecipe]     = useState<{ name: string; members: FamilyMember[] } | null>(null)

  const visibles = components.filter(e => e.meal_component !== 'vinagreta')
  const customEntries = visibles.filter(e => e.recipe_id === null)
  const recipeEntries = visibles.filter(e => e.recipe_id !== null)
  const main = recipeEntries.find(e => e.is_main_recipe) ?? recipeEntries[0]
  if (!main && customEntries.length === 0) return null

  const isCooked     = main?.status === 'cooked'
  const isSkipped    = main?.status === 'skipped'
  const isDiaDificil = !!main?.dia_dificil
  const tipoBase  = tipo.toLowerCase()
  const isSimple  = tipoBase === 'desayuno' || tipoBase === 'snack' ||
                    tipoBase.includes('merienda') || tipoBase.includes('snack')
  const weekStart = getMondayOfWeek()

  const buscarReceta = async (q: string, tc: string) => {
    let query = supabase.from('recipes').select('id, nombre').eq('is_active_for_menu', true).limit(12)
    if (q.trim()) query = query.ilike('nombre', `%${q.trim()}%`)
    if (tc === 'libre') {
      // Sin filtro de tipo: cualquier receta
    } else if (tc === 'desayuno') {
      query = query.contains('tipo_comida', ['desayuno'])
    } else {
      query = query.eq('tipo_componente', tc)
    }
    const { data } = await query
    setRecetasAgregar(data ?? [])
  }

  const abrirAgregar = (tc: string) => {
    setTipoAgregar(tc)
    setShowAgregar(true)
    setBusquedaAgregar('')
    setRecetasAgregar([])
    buscarReceta('', tc)  // carga sugerencias al abrir sin necesidad de escribir
  }

  const confirmarAgregar = async (recipeId: string, nombre: string) => {
    if (!family?.id) return
    const comp = tipoAgregar === 'desayuno' ? 'completo'
               : tipoAgregar === 'libre'    ? 'completo'
               : tipoAgregar
    await agregarComponente(family.id, weekStart, dayOfWeek, tipo, recipeId, comp)
    setUltimoAgregado({ recipeId, component: comp, nombre })
    setShowAgregar(false)
    setRecetasAgregar([])
  }

  const confirmarReplicar = async () => {
    if (!family?.id || !ultimoAgregado) return
    setReplicando(true)
    await replicarEnSemana(family.id, weekStart, dayOfWeek, tipo, ultimoAgregado.recipeId, ultimoAgregado.component)
    setReplicando(false)
    setUltimoAgregado(null)
  }

  // Normalizar tipo para lookup (puede llegar "Almuerzo", "merienda tarde", etc.)
  const tipoNorm = (() => {
    const n = tipo.toLowerCase()
    if (n.includes('snack') || n.includes('merienda') || n.includes('onces')) return 'snack'
    if (n.includes('desayuno') || n.includes('brunch')) return 'desayuno'
    if (n.includes('almuerzo')) return 'almuerzo'
    if (n.includes('cena')) return 'cena'
    return n
  })()
  const opciones = OPCIONES_AGREGAR[tipoNorm] ?? []

  // ── DESAYUNO / SNACK ──────────────────────────────────────────────────────
  if (isSimple) {
    const grupos = agruparPorReceta(visibles, members)
    return (
      <div className={`${!isLast ? 'border-b border-border/60' : ''}`}>
        {/* Header */}
        <div className="px-4 pt-3 pb-1 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <p className={`text-xs font-bold uppercase tracking-widest ${isCooked ? 'text-muted' : 'text-accent'}`}>
              {getMealLabel(tipo, mealTime)}
            </p>
            {isDiaDificil && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
                style={{ background: '#FEF3C7', color: '#92400E' }}>
                ⚡ Día difícil
              </span>
            )}
          </div>
          {!isCooked && !isSkipped && (
            <button onClick={() => setShowCambiar(true)}
              className="text-[11px] text-muted hover:text-accent transition-colors font-medium flex items-center gap-1 flex-shrink-0">
              <RefreshCw size={10} /> Cambiar
            </button>
          )}
        </div>
        <div className="h-px bg-border/50 mx-4" />

        {/* Recetas */}
        <div className={`flex flex-col gap-0 px-4 pb-1 ${isCooked ? 'opacity-60' : ''} ${isSkipped ? 'opacity-40' : ''}`}>
          {grupos.map(({ entry: e, members: eMembers }) => {
            const r    = e.recipe!
            const cm   = calcularMatch(r.ingredientes ?? [], fridgeItems)
            const badge = matchBadge(cm.estado)
            return (
              <div key={e.recipe_id} className="flex items-start gap-2.5 py-2.5 border-b border-border/30 last:border-0">
                <button onClick={() => navigate(`/receta/${e.recipe_id}`)}
                  className="flex items-start gap-3 flex-1 text-left hover:opacity-80 transition-opacity">
                  <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-accent-light">
                    {r.imagen_url
                      ? <img src={r.imagen_url} alt={r.nombre} className="w-full h-full object-cover" />
                      : <RecipePlaceholder tipo={(r as typeof r & { tipo_componente?: string }).tipo_componente} showName={false} className="w-full h-full" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-text leading-snug">
                      {isSkipped ? <s>{r.nombre}</s> : r.nombre}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {r.tiempo_total_min && <span className="flex items-center gap-0.5 text-xs text-muted"><Clock size={10}/>{r.tiempo_total_min}min</span>}
                      {r.dificultad && <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${DIFICULTAD_COLOR[r.dificultad]}`}>{r.dificultad}</span>}
                      {!isCooked && !isSkipped && <span className={`text-[10px] font-medium ${badge.color}`}>{badge.icon}</span>}
                    </div>
                    <div className="flex flex-col gap-0.5 mt-1">
                      <div className="flex items-center gap-1 flex-wrap">
                        {eMembers.length > 3
                          ? <span className="text-xs text-muted">Familia ({eMembers.length})</span>
                          : eMembers.map(m => <span key={m.id} title={m.name??''} className="text-sm leading-none">{m.emoji}</span>)}
                      </div>
                      {eMembers.length > 1 && eMembers.some(m => calcularMultiplicadorPorcion(m) !== 1.0) && (
                        <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                          {(() => {
                            const { protein: pE, carb: cE } = inferirEmojisReceta(r.ingredientes ?? [])
                            return eMembers.map(m => {
                              const mult = calcularMultiplicadorPorcion(m)
                              if (mult === 1.0) return null
                              const frac = multToFraccion(mult)
                              return (
                                <span key={m.id} className="text-[10px] text-muted">
                                  {m.emoji} {m.name}: {pE} {frac} palma {cE} {frac} puño
                                </span>
                              )
                            })
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
                {/* Quitar — cualquier receta del desayuno (incluyendo la principal) */}
                {!isCooked && !isSkipped && (
                  <button onClick={() => quitarComponente(e.id)}
                    className="p-1 rounded-lg hover:bg-red-50 hover:text-red-500 text-muted transition-colors flex-shrink-0 mt-1"
                    title="Quitar">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {/* Opciones agregar + replicar */}
        {!isCooked && !isSkipped && (
          <div className="px-4 pb-2">
            {!showAgregar ? (
              <div className="relative inline-block pt-1">
                <button
                  onClick={e => { e.stopPropagation(); setShowOpciones(v => !v) }}
                  className="flex items-center gap-1 text-xs text-accent/60 hover:text-accent font-medium transition-colors active:scale-95">
                  <Plus size={11}/> Agrega más
                </button>
                {showOpciones && opciones.length > 0 && (
                  <div className="absolute left-0 bottom-full mb-1 z-20 bg-white rounded-xl shadow-lg border border-border py-1 min-w-[160px]"
                       onClick={e => e.stopPropagation()}>
                    {opciones.map(op => (
                      <button key={op.tc}
                        onClick={() => { setShowOpciones(false); abrirAgregar(op.tc) }}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-text hover:bg-accent-light hover:text-accent transition-colors text-left">
                        <span>{op.emoji}</span> {op.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <AgregarPanel
                tipoLabel={opciones.find(o=>o.tc===tipoAgregar)?.label ?? tipoAgregar}
                busqueda={busquedaAgregar}
                onBusqueda={q => { setBusquedaAgregar(q); buscarReceta(q, tipoAgregar) }}
                resultados={recetasAgregar}
                onSeleccionar={confirmarAgregar}
                onCerrar={() => { setShowAgregar(false); setRecetasAgregar([]) }}
              />
            )}
            {ultimoAgregado && (
              <BannerReplicar nombre={ultimoAgregado.nombre} cargando={replicando}
                onReplicar={confirmarReplicar} onDescartar={() => setUltimoAgregado(null)} />
            )}
          </div>
        )}

        <AccionesRow expanded={expanded} onExpand={() => setExpanded(e => !e)}
          isCooked={isCooked} isSkipped={isSkipped}
          onVerReceta={() => navigate(`/receta/${main.recipe_id}`)}
          onCocinada={() => {
            onCocinada(); setExpanded(false)
            if (main && main.recipe_id && !main.rating_prompted) setRatingEntry(main)
          }}
          onSaltar={() => { onSaltar(); setExpanded(false) }}
          onRestaurar={() => { onRestaurar(); setExpanded(false) }}
          onCambiar={() => setShowCambiar(true)}
        />
        {showCambiar && <CambiarSheet entry={main} onClose={() => setShowCambiar(false)} />}
        {ajustesRecipe && (
          <AjustesPorcionModal
            recipeName={ajustesRecipe.name}
            sharedMembers={ajustesRecipe.members}
            onClose={() => setAjustesRecipe(null)}
          />
        )}
        {ratingEntry && (
          <RatingPostCoccionModal
            entry={ratingEntry}
            onClose={() => setRatingEntry(null)}
            onSkip={async () => {
              await supabase.from('weekly_menu').update({ rating_prompted: true }).eq('id', ratingEntry.id)
              setRatingEntry(null)
            }}
            onSaved={() => setRatingEntry(null)}
          />
        )}
      </div>
    )
  }

  // ── ALMUERZO / CENA ───────────────────────────────────────────────────────
  const componentOrder = ['proteina', 'completo', 'guarnicion', 'carbohidrato', 'ensalada', 'salsa', 'bebida']
  const recipeEntriesSorted = [...recipeEntries].sort((a, b) =>
    (componentOrder.indexOf(a.meal_component) + 1 || 99) -
    (componentOrder.indexOf(b.meal_component) + 1 || 99)
  )

  const componentGroups = new Map<string, { entry: EnrichedMenuEntry; members: FamilyMember[] }>()
  for (const e of recipeEntriesSorted) {
    const key = `${e.meal_component}::${e.recipe_id}`
    if (componentGroups.has(key)) {
      if (e.member_id) {
        const m = members.find(mb => mb.id === e.member_id)
        if (m) componentGroups.get(key)!.members.push(m)
      }
    } else {
      const eMembers = e.member_id === null ? [] : [members.find(mb => mb.id === e.member_id)].filter(Boolean) as FamilyMember[]
      componentGroups.set(key, { entry: e, members: eMembers })
    }
  }

  const altMemberIds = new Set(recipeEntries.filter(e => e.member_id !== null && e.is_main_recipe).map(e => e.member_id!))
  const membersFamilia = members.filter(m => !altMemberIds.has(m.id!))
  const hasProtein = recipeEntries.some(c => c.meal_component === 'proteina' || c.meal_component === 'completo')

  return (
    <div className={`${!isLast ? 'border-b border-border/60' : ''}`}>
      {/* Header con botón Cambiar */}
      <div className="px-4 pt-3 pb-1 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <p className={`text-xs font-bold uppercase tracking-widest ${isCooked ? 'text-muted' : 'text-accent'}`}>
            {getMealLabel(tipo, mealTime)}
          </p>
          {isDiaDificil && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
              style={{ background: '#FEF3C7', color: '#92400E' }}>
              ⚡ Día difícil
            </span>
          )}
        </div>
        {main && !isCooked && !isSkipped && (
          <button onClick={() => setShowCambiar(true)}
            className="text-[11px] text-muted hover:text-accent transition-colors font-medium flex items-center gap-1 flex-shrink-0">
            <RefreshCw size={10} /> Cambiar
          </button>
        )}
      </div>
      <div className="h-px bg-border/50 mx-4 mb-0" />

      {/* Componentes */}
      <div className={`flex flex-col px-4 pb-2 ${isCooked ? 'opacity-60' : ''} ${isSkipped ? 'opacity-40' : ''}`}>
        {[...componentGroups.values()].map(({ entry: e, members: eMembers }) => {
          const r     = e.recipe!
          const cm    = calcularMatch(r.ingredientes ?? [], fridgeItems)
          const badge = matchBadge(cm.estado)
          const emoji = COMPONENT_EMOJI[e.meal_component] ?? ''
          const displayMembers = e.member_id === null ? membersFamilia : eMembers
          const esProteina = e.is_main_recipe

          return (
            <div key={`${e.meal_component}::${e.recipe_id}`}
              className="flex items-start gap-2.5 py-2.5 border-b border-border/30 last:border-0">
              <span className="text-base leading-none mt-0.5 w-5 flex-shrink-0">{emoji}</span>

              <button className="flex-1 min-w-0 text-left hover:opacity-80 transition-opacity"
                onClick={() => navigate(`/receta/${e.recipe_id}`)}>
                <p className={`text-sm leading-snug ${esProteina ? 'font-semibold text-text' : 'font-medium text-text/90'}`}>
                  {isSkipped ? <s>{r.nombre}</s> : r.nombre}
                </p>
                {esProteina && (
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {r.tiempo_total_min && <span className="flex items-center gap-0.5 text-xs text-muted"><Clock size={10}/>{r.tiempo_total_min}min</span>}
                    {r.dificultad && <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${DIFICULTAD_COLOR[r.dificultad]}`}>{r.dificultad}</span>}
                    {!isCooked && !isSkipped && <span className={`text-[10px] font-medium ${badge.color}`}>{badge.icon}</span>}
                    {(() => {
                      const accion = e.accion_preparacion
                      const ab = accion ? ACCION_BADGE[accion] : null
                      return ab && !isCooked && accion !== 'cocinar' ? (
                        <span className={`text-[10px] font-medium ${ab.color}`}>{ab.icon} {ab.label}</span>
                      ) : null
                    })()}
                  </div>
                )}
                {displayMembers.length > 0 && (
                  <div className="flex flex-col gap-0.5 mt-1">
                    <div className="flex items-center gap-1 flex-wrap">
                      {displayMembers.length > 3
                        ? <span className="text-xs text-muted">Familia ({displayMembers.length})</span>
                        : displayMembers.map(m => <span key={m.id} title={m.name??''} className="text-sm leading-none">{m.emoji}</span>)}
                    </div>
                    {/* Porciones inline — visible sin tocar nada */}
                    {displayMembers.length > 1 && displayMembers.some(m => calcularMultiplicadorPorcion(m) !== 1.0) && (
                      <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                        {(() => {
                          const { protein: pE, carb: cE } = inferirEmojisReceta(r.ingredientes ?? [])
                          return displayMembers.map(m => {
                            const mult = calcularMultiplicadorPorcion(m)
                            if (mult === 1.0) return null
                            const frac = multToFraccion(mult)
                            return (
                              <span key={m.id} className="text-[10px] text-muted">
                                {m.emoji} {m.name}: {pE} {frac} palma {cE} {frac} puño
                              </span>
                            )
                          })
                        })()}
                      </div>
                    )}
                  </div>
                )}
              </button>

              {/* Quitar — todos los componentes incluyendo proteína */}
              {!isCooked && !isSkipped && (
                <button onClick={() => quitarComponente(e.id)}
                  className={`p-1 rounded-lg transition-colors flex-shrink-0 mt-0.5
                    ${esProteina ? 'hover:bg-red-50 hover:text-red-500 text-muted/50' : 'hover:bg-red-50 hover:text-red-500 text-muted'}`}
                  title="Quitar">
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          )
        })}

        {/* Entradas de sobras asignadas al menú */}
        {customEntries.map(e => (
          <div key={e.id} className="flex items-center gap-2 py-2 border-b border-border/30 last:border-0">
            <span className="text-base leading-none w-5 flex-shrink-0">♻️</span>
            <p className="flex-1 text-sm font-medium text-oliva">{e.nombre_custom}</p>
            {!isCooked && !isSkipped && (
              <button onClick={() => quitarComponente(e.id)}
                className="p-1 rounded-lg hover:bg-red-50 hover:text-red-500 text-muted transition-colors flex-shrink-0">
                <Trash2 size={13} />
              </button>
            )}
          </div>
        ))}

        {!hasProtein && customEntries.length === 0 && !isSkipped && (
          <button onClick={onAddSobrante}
            className="flex items-center gap-1.5 pt-1 pl-7 text-xs text-accent font-medium hover:opacity-70">
            + Agregar proteína
          </button>
        )}

        {/* Opciones agregar */}
        {!isCooked && !isSkipped && (
          <div className="pl-7 pt-1">
            {!showAgregar ? (
              <div className="relative inline-block">
                <button
                  onClick={e => { e.stopPropagation(); setShowOpciones(v => !v) }}
                  className="flex items-center gap-1 text-xs text-accent/60 hover:text-accent font-medium transition-colors active:scale-95">
                  <Plus size={11}/> Agrega más
                </button>
                {showOpciones && opciones.length > 0 && (
                  <div className="absolute left-0 bottom-full mb-1 z-20 bg-white rounded-xl shadow-lg border border-border py-1 min-w-[160px]"
                       onClick={e => e.stopPropagation()}>
                    {opciones.map(op => (
                      <button key={op.tc}
                        onClick={() => { setShowOpciones(false); abrirAgregar(op.tc) }}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-text hover:bg-accent-light hover:text-accent transition-colors text-left">
                        <span>{op.emoji}</span> {op.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <AgregarPanel
                tipoLabel={opciones.find(o=>o.tc===tipoAgregar)?.label ?? tipoAgregar}
                busqueda={busquedaAgregar}
                onBusqueda={q => { setBusquedaAgregar(q); buscarReceta(q, tipoAgregar) }}
                resultados={recetasAgregar}
                onSeleccionar={confirmarAgregar}
                onCerrar={() => { setShowAgregar(false); setRecetasAgregar([]) }}
              />
            )}
            {ultimoAgregado && (
              <BannerReplicar nombre={ultimoAgregado.nombre} cargando={replicando}
                onReplicar={confirmarReplicar} onDescartar={() => setUltimoAgregado(null)} />
            )}
          </div>
        )}
      </div>

      {main && (
        <AccionesRow expanded={expanded} onExpand={() => setExpanded(e => !e)}
          isCooked={isCooked} isSkipped={isSkipped}
          onVerReceta={() => navigate(`/receta/${main.recipe_id}`)}
          onCocinada={() => {
            onCocinada(); setExpanded(false)
            if (main.recipe_id && !main.rating_prompted) setRatingEntry(main)
          }}
          onSaltar={() => { onSaltar(); setExpanded(false) }}
          onRestaurar={() => { onRestaurar(); setExpanded(false) }}
          onCambiar={() => setShowCambiar(true)}
        />
      )}
      {showCambiar && main && <CambiarSheet entry={main} onClose={() => setShowCambiar(false)} />}
      {ajustesRecipe && (
        <AjustesPorcionModal
          recipeName={ajustesRecipe.name}
          sharedMembers={ajustesRecipe.members}
          onClose={() => setAjustesRecipe(null)}
        />
      )}
      {ratingEntry && (
        <RatingPostCoccionModal
          entry={ratingEntry}
          onClose={() => setRatingEntry(null)}
          onSkip={async () => {
            await supabase.from('weekly_menu').update({ rating_prompted: true }).eq('id', ratingEntry.id)
            setRatingEntry(null)
          }}
          onSaved={() => setRatingEntry(null)}
        />
      )}
    </div>
  )
}

// ── Panel de búsqueda para agregar componente ─────────────────────────────────
function AgregarPanel({ tipoLabel, busqueda, onBusqueda, resultados, onSeleccionar, onCerrar }: {
  tipoLabel:    string
  busqueda:     string
  onBusqueda:   (q: string) => void
  resultados:   {id:string;nombre:string}[]
  onSeleccionar:(id:string, nombre:string) => void
  onCerrar:     () => void
}) {
  return (
    <div className="flex flex-col gap-1.5 bg-gray-50 rounded-xl p-2.5 border border-border mt-1">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-text">Agregar {tipoLabel}</p>
        <button onClick={onCerrar} className="text-xs text-muted hover:text-text">✕</button>
      </div>
      <input
        className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-border bg-white focus:outline-none focus:border-accent"
        placeholder="Buscar receta..."
        value={busqueda}
        onChange={e => onBusqueda(e.target.value)}
        autoFocus
      />
      {resultados.map(r => (
        <button key={r.id} onClick={() => onSeleccionar(r.id, r.nombre)}
          className="text-left text-xs px-2 py-1.5 rounded-lg hover:bg-accent/10 hover:text-accent transition-colors text-text">
          {r.nombre}
        </button>
      ))}
      {busqueda && resultados.length === 0 && (
        <p className="text-xs text-muted text-center py-1">Sin resultados</p>
      )}
    </div>
  )
}

// ── Banner "¿Aplicar al resto de la semana?" ──────────────────────────────────
function BannerReplicar({ nombre, cargando, onReplicar, onDescartar }: {
  nombre:     string
  cargando:   boolean
  onReplicar: () => void
  onDescartar:() => void
}) {
  return (
    <div className="mt-2 p-2.5 rounded-xl bg-accent/8 border border-accent/25 flex items-center gap-2">
      <p className="text-xs text-text flex-1 min-w-0">
        <span className="font-medium">"{nombre}"</span> agregada.{' '}
        <span className="text-muted">¿Repetir en toda la semana?</span>
      </p>
      <div className="flex gap-1.5 flex-shrink-0">
        <button onClick={onReplicar} disabled={cargando}
          className="text-[11px] font-semibold text-accent hover:opacity-70 transition-opacity px-2 py-1 rounded-lg bg-accent/10">
          {cargando ? '...' : 'Sí'}
        </button>
        <button onClick={onDescartar}
          className="text-[11px] text-muted hover:text-text transition-colors px-2 py-1">
          No
        </button>
      </div>
    </div>
  )
}

// ── Barra de acciones colapsada ───────────────────────────────────────────────
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
