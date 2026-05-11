import { RefreshCw, Printer } from 'lucide-react'
import { useMenuStore } from '../../store/menuStore'
import DiaCard from './DiaCard'
import { getMondayOfWeek, DAY_NAMES } from '../../lib/motorMenu'

interface Props {
  onRegenerar: () => void
  generating:  boolean
}

export default function VistaMenu({ onRegenerar, generating }: Props) {
  const { menu } = useMenuStore()

  // Construir las 7 fechas de la semana
  const monday = new Date(getMondayOfWeek() + 'T12:00:00')
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })

  const altEntries  = menu.filter(e => !e.is_main_recipe)

  const mainByDay   = (day: number) => menu.filter(e => e.day_of_week === day && e.is_main_recipe)
  const altsByDay   = (day: number) => altEntries.filter(e => e.day_of_week === day)

  // Estadísticas rápidas
  const cocinadas  = menu.filter(e => e.is_main_recipe && e.status === 'cooked').length
  const planeadas  = menu.filter(e => e.is_main_recipe).length

  return (
    <div className="flex flex-col gap-4">
      {/* Stats + botón regenerar */}
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-text">Semana del {days[0].toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}</p>
          {planeadas > 0 && (
            <p className="text-xs text-muted mt-0.5">
              {cocinadas} de {planeadas} comidas cocinadas
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-muted text-sm font-medium hover:border-accent hover:text-accent transition-colors print:hidden">
            <Printer size={15} />
          </button>
          <button onClick={onRegenerar} disabled={generating}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-accent text-accent text-sm font-medium hover:bg-accent/5 transition-colors disabled:opacity-40 print:hidden">
            <RefreshCw size={15} className={generating ? 'animate-spin' : ''} />
            Regenerar
          </button>
        </div>
      </div>

      {/* Progreso semanal */}
      {planeadas > 0 && (
        <div className="flex gap-1">
          {days.map((_d, i) => {
            const dayNum  = i + 1
            const hasCooked = menu.some(e => e.day_of_week === dayNum && e.is_main_recipe && e.status === 'cooked')
            const hasPlanned= menu.some(e => e.day_of_week === dayNum && e.is_main_recipe)
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] text-muted">{DAY_NAMES[dayNum]}</span>
                <div className={`w-full h-1.5 rounded-full ${hasCooked ? 'bg-oliva' : hasPlanned ? 'bg-accent/30' : 'bg-border'}`} />
              </div>
            )
          })}
        </div>
      )}

      {/* Cards por día */}
      {days.map((_date, i) => (
        <DiaCard
          key={i}
          dayOfWeek={i + 1}
          date={days[i]}
          entries={mainByDay(i + 1)}
          altEntries={altsByDay(i + 1)}
        />
      ))}
    </div>
  )
}
