import { useEffect } from 'react'
import { useFamilyStore } from '../../store/familyStore'

export default function AsistenciaSemanalPanel() {
  const { family, members, attendance, loadAttendance, setMemberActive, setGuestsExtra } = useFamilyStore()

  useEffect(() => {
    if (family?.id) loadAttendance(family.id)
  }, [family?.id, loadAttendance])

  const getAttendance = (memberId: string) =>
    attendance.find(a => a.member_id === memberId)

  const isActive = (memberId: string) => {
    const a = getAttendance(memberId)
    return a ? a.is_active : true // default: todos activos
  }

  const guestsFor = (memberId: string) =>
    getAttendance(memberId)?.guests_extra ?? 0

  const totalComensales = members.reduce((sum, m) => {
    if (!isActive(m.id!)) return sum
    return sum + 1 + guestsFor(m.id!)
  }, 0)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-text">Esta semana comen en casa</p>
        <span className="text-xs bg-accent-light text-accent px-2 py-0.5 rounded-full font-medium">
          {totalComensales} comensales
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {members.map(m => {
          const active = isActive(m.id!)
          const guests = guestsFor(m.id!)
          return (
            <div key={m.id}
              className={`flex items-center gap-3 p-3 rounded-xl border transition-all
                ${active ? 'border-border bg-white' : 'border-border bg-gray-50 opacity-60'}`}>
              <span className="text-2xl flex-shrink-0">{m.emoji}</span>
              <p className="flex-1 text-sm font-medium text-text">{m.name}</p>

              {/* Invitados extra */}
              {active && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted">+</span>
                  <button type="button" onClick={() => setGuestsExtra(m.id!, Math.max(0, guests - 1))}
                    className="w-6 h-6 rounded-full border border-border text-muted text-sm flex items-center justify-center hover:border-accent hover:text-accent">−</button>
                  <span className="text-sm w-4 text-center">{guests}</span>
                  <button type="button" onClick={() => setGuestsExtra(m.id!, guests + 1)}
                    className="w-6 h-6 rounded-full border border-border text-muted text-sm flex items-center justify-center hover:border-accent hover:text-accent">+</button>
                </div>
              )}

              {/* Toggle activo */}
              <button type="button" onClick={() => setMemberActive(m.id!, !active)}
                className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0
                  ${active ? 'bg-accent' : 'bg-gray-200'}`}>
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all
                  ${active ? 'left-5' : 'left-0.5'}`} />
              </button>
            </div>
          )
        })}
      </div>

      <p className="text-xs text-muted">
        Invitados extra se suman al total de porciones de la semana.
      </p>
    </div>
  )
}
