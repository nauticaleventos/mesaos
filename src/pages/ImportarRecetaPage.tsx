/**
 * /importar?url=...
 * Punto de entrada para el Shortcut de iOS y el Web Share Target de Android.
 * Recibe un URL, lo analiza con Claude y abre el flujo de importación.
 */
import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useAuthStore }   from '../store/authStore'
import { useFamilyStore } from '../store/familyStore'
import { importFromSocial } from '../lib/claudeImport'
import type { RecipeImport } from '../lib/claudeImport'
import ConfirmacionReceta   from '../components/recipes/import/ConfirmacionReceta'
import ClasificacionWizard  from '../components/recipes/ClasificacionWizard'

type Paso = 'analizando' | 'wizard' | 'confirmar' | 'error' | 'sin_url'

export default function ImportarRecetaPage() {
  const [params]    = useSearchParams()
  const navigate    = useNavigate()
  const { session } = useAuthStore()
  const { family }  = useFamilyStore()

  const [paso, setPaso]   = useState<Paso>('analizando')
  const [receta, setReceta] = useState<RecipeImport | null>(null)
  const [error, setError] = useState<string | null>(null)

  // URL llega del Shortcut iOS o del share_target de Android
  const url = params.get('url') ?? params.get('text') ?? params.get('title') ?? ''

  useEffect(() => {
    if (!session) { navigate(`/login?return=/importar?url=${encodeURIComponent(url)}`); return }
    if (!url.trim()) { setPaso('sin_url'); return }

    importFromSocial(url.trim())
      .then(r => { setReceta(r); setPaso('wizard') })
      .catch(e => { setError(e instanceof Error ? e.message : 'Error al analizar'); setPaso('error') })
  }, [])

  const handleWizardConfirm = (tipoComida: string[], tipoComponente: string) => {
    if (!receta) return
    setReceta({ ...receta, tipo_comida: tipoComida, tipo_componente: tipoComponente } as RecipeImport & { tipo_componente: string })
    setPaso('confirmar')
  }

  const handleSaved = () => navigate('/recetas')

  // ── Sin URL ──────────────────────────────────────────────────────────────────
  if (paso === 'sin_url') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 gap-6 text-center bg-bg">
        <span className="text-5xl">🔗</span>
        <div>
          <p className="font-semibold text-text text-lg">Compartí desde tu red social</p>
          <p className="text-muted text-sm mt-2">
            Esta página recibe links desde Instagram, TikTok, YouTube o cualquier red.
            Usá el Shortcut de iOS o copiá un link y pegalo en el recetario.
          </p>
        </div>
        <button onClick={() => navigate('/recetas')} className="btn-ghost">← Ir al recetario</button>
      </div>
    )
  }

  // ── Analizando ───────────────────────────────────────────────────────────────
  if (paso === 'analizando') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-5 bg-bg">
        <div className="flex gap-1.5">
          {[0, 150, 300].map(d => (
            <span key={d} className="w-3 h-3 rounded-full bg-accent animate-bounce"
              style={{ animationDelay: `${d}ms` }} />
          ))}
        </div>
        <div className="text-center px-8">
          <p className="font-semibold text-text">Analizando receta…</p>
          <p className="text-sm text-muted mt-1 break-all opacity-60">{url.substring(0, 60)}{url.length > 60 ? '…' : ''}</p>
        </div>
      </div>
    )
  }

  // ── Error ────────────────────────────────────────────────────────────────────
  if (paso === 'error') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 gap-5 text-center bg-bg">
        <span className="text-5xl">😕</span>
        <div>
          <p className="font-semibold text-text">No pude leer la receta</p>
          <p className="text-sm text-muted mt-1">{error}</p>
          <p className="text-xs text-muted mt-3">
            Intentá con "Pegar texto" en el recetario — copiá la descripción del post y pegala.
          </p>
        </div>
        <button onClick={() => navigate('/recetas')} className="btn-primary">Ir al recetario</button>
      </div>
    )
  }

  // ── Wizard ───────────────────────────────────────────────────────────────────
  if (paso === 'wizard' && receta) {
    return (
      <ClasificacionWizard
        titulo="Clasificá esta receta"
        initialTipoComida={(receta.tipo_comida ?? []) as string[]}
        initialTipoComponente={(receta as RecipeImport & { tipo_componente?: string }).tipo_componente ?? null}
        onConfirm={handleWizardConfirm}
        onClose={() => navigate('/recetas')}
      />
    )
  }

  // ── Confirmar ────────────────────────────────────────────────────────────────
  if (paso === 'confirmar' && receta && family) {
    return (
      <ConfirmacionReceta
        receta={receta}
        familyId={family.id}
        onSaved={handleSaved}
        onBack={() => setPaso('wizard')}
      />
    )
  }

  return null
}
