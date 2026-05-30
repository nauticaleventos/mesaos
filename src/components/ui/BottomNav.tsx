import { useNavigate, useLocation } from 'react-router-dom'
import { Home, BookOpen, UtensilsCrossed, ShoppingCart, Apple } from 'lucide-react'

const TABS = [
  { path: '/',         icon: Home,            label: 'Inicio'    },
  { path: '/recetas',  icon: BookOpen,         label: 'Recetas'   },
  { path: '/menu',     icon: UtensilsCrossed,  label: 'Menú'      },
  { path: '/mercado',  icon: ShoppingCart,     label: 'Mercado'   },
  { path: '/lonchera', icon: Apple,            label: 'Lonchera'  },
]

const DISABLED: string[] = []

export default function BottomNav() {
  const navigate  = useNavigate()
  const { pathname } = useLocation()

  return (
    <nav
      style={{
        position:        'fixed',
        bottom:          0,
        left:            0,
        right:           0,
        height:          '64px',
        background:      '#FFFFFF',
        borderTop:       '1px solid rgba(44,44,42,0.08)',
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'space-around',
        zIndex:          50,
        paddingBottom:   'env(safe-area-inset-bottom)',
      }}
    >
      {TABS.map(({ path, icon: Icon, label }) => {
        const active   = pathname === path
        const disabled = DISABLED.includes(path)
        const color    = active ? '#E76F51' : disabled ? '#C8C7C3' : '#888780'

        return (
          <button
            key={path}
            onClick={() => !disabled && navigate(path)}
            disabled={disabled}
            style={{
              flex:            1,
              display:         'flex',
              flexDirection:   'column',
              alignItems:      'center',
              justifyContent:  'center',
              gap:             '3px',
              border:          'none',
              background:      'transparent',
              cursor:          disabled ? 'not-allowed' : 'pointer',
              padding:         '6px 0',
              opacity:         disabled ? 0.45 : 1,
            }}
          >
            <Icon size={22} color={color} strokeWidth={active ? 2.2 : 1.8} />
            <span style={{ fontSize: '10px', color, fontWeight: active ? 600 : 400, lineHeight: 1 }}>
              {label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
