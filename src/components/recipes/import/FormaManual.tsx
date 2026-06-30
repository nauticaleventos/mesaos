import { useState } from 'react'
import { Sparkles, ChefHat, AlertCircle } from 'lucide-react'
import { importFromManualIA, emptyRecipeImport, type RecipeImport } from '../../../lib/claudeImport'
import { ModalWrap } from './ImportModal'
import { useImportGate } from '../../../lib/useImportGate'

interface Props { onExtracted: (r: RecipeImport) => void; onBack: () => void }

type Step = 'form' | 'loading' | 'error'

export default function FormaManual({ onExtracted, onBack }: Props) {
  const { gate, consumir } = useImportGate()
  const [step,        setStep]        = useState<Step>('form')
  const [nombre,      setNombre]      = useState('')
  const [ingredientes,setIngredientes]= useState('')
  const [error,       setError]       = useState<string | null>(null)
  const [missingInfo, setMissingInfo] = useState<string[] | null>(null)

  const puedeEnviar = nombre.trim().length > 0 && ingredientes.trim().length > 0

  const handleSubmit = async () => {
    if (!puedeEnviar) return
    if (!gate()) return
    setStep('loading')
    setError(null)
    setMissingInfo(null)

    try {
      const recipe = await importFromManualIA(nombre.trim(), ingredientes.trim())
      await consumir()

      // Si la IA detectó que falta info, mostrar advertencia pero seguir
      if (recipe.missing_info?.length) {
        setMissingInfo(recipe.missing_info)
      }

      onExtracted(recipe)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al procesar la receta')
      setStep('error')
    }
  }

  // ── LOADING ──────────────────────────────────────────────────────────────────
  if (step === 'loading') {
    return (
      <ModalWrap titulo="Escribir desde cero">
        <div className="flex flex-col items-center gap-6 py-8">
          <div className="w-16 h-16 rounded-full flex items-center justify-center animate-pulse"
               style={{ background: '#FFF3E0' }}>
            <ChefHat size={28} color="#E76F51" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-text">Tita está pensando en tu receta...</p>
            <p className="text-sm text-muted mt-1">Inferiendo tiempos, pasos y valores nutricionales</p>
          </div>
          <div className="flex gap-1.5">
            {[0, 150, 300].map(d => (
              <span key={d} className="w-2 h-2 rounded-full bg-accent animate-bounce"
                    style={{ animationDelay: `${d}ms` }} />
            ))}
          </div>
        </div>
      </ModalWrap>
    )
  }

  // ── ERROR ────────────────────────────────────────────────────────────────────
  if (step === 'error') {
    return (
      <ModalWrap titulo="Escribir desde cero">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col items-center gap-3 pt-2 text-center">
            <AlertCircle size={36} className="text-error" />
            <p className="font-semibold text-text">No pude completar la receta</p>
            <p className="text-sm text-muted">{error}</p>
          </div>

          <button onClick={() => setStep('form')} className="btn-primary">
            Intentar de nuevo
          </button>
          <button onClick={() => onExtracted(emptyRecipeImport())} className="btn-ghost">
            Llenar formulario manualmente
          </button>
          <button onClick={onBack} className="text-xs text-muted text-center hover:text-text transition-colors">
            ← Volver
          </button>
        </div>
      </ModalWrap>
    )
  }

  // ── FORM ─────────────────────────────────────────────────────────────────────
  return (
    <ModalWrap titulo="Escribir desde cero">
      <div className="flex flex-col gap-5">

        {/* Header */}
        <div className="flex items-center gap-3 pt-1">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
               style={{ background: '#FFF3E0' }}>
            <Sparkles size={22} color="#E76F51" />
          </div>
          <div>
            <p className="font-semibold text-text text-sm">Tita completa el resto</p>
            <p className="text-xs text-muted">Solo necesito el nombre y los ingredientes</p>
          </div>
        </div>

        {/* Nombre */}
        <div>
          <label className="input-label">Nombre de la receta *</label>
          <input
            type="text"
            placeholder="Ej: Arroz con pollo, Sopa de lentejas..."
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (document.querySelector('textarea') as HTMLTextAreaElement)?.focus()}
            autoFocus
          />
        </div>

        {/* Ingredientes */}
        <div>
          <label className="input-label">Ingredientes *</label>
          <textarea
            placeholder={"Pollo\nArroz\nCebolla, ajo, comino\nSal, aceite..."}
            value={ingredientes}
            onChange={e => setIngredientes(e.target.value)}
            rows={6}
            className="w-full resize-none"
            style={{ minHeight: 140 }}
          />
          <p className="text-xs text-muted mt-1">Separados por línea o por coma</p>
        </div>

        {/* Advertencia missing_info */}
        {missingInfo && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-yellow-50 border border-yellow-200">
            <AlertCircle size={16} className="text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-yellow-800">Para ser más precisa necesito:</p>
              <ul className="mt-1 list-disc list-inside">
                {missingInfo.map((m, i) => (
                  <li key={i} className="text-xs text-yellow-700">{m}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Botones */}
        <button
          onClick={handleSubmit}
          disabled={!puedeEnviar}
          className={`btn-primary flex items-center justify-center gap-2 ${!puedeEnviar ? 'opacity-40 cursor-not-allowed' : ''}`}>
          <Sparkles size={16} />
          Continuar con IA →
        </button>

        <div className="flex items-center gap-2 text-xs text-muted">
          <div className="flex-1 h-px bg-border" />
          <span>o</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <button onClick={() => onExtracted(emptyRecipeImport())}
          className="btn-ghost text-sm">
          Llenar todo yo mismo
        </button>

        <button onClick={onBack} className="text-xs text-muted text-center hover:text-text transition-colors">
          ← Volver
        </button>
      </div>
    </ModalWrap>
  )
}
