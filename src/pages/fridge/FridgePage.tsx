import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFamilyStore } from '../../store/familyStore'
import { useFridgeStore, expiryStatus, expiryLabel, type FridgeItem, type NewFridgeItem } from '../../store/fridgeStore'
import { calcularNivelNevera } from '../../lib/nivelNevera'
import BottomNav from '../../components/ui/BottomNav'
import AddItemForm from '../../components/fridge/AddItemForm'
import PhotoScan from '../../components/fridge/PhotoScan'
import QuickList from '../../components/fridge/QuickList'
import EnrichFromPhoto from '../../components/fridge/EnrichFromPhoto'

type Modal = null | 'manual' | 'photo' | 'edit' | 'quick'
type Filter = 'todos' | 'nevera' | 'congelador' | 'despensa'

const STATUS_COLORS = {
  expired:  'bg-red-100 border-red-300 text-red-700',
  critical: 'bg-red-50 border-red-200 text-red-600',
  warning:  'bg-yellow-50 border-yellow-200 text-yellow-700',
  ok:       'bg-white border-border text-text',
  none:     'bg-white border-border text-text',
}

const STATUS_DOT = {
  expired:  'bg-red-500',
  critical: 'bg-red-400',
  warning:  'bg-yellow-400',
  ok:       'bg-success',
  none:     'bg-border',
}

const LOCATION_ICONS: Record<string, string> = {
  nevera: '🧊', congelador: '❄️', despensa: '🗄️',
}

