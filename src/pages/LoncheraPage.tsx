/**
 * LoncheraPage — /lonchera
 * Planificación semanal de loncheras escolares.
 * Feature Plus / Pro — Free ve tier gate.
 */

import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { RefreshCw, Settings, ShoppingCart, Sparkles, RefreshCcw, X, Check } from 'lucide-react'
import Holidays from 'date-holidays'
import { useFamilyStore }  from '../store/familyStore'
import { useLimiteStore }  from '../store/limiteStore'
import { useFridgeStore }  from '../store/fridgeStore'
import { useLoncheraStore, COMPONENTES_CONFIG, type LoncheraComponente, type LoncheraMemberConfig } from '../store/loncheraStore'
import { supabase }        from '../lib/supabase'
import BottomNav           from '../components/ui/BottomNav'

// ── Tier gate ────────────────────────────────────────────────────────────────
// Beta: acceso completo. Activar cuando se lance Plus/Pro.
const IS_FREE = false

// ── Constantes ────────────────────────────────────────────────────────────────
const DAY_CODES = ['lun','mar','mie','jue','vie','sab','dom']
const DAY_FULL: Record<string, string> = {
  lun:'Lunes', mar:'Martes', mie:'Miércoles', jue:'Jueves', vie:'Viernes', sab:'Sábado', dom:'Domingo'
}

const PAISES = [
  { code: 'CO', label: 'Colombia'  },
  { code: 'US', label: 'EE.UU.'    },
  { code: 'MX', label: 'México'    },
  { code: 'PE', label: 'Perú'      },
  { code: 'PA', label: 'Panamá'    },
  { code: 'EC', label: 'Ecuador'   },
  { code: 'BR', label: 'Brasil'    },
  { code: 'ES', label: 'España'    },
  { code: 'PT', label: 'Portugal'  },
  { code: 'TH', label: 'Tailandia' },
]

// Obtiene el nombre del festivo para una fecha dado el país.
// Solo considera festivos 'public' (días oficiales sin colegio).
function getFestivo(dateStr: string, hd: Holidays | null): string | null {
  if (!hd) return null
  try {
    const result = hd.isHoliday(new Date(dateStr + 'T12:00:00'))
    if (!result || result.length === 0) return null
    const pub = result.find(h => h.type === 'public')
    return pub?.name ?? null
  } catch {
    return null
  }
}

// ── Hora de lonchera → meal_type reemplazado ──────────────────────────────────
function mealTypeReemplazado(hora: string | null): string {
  if (!hora) return 'almuerzo'
  const [h] = hora.split(':').map(Number)
  if (h < 8)           return 'desayuno'
  if (h < 11)          return 'merienda mañana'
  if (h < 14)          return 'almuerzo'
  return 'merienda tarde'
}

