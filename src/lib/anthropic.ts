// Mapa de modelos + heurística de selección.
// Tareas complejas (decisión/razonamiento) → Sonnet. Tareas simples (clasificar,
// normalizar, calcular, respuestas directas) → Haiku (más barato y rápido).

export const MODELS = {
  sonnet: 'claude-sonnet-4-6',
  haiku:  'claude-haiku-4-5-20251001',
} as const

export type ModelTier = keyof typeof MODELS

// Heurística para el chat (cuando exista): prompt largo o con verbos de planificación
// → Sonnet; preguntas cortas y directas → Haiku.
export function modeloParaChat(prompt: string): ModelTier {
  const palabras = prompt.trim().split(/\s+/).filter(Boolean).length
  const claves = /(plane|recomend|dise|orden|optimiz|combin|estrateg|presupuest|vegan|vegetarian|sustitu)/i
  return (palabras > 50 || claves.test(prompt)) ? 'sonnet' : 'haiku'
}
