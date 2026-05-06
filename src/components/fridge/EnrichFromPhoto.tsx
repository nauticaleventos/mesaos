import { useRef, useState } from 'react'
import { enrichFromPhoto } from '../../lib/claude'
import type { EnrichmentFromPhoto } from '../../lib/claude'

interface Props {
  foodName:  string
  onEnrich:  (data: EnrichmentFromPhoto) => void
  onCancel:  () => void
}

export default function EnrichFromPhoto({ foodName, onEnrich, onCancel }: Props) {
  const inputRef            = useRef<HTMLInputElement>(null)
  const [scanning, setScanning] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  const compressImage = (dataUrl: string): Promise<string> =>
    new Promise(resolve => {
      const img = new Image()
      img.onload = () => {
        const MAX = 1024
        let { width, height } = img
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round(height * MAX / width); width = MAX }
          else { width = Math.round(width * MAX / height); height = MAX }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width; canvas.height = height
        canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', 0.8))
      }
      img.src = dataUrl
    })

  const handleFile = async (file: File) => {
    setError(null); setScanning(true)
    try {
      const reader = new FileReader()
      const dataUrl = await new Promise<string>(resolve => {
        reader.onload = () => resolve(reader.result as string)
        reader.readAsDataURL(file)
      })
      const comp   = await compressImage(dataUrl)
      const base64 = comp.split(',')[1]
      const data   = await enrichFromPhoto(base64, foodName)
      onEnrich(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
    setScanning(false)
  }

  if (scanning) {
    return (
      <div className="flex flex-col items-center gap-3 py-4">
        <div className="flex gap-1.5">
          <span className="w-2 h-2 rounded-full bg-accent animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 rounded-full bg-accent animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 rounded-full bg-accent animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
        <p className="text-sm text-muted text-center">Leyendo tabla nutricional y vencimiento...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <input ref={inputRef} type="file" accept="image/*" capture="environment"
        className="hidden" onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }} />

      <p className="text-xs text-muted text-center">
        Toma una foto de la etiqueta de <strong className="text-text">{foodName}</strong> que muestre la tabla nutricional y/o la fecha de vencimiento.
      </p>

      {error && (
        <p className="text-error text-xs text-center">{error}</p>
      )}

      <button onClick={() => inputRef.current?.click()} className="btn-primary text-sm py-2.5">
        📷 Tomar foto del producto
      </button>
      <button onClick={onCancel} className="btn-ghost text-sm py-2.5">
        Cancelar
      </button>
    </div>
  )
}
