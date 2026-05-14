/**
 * RecipePlaceholder
 * Placeholder estilizado cuando una receta no tiene foto.
 * Se usa donde antes había un ChefHat icon vacío.
 */

interface Props {
  tipo?:      string | null
  nombre?:    string | null
  showName?:  boolean   // false en thumbnails pequeños
  className?: string
}

// Configuración visual por tipo_componente
const CONFIG: Record<string, { fromColor: string; toColor: string; icon: string }> = {
  proteina_principal: { fromColor: '#FFE8D6', toColor: '#FFCBA4', icon: '🍗' },
  ensalada:           { fromColor: '#D8EDDA', toColor: '#B2D8B8', icon: '🥗' },
  guarnicion:         { fromColor: '#FFF5D0', toColor: '#FFE599', icon: '🍚' },
  postre:             { fromColor: '#FAD8E4', toColor: '#F5B3C8', icon: '🧁' },
  salsa:              { fromColor: '#FFE0D6', toColor: '#FFC0A8', icon: '🥄' },
  vinagreta:          { fromColor: '#EEF0CC', toColor: '#D8DB99', icon: '🫙' },
  plato_unico:        { fromColor: '#EDE0D4', toColor: '#D8C4B0', icon: '🍽️' },
  bebida:             { fromColor: '#D4EAF8', toColor: '#A8D0F0', icon: '🥤' },
  merienda:           { fromColor: '#DCF0D8', toColor: '#B8E0B0', icon: '🥪' },
}

const DEFAULT = { fromColor: '#EDE8E0', toColor: '#D8D0C4', icon: '🍴' }

export default function RecipePlaceholder({ tipo, nombre, showName = true, className = '' }: Props) {
  const cfg = (tipo && CONFIG[tipo]) ? CONFIG[tipo] : DEFAULT

  return (
    <div
      className={`relative flex flex-col items-center justify-center overflow-hidden ${className}`}
      style={{ background: `linear-gradient(135deg, ${cfg.fromColor} 0%, ${cfg.toColor} 100%)` }}
    >
      {/* Círculo decorativo de fondo */}
      <div
        className="absolute rounded-full opacity-20"
        style={{
          width: '70%',
          paddingBottom: '70%',
          background: cfg.toColor,
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      />

      {/* Icono */}
      <span
        className="relative select-none leading-none"
        style={{ fontSize: showName ? 'clamp(2rem, 8cqw, 3.5rem)' : 'clamp(1.25rem, 5cqw, 2rem)' }}
        aria-hidden
      >
        {cfg.icon}
      </span>

      {/* Nombre (solo cuando showName=true y hay nombre) */}
      {showName && nombre && (
        <p
          className="relative mt-2 px-3 text-center font-semibold leading-tight"
          style={{
            color: '#3D3530',
            fontSize: 'clamp(0.65rem, 2.5cqw, 0.9rem)',
            maxWidth: '90%',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {nombre}
        </p>
      )}
    </div>
  )
}
