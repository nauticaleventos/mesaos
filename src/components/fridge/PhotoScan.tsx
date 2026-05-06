import { useRef, useState } from 'react'
import { scanFoodPhoto, type FoodFromPhoto } from '../../lib/claude'
import AddItemForm from './AddItemForm'
import type { NewFridgeItem } from '../../store/fridgeStore'

interface Props {
  onSave:   (item: NewFridgeItem) => void
  onCancel: () => void
}

export default function PhotoScan({ onSave, onCancel }: Props) {
  const inputRef                  = useRef<HTMLInputElement>(null)
  const [scanning, setScanning]   = useState(false)
  const [preview, setPreview]     = useState<string | null>(null)
  const [detected, setDetected]   = useState<FoodFromPhoto | null>(null)
  const [error, setError]         = useState<string | null>(null)

  const handleFile = async (file: File) => {
    setError(null)
    setDetected(null)
    const reader = new FileReader()
    reader.onload = async () => {
      const dataUrl = reader.result as string
      setPreview(dataUrl)
      const base64 = dataUrl.split(',')[1]
      const mime   = file.type as 'image/jpeg' | 'image/png' | 'image/webp'
      setScanning(true)
      try {
        const result = await scanFoodPhoto(base64, mime)
        setDetected(result)
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Error leyendo la foto'
        if (msg.includes('401') || msg.includes('403')) {
          setError('API key de Claude no configurada. Agrega VITE_ANTHROPIC_API_KEY al .env')
        } else {
          setError('No pude leer la foto. Intenta con otra imagen más clara.')
        }
      }
      setScanning(false)
    }
    reader.readAsDataURL(file)
  }

  const toNewItem = (f: FoodFromPhoto): Partial<NewFridgeItem> => ({
    name:              f.name,
    quantity:          f.quantity,
    unit:              f.unit,
    category:          f.category,
    expiry_date:       f.expiry_date,
    conservation_tip:  f.conservation_tip,
    calories_per_100g: f.calories_per_100g,
    protein_g:         f.protein_g,
    carbs_g:           f.carbs_g,
    fat_g:             f.fat_g,
    added_by_photo:    true,
    location:          'nevera',
  })

  if (detected) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          {preview && <img src={preview} alt="" className="w-16 h-16 rounded-xl object-cover" />}
          <div>
            <p className="font-semibold text-text">Claude detectó:</p>
            <p className="text-muted text-sm">Confirma o edita antes de guardar.</p>
          </div>
        </div>
        <AddItemForm initial={toNewItem(detected)} onSave={onSave} onCancel={onCancel} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5 items-center py-4">
      <input ref={inputRef} type="file" accept="image/*" capture="environment"
        className="hidden"
        onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }}
      />

      {!preview && !scanning && (
        <>
          <div className="w-24 h-24 rounded-full bg-accent-light flex items-center justify-center text-5xl">
            📷
          </div>
          <div className="text-center">
            <p className="font-semibold text-text">Foto del alimento</p>
            <p className="text-muted text-sm mt-1">Claude lee la etiqueta y carga los datos automáticamente.</p>
          </div>
          <div className="flex flex-col gap-3 w-full">
            <button type="button" onClick={() => inputRef.current?.click()} className="btn-primary">
              📷 Tomar foto
            </button>
            <button type="button"
              onClick={() => { if (inputRef.current) { inputRef.current.removeAttribute('capture'); inputRef.current.click() }}}
              className="btn-ghost">
              🖼️ Elegir de galería
            </button>
          </div>
        </>
      )}

      {scanning && (
        <div className="flex flex-col items-center gap-4 py-8">
          {preview && <img src={preview} alt="" className="w-28 h-28 rounded-2xl object-cover opacity-60" />}
          <p className="text-text font-medium">Claude está leyendo la etiqueta...</p>
          <div className="flex gap-1.5">
            <span className="w-2 h-2 rounded-full bg-accent animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-2 h-2 rounded-full bg-accent animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-2 h-2 rounded-full bg-accent animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      )}

      {error && (
        <div className="w-full">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-error text-center mb-3">
            {error}
          </div>
          <button type="button" onClick={onCancel} className="btn-ghost w-full">Cancelar</button>
        </div>
      )}
    </div>
  )
}
