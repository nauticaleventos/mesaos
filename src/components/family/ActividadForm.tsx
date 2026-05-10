import { useState } from 'react'
import type { MemberActivity } from '../../lib/types'

const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const INTENSITY = [
  { value: 'low',      label: 'Baja',     color: 'bg-green-100 text-green-700 border-green-300' },
  { value: 'moderate', label: 'Moderada', color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
  { value: 'high',     label: 'Alta',     color: 'bg-red-100 text-red-700 border-red-300' },
]

interface Props {
  memberId: string
  initial?: Partial<MemberActivity>
  onSave:   (data: Omit<MemberActivity, 'id' | 'created_at'>) => void
  onCancel: () => void
}

export default function ActividadForm({ memberId, initial, onSave, onCancel }: Props) {
  const [name,     setName]     = useState(initial?.activity_name ?? '')
  const [day,      setDay]      = useState<number>(initial?.day_of_week ?? 0)
  const [time,     setTime]     = useState(initial?.time_start ?? '')
  const [duration, setDuration] = useState<number>(initial?.duration_minutes ?? 30)
  const [intensity, setIntensity] = useState<'low' | 'moderate' | 'high'>(initial?.intensity ?? 'moderate')

  const handleSave = () => {
    if (!name.trim()) return
    onSave({
      member_id:            memberId,
      activity_name:        name.trim(),
      day_of_week:          day,
      time_start:           time || null,
      duration_minutes:     duration,
      intensity,
      calories_burned_estimate: null,
    })
  }

  return (
    <div className="flex flex-col gap-4 pt-1">
      <div>
        <label className="input-label">Actividad</label>
        <input type="text" placeholder="Ej: Correr, Natación, Yoga..."
          value={name} onChange={e => setName(e.target.value)} autoFocus />
      </div>

      <div>
        <label className="input-label">Día de la semana</label>
        <div className="flex gap-1.5 flex-wrap">
          {DAYS.map((d, i) => (
            <button key={i} type="button" onClick={() => setDay(i)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all
                ${day === i ? 'border-accent bg-accent-light text-accent' : 'border-border text-muted'}`}>
              {d}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="input-label">Hora inicio</label>
          <input type="time" value={time} onChange={e => setTime(e.target.value)} />
        </div>
        <div>
          <label className="input-label">Duración (min)</label>
          <input type="number" min={5} max={360} step={5}
            value={duration} onChange={e => setDuration(+e.target.value)} />
        </div>
      </div>

      <div>
        <label className="input-label">Intensidad</label>
        <div className="flex gap-2">
          {INTENSITY.map(i => (
            <button key={i.value} type="button" onClick={() => setIntensity(i.value as typeof intensity)}
              className={`flex-1 py-2 rounded-xl border-2 text-xs font-medium transition-all
                ${intensity === i.value ? i.color + ' border-current' : 'border-border text-muted'}`}>
              {i.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel} className="btn-ghost flex-1 !py-2.5 text-sm">Cancelar</button>
        <button type="button" onClick={handleSave} disabled={!name.trim()}
          className="btn-primary flex-1 !py-2.5 text-sm">Guardar</button>
      </div>
    </div>
  )
}
