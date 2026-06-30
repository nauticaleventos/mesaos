import { useRef, useState, useCallback } from 'react'
import { scanFoodPhoto, scanFoodPhotoGroup, scanReceiptPhoto, type FoodFromPhoto } from '../../lib/claude'
import { useFridgeStore, type FridgeItem, type NewFridgeItem } from '../../store/fridgeStore'
import { useFamilyStore } from '../../store/familyStore'
import { useLimiteStore } from '../../store/limiteStore'
import EnrichFromPhoto from './EnrichFromPhoto'

interface SavedResult {
  name:    string
  success: boolean
  error?:  string
  item?:   FridgeItem   // item guardado — para editar
}

interface Props {
  onSave:   (item: NewFridgeItem) => Promise<FridgeItem | null>
  onCancel: () => void
  onDone:   () => void
  onEdit:   (item: FridgeItem) => void
}

export default function PhotoScan({ onSave, onDone, onEdit }: Props) {
  const { puedeUsar, consumirUso } = useFamilyStore()
  const abrirLimite = useLimiteStore(s => s.abrir)
  const batchRef   = useRef<HTMLInputElement>(null)
  const groupRef   = useRef<HTMLInputElement>(null)
  const receiptRef = useRef<HTMLInputElement>(null)

  const [scanning,  setScanning]  = useState(false)
  const [progress,  setProgress]  = useState('')
  const [current,   setCurrent]   = useState(0)
  const [total,     setTotal]     = useState(0)
  const [results,   setResults]   = useState<SavedResult[]>([])
  const [done,      setDone]      = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  // Estado para confirmación de duplicado
  const [dupConfirm, setDupConfirm] = useState<{
    detected: FoodFromPhoto
    existing: FridgeItem
    resolve: (action: 'save' | 'skip') => void
  } | null>(null)

  // Detecta si ya existe un ítem similar en la nevera
  const findDuplicate = useCallback((name: string): FridgeItem | null => {
    const items = useFridgeStore.getState().items
    const n = name.toLowerCase().trim()
    return items.find(i => {
      const existing = i.name.toLowerCase().trim()
      return existing === n || existing.includes(n) || n.includes(existing)
    }) ?? null
  }, [])

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const readFile = (file: File): Promise<string> =>
    new Promise(resolve => {
      const r = new FileReader()
      r.onload = () => resolve(r.result as string)
      r.readAsDataURL(file)
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

  const toNewItem = (f: FoodFromPhoto): NewFridgeItem => ({
    name: f.name, quantity: f.quantity, unit: f.unit,
    category: f.category, expiry_date: f.expiry_date,
    conservation_tip: f.conservation_tip,
    calories_per_100g: f.calories_per_100g,
    protein_g: f.protein_g, carbs_g: f.carbs_g, fat_g: f.fat_g,
    added_by_photo: true, location: 'nevera', notes: null,
  })

  const addResult = (r: SavedResult) => setResults(prev => [...prev, r])

  const saveAndTrack = async (det: FoodFromPhoto, _label: string) => {
    // Verificar duplicado
    const dup = findDuplicate(det.name)
    if (dup) {
      const action = await new Promise<'save' | 'skip'>(resolve => {
        setDupConfirm({ detected: det, existing: dup, resolve })
      })
      setDupConfirm(null)
      if (action === 'skip') {
        addResult({ name: det.name, success: false, error: 'Saltado — ya existía' })
        return
      }
    }
    const saved = await onSave(toNewItem(det))
    addResult({ name: det.name, success: true, item: saved ?? undefined })
  }

  // ── Modo batch: cada foto = un producto distinto ──────────────────────────────
  const processBatch = async (files: FileList) => {
    if (!puedeUsar('fotos_nevera')) { abrirLimite('fotos_nevera'); return }
    setError(null); setResults([]); setDone(false)
    setScanning(true); setTotal(files.length); setCurrent(0)

    for (let i = 0; i < files.length; i++) {
      if (!puedeUsar('fotos_nevera')) { setScanning(false); abrirLimite('fotos_nevera'); break }
      setCurrent(i + 1)
      setProgress(`Analizando foto ${i + 1} de ${files.length}...`)
      try {
        const raw  = await readFile(files[i])
        const comp = await compressImage(raw)
        const det  = await scanFoodPhoto(comp.split(',')[1], 'image/jpeg')
        await consumirUso('fotos_nevera')
        await saveAndTrack(det, `Foto ${i + 1}`)
      } catch (e) {
        addResult({ name: `Foto ${i + 1}`, success: false, error: e instanceof Error ? e.message : String(e) })
      }
    }
    setScanning(false); setDone(true)
  }

  // ── Modo grupo: varias fotos = UN mismo producto ──────────────────────────────
  const processGroup = async (files: FileList) => {
    if (files.length < 2) return processBatch(files)
    if (!puedeUsar('fotos_nevera')) { abrirLimite('fotos_nevera'); return }
    setError(null); setResults([]); setDone(false)
    setScanning(true); setTotal(1); setCurrent(1)
    setProgress(`Combinando ${files.length} fotos del mismo producto...`)

    try {
      const images = await Promise.all(
        Array.from(files).map(async f => {
          const raw  = await readFile(f)
          const comp = await compressImage(raw)
          return { base64: comp.split(',')[1], mime: 'image/jpeg' }
        })
      )
      const det = await scanFoodPhotoGroup(images)
      await consumirUso('fotos_nevera')
      await saveAndTrack(det, 'Grupo')
    } catch (e) {
      addResult({ name: 'Grupo de fotos', success: false, error: e instanceof Error ? e.message : String(e) })
    }
    setScanning(false); setDone(true)
  }

  // ── Pantalla de resultados ────────────────────────────────────────────────────
  if (done) {
    const ok   = results.filter(r => r.success).length
    const fail = results.filter(r => !r.success).length
    return (
      <div className="flex flex-col gap-4">
        <div className="text-center">
          <p className="text-4xl mb-2">{ok > 0 ? '✅' : '❌'}</p>
          <p className="font-semibold text-text text-lg">
            {ok} guardado{ok !== 1 ? 's' : ''}
            {fail > 0 ? `, ${fail} sin leer` : ''}
          </p>
          <p className="text-muted text-sm mt-1">Toca ✏️ para corregir cualquier dato.</p>
        </div>
        <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
          {results.map((r, i) => <ResultRow key={i} result={r} onEdit={onEdit} />)}
        </div>
        <button onClick={onDone} className="btn-primary">Ver mi nevera</button>
      </div>
    )
  }

  // ── Modo tiquete: foto del recibo → todos los artículos ──────────────────────
  const processReceipt = async (files: FileList) => {
    const file = files[0]
    if (!file) return
    if (!puedeUsar('fotos_nevera')) { abrirLimite('fotos_nevera'); return }
    setError(null); setResults([]); setDone(false)
    setScanning(true); setTotal(1); setCurrent(1)
    setProgress('Leyendo el tiquete de compra...')

    try {
      const raw       = await readFile(file)
      const comp      = await compressImage(raw)
      const base64    = comp.split(',')[1]
      const detected  = await scanReceiptPhoto(base64)
      await consumirUso('fotos_nevera')

      setProgress(`Guardando ${detected.length} artículo${detected.length !== 1 ? 's' : ''}...`)
      setTotal(detected.length); setCurrent(0)

      for (let i = 0; i < detected.length; i++) {
        setCurrent(i + 1)
        await saveAndTrack(detected[i], `Artículo ${i + 1}`)
      }
    } catch (e) {
      const localError = e instanceof Error ? e.message : String(e)
      setError(localError)
    }

    setScanning(false); setDone(true)
  }

  // ── Modal de duplicado ────────────────────────────────────────────────────────
  if (dupConfirm) {
    return (
      <div className="flex flex-col gap-5 py-2">
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex flex-col gap-3">
          <p className="font-semibold text-text text-sm">⚠️ Posible duplicado</p>
          <p className="text-sm text-text">
            Claude identificó <strong>"{dupConfirm.detected.name}"</strong> pero ya tienes{' '}
            <strong>"{dupConfirm.existing.name}"</strong> en la nevera.
          </p>
          <p className="text-muted text-xs">¿Es el mismo producto o son diferentes?</p>
        </div>
        <div className="flex flex-col gap-2">
          <button onClick={() => dupConfirm.resolve('skip')}
            className="btn-ghost">
            Es el mismo — Saltar (no duplicar)
          </button>
          <button onClick={() => dupConfirm.resolve('save')}
            className="btn-primary">
            Son diferentes — Guardar igual
          </button>
        </div>
      </div>
    )
  }

  // ── Pantalla de carga ─────────────────────────────────────────────────────────
  if (scanning) {
    const pct = total > 0 ? Math.round((current / total) * 100) : 0
    return (
      <div className="flex flex-col gap-4 w-full">
        <div className="flex items-center justify-between">
          <p className="text-text font-medium text-sm">{progress}</p>
          <button onClick={onDone} className="text-accent text-xs font-medium">Ver nevera →</button>
        </div>
        <div className="w-full bg-border rounded-full h-2">
          <div className="bg-accent h-2 rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-muted text-xs text-center">{current} de {total} — {pct}%</p>
        {results.length > 0 && (
          <div className="flex flex-col gap-1.5 max-h-52 overflow-y-auto">
            {results.map((r, i) => <ResultRow key={i} result={r} onEdit={onEdit} />)}
          </div>
        )}
        <p className="text-xs text-muted text-center px-4">
          🔒 No cierres esta ventana — cada foto se guarda automáticamente.
        </p>
      </div>
    )
  }

  // ── Pantalla inicial ──────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-5 py-2">
      <input ref={batchRef} type="file" accept="image/*" multiple className="hidden"
        onChange={e => { if (e.target.files?.length) processBatch(e.target.files) }} />
      <input ref={groupRef} type="file" accept="image/*" multiple className="hidden"
        onChange={e => { if (e.target.files?.length) processGroup(e.target.files) }} />
      <input ref={receiptRef} type="file" accept="image/*" className="hidden"
        onChange={e => { if (e.target.files?.length) processReceipt(e.target.files) }} />

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-error">{error}</div>
      )}

      {/* Modo 1 — Productos distintos */}
      <div className="card flex flex-col gap-3">
        <div>
          <p className="font-semibold text-text text-sm">📦 Productos distintos</p>
          <p className="text-muted text-xs mt-0.5">Cada foto es un alimento diferente. Claude los procesa uno por uno y los guarda.</p>
        </div>
        <button type="button" onClick={() => batchRef.current?.click()} className="btn-primary">
          Seleccionar fotos (1 o varias)
        </button>
      </div>

      {/* Modo 2 — Mismo producto */}
      <div className="card flex flex-col gap-3">
        <div>
          <p className="font-semibold text-text text-sm">🔍 Mismo producto, varias fotos</p>
          <p className="text-muted text-xs mt-0.5">
            Ej: una foto tiene el nombre, otra tiene la tabla nutricional.
            Claude combina toda la información en un solo alimento.
          </p>
        </div>
        <button type="button" onClick={() => groupRef.current?.click()} className="btn-ghost">
          Seleccionar fotos del mismo producto
        </button>
      </div>

      {/* Modo 3 — Tiquete de compra */}
      <div className="card flex flex-col gap-3">
        <div>
          <p className="font-semibold text-text text-sm">🧾 Tiquete de compra</p>
          <p className="text-muted text-xs mt-0.5">
            Foto del recibo del supermercado. Claude lee todos los artículos,
            normaliza los nombres abreviados y los agrega a tu nevera de una vez.
          </p>
        </div>
        <button type="button" onClick={() => receiptRef.current?.click()} className="btn-ghost">
          Fotografiar mi tiquete
        </button>
      </div>
    </div>
  )
}

