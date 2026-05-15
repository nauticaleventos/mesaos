import { useEffect } from 'react'
import { useFamilyStore }       from '../store/familyStore'
import { useShoppingListStore } from '../store/shoppingListStore'

const PASILLOS: Record<string, { emoji: string; label: string }> = {
  frutas_verduras:    { emoji: '🥬', label: 'Frutas y verduras' },
  carniceria:         { emoji: '🥩', label: 'Carnicería' },
  pescaderia:         { emoji: '🐟', label: 'Pescadería' },
  lacteos_huevos:     { emoji: '🥛', label: 'Lácteos y huevos' },
  panaderia:          { emoji: '🥖', label: 'Panadería' },
  congelados:         { emoji: '🧊', label: 'Congelados' },
  granos_pastas:      { emoji: '🌾', label: 'Granos y pastas' },
  enlatados:          { emoji: '🥫', label: 'Enlatados' },
  aceites_condimentos:{ emoji: '🫒', label: 'Aceites y condimentos' },
  snacks_dulces:      { emoji: '🍬', label: 'Snacks y dulces' },
  bebidas:            { emoji: '🥤', label: 'Bebidas' },
  aseo_hogar:         { emoji: '🧼', label: 'Aseo' },
  otros:              { emoji: '📦', label: 'Otros' },
}

export default function MercadoImprimir() {
  const { family } = useFamilyStore()
  const { items, loadList } = useShoppingListStore()

  useEffect(() => {
    if (family?.id) loadList(family.id).then(() => setTimeout(() => window.print(), 800))
  }, [family?.id])

  const faltantes = items.filter(i => i.faltante)
  const porPasillo = new Map<string, typeof faltantes>()
  for (const item of faltantes) {
    if (!porPasillo.has(item.categoria_pasillo)) porPasillo.set(item.categoria_pasillo, [])
    porPasillo.get(item.categoria_pasillo)!.push(item)
  }

  const fecha = new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '16px', maxWidth: '148mm', margin: '0 auto', fontSize: '11px' }}>
      <style>{`
        @page { size: A5; margin: 12mm; }
        @media print { body { -webkit-print-color-adjust: exact; } }
        .section-header { background: #f3f4f6; padding: 4px 8px; border-radius: 4px; margin: 10px 0 4px; font-weight: 600; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; }
        .item { display: flex; align-items: flex-start; gap: 8px; padding: 3px 0; border-bottom: 1px solid #f0f0f0; }
        .checkbox { width: 12px; height: 12px; border: 1.5px solid #999; border-radius: 3px; flex-shrink: 0; margin-top: 1px; }
        .item-name { flex: 1; }
        .item-qty { color: #666; white-space: nowrap; }
        h1 { font-size: 16px; margin: 0 0 2px; }
        .subtitle { color: #666; font-size: 10px; margin-bottom: 12px; }
      `}</style>

      <h1>🛒 Lista de mercado</h1>
      <p className="subtitle">{family?.name} · {fecha} · {faltantes.length} items</p>

      {[...porPasillo.entries()].map(([pasillo, pasilloItems]) => {
        const cfg = PASILLOS[pasillo] ?? { emoji: '📦', label: pasillo }
        return (
          <div key={pasillo}>
            <div className="section-header">{cfg.emoji} {cfg.label}</div>
            {pasilloItems.map(item => (
              <div key={item.id} className="item">
                <div className="checkbox" />
                <span className="item-name">{item.ingrediente_nombre}</span>
                {item.cantidad_total > 0 && (
                  <span className="item-qty">{Math.round(item.cantidad_total * 10) / 10} {item.unidad}</span>
                )}
              </div>
            ))}
          </div>
        )
      })}

      <p style={{ marginTop: '16px', color: '#999', fontSize: '9px', textAlign: 'center' }}>
        Generado con mesa.os · {fecha}
      </p>
    </div>
  )
}
