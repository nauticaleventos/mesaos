/**
 * condicionesMotor.ts
 *
 * Mapeo estático entre condiciones de salud del miembro y filtros nutricionales
 * que deben estar activos en las recetas sugeridas.
 *
 * Filosofía: NO etiquetar recetas como "apta para diabéticos" (responsabilidad legal).
 * En su lugar, usar filtros nutricionales objetivos (bajo_azucar, bajo_sodio, etc.).
 */

export type CondicionSalud =
  | 'anemia'
  | 'celiaquia'
  | 'colesterol_alto'
  | 'diabetes'
  | 'gota'
  | 'higado_graso'
  | 'hipertension'
  | 'intolerancia_lactosa'
  | 'renal'
  | 'reflujo'
  | 'sobrepeso'
  | 'tdah'

export type FiltroNutricional =
  | 'bajo_azucar'
  | 'bajo_carbohidratos'
  | 'alta_fibra'
  | 'bajo_sodio'
  | 'alto_proteina'
  | 'bajo_grasa'
  | 'bajo_potasio'
  | 'bajo_purinas'
  | 'sin_gluten'
  | 'sin_lacteos'

// ── Mapeo canónico condición → filtros requeridos ─────────────────────────────
export const MAPEO_CONDICION_FILTROS: Record<CondicionSalud, FiltroNutricional[]> = {
  anemia:               ['alto_proteina'],
  celiaquia:            ['sin_gluten'],
  colesterol_alto:      ['bajo_grasa', 'alta_fibra'],
  diabetes:             ['bajo_azucar', 'bajo_carbohidratos', 'alta_fibra'],
  gota:                 ['bajo_purinas'],
  higado_graso:         ['bajo_grasa', 'bajo_azucar'],
  hipertension:         ['bajo_sodio'],
  intolerancia_lactosa: ['sin_lacteos'],
  renal:                ['bajo_potasio', 'bajo_sodio'],
  reflujo:              ['bajo_grasa'],
  sobrepeso:            ['bajo_carbohidratos', 'alta_fibra'],
  tdah:                 ['alta_fibra', 'alto_proteina'],
}

// ── Lista UI ordenada alfabéticamente por etiqueta ────────────────────────────
export interface CondicionUI {
  key:    CondicionSalud
  label:  string
}

export const CONDICIONES_UI: CondicionUI[] = [
  { key: 'anemia',               label: 'Anemia'                   },
  { key: 'celiaquia',            label: 'Celiaquía'                },
  { key: 'colesterol_alto',      label: 'Colesterol alto'          },
  { key: 'diabetes',             label: 'Diabetes'                 },
  { key: 'gota',                 label: 'Gota'                     },
  { key: 'higado_graso',         label: 'Hígado graso'             },
  { key: 'hipertension',         label: 'Hipertensión'             },
  { key: 'intolerancia_lactosa', label: 'Intolerancia a la lactosa'},
  { key: 'renal',                label: 'Problemas renales'        },
  { key: 'reflujo',              label: 'Reflujo'                  },
  { key: 'sobrepeso',            label: 'Sobrepeso / obesidad'     },
  { key: 'tdah',                 label: 'TDA/TDAH'                 },
]

// Etiquetas legacy (campo conditions en BD — mantener compatibilidad)
export const LEGACY_LABEL: Record<CondicionSalud, string> = {
  anemia:               'Anemia',
  celiaquia:            'Celiaquía',
  colesterol_alto:      'Colesterol alto',
  diabetes:             'Diabetes',
  gota:                 'Gota',
  higado_graso:         'Hígado graso',
  hipertension:         'Hipertensión',
  intolerancia_lactosa: 'Intolerancia a la lactosa',
  renal:                'Enfermedad renal',
  reflujo:              'Reflujo',
  sobrepeso:            'Sobrepeso / obesidad',
  tdah:                 'TDA/TDAH',
}

/** Devuelve el conjunto deduplicado de filtros requeridos para una lista de condiciones */
export function getFiltrosParaCondiciones(condiciones: string[]): FiltroNutricional[] {
  const set = new Set<FiltroNutricional>()
  for (const c of condiciones) {
    const filtros = MAPEO_CONDICION_FILTROS[c as CondicionSalud]
    if (filtros) filtros.forEach(f => set.add(f))
  }
  return [...set]
}
