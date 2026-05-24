import { useState } from 'react'
import type { NewFridgeItem } from '../../store/fridgeStore'
import { getConservationTip } from '../../lib/claude'

const CATEGORIES = [
  'proteína','lácteos','frutas y verduras','granos y cereales',
  'salsas y condimentos','bebidas','snacks','congelados','otros',
]

const UNITS = ['kg','g','L','ml','unidades','porciones','bolsa','caja','lata','frasco']

interface Props {
  initial?: Partial<NewFridgeItem>
  onSave: (item: NewFridgeItem) => void
  onCancel: () => void
}

const empty = (): NewFridgeItem => ({
  name: '', quantity: null, unit: null,
  category: 'otros', location: 'nevera',
  expiry_date: null, conservation_tip: null,
  calories_per_100g: null, protein_g: null,
  carbs_g: null, fat_g: null,
  added_by_photo: false, notes: null,
})

function inferirUbicacion(categoria: string, nombre: string): 'nevera' | 'congelador' | 'despensa' {
  const n = nombre.toLowerCase()
  const c = categoria.toLowerCase()

  // Keywords en nombre que fuerzan congelador
  if (['helado','congelado','congelada','frozen','hielo'].some(k => n.includes(k))) return 'congelador'
  // Categoría congelados
  if (c === 'congelados') return 'congelador'

  // Categorías que van a nevera
  if (['proteína','lácteos','frutas y verduras'].includes(c)) return 'nevera'
  // Keywords en nombre para nevera
  if (['leche','yogur','queso','huevo','crema','mantequilla','nata',
       'pollo','carne','res','cerdo','pescado','mariscos','embutido',
       'fruta','verdura','ensalada','zumo','jugo fresco'].some(k => n.includes(k))) return 'nevera'

  // Categorías que van a despensa
  if (['granos y cereales','salsas y condimentos','bebidas','snacks','otros'].includes(c)) return 'despensa'
  // Keywords en nombre para despensa
  if (['harina','arroz','pasta','lenteja','garbanzo','frijol','avena',
       'aceite','vinagre','sal','azúcar','cafe','té ','miel',
       'enlatado','lata','conserva','seco'].some(k => n.includes(k))) return 'despensa'

  return 'nevera' // default
}

export default function AddItemForm({ initial, onSave, onCancel }: Props) {
  const [form, setForm]           = useState<NewFridgeItem>({ ...empty(), ...initial })
  const [loadingTip, setLoadingTip] = useState(false)
  const [showMacros, setShowMacros] = useState(
    !!(initial?.calories_per_100g || initial?.protein_g)
  )

  const set = (f: string, v: unknown) => setForm(p => ({ ...p, [f]: v }))

  const fetchTip = async () => {
    if (!form.name.trim()) return
    setLoadingTip(true)
    try {
      const tip = await getConservationTip(form.name)
      set('conservation_tip', tip)
    } catch { /* sin API key aún */ }
    setLoadingTip(false)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return
    onSave(form)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">

      {/* Nombre */}
      <div>
        <label className="input-label">Nombre del alimento *</label>
        <input
          type="text" placeholder="Ej: Pechuga de pollo, Leche entera..."
          value={form.name}
          onChange={e => set('name', e.target.value)}
          onBlur={e => {
            fetchTip()
            set('location', inferirUbicacion(form.category, e.target.value))
          }}
          required autoFocus
        />
      </div>

      {/* Cantidad + unidad */}
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="input-label">Cantidad</label>
          <input type="number" placeholder="500" min={0} step={0.01}
            value={form.quantity ?? ''}
            onChange={e => set('quantity', e.target.value ? +e.target.value : null)}
          />
        </div>
        <div className="w-32">
          <label className="input-label">Unidad</label>
          <select value={form.unit ?? ''} onChange={e => set('unit', e.target.value || null)}>
            <option value="">—</option>
            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
      </div>

      {/* Categoría + ubicación */}
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="input-label">Categoría</label>
          <select value={form.category} onChange={e => {
            const cat = e.target.value
            set('category', cat)
            set('location', inferirUbicacion(cat, form.name))
          }}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="w-36">
          <label className="input-label">Dónde está</label>
          <select value={form.location} onChange={e => set('location', e.target.value as NewFridgeItem['location'])}>
            <option value="nevera">🧊 Nevera</option>
            <option value="congelador">❄️ Congelador</option>
            <option value="despensa">🗄️ Despensa</option>
          </select>
        </div>
      </div>

      {/* Vencimiento */}
      <div>
        <label className="input-label">Fecha de vencimiento</label>
        <input type="date"
          value={form.expiry_date ?? ''}
          onChange={e => set('expiry_date', e.target.value || null)}
          min={new Date().toISOString().split('T')[0]}
        />
      </div>

      {/* Tip de conservación */}
      <div>
        <label className="input-label">
          Tip de conservación
          {loadingTip && <span className="text-muted text-xs ml-2">cargando...</span>}
        </label>
        <textarea rows={2} placeholder="Se genera automáticamente al escribir el nombre..."
          value={form.conservation_tip ?? ''}
          onChange={e => set('conservation_tip', e.target.value || null)}
          style={{ resize: 'none' }}
        />
      </div>

      {/* Macros (colapsable) */}
      <div>
        <button type="button" onClick={() => setShowMacros(v => !v)}
          className="text-sm text-muted hover:text-text flex items-center gap-1 transition-colors">
          {showMacros ? '▲' : '▼'} Información nutricional (opcional)
        </button>
        {showMacros && (
          <div className="grid grid-cols-2 gap-2 mt-2">
            {[
              ['cal/100g', 'calories_per_100g'],
              ['Proteína g', 'protein_g'],
              ['Carbos g',   'carbs_g'],
              ['Grasas g',   'fat_g'],
            ].map(([label, field]) => (
              <div key={field}>
                <label className="input-label">{label}</label>
                <input type="number" placeholder="—" min={0} step={0.1}
                  value={(form[field as keyof NewFridgeItem] as number) ?? ''}
                  onChange={e => set(field, e.target.value ? +e.target.value : null)}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Botones */}
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn-ghost flex-1">
          Cancelar
        </button>
        <button type="submit" className="btn-primary flex-1" disabled={!form.name.trim()}>
          Guardar
        </button>
      </div>
    </form>
  )
}
