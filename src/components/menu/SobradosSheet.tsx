import { useState } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'
import { useLeftoversStore, type Leftover } from '../../store/leftoversStore'
import { useFamilyStore } from '../../store/familyStore'

const SUGERENCIAS = [
  'Pollo asado', 'Pechuga de pollo', 'Carne de res', 'Carne molida',
  'Salmón', 'Atún', 'Huevos cocidos', 'Frijoles', 'Lentejas',
  'Cerdo', 'Camarones', 'Tofu',
]

interface Props {
  onClose: () => void
}

export default function SobradosSheet({ onClose }: Props) {
  const { family }                                   = useFamilyStore()
  const { leftovers, addLeftover, removeLeftover }   = useLeftoversStore()
  const [nombre,   setNombre]   = useState('')
  const [cantidad, setCantidad] = useState('')
  const [saving,   setSaving]   = useState(false)

  const handleAdd = async (name: string, qty?: string) => {
    if (!family?.id || !name.trim()) return
    setSaving(true)
    await addLeftover(family.id, name.trim(), qty?.trim() || undefined)
    setNombre('')
    setCantidad('')
    setSaving(false)
  }

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={onClose} />

      <div className="fixed inset-0 z-50 flex items-center justify-center px-4 pointer-events-none">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[85vh] overflow-y-auto pointer-events-auto" style={{ backgroundColor: '#ffffff', isolation: 'isolate' }}>
          <div className="flex flex-col gap-4 p-5 pb-6">

            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900">¿Qué te sobró?</p>
                <p className="text-xs text-gray-500 mt-0.5">Proteínas o preparaciones de días anteriores</p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-gray-100">
                <X size={18} className="text-gray-400" />
              </button>
            </div>

            {/* Sugerencias rápidas */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Sugerencias rápidas</p>
              <div className="flex flex-wrap gap-2">
                {SUGERENCIAS.filter(s =>
                  !leftovers.some(l => l.ingredient_name.toLowerCase() === s.toLowerCase())
                ).map(s => (
                  <button key={s} onClick={() => handleAdd(s)}
                    className="px-3 py-1.5 rounded-full border border-gray-200 bg-gray-50 text-xs text-gray-700 hover:border-orange-400 hover:text-orange-500 hover:bg-orange-50 transition-colors">
                    + {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Input manual */}
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Agregar manualmente</p>
              <input
                type="text"
                placeholder="Ej: pollo asado, sopa de lentejas…"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(nombre, cantidad) } }}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Cantidad (ej: 3 presas, medio kilo…)"
                  value={cantidad}
                  onChange={e => setCantidad(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                />
                <button
                  onClick={() => handleAdd(nombre, cantidad)}
                  disabled={!nombre.trim() || saving}
                  className="px-4 py-2 bg-orange-500 text-white rounded-xl text-sm font-medium disabled:opacity-40 flex items-center gap-1.5 hover:bg-orange-600 transition-colors">
                  <Plus size={15} /> Agregar
                </button>
              </div>
            </div>

            {/* Lista de sobrantes registrados */}
            {leftovers.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Esta semana ({leftovers.length})
                </p>
                <div className="flex flex-col gap-2">
                  {leftovers.map((l: Leftover) => (
                    <div key={l.id}
                      className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-green-50 border border-green-200">
                      <div>
                        <p className="text-sm font-medium text-gray-800">🍗 {l.ingredient_name}</p>
                        {l.quantity && <p className="text-xs text-gray-500 mt-0.5">{l.quantity}</p>}
                      </div>
                      <button onClick={() => removeLeftover(l.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {leftovers.length === 0 && (
              <p className="text-center text-sm text-gray-400 py-2">
                Aún no registraste sobrantes esta semana.
              </p>
            )}

          </div>
        </div>
      </div>
    </>
  )
}
