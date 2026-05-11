import { useState } from 'react'
import { useFamilyStore } from '../../store/familyStore'
import type { FamilyMember } from '../../lib/types'
import ActividadesList from '../family/ActividadesList'

// Base types con variantes de tono de piel (como WhatsApp)
const SKIN_TONES = ['', '🏻', '🏼', '🏽', '🏾', '🏿']
const TONE_LABELS = ['🟡', '🏻', '🏼', '🏽', '🏾', '🏿']

const BASE_TYPES = [
  { base: '👨', label: 'Hombre' },
  { base: '👩', label: 'Mujer' },
  { base: '👦', label: 'Niño' },
  { base: '👧', label: 'Niña' },
  { base: '👴', label: 'Abuelo' },
  { base: '👵', label: 'Abuela' },
  { base: '👶', label: 'Bebé' },
]

const SPECIAL_EMOJIS = ['🦄','🐱','🐶','🐻','🦊','🐼','🐸','🤖','👻','⭐','🌟','💫']

const GOALS = [
  { value: 'deficit',         label: 'Bajar de peso',         desc: 'Déficit calórico moderado' },
  { value: 'deficit_agresivo',label: 'Bajar rápido',           desc: 'Déficit calórico agresivo' },
  { value: 'mantenimiento',   label: 'Mantener peso',          desc: 'Calorías de mantenimiento' },
  { value: 'volumen',         label: 'Ganar músculo',          desc: 'Superávit calórico' },
  { value: 'crecimiento',     label: 'Crecer (niño/adolescente)', desc: 'Soporte para crecimiento' },
]

const ACTIVITY = [
  { value: 'sedentary',   label: 'Sedentario',      desc: 'Poco o nada de ejercicio' },
  { value: 'moderate',    label: 'Moderado',         desc: '1-3 veces por semana' },
  { value: 'active',      label: 'Activo',           desc: '3-5 veces por semana' },
  { value: 'very_active', label: 'Muy activo',       desc: 'Diario o trabajo físico' },
]

const EATING_STYLES = [
  { value: 'omnivore',    label: '🍗 Todo come' },
  { value: 'vegetarian',  label: '🥗 Vegetariano' },
  { value: 'vegan',       label: '🌱 Vegano' },
  { value: 'keto',        label: '🥑 Keto' },
  { value: 'paleo',       label: '🦴 Paleo' },
  { value: 'gluten_free', label: '🌾 Sin gluten' },
  { value: 'lactose_free',label: '🥛 Sin lactosa' },
]

const CONDITIONS = [
  'Diabetes','Hipertensión','Celiaquía','TDA/TDAH','Embarazo',
  'Lactancia','Hipotiroidismo','Hipertiroidismo','Colesterol alto',
  'Enfermedad renal','Gota','Síndrome de intestino irritable',
]

interface Props {
  familyName:     string
  memberCount:    number
  onAdded:        () => void
  onFinish:       () => void
  // Modo edición
  editingMember?: FamilyMember
  onUpdated?:     () => void
}

const emptyMember = (): Omit<FamilyMember, 'id' | 'family_id' | 'created_at' | 'updated_at'> => ({
  name: '', emoji: '👤', color: null, member_type: 'adult',
  age: null, weight_kg: null, height_cm: null,
  is_portion_anchor: false, portion_multiplier: 1.0,
  goal: 'mantenimiento', goal_target_weight_kg: null, goal_target_date: null,
  activity_level: 'moderate',
  calories_default: null, calories_per_day: {},
  protein_g_default: null, carbs_g_default: null, fat_g_default: null,
  eating_style: 'omnivore',
  conditions: [], allergies: [], prohibited: [], dislikes: [],
  loves: [], favorite_recipes: [], restrictions_prep: [], meals_per_day: [],
  linked_user_id: null,
  side_prefs: { include_carbs: true, include_salad: true, notas: '' },
})

