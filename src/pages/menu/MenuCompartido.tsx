/**
 * MenuCompartido
 * Vista pública de solo lectura del menú semanal.
 * No requiere cuenta en mesa.os.
 * Ruta: /menu/compartido/:token
 */

import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ChefHat, Clock, Calendar } from 'lucide-react'

const DAY_NAMES_FULL = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const MEAL_LABEL: Record<string, { label: string; emoji: string }> = {
  desayuno: { label: 'Desayuno',  emoji: '☀️' },
  almuerzo: { label: 'Almuerzo',  emoji: '🍽️' },
  cena:     { label: 'Cena',      emoji: '🌙' },
  snack:    { label: 'Merienda',  emoji: '🍿' },
}
const MEAL_ORDER = ['desayuno', 'almuerzo', 'snack', 'cena']

interface Entry {
  day_of_week:    number
  meal_type:      string
  is_main_recipe: boolean
  recipe_id:      string | null
  nombre_custom?: string | null
  status:         string
  recipe?: {
    nombre:          string
    tiempo_total_min: number | null
    porciones:        number | null
    imagen_url?:      string | null
    ingredientes?:    { nombre: string; cantidad: number | null; unidad: string | null; esencial: boolean }[]
    pasos?:           string[]
  } | null
}

interface Member { id: string; name: string; emoji: string }

