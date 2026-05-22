import { useState } from 'react'
import { Plus, Trash2, ChevronUp, ChevronDown, Search } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { useFamilyStore } from '../../../store/familyStore'
import { buscarFotoUnsplash } from '../../../lib/unsplash'
import type { RecipeImport, IngredienteImport } from '../../../lib/claudeImport'

interface Props {
  receta:    RecipeImport
  familyId:  string
  recipeId?: string        // si se pasa → modo edición (UPDATE)
  onSaved:   () => void
  onBack:    () => void
}

const TIPO_OPCIONES   = ['desayuno','almuerzo','cena','snack','postre','bebida','brunch']
const DIFICULTAD_OPTS = [{ v:'facil', l:'Fácil' },{ v:'media', l:'Media' },{ v:'dificil', l:'Difícil' }] as const
const COSTO_OPTS      = [{ v:'bajo', l:'Bajo' },{ v:'medio', l:'Medio' },{ v:'alto', l:'Alto' }] as const
const CAT_OPTS        = ['proteina_animal','embutido','lacteo','vegetal','fruta','grano','legumbre','condimento','bebida','snack','otro']
const UNIDAD_OPTS     = ['g','kg','ml','l','unidades','lata','paquete','porcion','cucharada','cucharadita','taza']

const PERFILES_LABELS: { key: keyof NonNullable<RecipeImport['perfiles']>; label: string }[] = [
  { key: 'ninos',           label: '👦 Niños'          },
  { key: 'vegetariana',     label: '🥗 Vegetariana'    },
  { key: 'deficit_calorico',label: '⚖️ Déficit cal.'   },
  { key: 'embarazadas',     label: '🤰 Embarazadas'    },
  { key: 'adultos_mayores', label: '👴 Adultos mayores' },
  { key: 'keto',            label: '🥑 Keto'           },
]

const FILTROS_LABELS: { key: keyof NonNullable<RecipeImport['filtros_nutricionales']>; label: string }[] = [
  { key: 'bajo_sodio',         label: 'Bajo sodio'         },
  { key: 'bajo_azucar',        label: 'Bajo azúcar'        },
  { key: 'alto_proteina',      label: 'Alto proteína'      },
  { key: 'bajo_carbohidratos', label: 'Bajo carbs'         },
  { key: 'alta_fibra',         label: 'Alta fibra'         },
  { key: 'sin_gluten',         label: 'Sin gluten'         },
  { key: 'sin_lacteos',        label: 'Sin lácteos'        },
  { key: 'bajo_grasa',         label: 'Bajo grasa'         },
  { key: 'bajo_potasio',       label: 'Bajo potasio'       },
  { key: 'bajo_purinas',       label: 'Bajo purinas'       },
]

