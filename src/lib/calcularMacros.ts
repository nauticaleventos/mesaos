// Cálculo de calorías y macros — Fórmula Mifflin-St Jeor

export type TipoMiembro  = 'adult' | 'teen' | 'child' | 'pregnant'
export type ObjetivoSimple = 'deficit' | 'mantenimiento' | 'volumen' | 'crecimiento'

export interface InputMacros {
  tipo:      TipoMiembro
  objetivo:  ObjetivoSimple
  peso_kg:   number | null
  altura_cm: number | null
  edad:      number | null
}

export interface ResultadoMacros {
  calorias:    number
  proteinas_g: number
  carbs_g:     number
  grasa_g:     number
  fibra_g:     number
  agua_ml:     number
}

function defaults(tipo: TipoMiembro): { peso: number; altura: number; edad: number } {
  if (tipo === 'child')    return { peso: 25,  altura: 125, edad: 7  }
  if (tipo === 'teen')     return { peso: 58,  altura: 165, edad: 15 }
  if (tipo === 'pregnant') return { peso: 68,  altura: 162, edad: 28 }
  return                          { peso: 70,  altura: 168, edad: 35 }
}

export function calcularMacros(input: InputMacros): ResultadoMacros {
  const def    = defaults(input.tipo)
  const peso   = input.peso_kg   ?? def.peso
  const altura = input.altura_cm ?? def.altura
  const edad   = input.edad      ?? def.edad

  // TMB: promedio M/F de Mifflin-St Jeor
  // Male:   10p + 6.25h − 5e + 5    → −78 es el promedio de +5 y −161
  const tmb = 10 * peso + 6.25 * altura - 5 * edad - 78

  // GET con actividad moderada (×1.4)
  const get = tmb * 1.4

  // Ajuste calórico por objetivo
  let calorias =
    input.objetivo === 'deficit'    ? Math.round(get - 500) :
    input.objetivo === 'volumen'    ? Math.round(get + 300) :
    input.objetivo === 'crecimiento'? Math.round(get + 200) :
    Math.round(get)

  if (input.tipo === 'pregnant') calorias += 300
  calorias = Math.max(calorias, 1200)

  // Distribución macros
  const [pProt, pCarb, pGrasa] =
    input.objetivo === 'deficit'  ? [0.35, 0.30, 0.35] :
    input.objetivo === 'volumen'  ? [0.35, 0.45, 0.20] :
                                    [0.30, 0.40, 0.30]

  return {
    calorias,
    proteinas_g: Math.round((calorias * pProt) / 4),
    carbs_g:     Math.round((calorias * pCarb) / 4),
    grasa_g:     Math.round((calorias * pGrasa) / 9),
    fibra_g:     Math.max(25, Math.round(peso * 0.35)),
    agua_ml:     Math.round(peso * 35),
  }
}
