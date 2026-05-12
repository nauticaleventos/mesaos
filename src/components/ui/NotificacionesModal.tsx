import { useState } from 'react'
import { Bell, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'

interface Props {
  userId:   string
  familyId: string
  onClose:  () => void
}

export default function NotificacionesModal({ userId, familyId, onClose }: Props) {
  const [cargando, setCargando] = useState(false)

  const activar = async () => {
    setCargando(true)
    try {
      const permiso = await Notification.requestPermission()
      const activas = permiso === 'granted'

      await supabase.from('user_preferences').upsert({
        user_id:                  userId,
        family_id:                familyId,
        notificaciones_activas:   activas,
        notif_recordatorio_dom:   activas,
        notif_inventario_bajo:    activas,
        updated_at:               new Date().toISOString(),
      }, { onConflict: 'user_id' })

    } catch (err) {
      console.error('Error al activar notificaciones:', err)
    }
    setCargando(false)
    onClose()
  }

  const rechazar = async () => {
    await supabase.from('user_preferences').upsert({
      user_id:                  userId,
      family_id:                familyId,
      notificaciones_activas:   false,
      notif_recordatorio_dom:   false,
      notif_inventario_bajo:    false,
      updated_at:               new Date().toISOString(),
    }, { onConflict: 'user_id' })
    onClose()
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={rechazar} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-surface rounded-t-2xl shadow-xl p-6 pb-10">
        <button onClick={rechazar} className="absolute top-4 right-4 p-1.5 rounded-xl hover:bg-gray-100">
          <X size={18} className="text-muted" />
        </button>

        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center">
            <Bell size={26} color="#E76F51" />
          </div>

          <div>
            <p className="font-semibold text-text text-lg">Quiero ayudarte mejor</p>
            <p className="text-muted text-sm mt-1">
              ¿Puedo enviarte un recordatorio los domingos en la mañana?
            </p>
          </div>

          <div className="w-full text-left bg-surface border border-border rounded-xl p-4 flex flex-col gap-2">
            <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">Te aviso cuando:</p>
            {[
              '🗓️ Tu semana va a arrancar — te armo el menú',
              '🧊 Te quedan pocos ingredientes en nevera',
              '🛒 Es buen momento para ir a mercar',
            ].map((t, i) => (
              <p key={i} className="text-sm text-text">{t}</p>
            ))}
          </div>

          <div className="flex flex-col gap-2 w-full pt-1">
            <button onClick={activar} disabled={cargando}
              className="btn-primary flex items-center justify-center gap-2">
              <Bell size={16} />
              {cargando ? 'Activando…' : 'Sí, ayúdame'}
            </button>
            <button onClick={rechazar} className="btn-ghost text-sm">
              No, gracias
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
