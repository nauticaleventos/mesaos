import { useState } from 'react'
import { Link } from 'lucide-react'
import { importFromUrl, type RecipeImport } from '../../../lib/claudeImport'
import { ModalWrap } from './ImportModal'

interface Props { onExtracted: (r: RecipeImport) => void; onBack: () => void }

export default function FormaUrl({ onExtracted, onBack }: Props) {
  const [url, setUrl]         = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const procesar = async () => {
    if (!url.trim()) return
    setError(null); setLoading(true)
    try {
      const receta = await importFromUrl(url.trim())
      onExtracted(receta)
    } catch (e) { setError(e instanceof Error ? e.message : 'Error al importar') }
    setLoading(false)
  }

  return (
    <ModalWrap titulo="Pegar link web">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col items-center gap-3 pt-2 pb-1">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: '#D0E4F0' }}>
            <Link size={32} color="#5C8AA8" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-text">Link de la receta</p>
            <p className="text-sm text-muted mt-1">Funciona con cualquier blog de recetas, sitio web o página de cocina.</p>
          </div>
        </div>

        <div>
          <label className="input-label">URL de la receta</label>
          <input type="url" value={url} onChange={e => setUrl(e.target.value)} autoFocus
            placeholder="https://www.recetas.com/mi-receta" />
        </div>

        {error && <div className="p-3 rounded-xl bg-red-50 border border-red-200"><p className="text-sm text-error">{error}</p></div>}

        {loading ? (
          <div className="flex items-center gap-3 py-4 justify-center">
            <div className="flex gap-1">{[0,150,300].map(d => <span key={d} className="w-2 h-2 rounded-full bg-accent animate-bounce" style={{ animationDelay: `${d}ms` }} />)}</div>
            <p className="text-sm text-muted">Extrayendo receta… 🌐</p>
          </div>
        ) : (
          <button onClick={procesar} disabled={!url.trim()} className="btn-primary">Importar receta</button>
        )}

        <button onClick={onBack} className="btn-ghost">← Volver</button>
      </div>
    </ModalWrap>
  )
}
