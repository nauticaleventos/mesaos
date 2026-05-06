import { useRef, useState } from 'react'
import { scanFoodPhoto, type FoodFromPhoto } from '../../lib/claude'
import type { NewFridgeItem } from '../../store/fridgeStore'

interface SavedResult {
  name:    string
  success: boolean
  error?:  string
}

interface Props {
  onSave:  (item: NewFridgeItem) => void
  onCancel: () => void
  onDone:  () => void
}

export default function PhotoScan({ onSave, onCancel: _onCancel, onDone }: Props) {
  const inputRef                        = useRef<HTMLInputElement>(null)
  const galleryRef                      = useRef<HTMLInputElement>(null)
  const [scanning, setScanning]         = useState(false)
  const [progress, setProgress]         = useState('')
  const [current, setCurrent]           = useState(0)
  const [total, setTotal]               = useState(0)
  const [results, setResults]           = useState<SavedResult[]>([])
  const [done, setDone]                 = useState(false)
  const [error, setError]               = useState<string | null>(null)

  const toNewItem = (f: FoodFromPhoto): NewFridgeItem => ({
    name: f.name, quantity: f.quantity, unit: f.unit,
    category: f.category, expiry_date: f.expiry_date,
    conservation_tip: f.conservation_tip,
    calories_per_100g: f.calories_per_100g,
    protein_g: f.protein_g, carbs_g: f.carbs_g, fat_g: f.fat_g,
    added_by_photo: true, location: 'nevera', notes: null,
  })

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

  const readFile = (file: File): Promise<string> =>
    new Promise(resolve => {
      const r = new FileReader()
      r.onload = () => resolve(r.result as string)
      r.readAsDataURL(file)
    })

  const processFiles = async (files: FileList) => {
    setError(null)
    setResults([])
    setDone(false)
    setScanning(true)
    setTotal(files.length)
    setCurrent(0)

    for (let i = 0; i < files.length; i++) {
      setCurrent(i + 1)
      setProgress(`Analizando foto ${i + 1} de ${files.length}...`)

      try {
        const rawUrl      = await readFile(files[i])
        const compressed  = await compressImage(rawUrl)
        const base64      = compressed.split(',')[1]
        const detected    = await scanFoodPhoto(base64, 'image/jpeg')
        const item        = toNewItem(detected)

        // Guardar inmediatamente — no esperar confirmación del usuario
        await onSave(item)

        setResults(prev => [...prev, { name: detected.name, success: true }])
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        setResults(prev => [...prev, { name: `Foto ${i + 1}`, success: false, error: msg }])
      }
    }

    setScanning(false)
    setDone(true)
  }

  // Pantalla de resultados finales
  if (done) {
    const ok   = results.filter(r => r.success).length
    const fail = results.filter(r => !r.success).length
    return (
      <div className="flex flex-col gap-5">
        <div className="text-center">
          <p className="text-4xl mb-2">{ok > 0 ? '✅' : '❌'}</p>
          <p className="font-semibold text-text text-lg">
            {ok} alimento{ok !== 1 ? 's' : ''} guardado{ok !== 1 ? 's' : ''}
            {fail > 0 ? `, ${fail} sin leer` : ''}
          </p>
          <p className="text-muted text-sm mt-1">Ya están en tu nevera.</p>
        </div>

        <div className="flex flex-col gap-1.5 max-h-60 overflow-y-auto">
          {results.map((r, i) => (
            <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm
              ${r.success ? 'bg-green-50 text-text' : 'bg-red-50 text-error'}`}>
              <span>{r.success ? '✓' : '✗'}</span>
              <span className="flex-1">{r.name}</span>
            </div>
          ))}
        </div>

        <button onClick={onDone} className="btn-primary">
          Ver mi nevera
        </button>
      </div>
    )
  }

  // Pantalla de carga
  if (scanning) {
    const pct = total > 0 ? Math.round((current / total) * 100) : 0
    return (
      <div className="flex flex-col items-center gap-5 py-6 w-full">
        <p className="text-text font-medium text-center">{progress}</p>

        {/* Barra de progreso */}
        <div className="w-full bg-border rounded-full h-2">
          <div className="bg-accent h-2 rounded-full transition-all duration-300"
            style={{ width: `${pct}%` }} />
        </div>
        <p className="text-muted text-sm">{current} de {total} — {pct}%</p>

        {/* Resultados en tiempo real */}
        {results.length > 0 && (
          <div className="w-full flex flex-col gap-1 max-h-40 overflow-y-auto">
            {results.map((r, i) => (
              <div key={i} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs
                ${r.success ? 'bg-green-50 text-text' : 'bg-red-50 text-error'}`}>
                <span>{r.success ? '✓' : '✗'}</span>
                <span>{r.name}</span>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-muted text-center px-4">
          🔒 No cierres esta ventana — cada foto se guarda automáticamente al procesarse.
        </p>
      </div>
    )
  }

  // Pantalla inicial
  return (
    <div className="flex flex-col gap-5 items-center py-4">
      <input ref={inputRef} type="file" accept="image/*" capture="environment"
        multiple className="hidden"
        onChange={e => { if (e.target.files?.length) processFiles(e.target.files) }}
      />
      <input ref={galleryRef} type="file" accept="image/*"
        multiple className="hidden"
        onChange={e => { if (e.target.files?.length) processFiles(e.target.files) }}
      />

      <div className="w-24 h-24 rounded-full bg-accent-light flex items-center justify-center text-5xl">
        📷
      </div>
      <div className="text-center">
        <p className="font-semibold text-text">Foto del alimento</p>
        <p className="text-muted text-sm mt-1">
          Selecciona una o varias fotos. Claude las analiza y las guarda automáticamente en tu nevera.
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

      {error && (
        <div className="w-full bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-error text-center">
          {error}
        </div>
      )}
    </div>
  )
}