function ResultRow({ result, onEdit }: { result: SavedResult; onEdit: (item: FridgeItem) => void }) {
  const [enriching, setEnriching] = useState(false)
  const updateItem = useFridgeStore(s => s.updateItem)

  const handleEnrich = async (data: import('../../lib/claude').EnrichmentFromPhoto) => {
    if (!result.item) return
    await updateItem(result.item.id, {
      expiry_date:       data.expiry_date,
      calories_per_100g: data.calories_per_100g,
      protein_g:         data.protein_g,
      carbs_g:           data.carbs_g,
      fat_g:             data.fat_g,
      conservation_tip:  data.conservation_tip ?? result.item.conservation_tip,
    })
    setEnriching(false)
  }

  return (
    <div className={`flex flex-col gap-2 px-3 py-2.5 rounded-xl
      ${result.success ? 'bg-green-50' : 'bg-red-50'}`}>
      <div className="flex items-center gap-2">
        <span className={result.success ? 'text-success' : 'text-error'}>
          {result.success ? '✓' : '✗'}
        </span>
        <span className="flex-1 text-text text-sm truncate">{result.name}</span>
        {result.success && result.item && (
          <div className="flex gap-2">
            <button onClick={() => setEnriching(e => !e)}
              className="text-muted text-xs hover:text-accent transition-colors whitespace-nowrap">
              📷 Foto
            </button>
            <button onClick={() => onEdit(result.item!)}
              className="text-accent text-xs font-medium hover:underline whitespace-nowrap">
              ✏️
            </button>
          </div>
        )}
        {!result.success && result.error && (
          <span className="text-error text-xs truncate max-w-24">{result.error}</span>
        )}
      </div>
      {enriching && result.item && (
        <EnrichFromPhoto
          foodName={result.item.name}
          onEnrich={handleEnrich}
          onCancel={() => setEnriching(false)}
        />
      )}
    </div>
  )
}
