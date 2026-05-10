import { useEffect, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useFamilyStore } from '../../store/familyStore'
import { getMondayOfWeek, DAY_NAMES, DAY_NAMES_FULL } from '../../lib/motorMenu'

const MEAL_LABELS: Record<string, string> = {
  desayuno: '☀️ Desayuno',
  almuerzo: '🍽️ Almuerzo',
  cena:     '🌙 Cena',
  snack:    '🍎 Snack',
}
const ALL_MEALS = ['desayuno', 'almuerzo', 'cena', 'snack']

interface AbsenceRow { id: string; member_id: string; day_of_week: number; meal_type: string }
interface GuestRow   { id: string; day_of_week: number; meal_type: string; cantidad: number; notas: string | null }

export default function AsistenciaSemanalPanel({ familyId }: { familyId: string }) {
  const members    = useFamilyStore(s => s.members)
  const weekStart  = getMondayOfWeek()

  const [day, setDay]             = useState(getCurrentDay)
  const [absences, setAbsences]   = useState<AbsenceRow[]>([])
  const [guests, setGuests]       = useState<GuestRow[]>([])
  const [loading, setLoading]     = useState(true)
  const [guestCtx, setGuestCtx]   = useState<{ day: number; meal: string } | null>(null)

  useEffect(() => { loadData() }, [familyId, weekStart])

  async function loadData() {
    setLoading(true)
    const [{ data: abs }, { data: gst }] = await Promise.all([
      supabase.from('weekly_attendance').select('id, member_id, day_of_week, meal_type')
        .eq('family_id', familyId).eq('week_start', weekStart).eq('is_eating', false),
      supabase.from('weekly_guests').select('*')
        .eq('family_id', familyId).eq('week_start', weekStart),
    ])
    setAbsences((abs ?? []) as AbsenceRow[])
    setGuests((gst ?? []) as GuestRow[])
    setLoading(false)
  }

  const isEating = (memberId: string, d: number, meal: string) =>
    !absences.some(a => a.member_id === memberId && a.day_of_week === d && a.meal_type === meal)

  const toggleEating = async (memberId: string, d: number, meal: string) => {
    if (isEating(memberId, d, meal)) {
      // Marcar ausente
      const { data } = await supabase.from('weekly_attendance')
        .upsert({ family_id: familyId, week_start: weekStart, member_id: memberId, day_of_week: d, meal_type: meal, is_eating: false },
          { onConflict: 'family_id,week_start,member_id,day_of_week,meal_type' })
        .select('id, member_id, day_of_week, meal_type').single()
      if (data) setAbsences(p => [...p.filter(a => !(a.member_id === memberId && a.day_of_week === d && a.meal_type === meal)), data as AbsenceRow])
    } else {
      // Marcar presente: borrar la ausencia
      const row = absences.find(a => a.member_id === memberId && a.day_of_week === d && a.meal_type === meal)
      if (row) {
        await supabase.from('weekly_attendance').delete().eq('id', row.id)
        setAbsences(p => p.filter(a => a.id !== row.id))
      }
    }
  }

  const dayGuests = (d: number, meal: string) =>
    guests.filter(g => g.day_of_week === d && g.meal_type === meal)

  const removeGuest = async (id: string) => {
    await supabase.from('weekly_guests').delete().eq('id', id)
    setGuests(p => p.filter(g => g.id !== id))
  }

  const addGuest = async (d: number, meal: string, cantidad: number, notas: string) => {
    const { data } = await supabase.from('weekly_guests')
      .insert({ family_id: familyId, week_start: weekStart, day_of_week: d, meal_type: meal, cantidad, notas: notas || null })
      .select().single()
    if (data) setGuests(p => [...p, data as GuestRow])
    setGuestCtx(null)
  }

  if (loading) return <p className="text-sm text-muted text-center py-4">Cargando…</p>

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted">
        Por defecto, todos comen todas las comidas. Desmarcá lo que no aplique.
      </p>

      {/* Tabs por día */}
      <div className="flex gap-1 overflow-x-auto -mx-1 px-1 pb-0.5">
        {DAY_NAMES.slice(1).map((label, i) => (
          <button key={i} type="button" onClick={() => setDay(i + 1)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all
              ${day === i + 1 ? 'bg-accent text-white' : 'bg-white border border-border text-muted'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Comidas del día seleccionado */}
      <div className="flex flex-col gap-5">
        {ALL_MEALS.map(meal => {
          const slotGuests = dayGuests(day, meal)
          return (
            <div key={meal}>
              <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
                {MEAL_LABELS[meal]}
              </p>

              {/* Miembros */}
              <div className="flex flex-col gap-1.5">
                {members.map(m => {
                  const eating = isEating(m.id!, day, meal)
                  return (
                    <button key={m.id} type="button"
                      onClick={() => toggleEating(m.id!, day, meal)}
                      className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all text-left
                        ${eating ? 'border-oliva/30 bg-oliva-claro/30' : 'border-border bg-gray-50 opacity-55'}`}>
                      <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0
                        ${eating ? 'bg-oliva text-white' : 'border-2 border-border bg-white'}`}>
                        {eating && <span className="text-[10px] font-bold">✓</span>}
                      </div>
                      <span className="text-xl">{m.emoji}</span>
                      <span className="text-sm font-medium text-text">{m.name}</span>
                      {!eating && <span className="ml-auto text-xs text-muted">No come</span>}
                    </button>
                  )
                })}
              </div>

              {/* Invitados */}
              {slotGuests.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {slotGuests.map(g => (
                    <span key={g.id}
                      className="flex items-center gap-1 px-2.5 py-1 bg-accent-light rounded-full text-xs text-accent border border-accent/30">
                      👥 +{g.cantidad}{g.notas ? ` · ${g.notas}` : ''}
                      <button onClick={() => removeGuest(g.id)} className="text-accent/70 hover:text-accent ml-0.5">
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Agregar invitado */}
              <button type="button" onClick={() => setGuestCtx({ day, meal })}
                className="mt-2 flex items-center gap-1 text-xs text-accent font-medium hover:opacity-80 transition-opacity">
                <Plus size={13} /> Agregar invitado a esta comida
              </button>
            </div>
          )
        })}
      </div>

      {/* Modal de invitado */}
      {guestCtx && (
        <GuestModal
          day={guestCtx.day}
          meal={guestCtx.meal}
          onConfirm={addGuest}
          onClose={() => setGuestCtx(null)}
        />
      )}
    </div>
  )
}

// ── Modal invitado ────────────────────────────────────────────────────────────
function GuestModal({ day, meal, onConfirm, onClose }: {
  day:       number
  meal:      string
  onConfirm: (d: number, m: string, c: number, n: string) => void
  onClose:   () => void
}) {
  const [cantidad, setCantidad] = useState(1)
  const [notas, setNotas]       = useState('')

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 px-4 pb-8"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="card w-full max-w-sm flex flex-col gap-4">
        <div>
          <p className="font-semibold text-text">Agregar invitado</p>
          <p className="text-muted text-xs mt-0.5">
            {DAY_NAMES_FULL[day]} · {MEAL_LABELS[meal]}
          </p>
        </div>

        <div>
          <label className="input-label">¿Cuántas personas?</label>
          <div className="flex items-center gap-5 mt-1">
            <button onClick={() => setCantidad(c => Math.max(1, c - 1))}
              className="w-10 h-10 rounded-xl border border-border text-xl flex items-center justify-center hover:bg-gray-50">−</button>
            <span className="text-2xl font-semibold text-text w-6 text-center">{cantidad}</span>
            <button onClick={() => setCantidad(c => c + 1)}
              className="w-10 h-10 rounded-xl border border-border text-xl flex items-center justify-center hover:bg-gray-50">+</button>
          </div>
        </div>

        <div>
          <label className="input-label">Notas (opcional)</label>
          <input type="text" value={notas} onChange={e => setNotas(e.target.value)}
            placeholder="Mi suegra, vegetariana" />
          <p className="text-xs text-muted mt-1">
            Mencioná restricciones ("vegetariana", "sin gluten", "diabética") y las detectamos automáticamente.
          </p>
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="btn-ghost flex-1 !py-2.5">Cancelar</button>
          <button onClick={() => onConfirm(day, meal, cantidad, notas)}
            className="btn-primary flex-1 !py-2.5">Agregar</button>
        </div>
      </div>
    </div>
  )
}

function getCurrentDay(): number {
  const d = new Date().getDay()  // 0=Dom
  return d === 0 ? 7 : d        // 1=Lun..7=Dom
}
