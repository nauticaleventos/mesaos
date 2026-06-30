import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { RefreshCw, Printer, Leaf, Zap, Share2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useMenuStore } from '../../store/menuStore'
import { useLeftoversStore } from '../../store/leftoversStore'
import { useFamilyStore } from '../../store/familyStore'
import DiaCard from './DiaCard'
import SobradosSheet from './SobradosSheet'
import DiaDificilSheet from './DiaDificilSheet'
import { DAY_NAMES } from '../../lib/motorMenu'

interface Props {
  onRegenerar: () => void
  generating:  boolean
}

export default function VistaMenu({ onRegenerar, generating }: Props) {
  const { menu }                   = useMenuStore()
  const weekActiva                 = useMenuStore(s => s.weekActiva)
  const { family }                 = useFamilyStore()
  const { leftovers, loadLeftovers } = useLeftoversStore()

  const [showSobrados,   setShowSobrados]   = useState(false)
  const [showDiaDificil, setShowDiaDificil] = useState(false)
  const [sharing,        setSharing]        = useState(false)
  const [shareUrl,       setShareUrl]       = useState<string | null>(null)
  const [shareError,     setShareError]     = useState<string | null>(null)
  const [copied,         setCopied]         = useState(false)

  const compartirMenu = async () => {
    if (!family?.id) return
    setSharing(true)
    setShareError(null)
    try {
      const ws = weekActiva
      const token = crypto.randomUUID().replace(/-/g, '')
      const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      const { error } = await supabase.from('shared_menus').insert({
        family_id: family.id, week_start: ws, token, expires_at: expires,
      })
      if (error) {
        setShareError('No se pudo generar el link. Intentá de nuevo.')
      } else {
        setShareUrl(`${window.location.origin}/menu/compartido/${token}`)
      }
    } catch {
      setShareError('Error al generar el link.')
    }
    setSharing(false)
  }

  const copiarLink = async () => {
    if (!shareUrl) return
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Cargar sobrantes al montar
  useEffect(() => {
    if (family?.id) loadLeftovers(family.id)
  }, [family?.id, loadLeftovers])

  // Construir las 7 fechas de la semana
  const monday = new Date(weekActiva + 'T12:00:00')
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })

  const byDay = (day: number) => menu.filter(e => e.day_of_week === day)

  // Estadísticas rápidas
  const cocinadas = menu.filter(e => e.is_main_recipe && e.status === 'cooked').length
  const planeadas = menu.filter(e => e.is_main_recipe).length

  // Mostrar banner mid-semana: miércoles (3), jueves (4) o viernes (5)
  const todayDow = new Date().getDay()  // 0=dom, 3=mié, 4=jue, 5=vie
  const isMidWeek = todayDow >= 3 && todayDow <= 5
  const showSobradosBanner = isMidWeek && planeadas > 0

  return (
    <div className="flex flex-col gap-4">

      {/* Stats + botones */}
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-text">
            Semana del {days[0].toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
          </p>
          {planeadas > 0 && (
            <p className="text-xs text-muted mt-0.5">
              {cocinadas} de {planeadas} comidas cocinadas
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.open(`/menu/imprimir/${weekActiva}`, '_blank')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-muted text-sm font-medium hover:border-accent hover:text-accent transition-colors print:hidden">
            <Printer size={15} />
          </button>
          <button onClick={compartirMenu} disabled={sharing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-muted text-sm font-medium hover:border-accent hover:text-accent transition-colors print:hidden disabled:opacity-40">
            {sharing ? <span className="w-3.5 h-3.5 border-2 border-muted/40 border-t-muted rounded-full animate-spin" /> : <Share2 size={15} />}
          </button>
          <button onClick={() => setShowDiaDificil(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-yellow-300 text-yellow-600 text-sm font-medium hover:bg-yellow-50 transition-colors print:hidden">
            <Zap size={15} />
            <span>Día difícil</span>
          </button>
          <button onClick={onRegenerar} disabled={generating}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-accent text-accent text-sm font-medium hover:bg-accent/5 transition-colors disabled:opacity-40 print:hidden">
            <RefreshCw size={15} className={generating ? 'animate-spin' : ''} />
            Regenerar
          </button>
        </div>
      </div>

      {/* Progreso semanal */}
      {planeadas > 0 && (
        <div className="flex gap-1">
          {days.map((_d, i) => {
            const dayNum    = i + 1
            const hasCooked = menu.some(e => e.day_of_week === dayNum && e.is_main_recipe && e.status === 'cooked')
            const hasPlanned= menu.some(e => e.day_of_week === dayNum && e.is_main_recipe)
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] text-muted">{DAY_NAMES[dayNum]}</span>
                <div className={`w-full h-1.5 rounded-full ${hasCooked ? 'bg-oliva' : hasPlanned ? 'bg-accent/30' : 'bg-border'}`} />
              </div>
            )
          })}
        </div>
      )}

      {/* Banner sobrantes mid-semana */}
      {showSobradosBanner && (
        <button
          onClick={() => setShowSobrados(true)}
          className="flex items-center gap-3 p-3 rounded-2xl border-2 border-oliva/30 bg-oliva-claro/40 text-left hover:border-oliva/60 transition-colors print:hidden">
          <span className="text-2xl flex-shrink-0">🍗</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-oliva">
              ¿Te sobró algo de esta semana?
            </p>
            <p className="text-xs text-muted mt-0.5">
              {leftovers.length > 0
                ? `Tenés ${leftovers.length} sobrante${leftovers.length > 1 ? 's' : ''} registrado${leftovers.length > 1 ? 's' : ''} · Tocá para editar`
                : 'Registrá proteínas sobrantes para agregar a las ensaladas'}
            </p>
          </div>
          <Leaf size={16} className="text-oliva flex-shrink-0" />
        </button>
      )}

      {/* Acceso a sobras — siempre visible cuando hay menú activo */}
      {!showSobradosBanner && planeadas > 0 && (
        <button
          onClick={() => setShowSobrados(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-oliva/30 bg-oliva-claro/30 text-sm text-oliva font-medium hover:border-oliva/60 transition-colors print:hidden self-start">
          🍗 {leftovers.length > 0
            ? `${leftovers.length} sobrante${leftovers.length > 1 ? 's' : ''} esta semana`
            : 'Registrar sobras'}
        </button>
      )}

      {/* Cards por día */}
      {days.map((_date, i) => (
        <DiaCard
          key={i}
          dayOfWeek={i + 1}
          date={days[i]}
          entries={byDay(i + 1)}
          onAddSobrante={() => setShowSobrados(true)}
        />
      ))}

      {showDiaDificil && <DiaDificilSheet onClose={() => setShowDiaDificil(false)} />}
      {showSobrados   && createPortal(
        <SobradosSheet onClose={() => setShowSobrados(false)} />,
        document.body
      )}

      {/* Error compartir */}
      {shareError && (
        <div className="fixed bottom-24 left-4 right-4 max-w-sm mx-auto bg-red-50 border border-red-200 rounded-2xl px-4 py-3 flex items-center gap-2 z-50">
          <span className="text-sm text-red-700">{shareError}</span>
          <button onClick={() => setShareError(null)} className="ml-auto text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      {/* Modal compartir */}
      {shareUrl && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 px-4 pb-8">
          <div className="card w-full max-w-sm flex flex-col gap-4 p-5">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-text">Compartir menú con el chef</p>
              <button onClick={() => setShareUrl(null)} className="text-muted hover:text-text">✕</button>
            </div>
            <p className="text-xs text-muted">El chef puede ver el menú sin necesitar cuenta. El link expira en 7 días.</p>
            <div className="flex items-center gap-2 p-3 rounded-xl bg-gray-50 border border-border">
              <p className="text-xs text-text flex-1 break-all font-mono">{shareUrl}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={copiarLink} className="btn-primary flex-1">
                {copied ? '✓ Copiado!' : '📋 Copiar link'}
              </button>
              {typeof navigator !== 'undefined' && 'share' in navigator && (
                <button onClick={() => navigator.share({ title: 'Menú semanal', url: shareUrl })}
                  className="btn-ghost flex-1">
                  📤 Compartir
                </button>
              )}
            </div>
            <p className="text-xs text-muted text-center">Podés enviar este link por WhatsApp, email o cualquier app de mensajería.</p>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
