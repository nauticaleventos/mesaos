import { useLimiteStore } from '../../store/limiteStore'
import { useFamilyStore } from '../../store/familyStore'
import type { Action } from '../../lib/tiers'

const ACCION_LABEL: Record<string, string> = {
  generar_menu:   'generaciones de menú',
  multi_semana:   'menú multi-semana',
  chat_tita:      'chats con Tita',
  importar_ia:    'importaciones con IA',
  fotos_nevera:   'fotos de nevera',
  cambios_receta: 'cambios de receta',
  lonchera:       'loncheras',
}

const BENEFICIOS = [
  { plan: 'Plus', emoji: '⭐', items: ['4 menús/mes', 'Importaciones ilimitadas', 'Cambios de receta ilimitados', 'Loncheras ilimitadas', '50 chats con Tita'] },
  { plan: 'Pro',  emoji: '👑', items: ['Todo ilimitado', 'Menú multi-semana (2 y 4 semanas)', 'Lonchera personalizada', 'Meal prep completo', 'Dashboard de ahorro', 'Modo presupuesto'] },
]

export default function LimitModal() {
  const { accion, modo, cerrar } = useLimiteStore()
  const tier = useFamilyStore(s => s.tierActual())
  if (!accion) return null

  const label = ACCION_LABEL[accion as Action] ?? 'esta función'
  const esInfo = modo === 'info'

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-[60] px-4 pb-6" onClick={cerrar}>
      <div className="card w-full max-w-sm flex flex-col gap-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="text-center">
          <p className="text-3xl">{esInfo ? '✨' : '🔒'}</p>
          <h2 className="text-lg font-serif font-semibold text-text mt-1">
            {esInfo ? 'Beneficios de los planes' : `Llegaste al límite de tu plan ${tier === 'free' ? 'Free' : tier === 'plus' ? 'Plus' : 'Pro'}`}
          </h2>
          {!esInfo && <p className="text-sm text-muted mt-1">Te quedaste sin {label} este mes.</p>}
        </div>

        <div className="flex flex-col gap-3">
          {BENEFICIOS.map(b => (
            <div key={b.plan} className="border border-border rounded-xl p-3">
              <p className="text-sm font-semibold text-text mb-1.5">{b.emoji} {b.plan} desbloquea</p>
              <ul className="flex flex-col gap-1">
                {b.items.map(it => <li key={it} className="text-xs text-muted flex items-start gap-1.5"><span className="text-accent">✓</span>{it}</li>)}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <button onClick={() => { cerrar(); /* TODO: pantalla de planes */ }} className="btn-primary">Ver planes</button>
          {tier === 'free' && accion === 'generar_menu' && (
            <button onClick={cerrar} className="btn-ghost text-accent" title="Disponible pronto">
              🎁 Ganar más generaciones gratis (pronto)
            </button>
          )}
          <button onClick={cerrar} className="text-sm text-muted py-1">Cerrar</button>
        </div>
      </div>
    </div>
  )
}
