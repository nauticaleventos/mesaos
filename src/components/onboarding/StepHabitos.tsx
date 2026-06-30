import { useState } from 'react'
import { useFamilyStore } from '../../store/familyStore'

interface Props { onContinue: () => void }

const COCCION = [
  { v: 'diario_varias', emoji: '🔥', label: 'Diario, varias veces',  conDias: false },
  { v: 'diario_una',    emoji: '☀️', label: 'Diario, una sola vez',  conDias: false },
  { v: '2x_semana',     emoji: '🍱', label: '2 veces por semana',     conDias: true  },
  { v: '1x_semana',     emoji: '📦', label: '1 vez por semana',       conDias: true  },
]

const MERCADO = [
  { v: 'diario',    emoji: '🛒', label: 'Diario',    sub: 'lo necesario del día' },
  { v: 'semanal',   emoji: '📅', label: 'Semanal',   sub: '' },
  { v: 'quincenal', emoji: '🗓️', label: 'Quincenal', sub: '' },
  { v: 'mensual',   emoji: '📆', label: 'Mensual',   sub: '' },
]

const DIAS = [['1','L'],['2','M'],['3','X'],['4','J'],['5','V'],['6','S'],['7','D']]

export default function StepHabitos({ onContinue }: Props) {
  const { updateFamily } = useFamilyStore()
  const [coccion, setCoccion]   = useState('diario_varias')
  const [dias, setDias]         = useState<string[]>([])
  const [mercado, setMercado]   = useState('semanal')
  const [saving, setSaving]     = useState(false)

  const necesitaDias = COCCION.find(c => c.v === coccion)?.conDias
  const toggleDia = (d: string) => setDias(s => s.includes(d) ? s.filter(x => x !== d) : [...s, d])

  const guardar = async () => {
    setSaving(true)
    await updateFamily({
      frecuencia_coccion: coccion,
      dias_coccion: necesitaDias ? dias : null,
      frecuencia_mercado: mercado,
    })
    setSaving(false)
    onContinue()
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-serif font-semibold text-text">Tus hábitos en la cocina</h2>
        <p className="text-muted text-sm mt-1">Para armar tu menú y tu mercado a tu medida.</p>
      </div>

      {/* Pregunta A — cocción */}
      <div>
        <p className="text-sm font-semibold text-text mb-2">¿Con qué frecuencia cocinas?</p>
        <div className="flex flex-col gap-2">
          {COCCION.map(c => (
            <button key={c.v} type="button" onClick={() => setCoccion(c.v)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
                coccion === c.v ? 'border-accent bg-accent/5' : 'border-border bg-white hover:border-accent/50'}`}>
              <span className="text-xl">{c.emoji}</span>
              <span className={`text-sm font-medium ${coccion === c.v ? 'text-accent' : 'text-text'}`}>{c.label}</span>
            </button>
          ))}
        </div>
        {necesitaDias && (
          <div className="mt-3">
            <p className="text-xs text-muted mb-1.5">¿Qué días cocinas?</p>
            <div className="flex gap-2">
              {DIAS.map(([v, l]) => (
                <button key={v} type="button" onClick={() => toggleDia(v)}
                  className={`w-9 h-9 rounded-full text-sm font-semibold border transition-all ${
                    dias.includes(v) ? 'bg-accent text-white border-accent' : 'bg-white text-muted border-border'}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Pregunta B — mercado */}
      <div>
        <p className="text-sm font-semibold text-text mb-2">¿Cada cuánto haces mercado?</p>
        <div className="grid grid-cols-2 gap-2">
          {MERCADO.map(m => (
            <button key={m.v} type="button" onClick={() => setMercado(m.v)}
              className={`flex flex-col items-start px-4 py-3 rounded-xl border text-left transition-all ${
                mercado === m.v ? 'border-accent bg-accent/5' : 'border-border bg-white hover:border-accent/50'}`}>
              <span className="text-xl">{m.emoji}</span>
              <span className={`text-sm font-medium mt-1 ${mercado === m.v ? 'text-accent' : 'text-text'}`}>{m.label}</span>
              {m.sub && <span className="text-[10px] text-muted">{m.sub}</span>}
            </button>
          ))}
        </div>
        {mercado === 'mensual' && <p className="text-xs text-muted mt-2">Genial — al generar el menú te sugeriremos 4 semanas de una.</p>}
        {mercado === 'quincenal' && <p className="text-xs text-muted mt-2">Al generar el menú te sugeriremos 2 semanas.</p>}
      </div>

      <button onClick={guardar} disabled={saving} className="btn-primary disabled:opacity-60">
        {saving ? 'Guardando…' : 'Continuar'}
      </button>
    </div>
  )
}
