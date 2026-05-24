import { useState } from 'react'
import { X, Clock, ChefHat } from 'lucide-react'
import { useMenuStore, type EnrichedMenuEntry, type RecipeForMenu, type SwapReason } from '../../store/menuStore'

const RAZONES: { id: SwapReason; label: string; desc: string }[] = [
  { id: 'no_ingredientes', label: '🧊 No tengo los ingredientes', desc: 'Buscar con lo que hay disponible' },
  { id: 'no_apetece',      label: '😐 No me apetece hoy',        desc: 'Mostrar algo completamente diferente' },
  { id: 'muy_dificil',     label: '⏱️ Muy elaborada',            desc: 'Solo recetas fáciles' },
  { id: 'variedad',        label: '🔄 Quiero variedad',          desc: 'Sorprendeme con otra opción' },
]

interface Props {
  entry:   EnrichedMenuEntry
  onClose: () => void
}

export default function CambiarSheet({ entry, onClose }: Props) {
  const { buscarAlternativas, cambiarReceta } = useMenuStore()
  const [razon,        setRazon]        = useState<SwapReason | null>(null)
  const [alternativas, setAlternativas] = useState<RecipeForMenu[]>([])
  const [loading,      setLoading]      = useState(false)
  const [swapping,     setSwapping]     = useState<string | null>(null)

  const selectRazon = async (r: SwapReason) => {
    setRazon(r)
    setAlternativas([])
    setLoading(true)
    const alts = await buscarAlternativas(entry.id, r)
    setAlternativas(alts)
    setLoading(false)
  }

  const handleSwap = async (recipeId: string) => {
    setSwapping(recipeId)
    await cambiarReceta(entry.id, recipeId)
    onClose()
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />

      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-xl max-h-[88vh] overflow-y-auto" style={{ backgroundColor: '#ffffff', isolation: 'isolate' }}>
        <div className="flex flex-col gap-4 p-4 pb-10">

          {/* Handle */}
          <div className="w-10 h-1 rounded-full bg-border mx-auto" />

          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-text">Cambiar receta</p>
              <p className="text-xs text-muted mt-0.5 line-clamp-1">{entry.recipe?.nombre}</p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-gray-100 flex-shrink-0">
              <X size={18} className="text-muted" />
            </button>
          </div>

          {/* Razones */}
          <div>
            <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">¿Por qué la cambiás?</p>
            <div className="flex flex-col gap-2">
              {RAZONES.map(({ id, label, desc }) => (
                <button key={id} onClick={() => selectRazon(id)}
                  className={`py-2.5 px-3 rounded-xl border-2 text-left transition-all
                    ${razon === id
                      ? 'border-accent bg-accent-light'
                      : 'border-border bg-white hover:border-accent/60'}`}>
                  <p className={`text-sm font-medium ${razon === id ? 'text-accent' : 'text-text'}`}>{label}</p>
                  <p className="text-xs text-muted">{desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Alternativas */}
          {loading && (
            <div className="text-center py-6 text-sm text-muted">Buscando opciones…</div>
          )}

          {!loading && alternativas.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Alternativas</p>
              <div className="flex flex-col gap-2">
                {alternativas.map(alt => (
                  <button key={alt.id} disabled={!!swapping}
                    onClick={() => handleSwap(alt.id)}
                    className="flex items-center gap-3 p-3 rounded-xl border border-border hover:border-accent hover:bg-accent-light/30 transition-all text-left disabled:opacity-50">
                    <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-accent-light">
                      {alt.imagen_url
                        ? <img src={alt.imagen_url} alt={alt.nombre} className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center"><ChefHat size={20} color="#E76F51" /></div>
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-text leading-tight line-clamp-2">{alt.nombre}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {alt.tiempo_total_min && (
                          <span className="flex items-center gap-1 text-xs text-muted">
                            <Clock size={10} />{alt.tiempo_total_min} min
                          </span>
                        )}
                        {alt.dificultad && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-gray-100 text-muted capitalize">
                            {alt.dificultad}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className={`text-xs font-semibold flex-shrink-0 ${swapping === alt.id ? 'text-muted' : 'text-accent'}`}>
                      {swapping === alt.id ? '…' : 'Elegir →'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {!loading && razon && alternativas.length === 0 && (
            <div className="text-center py-4 flex flex-col gap-1">
              <p className="text-sm text-muted">No encontré alternativas para este criterio.</p>
              <p className="text-xs text-muted">Agregá más recetas al recetario para tener más opciones.</p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
