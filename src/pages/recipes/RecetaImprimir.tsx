/**
 * RecetaImprimir
 *
 * Vista optimizada para impresión / exportar como PDF.
 * Se abre en pestaña nueva y dispara window.print() automáticamente.
 * El usuario elige "Guardar como PDF" en el diálogo del navegador.
 *
 * Ruta: /receta/:id/imprimir
 */

import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { Recipe } from '../../store/recipesStore'

export default function RecetaImprimir() {
  const { id }                    = useParams<{ id: string }>()
  const [recipe, setRecipe]       = useState<Recipe | null>(null)
  const [printed, setPrinted]     = useState(false)

  useEffect(() => {
    if (!id) return
    supabase.from('recipes').select('*').eq('id', id).single()
      .then(({ data }) => { if (data) setRecipe(data as Recipe) })
  }, [id])

  // Auto-print cuando la receta cargue
  useEffect(() => {
    if (!recipe || printed) return
    const timer = setTimeout(() => {
      window.print()
      setPrinted(true)
    }, 800) // pequeño delay para que renderice la imagen
    return () => clearTimeout(timer)
  }, [recipe, printed])

  if (!recipe) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <p style={{ color: '#888', fontSize: 14 }}>Preparando PDF...</p>
      </div>
    )
  }

  const nut  = recipe.info_nutricional_aprox
  const ings = recipe.ingredientes ?? []
  const esenciales = ings.filter(i => i.esencial)
  const opcionales = ings.filter(i => !i.esencial)

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Lora:wght@400;600&family=Inter:wght@400;500;600&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          font-family: 'Inter', sans-serif;
          color: #2C2C2A;
          background: white;
          font-size: 11pt;
          line-height: 1.5;
        }

        .page {
          max-width: 210mm;
          margin: 0 auto;
          padding: 20mm 20mm 15mm;
        }

        /* ── Header ── */
        .header {
          display: flex;
          align-items: flex-start;
          gap: 16px;
          margin-bottom: 20px;
          padding-bottom: 16px;
          border-bottom: 2px solid #E76F51;
        }

        .header-img {
          width: 100px;
          height: 100px;
          object-fit: cover;
          border-radius: 8px;
          flex-shrink: 0;
        }

        .header-img-placeholder {
          width: 100px;
          height: 100px;
          background: #FFCDB2;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 36px;
          flex-shrink: 0;
        }

        .header-info { flex: 1; }

        .logo {
          font-family: 'Lora', serif;
          font-size: 11pt;
          color: #E76F51;
          font-weight: 600;
          margin-bottom: 4px;
        }

        h1 {
          font-family: 'Lora', serif;
          font-size: 20pt;
          font-weight: 600;
          color: #2C2C2A;
          line-height: 1.2;
          margin-bottom: 6px;
        }

        .meta {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          font-size: 9pt;
          color: #888;
          margin-top: 6px;
        }

        .meta-item { display: flex; align-items: center; gap: 4px; }

        .descripcion {
          font-size: 10pt;
          color: #666;
          margin-top: 4px;
          font-style: italic;
        }

        /* ── Secciones ── */
        .section { margin-bottom: 20px; }

        .section-title {
          font-size: 9pt;
          font-weight: 600;
          color: #E76F51;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 8px;
          padding-bottom: 4px;
          border-bottom: 1px solid #FFCDB2;
        }

        /* ── Ingredientes ── */
        .ings-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 2px 24px;
        }

        .ing-row {
          display: flex;
          align-items: baseline;
          gap: 6px;
          padding: 3px 0;
          border-bottom: 1px solid #f0f0f0;
          font-size: 10pt;
        }

        .ing-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #E76F51;
          flex-shrink: 0;
          margin-top: 4px;
        }

        .ing-dot-opt {
          background: #ccc;
        }

        .ing-nombre { flex: 1; color: #2C2C2A; }
        .ing-cantidad { color: #888; font-size: 9pt; white-space: nowrap; }

        .opc-label {
          font-size: 8.5pt;
          color: #aaa;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          margin: 8px 0 4px;
        }

        /* ── Pasos ── */
        .pasos { display: flex; flex-direction: column; gap: 10px; }

        .paso {
          display: flex;
          gap: 12px;
          align-items: flex-start;
        }

        .paso-num {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: #E76F51;
          color: white;
          font-size: 10pt;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .paso-texto {
          flex: 1;
          font-size: 10pt;
          color: #2C2C2A;
          padding-top: 2px;
          line-height: 1.5;
        }

        /* ── Nutrición ── */
        .nut-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
        }

        .nut-box {
          text-align: center;
          padding: 8px 4px;
          border: 1px solid #f0f0f0;
          border-radius: 8px;
          background: #fafafa;
        }

        .nut-val { font-size: 14pt; font-weight: 700; color: #2C2C2A; }
        .nut-unit { font-size: 8pt; color: #aaa; }
        .nut-label { font-size: 8pt; color: #888; margin-top: 2px; }

        /* ── Atribución ── */
        .attribution {
          margin-top: 16px;
          padding: 10px 12px;
          background: #FFF5F2;
          border: 1px solid #FFCDB2;
          border-radius: 8px;
        }
        .attribution-title { font-size: 9pt; font-weight: 600; color: #E76F51; margin-bottom: 3px; }
        .attribution-url { font-size: 8pt; color: #999; word-break: break-all; }
        .attribution-note { font-size: 8pt; color: #bbb; margin-top: 4px; }

        /* ── Footer ── */
        .footer {
          margin-top: 20px;
          padding-top: 10px;
          border-top: 1px solid #eee;
          font-size: 8pt;
          color: #aaa;
          text-align: center;
        }

        /* ── Print ── */
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          .page { padding: 10mm 12mm; }
          @page { margin: 10mm; size: A4; }
        }

        @media screen {
          body { background: #f5f5f5; }
          .page { background: white; margin: 20px auto; border-radius: 8px; box-shadow: 0 2px 20px rgba(0,0,0,0.1); }
        }
      `}</style>

      {/* Botón imprimir (solo en pantalla, no en PDF) */}
      <div className="no-print" style={{ textAlign: 'center', padding: '16px', background: '#f5f5f5' }}>
        <button onClick={() => window.print()}
          style={{ background: '#E76F51', color: 'white', border: 'none', borderRadius: 8,
                   padding: '10px 24px', fontSize: 14, cursor: 'pointer', fontWeight: 600 }}>
          🖨️ Imprimir / Guardar PDF
        </button>
        <button onClick={() => window.close()}
          style={{ marginLeft: 12, background: 'white', color: '#888', border: '1px solid #ddd',
                   borderRadius: 8, padding: '10px 20px', fontSize: 14, cursor: 'pointer' }}>
          Cerrar
        </button>
      </div>

      <div className="page">
        {/* ── Header ── */}
        <div className="header">
          {recipe.imagen_url ? (
            <img src={recipe.imagen_url} alt={recipe.nombre} className="header-img" />
          ) : (
            <div className="header-img-placeholder">🍽️</div>
          )}
          <div className="header-info">
            <div className="logo">mesa.os</div>
            <h1>{recipe.nombre}</h1>
            {recipe.descripcion_corta && (
              <p className="descripcion">{recipe.descripcion_corta}</p>
            )}
            <div className="meta">
              {recipe.porciones && <span className="meta-item">👥 {recipe.porciones} porciones</span>}
              {recipe.tiempo_total_min && <span className="meta-item">⏱ {recipe.tiempo_total_min} min</span>}
              {recipe.dificultad && <span className="meta-item">📊 {recipe.dificultad}</span>}
              {recipe.origen && <span className="meta-item">🌎 {recipe.origen}</span>}
            </div>
          </div>
        </div>

        {/* ── Ingredientes ── */}
        {ings.length > 0 && (
          <div className="section">
            <div className="section-title">Ingredientes</div>
            <div className="ings-grid">
              {esenciales.map((ing, i) => (
                <div key={i} className="ing-row">
                  <span className="ing-dot" />
                  <span className="ing-nombre">{ing.nombre}</span>
                  {ing.cantidad && (
                    <span className="ing-cantidad">{ing.cantidad} {ing.unidad ?? ''}</span>
                  )}
                </div>
              ))}
            </div>
            {opcionales.length > 0 && (
              <>
                <div className="opc-label">Opcionales</div>
                <div className="ings-grid">
                  {opcionales.map((ing, i) => (
                    <div key={i} className="ing-row">
                      <span className="ing-dot ing-dot-opt" />
                      <span className="ing-nombre" style={{ color: '#888' }}>{ing.nombre}</span>
                      {ing.cantidad && (
                        <span className="ing-cantidad">{ing.cantidad} {ing.unidad ?? ''}</span>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Pasos ── */}
        {recipe.pasos?.length > 0 && (
          <div className="section">
            <div className="section-title">Preparación</div>
            <div className="pasos">
              {recipe.pasos.map((paso, i) => (
                <div key={i} className="paso">
                  <div className="paso-num">{i + 1}</div>
                  <p className="paso-texto">{paso}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Nutrición ── */}
        {nut && (
          <div className="section">
            <div className="section-title">Información nutricional (por porción)</div>
            <div className="nut-grid">
              {[
                { label: 'Calorías',    val: nut.calorias_porcion, unit: 'kcal' },
                { label: 'Proteína',    val: nut.proteina_g,       unit: 'g'    },
                { label: 'Carbohidratos', val: nut.carbohidratos_g, unit: 'g'  },
                { label: 'Grasa',       val: nut.grasa_g,          unit: 'g'    },
              ].map(m => (
                <div key={m.label} className="nut-box">
                  <div className="nut-val">{m.val ?? '—'}</div>
                  <div className="nut-unit">{m.unit}</div>
                  <div className="nut-label">{m.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Tags ── */}
        {recipe.tags?.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
            {recipe.tags.map(t => (
              <span key={t} style={{ fontSize: 8, padding: '2px 8px', background: '#FFCDB2', color: '#E76F51', borderRadius: 20 }}>
                {t}
              </span>
            ))}
          </div>
        )}

        {/* ── Atribución ── */}
        {(recipe as Recipe & { source_url?: string }).source_url && (() => {
          const r = recipe as Recipe & { source_url: string; source_platform?: string }
          const autor = extraerAutorImprimir(r.source_url, r.source_platform)
          const plataforma = nombrePlataformaImprimir(r.source_platform)
          return (
            <div className="attribution">
              <div className="attribution-title">
                {iconoPlataformaImprimir(r.source_platform)} Receta de {autor}{plataforma ? ` · ${plataforma}` : ''}
              </div>
              <div className="attribution-url">{r.source_url}</div>
              <div className="attribution-note">Apoya al creador original con un like ❤️</div>
            </div>
          )
        })()}

        <div className="footer">
          Generado con mesa.os · {new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>
    </>
  )
}

function extraerAutorImprimir(url: string, platform?: string | null): string {
  try {
    const { hostname, pathname } = new URL(url)
    if (platform === 'instagram' || hostname.includes('instagram')) {
      const parts = pathname.split('/').filter(Boolean)
      if (parts[0] && parts[0] !== 'p' && parts[0] !== 'reel' && parts[0] !== 'tv')
        return `@${parts[0]}`
    }
    if (platform === 'tiktok' || hostname.includes('tiktok')) {
      const match = pathname.match(/@([^/]+)/)
      if (match) return `@${match[1]}`
    }
    if (platform === 'youtube' || hostname.includes('youtube') || hostname.includes('youtu.be')) {
      const match = pathname.match(/\/@?([^/]+)/)
      if (match) return match[1]
    }
    return hostname.replace('www.', '')
  } catch {
    return 'el autor original'
  }
}

function nombrePlataformaImprimir(platform?: string | null): string {
  const map: Record<string, string> = {
    instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube',
    facebook: 'Facebook', web: '', texto: '', foto: '', manual: '',
  }
  return map[platform ?? ''] ?? ''
}

function iconoPlataformaImprimir(platform?: string | null): string {
  const map: Record<string, string> = {
    instagram: '📸', tiktok: '🎵', youtube: '▶️',
    facebook: '👥', web: '🌐',
  }
  return map[platform ?? ''] ?? '🔗'
}
