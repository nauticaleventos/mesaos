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

      {/* Frecuencia de cocción */}
      <div className="card flex flex-col gap-4">
        <p className="text-xs font-semibold text-muted uppercase tracking-wider">¿Con qué frecuencia cocinás?</p>
        <div className="flex flex-col gap-2">
          {([
            ['daily',   '🍳 Todos los días',       'Recetas frescas a diario'],
            ['2x_week', '🥘 2–3 veces por semana', 'Batch cooking, recalentás el resto'],
            ['1x_week', '📦 Una vez por semana',    'Todo en un día, servís y emplatás'],
          ] as const).map(([val, label, desc]) => (
            <button key={val} type="button"
              onClick={() => saveConfig(familyId, { cocina_frequency: val })}
              className={`py-2.5 px-4 rounded-xl border-2 text-sm text-left transition-all
                ${(config.cocina_frequency ?? 'daily') === val
                  ? 'border-accent bg-accent-light'
                  : 'border-border'}`}>
              <span className={`font-medium ${(config.cocina_frequency ?? 'daily') === val ? 'text-accent' : 'text-text'}`}>{label}</span>
              <span className="text-muted ml-2 text-xs">{desc}</span>
            </button>
          ))}
        </div>

        {/* Selector de días — solo si no es diario */}
        {(config.cocina_frequency ?? 'daily') !== 'daily' && (() => {
          const DIAS = ['L','M','X','J','V','S','D']
          const seleccionados = config.dias_coccion ?? [1,2,3,4,5,6,7]
          const toggleDia = (d: number) => {
            const actual = config.dias_coccion ?? [1,2,3,4,5,6,7]
            const nuevo  = actual.includes(d) ? actual.filter(x => x !== d) : [...actual, d].sort()
            if (nuevo.length === 0) return // al menos 1 día
            saveConfig(familyId, { dias_coccion: nuevo })
          }
          return (
            <div className="flex flex-col gap-2 pt-1 border-t border-border">
              <p className="text-xs text-muted font-medium">¿Qué días cocinás?</p>
              <div className="flex gap-2">
                {DIAS.map((nombre, i) => {
                  const d = i + 1
                  const activo = seleccionados.includes(d)
                  return (
                    <button key={d} type="button" onClick={() => toggleDia(d)}
                      className={`w-9 h-9 rounded-xl text-xs font-semibold transition-all
                        ${activo ? 'bg-accent text-white' : 'bg-surface border border-border text-muted'}`}>
                      {nombre}
                    </button>
                  )
                })}
              </div>
              <p className="text-[11px] text-muted">
                💡 Los días que no cocinás el motor planea con sobras o recetas muy rápidas (&lt;15 min).
              </p>

              {/* Días especiales */}
              <div className="flex items-center justify-between pt-1">
                <div>
                  <p className="text-xs font-medium text-text">Distinguir días especiales</p>
                  <p className="text-[11px] text-muted">Sabado/domingo: recetas más elaboradas</p>
                </div>
                <button type="button"
                  onClick={() => saveConfig(familyId, { distinguir_dias_especiales: !config.distinguir_dias_especiales })}
                  className={`w-12 h-6 rounded-full transition-colors relative flex-shrink-0
                    ${config.distinguir_dias_especiales ? 'bg-accent' : 'bg-gray-200'}`}>
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all
                    ${config.distinguir_dias_especiales ? 'left-6' : 'left-0.5'}`} />
                </button>
              </div>

              {config.distinguir_dias_especiales && (
                <div className="flex flex-col gap-1.5 pl-1">
                  <p className="text-xs text-muted">¿Cuáles son tus días especiales?</p>
                  <div className="flex gap-2">
                    {DIAS.map((nombre, i) => {
                      const d = i + 1
                      const especiales = config.dias_especiales ?? []
                      const activo = especiales.includes(d)
                      const toggleEspecial = () => {
                        const nuevo = activo ? especiales.filter(x => x !== d) : [...especiales, d].sort()
                        saveConfig(familyId, { dias_especiales: nuevo })
                      }
                      return (
                        <button key={d} type="button" onClick={toggleEspecial}
                          className={`w-9 h-9 rounded-xl text-xs font-semibold transition-all
                            ${activo ? 'bg-oliva text-white' : 'bg-surface border border-border text-muted'}`}>
                          {nombre}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })()}
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
