/**
 * FormaPDF
 *
 * Flujo:
 * 1. Usuario sube un PDF
 * 2. Se convierte a base64 y se envía a /api/import-pdf
 * 3. Claude devuelve 1 o más recetas
 * 4. Si hay UNA → onExtracted(recipe) directamente
 * 5. Si hay VARIAS → mostrar lista con checkboxes, importar las seleccionadas
 *    en secuencia (onExtracted se llama una por una)
 */

import { useRef, useState } from 'react'
import { FileText, Upload, Check } from 'lucide-react'
import { importFromPDF, fileToBase64, type RecipeImport } from '../../../lib/claudeImport'

interface Props {
  onExtracted: (receta: RecipeImport) => void
  onBack:      () => void
}

type Fase = 'upload' | 'procesando' | 'lista' | 'error'

export default function FormaPDF({ onExtracted, onBack }: Props) {
  const inputRef                = useRef<HTMLInputElement>(null)
  const [fase, setFase]         = useState<Fase>('upload')
  const [error, setError]       = useState<string | null>(null)
  const [recetas, setRecetas]   = useState<RecipeImport[]>([])
  const [seleccion, setSeleccion] = useState<Set<number>>(new Set())
  const [progreso, setProgreso] = useState(0) // 0-100 para múltiples

  const procesar = async (file: File) => {
    if (file.type !== 'application/pdf') {
      setError('El archivo debe ser un PDF (.pdf)')
      setFase('error')
      return
    }
    if (file.size > 15 * 1024 * 1024) {
      setError('El PDF es demasiado grande (máximo 15 MB)')
      setFase('error')
      return
    }

    setFase('procesando')
    setError(null)

    try {
      const { base64 } = await fileToBase64(file)
      const found      = await importFromPDF(base64)

      if (found.length === 0) {
        setError('No encontré recetas en este PDF. ¿Tiene contenido de texto?')
        setFase('error')
        return
      }

      if (found.length === 1) {
        // Una sola receta → pasar directo
        onExtracted(found[0])
        return
      }

      // Varias recetas → mostrar lista
      setRecetas(found)
      setSeleccion(new Set(found.map((_, i) => i))) // todas seleccionadas por defecto
      setFase('lista')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error procesando el PDF')
      setFase('error')
    }
  }

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) procesar(file)
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) procesar(file)
  }

  const toggleSeleccion = (i: number) => {
    setSeleccion(prev => {
      const s = new Set(prev)
      s.has(i) ? s.delete(i) : s.add(i)
      return s
    })
  }

  // Importar recetas seleccionadas en secuencia
  const importarSeleccionadas = async () => {
    const indices = [...seleccion].sort()
    for (let i = 0; i < indices.length; i++) {
      setProgreso(Math.round(((i + 1) / indices.length) * 100))
      onExtracted(recetas[indices[i]])
      // pequeño delay para que la UI actualice (el wizard se abre para cada una)
      await new Promise(r => setTimeout(r, 200))
    }
  }

  // ── UPLOAD ────────────────────────────────────────────────────────────────
  if (fase === 'upload') {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <p className="font-medium text-text text-sm">Importar desde PDF</p>
          <p className="text-xs text-muted mt-0.5">
            Subí un PDF con una o varias recetas. Claude extraerá toda la información automáticamente.
          </p>
        </div>

        {/* Drop zone */}
        <div
          onDrop={onDrop}
          onDragOver={e => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
          className="flex flex-col items-center gap-3 p-8 rounded-2xl border-2 border-dashed border-accent/40 bg-accent/5 cursor-pointer hover:border-accent hover:bg-accent/10 transition-all active:scale-98">
          <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center">
            <FileText size={28} color="#E76F51" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-text">Tocá para elegir un PDF</p>
            <p className="text-xs text-muted mt-0.5">o arrastrá el archivo aquí</p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted">
            <Upload size={12} />
            <span>PDF · Máximo 15 MB</span>
          </div>
        </div>

        <input ref={inputRef} type="file" accept=".pdf,application/pdf"
          className="hidden" onChange={onFileChange} />

        <p className="text-[11px] text-muted text-center">
          💡 Funciona con libros de recetas, menús escaneados, recetarios digitales
        </p>

        <button onClick={onBack} className="btn-ghost text-sm">← Volver</button>
      </div>
    )
  }

  // ── PROCESANDO ────────────────────────────────────────────────────────────
  if (fase === 'procesando') {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center">
          <FileText size={32} color="#E76F51" className="animate-pulse" />
        </div>
        <div className="text-center">
          <p className="font-medium text-text">Procesando PDF...</p>
          <p className="text-xs text-muted mt-1">Claude está leyendo y extrayendo las recetas</p>
          <p className="text-xs text-muted mt-0.5">Puede tardar 10-30 segundos</p>
        </div>
        <div className="flex gap-1.5 mt-2">
          {[0, 150, 300].map(d => (
            <span key={d} className="w-2 h-2 rounded-full bg-accent animate-bounce"
              style={{ animationDelay: `${d}ms` }} />
          ))}
        </div>
      </div>
    )
  }

  // ── ERROR ─────────────────────────────────────────────────────────────────
  if (fase === 'error') {
    return (
      <div className="flex flex-col gap-4">
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200">
          <p className="text-sm font-medium text-red-700">No se pudo procesar el PDF</p>
          <p className="text-xs text-red-500 mt-1">{error}</p>
        </div>
        <button onClick={() => { setFase('upload'); setError(null) }} className="btn-primary">
          Intentar con otro PDF
        </button>
        <button onClick={onBack} className="btn-ghost text-sm">← Volver</button>
      </div>
    )
  }

  // ── LISTA DE RECETAS ENCONTRADAS ──────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="font-medium text-text text-sm">
          Encontramos {recetas.length} receta{recetas.length !== 1 ? 's' : ''} 🎉
        </p>
        <p className="text-xs text-muted mt-0.5">
          Seleccioná las que querés importar. Para cada una vas a clasificarla en los próximos pasos.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {recetas.map((r, i) => {
          const sel = seleccion.has(i)
          return (
            <button key={i} onClick={() => toggleSeleccion(i)}
              className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all
                ${sel ? 'border-accent bg-accent/5' : 'border-border hover:border-accent/30'}`}>
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all
                ${sel ? 'border-accent bg-accent' : 'border-border'}`}>
                {sel && <Check size={13} color="white" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${sel ? 'text-accent' : 'text-text'}`}>
                  {r.nombre}
                </p>
                {r.descripcion_corta && (
                  <p className="text-xs text-muted truncate mt-0.5">{r.descripcion_corta}</p>
                )}
              </div>
              <span className="text-xs text-muted flex-shrink-0">
                {r.ingredientes.length} ing.
              </span>
            </button>
          )
        })}
      </div>

      <div className="flex items-center justify-between text-xs text-muted">
        <button onClick={() => setSeleccion(new Set(recetas.map((_, i) => i)))}
          className="hover:text-accent transition-colors">Seleccionar todas</button>
        <button onClick={() => setSeleccion(new Set())}
          className="hover:text-text transition-colors">Deseleccionar</button>
      </div>

      {progreso > 0 && progreso < 100 && (
        <div className="flex flex-col gap-1">
          <div className="w-full bg-gray-100 rounded-full h-1.5">
            <div className="bg-accent h-1.5 rounded-full transition-all" style={{ width: `${progreso}%` }} />
          </div>
          <p className="text-xs text-muted text-center">Importando...</p>
        </div>
      )}

      <button
        onClick={importarSeleccionadas}
        disabled={seleccion.size === 0}
        className="btn-primary disabled:opacity-40">
        Importar {seleccion.size > 0 ? `${seleccion.size} ` : ''}seleccionada{seleccion.size !== 1 ? 's' : ''} →
      </button>

      <button onClick={onBack} className="btn-ghost text-sm">← Volver</button>
    </div>
  )
}