// ── Tier gate ─────────────────────────────────────────────────────────────────
function TierGate() {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen max-w-lg mx-auto pb-28">
      <BottomNav />
      <div className="px-4 pt-10 flex flex-col items-center gap-6 text-center">
        <span className="text-6xl">🎒</span>
        <div>
          <h1 className="text-2xl font-semibold text-text">Lonchera Escolar</h1>
          <p className="text-muted text-sm mt-1.5">Planificación semanal de loncheras con festivos automáticos</p>
        </div>
        <div className="card w-full max-w-xs py-8 flex flex-col items-center gap-4">
          <span className="text-3xl">🔒</span>
          <div>
            <p className="font-semibold text-text">Solo Plus / Pro</p>
            <p className="text-sm text-muted mt-1 leading-relaxed px-2">
              Generación automática · Festivos por país · Integración con lista de mercado
            </p>
          </div>
          <button className="btn-primary w-full">Ver planes →</button>
          <button onClick={() => navigate(-1)} className="text-sm text-muted hover:text-text transition-colors">
            ← Volver
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Sheet para cambiar componente ─────────────────────────────────────────────
interface CambiarLoncheraSheetProps {
  entryId: string
  componente: LoncheraComponente
  onClose: () => void
  onSaved: (recipeId: string, nombre: string) => void
}

function CambiarLoncheraSheet({ componente, onClose, onSaved }: CambiarLoncheraSheetProps) {
  const [busqueda, setBusqueda] = useState('')
  const [recipes, setRecipes]   = useState<{ id: string; nombre: string; tiempo_total_min: number | null }[]>([])

  useEffect(() => {
    let q = supabase.from('recipes').select('id, nombre, tiempo_total_min').eq('apta_lonchera', true).eq('is_active_for_menu', true).limit(40)
    if (componente === 'principal') q = q.in('tipo_componente', ['plato_unico','proteina_principal'])
    if (componente === 'snack')     q = q.eq('tipo_componente', 'merienda')
    if (componente === 'bebida')    q = q.eq('tipo_componente', 'bebida')
    q.then(({ data }) => setRecipes(data ?? []))
  }, [componente])

  const filtradas = busqueda
    ? recipes.filter(r => r.nombre.toLowerCase().includes(busqueda.toLowerCase()))
    : recipes

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl max-h-[80vh] overflow-y-auto">
        <div className="flex flex-col gap-3 p-4 pb-8">
          <div className="w-10 h-1 rounded-full bg-border mx-auto" />
          <div className="flex items-center justify-between">
            <p className="font-semibold text-text">Cambiar {COMPONENTES_CONFIG[componente].emoji} {COMPONENTES_CONFIG[componente].label}</p>
            <button onClick={onClose}><X size={18} className="text-muted" /></button>
          </div>
          <input
            type="text" placeholder="Buscar receta…"
            value={busqueda} onChange={e => setBusqueda(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-border text-sm focus:outline-none focus:border-accent"
          />
          <div className="flex flex-col gap-1">
            {filtradas.map(r => (
              <button key={r.id}
                onClick={() => onSaved(r.id, r.nombre)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-accent/5 text-left transition-colors">
                <span className="text-base">{COMPONENTES_CONFIG[componente].emoji}</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-text">{r.nombre}</p>
                  {r.tiempo_total_min && <p className="text-[11px] text-muted">⏱ {r.tiempo_total_min} min</p>}
                </div>
              </button>
            ))}
            {filtradas.length === 0 && (
              <p className="text-center text-sm text-muted py-4">Sin recetas apta_lonchera para este tipo</p>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// ── Componente de configuración por miembro ───────────────────────────────────
function MemberLoncheraConfig({
  cfg, onChange,
}: { cfg: LoncheraMemberConfig; onChange: (cfg: LoncheraMemberConfig) => void }) {

  const toggleDia = (dia: string) => {
    const dias = cfg.lonchera_dias.includes(dia)
      ? cfg.lonchera_dias.filter(d => d !== dia)
      : [...cfg.lonchera_dias, dia]
    onChange({ ...cfg, lonchera_dias: dias })
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Toggle lleva lonchera */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-text">Lleva lonchera</p>
        <button
          onClick={() => onChange({ ...cfg, lleva_lonchera: !cfg.lleva_lonchera })}
          className={`w-12 h-6 rounded-full transition-colors relative ${cfg.lleva_lonchera ? 'bg-accent' : 'bg-gray-200'}`}
        >
          <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${cfg.lleva_lonchera ? 'left-6' : 'left-0.5'}`} />
        </button>
      </div>

      {cfg.lleva_lonchera && (
        <>
          {/* Hora */}
          <div className="flex items-center gap-3">
            <label className="text-xs text-muted font-medium flex-shrink-0">Hora de envío</label>
            <input
              type="time"
              value={cfg.lonchera_hora ?? '08:00'}
              onChange={e => onChange({ ...cfg, lonchera_hora: e.target.value })}
              className="px-3 py-1.5 rounded-xl border border-border text-sm focus:outline-none focus:border-accent"
            />
            <span className="text-xs text-muted">→ reemplaza {mealTypeReemplazado(cfg.lonchera_hora)}</span>
          </div>

          {/* Días */}
          <div>
            <p className="text-xs text-muted font-medium mb-1.5">Días de cole</p>
            <div className="flex gap-1.5 flex-wrap">
              {DAY_CODES.map(d => (
                <button key={d}
                  onClick={() => toggleDia(d)}
                  className={`w-8 h-8 rounded-full text-xs font-semibold transition-all ${
                    cfg.lonchera_dias.includes(d) ? 'bg-accent text-white' : 'bg-gray-100 text-muted'
                  }`}>
                  {d[0].toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function LoncheraPage() {
  if (IS_FREE) return <TierGate />

  const navigate = useNavigate()
  const { family, members, puedeUsar, consumirUso } = useFamilyStore()
  const abrirLimite = useLimiteStore(s => s.abrir)
  const { items: fridgeItems } = useFridgeStore()
  const {
    entries, configs, familyLoncheraModo, paisFestivos, loading, generating,
    loadLonchera, saveMemberConfig, saveFamilyConfig, generarLonchera,
    cambiarComponente, quitarComponente, agregarExtra,
  } = useLoncheraStore()

  const [showConfig, setShowConfig]           = useState(false)
  const [activeMemberIdx, setActiveMemberIdx] = useState(0)
  const [activeDia, setActiveDia]             = useState('lun')
  const [localConfigs, setLocalConfigs]       = useState<LoncheraMemberConfig[]>([])
  const [localModo, setLocalModo]             = useState<'unica'|'personalizada'>(familyLoncheraModo)
  const [localPais, setLocalPais]             = useState(paisFestivos)
  const [changingEntry, setChangingEntry]     = useState<{ id: string; componente: LoncheraComponente } | null>(null)
  const [savedToast, setSavedToast]           = useState(false)

  useEffect(() => { if (family?.id) loadLonchera(family.id) }, [family?.id])
  useEffect(() => { setLocalConfigs(configs) }, [configs])
  useEffect(() => { setLocalModo(familyLoncheraModo); setLocalPais(paisFestivos) }, [familyLoncheraModo, paisFestivos])

  // Festivos para el año actual
  // Instancia de date-holidays para el país seleccionado
  const hd = useMemo(() => {
    try { return new Holidays(localPais) } catch { return null }
  }, [localPais])

  // Días activos (unión de lonchera_dias de todos los miembros con lleva_lonchera)
  const diasActivos = useMemo(() => {
    const set = new Set<string>()
    localConfigs.filter(c => c.lleva_lonchera).forEach(c => c.lonchera_dias.forEach(d => set.add(d)))
    return DAY_CODES.filter(d => set.has(d))
  }, [localConfigs])

  useEffect(() => {
    if (diasActivos.length > 0 && !diasActivos.includes(activeDia)) setActiveDia(diasActivos[0])
  }, [diasActivos])

  const memberWithLonchera = members.filter(m => {
    const cfg = localConfigs.find(c => c.member_id === m.id)
    return cfg?.lleva_lonchera
  })

  // Entradas del día activo
  const dowActivo = DAY_CODES.indexOf(activeDia) + 1
  const entriasDia = entries.filter(e => e.day_of_week === dowActivo)

  // Verificar festivo
  const getDateForDow = (dow: number) => {
    const mon = new Date()
    const offset = (dow - 1) - ((mon.getDay() + 6) % 7)
    mon.setDate(mon.getDate() + offset)
    return mon.toISOString().split('T')[0]
  }
  const fechaDia = getDateForDow(dowActivo)
  const festivoNombre = getFestivo(fechaDia, hd)

  const saveConfig = async () => {
    if (!family?.id) return
    for (const cfg of localConfigs) await saveMemberConfig(family.id, cfg)
    await saveFamilyConfig(family.id, localModo, localPais)
    setSavedToast(true)
    setTimeout(() => setSavedToast(false), 2000)
    setShowConfig(false)
  }

  const handleGenerar = async () => {
    if (!family?.id) return
    if (!puedeUsar('lonchera')) { abrirLimite('lonchera'); return }
    await generarLonchera(family.id, fridgeItems.map(f => f.name))
    await consumirUso('lonchera')
  }

  const handleSorpresa = () => {
    // Sorpresa = genera priorizando fridge → generarLonchera ya lo hace
    handleGenerar()
  }

  const handleMercado = () => navigate('/mercado')



  if (loading) return (
    <div className="min-h-screen flex items-center justify-center"><p className="text-muted text-sm">Cargando lonchera…</p></div>
  )

  const ORDEN_COMPONENTES: LoncheraComponente[] = ['principal', 'fruta', 'snack', 'bebida', 'extra']

  return (
    <div className="min-h-screen pb-28 max-w-lg mx-auto overflow-x-hidden">
      <BottomNav />

      {/* Header */}
      <div className="sticky top-0 bg-bg/95 backdrop-blur z-10 px-4 pt-6 pb-3 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-text">🎒 Lonchera Escolar</h1>
            {memberWithLonchera.length > 0 && (
              <p className="text-xs text-muted mt-0.5">
                {memberWithLonchera.map(m => m.emoji + ' ' + m.name).join(' · ')}
              </p>
            )}
          </div>
          <button onClick={() => setShowConfig(v => !v)}
            className="p-2 rounded-xl border border-border text-muted hover:text-accent hover:border-accent transition-colors">
            <Settings size={17} />
          </button>
        </div>
      </div>

      <div className="px-4 py-4 flex flex-col gap-4">

        {/* Config expandible */}
        {showConfig && (
          <div className="card flex flex-col gap-4">
            <p className="text-sm font-semibold text-text">Configuración</p>

            {/* Modo */}
            <div>
              <p className="text-xs text-muted font-medium mb-2">Modo de lonchera</p>
              <div className="flex rounded-xl border border-border overflow-hidden text-sm">
                {(['unica','personalizada'] as const).map(m => (
                  <button key={m} onClick={() => setLocalModo(m)}
                    className={`flex-1 py-2 transition-colors ${localModo === m ? 'bg-accent text-white font-medium' : 'text-muted hover:bg-gray-50'}`}>
                    {m === 'unica' ? '👨‍👩‍👧 Una para todos' : '🧒 Personalizada'}
                  </button>
                ))}
              </div>
            </div>

            {/* País */}
            <div className="flex items-center gap-3">
              <label className="text-xs text-muted font-medium flex-shrink-0">País festivos</label>
              <select value={localPais} onChange={e => setLocalPais(e.target.value)}
                className="flex-1 px-3 py-1.5 rounded-xl border border-border text-sm focus:outline-none focus:border-accent">
                {PAISES.map(p => <option key={p.code} value={p.code}>{p.label}</option>)}
              </select>
            </div>

            {/* Config por miembro */}
            {localModo === 'personalizada' ? (
              <div>
                <p className="text-xs text-muted font-medium mb-2">Por miembro</p>
                {/* Tabs */}
                <div className="flex gap-1 overflow-x-auto mb-3">
                  {members.map((m, i) => (
                    <button key={m.id} onClick={() => setActiveMemberIdx(i)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-all ${
                        activeMemberIdx === i ? 'bg-accent text-white' : 'bg-white border border-border text-muted'
                      }`}>
                      <span>{m.emoji}</span><span>{m.name}</span>
                    </button>
                  ))}
                </div>
                {members[activeMemberIdx] && (() => {
                  const m = members[activeMemberIdx]
                  const cfg = localConfigs.find(c => c.member_id === m.id) ?? {
                    member_id: m.id!, lleva_lonchera: false,
                    lonchera_hora: '08:00', lonchera_dias: ['lun','mar','mie','jue','vie'],
                  }
                  return (
                    <MemberLoncheraConfig cfg={cfg}
                      onChange={updated => setLocalConfigs(prev =>
                        prev.some(c => c.member_id === updated.member_id)
                          ? prev.map(c => c.member_id === updated.member_id ? updated : c)
                          : [...prev, updated]
                      )}
                    />
                  )
                })()}
              </div>
            ) : (
              <div>
                <p className="text-xs text-muted font-medium mb-2">Configuración única (aplica a todos)</p>
                {members[0] && (() => {
                  const m = members[0]
                  const cfg = localConfigs.find(c => c.member_id === m.id) ?? {
                    member_id: m.id!, lleva_lonchera: false,
                    lonchera_hora: '08:00', lonchera_dias: ['lun','mar','mie','jue','vie'],
                  }
                  return (
                    <MemberLoncheraConfig cfg={cfg}
                      onChange={updated => {
                        // En modo unica, replicar misma config a todos
                        setLocalConfigs(members.map(m2 => ({ ...updated, member_id: m2.id! })))
                      }}
                    />
                  )
                })()}
              </div>
            )}

            <button onClick={saveConfig} className="btn-primary">
              Guardar configuración
            </button>
          </div>
        )}

        {/* Sin miembros con lonchera */}
        {!loading && memberWithLonchera.length === 0 && !showConfig && (
          <div className="card flex flex-col items-center gap-4 py-8 text-center">
            <span className="text-4xl">🎒</span>
            <div>
              <p className="font-semibold text-text">Configurá la lonchera primero</p>
              <p className="text-muted text-sm mt-1">Tocá el ícono ⚙️ para configurar qué miembros llevan lonchera.</p>
            </div>
            <button onClick={() => setShowConfig(true)} className="btn-primary max-w-xs">
              Configurar →
            </button>
          </div>
        )}

        {/* Días activos */}
        {diasActivos.length > 0 && (
          <>
            {/* Botones de acción */}
            <div className="flex gap-2">
              <button onClick={handleGenerar} disabled={generating}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-accent text-accent text-sm font-medium hover:bg-accent/5 transition-colors disabled:opacity-40">
                <RefreshCw size={14} className={generating ? 'animate-spin' : ''} />
                {generating ? 'Generando…' : 'Regenerar'}
              </button>
              <button onClick={handleSorpresa} disabled={generating}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-border text-muted text-sm font-medium hover:border-accent hover:text-accent transition-colors disabled:opacity-40">
                <Sparkles size={14} /> Sorpresa
              </button>
              <button onClick={handleMercado}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-border text-muted text-sm font-medium hover:border-accent hover:text-accent transition-colors">
                <ShoppingCart size={14} />
              </button>
            </div>

            {/* Tabs por día */}
            <div className="flex gap-1 overflow-x-auto">
              {diasActivos.map(dia => (
                <button key={dia}
                  onClick={() => setActiveDia(dia)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all flex-shrink-0 ${
                    activeDia === dia ? 'bg-accent text-white' : 'bg-white border border-border text-muted'
                  }`}>
                  {DAY_FULL[dia]}
                </button>
              ))}
            </div>

            {/* Festivo banner */}
            {festivoNombre && (
              <div className="p-3 rounded-2xl bg-yellow-50 border border-yellow-200 flex items-center gap-2">
                <span className="text-base">📅</span>
                <div>
                  <p className="text-sm font-semibold text-yellow-800">Festivo: {festivoNombre}</p>
                  <p className="text-xs text-yellow-700">Sin colegio — no hay lonchera este día</p>
                </div>
              </div>
            )}

            {/* Sin lonchera generada */}
            {!festivoNombre && entries.length === 0 && !generating && (
              <div className="card flex flex-col items-center gap-3 py-6 text-center">
                <span className="text-3xl">🎒</span>
                <p className="text-sm font-medium text-text">Lonchera no generada</p>
                <p className="text-xs text-muted">Tocá "Regenerar" para armar la lonchera de la semana.</p>
              </div>
            )}

            {/* Componentes del día */}
            {!festivoNombre && entriasDia.length > 0 && (
              <div className="card p-0 overflow-hidden">
                {ORDEN_COMPONENTES.filter(comp => comp !== 'extra').map(comp => {
                  const entry = entriasDia.find(e => e.meal_component === comp)
                  const cfg = COMPONENTES_CONFIG[comp]
                  return (
                    <div key={comp} className="flex items-center gap-3 px-4 py-3 border-b border-border/50 last:border-0">
                      <span className="text-lg w-7 flex-shrink-0">{cfg.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted font-medium uppercase tracking-wider">{cfg.label}</p>
                        <p className="text-sm text-text font-medium truncate mt-0.5">
                          {entry?.nombre_custom ?? entry?.recipe?.nombre ?? cfg.defaultText}
                        </p>
                        {entry?.recipe?.tiempo_total_min && (
                          <p className="text-[10px] text-muted">⏱ {entry.recipe.tiempo_total_min} min</p>
                        )}
                      </div>
                      {entry ? (
                        <button onClick={() => setChangingEntry({ id: entry.id, componente: comp })}
                          className="p-1.5 rounded-lg text-muted hover:text-accent hover:bg-accent/10 transition-colors flex-shrink-0">
                          <RefreshCcw size={14} />
                        </button>
                      ) : (
                        <span className="text-xs text-muted/50 flex-shrink-0">—</span>
                      )}
                    </div>
                  )
                })}

                {/* Extras */}
                {entriasDia.filter(e => e.meal_component === 'extra').map(entry => (
                  <div key={entry.id} className="flex items-center gap-3 px-4 py-3 border-b border-border/50">
                    <span className="text-lg w-7 flex-shrink-0">✨</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted font-medium uppercase tracking-wider">Extra</p>
                      <p className="text-sm text-text font-medium truncate">{entry.nombre_custom}</p>
                    </div>
                    <button onClick={() => quitarComponente(entry.id)}
                      className="p-1.5 rounded-lg text-muted hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0">
                      <X size={14} />
                    </button>
                  </div>
                ))}

                {/* + Agregar más */}
                <button
                  onClick={() => setChangingEntry({ id: '', componente: 'extra' })}
                  className="flex items-center gap-2 px-4 py-2.5 text-accent text-sm font-medium hover:bg-accent/5 transition-colors w-full text-left">
                  + Agregar más
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Sheet cambiar componente */}
      {changingEntry && (
        <CambiarLoncheraSheet
          entryId={changingEntry.id}
          componente={changingEntry.componente}
          onClose={() => setChangingEntry(null)}
          onSaved={async (recipeId, nombre) => {
            if (changingEntry.id) {
              await cambiarComponente(changingEntry.id, recipeId, nombre)
              setChangingEntry(null)
            } else if (family?.id) {
              await agregarExtra(family.id, dowActivo, null, recipeId, nombre)
              setChangingEntry(null)
            }
          }}
        />
      )}

      {/* Toast */}
      {savedToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-text text-bg text-sm px-4 py-2.5 rounded-xl shadow-lg z-30 flex items-center gap-2">
          <Check size={14} /> Configuración guardada
        </div>
      )}
    </div>
  )

}
