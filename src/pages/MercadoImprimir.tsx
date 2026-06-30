import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
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
  suplementos:        { emoji: '💪', label: 'Suplementos y proteínas' },
  bebidas:            { emoji: '🥤', label: 'Bebidas' },
  aseo_hogar:         { emoji: '🧼', label: 'Aseo' },
  otros:              { emoji: '📦', label: 'Otros' },
}

export default function MercadoImprimir() {
  const [searchParams] = useSearchParams()

  // ?receta=X  → una receta (desde RecetaPage o modo receta)
  const recetaFiltro = searchParams.get('receta') ? decodeURIComponent(searchParams.get('receta')!) : null
  // ?recetas=A,B,C → próximas N comidas
  const recetasParam = searchParams.get('recetas')
    ? decodeURIComponent(searchParams.get('recetas')!).split(',').filter(Boolean)
    : null
  const nParam   = searchParams.get('n') ?? null
  // ?modo=alfabetico → solo cambia título
  const modoParam = searchParams.get('modo') ?? null
  // ?titulo=... → título dinámico (modo Por semanas)
  const tituloParam = searchParams.get('titulo') ? decodeURIComponent(searchParams.get('titulo')!) : null

  const { family } = useFamilyStore()
  const { items, loadList } = useShoppingListStore()

  useEffect(() => {
    if (family?.id) loadList(family.id).then(() => setTimeout(() => window.print(), 800))
  }, [family?.id])

  const faltantes = items.filter(i => {
    if (!i.faltante) return false
    if (recetaFiltro)  return i.recetas_origen.includes(recetaFiltro)
    if (recetasParam)  return recetasParam.some(r => i.recetas_origen.includes(r))
    return true
  })

  const porPasillo = new Map<string, typeof faltantes>()
  for (const item of faltantes) {
    if (!porPasillo.has(item.categoria_pasillo)) porPasillo.set(item.categoria_pasillo, [])
    porPasillo.get(item.categoria_pasillo)!.push(item)
  }

  const tituloDoc = recetaFiltro  ? `🍽️ Lista para: ${recetaFiltro}`
    : recetasParam                ? `⏰ Próximas ${nParam ?? recetasParam.length} comidas`
    : tituloParam                 ? `🛒 ${tituloParam}`
    : modoParam === 'alfabetico'  ? '🛒 Lista de mercado (A–Z)'
    : '🛒 Lista de mercado'

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
        .brand { display: flex; justify-content: space-between; align-items: center;
          padding-bottom: 7px; margin-bottom: 10px; border-bottom: 2px solid #E76F51; }
        .brand-left { display: flex; align-items: center; gap: 6px; }
        .brand-name { font-size: 16px; font-weight: 800; color: #E76F51; letter-spacing: -0.3px; }
        .brand-sub { font-size: 8px; color: #999; font-style: italic; }
        .brand-right { text-align: right; font-size: 10px; color: #555; }
        .brand-doc { font-size: 13px; font-weight: 700; color: #1a1a1a; }
      `}</style>

      <div className="brand">
        <div className="brand-left">
          <span style={{ fontSize: 18 }}>🍽️</span>
          <div>
            <div className="brand-name">mesa.os</div>
            <div className="brand-sub">Coach de cocina para tu familia</div>
          </div>
        </div>
        <div className="brand-right">
          <div className="brand-doc">{tituloDoc}</div>
          <div>{family?.name} · {fecha} · {faltantes.length} items</div>
        </div>
      </div>

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
