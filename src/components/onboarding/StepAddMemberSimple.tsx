import { useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { useFamilyStore } from '../../store/familyStore'
import { calcularMacros, type TipoMiembro, type ObjetivoSimple } from '../../lib/calcularMacros'
import type { FamilyMember } from '../../lib/types'
import StepAddMember from './StepAddMember'

// ── Datos básicos del nuevo miembro ──────────────────────────────────────────

interface MemberDraft {
  nombre:            string
  tipo:              TipoMiembro
  objetivo:          ObjetivoSimple
  peso_kg:           string
  altura_cm:         string
  edad:              string
  restricciones:     Set<string>
  otra_restriccion:  string
}

const emptyDraft = (): MemberDraft => ({
  nombre: '', tipo: 'adult', objetivo: 'mantenimiento',
  peso_kg: '', altura_cm: '', edad: '',
  restricciones: new Set(), otra_restriccion: '',
})

// ── Opciones de alergias ──────────────────────────────────────────────────────

const ALERGIAS = [
  { id: 'sin_gluten',       label: 'Sin gluten' },
  { id: 'sin_lacteos',      label: 'Sin lactosa' },
  { id: 'vegetariano',      label: 'Vegetariano' },
  { id: 'vegano',           label: 'Vegano' },
  { id: 'alergia_huevo',    label: 'Alergia a huevo' },
  { id: 'alergia_mani',     label: 'Alergia a maní' },
  { id: 'alergia_nuts',     label: 'Alergia a frutos secos' },
  { id: 'alergia_mariscos', label: 'Alergia a mariscos' },
  { id: 'diabetes',         label: 'Diabetes' },
  { id: 'hipertension',     label: 'Hipertensión' },
]

// ── Mapeos draft → FamilyMember ───────────────────────────────────────────────

function tipoToMemberType(tipo: TipoMiembro): FamilyMember['member_type'] {
  if (tipo === 'child') return 'child'
  if (tipo === 'teen')  return 'teen'
  return 'adult'
}

function tipoToEmoji(tipo: TipoMiembro): string {
  if (tipo === 'child')    return '👧🏼'
  if (tipo === 'teen')     return '👱‍♀️'
  if (tipo === 'pregnant') return '🤰'
  return '👤'
}

function restriccionesToFields(restricciones: Set<string>, otra: string) {
  const allergies: string[] = []
  const condiciones: string[] = []
  let eating_style: string = 'omnivore'

  for (const r of restricciones) {
    if (r === 'vegano')          eating_style = 'vegan'
    else if (r === 'vegetariano' && eating_style !== 'vegan') eating_style = 'vegetarian'
    else if (r === 'alergia_huevo')    allergies.push('huevo')
    else if (r === 'alergia_mani')     allergies.push('maní')
    else if (r === 'alergia_nuts')     allergies.push('frutos secos')
    else if (r === 'alergia_mariscos') allergies.push('mariscos')
    else if (r === 'diabetes')    condiciones.push('diabetes')
    else if (r === 'hipertension')condiciones.push('hipertension')
  }

  if (otra.trim()) allergies.push(otra.trim())

  return { eating_style, allergies, condiciones_salud: condiciones }
}

// ── Props del componente ──────────────────────────────────────────────────────

interface Props {
  familyName:  string
  memberCount: number
  onAdded:     () => void
  onFinish:    () => void
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function StepAddMemberSimple({ familyName: _fam, memberCount: _mc, onAdded, onFinish }: Props) {
  const { addMember, members } = useFamilyStore()

  const [paso,     setPaso]    = useState(1)
  const [draft,    setDraft]   = useState<MemberDraft>(emptyDraft)
  const [saving,   setSaving]  = useState(false)
  const [savedId,  setSavedId] = useState<string | null>(null)
  const [showFull, setShowFull]= useState(false)
  const [animKey,  setAnimKey] = useState(0)

  const savedMember = members.find(m => m.id === savedId)

  const ir = (n: number) => { setAnimKey(k => k + 1); setPaso(n) }
  const avanzar = () => ir(paso + 1)
  const volver  = () => { if (paso > 1) ir(paso - 1) }

  const toggleRestriccion = (id: string) => {
    setDraft(d => {
      const r = new Set(d.restricciones)
      r.has(id) ? r.delete(id) : r.add(id)
      return { ...d, restricciones: r }
    })
  }

  const seleccionarNinguna = () =>
    setDraft(d => ({ ...d, restricciones: new Set(), otra_restriccion: '' }))

  // ── GUARDAR ─────────────────────────────────────────────────────────────────

  const guardar = async () => {
    if (saving) return
    setSaving(true)

    const { eating_style, allergies, condiciones_salud } = restriccionesToFields(draft.restricciones, draft.otra_restriccion)

    const macros = calcularMacros({
      tipo:      draft.tipo,
      objetivo:  draft.objetivo,
      peso_kg:   parseFloat(draft.peso_kg)   || null,
      altura_cm: parseFloat(draft.altura_cm) || null,
      edad:      parseInt(draft.edad)        || null,
    })

    const member: Omit<FamilyMember, 'id' | 'family_id' | 'created_at' | 'updated_at'> = {
      name:              draft.nombre.trim(),
      emoji:             tipoToEmoji(draft.tipo),
      color:             null,
      member_type:       tipoToMemberType(draft.tipo),
      age:               parseInt(draft.edad) || null,
      weight_kg:         parseFloat(draft.peso_kg) || null,
      height_cm:         parseFloat(draft.altura_cm) || null,
      is_portion_anchor: false,
      portion_multiplier:1.0,
      goal:              draft.objetivo,
      goal_target_weight_kg: null,
      goal_target_date:  null,
      activity_level:    'moderate',
      calories_default:  macros.calorias,
      calories_per_day:  {},
      protein_g_default: macros.proteinas_g,
      carbs_g_default:   macros.carbs_g,
      fat_g_default:     macros.grasa_g,
      eating_style,
      conditions:        [],
      condiciones_salud,
      allergies,
      prohibited:        [],
      dislikes:          [],
      loves:             [],
      favorite_recipes:  [],
      restrictions_prep: [],
      meals_per_day:     [],
      proteinas_animales_que_si_come:  ['pollo','res','cerdo','pescado','mariscos','huevos'],
      proteinas_vegetales_que_si_come: ['frijoles','lentejas','garbanzos','tofu','soya'],
      gustos_notas:      null,
      plantilla_comida:  'clasico_colombiano' as const,
      guarniciones_por_comida: 2,
      quiere_ensalada:   true,
      quiere_salsa:      false,
      linked_user_id:    null,
      side_prefs:        { include_carbs: true, include_salad: true, notas: '' },
    }

    const id = await addMember(member)
    setSavedId(id)
    setSaving(false)
    ir(7)
  }

  // ── FORMULARIO COMPLETO ──────────────────────────────────────────────────────

  if (showFull && savedMember) {
    return (
      <StepAddMember
        familyName=""
        memberCount={members.length}
        onAdded={() => { setShowFull(false); onAdded() }}
        onFinish={() => { setShowFull(false); onFinish() }}
        editingMember={savedMember}
        onUpdated={() => setShowFull(false)}
      />
    )
  }

  // ── MACROS CALCULADOS (para step 7) ─────────────────────────────────────────

  const macros = calcularMacros({
    tipo:      draft.tipo,
    objetivo:  draft.objetivo,
    peso_kg:   parseFloat(draft.peso_kg)   || null,
    altura_cm: parseFloat(draft.altura_cm) || null,
    edad:      parseInt(draft.edad)        || null,
  })

  const TOTAL_PASOS = 6  // 7 incl. confirmación, pero la 7 se muestra tras guardar

  return (
    <div className="flex flex-col gap-0 min-h-[80vh]">

      {/* Progreso */}
      {paso <= 6 && (
        <div className="flex items-center gap-3 mb-6">
          {paso > 1 && (
            <button onClick={volver} className="p-1.5 -ml-1.5 text-muted hover:text-text transition-colors">
              <ChevronLeft size={22} />
            </button>
          )}
          <div className="flex-1 flex gap-1">
            {Array.from({ length: TOTAL_PASOS }, (_, i) => (
              <div key={i} className="flex-1 h-1 rounded-full transition-all duration-300"
                   style={{ background: i < paso ? '#E76F51' : '#E5E7EB' }} />
            ))}
          </div>
          <span className="text-xs text-muted font-medium tabular-nums">{paso} de {TOTAL_PASOS}</span>
        </div>
      )}

      {/* Pantallas — key para re-montar y animar */}
      <div key={animKey} className="flex flex-col gap-6 flex-1 animate-[fadeIn_0.2s_ease]">

        {/* ── PASO 1: Nombre ──────────────────────────────────────────────── */}
        {paso === 1 && (
          <>
            <div>
              <h2 className="text-2xl font-semibold text-text mb-1">¿Cómo se llama?</h2>
              <p className="text-sm text-muted">El miembro que vas a agregar</p>
            </div>
            <input
              type="text"
              placeholder="Nombre"
              value={draft.nombre}
              onChange={e => setDraft(d => ({ ...d, nombre: e.target.value }))}
              className="text-lg"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && draft.nombre.trim() && avanzar()}
            />
            <div className="mt-auto pt-4">
              <button onClick={avanzar} disabled={!draft.nombre.trim()}
                className={`btn-primary w-full py-4 text-base ${!draft.nombre.trim() ? 'opacity-40 cursor-not-allowed' : ''}`}>
                Continuar →
              </button>
            </div>
          </>
        )}

        {/* ── PASO 2: Tipo ────────────────────────────────────────────────── */}
        {paso === 2 && (
          <>
            <div>
              <h2 className="text-2xl font-semibold text-text mb-1">¿Qué es {draft.nombre}?</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {([
                { value: 'adult',    label: 'Adulto',       emoji: '🧑', desc: '18+ años' },
                { value: 'teen',     label: 'Adolescente',  emoji: '👱', desc: '13-17 años' },
                { value: 'child',    label: 'Niño/Niña',    emoji: '👧🏼', desc: '0-12 años' },
                { value: 'pregnant', label: 'Embarazada',   emoji: '🤰', desc: 'Necesidades especiales' },
              ] as const).map(op => (
                <button key={op.value}
                  onClick={() => { setDraft(d => ({ ...d, tipo: op.value, objetivo: op.value === 'child' || op.value === 'teen' ? 'crecimiento' : d.objetivo })); avanzar() }}
                  className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all text-center
                    ${draft.tipo === op.value ? 'border-accent bg-accent/5' : 'border-border hover:border-accent/40'}`}>
                  <span className="text-3xl">{op.emoji}</span>
                  <span className="font-semibold text-sm text-text">{op.label}</span>
                  <span className="text-xs text-muted">{op.desc}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* ── PASO 3: Objetivo ────────────────────────────────────────────── */}
        {paso === 3 && (
          <>
            <div>
              <h2 className="text-2xl font-semibold text-text mb-1">¿Cuál es el objetivo?</h2>
            </div>
            <div className="flex flex-col gap-3">
              {([
                { value: 'deficit',       label: 'Bajar peso',    emoji: '📉', show: true },
                { value: 'mantenimiento', label: 'Mantener',       emoji: '⚖️', show: true },
                { value: 'volumen',       label: 'Ganar músculo',  emoji: '💪', show: draft.tipo === 'adult' || draft.tipo === 'teen' },
                { value: 'crecimiento',   label: 'Crecer',         emoji: '🌱', show: draft.tipo === 'child' || draft.tipo === 'teen' },
              ] as const).filter(o => o.show).map(op => (
                <button key={op.value}
                  onClick={() => { setDraft(d => ({ ...d, objetivo: op.value })); avanzar() }}
                  className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left
                    ${draft.objetivo === op.value ? 'border-accent bg-accent/5' : 'border-border hover:border-accent/40'}`}>
                  <span className="text-2xl">{op.emoji}</span>
                  <span className="font-semibold text-text">{op.label}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* ── PASO 4: Peso y altura ───────────────────────────────────────── */}
        {paso === 4 && (
          <>
            <div>
              <h2 className="text-2xl font-semibold text-text mb-1">Peso y altura</h2>
              <p className="text-sm text-muted">Para calcular las porciones correctas</p>
            </div>
            <div className="flex flex-col gap-4">
              <div>
                <label className="input-label">Peso (kg)</label>
                <input
                  type="number"
                  placeholder="70"
                  value={draft.peso_kg}
                  onChange={e => setDraft(d => ({ ...d, peso_kg: e.target.value }))}
                  className="text-lg"
                  inputMode="decimal"
                  autoFocus
                />
              </div>
              <div>
                <label className="input-label">Altura (cm)</label>
                <input
                  type="number"
                  placeholder="168"
                  value={draft.altura_cm}
                  onChange={e => setDraft(d => ({ ...d, altura_cm: e.target.value }))}
                  className="text-lg"
                  inputMode="decimal"
                />
              </div>
              <p className="text-xs text-muted">Podés dejarlo vacío y usaremos promedios según el tipo</p>
            </div>
            <div className="mt-auto pt-4">
              <button onClick={avanzar} className="btn-primary w-full py-4 text-base">
                Continuar →
              </button>
            </div>
          </>
        )}

        {/* ── PASO 5: Edad ────────────────────────────────────────────────── */}
        {paso === 5 && (
          <>
            <div>
              <h2 className="text-2xl font-semibold text-text mb-1">¿Cuántos años tiene {draft.nombre}?</h2>
            </div>
            <input
              type="number"
              placeholder="35"
              value={draft.edad}
              onChange={e => setDraft(d => ({ ...d, edad: e.target.value }))}
              className="text-lg"
              inputMode="numeric"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && avanzar()}
            />
            <div className="mt-auto pt-4">
              <button onClick={avanzar} className="btn-primary w-full py-4 text-base">
                Continuar →
              </button>
            </div>
          </>
        )}

        {/* ── PASO 6: Alergias ────────────────────────────────────────────── */}
        {paso === 6 && (
          <>
            <div>
              <h2 className="text-2xl font-semibold text-text mb-1">Alergias y restricciones</h2>
              <p className="text-sm text-muted">Seleccioná todo lo que aplique</p>
            </div>
            <div className="flex flex-col gap-2">
              {ALERGIAS.map(a => (
                <button key={a.id}
                  onClick={() => toggleRestriccion(a.id)}
                  className={`flex items-center gap-3 py-3 px-4 rounded-xl border-2 text-left transition-all
                    ${draft.restricciones.has(a.id) ? 'border-accent bg-accent/5' : 'border-border hover:border-accent/30'}`}>
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all
                    ${draft.restricciones.has(a.id) ? 'bg-accent border-accent' : 'border-border'}`}>
                    {draft.restricciones.has(a.id) && <span className="text-white text-xs">✓</span>}
                  </div>
                  <span className="text-sm font-medium text-text">{a.label}</span>
                </button>
              ))}

              {/* Otra */}
              <input
                type="text"
                placeholder="Otra restricción..."
                value={draft.otra_restriccion}
                onChange={e => setDraft(d => ({ ...d, otra_restriccion: e.target.value }))}
                className="mt-1"
              />

              {/* Ninguna */}
              <button
                onClick={seleccionarNinguna}
                className={`flex items-center gap-3 py-3 px-4 rounded-xl border-2 text-left transition-all mt-1
                  ${draft.restricciones.size === 0 && !draft.otra_restriccion ? 'border-oliva bg-oliva/5' : 'border-border hover:border-oliva/40'}`}>
                <span className="text-sm font-medium text-muted">Ninguna</span>
              </button>
            </div>

            <div className="pt-2">
              <button onClick={guardar} disabled={saving}
                className={`btn-primary w-full py-4 text-base ${saving ? 'opacity-60' : ''}`}>
                {saving ? 'Guardando...' : 'Continuar →'}
              </button>
            </div>
          </>
        )}

        {/* ── PASO 7: Confirmación ────────────────────────────────────────── */}
        {paso === 7 && (
          <>
            <div className="text-center pt-2">
              <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center text-4xl mb-4"
                   style={{ background: '#FFF3E0' }}>
                {tipoToEmoji(draft.tipo)}
              </div>
              <h2 className="text-xl font-semibold text-text">
                ¡Listo, ya conozco a {draft.nombre}!
              </h2>
              <p className="text-sm text-muted mt-2">
                Calculé sus necesidades. Podés ajustar más detalles en su perfil cuando quieras.
              </p>
            </div>

            {/* Resumen de macros */}
            <div className="card flex flex-col gap-3">
              <p className="text-xs font-semibold text-muted uppercase tracking-wider">Estimación diaria</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-3 rounded-xl bg-orange-50">
                  <p className="text-2xl font-bold text-accent">{macros.calorias}</p>
                  <p className="text-xs text-muted mt-0.5">kcal/día</p>
                </div>
                <div className="text-center p-3 rounded-xl bg-blue-50">
                  <p className="text-2xl font-bold text-blue-600">{macros.proteinas_g}g</p>
                  <p className="text-xs text-muted mt-0.5">Proteínas</p>
                </div>
                <div className="text-center p-3 rounded-xl bg-yellow-50">
                  <p className="text-2xl font-bold text-yellow-600">{macros.carbs_g}g</p>
                  <p className="text-xs text-muted mt-0.5">Carbohidratos</p>
                </div>
                <div className="text-center p-3 rounded-xl bg-green-50">
                  <p className="text-2xl font-bold text-green-600">{macros.grasa_g}g</p>
                  <p className="text-xs text-muted mt-0.5">Grasas</p>
                </div>
              </div>

              {draft.restricciones.size > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {[...draft.restricciones].map(r => {
                    const a = ALERGIAS.find(x => x.id === r)
                    return a ? (
                      <span key={r} className="px-2 py-0.5 rounded-full bg-accent/10 text-accent text-xs font-medium">
                        {a.label}
                      </span>
                    ) : null
                  })}
                </div>
              )}
            </div>

            {/* Acciones */}
            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  setDraft(emptyDraft())
                  ir(1)
                  onAdded()
                }}
                className="btn-primary w-full py-4 text-base">
                Agregar otro miembro
              </button>
              <button onClick={onFinish} className="btn-ghost w-full py-4 text-base">
                Terminar onboarding →
              </button>
              {savedMember && (
                <button
                  onClick={() => setShowFull(true)}
                  className="text-center text-xs text-accent hover:opacity-70 transition-opacity py-1">
                  Editar más detalles de {draft.nombre}
                </button>
              )}
            </div>
          </>
        )}

      </div>
    </div>
  )
}
