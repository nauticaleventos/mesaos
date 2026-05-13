import { useState } from 'react'
import { X, Share2, Camera, Link, ClipboardList, PenLine, HelpCircle } from 'lucide-react'
import type { RecipeImport } from '../../../lib/claudeImport'
import FormaTexto  from './FormaTexto'
import FormaUrl    from './FormaUrl'
import FormaFoto   from './FormaFoto'
import FormaSocial from './FormaSocial'
import FormaManual from './FormaManual'
import ConfirmacionReceta from './ConfirmacionReceta'
import ClasificacionWizard from '../ClasificacionWizard'

type Forma = 'menu' | 'social' | 'foto' | 'url' | 'texto' | 'manual' | 'wizard' | 'confirmar' | 'ayuda'

interface Props {
  familyId: string
  onSaved:  () => void
  onClose:  () => void
}

const OPCIONES = [
  {
    id:       'social' as Forma,
    icon:     Share2,
    titulo:   'Desde redes sociales',
    desc:     'Instagram, TikTok, YouTube, Facebook',
    color:    '#E76F51',
    bg:       '#FFCDB2',
  },
  {
    id:       'foto' as Forma,
    icon:     Camera,
    titulo:   'Subir foto',
    desc:     'Libro, receta impresa, pantalla',
    color:    '#6B7F39',
    bg:       '#DDE5C2',
  },
  {
    id:       'url' as Forma,
    icon:     Link,
    titulo:   'Pegar link web',
    desc:     'Blog de recetas, cualquier sitio',
    color:    '#5C8AA8',
    bg:       '#D0E4F0',
  },
  {
    id:       'texto' as Forma,
    icon:     ClipboardList,
    titulo:   'Pegar texto',
    desc:     'Copiá la receta y pegala',
    color:    '#E8B547',
    bg:       '#FBF0D0',
  },
  {
    id:       'manual' as Forma,
    icon:     PenLine,
    titulo:   'Escribir desde cero',
    desc:     'Receta propia o de memoria',
    color:    '#888780',
    bg:       '#F0EFED',
  },
]

export default function ImportModal({ familyId, onSaved, onClose }: Props) {
  const [forma, setForma]       = useState<Forma>('menu')
  const [receta, setReceta]     = useState<RecipeImport | null>(null)

  const handleExtracted = (r: RecipeImport) => {
    setReceta(r)
    setForma('wizard')  // siempre pasar por wizard primero
  }

  const handleBack = () => {
    setReceta(null)
    setForma('menu')
  }

  const handleWizardConfirm = (tipoComida: string[], tipoComponente: string) => {
    if (!receta) return
    setReceta({ ...receta, tipo_comida: tipoComida, tipo_componente: tipoComponente } as RecipeImport & { tipo_componente: string })
    setForma('confirmar')
  }

  // ── Wizard de clasificación ─────────────────────────────────────────────────
  if (forma === 'wizard' && receta) {
    return (
      <ClasificacionWizard
        titulo="Clasificá esta receta"
        initialTipoComida={(receta.tipo_comida ?? []) as string[]}
        initialTipoComponente={(receta as RecipeImport & { tipo_componente?: string }).tipo_componente ?? null}
        onConfirm={handleWizardConfirm}
        onClose={handleBack}
      />
    )
  }

  // ── Confirmación completa ───────────────────────────────────────────────────
  if (forma === 'confirmar' && receta) {
    return (
      <ConfirmacionReceta
        receta={receta}
        familyId={familyId}
        onSaved={onSaved}
        onBack={() => setForma('wizard')}
      />
    )
  }

  // ── Pantalla de ayuda ────────────────────────────────────────────────────────
  if (forma === 'ayuda') {
    return (
      <ModalWrap onClose={onClose} titulo="¿Cómo importar?">
        <div className="flex flex-col gap-3">
          {[
            { icon: '📱', titulo: 'Instagram / TikTok / YouTube', desc: 'Abrí el post, tocá compartir y elegí mesa.os.' },
            { icon: '📷', titulo: 'Desde una foto', desc: 'Foto del libro, receta impresa o pantalla de otro celular.' },
            { icon: '🌐', titulo: 'Desde la web', desc: 'Pegá el link de cualquier blog o página de recetas.' },
            { icon: '📋', titulo: 'Pegar texto', desc: 'Copiá la receta de donde sea y pegala aquí.' },
            { icon: '✏️', titulo: 'Escribir desde cero', desc: 'Para recetas propias o de memoria.' },
          ].map(({ icon, titulo, desc }) => (
            <div key={titulo} className="flex gap-3 p-3 rounded-xl border border-border bg-white">
              <span className="text-2xl flex-shrink-0">{icon}</span>
              <div>
                <p className="text-sm font-semibold text-text">{titulo}</p>
                <p className="text-xs text-muted mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>
        <button onClick={() => setForma('menu')} className="btn-ghost mt-2">← Volver</button>
      </ModalWrap>
    )
  }

  // ── Formas individuales ─────────────────────────────────────────────────────
  if (forma === 'social') return <FormaSocial onExtracted={handleExtracted} onBack={handleBack} />
  if (forma === 'foto')   return <FormaFoto   onExtracted={handleExtracted} onBack={handleBack} />
  if (forma === 'url')    return <FormaUrl     onExtracted={handleExtracted} onBack={handleBack}
                                              onGoToTexto={() => setForma('texto')}
                                              onGoToFoto={() => setForma('foto')} />
  if (forma === 'texto')  return <FormaTexto   onExtracted={handleExtracted} onBack={handleBack} />
  if (forma === 'manual') return <FormaManual  onExtracted={handleExtracted} onBack={handleBack} />

  // ── Menú principal ──────────────────────────────────────────────────────────
  return (
    <ModalWrap onClose={onClose} titulo="Añadir una receta"
      headerRight={
        <button onClick={() => setForma('ayuda')} className="text-muted hover:text-text transition-colors">
          <HelpCircle size={20} />
        </button>
      }>
      <div className="flex flex-col gap-3">
        {OPCIONES.map(({ id, icon: Icon, titulo, desc, color, bg }) => (
          <button key={id} onClick={() => setForma(id)}
            className="flex items-center gap-4 p-4 rounded-2xl border border-border bg-white hover:border-accent hover:shadow-sm transition-all active:scale-[0.98] text-left">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: bg }}>
              <Icon size={22} color={color} />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-text text-sm">{titulo}</p>
              <p className="text-xs text-muted mt-0.5">{desc}</p>
            </div>
            <span className="text-muted ml-auto flex-shrink-0">›</span>
          </button>
        ))}
      </div>
    </ModalWrap>
  )
}

// ── ModalWrap — contenedor base ──────────────────────────────────────────────
export function ModalWrap({ children, onClose, titulo, headerRight }: {
  children:    React.ReactNode
  onClose?:    () => void
  titulo:      string
  headerRight?: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#FBF5E5' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-safe-top pt-6 pb-4 border-b border-border bg-white">
        {onClose ? (
          <button onClick={onClose} className="text-muted hover:text-text transition-colors p-1">
            <X size={22} />
          </button>
        ) : <div className="w-8" />}
        <p className="font-semibold text-text">{titulo}</p>
        {headerRight ?? <div className="w-8" />}
      </div>
      {/* Body scrollable */}
      <div className="flex-1 overflow-y-auto px-4 py-5 pb-8">
        {children}
      </div>
    </div>
  )
}
