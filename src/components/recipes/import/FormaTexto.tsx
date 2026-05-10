import { useState } from 'react'
import { ClipboardList } from 'lucide-react'
import { importFromText, type RecipeImport } from '../../../lib/claudeImport'
import { ModalWrap } from './ImportModal'

interface Props {
  onExtracted: (r: RecipeImport) => void
  onBack:      () => void
}

const EJEMPLO = `Sancocho de pollo
Ingredientes para 6 personas:
- 1 pollo entero cortado
- 3 papas peladas
- 2 mazorcas
- 1 yuca troceada
- Cilantro, ajo, cebolla, sal al gusto

Preparación:
1. En olla grande, cocinar el pollo con cebolla y ajo...`

export default function FormaTexto({ onExtracted, onBack }: Props) {
  const [texto, setTexto]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)

  const procesar = async () => {
    if (!texto.trim()) return
    setError(null)
    setLoading(true)
    try {
      const receta = await importFromText(texto)
      onExtracted(receta)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al procesar la receta')
    }
    setLoading(false)
  }

  return (
    <ModalWrap titulo="Pegar texto">
      <div className="flex flex-col gap-5">

        {/* Ícono + descripción */}
        <div className="flex flex-col items-center gap-3 pt-2 pb-1">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: '#FBF0D0' }}>
            <ClipboardList size={32} color="#E8B547" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-text">Pegá la receta</p>
            <p className="text-sm text-muted mt-1">
              Copiá la receta de donde sea — WhatsApp, email, blog, app — y pegala acá.
              La IA la organiza automáticamente.
            </p>
          </div>
        </div>

        {/* Textarea */}
        <div>
          <label className="input-label">Texto de la receta</label>
          <textarea
            value={texto}
            onChange={e => setTexto(e.target.value)}
            placeholder={EJEMPLO}
            rows={12}
            autoFocus
            style={{ resize: 'vertical', lineHeight: 1.6 }}
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted mt-1">
            {texto.length} caracteres · No hace falta que esté formateado perfectamente
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200">
            <p className="text-sm text-error">{error}</p>
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-3 py-4 justify-center">
            <div className="flex gap-1">
              {[0,150,300].map(d => (
                <span key={d} className="w-2 h-2 rounded-full bg-accent animate-bounce"
                  style={{ animationDelay: `${d}ms` }} />
              ))}
            </div>
            <p className="text-sm text-muted">Organizando receta…</p>
          </div>
        )}

        {!loading && (
          <button onClick={procesar} disabled={!texto.trim()}
            className="btn-primary">
            Procesar receta 🤖
          </button>
        )}

        <button onClick={onBack} className="btn-ghost">← Volver</button>
      </div>
    </ModalWrap>
  )
}
