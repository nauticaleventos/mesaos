/**
 * AdPlaceholders — componentes de anuncios (placeholders visuales).
 * Cuando se integre un SDK real (AdMob, Google AdSense, etc.),
 * reemplazar el interior de cada componente sin cambiar la interfaz.
 *
 * IS_FREE: reemplazar por un hook real cuando haya sistema de planes.
 */

import { useEffect } from 'react'

const IS_FREE = true

// ── Banner horizontal 320×50 ──────────────────────────────────────────────────
export function AdBanner() {
  if (!IS_FREE) return null
  return (
    <div style={{
      height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#F3F4F6', border: '1px dashed #D1D5DB', borderRadius: 8,
      fontSize: 11, color: '#9CA3AF', gap: 6, flexShrink: 0,
    }}>
      <span>📱</span>
      <span>Publicidad · 320×50</span>
    </div>
  )
}

// ── Intersticial pantalla completa ────────────────────────────────────────────
export function AdInterstitial({ onClose }: { onClose: () => void }) {
  if (!IS_FREE) return null

  useEffect(() => {
    const t = setTimeout(onClose, 5000)
    return () => clearTimeout(t)
  }, [onClose])

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      zIndex: 200, gap: 16,
    }}>
      <div style={{
        width: '85vw', maxWidth: 320, aspectRatio: '9/16',
        background: '#F9FAFB', borderRadius: 16,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 12, padding: 24,
      }}>
        <span style={{ fontSize: 52 }}>📱</span>
        <p style={{ fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 1.4 }}>
          Espacio publicitario<br />Anuncio intersticial
        </p>
        <p style={{ fontSize: 11, color: '#D1D5DB', textAlign: 'center' }}>
          Solo en plan Free · se cierra solo en 5s
        </p>
      </div>
      <button onClick={onClose} style={{
        color: 'white', fontSize: 13,
        background: 'rgba(255,255,255,0.15)',
        border: '1px solid rgba(255,255,255,0.3)',
        borderRadius: 20, padding: '8px 24px', cursor: 'pointer',
      }}>
        Cerrar ✕
      </button>
    </div>
  )
}

// ── Rewarded video ────────────────────────────────────────────────────────────
export function AdRewarded({ onWatch }: { onWatch?: () => void }) {
  if (!IS_FREE) return null
  return (
    <div style={{
      border: '1.5px dashed #FDB97D', borderRadius: 12,
      padding: '12px 16px', background: '#FFFBF7',
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <span style={{ fontSize: 28, flexShrink: 0 }}>🎬</span>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#92400E', lineHeight: 1.3 }}>
          Mirá un video y desbloqueá 1 generación extra
        </p>
        <p style={{ fontSize: 11, color: '#B45309', marginTop: 3 }}>Gratis · ~30 segundos</p>
      </div>
      <button onClick={onWatch} style={{
        background: '#E76F51', color: 'white',
        border: 'none', borderRadius: 8,
        padding: '8px 14px', fontSize: 12,
        fontWeight: 600, cursor: 'pointer', flexShrink: 0,
      }}>
        Ver ▶
      </button>
    </div>
  )
}

// ── Native card (entre items de lista) ────────────────────────────────────────
export function AdNativeCard() {
  if (!IS_FREE) return null
  return (
    <div style={{
      border: '1px dashed #E5E7EB', borderRadius: 12,
      overflow: 'hidden', marginBottom: 16, background: '#F9FAFB',
    }}>
      <div style={{
        background: '#F3F4F6', padding: '5px 12px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontSize: 9, color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          Patrocinado
        </span>
      </div>
      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 48, height: 48, background: '#E5E7EB', borderRadius: 8, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#6B7280' }}>Anuncio nativo</p>
          <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>Espacio publicitario · 320×100</p>
        </div>
      </div>
    </div>
  )
}