export default function MenuCompartido() {
  const { token } = useParams<{ token: string }>()
  const [entries,    setEntries]    = useState<Entry[]>([])
  const [members,    setMembers]    = useState<Member[]>([])
  const [weekStart,  setWeekStart]  = useState('')
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string | null>(null)
  const [selectedDay, setSelectedDay] = useState<number | null>(null)

  useEffect(() => {
    if (!token) return
    fetch(`/api/menu-compartido?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); return }
        setEntries(data.entries ?? [])
        setMembers(data.members ?? [])
        setWeekStart(data.week_start ?? '')
        if (data.entries?.length) {
          setSelectedDay(data.entries[0].day_of_week)
        }
      })
      .catch(() => setError('Error al cargar el menú'))
      .finally(() => setLoading(false))
  }, [token])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#FBF5E5]">
      <div className="flex flex-col items-center gap-3">
        <ChefHat size={32} className="text-accent animate-pulse" />
        <p className="text-sm text-muted">Cargando menú...</p>
      </div>
    </div>
  )

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-[#FBF5E5] px-4">
      <div className="card max-w-sm w-full p-6 text-center flex flex-col gap-3">
        <span className="text-4xl">😞</span>
        <p className="font-semibold text-text">{error}</p>
        <p className="text-sm text-muted">Pedile al chef que genere un nuevo link.</p>
      </div>
    </div>
  )

  // Agrupar por día
  const byDay: Record<number, Entry[]> = {}
  for (const e of entries) {
    if (!byDay[e.day_of_week]) byDay[e.day_of_week] = []
    byDay[e.day_of_week].push(e)
  }
  const days = [1,2,3,4,5,6,7].filter(d => byDay[d]?.length)

  const wsDate   = weekStart ? new Date(weekStart + 'T12:00:00') : null
  const fmtDate  = (dow: number) => {
    if (!wsDate) return ''
    const d = new Date(wsDate); d.setDate(d.getDate() + (dow - 1))
    return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
  }

  const dayEntries = selectedDay ? (byDay[selectedDay] ?? []) : []
  const byMeal: Record<string, Entry[]> = {}
  for (const e of dayEntries) {
    if (!byMeal[e.meal_type]) byMeal[e.meal_type] = []
    byMeal[e.meal_type].push(e)
  }
  const mealTypes = MEAL_ORDER.filter(m => byMeal[m])

  return (
    <div className="min-h-screen bg-[#FBF5E5] pb-12">
      {/* Header */}
      <div className="bg-white border-b border-border px-4 py-4 flex items-center gap-3">
        <ChefHat size={22} className="text-accent flex-shrink-0" />
        <div>
          <p className="font-bold text-text">Menú semanal</p>
          {weekStart && (
            <p className="text-xs text-muted flex items-center gap-1">
              <Calendar size={10} /> Semana del {fmtDate(1)} al {fmtDate(7)}
            </p>
          )}
        </div>
        <span className="ml-auto text-xs text-muted bg-gray-100 px-2 py-0.5 rounded-full">Solo lectura</span>
      </div>

      {/* Selector de días */}
      <div className="overflow-x-auto px-4 py-3 flex gap-2 border-b border-border bg-white">
        {days.map(dow => (
          <button key={dow} onClick={() => setSelectedDay(dow)}
            className={`flex-shrink-0 flex flex-col items-center px-3 py-2 rounded-xl border-2 transition-all
              ${selectedDay === dow ? 'border-accent bg-accent/8' : 'border-border bg-white hover:border-accent/40'}`}>
            <span className={`text-[11px] font-bold uppercase ${selectedDay === dow ? 'text-accent' : 'text-muted'}`}>
              {DAY_NAMES_FULL[dow].slice(0,3)}
            </span>
            <span className="text-xs text-muted mt-0.5">{fmtDate(dow)}</span>
          </button>
        ))}
      </div>

      {/* Comidas del día seleccionado */}
      <div className="px-4 py-4 flex flex-col gap-4 max-w-lg mx-auto">
        {selectedDay && (
          <p className="font-bold text-text text-lg">{DAY_NAMES_FULL[selectedDay]} · {fmtDate(selectedDay)}</p>
        )}

        {mealTypes.map(mt => {
          const mains = byMeal[mt].filter(e => e.is_main_recipe)
          const main  = mains[0]
          if (!main) return null
          const ml = MEAL_LABEL[mt] ?? { label: mt, emoji: '🍴' }
          return (
            <div key={mt} className="card overflow-hidden p-0">
              {/* Foto */}
              {main.recipe?.imagen_url && (
                <div className="w-full h-36 overflow-hidden">
                  <img src={main.recipe.imagen_url} alt={main.recipe?.nombre}
                    className="w-full h-full object-cover" />
                </div>
              )}
              <div className="p-4 flex flex-col gap-3">
                {/* Label comida */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-accent uppercase tracking-wider">
                    {ml.emoji} {ml.label}
                  </span>
                  {main.recipe?.tiempo_total_min && (
                    <span className="text-xs text-muted flex items-center gap-1">
                      <Clock size={11} /> {main.recipe.tiempo_total_min} min
                    </span>
                  )}
                </div>

                <p className="font-bold text-text text-base leading-tight">
                  {main.recipe?.nombre ?? main.nombre_custom ?? '—'}
                </p>

                {/* Ingredientes */}
                {main.recipe?.ingredientes && main.recipe.ingredientes.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Ingredientes</p>
                    <div className="flex flex-col gap-1">
                      {main.recipe.ingredientes.filter(i => i.esencial).map((ing, i) => (
                        <div key={i} className="flex items-baseline gap-1.5 text-sm">
                          <span className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0 mt-1.5" />
                          <span className="text-text">{ing.nombre}</span>
                          {ing.cantidad && (
                            <span className="text-muted text-xs">
                              {ing.cantidad} {ing.unidad ?? ''}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Pasos */}
                {main.recipe?.pasos && main.recipe.pasos.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Preparación</p>
                    <div className="flex flex-col gap-2">
                      {main.recipe.pasos.map((paso, i) => (
                        <div key={i} className="flex gap-2.5 text-sm">
                          <span className="w-5 h-5 rounded-full bg-accent/15 text-accent font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                            {i + 1}
                          </span>
                          <p className="text-text leading-snug">{paso}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Miembros */}
                {members.length > 0 && (
                  <div className="flex gap-1.5 flex-wrap pt-1 border-t border-border">
                    {members.map(m => (
                      <span key={m.id} className="text-xs text-muted bg-gray-50 px-2 py-0.5 rounded-full">
                        {m.emoji} {m.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {mealTypes.length === 0 && (
          <p className="text-center text-muted py-8">No hay comidas para este día.</p>
        )}
      </div>

      {/* Footer */}
      <div className="text-center py-6">
        <p className="text-xs text-muted">Menú generado con <strong>mesa.os</strong></p>
      </div>
    </div>
  )
}
