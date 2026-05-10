import { useEffect, useState } from 'react'
import { useFamilyStore } from '../../store/familyStore'
import type { MemberActivity } from '../../lib/types'
import ActividadForm from './ActividadForm'

const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const INTENSITY_LABEL: Record<string, string> = { low: 'Baja', moderate: 'Moderada', high: 'Alta' }
const INTENSITY_COLOR: Record<string, string> = {
  low: 'text-green-700 bg-green-50',
  moderate: 'text-yellow-700 bg-yellow-50',
  high: 'text-red-700 bg-red-50',
}

interface Props { memberId: string }

export default function ActividadesList({ memberId }: Props) {
  const { activities, loadActivities, addActivity, deleteActivity } = useFamilyStore()
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    loadActivities(memberId)
  }, [memberId, loadActivities])

  const memberActivities = activities.filter(a => a.member_id === memberId)
    .sort((a, b) => (a.day_of_week ?? 0) - (b.day_of_week ?? 0))

  const handleSave = async (data: Omit<MemberActivity, 'id' | 'created_at'>) => {
    await addActivity(data)
    setShowForm(false)
  }

  if (showForm) {
    return (
      <ActividadForm
        memberId={memberId}
        onSave={handleSave}
        onCancel={() => setShowForm(false)}
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {memberActivities.length === 0 ? (
        <p className="text-xs text-muted text-center py-2">Sin actividades registradas</p>
      ) : (
        <div className="flex flex-col gap-2">
          {memberActivities.map(act => (
            <div key={act.id} className="flex items-center gap-3 p-2.5 bg-surface rounded-xl border border-border">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-text truncate">{act.activity_name}</span>
                  {act.intensity && (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${INTENSITY_COLOR[act.intensity]}`}>
                      {INTENSITY_LABEL[act.intensity]}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted mt-0.5">
                  {act.day_of_week !== null ? DAYS[act.day_of_week] : '—'}
                  {act.time_start ? ` · ${act.time_start.slice(0,5)}` : ''}
                  {act.duration_minutes ? ` · ${act.duration_minutes}min` : ''}
                </p>
              </div>
              <button type="button" onClick={() => deleteActivity(act.id)}
                className="text-muted hover:text-error transition-colors text-lg leading-none flex-shrink-0">
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <button type="button" onClick={() => setShowForm(true)}
        className="text-accent text-sm font-medium flex items-center gap-1 hover:opacity-80 transition-opacity">
        + Agregar actividad
      </button>
    </div>
  )
}