export default function StepAddMember({ familyName, memberCount, onAdded, onFinish, editingMember, onUpdated }: Props) {
  const isEditing = !!editingMember

  const [form, setForm]       = useState(() =>
    editingMember
      ? { ...emptyMember(), ...editingMember }
      : emptyMember()
  )
  const [allergyInput, setAllergyInput]       = useState('')
  const [prohibitedInput, setProhibitedInput] = useState('')
  const [dislikeInput, setDislikeInput]       = useState('')
  const [error, setError]                     = useState<string | null>(null)
  const [loading, setLoading]                 = useState(false)
  const addMember                             = useFamilyStore(s => s.addMember)
  const updateMember                          = useFamilyStore(s => s.updateMember)
  const members                               = useFamilyStore(s => s.members)

  const set = (field: string, value: unknown) =>
    setForm(f => ({ ...f, [field]: value }))

  const toggleCondition = (c: string) =>
    setForm(f => ({
      ...f,
      conditions: f.conditions.includes(c)
        ? f.conditions.filter((x: string) => x !== c)
        : [...f.conditions, c]
    }))

  const addTag = (field: 'allergies' | 'prohibited' | 'dislikes', val: string, clear: () => void) => {
    const trimmed = val.trim()
    if (!trimmed) return
    setForm(f => ({ ...f, [field]: [...f[field], trimmed] }))
    clear()
  }

  const removeTag = (field: 'allergies' | 'prohibited' | 'dislikes', val: string) =>
    setForm(f => ({ ...f, [field]: f[field].filter((x: string) => x !== val) }))

  const [savedName, setSavedName]       = useState<string | null>(null)
  const [selectedBase, setSelectedBase] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return setError('El nombre es obligatorio.')
    if (loading) return
    setError(null)
    setLoading(true)
    const name = form.name.trim()

    if (isEditing && editingMember?.id) {
      const err = await updateMember(editingMember.id, { ...form, name } as Partial<FamilyMember>)
      setLoading(false)
      if (err) return setError(err)
      onUpdated?.()
      return
    }

    const err = await addMember({ ...form, name } as FamilyMember)
    setLoading(false)
    if (err) return setError(err)
    setSavedName(name)
    setTimeout(() => {
      setSavedName(null)
      setForm(emptyMember())
      onAdded()
    }, 1800)
  }

  if (savedName) {
    return (
      <div className="flex flex-col items-center justify-center gap-5 py-16 text-center"
           style={{ animation: 'fadeInUp 0.3s ease' }}>
        <style>{`
          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(20px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          @keyframes pop {
            0%   { transform: scale(0.5); opacity: 0; }
            60%  { transform: scale(1.2); }
            100% { transform: scale(1);   opacity: 1; }
          }
        `}</style>
        <div style={{ animation: 'pop 0.4s ease' }} className="text-6xl">✅</div>
        <div>
          <p className="text-2xl font-serif font-semibold text-text">
            ¡{savedName} agregado!
          </p>
          <p className="text-muted text-sm mt-1">Preparando el formulario...</p>
        </div>
        <div className="flex gap-1.5 mt-2">
          <span className="w-2 h-2 rounded-full bg-accent animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 rounded-full bg-accent animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 rounded-full bg-accent animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-serif text-text font-semibold">
          {isEditing ? `Editar perfil de ${editingMember?.name}` : memberCount === 0 ? `¿Quién come en ${familyName}?` : 'Agregar otro miembro'}
        </h1>
        {!isEditing && (
          <p className="text-muted text-sm mt-1">
            {memberCount > 0 && `Ya tienes ${memberCount} miembro${memberCount > 1 ? 's' : ''}. `}
            Agrega a cada persona por separado.
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">

        {/* Nombre */}
        <div>
          <label className="input-label">Nombre</label>
          <input
            type="text" placeholder="Ej: Abel, Sarah..."
            value={form.name} onChange={e => set('name', e.target.value)}
            required autoFocus
          />
        </div>

        {/* Avatar estilo WhatsApp */}
        <div>
          <label className="input-label">
            Avatar — <span className="text-2xl">{form.emoji ?? '👤'}</span>
          </label>

          {/* Paso 1 — elegir tipo */}
          <div className="p-3 bg-white border border-border rounded-xl flex flex-col gap-3">
            <p className="text-xs text-muted">Elige el tipo:</p>
            <div className="flex flex-wrap gap-2">
              {BASE_TYPES.map(t => (
                <button key={t.base} type="button"
                  onClick={() => {
                    setSelectedBase(t.base)
                    set('emoji', t.base + '🏽') // tono medio por defecto
                  }}
                  className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl border transition-all
                    ${selectedBase === t.base
                      ? 'border-accent bg-accent-light'
                      : 'border-border hover:bg-gray-50'}`}>
                  <span className="text-2xl">{t.base}🏽</span>
                  <span className="text-xs text-muted">{t.label}</span>
                </button>
              ))}
              {/* Especiales */}
              {SPECIAL_EMOJIS.map(e => (
                <button key={e} type="button"
                  onClick={() => { setSelectedBase(null); set('emoji', e) }}
                  className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl border transition-all
                    ${form.emoji === e && !selectedBase
                      ? 'border-accent bg-accent-light'
                      : 'border-border hover:bg-gray-50'}`}>
                  <span className="text-2xl">{e}</span>
                </button>
              ))}
            </div>

            {/* Paso 2 — elegir tono (solo si hay base seleccionada) */}
            {selectedBase && (
              <div>
                <p className="text-xs text-muted mb-2">Elige el tono de piel:</p>
                <div className="flex gap-3">
                  {SKIN_TONES.map((tone, i) => {
                    const full = selectedBase + tone
                    return (
                      <button key={tone} type="button"
                        onClick={() => set('emoji', full)}
                        className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all
                          ${form.emoji === full
                            ? 'border-accent bg-accent-light'
                            : 'border-border hover:bg-gray-50'}`}>
                        <span className="text-2xl">{full}</span>
                        <span className="text-base">{TONE_LABELS[i]}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tipo */}
        <div>
          <label className="input-label">Es un</label>
          <div className="flex gap-3">
            {[{ value: 'adult', label: 'Adulto' }, { value: 'child', label: 'Niño / Adolescente' }].map(t => (
              <button key={t.value} type="button"
                onClick={() => set('member_type', t.value)}
                className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-medium transition-all
                  ${form.member_type === t.value
                    ? 'border-accent bg-accent-light text-accent'
                    : 'border-border text-muted'}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Datos físicos */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="input-label">Edad</label>
            <input type="number" placeholder="Años" min={0} max={120}
              value={form.age ?? ''} onChange={e => set('age', e.target.value ? +e.target.value : null)} />
          </div>
          <div>
            <label className="input-label">Peso (kg)</label>
            <input type="number" placeholder="kg" min={1} max={300} step={0.1}
              value={form.weight_kg ?? ''} onChange={e => set('weight_kg', e.target.value ? +e.target.value : null)} />
          </div>
          <div>
            <label className="input-label">Altura (cm)</label>
            <input type="number" placeholder="cm" min={30} max={250}
              value={form.height_cm ?? ''} onChange={e => set('height_cm', e.target.value ? +e.target.value : null)} />
          </div>
        </div>

        {/* Estilo de alimentación */}
        <div>
          <label className="input-label">Tipo de alimentación</label>
          <div className="grid grid-cols-2 gap-2">
            {EATING_STYLES.map(s => (
              <button key={s.value} type="button"
                onClick={() => set('eating_style', s.value)}
                className={`py-2 px-3 rounded-xl border-2 text-sm text-left transition-all
                  ${form.eating_style === s.value
                    ? 'border-accent bg-accent-light text-accent'
                    : 'border-border text-muted'}`}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Objetivo */}
        <div>
          <label className="input-label">Objetivo</label>
          <div className="flex flex-col gap-2">
            {GOALS.map(g => (
              <button key={g.value} type="button"
                onClick={() => set('goal', g.value)}
                className={`py-2.5 px-4 rounded-xl border-2 text-sm text-left transition-all
                  ${form.goal === g.value
                    ? 'border-accent bg-accent-light'
                    : 'border-border'}`}>
                <span className={`font-medium ${form.goal === g.value ? 'text-accent' : 'text-text'}`}>{g.label}</span>
                <span className="text-muted ml-2 text-xs">{g.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Actividad */}
        <div>
          <label className="input-label">Nivel de actividad</label>
          <div className="flex flex-col gap-2">
            {ACTIVITY.map(a => (
              <button key={a.value} type="button"
                onClick={() => set('activity_level', a.value)}
                className={`py-2.5 px-4 rounded-xl border-2 text-sm text-left transition-all
                  ${form.activity_level === a.value
                    ? 'border-accent bg-accent-light'
                    : 'border-border'}`}>
                <span className={`font-medium ${form.activity_level === a.value ? 'text-accent' : 'text-text'}`}>{a.label}</span>
                <span className="text-muted ml-2 text-xs">{a.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Gustos y favoritos */}
        <GustosConfig form={form} setForm={setForm} />

        {/* Acompañamientos */}
        <AcompConfig form={form} set={set} />

        {/* Porciones */}
        <PorcionesConfig form={form} set={set} members={members} editingId={editingMember?.id} />

        {/* Actividades semanales */}
        {editingMember?.id && (
          <ActividadesSection memberId={editingMember.id} />
        )}

        {/* Comidas del día */}
        <MealsConfig form={form} setForm={setForm} />

        {/* Calorías y macros personalizados */}
        <CustomMacros form={form} set={set} />

        {/* Condiciones médicas */}
        <div>
          <label className="input-label">Condiciones médicas
            <span className="text-xs font-normal text-error ml-1">(se respetan al pie de la letra)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {CONDITIONS.map(c => (
              <button key={c} type="button"
                onClick={() => toggleCondition(c)}
                className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all
                  ${form.conditions.includes(c)
                    ? 'border-error bg-red-50 text-error'
                    : 'border-border text-muted'}`}>
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Alergias */}
        <div>
          <label className="input-label">Alergias
            <span className="text-xs font-normal text-error ml-1">(bloqueo absoluto)</span>
          </label>
          <div className="flex gap-2 mb-2">
            <input type="text" placeholder="Ej: maní, mariscos, lactosa..."
              value={allergyInput} onChange={e => setAllergyInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag('allergies', allergyInput, () => setAllergyInput('')) }}}
            />
            <button type="button" onClick={() => addTag('allergies', allergyInput, () => setAllergyInput(''))}
              className="px-4 py-2 bg-accent-light text-accent rounded-xl text-sm font-medium whitespace-nowrap">
              + Agregar
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {form.allergies.map(a => (
              <span key={a} className="px-3 py-1 bg-red-50 border border-red-200 text-error text-xs rounded-full flex items-center gap-1">
                {a} <button type="button" onClick={() => removeTag('allergies', a)} className="font-bold">×</button>
              </span>
            ))}
          </div>
        </div>

        {/* Prohibidos */}
        <div>
          <label className="input-label">Alimentos que no come
            <span className="text-xs font-normal text-muted ml-1">(religión, dieta, elección)</span>
          </label>
          <div className="flex gap-2 mb-2">
            <input type="text" placeholder="Ej: cerdo, alcohol..."
              value={prohibitedInput} onChange={e => setProhibitedInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag('prohibited', prohibitedInput, () => setProhibitedInput('')) }}}
            />
            <button type="button" onClick={() => addTag('prohibited', prohibitedInput, () => setProhibitedInput(''))}
              className="px-4 py-2 bg-accent-light text-accent rounded-xl text-sm font-medium whitespace-nowrap">
              + Agregar
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {form.prohibited.map(p => (
              <span key={p} className="px-3 py-1 bg-accent-light border border-accent text-accent text-xs rounded-full flex items-center gap-1">
                {p} <button type="button" onClick={() => removeTag('prohibited', p)} className="font-bold">×</button>
              </span>
            ))}
          </div>
        </div>

        {/* No le gusta */}
        <div>
          <label className="input-label">No le gusta
            <span className="text-xs font-normal text-muted ml-1">(se evita si hay alternativa)</span>
          </label>
          <p className="text-xs text-muted mb-2">Sé específico: "pechuga de pollo" ≠ "pollo". "pollo frito" ≠ "pollo".</p>
          <div className="flex gap-2 mb-2">
            <input type="text" placeholder="Ej: pechuga de pollo, brócoli, hígado..."
              value={dislikeInput} onChange={e => setDislikeInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag('dislikes', dislikeInput, () => setDislikeInput('')) }}}
            />
            <button type="button" onClick={() => addTag('dislikes', dislikeInput, () => setDislikeInput(''))}
              className="px-4 py-2 bg-accent-light text-accent rounded-xl text-sm font-medium whitespace-nowrap">
              + Agregar
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {form.dislikes.map(d => (
              <span key={d} className="px-3 py-1 bg-gray-50 border border-border text-muted text-xs rounded-full flex items-center gap-1">
                {d} <button type="button" onClick={() => removeTag('dislikes', d)} className="font-bold">×</button>
              </span>
            ))}
          </div>
        </div>

        {error && <p className="text-error text-sm">{error}</p>}

        <button type="submit" className="btn-primary" disabled={loading || !form.name.trim()}>
          {loading
            ? 'Guardando...'
            : isEditing
              ? `Guardar cambios`
              : `Guardar a ${form.name || 'este miembro'}`}
        </button>
      </form>

      {memberCount > 0 && (
        <button onClick={onFinish}
          className="w-full py-3 rounded-xl border-2 border-accent text-accent font-semibold text-sm hover:bg-accent-light transition-all">
          Listo, ya están todos ({memberCount}) →
        </button>
      )}
    </div>
  )
}

