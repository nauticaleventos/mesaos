import { UtensilsCrossed, RefreshCw } from 'lucide-react'
import { useMenuStore, type MenuConfig } from '../../store/menuStore'

interface Props {
  familyId:    string
  healthyMode: boolean
  onGenerar:   () => void
}

interface ToggleRowProps {
  label:    string
  desc?:    string
  checked:  boolean
  onChange: (v: boolean) => void
}

function ToggleRow({ label, desc, checked, onChange }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-border last:border-0">
      <div>
        <p className="text-sm font-medium text-text">{label}</p>
        {desc && <p className="text-xs text-muted mt-0.5">{desc}</p>}
      </div>
      <button type="button" onClick={() => onChange(!checked)}
        className={`w-12 h-6 rounded-full transition-colors relative flex-shrink-0
          ${checked ? 'bg-accent' : 'bg-gray-200'}`}>
        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all
          ${checked ? 'left-6' : 'left-0.5'}`} />
      </button>
    </div>
  )
}

export default function ConfigMenu({ familyId, healthyMode, onGenerar }: Props) {
  const { config, saveConfig, generating, progress } = useMenuStore()

  if (!config) return null

  const update = (key: keyof MenuConfig, val: boolean) =>
    saveConfig(familyId, { [key]: val })

  const ninguna = !config.planear_desayuno && !config.planear_almuerzo && !config.planear_cena && !config.planear_snacks

  return (
    <div className="flex flex-col gap-6 py-4">

      {/* Hero */}
      <div className="flex flex-col items-center gap-3 py-4">
        <div className="w-20 h-20 rounded-3xl flex items-center justify-center"
          style={{ background: 'rgba(231,111,81,0.12)' }}>
          <UtensilsCrossed size={40} color="#E76F51" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-semibold text-text">Menú semanal</h2>
          <p className="text-sm text-muted mt-1">
            Configurá qué comidas planear y la IA genera el menú completo para tu familia.
          </p>
        </div>
      </div>

      {/* Sección: ¿Qué planear? */}
      <div className="card">
        <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">¿Qué comidas planear?</p>
        <ToggleRow label="☀️ Desayuno"    checked={config.planear_desayuno} onChange={v => update('planear_desayuno', v)} />
        <ToggleRow label="🍽️ Almuerzo"   checked={config.planear_almuerzo} onChange={v => update('planear_almuerzo', v)} />
        <ToggleRow label="🌙 Cena"        checked={config.planear_cena}     onChange={v => update('planear_cena', v)} />
        <ToggleRow label="🍎 Snacks"      checked={config.planear_snacks}   onChange={v => update('planear_snacks', v)} />
      </div>

      {/* Sección: Opciones */}
      <div className="card">
        <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Opciones</p>
        <ToggleRow
          label="Distinguir entre semana / fin de semana"
          desc="Entre semana: recetas rápidas. Fin de semana: más elaboradas."
          checked={config.distinguir_finde}
          onChange={v => update('distinguir_finde', v)} />
      </div>

      {/* Modo saludable info */}
      {healthyMode && (
        <div className="p-4 rounded-2xl border border-oliva/40 bg-oliva-claro/50">
          <p className="text-sm font-medium text-oliva">🥗 Modo saludable activo</p>
          <p className="text-xs text-muted mt-1">
            Se priorizarán recetas bajo en sodio, bajo azúcar y con alta fibra.
          </p>
        </div>
      )}

      {/* Warning si ninguna comida seleccionada */}
      {ninguna && (
        <div className="p-4 rounded-2xl border border-advertencia/40 bg-advertencia/10">
          <p className="text-sm text-advertencia font-medium">⚠️ Seleccioná al menos una comida para generar el menú.</p>
        </div>
      )}

      {/* Progress durante generación */}
      {generating && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">Generando menú…</span>
            <span className="text-accent font-semibold">{progress}%</span>
          </div>
          <div className="w-full bg-border rounded-full h-2">
            <div className="h-2 rounded-full bg-accent transition-all duration-300"
              style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs text-muted text-center">
            {progress < 35 ? 'Cargando recetas y restricciones…'
              : progress < 65 ? 'Analizando preferencias y sugerencias…'
              : progress < 85 ? 'Calculando el menú óptimo…'
              : 'Guardando…'}
          </p>
        </div>
      )}

      {/* Botón generar */}
      {!generating && (
        <button onClick={onGenerar} disabled={ninguna}
          className="btn-primary flex items-center justify-center gap-2">
          <RefreshCw size={18} />
          Generar mi menú semanal
        </button>
      )}
    </div>
  )
}
