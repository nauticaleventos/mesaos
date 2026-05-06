import { useState } from 'react'
import { useFamilyStore } from '../../store/familyStore'
import type { FamilyMember } from '../../lib/types'

const EMOJIS = ['👤','👨','👩','👦','👧','👴','👵','🧑','👶','🧒']

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
  familyName: string
  memberCount: number
  onAdded: () => void
  onFinish: () => void
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
  loves: [], restrictions_prep: [], meals_per_day: [],
  linked_user_id: null,
})

export default function StepAddMember({ familyName, memberCount, onAdded, onFinish }: Props) {
  const [form, setForm]       = useState(emptyMember())
  const [allergyInput, setAllergyInput]   = useState('')
  const [prohibitedInput, setProhibitedInput] = useState('')
  const [dislikeInput, setDislikeInput]   = useState('')
  const [error, setError]     = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const addMember             = useFamilyStore(s => s.addMember)

  const set = (field: string, value: unknown) =>
    setForm(f => ({ ...f, [field]: value }))

  const toggleCondition = (c: string) =>
    set('conditions', form.conditions.includes(c)
      ? form.conditions.filter((x: string) => x !== c)
      : [...form.conditions, c])

  const addTag = (field: 'allergies' | 'prohibited' | 'dislikes', val: string, clear: () => void) => {
    const trimmed = val.trim()
    if (!trimmed) return
    set(field, [...form[field], trimmed])
    clear()
  }

  const removeTag = (field: 'allergies' | 'prohibited' | 'dislikes', val: string) =>
    set(field, form[field].filter((x: string) => x !== val))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return setError('El nombre es obligatorio.')
    setError(null)
    setLoading(true)
    const err = await addMember(form as FamilyMember)
    setLoading(false)
    if (err) return setError(err)
    setForm(emptyMember())
    onAdded()
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-serif text-text font-semibold">
          {memberCount === 0 ? `¿Quién come en ${familyName}?` : 'Agregar otro miembro'}
        </h1>
        <p className="text-muted text-sm mt-1">
          {memberCount > 0 && `Ya tienes ${memberCount} miembro${memberCount > 1 ? 's' : ''}. `}
          Agrega a cada persona por separado.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">

        {/* Nombre y emoji */}
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="input-label">Nombre</label>
            <input
              type="text" placeholder="Ej: Abel, Sarah..."
              value={form.name} onChange={e => set('name', e.target.value)}
              required autoFocus
            />
          </div>
          <div>
            <label className="input-label">Emoji</label>
            <select
              value={form.emoji ?? '👤'}
              onChange={e => set('emoji', e.target.value)}
              style={{ width: '4.5rem', textAlign: 'center', fontSize: '1.4rem', padding: '0.6rem' }}
            >
              {EMOJIS.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
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
            <input type="text" placeholder="Ej: maní, mariscos..."
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
            <span className="text-xs font-normal text-muted ml-1">(se evita pero no es crítico)</span>
          </label>
          <div className="flex gap-2 mb-2">
            <input type="text" placeholder="Ej: brócoli, hígado..."
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
          {loading ? 'Guardando...' : `Guardar a ${form.name || 'este miembro'}`}
        </button>
      </form>

      {memberCount > 0 && (
        <button onClick={onFinish} className="btn-ghost">
          Listo, ya están todos ({memberCount}) →
        </button>
      )}
    </div>
  )
}