export default function FridgePage() {
  const navigate           = useNavigate()
  const { family }         = useFamilyStore()
  const { items, loading, loadItems, addItem, updateItem, deleteItem, clearAll } = useFridgeStore()
  const [modal, setModal]           = useState<Modal>(null)
  const [editingItem, setEditingItem] = useState<FridgeItem | null>(null)
  const [filter, setFilter]           = useState<Filter>('todos')
  const [busqueda, setBusqueda]       = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [confirmClear, setConfirmClear]   = useState(false)
  const [clearing, setClearing]           = useState(false)

  useEffect(() => {
    if (family?.id) loadItems(family.id)
  }, [family?.id, loadItems])

  const filtered = (filter === 'todos' ? items : items.filter(i => i.location === filter))
    .filter(i => !busqueda || i.name.toLowerCase().includes(busqueda.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }))
  const nivel     = calcularNivelNevera(items)

  const expiringSoon = items.filter(i => {
    const s = expiryStatus(i.expiry_date)
    return s === 'expired' || s === 'critical'
  })

  const handleSave = async (item: NewFridgeItem): Promise<FridgeItem | null> => {
    if (!family?.id) return null
    await addItem(item, family.id)
    if (modal === 'manual') setModal(null)
    // Devolver el item recién guardado (último en el store)
    const saved = useFridgeStore.getState().items.find(i => i.name === item.name) ?? null
    return saved
  }

  const handlePhotoDone = () => setModal(null)

  const handleEdit = (item: FridgeItem) => {
    setEditingItem(item)
    setModal('edit')
  }

  const handleUpdate = async (updated: NewFridgeItem) => {
    if (!editingItem) return
    await updateItem(editingItem.id, updated)
    setModal(null)
    setEditingItem(null)
  }

  if (modal) {
    return (
      <div className="min-h-screen px-4 py-6 max-w-lg mx-auto">
        <button onClick={() => { setModal(null); setEditingItem(null) }}
          className="text-muted text-sm mb-5 flex items-center gap-1 hover:text-text transition-colors">
          ← Volver a la nevera
        </button>
        <h2 className="text-xl font-serif font-semibold text-text mb-4">
          {modal === 'manual' ? 'Agregar alimento'
          : modal === 'edit'  ? `Editar: ${editingItem?.name}`
          : modal === 'quick' ? '¿Qué tenés en la nevera?'
          : 'Agregar por foto'}
        </h2>
        {modal === 'manual' && <AddItemForm onSave={handleSave} onCancel={() => setModal(null)} />}
        {modal === 'edit' && editingItem && (
          <AddItemForm
            initial={editingItem}
            onSave={handleUpdate}
            onCancel={() => { setModal(null); setEditingItem(null) }}
          />
        )}
        {modal === 'quick' && <QuickList onSave={handleSave} onEdit={handleEdit} onDone={handlePhotoDone} />}
        {modal === 'photo' && <PhotoScan onSave={handleSave} onCancel={() => setModal(null)} onDone={handlePhotoDone} onEdit={handleEdit} />}
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-28 max-w-lg mx-auto overflow-x-hidden">
      <BottomNav />

      {/* Header */}
      <div className="sticky top-0 bg-bg/95 backdrop-blur px-4 pt-6 pb-3 z-10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/')} className="text-muted hover:text-text transition-colors">←</button>
            <h1 className="text-xl font-serif font-semibold text-text">Mi Nevera</h1>
            <span className="text-muted text-sm">({items.length})</span>
          </div>
          <div className="flex gap-2">
            {items.length > 0 && (
              <button onClick={() => setConfirmClear(true)} title="Limpiar nevera"
                className="px-2.5 py-1.5 rounded-xl bg-white border border-border text-muted text-sm font-medium hover:border-error hover:text-error transition-all">
                🗑️
              </button>
            )}
            <button onClick={() => setModal('quick')}
              className="px-3 py-1.5 rounded-xl bg-accent-light text-accent text-sm font-medium hover:bg-accent hover:text-white transition-all">
              ✍️ Dictar
            </button>
            <button onClick={() => setModal('photo')}
              className="px-3 py-1.5 rounded-xl bg-accent-light text-accent text-sm font-medium hover:bg-accent hover:text-white transition-all">
              📷 Foto
            </button>
            <button onClick={() => setModal('manual')}
              className="px-3 py-1.5 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-all">
              +
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(['todos','nevera','congelador','despensa'] as Filter[]).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-all
                ${filter === f
                  ? 'bg-accent text-white'
                  : 'bg-white border border-border text-muted hover:border-accent hover:text-accent'}`}>
              {f === 'todos' ? 'Todos' : `${LOCATION_ICONS[f]} ${f.charAt(0).toUpperCase() + f.slice(1)}`}
            </button>
          ))}
        </div>

        {/* Buscador */}
        <input
          type="search"
          placeholder="🔍 Buscar en nevera..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
        />

      </div>

      <div className="px-4 flex flex-col gap-3 mt-2">

        {/* Nivel de nevera */}
        <div className="card flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-text">{nivel.resumen}</span>
            <span className="text-sm font-semibold text-accent">{nivel.porcentaje}%</span>
          </div>
          <div className="w-full bg-border rounded-full h-2">
            <div className="h-2 rounded-full transition-all duration-500"
              style={{
                width: `${nivel.porcentaje}%`,
                backgroundColor: nivel.porcentaje >= 75 ? '#22c55e'
                  : nivel.porcentaje >= 50 ? '#4a7c59'
                  : nivel.porcentaje >= 25 ? '#e8a020'
                  : '#ef4444'
              }} />
          </div>
          {nivel.categoriasFaltantes.length > 0 && (
            <p className="text-xs text-muted">
              Faltan: <span className="text-text">{nivel.categoriasFaltantes.join(', ')}</span>
            </p>
          )}
          {nivel.alertasVencimiento > 0 && (
            <p className="text-xs text-error">
              ⚠️ {nivel.alertasVencimiento} alimento{nivel.alertasVencimiento > 1 ? 's' : ''} por vencer pronto
            </p>
          )}
        </div>

        {/* Alerta de vencimiento próximo */}
        {expiringSoon.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-red-700 font-semibold text-sm mb-2">
              ⚠️ {expiringSoon.length} alimento{expiringSoon.length > 1 ? 's' : ''} por vencer
            </p>
            <div className="flex flex-col gap-1">
              {expiringSoon.map(i => (
                <p key={i.id} className="text-red-600 text-xs">
                  • {i.name} — {expiryLabel(i.expiry_date)}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Estado vacío */}
        {!loading && filtered.length === 0 && (
          <div className="text-center py-16 flex flex-col items-center gap-4">
            <span className="text-6xl">🧊</span>
            <div>
              <p className="text-text font-medium">Nevera vacía</p>
              <p className="text-muted text-sm mt-1">Agrega tus alimentos para empezar.</p>
            </div>
            <button onClick={() => setModal('manual')} className="btn-primary max-w-xs">
              + Agregar alimento
            </button>
          </div>
        )}

        {/* Lista de items */}
        {filtered.map(item => (
          <FridgeItemCard key={item.id} item={item}
            onDelete={setConfirmDelete}
            onEdit={handleEdit}
          />
        ))}
      </div>

      {/* Confirmar borrar */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/30 flex items-end justify-center z-50 px-4 pb-8">
          <div className="card w-full max-w-sm flex flex-col gap-4">
            <p className="text-text font-semibold text-center">¿Eliminar este alimento?</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="btn-ghost flex-1">Cancelar</button>
              <button
                onClick={async () => { await deleteItem(confirmDelete); setConfirmDelete(null) }}
                className="flex-1 py-3 rounded-xl bg-error text-white font-semibold text-sm">
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmar limpiar TODA la nevera */}
      {confirmClear && (
        <div className="fixed inset-0 bg-black/30 flex items-end justify-center z-50 px-4 pb-8">
          <div className="card w-full max-w-sm flex flex-col gap-4">
            <p className="text-text font-semibold text-center">¿Borrar todos los ingredientes de tu nevera?</p>
            <p className="text-muted text-sm text-center -mt-2">Se eliminarán los {items.length} alimentos. No se puede deshacer.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmClear(false)} className="btn-ghost flex-1" disabled={clearing}>Cancelar</button>
              <button
                onClick={async () => {
                  if (!family?.id) return
                  setClearing(true)
                  await clearAll(family.id)
                  setClearing(false)
                  setConfirmClear(false)
                }}
                disabled={clearing}
                className="flex-1 py-3 rounded-xl bg-error text-white font-semibold text-sm disabled:opacity-60">
                {clearing ? 'Borrando…' : 'Sí, limpiar todo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function FridgeItemCard({ item, onDelete, onEdit }: {
  item:     FridgeItem
  onDelete: (id: string) => void
  onEdit:   (item: FridgeItem) => void
}) {
  const [showTip,   setShowTip]   = useState(false)
  const [enriching, setEnriching] = useState(false)
  const { updateItem }            = useFridgeStore()
  const status = expiryStatus(item.expiry_date)
  const label  = expiryLabel(item.expiry_date)

  const handleEnrich = async (data: import('../../lib/claude').EnrichmentFromPhoto) => {
    await updateItem(item.id, {
      expiry_date:       data.expiry_date,
      calories_per_100g: data.calories_per_100g,
      protein_g:         data.protein_g,
      carbs_g:           data.carbs_g,
      fat_g:             data.fat_g,
      conservation_tip:  data.conservation_tip ?? item.conservation_tip,
    })
    setEnriching(false)
  }

  return (
    <div className={`border rounded-xl p-4 transition-all ${STATUS_COLORS[status]}`}>

      {/* Fila principal: info + botones */}
      <div className="flex items-start justify-between gap-3">

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-text">{item.name}</span>
            <span className="text-xs text-muted">{LOCATION_ICONS[item.location]} {item.category}</span>
          </div>

          {(item.quantity || item.unit) && (
            <p className="text-sm text-muted mt-0.5">{item.quantity} {item.unit}</p>
          )}

          {label && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[status]}`} />
              <span className={`text-xs font-medium ${
                status === 'expired' || status === 'critical' ? 'text-red-600' :
                status === 'warning' ? 'text-yellow-700' : 'text-muted'
              }`}>{label}</span>
            </div>
          )}

          {item.conservation_tip && (
            <button onClick={() => setShowTip(v => !v)}
              className="text-xs text-accent mt-1.5 hover:underline">
              {showTip ? '▲ Ocultar tip' : '💡 Ver tip de conservación'}
            </button>
          )}
          {showTip && item.conservation_tip && (
            <p className="text-xs text-muted mt-1 italic">{item.conservation_tip}</p>
          )}
        </div>

        {/* Botones */}
        <div className="flex flex-col gap-2 flex-shrink-0">
          <button onClick={() => setEnriching(e => !e)}
            className={`text-sm leading-none transition-colors ${enriching ? 'text-accent' : 'text-muted hover:text-accent'}`}
            title="Foto del producto para agregar nutrición y vencimiento">
            📷
          </button>
          <button onClick={() => onEdit(item)}
            className="text-muted hover:text-accent transition-colors text-sm leading-none">
            ✏️
          </button>
          <button onClick={() => onDelete(item.id)}
            className="text-muted hover:text-error transition-colors text-lg leading-none">
            ×
          </button>
        </div>
      </div>

      {/* Panel de enriquecimiento */}
      {enriching && (
        <div className="mt-3 pt-3 border-t border-border">
          <EnrichFromPhoto
            foodName={item.name}
            onEnrich={handleEnrich}
            onCancel={() => setEnriching(false)}
          />
        </div>
      )}
    </div>
  )
}
