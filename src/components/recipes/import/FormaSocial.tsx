import { useState } from 'react'
import { Share2, FileText, Camera } from 'lucide-react'
import { importFromSocial, type RecipeImport } from '../../../lib/claudeImport'
import { ModalWrap } from './ImportModal'

interface Props {
  onExtracted:  (r: RecipeImport) => void
  onBack:       () => void
  onGoToTexto?: () => void
  onGoToFoto?:  () => void
}

export default function FormaSocial({ onExtracted, onBack, onGoToTexto, onGoToFoto }: Props) {
  const [url, setUrl]             = useState('')
  const [loading, setLoading]     = useState(false)
  const [blocked, setBlocked]     = useState(false)
  const [error, setError]         = useState<string | null>(null)

  const procesar = async () => {
    if (!url.trim()) return
    setError(null); setBlocked(false); setLoading(true)
    try {
      onExtracted(await importFromSocial(url.trim()))
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al analizar'
      if (msg === 'INSTAGRAM_BLOCKED') {
        setBlocked(true)
      } else {
        setError(msg)
      }
    }
    setLoading(false)
  }

  // ── Instagram/Facebook bloqueado ─────────────────────────────────────────────
  if (blocked) {
    return (
      <ModalWrap titulo="Desde redes sociales">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col items-center gap-4 pt-2 text-center">
            <span className="text-5xl">😞</span>
            <div>
              <p className="font-semibold text-text text-base">
                Instagram no me dejó leer este post
              </p>
              <p className="text-sm text-muted mt-2">
                Pero podés ayudarme de 2 formas:
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={onGoToTexto}
              disabled={!onGoToTexto}
              className="flex items-center gap-4 p-4 rounded-2xl border-2 border-border bg-white hover:border-accent transition-all text-left">
              <div className="w-12 h-12 rounded-xl bg-accent-light flex items-center justify-center flex-shrink-0">
                <FileText size={22} color="#E76F51" />
              </div>
              <div>
                <p className="font-semibold text-text">📋 Pegar el texto del post</p>
                <p className="text-xs text-muted mt-0.5">Copiá el caption con ingredientes y pasos</p>
              </div>
            </button>

            <button
              onClick={onGoToFoto}
              disabled={!onGoToFoto}
              className="flex items-center gap-4 p-4 rounded-2xl border-2 border-border bg-white hover:border-accent transition-all text-left">
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                <Camera size={22} color="#5C8AA8" />
              </div>
              <div>
                <p className="font-semibold text-text">📸 Subir foto del post</p>
                <p className="text-xs text-muted mt-0.5">Tomá screenshot y subila</p>
              </div>
            </button>
          </div>

          <button onClick={() => { setBlocked(false); setUrl('') }} className="btn-ghost">
            ← Intentar con otro link
          </button>
        </div>
      </ModalWrap>
    )
  }

  // ── Pantalla normal ──────────────────────────────────────────────────────────
  return (
    <ModalWrap titulo="Desde redes sociales">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col items-center gap-3 pt-2 pb-1">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: '#FFCDB2' }}>
            <Share2 size={32} color="#E76F51" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-text">Link del post o video</p>
            <p className="text-sm text-muted mt-1">
              Pegá el link de TikTok o YouTube.
              Para Instagram, usá "Pegar texto" o "Subir foto".
            </p>
          </div>
        </div>

        {/* Tips */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { nombre: 'TikTok',   emoji: '🎵', tip: 'Compartir → Copiar link', ok: true },
            { nombre: 'YouTube',  emoji: '▶️', tip: 'Compartir → Copiar link', ok: true },
            { nombre: 'Instagram',emoji: '📸', tip: 'Usar "Pegar texto" mejor', ok: false },
            { nombre: 'Facebook', emoji: '👥', tip: 'Usar "Pegar texto" mejor', ok: false },
          ].map(({ nombre, emoji, tip, ok }) => (
            <div key={nombre}
              className={`p-3 rounded-xl border ${ok ? 'border-border bg-white' : 'border-border bg-gray-50 opacity-60'}`}>
              <p className="text-sm font-medium text-text">{emoji} {nombre}</p>
              <p className="text-xs text-muted mt-0.5">{tip}</p>
            </div>
          ))}
        </div>

        <div>
          <label className="input-label">Link del post o video</label>
          <input type="url" value={url} onChange={e => setUrl(e.target.value)} autoFocus
            placeholder="https://www.tiktok.com/@..." />
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200">
            <p className="text-sm text-error">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <div className="flex gap-1">
              {[0,150,300].map(d => (
                <span key={d} className="w-2 h-2 rounded-full bg-accent animate-bounce"
                      style={{ animationDelay: `${d}ms` }} />
              ))}
            </div>
            <p className="text-sm font-medium text-text">Tita está escuchando el video... 🎧</p>
            <p className="text-xs text-muted">Transcribiendo audio — puede tardar 30-60 segundos</p>
          </div>
        ) : (
          <button onClick={procesar} disabled={!url.trim()} className="btn-primary">
            Analizar receta
          </button>
        )}
        <button onClick={onBack} className="btn-ghost">← Volver</button>
      </div>
    </ModalWrap>
  )
}
