import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRecipesStore, type Recipe } from '../../store/recipesStore'

interface Props {
  familyId: string
  onSaved:  () => void
  onCancel: () => void
}

type Visibility = 'public' | 'private'

export default function ImportarReceta({ familyId, onSaved, onCancel }: Props) {
  const [url, setUrl]               = useState('')
  const [sourceText, setSourceText] = useState('')
  const [visibility, setVisibility] = useState<Visibility>('public')
  const [loading, setLoading]       = useState(false)
  const [preview, setPreview]       = useState<Partial<Recipe> | null>(null)
  const [error, setError]           = useState<string | null>(null)
  const addRecipe                   = useRecipesStore(s => s.addRecipe)

  const importarDesdeUrl = async () => {
    if (!url.trim()) return
    setError(null); setLoading(true); setPreview(null)
    try {
      const res  = await fetch('/api/importar-receta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al importar')
      setPreview({ ...data.recipe, is_base_recipe: false, family_id: familyId })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
    setLoading(false)
  }

  const guardar = async () => {
    if (!preview) return
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const err = await addRecipe({
      ...preview,
      family_id:            familyId,
      is_base_recipe:       false,
      visibility,
      created_by_user_id:   user?.id ?? null,
      created_in_family_id: familyId,
      source:               sourceText.trim() || url.trim() || null,
      is_active_for_menu:   true,
    } as Omit<Recipe, 'id' | 'created_at'>)
    setLoading(false)
    if (err) return setError(err)
    onSaved()
  }

  return (
    <div className="flex flex-col gap-4">

      {/* Link */}
      <div>
        <label className="input-label">Link de la receta</label>
        <input
          type="url"
          placeholder="https://www.tiktok.com/... o https://..."
          value={url}
          onChange={e => setUrl(e.target.value)}
          autoFocus
        />
        <p className="text-xs text-muted mt-1">
          Funciona con TikTok, Instagram, YouTube, blogs de cocina, etc.
        </p>
      </div>

      {/* Visibilidad — siempre visible */}
      <div>
        <label className="input-label">Visibilidad</label>
        <div className="flex gap-2">
          {([['public','🌐 Pública'], ['private','🔒 Solo mi familia']] as [Visibility, string][]).map(([v, label]) => (
            <button key={v} type="button" onClick={() => setVisibility(v)}
              className={`flex-1 py-2 rounded-xl border-2 text-xs font-medium transition-all
                ${visibility === v ? 'border-accent bg-accent-light text-accent' : 'border-border text-muted'}`}>
              {label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted mt-1">
          {visibility === 'public' ? 'Otras familias en mesa.os podrán verla.' : 'Solo visible para tu familia.'}
        </p>
      </div>

      {/* Fuente — siempre visible */}
      <div>
        <label className="input-label">Fuente <span className="font-normal text-muted">(opcional)</span></label>
        <input type="text" placeholder="Ej: Abuela Rosa, canal @cocina, libro X..."
          value={sourceText} onChange={e => setSourceText(e.target.value)} />
      </div>

      {error && <p className="text-error text-sm">{error}</p>}

      {loading && (
        <div className="flex items-center gap-3 text-muted text-sm">
          <div className="flex gap-1">
            <span className="w-2 h-2 rounded-full bg-accent animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-2 h-2 rounded-full bg-accent animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-2 h-2 rounded-full bg-accent animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          Claude está leyendo la receta...
        </div>
      )}

      {/* Preview */}
      {preview && (
        <div className="card flex flex-col gap-3 border-accent">
          <p className="text-xs text-accent font-medium">✓ Receta detectada — revisa y guarda</p>
          <p className="font-semibold text-text">{preview.nombre}</p>
          {preview.descripcion_corta && <p className="text-muted text-xs">{preview.descripcion_corta}</p>}
          <div className="flex gap-2 flex-wrap text-xs text-muted">
            {preview.tiempo_total_min && <span>⏱ {preview.tiempo_total_min}min</span>}
            {preview.dificultad && <span>• {preview.dificultad}</span>}
            {preview.porciones && <span>• {preview.porciones} porciones</span>}
          </div>
          <p className="text-xs text-muted">
            {(preview.ingredientes as { nombre: string }[] ?? []).length} ingredientes · {(preview.pasos as string[] ?? []).length} pasos
          </p>
          <button onClick={guardar} className="btn-primary" disabled={loading}>
            {loading ? 'Guardando...' : 'Guardar en mi recetario'}
          </button>
        </div>
      )}

      {!preview && !loading && (
        <button onClick={importarDesdeUrl} className="btn-primary" disabled={!url.trim()}>
          Importar receta
        </button>
      )}

      <button onClick={onCancel} className="btn-ghost">Cancelar</button>
    </div>
  )
}
