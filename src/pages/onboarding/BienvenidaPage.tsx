import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { supabase } from '../../lib/supabase'
import { useFamilyStore } from '../../store/familyStore'

const PASOS = [
  {
    texto: [
      'Hago el trabajo invisible que la cuidadora ha hecho durante años — pensar qué comen mañana, organizar la nevera, planear las compras.',
      'No conozco a tu familia como tú. Pero te quito la carga mental para que tú la cuides y la ames con más tiempo y menos cansancio.',
    ],
  },
  {
    texto: [
      'Soy tu app para gestionar el tiempo en la cocina, optimizar las compras y pensar menos en qué van a comer mañana — para que tú disfrutes de lo que más te gusta.',
      'Entiendo que da pereza llenar tanta información y meter recetas. Por eso ya tengo recetas base listas para ti. Pero si me ayudas y vas agregando las tuyas cuando las veas en redes — solo pegando el link — voy a ser mucho más eficiente.',
      'Y mientras más me cuentes de tu familia, más acertados serán mis menús. Menos fallas. Menos tiempo organizando. Más tiempo para lo que importa.',
    ],
  },
  {
    texto: [
      'Vamos para que tengas menos tiempo pensando qué cocinar\ny más tiempo disfrutando de lo que solo tú sabes hacer.',
      'Con amor,\nTita 💛',
    ],
  },
]

function lsKey(userId: string) { return `bienvenida_step_${userId}` }

function initialStep(userId: string): number {
  const saved = localStorage.getItem(lsKey(userId))
  if (!saved || saved === 'done') return 1
  const n = parseInt(saved)
  return isNaN(n) ? 1 : Math.min(Math.max(n, 1), 3)
}

async function marcarVista(userId: string) {
  localStorage.setItem(lsKey(userId), 'done')
  // Marcar en BD si ya existe la familia del usuario
  const { data: fam } = await supabase
    .from('families')
    .select('id')
    .eq('owner_user_id', userId)
    .maybeSingle()
  if (fam?.id) {
    await supabase.from('families').update({ bienvenida_vista: true }).eq('id', fam.id)
  }
}

export default function BienvenidaPage() {
  const session        = useAuthStore(s => s.session)
  const family         = useFamilyStore(s => s.family)
  const navigate       = useNavigate()
  const [searchParams] = useSearchParams()
  const isPreview      = searchParams.has('preview')
  const userId         = session?.user?.id ?? ''

  const [paso, setPaso] = useState<number>(() => initialStep(userId))

  // Redirigir si ya tiene familia, excepto en modo preview
  if (family && !isPreview) { navigate('/', { replace: true }); return null }

  const avanzar = () => {
    if (paso < 3) {
      const next = paso + 1
      setPaso(next)
      localStorage.setItem(lsKey(userId), String(next))
    } else {
      completar()
    }
  }

  const completar = async () => {
    if (isPreview) { navigate('/', { replace: true }); return }
    await marcarVista(userId)
    navigate('/onboarding', { replace: true })
  }

  const paso0 = PASOS[paso - 1]
  const esUltimo = paso === 3

  return (
    <div className="min-h-screen flex flex-col px-6 py-8"
         style={{ background: 'linear-gradient(160deg, #fffbf0 0%, #fff9ec 60%, #fffdf5 100%)' }}>

      {/* Header: puntos + saltar */}
      <div className="flex items-center justify-between mb-8">
        {/* Indicador de pasos */}
        <div className="flex items-center gap-2">
          {[1, 2, 3].map(n => (
            <div key={n}
              className="rounded-full transition-all duration-300"
              style={{
                width:  n === paso ? 20 : 8,
                height: 8,
                background: n === paso ? '#E76F51' : '#E76F5140',
              }}
            />
          ))}
        </div>

        {/* Saltar (solo pasos 1 y 2) */}
        {!esUltimo && (
          <button onClick={completar}
            className="text-xs text-muted hover:text-text transition-colors font-medium">
            Saltar
          </button>
        )}
      </div>

      {/* Contenido central */}
      <div className="flex-1 flex flex-col justify-center">

        {/* Avatar de Tita */}
        <div className="flex justify-center mb-8">
          <div className="w-20 h-20 rounded-full flex items-center justify-center text-4xl"
               style={{ background: '#FFF3E0', border: '3px solid #E76F5130' }}>
            💛
          </div>
        </div>

        {/* Paso 1: nombre de Tita */}
        {paso === 1 && (
          <h1 className="text-2xl font-serif text-center mb-6"
              style={{ color: '#E76F51' }}>
            Hola, soy Tita.
          </h1>
        )}

        {/* Texto del paso */}
        <div className="flex flex-col gap-4">
          {paso0.texto.map((parrafo, i) => (
            <p key={i}
               className={`text-center leading-relaxed whitespace-pre-line ${
                 paso === 3 && i === 1
                   ? 'font-serif text-lg'
                   : 'text-text'
               }`}
               style={{ fontSize: paso === 3 && i === 0 ? 17 : 15, color: paso === 3 && i === 1 ? '#E76F51' : undefined }}>
              {parrafo}
            </p>
          ))}
        </div>
      </div>

      {/* Botón de acción */}
      <div className="pt-8 pb-4">
        <button
          onClick={avanzar}
          className="w-full btn-primary flex items-center justify-center gap-2 py-4 text-base font-semibold">
          {esUltimo ? 'Empecemos →' : 'Continuar →'}
        </button>
      </div>
    </div>
  )
}
