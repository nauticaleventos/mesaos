import { useState } from 'react'
import { parseQuickList, type FoodFromPhoto } from '../../lib/claude'
import type { FridgeItem, NewFridgeItem } from '../../store/fridgeStore'

interface SavedResult {
  name:    string
  success: boolean
  error?:  string
  item?:   FridgeItem
}

interface Props {
  onSave: (item: NewFridgeItem) => Promise<FridgeItem | null>
  onEdit: (item: FridgeItem) => void
  onDone: () => void
}

const PLACEHOLDER = `Escribe un alimento por línea. Ejemplos:
3 bolsas de leche Alpina entera
1 bolsa de Milo en polvo 400g
2 aguacates
1 pollo entero
Queso costeño`

const toNewItem = (f: FoodFromPhoto): NewFridgeItem => ({
  name: f.name, quantity: f.quantity, unit: f.unit,
  category: f.category, expiry_date: null,
  conservation_tip: f.conservation_tip,
  calories_per_100g: f.calories_per_100g,
  protein_g: f.protein_g, carbs_g: f.carbs_g, fat_g: f.fat_g,
  added_by_photo: false, location: 'nevera', notes: null,
})

export default function QuickList({ onSave, onEdit, onDone }: Props) {
  const [text,     setText]    = useState('')
  const [loading,  setLoading] = useState(false)
  const [results,  setResults] = useState<SavedResult[]>([])
  const [done,     setDone]    = useState(false)
  const [progress, setProgress] = useState('')
  const [error,    setError]   = useState<string | null>(null)

  const handleSubmit = async () => {
    const lines = text.trim().split('\n').filter(l => l.trim())
    if (!lines.length) return
    setError(null); setLoading(true); setResults([]); setDone(false)
    setProgress('Paso 1: identificando alimentos en tu lista...')

    try {
      const detected = await parseQuickList(text.trim())
      setProgress(`Paso 2: buscando información nutricional...`)
      await new Promise(r => setTimeout(r, 100)) // flush UI
      setProgress(`Guardando ${detected.length} alimento${detected.length > 1 ? 's' : ''}...`)

      const saved: SavedResult[] = []
      for (const det of detected) {
        try {
          const item = await onSave(toNewItem(det))
          saved.push({ name: det.name, success: true, item: item ?? undefined })
        } catch (e) {
          saved.push({ name: det.name, success: false, error: e instanceof Error ? e.message : String(e) })
        }
        setResults([...saved])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }

    setLoading(false)
    setDone(true)
  }

  // Resultados
  if (done) {
    const ok   = results.filter(r => r.success).length
    const fail = results.filter(r => !r.success).length
    return (
      <div className="flex flex-col gap-4">
        <div className="text-center">
          <p className="text-4xl mb-2">{ok > 0 ? '✅' : '❌'}</p>
          <p className="font-semibold text-text">
            {ok} guardado{ok !== 1 ? 's' : ''}{fail > 0 ? `, ${fail} con error` : ''}
          </p>
          <p className="text-muted text-sm mt-1">Toca ✏️ para revisar o corregir datos nutricionales.</p>
        </div>
        <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
          {results.map((r, i) => (
            <div key={i} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm
              ${r.success ? 'bg-green-50' : 'bg-red-50'}`}>
              <span className={r.success ? 'text-success' : 'text-error'}>{r.success ? '✓' : '✗'}</span>
              <span className="flex-1 text-text truncate">{r.name}</span>
              {r.success && r.item && (
                <button onClick={() => onEdit(r.item!)}
                  className="text-accent text-xs font-medium hover:underline whitespace-nowrap">
                  ✏️ Editar
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          <button onClick={() => { setDone(false); setText(''); setResults([]) }}
            className="btn-ghost flex-1">
            Agregar más
          </button>
          <button onClick={onDone} className="btn-primary flex-1">
            Ver nevera
          </button>
        </div>
      </div>
    )
  }

  // Cargando
  if (loading) {
    return (
      <div className="flex flex-col items-center gap-5 py-8">
        <div className="flex gap-1.5">
          <span className="w-2 h-2 rounded-full bg-accent animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 rounded-full bg-accent animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 rounded-full bg-accent animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
        <p className="text-text text-sm text-center">{progress}</p>
        {results.length > 0 && (
          <div className="w-full flex flex-col gap-1">
            {results.map((r, i) => (
              <div key={i} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs
                ${r.success ? 'bg-green-50 text-text' : 'bg-red-50 text-error'}`}>
                <span>{r.success ? '✓' : '✗'}</span><span>{r.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // Formulario
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm text-muted mb-2">
          Escribe lo que tienes — un alimento por línea con cantidad.
          Claude identifica cada producto y busca su información nutricional.
        </p>
        <textarea
          rows={8}
          placeholder={PLACEHOLDER}
          value={text}
          onChange={e => setText(e.target.value)}
          className="w-full"
          style={{ resize: 'vertical', fontFamily: 'inherit', fontSize: '0.9rem' }}
          autoFocus
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-error">{error}</div>
      )}

      <button onClick={handleSubmit} className="btn-primary"
        disabled={!text.trim() || loading}>
        Identificar y guardar
      </button>
    </div>
  )
}
