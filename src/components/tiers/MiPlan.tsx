import { useFamilyStore } from '../../store/familyStore'
import { useLimiteStore } from '../../store/limiteStore'
import { usoMes, limiteDe, diasRestantesTrial, type Action } from '../../lib/tiers'

const TIER_INFO: Record<string, { label: string; emoji: string; color: string }> = {
  free: { label: 'Free', emoji: '🆓', color: 'text-muted' },
  plus: { label: 'Plus', emoji: '⭐', color: 'text-accent' },
  pro:  { label: 'Pro',  emoji: '👑', color: 'text-amber-600' },
}

// Acciones contadas que mostramos con barra de progreso.
const ACCIONES_UI: { key: Action; label: string }[] = [
  { key: 'generar_menu',   label: 'Menús generados' },
  { key: 'importar_ia',    label: 'Importaciones IA' },
  { key: 'fotos_nevera',   label: 'Fotos de nevera' },
  { key: 'cambios_receta', label: 'Cambios de receta' },
  { key: 'lonchera',       label: 'Loncheras' },
]

export default function MiPlan() {
  const family = useFamilyStore(s => s.family)
  const tier   = useFamilyStore(s => s.tierActual())
  const abrir  = useLimiteStore(s => s.abrir)
  if (!family) return null

  const uso  = usoMes(family)
  const info = TIER_INFO[tier]
  const dias = diasRestantesTrial(family)

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-text">💳 Mi plan</p>
        <span className={`text-xs font-semibold ${info.color}`}>{info.emoji} {info.label}</span>
      </div>

      {dias > 0 && tier === 'pro' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          <p className="text-xs text-amber-800">✨ Te quedan <b>{dias} día{dias !== 1 ? 's' : ''}</b> de Pro gratis. Probá todas las funciones.</p>
        </div>
      )}

      {/* Uso del mes vs límite (no se muestra para Pro ilimitado) */}
      {tier !== 'pro' && (
        <div className="flex flex-col gap-2.5">
          {ACCIONES_UI.map(({ key, label }) => {
            const lim   = limiteDe(tier, key, family)
            const usado = (uso as unknown as Record<string, number>)[key] ?? 0
            const pct   = lim === Infinity ? 0 : Math.min(100, Math.round((usado / lim) * 100))
            const ilim  = lim === Infinity
            return (
              <div key={key}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs text-muted">{label}</span>
                  <span className="text-[11px] text-muted font-medium">{ilim ? 'Ilimitado' : `${usado} / ${lim}`}</span>
                </div>
                {!ilim && (
                  <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${pct >= 100 ? 'bg-error' : 'bg-accent'}`} style={{ width: `${pct}%` }} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      {tier === 'pro' && (
        <p className="text-xs text-muted">Tenés todo ilimitado y las funciones Pro desbloqueadas. 🎉</p>
      )}

      <button onClick={() => abrir('generar_menu', 'info')} className="text-xs text-accent font-medium text-left">
        Ver beneficios de {tier === 'free' ? 'Plus y Pro' : 'Pro'} →
      </button>
      {tier === 'free' && (
        <button className="text-xs text-muted text-left" title="Disponible pronto">🎁 Ganar más generaciones gratis (pronto)</button>
      )}
    </div>
  )
}