// ── Comidas del día ───────────────────────────────────────────────────────────
const MEAL_PRESETS = [
  'Desayuno', 'Merienda mañana', 'Almuerzo',
  'Merienda tarde', 'Cena', 'Snack noche',
]

interface Meal { name: string; time: string }

function MealsConfig({
  form,
  setForm,
}: {
  form: { meals_per_day: Meal[] }
  setForm: React.Dispatch<React.SetStateAction<ReturnType<typeof emptyMember>>>
}) {
  const [open, setOpen]         = useState(false)
  const [customName, setCustomName] = useState('')
  const meals: Meal[]           = (form.meals_per_day as Meal[]) ?? []

  const addPreset = (name: string) => {
    if (meals.find(m => m.name === name)) return
    setForm(f => ({ ...f, meals_per_day: [...(f.meals_per_day as Meal[]), { name, time: '' }] }))
  }

  const addCustom = () => {
    const n = customName.trim()
    if (!n || meals.find(m => m.name === n)) return
    setForm(f => ({ ...f, meals_per_day: [...(f.meals_per_day as Meal[]), { name: n, time: '' }] }))
    setCustomName('')
  }

  const updateTime = (index: number, time: string) =>
    setForm(f => {
      const updated = [...(f.meals_per_day as Meal[])]
      updated[index] = { ...updated[index], time }
      return { ...f, meals_per_day: updated }
    })

  const remove = (index: number) =>
    setForm(f => ({
      ...f,
      meals_per_day: (f.meals_per_day as Meal[]).filter((_, i) => i !== index)
    }))

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50 transition-colors">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text">Comidas del día</span>
          {meals.length > 0 && (
            <span className="px-2 py-0.5 bg-accent-light text-accent text-xs rounded-full">
              {meals.length} comida{meals.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <span className="text-muted text-sm">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-2 bg-white flex flex-col gap-3">
          <p className="text-xs text-muted">
            Configura las comidas de este miembro y su horario habitual.
          </p>

          {/* Presets */}
          <div className="flex flex-wrap gap-2">
            {MEAL_PRESETS.map(p => (
              <button key={p} type="button" onClick={() => addPreset(p)}
                className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all
                  ${meals.find(m => m.name === p)
                    ? 'border-accent bg-accent-light text-accent'
                    : 'border-border text-muted hover:border-accent hover:text-accent'}`}>
                {meals.find(m => m.name === p) ? '✓ ' : '+ '}{p}
              </button>
            ))}
          </div>

          {/* Comida personalizada */}
          <div className="flex gap-2">
            <input type="text" placeholder="Otra comida personalizada..."
              value={customName} onChange={e => setCustomName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom() }}}
            />
            <button type="button" onClick={addCustom}
              className="px-3 py-2 bg-accent-light text-accent rounded-xl text-sm font-medium whitespace-nowrap">
              + Agregar
            </button>
          </div>

          {/* Lista con horarios */}
          {meals.length > 0 && (
            <div className="flex flex-col gap-2 mt-1">
              {meals.map((meal, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-sm text-text flex-1 font-medium">{meal.name}</span>
                  <input type="time" value={meal.time}
                    onChange={e => updateTime(i, e.target.value)}
                    style={{ width: '7rem', padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                  />
                  <button type="button" onClick={() => remove(i)}
                    className="text-muted hover:text-error transition-colors text-lg leading-none">
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Sección de calorías y macros personalizados ──────────────────────────────
interface MacroForm {
  calories_default:  number | null
  protein_g_default: number | null
  carbs_g_default:   number | null
  fat_g_default:     number | null
}

function CustomMacros({ form, set }: { form: MacroForm; set: (f: string, v: unknown) => void }) {
  const [open, setOpen] = useState(false)
  const hasCustom = form.calories_default || form.protein_g_default || form.carbs_g_default || form.fat_g_default

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text">Calorías y macros propios</span>
          {hasCustom && (
            <span className="px-2 py-0.5 bg-accent-light text-accent text-xs rounded-full">Configurado</span>
          )}
        </div>
        <span className="text-muted text-sm">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-2 bg-white flex flex-col gap-4">
          <p className="text-xs text-muted">
            Opcional. Si lo dejás vacío, la app calcula los valores según tu objetivo y nivel de actividad.
            Si los ponés vos, se usan estos directamente.
          </p>

          <div>
            <label className="input-label">Calorías diarias (kcal)</label>
            <input
              type="number" placeholder="Ej: 1800" min={500} max={6000}
              value={form.calories_default ?? ''}
              onChange={e => set('calories_default', e.target.value ? +e.target.value : null)}
            />
          </div>

          <div>
            <label className="input-label">Proteína (g/día)</label>
            <input
              type="number" placeholder="Ej: 140" min={0} max={500}
              value={form.protein_g_default ?? ''}
              onChange={e => set('protein_g_default', e.target.value ? +e.target.value : null)}
            />
          </div>

          <div>
            <label className="input-label">Carbohidratos (g/día)</label>
            <input
              type="number" placeholder="Ej: 200" min={0} max={800}
              value={form.carbs_g_default ?? ''}
              onChange={e => set('carbs_g_default', e.target.value ? +e.target.value : null)}
            />
          </div>

          <div>
            <label className="input-label">Grasas (g/día)</label>
            <input
              type="number" placeholder="Ej: 60" min={0} max={400}
              value={form.fat_g_default ?? ''}
              onChange={e => set('fat_g_default', e.target.value ? +e.target.value : null)}
            />
          </div>

          <p className="text-xs text-muted bg-accent-light rounded-lg px-3 py-2">
            💡 Si ponés calorías sin macros (o al revés), la app completa el resto automáticamente.
          </p>
        </div>
      )}
    </div>
  )
}

// ── Sección Porciones ─────────────────────────────────────────────────────────
interface PorcionesProps {
  form:      { is_portion_anchor: boolean; portion_multiplier: number }
  set:       (field: string, value: unknown) => void
  members:   FamilyMember[]
  editingId: string | undefined
}

function PorcionesConfig({ form, set, members, editingId }: PorcionesProps) {
  const [open, setOpen] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const currentAnchor = members.find(m => m.is_portion_anchor && m.id !== editingId)

  const handleAnchorToggle = () => {
    if (!form.is_portion_anchor && currentAnchor) {
      setShowConfirm(true)
    } else {
      const next = !form.is_portion_anchor
      set('is_portion_anchor', next)
      if (next) set('portion_multiplier', 1.0)
    }
  }

  const confirmAnchor = () => {
    set('is_portion_anchor', true)
    set('portion_multiplier', 1.0)
    setShowConfirm(false)
  }

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50 transition-colors">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text">Porciones</span>
          {form.is_portion_anchor && (
            <span className="px-2 py-0.5 bg-accent-light text-accent text-xs rounded-full">⚓ Ancla</span>
          )}
          {!form.is_portion_anchor && form.portion_multiplier !== 1.0 && (
            <span className="px-2 py-0.5 bg-accent-light text-accent text-xs rounded-full">×{form.portion_multiplier}</span>
          )}
        </div>
        <span className="text-muted text-sm">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-2 bg-white flex flex-col gap-4">
          <p className="text-xs text-muted bg-surface rounded-lg px-3 py-2">
            Una persona de la familia es la "ancla" de porciones (quien lleva la cuenta nutricional).
            Los demás comen en proporción: papá puede comer 1.5×, una niña 0.75×.
            Esto permite servir el mismo plato con porciones distintas sin pesar nada.
          </p>

          {/* Toggle anchor */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text">¿Es la persona ancla?</p>
              <p className="text-xs text-muted">Solo un miembro por familia puede serlo</p>
            </div>
            <button type="button" onClick={handleAnchorToggle}
              className={`w-12 h-6 rounded-full transition-colors relative ${form.is_portion_anchor ? 'bg-accent' : 'bg-gray-200'}`}>
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all
                ${form.is_portion_anchor ? 'left-6' : 'left-0.5'}`} />
            </button>
          </div>

          {/* Confirm dialog */}
          {showConfirm && currentAnchor && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 flex flex-col gap-2">
              <p className="text-xs text-yellow-800">
                Actualmente <strong>{currentAnchor.name}</strong> es el ancla.
                Si marcás a este miembro, {currentAnchor.name} dejará de serlo.
              </p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowConfirm(false)}
                  className="flex-1 py-1.5 text-xs border border-border rounded-lg text-muted">Cancelar</button>
                <button type="button" onClick={confirmAnchor}
                  className="flex-1 py-1.5 text-xs bg-accent text-white rounded-lg font-medium">Confirmar</button>
              </div>
            </div>
          )}

          {/* Multiplicador */}
          <div className={form.is_portion_anchor ? 'opacity-40 pointer-events-none' : ''}>
            <label className="input-label">Multiplicador de porción</label>
            <input type="number" step={0.05} min={0.25} max={3.0}
              value={form.portion_multiplier}
              onChange={e => set('portion_multiplier', parseFloat(e.target.value) || 1.0)}
              disabled={form.is_portion_anchor}
            />
            <p className="text-xs text-muted mt-1">
              Tu plato es la referencia (1.0). Ej: papá come más → 1.5 · niña come menos → 0.75
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sección Acompañamientos ───────────────────────────────────────────────────
interface AcompForm {
  side_prefs: { include_carbs: boolean; include_salad: boolean; notas: string } | null
}

function AcompConfig({ form, set }: { form: AcompForm; set: (f: string, v: unknown) => void }) {
  const [open, setOpen] = useState(false)
  const prefs = form.side_prefs ?? { include_carbs: true, include_salad: true, notas: '' }

  const update = (key: string, val: boolean | string) =>
    set('side_prefs', { ...prefs, [key]: val })

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50 transition-colors">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text">Acompañamientos en el almuerzo/cena</span>
          {(!prefs.include_carbs || !prefs.include_salad) && (
            <span className="px-2 py-0.5 bg-accent-light text-accent text-xs rounded-full">Personalizado</span>
          )}
        </div>
        <span className="text-muted text-sm">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-2 bg-white flex flex-col gap-4">
          <p className="text-xs text-muted">
            El motor usa esto para generar acompañamientos distintos por miembro. Ej: sin arroz para bajar carbos.
          </p>
          <div className="flex items-center justify-between">
            <p className="text-sm text-text">🍚 Incluir carbohidrato (arroz, papa, plátano…)</p>
            <button type="button" onClick={() => update('include_carbs', !prefs.include_carbs)}
              className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${prefs.include_carbs ? 'bg-accent' : 'bg-gray-200'}`}>
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${prefs.include_carbs ? 'left-5' : 'left-0.5'}`} />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-text">🥗 Incluir ensalada</p>
            <button type="button" onClick={() => update('include_salad', !prefs.include_salad)}
              className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${prefs.include_salad ? 'bg-accent' : 'bg-gray-200'}`}>
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${prefs.include_salad ? 'left-5' : 'left-0.5'}`} />
            </button>
          </div>
          <div>
            <label className="input-label">Notas adicionales</label>
            <input type="text" value={prefs.notas}
              onChange={e => update('notas', e.target.value)}
              placeholder="Ej: plátano asado los días de ejercicio, sin papa…" />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sección Gustos y favoritos ────────────────────────────────────────────────
interface GustosForm {
  loves:            string[]
  favorite_recipes: string[]
}

function GustosConfig({
  form,
  setForm,
}: {
  form:    GustosForm
  setForm: React.Dispatch<React.SetStateAction<ReturnType<typeof emptyMember>>>
}) {
  const [open,         setOpen]         = useState(false)
  const [lovesInput,   setLovesInput]   = useState('')
  const [recipesInput, setRecipesInput] = useState('')

  const loves           = form.loves           ?? []
  const favoriteRecipes = form.favorite_recipes ?? []
  const total           = loves.length + favoriteRecipes.length

  const addLoves = () => {
    const v = lovesInput.trim()
    if (!v || loves.includes(v)) return
    setForm(f => ({ ...f, loves: [...f.loves, v] }))
    setLovesInput('')
  }

  const removeLoves = (v: string) =>
    setForm(f => ({ ...f, loves: f.loves.filter(x => x !== v) }))

  const addRecipe = () => {
    const v = recipesInput.trim()
    if (!v || favoriteRecipes.includes(v)) return
    setForm(f => ({ ...f, favorite_recipes: [...(f.favorite_recipes ?? []), v] }))
    setRecipesInput('')
  }

  const removeRecipe = (v: string) =>
    setForm(f => ({ ...f, favorite_recipes: (f.favorite_recipes ?? []).filter(x => x !== v) }))

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50 transition-colors">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text">Gustos y favoritos</span>
          {total > 0 && (
            <span className="px-2 py-0.5 bg-accent-light text-accent text-xs rounded-full">{total}</span>
          )}
        </div>
        <span className="text-muted text-sm">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-2 bg-white flex flex-col gap-5">

          {/* Alimentos que le encantan */}
          <div>
            <label className="input-label">❤️ Alimentos o ingredientes favoritos</label>
            <p className="text-xs text-muted mb-2">
              El motor prioriza recetas que los usen. Ej: aguacate, mango, chocolate, queso…
            </p>
            <div className="flex gap-2 mb-2">
              <input type="text"
                placeholder="Ej: aguacate, coco, pollo asado…"
                value={lovesInput}
                onChange={e => setLovesInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addLoves() } }}
              />
              <button type="button" onClick={addLoves}
                className="px-4 py-2 bg-accent-light text-accent rounded-xl text-sm font-medium whitespace-nowrap">
                + Agregar
              </button>
            </div>
            {loves.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {loves.map(v => (
                  <span key={v}
                    className="px-3 py-1 bg-red-50 border border-red-200 text-red-600 text-xs rounded-full flex items-center gap-1">
                    ❤️ {v}
                    <button type="button" onClick={() => removeLoves(v)} className="font-bold ml-0.5">×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Recetas o platos favoritos */}
          <div>
            <label className="input-label">⭐ Platos o recetas favoritas</label>
            <p className="text-xs text-muted mb-2">
              Si el motor encuentra una receta con ese nombre, la pone primero. Ej: arroz con coco, ajiaco, bandeja paisa…
            </p>
            <div className="flex gap-2 mb-2">
              <input type="text"
                placeholder="Ej: arroz con coco, sopa de lentejas…"
                value={recipesInput}
                onChange={e => setRecipesInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addRecipe() } }}
              />
              <button type="button" onClick={addRecipe}
                className="px-4 py-2 bg-accent-light text-accent rounded-xl text-sm font-medium whitespace-nowrap">
                + Agregar
              </button>
            </div>
            {favoriteRecipes.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {favoriteRecipes.map(v => (
                  <span key={v}
                    className="px-3 py-1 bg-yellow-50 border border-yellow-200 text-yellow-700 text-xs rounded-full flex items-center gap-1">
                    ⭐ {v}
                    <button type="button" onClick={() => removeRecipe(v)} className="font-bold ml-0.5">×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  )
}

// ── Sección Actividades (solo en modo edición) ────────────────────────────────
function ActividadesSection({ memberId }: { memberId: string }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50 transition-colors">
        <span className="text-sm font-medium text-text">Actividades semanales</span>
        <span className="text-muted text-sm">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-2 bg-white">
          <ActividadesList memberId={memberId} />
        </div>
      )}
    </div>
  )
}
