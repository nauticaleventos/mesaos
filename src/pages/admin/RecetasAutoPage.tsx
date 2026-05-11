import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { CONDICIONES_UI } from '../../lib/condicionesMotor'

const ADMIN_EMAIL = 'agbrieva@hotmail.com'

interface LogEntry {
  fecha_generacion:       string
  condicion:              string
  usuarios_con_condicion: number
  recetas_generadas:      number
  costo_estimado:         number | null
}

interface StatsCondicion {
  condicion:    string
  label:        string
  totalRecetas: number
  costoTotal:   number
  usuarios:     number
}

export default function RecetasAutoPage() {
  const navigate          = useNavigate()
  const { session }       = useAuthStore()
  const [log, setLog]     = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [totalRecetasAuto, setTotalRecetasAuto] = useState(0)

  // Guard: solo Ale puede ver esta página
  const userEmail = session?.user?.email
  if (userEmail && userEmail !== ADMIN_EMAIL) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-4xl mb-4">🔒</p>
          <p className="text-text font-semibold">Acceso restringido</p>
          <button onClick={() => navigate('/')} className="btn-ghost mt-4">← Volver</button>
        </div>
      </div>
    )
  }

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    const [{ data: logData }, { count }] = await Promise.all([
      supabase
        .from('auto_generated_recipes_log')
        .select('*')
        .order('fecha_generacion', { ascending: false })
        .limit(200),
      supabase
        .from('recipes')
        .select('*', { count: 'exact', head: true })
        .eq('source', 'auto_generada'),
    ])
    setLog((logData ?? []) as LogEntry[])
    setTotalRecetasAuto(count ?? 0)
    setLoading(false)
  }

  // Agrupar por condición
  const porCondicion: Record<string, StatsCondicion> = {}
  for (const entry of log) {
    if (!porCondicion[entry.condicion]) {
      const ui = CONDICIONES_UI.find(c => c.key === entry.condicion)
      porCondicion[entry.condicion] = {
        condicion:    entry.condicion,
        label:        ui?.label ?? entry.condicion,
        totalRecetas: 0,
        costoTotal:   0,
        usuarios:     0,
      }
    }
    porCondicion[entry.condicion].totalRecetas += entry.recetas_generadas
    porCondicion[entry.condicion].costoTotal   += entry.costo_estimado ?? 0
    porCondicion[entry.condicion].usuarios      = Math.max(
      porCondicion[entry.condicion].usuarios,
      entry.usuarios_con_condicion
    )
  }

  const stats = Object.values(porCondicion).sort((a, b) => b.totalRecetas - a.totalRecetas)
  const costoHistorico = stats.reduce((s, c) => s + c.costoTotal, 0)

  // Agrupar log por mes
  const porMes: Record<string, LogEntry[]> = {}
  for (const entry of log) {
    const mes = entry.fecha_generacion.slice(0, 7)  // YYYY-MM
    if (!porMes[mes]) porMes[mes] = []
    porMes[mes].push(entry)
  }

  return (
    <div className="min-h-screen pb-16 max-w-lg mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/')} className="text-muted hover:text-text transition-colors">←</button>
        <div>
          <h1 className="text-xl font-semibold text-text">Recetas auto-generadas</h1>
          <p className="text-xs text-muted">Panel de monitoreo — solo admin</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="flex gap-1">
            {[0,150,300].map(d => (
              <span key={d} className="w-2 h-2 rounded-full bg-accent animate-bounce" style={{ animationDelay: `${d}ms` }} />
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-6">

          {/* Resumen total */}
          <div className="card flex flex-col gap-3">
            <p className="text-sm font-semibold text-text">Resumen histórico</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-accent-light rounded-xl p-3">
                <p className="text-xs text-muted">Recetas generadas</p>
                <p className="text-2xl font-bold text-accent">{totalRecetasAuto}</p>
              </div>
              <div className="bg-oliva-claro/40 rounded-xl p-3">
                <p className="text-xs text-muted">Costo acumulado</p>
                <p className="text-2xl font-bold text-oliva">${costoHistorico.toFixed(2)}</p>
              </div>
            </div>
          </div>

          {/* Top por condición */}
          {stats.length > 0 && (
            <div className="card">
              <p className="text-sm font-semibold text-text mb-3">Por condición de salud</p>
              <div className="flex flex-col gap-2">
                {stats.map(s => (
                  <div key={s.condicion} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div>
                      <p className="text-sm text-text">{s.label}</p>
                      <p className="text-xs text-muted">{s.usuarios} usuario{s.usuarios !== 1 ? 's' : ''}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-text">{s.totalRecetas} recetas</p>
                      <p className="text-xs text-muted">${s.costoTotal.toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Historial por mes */}
          {Object.entries(porMes).map(([mes, entries]) => {
            const totalMes      = entries.reduce((s, e) => s + e.recetas_generadas, 0)
            const costoMes      = entries.reduce((s, e) => s + (e.costo_estimado ?? 0), 0)
            const [año, mesNum] = mes.split('-')
            const nombre = new Date(Number(año), Number(mesNum) - 1, 1)
              .toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })

            return (
              <div key={mes} className="card">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-text capitalize">{nombre}</p>
                  <p className="text-xs text-muted">{totalMes} recetas · ${costoMes.toFixed(2)}</p>
                </div>
                <div className="flex flex-col gap-1">
                  {entries.sort((a, b) => b.recetas_generadas - a.recetas_generadas).map((e, i) => {
                    const ui = CONDICIONES_UI.find(c => c.key === e.condicion)
                    return (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-muted">{ui?.label ?? e.condicion}</span>
                        <span className="text-text">
                          {e.recetas_generadas} recetas · ${(e.costo_estimado ?? 0).toFixed(2)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {log.length === 0 && (
            <div className="card text-center py-8">
              <p className="text-4xl mb-3">🤖</p>
              <p className="font-semibold text-text">Sin generaciones todavía</p>
              <p className="text-sm text-muted mt-1">El cron se ejecuta el día 1 de cada mes.</p>
            </div>
          )}

        </div>
      )}
    </div>
  )
}
