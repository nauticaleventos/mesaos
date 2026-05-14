import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { RefreshCw, Printer, Leaf, Zap } from 'lucide-react'
import { useMenuStore } from '../../store/menuStore'
import { useLeftoversStore } from '../../store/leftoversStore'
import { useFamilyStore } from '../../store/familyStore'
import DiaCard from './DiaCard'
import SobradosSheet from './SobradosSheet'
import DiaDificilSheet from './DiaDificilSheet'
import { getMondayOfWeek, DAY_NAMES } from '../../lib/motorMenu'

interface Props {
  onRegenerar: () => void
  generating:  boolean
}

export default function VistaMenu({ onRegenerar, generating }: Props) {
  const { menu }                   = useMenuStore()
  const { family }                 = useFamilyStore()
  const { leftovers, loadLeftovers } = useLeftoversStore()
  const [showSobrados,   setShowSobrados]   = useState(false)
  const [showDiaDificil, setShowDiaDificil] = useState(false)

  // Cargar sobrantes al montar
  useEffect(() => {
    if (family?.id) loadLeftovers(family.id)
  }, [family?.id, loadLeftovers])

  // Construir las 7 fechas de la semana
  const monday = new Date(getMondayOfWeek() + 'T12:00:00')
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })

  const byDay = (day: number) => menu.filter(e => e.day_of_week === day)

  // Estadísticas rápidas
  const cocinadas = menu.filter(e => e.is_main_recipe && e.status === 'cooked').length
  const planeadas = menu.filter(e => e.is_main_recipe).length

  // Mostrar banner mid-semana: miércoles (3), jueves (4) o viernes (5)
  const todayDow = new Date().getDay()  // 0=dom, 3=mié, 4=jue, 5=vie
  const isMidWeek = todayDow >= 3 && todayDow <= 5
  const showSobradosBanner = isMidWeek && planeadas > 0

  return (
    <div className="flex flex-col gap-4">

      {/* Stats + botones */}
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-text">
            Semana del {days[0].toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
          </p>
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
          <button onClick={() => setShowDiaDificil(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-yellow-300 text-yellow-600 text-sm font-medium hover:bg-yellow-50 transition-colors print:hidden">
            <Zap size={15} />
            <span>Día difícil</span>
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
            const dayNum    = i + 1
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

      {/* Banner sobrantes mid-semana */}
      {showSobradosBanner && (
        <button
          onClick={() => setShowSobrados(true)}
          className="flex items-center gap-3 p-3 rounded-2xl border-2 border-oliva/30 bg-oliva-claro/40 text-left hover:border-oliva/60 transition-colors print:hidden">
          <span className="text-2xl flex-shrink-0">🍗</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-oliva">
              ¿Te sobró algo de esta semana?
            </p>
            <p className="text-xs text-muted mt-0.5">
              {leftovers.length > 0
                ? `Tenés ${leftovers.length} sobrante${leftovers.length > 1 ? 's' : ''} registrado${leftovers.length > 1 ? 's' : ''} · Tocá para editar`
                : 'Registrá proteínas sobrantes para agregar a las ensaladas'}
            </p>
          </div>
          <Leaf size={16} className="text-oliva flex-shrink-0" />
        </button>
      )}

      {/* Acceso rápido si hay sobrantes fuera de mid-week */}
      {!showSobradosBanner && leftovers.length > 0 && (
        <button
          onClick={() => setShowSobrados(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-oliva/30 bg-oliva-claro/30 text-sm text-oliva font-medium hover:border-oliva/60 transition-colors print:hidden self-start">
          🍗 {leftovers.length} sobrante{leftovers.length > 1 ? 's' : ''} esta semana
        </button>
      )}

      {/* Cards por día */}
      {days.map((_date, i) => (
        <DiaCard
          key={i}
          dayOfWeek={i + 1}
          date={days[i]}
          entries={byDay(i + 1)}
          leftovers={leftovers}
          onAddSobrante={() => setShowSobrados(true)}
        />
      ))}

      {showDiaDificil && <DiaDificilSheet onClose={() => setShowDiaDificil(false)} />}
      {showSobrados   && createPortal(
        <SobradosSheet onClose={() => setShowSobrados(false)} />,
        document.body
      )}
    </div>
  )
}
