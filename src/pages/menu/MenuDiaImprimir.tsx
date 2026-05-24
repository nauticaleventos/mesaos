/**
 * MenuDiaImprimir
 * PDF del día completo con recetas para el chef.
 * Ruta: /menu/compartido/:token/dia/:dow
 * Sin cuenta requerida.
 */

import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

const MEAL_LABEL: Record<string, string> = {
  desayuno: '☀️ Desayuno',
  almuerzo: '🍽 Almuerzo',
  cena:     '🌙 Cena',
  snack:    '🍿 Merienda',
}
const MEAL_ORDER = ['desayuno', 'almuerzo', 'snack', 'cena']

interface Recipe {
  nombre:           string
  tiempo_total_min: number | null
  porciones:        number | null
  imagen_url?:      string | null
  ingredientes?:    { nombre: string; cantidad: number | null; unidad: string | null; esencial: boolean }[]
  pasos?:           string[]
}

interface Entry {
  day_of_week:    number
  meal_type:      string
  is_main_recipe: boolean
  nombre_custom?: string | null
  status:         string
  recipe?:        Recipe | null
}

export default function MenuDiaImprimir() {
  const { token, dow: dowParam } = useParams<{ token: string; dow: string }>()
  const [entries,  setEntries]  = useState<Entry[]>([])
  const [members,  setMembers]  = useState<{ name: string; emoji: string }[]>([])
  const [weekStart, setWeekStart] = useState('')
  const [loaded,   setLoaded]   = useState(false)
  const [printed,  setPrinted]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  const dow = parseInt(dowParam ?? '1', 10)

  useEffect(() => {
    if (!token) return
    fetch(`/api/menu-compartido?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); return }
        setEntries((data.entries ?? []).filter((e: Entry) => e.day_of_week === dow))
        setMembers(data.members ?? [])
        setWeekStart(data.week_start ?? '')
        setLoaded(true)
      })
      .catch(() => { setError('Error al cargar'); setLoaded(true) })
  }, [token, dow])

  useEffect(() => {
    if (!loaded || printed) return
    const t = setTimeout(() => { window.print(); setPrinted(true) }, 700)
    return () => clearTimeout(t)
  }, [loaded, printed])

  const wsDate = weekStart ? new Date(weekStart + 'T12:00:00') : null
  const fecha  = wsDate ? (() => {
    const d = new Date(wsDate); d.setDate(d.getDate() + (dow - 1))
    return d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
  })() : ''

  const byMeal: Record<string, Entry[]> = {}
  for (const e of entries) {
    if (!byMeal[e.meal_type]) byMeal[e.meal_type] = []
    byMeal[e.meal_type].push(e)
  }
  const mealTypes = MEAL_ORDER.filter(m => byMeal[m])

  if (!loaded) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <p style={{ color: '#888', fontSize: 14 }}>Preparando PDF del día...</p>
    </div>
  )

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', sans-serif; font-size: 11px; color: #1a1a1a; background: white; }

        .page { width: 210mm; padding: 14mm 16mm; page-break-after: always; }
        .page:last-child { page-break-after: avoid; }

        .header { border-bottom: 2px solid #1a1a1a; padding-bottom: 8px; margin-bottom: 14px; }
        .header h1 { font-size: 18px; font-weight: 700; text-transform: capitalize; }
        .header .sub { font-size: 10px; color: #555; margin-top: 2px; }

        .meal-block { margin-bottom: 16px; border: 1px solid #ddd; border-radius: 8px; overflow: hidden; }
        .meal-header { background: #f5f5f5; padding: 6px 10px; font-size: 10px; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.05em; color: #333; }
        .meal-body { padding: 10px; }

        .recipe-name { font-size: 15px; font-weight: 700; margin-bottom: 4px; }
        .recipe-meta { font-size: 9px; color: #666; margin-bottom: 10px; }

        .photo { width: 100%; max-height: 80px; object-fit: cover; border-bottom: 1px solid #eee; }

        h4 { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;
          color: #555; margin-bottom: 5px; margin-top: 8px; }
        h4:first-child { margin-top: 0; }

        .ings { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 16px; }
        .ing { font-size: 10px; display: flex; gap: 4px; }
        .ing::before { content: '•'; color: #E76F51; flex-shrink: 0; }

        .pasos { list-style: none; display: flex; flex-col: column; gap: 5px; }
        .pasos li { font-size: 10px; display: flex; gap: 6px; line-height: 1.4; }
        .num { width: 16px; height: 16px; border-radius: 50%; background: #f0ede6; color: #333;
          font-weight: 700; font-size: 8px; display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; margin-top: 1px; }

        .members { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px;
          padding-top: 6px; border-top: 1px solid #eee; font-size: 9px; color: #555; }

        .no-print { display: none; }
        .error { padding: 20px; color: #888; text-align: center; }
        @media print {
          @page { size: A4 portrait; margin: 0; }
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
        <button className="btn btn-ghost" onClick={() => window.close()}>← Volver</button>
        <button className="btn btn-primary" onClick={() => window.print()}>🖨 Imprimir / PDF</button>
      </div>

      {error && <div className="error">{error}</div>}

      {!error && mealTypes.map(mt => {
        const main = byMeal[mt].find(e => e.is_main_recipe) ?? byMeal[mt][0]
        const r    = main?.recipe
        if (!r && !main?.nombre_custom) return null
        const ings = r?.ingredientes ?? []
        const esenciales = ings.filter(i => i.esencial)
        const opcionales = ings.filter(i => !i.esencial)

        return (
          <div key={mt} className="page">
            <div className="header">
              <h1>{fecha}</h1>
              <div className="sub">{MEAL_LABEL[mt] ?? mt} · mesa.os</div>
            </div>

            <div className="meal-block">
              <div className="meal-header">{MEAL_LABEL[mt] ?? mt}</div>
              {r?.imagen_url && (
                <img src={r.imagen_url} alt={r.nombre} className="photo" />
              )}
              <div className="meal-body">
                <div className="recipe-name">{r?.nombre ?? main?.nombre_custom}</div>
                {(r?.tiempo_total_min || r?.porciones) && (
                  <div className="recipe-meta">
                    {r?.tiempo_total_min && `⏱ ${r.tiempo_total_min} min`}
                    {r?.tiempo_total_min && r?.porciones && ' · '}
                    {r?.porciones && `👥 ${r.porciones} porciones`}
                  </div>
                )}

                {esenciales.length > 0 && (
                  <>
                    <h4>Ingredientes</h4>
                    <div className="ings">
                      {esenciales.map((i, idx) => (
                        <div key={idx} className="ing">
                          <span>{i.nombre}</span>
                          {i.cantidad && <span style={{ color: '#777' }}>{i.cantidad} {i.unidad ?? ''}</span>}
                        </div>
                      ))}
                    </div>
                  </>
                )}
                {opcionales.length > 0 && (
                  <>
                    <h4>Opcionales</h4>
                    <div className="ings">
                      {opcionales.map((i, idx) => (
                        <div key={idx} className="ing">
                          <span>{i.nombre}</span>
                          {i.cantidad && <span style={{ color: '#777' }}>{i.cantidad} {i.unidad ?? ''}</span>}
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {r?.pasos && r.pasos.length > 0 && (
                  <>
                    <h4>Preparación</h4>
                    <ol className="pasos">
                      {r.pasos.map((paso, i) => (
                        <li key={i}><span className="num">{i+1}</span><span>{paso}</span></li>
                      ))}
                    </ol>
                  </>
                )}

                {members.length > 0 && (
                  <div className="members">
                    <strong>Para:</strong>
                    {members.map((m, i) => <span key={i}>{m.emoji} {m.name}</span>)}
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}

      {mealTypes.length === 0 && !error && (
        <div className="page">
          <div className="header"><h1>{fecha}</h1></div>
          <p style={{ color: '#888', marginTop: 20 }}>No hay recetas para este día.</p>
        </div>
      )}
    </>
  )
}
