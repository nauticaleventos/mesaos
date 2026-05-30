/**
 * MenuImprimir
 * Vista A4 imprimible del menú semanal.
 * Ruta: /menu/imprimir/:weekStart
 * Abre en pestaña nueva y dispara window.print()
 */

import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { getMondayOfWeek } from '../../lib/motorMenu'

const DAY_NAMES_FULL = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const MEAL_LABEL: Record<string, string> = {
  desayuno: '☀️ Desayuno',
  almuerzo: '🍽 Almuerzo',
  cena:     '🌙 Cena',
  snack:    '🍿 Merienda',
}
const MEAL_ORDER = ['desayuno', 'almuerzo', 'snack', 'cena']

interface EntryRow {
  day_of_week:    number
  meal_type:      string
  meal_time?:     string
  is_main_recipe: boolean
  recipe_id:      string | null
  nombre_custom?: string | null
  status:         string
  recipe?:        { nombre: string; tiempo_total_min: number | null; porciones: number | null } | null
}

export default function MenuImprimir() {
  const { weekStart: wsParam } = useParams<{ weekStart: string }>()
  const [entries, setEntries] = useState<EntryRow[]>([])
  const [loaded,  setLoaded]  = useState(false)
  const [printed, setPrinted] = useState(false)

  const ws = wsParam ?? getMondayOfWeek()

  useEffect(() => {
    // Obtener familia del usuario actual
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: fu } = await supabase
        .from('family_users').select('family_id').eq('user_id', user.id).single()
      if (!fu) return

      const { data: rows } = await supabase
        .from('weekly_menu')
        .select('day_of_week, meal_type, meal_time, is_main_recipe, recipe_id, nombre_custom, status')
        .eq('family_id', fu.family_id)
        .eq('week_start', ws)
        .order('day_of_week')
        .order('meal_type')

      if (!rows?.length) { setLoaded(true); return }

      const ids = [...new Set(rows.map((r: { recipe_id: string | null }) => r.recipe_id).filter(Boolean))] as string[]
      const { data: recipes } = ids.length
        ? await supabase.from('recipes').select('id, nombre, tiempo_total_min, porciones').in('id', ids)
        : { data: [] }
      const rMap = new Map((recipes ?? []).map(r => [r.id, r]))

      setEntries(rows.map((r: EntryRow) => ({ ...r, recipe: r.recipe_id ? rMap.get(r.recipe_id) ?? null : null })))
      setLoaded(true)
    })
  }, [ws])

  useEffect(() => {
    if (!loaded || printed) return
    const t = setTimeout(() => { window.print(); setPrinted(true) }, 600)
    return () => clearTimeout(t)
  }, [loaded, printed])

  // Agrupar por día
  const byDay: Record<number, EntryRow[]> = {}
  for (const e of entries) {
    if (!byDay[e.day_of_week]) byDay[e.day_of_week] = []
    byDay[e.day_of_week].push(e)
  }

  const days = [1, 2, 3, 4, 5, 6, 7].filter(d => byDay[d]?.length)

  const wsDate = new Date(ws + 'T12:00:00')
  const fmtDate = (dow: number) => {
    const d = new Date(wsDate)
    d.setDate(d.getDate() + (dow - 1))
    return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
  }

  if (!loaded) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <p style={{ color: '#888', fontSize: 14 }}>Preparando PDF...</p>
    </div>
  )

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', sans-serif; font-size: 11px; color: #1a1a1a; background: white; }

        .page { width: 210mm; min-height: 148mm; padding: 12mm 14mm; page-break-after: always; }
        .page:last-child { page-break-after: avoid; }

        .header { display: flex; justify-content: space-between; align-items: baseline;
          border-bottom: 2px solid #1a1a1a; padding-bottom: 6px; margin-bottom: 10px; }
        .header h1 { font-size: 16px; font-weight: 700; }
        .header span { font-size: 10px; color: #555; }

        .days-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
        .days-grid-3 { grid-template-columns: repeat(3, 1fr); }

        .day { border: 1px solid #ddd; border-radius: 6px; padding: 6px 8px; }
        .day-title { font-weight: 700; font-size: 12px; border-bottom: 1px solid #eee;
          padding-bottom: 4px; margin-bottom: 6px; display: flex; justify-content: space-between; }
        .day-date { font-weight: 400; font-size: 10px; color: #666; }

        .meal { margin-bottom: 5px; }
        .meal-label { font-size: 9px; font-weight: 600; color: #555; text-transform: uppercase;
          letter-spacing: 0.04em; margin-bottom: 1px; }
        .meal-recipe { font-size: 10px; font-weight: 600; line-height: 1.3; }
        .meal-meta { font-size: 9px; color: #777; }
        .meal-skipped { text-decoration: line-through; color: #aaa; }
        .meal-cooked { color: #555; }
        .meal-cooked::after { content: ' ✓'; color: #22c55e; }

        .notes { margin-top: 10px; border-top: 1px solid #ddd; padding-top: 8px; }
        .notes h3 { font-size: 10px; font-weight: 700; margin-bottom: 4px; }
        .notes ul { list-style: none; display: flex; flex-wrap: wrap; gap: 4px 12px; }
        .notes li { font-size: 9px; color: #555; }

        .no-print { display: none; }
        @media print {
          @page { size: A4 landscape; margin: 0; }
          .page { page-break-after: always; }
        }
        @media screen {
          body { background: #f5f5f5; }
          .page { margin: 20px auto; box-shadow: 0 2px 8px rgba(0,0,0,0.15); }
          .no-print { display: flex; gap: 8px; justify-content: center; padding: 12px; }
          .btn { padding: 8px 16px; border-radius: 6px; font-size: 13px; cursor: pointer; border: none; }
          .btn-primary { background: #E76F51; color: white; font-weight: 600; }
          .btn-ghost { background: white; color: #555; border: 1px solid #ddd; }
        }
      `}</style>

      <div className="no-print">
        <button className="btn btn-ghost" onClick={() => window.close()}>← Cerrar</button>
        <button className="btn btn-primary" onClick={() => window.print()}>🖨 Imprimir / Guardar PDF</button>
      </div>

      {/* Página 1: días 1-4 */}
      {days.slice(0, 4).length > 0 && (
        <div className="page">
          <div className="header">
            <h1>Menú semanal · mesa.os</h1>
            <span>Semana del {fmtDate(1)} al {fmtDate(7)}</span>
          </div>
          <div className={`days-grid ${days.slice(0, 4).length === 3 ? 'days-grid-3' : ''}`}>
            {days.slice(0, 4).map(dow => <DayBlock key={dow} dow={dow} rows={byDay[dow]} fmtDate={fmtDate} />)}
          </div>
        </div>
      )}

      {/* Página 2: días 5-7 */}
      {days.slice(4).length > 0 && (
        <div className="page">
          <div className="header">
            <h1>Menú semanal · mesa.os</h1>
            <span>Fin de semana · {fmtDate(5)} – {fmtDate(7)}</span>
          </div>
          <div className="days-grid days-grid-3">
            {days.slice(4).map(dow => <DayBlock key={dow} dow={dow} rows={byDay[dow]} fmtDate={fmtDate} />)}
          </div>
          <div className="notes">
            <h3>📝 Notas</h3>
            <ul>
              {entries.filter(e => e.status === 'cooked').map((e, i) => (
                <li key={i}>✓ {DAY_NAMES_FULL[e.day_of_week]} {MEAL_LABEL[e.meal_type] ?? e.meal_type}: {e.recipe?.nombre ?? e.nombre_custom}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {days.length === 0 && (
        <div className="page">
          <div className="header"><h1>Menú semanal · mesa.os</h1></div>
          <p style={{ color: '#888', marginTop: 20 }}>No hay menú generado para esta semana.</p>
        </div>
      )}
    </>
  )
}

function mealSortOrder(k: string): number {
  if (k.includes('desayuno') || k.includes('brunch')) return 0
  if (k.includes('merienda') && k.includes('ma'))     return 1
  if (k.includes('almuerzo') || k.includes('comida')) return 2
  if (k.includes('merienda') && k.includes('tard'))   return 3
  if (k.includes('snack') || k.includes('merienda') || k.includes('onces')) return 3
  if (k.includes('cena'))                             return 4
  return 5
}

function DayBlock({ dow, rows, fmtDate }: { dow: number; rows: EntryRow[]; fmtDate: (d: number) => string }) {
  const byMeal: Record<string, EntryRow[]> = {}
  for (const r of rows) {
    const key = r.meal_type.toLowerCase().trim()
    if (!byMeal[key]) byMeal[key] = []
    byMeal[key].push(r)
  }
  const mealTypes = Object.keys(byMeal).sort((a, b) => mealSortOrder(a) - mealSortOrder(b))

  return (
    <div className="day">
      <div className="day-title">
        {DAY_NAMES_FULL[dow]}
        <span className="day-date">{fmtDate(dow)}</span>
      </div>
      {mealTypes.map(mt => {
        const main = byMeal[mt].find(r => r.is_main_recipe) ?? byMeal[mt][0]
        const nombre = main.recipe?.nombre ?? main.nombre_custom ?? '—'
        const mins = main.recipe?.tiempo_total_min
        const cls = main.status === 'skipped' ? 'meal-skipped' : main.status === 'cooked' ? 'meal-cooked' : ''
        return (
          <div key={mt} className="meal">
            <div className="meal-label">{MEAL_LABEL[mt] ?? mt}</div>
            <div className={`meal-recipe ${cls}`}>{nombre}</div>
            {mins && <div className="meal-meta">⏱ {mins} min</div>}
          </div>
        )
      })}
    </div>
  )
}
