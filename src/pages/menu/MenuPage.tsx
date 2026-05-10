import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore }   from '../../store/authStore'
import { useFamilyStore } from '../../store/familyStore'
import { useFridgeStore } from '../../store/fridgeStore'
import { useMenuStore }   from '../../store/menuStore'
import { getMondayOfWeek } from '../../lib/motorMenu'
import ConfigMenu from '../../components/menu/ConfigMenu'
import VistaMenu  from '../../components/menu/VistaMenu'
import BottomNav  from '../../components/ui/BottomNav'

export default function MenuPage() {
  const navigate = useNavigate()
  const { session }             = useAuthStore()
  const { family, members }     = useFamilyStore()
  const { items: fridgeItems }  = useFridgeStore()
  const { menu, loading, generating, loadConfig, loadMenu, generarMenu } = useMenuStore()

  const [error, setError]       = useState<string | null>(null)
  const [confirmar, setConfirmar] = useState(false)

  const healthyMode = family?.healthy_mode_active ?? false
  const weekStart   = getMondayOfWeek()
  const tieneMenu   = menu.some(e => e.is_main_recipe)

  useEffect(() => {
    if (!family?.id) return
    loadConfig(family.id)
    loadMenu(family.id, weekStart)
  }, [family?.id])

  const handleGenerar = async () => {
    if (!family?.id) return
    if (tieneMenu && !confirmar) { setConfirmar(true); return }
    setConfirmar(false)
    setError(null)
    const err = await generarMenu(family.id, fridgeItems, healthyMode)
    if (err) setError(err)
  }

  if (!session || !family) return null

  return (
    <div className="min-h-screen pb-28 max-w-lg mx-auto overflow-x-hidden">
      <BottomNav />

      {/* Header */}
      <div className="sticky top-0 bg-bg/95 backdrop-blur z-10 px-4 pt-6 pb-4 border-b border-border">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-text">🍽️ Menú semanal</h1>
          {members.length === 0 && (
            <button onClick={() => navigate('/')} className="text-muted text-sm hover:text-text transition-colors">
              ← Agregar miembros
            </button>
          )}
        </div>
      </div>

      <div className="px-4 py-4">
        {/* Sin miembros */}
        {members.length === 0 && (
          <div className="card flex flex-col items-center gap-4 py-8 text-center">
            <p className="text-4xl">👨‍👩‍👧</p>
            <div>
              <p className="font-semibold text-text">Necesitás agregar miembros</p>
              <p className="text-muted text-sm mt-1">El motor de menú necesita saber quién come en casa.</p>
            </div>
            <button onClick={() => navigate('/')} className="btn-primary max-w-xs">
              Ir a configurar familia
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="p-4 rounded-2xl bg-red-50 border border-red-200 mb-4">
            <p className="text-sm text-error">{error}</p>
            <button onClick={() => setError(null)} className="text-xs text-error/70 mt-1 underline">Cerrar</button>
          </div>
        )}

        {/* Confirmar regenerar */}
        {confirmar && (
          <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50 px-4 pb-8">
            <div className="card w-full max-w-sm flex flex-col gap-4">
              <p className="font-semibold text-text text-center">¿Regenerar el menú?</p>
              <p className="text-muted text-sm text-center">Esto reemplazará el menú actual de esta semana.</p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmar(false)} className="btn-ghost flex-1">Cancelar</button>
                <button onClick={handleGenerar} className="btn-primary flex-1">Sí, regenerar</button>
              </div>
            </div>
          </div>
        )}

        {members.length > 0 && (
          <>
            {/* Si no hay menú generado: mostrar config */}
            {!tieneMenu && !loading && (
              <ConfigMenu
                familyId={family.id}
                healthyMode={healthyMode}
                onGenerar={handleGenerar}
              />
            )}

            {/* Loading inicial */}
            {loading && (
              <div className="flex items-center justify-center py-16 gap-3 text-muted">
                <div className="flex gap-1">
                  {[0,150,300].map(d => (
                    <span key={d} className="w-2 h-2 rounded-full bg-accent animate-bounce"
                      style={{ animationDelay: `${d}ms` }} />
                  ))}
                </div>
                <span className="text-sm">Cargando menú…</span>
              </div>
            )}

            {/* Generando */}
            {generating && !tieneMenu && (
              <ConfigMenu
                familyId={family.id}
                healthyMode={healthyMode}
                onGenerar={handleGenerar}
              />
            )}

            {/* Menú generado */}
            {tieneMenu && !loading && (
              <VistaMenu
                onRegenerar={handleGenerar}
                generating={generating}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}
