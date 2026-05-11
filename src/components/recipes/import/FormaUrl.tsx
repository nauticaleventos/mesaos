import { useState } from 'react'
import { Link, FileText, Image } from 'lucide-react'
import { importFromUrl, type RecipeImport } from '../../../lib/claudeImport'
import { ModalWrap } from './ImportModal'

interface Props {
  onExtracted:  (r: RecipeImport) => void
  onBack:       () => void
  onGoToTexto?: () => void
  onGoToFoto?:  () => void
}

function detectSocialNetwork(url: string): string | null {
  try {
    const hostname = new URL(url).hostname.toLowerCase()
    if (hostname.includes('instagram')) return 'Instagram'
    if (hostname.includes('tiktok'))    return 'TikTok'
    if (hostname.includes('facebook') || hostname === 'fb.com') return 'Facebook'
    if (hostname.includes('youtube') || hostname === 'youtu.be') return 'YouTube'
    if (hostname.includes('twitter') || hostname === 'x.com') return 'X / Twitter'
    return null
  } catch {
    return null
  }
}

export default function FormaUrl({ onExtracted, onBack, onGoToTexto, onGoToFoto }: Props) {
  const [url, setUrl]               = useState('')
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [socialFallback, setSocialFallback] = useState<string | null>(null)

  const procesar = async () => {
    if (!url.trim()) return
    setError(null)

    // Detectar redes sociales antes de intentar
    const redSocial = detectSocialNetwork(url.trim())
    if (redSocial) {
      setSocialFallback(redSocial)
      return
    }

    setLoading(true)
    try {
      const receta = await importFromUrl(url.trim())
      onExtracted(receta)
    } catch (e) {
      // Si el error parece de red social (por URL redirect o bloqueo)
      const msg = e instanceof Error ? e.message : ''
      if (msg.toLowerCase().includes('instagram') || msg.toLowerCase().includes('tiktok') || msg.toLowerCase().includes('blocked')) {
        setSocialFallback('esta red social')
      } else {
        setError(msg || 'Error al importar')
      }
    }
    setLoading(false)
  }

  // ── Pantalla de fallback para redes sociales ────────────────────────────────
  if (socialFallback) {
    return (
      <ModalWrap titulo="Link de red social">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col items-center gap-3 pt-2 pb-1 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-yellow-50">
              <span className="text-3xl">🔒</span>
            </div>
            <div>
              <p className="font-semibold text-text">
                No podemos extraer recetas de {socialFallback}
              </p>
              <p className="text-sm text-muted mt-1">
                Estas plataformas bloquean la lectura automática. Pero podés usar estas alternativas:
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {onGoToTexto && (
              <button onClick={onGoToTexto}
                className="flex items-start gap-3 p-4 rounded-2xl border-2 border-border bg-white hover:border-accent hover:bg-accent-light/20 transition-all text-left">
                <div className="w-10 h-10 rounded-xl bg-accent-light flex items-center justify-center flex-shrink-0">
                  <FileText size={20} color="#E76F51" />
                </div>
                <div>
                  <p className="font-semibold text-text text-sm">Pegar el caption del post</p>
                  <p className="text-xs text-muted mt-0.5">Copiá el texto del post (ingredientes + pasos) y pegalo acá</p>
                </div>
              </button>
            )}

            {onGoToFoto && (
              <button onClick={onGoToFoto}
                className="flex items-start gap-3 p-4 rounded-2xl border-2 border-border bg-white hover:border-accent hover:bg-accent-light/20 transition-all text-left">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <Image size={20} color="#5C8AA8" />
                </div>
                <div>
                  <p className="font-semibold text-text text-sm">Subir screenshot del reel</p>
                  <p className="text-xs text-muted mt-0.5">Tomá captura de los ingredientes o pasos y subila</p>
                </div>
              </button>
            )}
          </div>

          <button onClick={() => { setSocialFallback(null); setUrl('') }} className="btn-ghost">
            ← Intentar con otro link
          </button>
        </div>
      </ModalWrap>
    )
  }

  // ── Pantalla normal ─────────────────────────────────────────────────────────
  return (
    <ModalWrap titulo="Pegar link web">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col items-center gap-3 pt-2 pb-1">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: '#D0E4F0' }}>
            <Link size={32} color="#5C8AA8" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-text">Link de la receta</p>
            <p className="text-sm text-muted mt-1">
              Funciona con blogs de recetas y sitios web de cocina.
              <br />
              <span className="text-xs">Para Instagram o TikTok, usá "Pegar texto" o "Subir foto".</span>
            </p>
          </div>
        </div>

        <div>
          <label className="input-label">URL de la receta</label>
          <input type="url" value={url} onChange={e => setUrl(e.target.value)} autoFocus
            placeholder="https://www.recetas.com/mi-receta"
            onKeyDown={e => { if (e.key === 'Enter') procesar() }} />
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200">
            <p className="text-sm text-error">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-3 py-4 justify-center">
            <div className="flex gap-1">
              {[0,150,300].map(d => (
                <span key={d} className="w-2 h-2 rounded-full bg-accent animate-bounce" style={{ animationDelay: `${d}ms` }} />
              ))}
            </div>
            <p className="text-sm text-muted">Extrayendo receta… 🌐</p>
          </div>
        ) : (
          <button onClick={procesar} disabled={!url.trim()} className="btn-primary">
            Importar receta
          </button>
        )}

        <button onClick={onBack} className="btn-ghost">← Volver</button>
      </div>
    </ModalWrap>
  )
}
