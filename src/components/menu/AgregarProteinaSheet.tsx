import { useState, useEffect } from 'react'
import { X, Clock, ChefHat } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useFamilyStore } from '../../store/familyStore'
import { useFridgeStore } from '../../store/fridgeStore'

// Keywords de proteína para detectar en nevera
const PROTEIN_KEYWORDS = [
  'pollo','pechuga','muslo','carne','res','lomo','cerdo','chorizo','jamón',
  'pescado','atún','salmón','sardinas','tilapia','bacalao',
  'huevo','huevos','queso','yogur','tofu','frijol','lentejas','garbanzos',
  'mariscos','camarón','langostino',
]

function esProteina(nombre: string): boolean {
  const n = nombre.toLowerCase()
  return PROTEIN_KEYWORDS.some(k => n.includes(k))
}

interface Leftover { id: string; protein_nombre: string; cantidad_aprox: string | null; cooking_date: string }
interface RecetaRapida { id: string; nombre: string; tiempo_total_min: number | null; dificultad: string | null; imagen_url: string | null }

interface Props {
  onClose: () => void
}

export default function AgregarProteinaSheet({ onClose }: Props) {
  const { family }   = useFamilyStore()
  const { items }    = useFridgeStore()

  const [leftovers,      setLeftovers]      = useState<Leftover[]>([])
  const [recetasRapidas, setRecetasRapidas] = useState<RecetaRapida[]>([])
  const [loading,        setLoading]        = useState(true)

  useEffect(() => {
    if (!family?.id) return
    loadData()
  }, [family?.id])

  const loadData = async () => {
    setLoading(true)
    const hace2Dias = new Date()
    hace2Dias.setDate(hace2Dias.getDate() - 2)
    const fechaLimite = hace2Dias.toISOString().split('T')[0]

    const [{ data: lData }, { data: rData }] = await Promise.all([
      // Sobras disponibles de las últimas 48h
      supabase.from('leftover_proteins')
        .select('id, protein_nombre, cantidad_aprox, cooking_date')
        .eq('family_id', family!.id)
        .eq('available', true)
        .gte('cooking_date', fechaLimite)
        .order('cooking_date', { ascending: false }),

      // Recetas rápidas de proteína (≤20 min, fácil)
      supabase.from('recipes')
        .select('id, nombre, tiempo_total_min, dificultad, imagen_url')
        .eq('tipo_componente', 'proteina_principal')
        .lte('tiempo_total_min', 20)
        .eq('dificultad', 'facil')
        .eq('is_active_for_menu', true)
        .limit(5),
    ])

    setLeftovers((lData ?? []) as Leftover[])
    setRecetasRapidas((rData ?? []) as RecetaRapida[])
    setLoading(false)
  }

  // Proteínas detectadas en nevera
  const proteinasNevera = items.filter(i => esProteina(i.name) && i.location !== 'congelador')

  const diasDesde = (fecha: string) => {
    const diff = Math.floor((Date.now() - new Date(fecha + 'T12:00:00').getTime()) / 86400000)
    if (diff === 0) return 'hoy'
    if (diff === 1) return 'ayer'
    return `hace ${diff} días`
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />

      <div className="fixed inset-0 z-50 flex items-center justify-center px-4 pointer-events-none">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[88vh] overflow-y-auto pointer-events-auto">
        <div className="flex flex-col gap-4 p-4 pb-6">

          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-text">Agregar proteína</p>
              <p className="text-xs text-muted mt-0.5">Enriquecé la ensalada o completá la comida</p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-gray-100">
              <X size={18} className="text-muted" />
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="flex gap-1">
                {[0,150,300].map(d => <span key={d} className="w-2 h-2 rounded-full bg-accent animate-bounce" style={{ animationDelay: `${d}ms` }} />)}
              </div>
            </div>
          ) : (
            <>
              {/* Sobras recientes */}
              {leftovers.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
                    🗓️ Sobras recientes (últimas 48h)
                  </p>
                  <div className="flex flex-col gap-2">
                    {leftovers.map(l => (
                      <div key={l.id} className="flex items-center gap-3 p-3 rounded-xl border border-oliva/30 bg-oliva-claro/30">
                        <span className="text-xl">🍗</span>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-text">{l.protein_nombre}</p>
                          <p className="text-xs text-muted">
                            {l.cantidad_aprox ? `${l.cantidad_aprox} · ` : ''}{diasDesde(l.cooking_date)}
                          </p>
                        </div>
                        <span className="text-xs text-oliva font-medium">Disponible ✓</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Proteínas en nevera */}
              {proteinasNevera.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
                    🧊 Listas en la nevera
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {proteinasNevera.map(item => (
                      <div key={item.id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-border">
                        <span className="text-sm">🥩</span>
                        <div>
                          <p className="text-sm font-medium text-text">{item.name}</p>
                          {item.quantity && <p className="text-xs text-muted">{item.quantity} {item.unit}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recetas rápidas */}
              {recetasRapidas.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
                    ⚡ Recetas rápidas (≤20 min)
                  </p>
                  <div className="flex flex-col gap-2">
                    {recetasRapidas.map(r => (
                      <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-white">
                        <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-accent-light">
                          {r.imagen_url
                            ? <img src={r.imagen_url} alt={r.nombre} className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center"><ChefHat size={18} color="#E76F51" /></div>
                          }
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-text">{r.nombre}</p>
                          {r.tiempo_total_min && (
                            <span className="flex items-center gap-1 text-xs text-muted mt-0.5">
                              <Clock size={10} />{r.tiempo_total_min} min
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Estado vacío */}
              {leftovers.length === 0 && proteinasNevera.length === 0 && recetasRapidas.length === 0 && (
                <div className="text-center py-6">
                  <p className="text-4xl mb-3">🥩</p>
                  <p className="text-sm font-medium text-text">Sin opciones disponibles</p>
                  <p className="text-xs text-muted mt-1">Agregá proteínas a tu nevera o cocinando una receta rápida.</p>
                </div>
              )}
            </>
          )}
        </div>
        </div>
      </div>
    </>
  )
}
