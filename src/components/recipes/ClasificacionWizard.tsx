/**
 * ClasificacionWizard
 *
 * Wizard de 2 pasos para clasificar una receta:
 * Paso 1 — ¿Cuándo se come? (tipo_comida, selección múltiple)
 * Paso 2 — ¿Qué tipo de plato es? (tipo_componente, selección única)
 *
 * Se usa tanto al importar como al editar etiquetas en el detalle.
 */

import { useState } from 'react'
import { X, ChevronLeft } from 'lucide-react'

interface Props {
  /** Valores iniciales (para edición) */
  initialTipoComida?:       string[]
  initialTipoComponente?:  string | null
  onConfirm: (tipoComida: string[], tipoComponente: string) => void
  onClose:   () => void
  titulo?:   string
}

const CUANDO: { id: string; emoji: string; label: string }[] = [
  { id: 'desayuno', emoji: '☀️', label: 'Desayuno'  },
  { id: 'almuerzo', emoji: '🍽️', label: 'Almuerzo'  },
  { id: 'cena',     emoji: '🌙', label: 'Cena'      },
  { id: 'snack',    emoji: '🍿', label: 'Snack'     },
  { id: 'postre',   emoji: '🍰', label: 'Postre'    },
  { id: 'brunch',   emoji: '🥞', label: 'Brunch'    },
  { id: 'bebida',   emoji: '🥤', label: 'Bebida'    },
]

const TIPOS: { id: string; emoji: string; label: string }[] = [
  { id: 'proteina_principal', emoji: '🍖', label: 'Proteína'    },
  { id: 'plato_unico',        emoji: '🥘', label: 'Plato único' },
  { id: 'sopa',               emoji: '🍲', label: 'Sopa'        },
  { id: 'guarnicion',         emoji: '🍚', label: 'Guarnición'  },
  { id: 'ensalada',           emoji: '🥗', label: 'Ensalada'    },
  { id: 'salsa',              emoji: '🫙', label: 'Salsa'       },
  { id: 'postre',             emoji: '🍰', label: 'Postre'      },
  { id: 'bebida',             emoji: '🥤', label: 'Bebida'      },
  { id: 'merienda',           emoji: '🥪', label: 'Merienda'    },
]

export default function ClasificacionWizard({
  initialTipoComida = [],
  initialTipoComponente = null,
  onConfirm,
  onClose,
  titulo = '¿Cómo clasificamos esta receta?',
}: Props) {
  const [paso,         setPaso]         = useState(1)
  const [tipoComida,   setTipoComida]   = useState<string[]>(initialTipoComida)
  const [tipoComp,     setTipoComp]     = useState<string | null>(initialTipoComponente)

  const toggleComida = (id: string) => {
    setTipoComida(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const puedeSiguiente = tipoComida.length > 0
  const puedeGuardar   = tipoComp !== null

  const handleGuardar = () => {
    if (!tipoComp) return
    onConfirm(tipoComida, tipoComp)
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />

      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl max-h-[90vh] overflow-y-auto" style={{ backgroundColor: '#ffffff', isolation: 'isolate' }}>
        <div className="flex flex-col gap-4 p-4 pb-10">

          {/* Handle */}
          <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto" />

          {/* Header */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {paso === 2 && (
                <button onClick={() => setPaso(1)}
                  className="p-1.5 rounded-xl hover:bg-gray-100 text-muted">
                  <ChevronLeft size={18} />
                </button>
              )}
              <div>
                <p className="font-semibold text-text text-sm">{titulo}</p>
                <p className="text-xs text-muted">Paso {paso} de 2</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-gray-100">
              <X size={18} className="text-muted" />
            </button>
          </div>

          {/* Barra de progreso */}
          <div className="w-full bg-gray-100 rounded-full h-1.5">
            <div className="bg-accent h-1.5 rounded-full transition-all duration-300"
              style={{ width: paso === 1 ? '50%' : '100%' }} />
          </div>

          {/* ── PASO 1: ¿Cuándo se come? ── */}
          {paso === 1 && (
            <>
              <div>
                <p className="font-semibold text-text">¿Cuándo se come?</p>
                <p className="text-xs text-muted mt-0.5">Podés elegir varias opciones</p>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {CUANDO.map(op => {
                  const sel = tipoComida.includes(op.id)
                  return (
                    <button key={op.id} onClick={() => toggleComida(op.id)}
                      className={`flex flex-col items-center gap-1.5 py-4 rounded-2xl border-2 transition-all
                        ${sel ? 'border-accent bg-accent/8' : 'border-border hover:border-accent/40'}`}>
                      <span className="text-2xl">{op.emoji}</span>
                      <span className={`text-xs font-medium ${sel ? 'text-accent' : 'text-text'}`}>
                        {op.label}
                      </span>
                    </button>
                  )
                })}
              </div>

              <button onClick={() => setPaso(2)} disabled={!puedeSiguiente}
                className="btn-primary disabled:opacity-40">
                Siguiente →
              </button>
            </>
          )}

          {/* ── PASO 2: ¿Qué tipo de plato? ── */}
          {paso === 2 && (
            <>
              <div>
                <p className="font-semibold text-text">¿Qué tipo de plato es?</p>
                <p className="text-xs text-muted mt-0.5">Elegí una sola opción</p>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {TIPOS.map(op => {
                  const sel = tipoComp === op.id
                  return (
                    <button key={op.id} onClick={() => setTipoComp(op.id)}
                      className={`flex flex-col items-center gap-1.5 py-4 rounded-2xl border-2 transition-all
                        ${sel ? 'border-accent bg-accent/8' : 'border-border hover:border-accent/40'}`}>
                      <span className="text-2xl">{op.emoji}</span>
                      <span className={`text-xs font-medium text-center leading-tight ${sel ? 'text-accent' : 'text-text'}`}>
                        {op.label}
                      </span>
                    </button>
                  )
                })}
              </div>

              <button onClick={handleGuardar} disabled={!puedeGuardar}
                className="btn-primary disabled:opacity-40">
                Guardar ✓
              </button>
            </>
          )}
        </div>
      </div>
    </>
  )
}
