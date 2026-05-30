import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore }   from '../../store/authStore'
import { useFamilyStore } from '../../store/familyStore'
import { useFridgeStore } from '../../store/fridgeStore'
import { useMenuStore }   from '../../store/menuStore'
import { getMondayOfWeek } from '../../lib/motorMenu'
import { calcularNivelNevera } from '../../lib/nivelNevera'
import ConfigMenu from '../../components/menu/ConfigMenu'
import VistaMenu  from '../../components/menu/VistaMenu'
import BottomNav  from '../../components/ui/BottomNav'
import { AdBanner, AdInterstitial, AdRewarded } from '../../components/ads/AdPlaceholders'

export default function MenuPage() {
  const navigate = useNavigate()
  const { session }             = useAuthStore()
  const { family, members }     = useFamilyStore()
  const { items: fridgeItems }  = useFridgeStore()
  const { menu, loading, generating, loadConfig, loadMenu, generarMenu } = useMenuStore()

  const [error, setError]       = useState<string | null>(null)
  const [confirmar, setConfirmar] = useState(false)
  const [showAd, setShowAd]     = useState(false)

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
    else setShowAd(true)
  }

  if (!session || !family) return null

  return (
    <div className="min-h-screen pb-28 max-w-lg mx-auto overflow-x-hidden">
      <BottomNav />
      {showAd && <AdInterstitial onClose={() => setShowAd(false)} />}

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
            {/* Banner publicitario footer */}
            <div className="mb-4">
              <AdBanner />
            </div>

            {/* Si no hay menú generado: mostrar config */}
            {!tieneMenu && !loading && (
              <>
                <ConfigMenu
                  familyId={family.id}
                  healthyMode={healthyMode}
                  onGenerar={handleGenerar}
                />
                <div className="mt-3">
                  <AdRewarded onWatch={() => {/* TODO: conectar SDK */}} />
                </div>
              </>
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
              <>
                <WidgetNevera fridgeItems={fridgeItems} menu={menu} />
                <VistaMenu
                  onRegenerar={handleGenerar}
                  generating={generating}
                />
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function WidgetNevera({ fridgeItems, menu }: { fridgeItems: import('../../store/fridgeStore').FridgeItem[]; menu: import('../../store/menuStore').EnrichedMenuEntry[] }) {
  const [expandido, setExpandido] = React.useState(false)
  const nivel = calcularNivelNevera(fridgeItems)
  const nv    = nivel.porcentaje

  // Recetas del menú que tienen al menos 1 ingrediente esencial faltante en nevera
  const mainEntries = menu.filter(e => e.is_main_recipe && e.member_id === null)
  const conFaltantes = mainEntries.filter(e => {
    const ings = e.recipe?.ingredientes ?? []
    if (!ings.length) return false
    const esenciales = ings.filter(i => i.esencial)
    const aVerificar = esenciales.length > 0 ? esenciales : ings.slice(0, 3)
    return aVerificar.some(i => {
      const primeraPalabra = i.nombre.toLowerCase().split(' ')[0]
      return !fridgeItems.some(f => f.name.toLowerCase().includes(primeraPalabra))
    })
  })
  const necesitanCompra = conFaltantes.length

  if (nv >= 60 && necesitanCompra === 0) {
    return (
      <div className="mb-4 px-4 py-3 rounded-2xl bg-oliva/10 border border-oliva/30 flex items-center gap-2">
        <span className="text-base">✅</span>
        <p className="text-xs text-oliva font-medium">Tu menú aprovecha al máximo tu nevera. No necesitás comprar nada.</p>
      </div>
    )
  }
  if (nv >= 60 && necesitanCompra > 0) {
    return (
      <div className="mb-4 rounded-2xl bg-advertencia/10 border border-advertencia/30 overflow-hidden">
        <button
          className="w-full px-4 py-3 flex items-center gap-2 text-left"
          onClick={() => setExpandido(v => !v)}
        >
          <span className="text-base flex-shrink-0">⚠️</span>
          <p className="text-xs text-advertencia font-medium flex-1">
            {necesitanCompra} receta{necesitanCompra > 1 ? 's requieren' : ' requiere'} mercar aunque tu nevera está llena
          </p>
          <span className={`text-advertencia text-xs transition-transform ${expandido ? 'rotate-180' : ''}`}>▾</span>
        </button>
        {expandido && (
          <div className="px-4 pb-3 flex flex-col gap-1 border-t border-advertencia/20">
            {conFaltantes.map(e => (
              <p key={e.id} className="text-xs text-text py-1 border-b border-border/30 last:border-0">
                · {e.recipe?.nombre ?? '—'}
                <span className="text-muted ml-1">({e.meal_type})</span>
              </p>
            ))}
          </div>
        )}
      </div>
    )
  }
  if (nv >= 30) {
    return (
      <div className="mb-4 px-4 py-3 rounded-2xl bg-accent/5 border border-accent/20 flex items-center gap-2">
        <span className="text-base">🛒</span>
        <p className="text-xs text-muted font-medium">Tu menú combina lo que tenés con algunas compras.</p>
      </div>
    )
  }
  return (
    <div className="mb-4 px-4 py-3 rounded-2xl bg-accent/5 border border-accent/20 flex items-center gap-2">
      <span className="text-base">🛒</span>
      <p className="text-xs text-muted font-medium">Tu nevera está casi vacía — el menú requiere mercado.</p>
    </div>
  )
}
