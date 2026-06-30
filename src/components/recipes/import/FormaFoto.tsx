import { useState, useRef } from 'react'
import { Camera, Upload } from 'lucide-react'
import { importFromPhoto, fileToBase64, type RecipeImport } from '../../../lib/claudeImport'
import { ModalWrap } from './ImportModal'
import { useImportGate } from '../../../lib/useImportGate'

interface Props { onExtracted: (r: RecipeImport) => void; onBack: () => void }

export default function FormaFoto({ onExtracted, onBack }: Props) {
  const { gate, consumir } = useImportGate()
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [preview, setPreview]   = useState<string | null>(null)
  const fileRef                 = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    setError(null)
    if (!gate()) return
    // Mostrar preview
    const reader = new FileReader()
    reader.onload = e => setPreview(e.target?.result as string)
    reader.readAsDataURL(file)

    setLoading(true)
    try {
      const { base64, mime } = await fileToBase64(file)
      const r = await importFromPhoto(base64, mime)
      await consumir()
      onExtracted(r)
    } catch (e) { setError(e instanceof Error ? e.message : 'Error al leer la foto') }
    setLoading(false)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  return (
    <ModalWrap titulo="Subir foto">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col items-center gap-3 pt-2 pb-1">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: '#DDE5C2' }}>
            <Camera size={32} color="#6B7F39" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-text">Foto de la receta</p>
            <p className="text-sm text-muted mt-1">
              Funcionará con: libro de recetas, receta impresa, pantalla de otro celular, receta a mano.
            </p>
          </div>
        </div>

        {/* Área de carga */}
        {!preview ? (
          <button onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-accent rounded-2xl p-8 flex flex-col items-center gap-3 hover:bg-accent/5 transition-colors">
            <Upload size={32} color="#E76F51" />
            <div className="text-center">
              <p className="font-semibold text-text">Toca para elegir foto</p>
              <p className="text-xs text-muted mt-1">JPG, PNG, HEIC • Cámara o galería</p>
            </div>
          </button>
        ) : (
          <div className="relative">
            <img src={preview} alt="preview" className="w-full rounded-2xl object-cover max-h-64" />
            {!loading && (
              <button onClick={() => { setPreview(null); setError(null) }}
                className="absolute top-2 right-2 w-8 h-8 bg-black/60 text-white rounded-full flex items-center justify-center text-lg">×</button>
            )}
          </div>
        )}

        <input ref={fileRef} type="file" accept="image/*"
          className="hidden" onChange={handleChange} />

        {error && <div className="p-3 rounded-xl bg-red-50 border border-red-200"><p className="text-sm text-error">{error}</p></div>}

        {loading && (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <div className="flex gap-1">{[0,150,300].map(d => <span key={d} className="w-2 h-2 rounded-full bg-accent animate-bounce" style={{ animationDelay: `${d}ms` }} />)}</div>
            <p className="text-sm font-medium text-text">Tita está leyendo la foto… 📸</p>
            <p className="text-xs text-muted">Puede tardar 20-40 segundos</p>
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-200">
              <span className="text-base">⚠️</span>
              <p className="text-xs font-medium text-amber-800">No salgas de esta pantalla o perderás el proceso</p>
            </div>
          </div>
        )}

        {!loading && <button onClick={onBack} className="btn-ghost">← Volver</button>}
      </div>
    </ModalWrap>
  )
}
