import { useFamilyStore } from '../store/familyStore'
import { useLimiteStore } from '../store/limiteStore'

// Hook compartido para gatear las importaciones con IA por tier (importar_ia).
// Uso: const { gate, consumir } = useImportGate()
//      if (!gate()) return            // antes de llamar a la IA
//      ...import OK... await consumir() // tras el éxito
export function useImportGate() {
  const puedeUsar   = useFamilyStore(s => s.puedeUsar)
  const consumirUso = useFamilyStore(s => s.consumirUso)
  const abrir       = useLimiteStore(s => s.abrir)
  return {
    gate: (): boolean => {
      if (!puedeUsar('importar_ia')) { abrir('importar_ia'); return false }
      return true
    },
    consumir: () => consumirUso('importar_ia'),
  }
}
