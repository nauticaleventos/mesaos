import { useRef, useState } from 'react'
import { scanFoodPhoto, type FoodFromPhoto } from '../../lib/claude'
import AddItemForm from './AddItemForm'
import type { NewFridgeItem } from '../../store/fridgeStore'

interface ScannedItem {
  preview: string
  detected: FoodFromPhoto
}

interface Props {
  onSave:   (item: NewFridgeItem) => void
  onCancel: () => void
}

export default function PhotoScan({ onSave, onCancel }: Props) {
  const inputRef                          = useRef<HTMLInputElement>(null)
  const galleryRef                        = useRef<HTMLInputElement>(null)
  const [scanning, setScanning]           = useState(false)
  const [scannedItems, setScannedItems]   = useState<ScannedItem[]>([])
  const [editingIndex, setEditingIndex]   = useState<number | null>(null)
  const [error, setError]                 = useState<string | null>(null)
  const [progress, setProgress]           = useState<string | null>(null)

  const processFiles = async (files: FileList) => {
    setError(null)
    setScanning(true)
    const newItems: ScannedItem[] = []
    let localError: string | null = null

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      setProgress(`Analizando foto ${i + 1} de ${files.length}...`)

      const rawDataUrl    = await readFile(file)
      const compressedUrl = await compressImage(rawDataUrl)
      const base64        = compressedUrl.split(',')[1]
      const mime: 'image/jpeg' = 'image/jpeg'  // canvas siempre genera JPEG

      try {
        const detected = await scanFoodPhoto(base64, mime)
        newItems.push({ preview: dataUrl, detected })
      } catch (e: unknown) {
        localError = e instanceof Error ? e.message : String(e)
        setError(localError)
        break
      }
    }

    setScanning(false)
    setProgress(null)
    if (newItems.length > 0) {
      setScannedItems(prev => [...prev, ...newItems])
      setEditingIndex(0)
    } else if (!localError) {
      setError('No pude leer las fotos. Intenta con imágenes más claras.')
    }
  }

  const readFile = (file: File): Promise<string> =>
    new Promise(resolve => {
      const r = new FileReader()
      r.onload = () => resolve(r.result as string)
      r.readAsDataURL(file)
    })

  // Comprime la imagen a máx 1024px y 80% calidad — evita límite de 4.5MB de Vercel
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

  const toNewItem = (f: FoodFromPhoto): Partial<NewFridgeItem> => ({
    name: f.name, quantity: f.quantity, unit: f.unit,
    category: f.category, expiry_date: f.expiry_date,
    conservation_tip: f.conservation_tip,
    calories_per_100g: f.calories_per_100g,
    protein_g: f.protein_g, carbs_g: f.carbs_g, fat_g: f.fat_g,
    added_by_photo: true, location: 'nevera',
  })

  const handleSaveItem = (item: NewFridgeItem) => {
    onSave(item)
    const remaining = scannedItems.filter((_, i) => i !== editingIndex)
    if (remaining.length === 0) {
      onCancel()
    } else {
      setScannedItems(remaining)
      setEditingIndex(0)
    }
  }

  const handleSkipItem = () => {
    const remaining = scannedItems.filter((_, i) => i !== editingIndex)
    if (remaining.length === 0) {
      onCancel()
    } else {
      setScannedItems(remaining)
      setEditingIndex(0)
    }
  }

  // Editando un item detectado
  if (editingIndex !== null && scannedItems[editingIndex]) {
    const current = scannedItems[editingIndex]
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={current.preview} alt="" className="w-14 h-14 rounded-xl object-cover" />
            <div>
              <p className="font-semibold text-text">Claude detectó:</p>
              <p className="text-muted text-xs">
                {editingIndex + 1} de {scannedItems.length} foto{scannedItems.length > 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button onClick={handleSkipItem} className="text-muted text-sm hover:text-text">
            Saltar →
          </button>
        </div>
        <AddItemForm
          initial={toNewItem(current.detected)}
          onSave={handleSaveItem}
          onCancel={handleSkipItem}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5 items-center py-4">
      {/* Input cámara */}
      <input ref={inputRef} type="file" accept="image/*" capture="environment"
        multiple className="hidden"
        onChange={e => { if (e.target.files?.length) processFiles(e.target.files) }}
      />
      {/* Input galería (sin capture para mostrar galería) */}
      <input ref={galleryRef} type="file" accept="image/*"
        multiple className="hidden"
        onChange={e => { if (e.target.files?.length) processFiles(e.target.files) }}
      />

      {!scanning && (
        <>
          <div className="w-24 h-24 rounded-full bg-accent-light flex items-center justify-center text-5xl">
            📷
          </div>
          <div className="text-center">
            <p className="font-semibold text-text">Foto del alimento</p>
            <p className="text-muted text-sm mt-1">
              Podés seleccionar varias fotos a la vez. Claude lee cada etiqueta automáticamente.
            </p>
          </div>
          <div className="flex flex-col gap-3 w-full">
            <button type="button" onClick={() => inputRef.current?.click()} className="btn-primary">
              📷 Tomar foto
            </button>
            <button type="button" onClick={() => galleryRef.current?.click()} className="btn-ghost">
              🖼️ Elegir de galería (una o varias)
            </button>
          </div>
        </>
      )}

      {scanning && (
        <div className="flex flex-col items-center gap-4 py-8 w-full">
          <p className="text-text font-medium text-center">{progress ?? 'Analizando...'}</p>
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
