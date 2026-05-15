import { useState } from 'react'
import { X, Zap } from 'lucide-react'
import { useMenuStore } from '../../store/menuStore'
import { useFamilyStore } from '../../store/familyStore'

const OPCIONES = [
  {
    cuantas: 1,
    label:   'Solo la próxima comida',
    desc:    'Un alivio puntual',
    emoji:   '🍌',
  },
  {
    cuantas: 2,
    label:   'Las próximas 2 comidas',
    desc:    'Esta tarde y mañana',
    emoji:   '🥪',
  },
  {
    cuantas: 3,
    label:   'Las próximas 3 comidas',
    desc:    'Modo supervivencia activado',
    emoji:   '🧃',
  },
]

const EJEMPLOS = [
  '🍌 Snack → banana + almendras',
  '🥗 Almuerzo → ensalada + sobrante de ayer',
  '🌮 Cena → taquitos con pollo del día anterior',
  '🥣 Desayuno → yogur + granola',
  '🧃 Snack → jugo + tostadas',
]

interface Props {
  onClose: () => void
}

export default function DiaDificilSheet({ onClose }: Props) {
  const { family }           = useFamilyStore()
  const { simplificarComidas } = useMenuStore()
  const [selected, setSelected] = useState<number | null>(null)
  const [loading,  setLoading]  = useState(false)
  const [done,     setDone]     = useState<number | null>(null)

  const handleConfirm = async () => {
    if (!selected || !family?.id) return
    setLoading(true)
    try {
      const cambiadas = await simplificarComidas(family.id, selected)
      setDone(cambiadas)
    } catch (err) {
      console.error('simplificarComidas error:', err)
      setDone(-1)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ backgroundColor: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(4px)' }} onClick={onClose} />

      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl max-h-[88vh] overflow-y-auto" style={{ backgroundColor: '#ffffff', isolation: 'isolate' }}>
        <div className="flex flex-col gap-4 p-4 pb-10">

          <div className="w-10 h-1 rounded-full bg-border mx-auto" />

          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-text flex items-center gap-2">
                <Zap size={18} className="text-yellow-500" /> Día difícil
              </p>
              <p className="text-xs text-muted mt-0.5">
                Las próximas comidas serán las más sencillas posibles.
              </p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-gray-100 flex-shrink-0">
              <X size={18} className="text-muted" />
            </button>
          </div>

          {done !== null ? (
            /* Estado final */
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <span className="text-5xl">{done === -1 ? '❌' : '✅'}</span>
              <div>
                <p className="font-semibold text-text">
                  {done === -1
                    ? 'Error al simplificar'
                    : done > 0
                      ? `${done} comida${done > 1 ? 's' : ''} simplificada${done > 1 ? 's' : ''}`
                      : 'No encontré recetas más fáciles'}
                </p>
                <p className="text-xs text-muted mt-1">
                  {done === -1
                    ? 'Revisá la conexión e intentá de nuevo.'
                    : done > 0
                      ? 'Las recetas se cambiaron a opciones rápidas y fáciles.'
                      : 'El menú ya tiene las recetas más sencillas disponibles.'}
                </p>
              </div>
              <button onClick={onClose} className="btn-primary max-w-xs">Listo</button>
            </div>
          ) : (
            <>
              {/* Opciones */}
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold text-muted uppercase tracking-wider">¿Cuántas comidas simplificamos?</p>
                {OPCIONES.map(op => (
                  <button key={op.cuantas}
                    onClick={() => setSelected(op.cuantas)}
                    className={`flex items-center gap-3 py-3 px-4 rounded-xl border-2 text-left transition-all
                      ${selected === op.cuantas ? 'border-accent bg-accent-light' : 'border-border hover:border-accent/40'}`}>
                    <span className="text-2xl flex-shrink-0">{op.emoji}</span>
                    <div className="flex-1">
                      <p className={`text-sm font-semibold ${selected === op.cuantas ? 'text-accent' : 'text-text'}`}>
                        {op.label}
                      </p>
                      <p className="text-xs text-muted">{op.desc}</p>
                    </div>
                    {selected === op.cuantas && (
                      <span className="text-accent text-lg flex-shrink-0">✓</span>
                    )}
                  </button>
                ))}
              </div>

              {/* Ejemplos */}
              <div className="p-3 rounded-2xl bg-gray-50 border border-border">
                <p className="text-xs font-semibold text-muted mb-2">Tipo de recetas que se priorizan:</p>
                <div className="flex flex-col gap-1">
                  {EJEMPLOS.map((e, i) => (
                    <p key={i} className="text-xs text-muted">{e}</p>
                  ))}
                </div>
              </div>

              <button
                onClick={handleConfirm}
                disabled={!selected || loading}
                className="btn-primary flex items-center justify-center gap-2 disabled:opacity-40">
                <Zap size={16} />
                {loading ? 'Simplificando…' : 'Simplificar comidas'}
              </button>
            </>
          )}

        </div>
      </div>
    </>
  )
}