export default function ConfirmacionReceta({ receta: recetaInit, familyId, recipeId, onSaved, onBack }: Props) {
  const { members } = useFamilyStore()

  // ── State del formulario ────────────────────────────────────────────────────
  const [form, setForm] = useState<RecipeImport>({ ...recetaInit })
  const [ingredientes, setIngredientes] = useState<IngredienteImport[]>(
    recetaInit.ingredientes.length > 0 ? recetaInit.ingredientes : [newIngrediente()]
  )
  const [pasos, setPasos]               = useState<string[]>(
    recetaInit.pasos.length > 0 ? recetaInit.pasos : ['']
  )
  const [tags, setTags]                 = useState<string[]>(recetaInit.tags ?? [])
  const [tagInput, setTagInput]         = useState('')
  const [miembrosAsignados, setMiembrosAsignados] = useState<Set<string>>(new Set(members.map(m => m.id!)))
  const [visibility, setVisibility]     = useState<'private'|'public'>(recetaInit.source_platform === 'manual' ? 'private' : 'public')
  const [activoMenu, setActivoMenu]     = useState(true)
  const [imgUrl, setImgUrl]             = useState(recetaInit.imagen_url ?? '')
  const [imgCredito, setImgCredito]     = useState(recetaInit.imagen_credito ?? null)
  const [buscandoFoto, setBuscandoFoto] = useState(false)
  const [saving, setSaving]             = useState(false)
  const [error, setError]               = useState<string | null>(null)

  // Warning de alergias por miembro
  const alertasMiembro = (memberId: string): string[] => {
    const m = members.find(mb => mb.id === memberId)
    if (!m) return []
    const alerts: string[] = []
    const nomIngredientes = ingredientes.map(i => i.nombre.toLowerCase())
    for (const alergia of (m.allergies ?? [])) {
      if (nomIngredientes.some(n => n.includes(alergia.toLowerCase()))) {
        alerts.push(alergia)
      }
    }
    return alerts
  }

  // ── Búsqueda de foto Unsplash ────────────────────────────────────────────────
  const buscarFoto = async () => {
    setBuscandoFoto(true)
    const foto = await buscarFotoUnsplash(form.nombre)
    if (foto) {
      setImgUrl(foto.url)
      setImgCredito({ fotografo: foto.fotografo, perfil_url: foto.perfil })
    }
    setBuscandoFoto(false)
  }

  // ── Helpers de ingredientes ─────────────────────────────────────────────────
  function newIngrediente(): IngredienteImport {
    return { nombre: '', categoria: 'otro', cantidad: null, unidad: null, esencial: true }
  }
  const updateIngrediente = (idx: number, patch: Partial<IngredienteImport>) =>
    setIngredientes(prev => prev.map((it, i) => i === idx ? { ...it, ...patch } : it))
  const removeIngrediente = (idx: number) =>
    setIngredientes(prev => prev.filter((_, i) => i !== idx))
  const moveIngrediente = (idx: number, dir: -1 | 1) => {
    const arr = [...ingredientes]
    const to  = idx + dir
    if (to < 0 || to >= arr.length) return
    ;[arr[idx], arr[to]] = [arr[to], arr[idx]]
    setIngredientes(arr)
  }

  // ── Helpers de pasos ────────────────────────────────────────────────────────
  const updatePaso = (idx: number, val: string) =>
    setPasos(prev => prev.map((p, i) => i === idx ? val : p))
  const removePaso = (idx: number) =>
    setPasos(prev => prev.filter((_, i) => i !== idx))
  const movePaso = (idx: number, dir: -1 | 1) => {
    const arr = [...pasos]
    const to  = idx + dir
    if (to < 0 || to >= arr.length) return
    ;[arr[idx], arr[to]] = [arr[to], arr[idx]]
    setPasos(arr)
  }

  // ── Guardar ─────────────────────────────────────────────────────────────────
  const guardar = async () => {
    if (!form.nombre.trim()) { setError('El nombre es obligatorio'); return }
    if (ingredientes.filter(i => i.nombre.trim()).length === 0) { setError('Agregar al menos un ingrediente'); return }
    if (pasos.filter(p => p.trim()).length === 0) { setError('Agregar al menos un paso'); return }

    setError(null); setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()

    const recipeData = {
      family_id:             familyId,
      nombre:                form.nombre.trim(),
      descripcion_corta:     form.descripcion_corta?.trim() ?? null,
      origen:                form.origen?.trim() ?? null,
      tipo_comida:           form.tipo_comida,
      ocasion:               form.ocasion ?? [],
      tiempo_total_min:      (form.tiempo_preparacion_min ?? 0) + (form.tiempo_coccion_min ?? 0) || null,
      tiempo_preparacion_min:form.tiempo_preparacion_min,
      tiempo_coccion_min:    form.tiempo_coccion_min,
      dificultad:            form.dificultad,
      porciones:             form.porciones,
      costo_estimado:        form.costo_estimado,
      ingredientes:          ingredientes.filter(i => i.nombre.trim()),
      pasos:                 pasos.filter(p => p.trim()),
      tags,
      info_nutricional_aprox: form.info_nutricional_aprox,
      perfiles:              form.perfiles ?? {},
      filtros_nutricionales: form.filtros_nutricionales ?? {},
      imagen_url:            imgUrl.trim() || null,
      imagen_credito:        imgCredito,
      is_base_recipe:        false,
      rating_promedio:       null,
      // Campos Oleada 1
      visibility,
      created_by_user_id:    user?.id ?? null,
      created_in_family_id:  familyId,
      source_platform:       form.source_platform ?? null,
      source_url:            form.source_url ?? null,
      tipo_componente:       (form as RecipeImport & { tipo_componente?: string }).tipo_componente ?? null,
      is_active_for_menu:    activoMenu,
    }

    let savedId: string | null = null

    if (recipeId) {
      // Modo edición — UPDATE
      const { error: dbErr } = await supabase
        .from('recipes')
        .update(recipeData)
        .eq('id', recipeId)
      if (dbErr) { setError(dbErr.message); setSaving(false); return }
      savedId = recipeId
    } else {
      // Modo creación — INSERT
      const { data: inserted, error: dbErr } = await supabase
        .from('recipes')
        .insert(recipeData)
        .select('id')
        .single()
      if (dbErr || !inserted) { setError(dbErr?.message ?? 'Error al guardar'); setSaving(false); return }
      savedId = inserted.id
    }

    const saved = { id: savedId }

    // Asignar a miembros seleccionados → recipe_suggestions
    if (miembrosAsignados.size > 0 && user) {
      const suggestions = [...miembrosAsignados].map(memberId => ({
        recipe_id:           saved.id,
        member_id:           memberId,
        suggested_by_user_id: user.id,
        status:              'pending',
      }))
      await supabase.from('recipe_suggestions').insert(suggestions)
    }

    setSaving(false)
    onSaved()
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  const nut = form.info_nutricional_aprox

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden" style={{ background: '#FBF5E5' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-6 pb-4 border-b border-border bg-white flex-shrink-0">
        <button onClick={onBack} className="text-muted hover:text-text text-sm flex items-center gap-1">
          ← Volver
        </button>
        <p className="font-semibold text-text">{recipeId ? 'Editar receta' : 'Revisar receta'}</p>
        {form.confidence === 'low' && (
          <span className="text-xs text-advertencia font-medium">⚠️ Revisá</span>
        )}
        {form.confidence !== 'low' && <div className="w-12" />}
      </div>

      {/* Aviso baja confianza */}
      {form.confidence === 'low' && (
        <div className="px-4 py-2 bg-advertencia/15 border-b border-advertencia/30">
          <p className="text-xs text-advertencia font-medium">No pudimos extraer todo — revisá los campos en rojo o vacíos</p>
        </div>
      )}

      {/* Cuerpo scrollable */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto px-4 py-5 flex flex-col gap-6 pb-32">

          {/* ── S1: Básicos ── */}
          <Seccion titulo="📋 Información básica">
            {/* Foto */}
            <div>
              <label className="input-label">Foto</label>
              {imgUrl ? (
                <div className="relative rounded-2xl overflow-hidden h-44">
                  <img src={imgUrl} alt="" className="w-full h-full object-cover" />
                  {imgCredito && (
                    <a href={imgCredito.perfil_url} target="_blank" rel="noopener noreferrer"
                      className="absolute bottom-2 left-2 text-white/70 text-[9px] bg-black/40 px-1.5 py-0.5 rounded">
                      📷 {imgCredito.fotografo}
                    </a>
                  )}
                  <button onClick={() => { setImgUrl(''); setImgCredito(null) }}
                    className="absolute top-2 right-2 w-7 h-7 bg-black/60 text-white rounded-full text-sm flex items-center justify-center">×</button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input type="url" value={imgUrl} onChange={e => setImgUrl(e.target.value)}
                    placeholder="https://..." className="flex-1" />
                  <button onClick={buscarFoto} disabled={buscandoFoto || !form.nombre}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-accent text-accent text-sm font-medium whitespace-nowrap hover:bg-accent/5 transition-colors disabled:opacity-40">
                    {buscandoFoto ? '…' : <><Search size={14} /> Unsplash</>}
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="input-label">Nombre de la receta *</label>
              <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Sancocho de pollo" />
            </div>

            <div>
              <label className="input-label">Descripción corta <span className="font-normal text-muted">({(form.descripcion_corta ?? '').length}/80)</span></label>
              <input value={form.descripcion_corta ?? ''} maxLength={80}
                onChange={e => setForm(f => ({ ...f, descripcion_corta: e.target.value }))}
                placeholder="Plato reconfortante perfecto para la familia…" />
            </div>

            <div>
              <label className="input-label">Tipo de comida</label>
              <div className="flex flex-wrap gap-2">
                {TIPO_OPCIONES.map(t => (
                  <button key={t} type="button"
                    onClick={() => setForm(f => ({
                      ...f,
                      tipo_comida: f.tipo_comida.includes(t)
                        ? f.tipo_comida.filter(x => x !== t)
                        : [...f.tipo_comida, t]
                    }))}
                    className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all capitalize
                      ${form.tipo_comida.includes(t) ? 'border-accent bg-accent text-white' : 'border-border text-muted'}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="input-label">Origen / cocina</label>
              <input value={form.origen ?? ''} onChange={e => setForm(f => ({ ...f, origen: e.target.value }))} placeholder="colombiana, italiana, mexicana…" />
            </div>

            <div>
              <label className="input-label">Dificultad</label>
              <div className="flex gap-2">
                {DIFICULTAD_OPTS.map(({ v, l }) => (
                  <button key={v} type="button" onClick={() => setForm(f => ({ ...f, dificultad: v }))}
                    className={`flex-1 py-2 rounded-xl border-2 text-sm font-medium transition-all
                      ${form.dificultad === v ? 'border-accent bg-accent text-white' : 'border-border text-muted'}`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="input-label">Prep (min)</label>
                <input type="number" min={0} value={form.tiempo_preparacion_min ?? ''}
                  onChange={e => setForm(f => ({ ...f, tiempo_preparacion_min: e.target.value ? +e.target.value : null }))} />
              </div>
              <div>
                <label className="input-label">Cocción (min)</label>
                <input type="number" min={0} value={form.tiempo_coccion_min ?? ''}
                  onChange={e => setForm(f => ({ ...f, tiempo_coccion_min: e.target.value ? +e.target.value : null }))} />
              </div>
              <div>
                <label className="input-label">Porciones</label>
                <input type="number" min={1} max={50} value={form.porciones ?? ''}
                  onChange={e => setForm(f => ({ ...f, porciones: e.target.value ? +e.target.value : null }))} />
              </div>
            </div>

            <div>
              <label className="input-label">Costo estimado</label>
              <div className="flex gap-2">
                {COSTO_OPTS.map(({ v, l }) => (
                  <button key={v} type="button" onClick={() => setForm(f => ({ ...f, costo_estimado: v }))}
                    className={`flex-1 py-2 rounded-xl border-2 text-sm font-medium transition-all
                      ${form.costo_estimado === v ? 'border-accent bg-accent text-white' : 'border-border text-muted'}`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </Seccion>

          {/* ── S2: Ingredientes ── */}
          <Seccion titulo="🥕 Ingredientes">
            <div className="flex flex-col gap-2">
              {ingredientes.map((ing, idx) => (
                <div key={idx} className="p-3 rounded-xl border border-border bg-white flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <input className="flex-1 min-w-0" style={{ padding: '8px 10px', fontSize: '13px' }}
                      value={ing.nombre} placeholder="Ingrediente"
                      onChange={e => updateIngrediente(idx, { nombre: e.target.value })} />
                    <button onClick={() => removeIngrediente(idx)} className="text-muted hover:text-error transition-colors flex-shrink-0">
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <input type="number" min={0} step={0.1} style={{ padding: '6px 8px', fontSize: '12px' }}
                      value={ing.cantidad ?? ''} placeholder="Cant."
                      onChange={e => updateIngrediente(idx, { cantidad: e.target.value ? +e.target.value : null })} />
                    <select style={{ padding: '6px 8px', fontSize: '12px' }}
                      value={ing.unidad ?? ''} onChange={e => updateIngrediente(idx, { unidad: e.target.value || null })}>
                      <option value="">unidad</option>
                      {UNIDAD_OPTS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                    <select style={{ padding: '6px 8px', fontSize: '12px' }}
                      value={ing.categoria} onChange={e => updateIngrediente(idx, { categoria: e.target.value })}>
                      {CAT_OPTS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={ing.esencial}
                        onChange={e => updateIngrediente(idx, { esencial: e.target.checked })}
                        className="w-4 h-4 accent-accent" />
                      <span className="text-xs text-muted">Esencial</span>
                    </label>
                    <div className="flex gap-1">
                      <button onClick={() => moveIngrediente(idx, -1)} className="text-muted hover:text-text"><ChevronUp size={15} /></button>
                      <button onClick={() => moveIngrediente(idx, 1)}  className="text-muted hover:text-text"><ChevronDown size={15} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setIngredientes(p => [...p, newIngrediente()])}
              className="flex items-center gap-2 text-accent text-sm font-medium hover:opacity-80 transition-opacity">
              <Plus size={16} /> Agregar ingrediente
            </button>
          </Seccion>

          {/* ── S3: Pasos ── */}
          <Seccion titulo="👨‍🍳 Preparación">
            <div className="flex flex-col gap-2">
              {pasos.map((paso, idx) => (
                <div key={idx} className="flex gap-2 items-start">
                  <span className="w-6 h-6 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-2.5">
                    {idx + 1}
                  </span>
                  <textarea rows={2} style={{ fontSize: '13px', lineHeight: 1.5, resize: 'vertical' }}
                    value={paso} placeholder={`Paso ${idx + 1}…`}
                    onChange={e => updatePaso(idx, e.target.value)}
                    className="flex-1" />
                  <div className="flex flex-col gap-0.5 flex-shrink-0 mt-1.5">
                    <button onClick={() => movePaso(idx, -1)} className="text-muted hover:text-text"><ChevronUp size={15} /></button>
                    <button onClick={() => removePaso(idx)}   className="text-muted hover:text-error"><Trash2 size={14} /></button>
                    <button onClick={() => movePaso(idx, 1)}  className="text-muted hover:text-text"><ChevronDown size={15} /></button>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setPasos(p => [...p, ''])}
              className="flex items-center gap-2 text-accent text-sm font-medium hover:opacity-80 transition-opacity">
              <Plus size={16} /> Agregar paso
            </button>
          </Seccion>

          {/* ── S4: Nutrición ── */}
          <Seccion titulo="📊 Información nutricional">
            <p className="text-xs text-muted -mt-1">Valores estimados por porción — pueden variar</p>
            <div className="grid grid-cols-2 gap-3">
              {([
                ['calorias_porcion', 'Calorías (kcal)', '480'],
                ['proteina_g',       'Proteína (g)',     '28'],
                ['carbohidratos_g',  'Carbos (g)',       '55'],
                ['grasa_g',          'Grasa (g)',        '14'],
                ['sodio_mg',         'Sodio (mg)',       '600'],
                ['azucar_g',         'Azúcar (g)',       '5'],
                ['fibra_g',          'Fibra (g)',        '4'],
              ] as [string, string, string][]).map(([campo, label, ph]) => (
                <div key={campo}>
                  <label className="input-label text-xs">{label}</label>
                  <input type="number" min={0} placeholder={ph}
                    value={(nut as Record<string,number|null> | null)?.[campo] ?? ''}
                    onChange={e => setForm(f => ({
                      ...f,
                      info_nutricional_aprox: {
                        calorias_porcion:  0, proteina_g: 0, carbohidratos_g: 0, grasa_g: 0,
                        sodio_mg: null, azucar_g: null, fibra_g: null,
                        ...f.info_nutricional_aprox,
                        [campo]: e.target.value ? +e.target.value : null,
                      }
                    }))} />
                </div>
              ))}
            </div>
          </Seccion>

          {/* ── S5: Tags + Perfiles + Filtros ── */}
          <Seccion titulo="🏷️ Etiquetas y perfiles">
            {/* Tags */}
            <div>
              <label className="input-label">Tags</label>
              <div className="flex gap-2 mb-2 flex-wrap">
                {tags.map(t => (
                  <span key={t} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-accent/10 text-accent border border-accent/30">
                    {t}
                    <button onClick={() => setTags(prev => prev.filter(x => x !== t))} className="text-accent/70 hover:text-accent font-bold">×</button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input value={tagInput} onChange={e => setTagInput(e.target.value)} placeholder="Agregar tag…"
                  onKeyDown={e => { if (e.key === 'Enter' && tagInput.trim()) { e.preventDefault(); setTags(p => [...p, tagInput.trim()]); setTagInput('') }}} />
                <button onClick={() => { if (tagInput.trim()) { setTags(p => [...p, tagInput.trim()]); setTagInput('') }}}
                  className="px-3 py-2 rounded-xl bg-accent-light text-accent text-sm font-medium whitespace-nowrap">+ Add</button>
              </div>
            </div>

            {/* Perfiles */}
            <div>
              <label className="input-label">Perfiles</label>
              <div className="grid grid-cols-2 gap-2">
                {PERFILES_LABELS.map(({ key, label }) => (
                  <Toggle key={key} label={label}
                    checked={!!form.perfiles?.[key]}
                    onChange={v => setForm(f => ({ ...f, perfiles: { ...f.perfiles, [key]: v } }))} />
                ))}
              </div>
            </div>

            {/* Filtros nutricionales */}
            <div>
              <label className="input-label">Filtros nutricionales</label>
              <div className="grid grid-cols-2 gap-2">
                {FILTROS_LABELS.map(({ key, label }) => (
                  <Toggle key={key} label={label}
                    checked={!!form.filtros_nutricionales?.[key]}
                    onChange={v => setForm(f => ({ ...f, filtros_nutricionales: { ...f.filtros_nutricionales, [key]: v } }))} />
                ))}
              </div>
            </div>
          </Seccion>

          {/* ── S6: Asignación familiar ── */}
          {members.length > 0 && (
            <Seccion titulo="👨‍👩‍👧 ¿Para quién es esta receta?">
              <p className="text-xs text-muted -mt-1">La IA usará esto para sugerirla en el menú del miembro correcto</p>
              <div className="flex flex-col gap-2">
                {members.map(m => {
                  const sel     = miembrosAsignados.has(m.id!)
                  const alertas = alertasMiembro(m.id!)
                  return (
                    <div key={m.id}
                      className={`p-3 rounded-xl border transition-all ${sel ? 'border-accent bg-accent/5' : 'border-border bg-white'}`}>
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{m.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-text">{m.name}</p>
                          {alertas.length > 0 && (
                            <p className="text-xs text-error mt-0.5">
                              ⚠️ Alérgico/a a: {alertas.join(', ')}
                            </p>
                          )}
                        </div>
                        <button type="button"
                          onClick={() => setMiembrosAsignados(prev => {
                            const next = new Set(prev)
                            if (next.has(m.id!)) next.delete(m.id!); else next.add(m.id!)
                            return next
                          })}
                          className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0
                            ${sel ? 'bg-accent' : 'bg-gray-200'}`}>
                          <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all
                            ${sel ? 'left-5' : 'left-0.5'}`} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Seccion>
          )}

          {/* ── S7: Privacidad ── */}
          <Seccion titulo="🔒 Privacidad">
            <div>
              <label className="input-label">Visibilidad</label>
              <div className="flex gap-2">
                {([['private','🔒 Solo mi familia'],['public','🌍 Pública (comunidad mesa.os)']] as const).map(([v, l]) => (
                  <button key={v} type="button" onClick={() => setVisibility(v)}
                    className={`flex-1 py-2 rounded-xl border-2 text-xs font-medium transition-all
                      ${visibility === v ? 'border-accent bg-accent text-white' : 'border-border text-muted'}`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            <Toggle label="Activa para menú semanal"
              checked={activoMenu}
              onChange={setActivoMenu}
              desc="Si está activa puede aparecer en sugerencias del menú" />

            {form.source_url && (
              <p className="text-xs text-muted">
                Fuente: <a href={form.source_url} target="_blank" rel="noopener noreferrer"
                  className="text-accent underline truncate">{form.source_url}</a>
              </p>
            )}
          </Seccion>

          {/* Error */}
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200">
              <p className="text-sm text-error">{error}</p>
            </div>
          )}

        </div>
      </div>

      {/* Footer fijo con botón guardar */}
      <div className="border-t border-border bg-white px-4 py-4 flex-shrink-0 flex flex-col gap-2">
        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200">
            <p className="text-sm text-error font-medium">{error}</p>
          </div>
        )}
        <button onClick={guardar} disabled={saving} className="btn-primary">
          {saving ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              Guardando…
            </span>
          ) : '✓ Guardar receta'}
        </button>
      </div>
    </div>
  )
}

// ── Componentes auxiliares ────────────────────────────────────────────────────
function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <h3 className="font-semibold text-text text-base border-b border-border pb-2">{titulo}</h3>
      {children}
    </div>
  )
}

function Toggle({ label, checked, onChange, desc }: {
  label: string; checked: boolean; onChange: (v: boolean) => void; desc?: string
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-text">{label}</p>
        {desc && <p className="text-xs text-muted">{desc}</p>}
      </div>
      <button type="button" onClick={() => onChange(!checked)}
        className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${checked ? 'bg-accent' : 'bg-gray-200'}`}>
        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${checked ? 'left-5' : 'left-0.5'}`} />
      </button>
    </div>
  )
}
