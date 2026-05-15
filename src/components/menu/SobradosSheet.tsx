import { useState } from 'react'
import { X, Plus, Trash2, ChevronDown } from 'lucide-react'
import { useLeftoversStore, type Leftover } from '../../store/leftoversStore'
import { useFamilyStore } from '../../store/familyStore'
import { useMenuStore } from '../../store/menuStore'
import { getMondayOfWeek, DAY_NAMES_FULL } from '../../lib/motorMenu'

const SUGERENCIAS = [
  'Pollo asado', 'Pechuga de pollo', 'Carne de res', 'Carne molida',
  'Salmón', 'Atún', 'Huevos cocidos', 'Frijoles', 'Lentejas',
  'Cerdo', 'Camarones', 'Tofu',
]

interface SlotOpcion {
  dayOfWeek: number
  mealType:  string
  label:     string   // "Hoy · Almuerzo", "Mañana · Cena", etc.
}

interface Props {
  onClose: () => void
}

export default function SobradosSheet({ onClose }: Props) {
  const { family }                                 = useFamilyStore()
  const { leftovers, addLeftover, removeLeftover } = useLeftoversStore()
  const { menu, asignarSobraEnMenu }               = useMenuStore()
  const [nombre,   setNombre]   = useState('')
  const [cantidad, setCantidad] = useState('')
  const [saving,   setSaving]   = useState(false)
  const [pickerId, setPickerId] = useState<string | null>(null)  // leftover.id con picker abierto
  const [asignando, setAsignando] = useState<string | null>(null)
  const [asignados, setAsignados] = useState<Record<string, string>>({}) // id → label asignado

  const handleAdd = async (name: string, qty?: string) => {
    if (!family?.id || !name.trim()) return
    setSaving(true)
    await addLeftover(family.id, name.trim(), qty?.trim() || undefined)
    setNombre('')
    setCantidad('')
    setSaving(false)
  }

  // Devuelve hasta 4 slots futuros donde se puede asignar la sobra
  const getOpciones = (): SlotOpcion[] => {
    const now    = new Date()
    const jsDay  = now.getDay()
    const isoDow = jsDay === 0 ? 7 : jsDay
    const h      = now.getHours()

    const MEAL_ORDER = ['desayuno', 'almuerzo', 'cena']
    const MEAL_CUTOFF: Record<string, number> = { desayuno: 10, almuerzo: 14, cena: 22 }

    const opciones: SlotOpcion[] = []

    for (let offset = 0; offset <= 6 && opciones.length < 4; offset++) {
      const checkDow = ((isoDow - 1 + offset) % 7) + 1
      for (const meal of MEAL_ORDER) {
        if (offset === 0 && h >= MEAL_CUTOFF[meal]) continue
        const exists = menu.some(e => e.day_of_week === checkDow && e.meal_type.toLowerCase() === meal)
        if (!exists) continue

        const dayLabel =
          offset === 0 ? 'Hoy' :
          offset === 1 ? 'Mañana' :
          DAY_NAMES_FULL[checkDow]
        const mealLabel = meal.charAt(0).toUpperCase() + meal.slice(1)
        opciones.push({ dayOfWeek: checkDow, mealType: meal, label: `${dayLabel} · ${mealLabel}` })
        if (opciones.length >= 4) break
      }
    }

    return opciones
  }

  const asignarEnMenu = async (l: Leftover, slot: SlotOpcion) => {
    if (!family?.id) return
    setAsignando(l.id)
    setPickerId(null)
    await asignarSobraEnMenu(family.id, getMondayOfWeek(), slot.dayOfWeek, slot.mealType, l.ingredient_name)
    setAsignados(prev => ({ ...prev, [l.id]: slot.label }))
    setAsignando(null)
  }

  const opciones = getOpciones()

  // ── ESTRUCTURA IDÉNTICA A DiaDificilSheet ─────────────────────────────────
  return (
    <>
      <div className="fixed inset-0 z-40" style={{ backgroundColor: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(4px)' }} onClick={onClose} />

      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl max-h-[88vh] overflow-y-auto" style={{ backgroundColor: '#ffffff', isolation: 'isolate' }}>
        <div className="flex flex-col gap-4 p-4 pb-10">

          <div className="w-10 h-1 rounded-full bg-border mx-auto" />

          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-text">¿Qué te sobró?</p>
              <p className="text-xs text-muted mt-0.5">Proteínas o preparaciones de días anteriores</p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-gray-100 flex-shrink-0">
              <X size={18} className="text-muted" />
            </button>
          </div>

          {/* Sugerencias rápidas */}
          <div>
            <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Sugerencias rápidas</p>
            <div className="flex flex-wrap gap-2">
              {SUGERENCIAS.filter(s =>
                !leftovers.some(l => l.ingredient_name.toLowerCase() === s.toLowerCase())
              ).map(s => (
                <button key={s} onClick={() => handleAdd(s)}
                  className="px-3 py-1.5 rounded-full border border-border text-xs text-text hover:border-accent hover:text-accent transition-colors">
                  + {s}
                </button>
              ))}
            </div>
          </div>

          {/* Input manual */}
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold text-muted uppercase tracking-wider">Agregar manualmente</p>
            <input
              type="text"
              placeholder="Ej: pollo asado, sopa de lentejas…"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(nombre, cantidad) } }}
            />
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Cantidad (opcional): 3 presas, medio kilo…"
                value={cantidad}
                onChange={e => setCantidad(e.target.value)}
                className="flex-1"
              />
              <button
                onClick={() => handleAdd(nombre, cantidad)}
                disabled={!nombre.trim() || saving}
                className="btn-primary flex items-center gap-1.5 disabled:opacity-40">
                <Plus size={15} /> Agregar
              </button>
            </div>
          </div>

          {/* Lista de sobrantes */}
          {leftovers.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
                Esta semana ({leftovers.length})
              </p>
              <div className="flex flex-col gap-2">
                {leftovers.map((l: Leftover) => {
                  const yaAsignado = asignados[l.id]
                  const enCurso    = asignando === l.id
                  const pickerOpen = pickerOpen_check(l.id)

                  return (
                    <div key={l.id} className="rounded-xl bg-oliva-claro/40 border border-oliva/20 overflow-hidden">
                      <div className="flex items-start justify-between gap-2 py-2 px-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-text">🍗 {l.ingredient_name}</p>
                          {l.quantity && <p className="text-xs text-muted">{l.quantity}</p>}

                          {/* Botón o estado */}
                          {yaAsignado ? (
                            <p className="mt-1 text-xs text-oliva font-medium">✓ En tu menú: {yaAsignado}</p>
                          ) : enCurso ? (
                            <p className="mt-1 text-xs text-muted">Agregando…</p>
                          ) : opciones.length > 0 && (
                            <button
                              onClick={() => setPickerId(pickerOpen ? null : l.id)}
                              className="mt-1 flex items-center gap-1 text-xs font-medium text-accent hover:opacity-70 transition-opacity">
                              <ChevronDown size={12} className={`transition-transform ${pickerOpen ? 'rotate-180' : ''}`} />
                              Agregar al menú
                            </button>
                          )}
                        </div>
                        <button onClick={() => removeLeftover(l.id)} className="p-1.5 text-muted hover:text-error transition-colors flex-shrink-0">
                          <Trash2 size={14} />
                        </button>
                      </div>

                      {/* Picker de comidas */}
                      {pickerOpen && (
                        <div className="border-t border-oliva/20 px-3 pb-3 pt-2 flex flex-col gap-1.5">
                          <p className="text-[11px] text-muted font-medium uppercase tracking-wider mb-0.5">¿Cuándo la usás?</p>
                          {opciones.map(slot => (
                            <button
                              key={`${slot.dayOfWeek}-${slot.mealType}`}
                              onClick={() => asignarEnMenu(l, slot)}
                              className="flex items-center gap-2 py-2 px-3 rounded-xl bg-white border border-border text-sm text-text hover:border-accent hover:text-accent transition-all text-left">
                              <span className="text-base">
                                {slot.mealType === 'desayuno' ? '☀️' : slot.mealType === 'almuerzo' ? '🍽️' : '🌙'}
                              </span>
                              {slot.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )

                  function pickerOpen_check(id: string) { return pickerId === id }
                })}
              </div>
            </div>
          )}

          {leftovers.length === 0 && (
            <p className="text-center text-sm text-muted py-2">
              Aún no registraste sobrantes esta semana.
            </p>
          )}

        </div>
      </div>
    </>
  )
}
