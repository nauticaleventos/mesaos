import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shuffle, ChefHat, Clock, RefreshCw, UtensilsCrossed } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useFridgeStore } from '../../store/fridgeStore'
import { useFamilyStore } from '../../store/familyStore'
import { calcularMatch } from '../../lib/matchReceta'

type Fase = 'idle' | 'cargando' | 'resultado' | 'vacio'

interface RecetaSugerida {
  id: string
  nombre: string
  imagen_url: string | null
  tiempo_total_min: number | null
  dificultad: string | null
  porciones: number | null
  score: number
  razones: string[]
  ingredientes: { nombre: string; categoria: string; esencial: boolean }[]
}

function detectarProximaComida(): { tipo: string; label: string } {
  const h = new Date().getHours()
  if (h < 10) return { tipo: 'desayuno', label: 'desayuno' }
  if (h < 14) return { tipo: 'almuerzo', label: 'almuerzo' }
  if (h < 17) return { tipo: 'snack',    label: 'snack' }
  return { tipo: 'cena', label: 'cena' }
}

export default function SorprenderBanner({ familyId }: { familyId: string }) {
  const navigate     = useNavigate()
  const { items }    = useFridgeStore()
  const { members }  = useFamilyStore()

  const [fase,       setFase]       = useState<Fase>('idle')
  const [candidatas, setCandidatas] = useState<RecetaSugerida[]>([])
  const [indice,     setIndice]     = useState(0)
  const [rechazadas, setRechazadas] = useState(0)

  const proxima = detectarProximaComida()

  const buscar = async () => {
    setFase('cargando')
    setIndice(0)
    setRechazadas(0)

    // Recetas usadas esta semana (excluir repeticiones)
    const { data: usadas } = await supabase
      .from('weekly_menu')
      .select('recipe_id')
      .eq('family_id', familyId)
      .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString())

    const usadasSet = new Set((usadas ?? []).map((u: { recipe_id: string }) => u.recipe_id))

    // Ratings altos de la familia
    const memberIds = members.map(m => m.id).filter(Boolean) as string[]
    const { data: reactions } = memberIds.length > 0
      ? await supabase.from('recipe_reactions')
          .select('recipe_id, rating')
          .in('member_id', memberIds)
          .gte('rating', 4)
      : { data: [] }
    const ratingAlto = new Set((reactions ?? []).map((r: { recipe_id: string }) => r.recipe_id))

    // Tipos y límites según la próxima comida
    const tiposPermitidos =
      proxima.tipo === 'snack'    ? ['merienda', 'bebida'] :
      proxima.tipo === 'desayuno' ? ['proteina_principal', 'plato_unico', 'merienda'] :
      ['proteina_principal', 'plato_unico']

    const tiempoMax =
      proxima.tipo === 'snack'    ? 15 :
      proxima.tipo === 'desayuno' ? 30 :
      45

    // Recetas candidatas — nunca salsas ni vinagretas
    const { data: recetas } = await supabase
      .from('recipes')
      .select('id, nombre, imagen_url, tiempo_total_min, dificultad, porciones, ingredientes, perfiles, tipo_comida')
      .eq('is_active_for_menu', true)
      .in('tipo_componente', tiposPermitidos)
      .lte('tiempo_total_min', tiempoMax)
      .not('tiempo_total_min', 'is', null)

    if (!recetas || recetas.length === 0) { setFase('vacio'); return }

    // Sobras pendientes esta semana
    const { data: leftoversData } = await supabase
      .from('weekly_leftovers')
      .select('ingredient_name')
      .eq('family_id', familyId)
    const leftovers = (leftoversData ?? []).map((l: { ingredient_name: string }) =>
      l.ingredient_name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    )

    // Score de nevera para cada candidata
    const scored: RecetaSugerida[] = recetas
      .filter(r => !usadasSet.has(r.id))
      .map(r => {
        const ings = r.ingredientes ?? []
        const match = calcularMatch(ings, items)
        const tieneRating = ratingAlto.has(r.id)
        const esCena      = proxima.tipo === 'cena'
        const esRapida    = (r.tiempo_total_min ?? 999) <= 30
        const esFacil     = r.dificultad === 'facil'

        // Bonus sobras: receta usa algún sobrante
        const sobraUsada = leftovers.find(lft =>
          ings.some((i: { nombre: string }) => i.nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(lft) ||
                         lft.includes(i.nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')))
        )

        const score =
          match.porcentaje * 0.40 +
          (tieneRating ? 25 : 0) +
          (esCena && esRapida ? 20 : 0) +
          (esFacil ? 15 : 0) +
          (sobraUsada ? 200 : 0)

        // Generar razones legibles
        const razones: string[] = []
        if (sobraUsada) razones.push(`♻️ Usa tu sobra de ${sobraUsada}`)
        if (match.porcentaje === 100) razones.push('Tenés todos los ingredientes')
        else if (match.porcentaje >= 80) {
          const faltantes = match.faltantes.slice(0, 2).join(', ')
          razones.push(`Casi lista, solo falta ${faltantes}`)
        }
        if (tieneRating) razones.push('Tu familia la calificó muy bien')
        if (esCena && esRapida) razones.push(`Rápida para tu ${proxima.label}`)
        if (esFacil && razones.length < 2) razones.push('Fácil de preparar')
        if (razones.length === 0) razones.push(`Buena opción para tu ${proxima.label}`)

        return { ...r, score, razones: razones.slice(0, 3), ingredientes: ings }
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)

    if (scored.length === 0) { setFase('vacio'); return }
    setCandidatas(scored)
    setFase('resultado')
  }

  const otra = () => {
    const siguiente = indice + 1
    if (siguiente >= candidatas.length) { setFase('idle'); return }
    setIndice(siguiente)
    setRechazadas(r => r + 1)
  }

  const receta = candidatas[indice]

  // ─── IDLE ─────────────────────────────────────────────────────────────
  if (fase === 'idle') {
    return (
      <div className="card flex flex-col gap-3 bg-gradient-to-br from-accent/5 to-white border-accent/20">
        <p className="text-sm font-semibold text-text">¿Qué cocino hoy?</p>
        <p className="text-xs text-muted -mt-1">Te sugiero algo según tu nevera y gustos.</p>
        <button onClick={buscar}
          className="btn-primary flex items-center justify-center gap-2 text-sm">
          <Shuffle size={16} />
          Sorpréndeme
        </button>
      </div>
    )
  }

  // ─── CARGANDO ─────────────────────────────────────────────────────────
  if (fase === 'cargando') {
    return (
      <div className="card flex flex-col items-center gap-3 py-6">
        <div className="flex gap-1">
          {[0, 150, 300].map(d => (
            <span key={d} className="w-2 h-2 rounded-full bg-accent animate-bounce"
              style={{ animationDelay: `${d}ms` }} />
          ))}
        </div>
        <p className="text-sm text-muted">Buscando lo mejor para tu {proxima.label}…</p>
      </div>
    )
  }

  // ─── VACÍO ────────────────────────────────────────────────────────────
  if (fase === 'vacio') {
    return (
      <div className="card flex flex-col items-center gap-3 py-5 text-center">
        <UtensilsCrossed size={28} className="text-muted" />
        <p className="text-sm text-muted">Sin sugerencias disponibles ahora.</p>
        <button onClick={() => setFase('idle')} className="text-xs text-accent font-medium">
          Volver
        </button>
      </div>
    )
  }

  // ─── RESULTADO ────────────────────────────────────────────────────────
  return (
    <div className="card flex flex-col gap-3 border-accent/30">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-accent uppercase tracking-wider">
          Para tu {proxima.label}
        </p>
        <button onClick={() => setFase('idle')}
          className="text-xs text-muted hover:text-text transition-colors">
          ✕
        </button>
      </div>

      {/* Receta */}
      <button onClick={() => navigate(`/receta/${receta.id}`)}
        className="flex items-center gap-3 text-left hover:opacity-80 transition-opacity">
        <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-accent-light">
          {receta.imagen_url
            ? <img src={receta.imagen_url} alt={receta.nombre} className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center">
                <ChefHat size={20} color="#E76F51" />
              </div>
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-text text-sm leading-tight">{receta.nombre}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {receta.tiempo_total_min && (
              <span className="flex items-center gap-1 text-xs text-muted">
                <Clock size={11} />{receta.tiempo_total_min} min
              </span>
            )}
            {receta.dificultad && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium
                ${receta.dificultad === 'facil' ? 'bg-green-100 text-green-700'
                : receta.dificultad === 'media' ? 'bg-yellow-100 text-yellow-700'
                : 'bg-red-100 text-red-700'}`}>
                {receta.dificultad}
              </span>
            )}
          </div>
        </div>
      </button>

      {/* Razones */}
      <div className="flex flex-col gap-1">
        {receta.razones.map((r, i) => (
          <p key={i} className="text-xs text-muted flex items-center gap-1.5">
            <span className="text-accent">•</span>{r}
          </p>
        ))}
      </div>

      {/* Acciones */}
      <div className="flex gap-2 pt-1">
        <button onClick={() => navigate(`/receta/${receta.id}`)}
          className="flex-1 btn-primary text-sm flex items-center justify-center gap-1.5 py-2.5">
          <UtensilsCrossed size={14} />
          Cocinar esta
        </button>
        <button onClick={otra}
          className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-border text-sm text-muted hover:border-accent hover:text-accent transition-all">
          <RefreshCw size={14} />
          {rechazadas >= 2 ? 'Ver más' : 'Otra'}
        </button>
      </div>
    </div>
  )
}
