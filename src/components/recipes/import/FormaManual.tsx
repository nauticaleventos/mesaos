import { PenLine } from 'lucide-react'
import { emptyRecipeImport, type RecipeImport } from '../../../lib/claudeImport'
import { ModalWrap } from './ImportModal'

interface Props { onExtracted: (r: RecipeImport) => void; onBack: () => void }

export default function FormaManual({ onExtracted, onBack }: Props) {
  return (
    <ModalWrap titulo="Escribir desde cero">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col items-center gap-3 pt-2 pb-1">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: '#F0EFED' }}>
            <PenLine size={32} color="#888780" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-text">Receta propia o de memoria</p>
            <p className="text-sm text-muted mt-1">
              Se abrirá el formulario en blanco para que completes cada campo a tu ritmo.
            </p>
          </div>
        </div>

        <button onClick={() => onExtracted(emptyRecipeImport())} className="btn-primary">
          Abrir formulario en blanco
        </button>
        <button onClick={onBack} className="btn-ghost">← Volver</button>
      </div>
    </ModalWrap>
  )
}
