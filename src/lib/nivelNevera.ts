import type { FridgeItem } from '../store/fridgeStore'
import { expiryStatus } from '../store/fridgeStore'

export type EstadoNevera = 'vacía' | 'escasa' | 'básica' | 'buena' | 'completa'

export interface NivelNevera {
  porcentaje:          number        // 0-100
  estado:              EstadoNevera
  categoriasFaltantes: string[]      // categorías importantes sin representar
  alertasVencimiento:  number        // items vencidos o por vencer en 3 días
  resumen:             string        // frase corta para mostrar al usuario
}

// Categorías importantes ordenadas por prioridad
const CATEGORIAS_IMPORTANTES: { key: string; label: string; peso: number }[] = [
  { key: 'proteína',             label: 'proteínas',    peso: 20 },
  { key: 'frutas y verduras',    label: 'frutas y verduras', peso: 20 },
  { key: 'lácteos',              label: 'lácteos',      peso: 15 },
  { key: 'granos y cereales',    label: 'granos',       peso: 15 },
  { key: 'salsas y condimentos', label: 'condimentos',  peso: 10 },
  { key: 'bebidas',              label: 'bebidas',      peso: 5  },
  { key: 'snacks',               label: 'snacks',       peso: 5  },
]

export function calcularNivelNevera(items: FridgeItem[]): NivelNevera {
  const activos = items.filter(i => expiryStatus(i.expiry_date) !== 'expired')

  // Alertas de vencimiento (vencido o crítico ≤2 días)
  const alertasVencimiento = items.filter(i => {
    const s = expiryStatus(i.expiry_date)
    return s === 'expired' || s === 'critical'
  }).length

  // Calcular puntaje por cobertura de categorías
  const categoriasPresentes = new Set(activos.map(i => i.category))
  let puntaje = 0
  const faltantes: string[] = []

  for (const cat of CATEGORIAS_IMPORTANTES) {
    if (categoriasPresentes.has(cat.key)) {
      puntaje += cat.peso
    } else {
      faltantes.push(cat.label)
    }
  }

  // Bonus por cantidad de items (máx 10 puntos extra)
  const bonusItems = Math.min(activos.length * 1, 10)
  puntaje = Math.min(puntaje + bonusItems, 100)

  // Penalización leve por vencimientos
  puntaje = Math.max(0, puntaje - alertasVencimiento * 3)

  // Estado
  let estado: EstadoNevera
  if (puntaje === 0 || activos.length === 0) estado = 'vacía'
  else if (puntaje < 25)  estado = 'escasa'
  else if (puntaje < 50)  estado = 'básica'
  else if (puntaje < 75)  estado = 'buena'
  else                    estado = 'completa'

  // Resumen
  let resumen = ''
  if (estado === 'vacía')    resumen = 'La nevera está vacía 😬'
  else if (estado === 'escasa')  resumen = 'Nevera muy escasa — toca ir al mercado'
  else if (estado === 'básica')  resumen = 'Lo básico, pero faltan cosas'
  else if (estado === 'buena')   resumen = 'Nevera bien surtida 👍'
  else                           resumen = 'Nevera completa ✨'

  return {
    porcentaje: Math.round(puntaje),
    estado,
    categoriasFaltantes: faltantes.slice(0, 3), // máx 3 para no abrumar
    alertasVencimiento,
    resumen,
  }
}
