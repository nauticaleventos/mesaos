import { useEffect, useState } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { useRecipesStore, type Recipe } from '../../store/recipesStore'
import { useFamilyStore } from '../../store/familyStore'
import { useFridgeStore, type FridgeItem } from '../../store/fridgeStore'
import ClasificacionWizard from '../../components/recipes/ClasificacionWizard'
import ConfirmacionReceta from '../../components/recipes/import/ConfirmacionReceta'
import RecipePlaceholder from '../../components/recipes/RecipePlaceholder'
import { calcularMultiplicadorPorcion } from '../../lib/motorMenu'
import { inferirEmojisReceta, multToFraccion } from '../../lib/porcionEmoji'
import PhotosModal from '../../components/recipes/PhotosModal'
import { useRecipePhotosStore } from '../../store/recipePhotosStore'
import { calcularNutricion } from '../../lib/claudeImport'
import { Minus, Plus, Check } from 'lucide-react'

const DIFICULTAD_COLOR: Record<string, string> = {
  facil:   'bg-green-50 text-green-700 border-green-200',
  media:   'bg-yellow-50 text-yellow-700 border-yellow-200',
  dificil: 'bg-red-50 text-red-700 border-red-200',
}

const TC_EMOJI: Record<string, string> = {
  proteina_principal: '🍖', guarnicion: '🍚', ensalada: '🥗',
  salsa: '🫙', plato_unico: '🥘', postre: '🍰', bebida: '🥤', merienda: '🥪',
}

const TIPO_ICONS: Record<string, string> = {
  desayuno: '☀️', almuerzo: '🍽️', cena: '🌙',
  snack: '🍎', postre: '🍰', brunch: '🥞', bebida: '🥤',
}

function inFridge(name: string, items: FridgeItem[]) {
  const n = name.toLowerCase()
  return items.some(f => f.name.toLowerCase().includes(n) || n.includes(f.name.toLowerCase()))
}

function redondear(val: number | null, factor: number): string {
  if (!val) return ''
  const r = val * factor
  if (r < 1) return r.toFixed(1)
  if (Number.isInteger(r)) return String(r)
  return r.toFixed(1)
}

export default function RecetaPage() {
  const { id }                    = useParams<{ id: string }>()
  const [searchParams]            = useSearchParams()
  const memberId                  = searchParams.get('m') ?? undefined
  const navigate                  = useNavigate()

  const { session }                       = useAuthStore()
  const { recipes, loadRecipes }          = useRecipesStore()
  const { family, members }               = useFamilyStore()
  const { items: fridgeItems, loadItems } = useFridgeStore()

  const [recipe, setRecipe]       = useState<Recipe | null>(null)
  const [memberRating, setMemberRating] = useState<number | undefined>()
  const [isBookmarked, setIsBookmarked] = useState(false)
  const [toastMsg, setToastMsg]   = useState<string | null>(null)
  const [imgError, setImgError]   = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)
  const [esEstelar, setEsEstelar] = useState(false)
  const [confirmEstelar, setConfirmEstelar] = useState(false)
  const [showWizard, setShowWizard] = useState(false)
  const [showMenu, setShowMenu]   = useState(false)  // ⋯ menu
  const [showPhotos, setShowPhotos] = useState(false)
  const [showEdit, setShowEdit]   = useState(false)
  const { photos, loadPhotos }    = useRecipePhotosStore()
  const [familyRatings, setFamilyRatings] = useState<{ member_id: string; rating: number }[]>([])
  const [loadedRatings, setLoadedRatings] = useState(false)

  // Porciones dinámicas
  const [porcionesActual, setPorcionesActual] = useState<number>(() => Math.max(members.length, 1))

  // Pasos completados (modo cocina)
  const [pasosCheck, setPasosCheck]   = useState(new Set<number>())
  const [calculandoNut, setCalculandoNut] = useState(false)

  // ── Cargar receta ──────────────────────────────────────────────────────────
  useEffect(() => {
    const found = recipes.find(r => r.id === id)
    if (found) {
      setRecipe(found)
      setPorcionesActual(Math.max(members.length, 1))
      setEsEstelar(!!(found as Recipe & { es_para_lucirse?: boolean }).es_para_lucirse)
      return
    }
    if (id) {
      supabase.from('recipes').select('*').eq('id', id).single()
        .then(({ data }) => {
          if (data) {
            setRecipe(data as Recipe)
            setPorcionesActual((data as Recipe).porciones ?? 4)
            setEsEstelar(!!(data as Recipe & { es_para_lucirse?: boolean }).es_para_lucirse)
          }
        })
    }
  }, [id, recipes])

  // Cargar fotos de la receta
  useEffect(() => {
    if (id && family?.id) loadPhotos(id, family.id)
  }, [id, family?.id])

  const isOwner = family?.owner_user_id === session?.user?.id

  useEffect(() => {
    if (!isOwner || !id || loadedRatings) return
    supabase.from('recipe_reactions').select('member_id, rating').eq('recipe_id', id).not('rating', 'is', null)
      .then(({ data }) => { setFamilyRatings((data ?? []) as typeof familyRatings); setLoadedRatings(true) })
  }, [isOwner, id, loadedRatings])

  useEffect(() => { if (family?.id && recipes.length === 0) loadRecipes(family.id) }, [family?.id, recipes.length, loadRecipes])
  useEffect(() => { if (family?.id) loadItems(family.id) }, [family?.id, loadItems])

  useEffect(() => {
    if (!memberId || !id) return
    supabase.from('recipe_reactions').select('reaction, rating').eq('recipe_id', id).eq('member_id', memberId).single()
      .then(({ data }) => { if (data) { setMemberRating(data.rating ?? undefined); setIsBookmarked(data.reaction === 'bookmark') } })
  }, [id, memberId])

  // ── Handlers ────────────────────────────────────────────────────────────────
  const showToast = (msg: string) => { setToastMsg(msg); setTimeout(() => setToastMsg(null), 2500) }

  const toggleBookmark = async () => {
    if (!memberId || !id) return
    const newState = !isBookmarked
    setIsBookmarked(newState)
    await supabase.from('recipe_reactions').upsert({ recipe_id: id, member_id: memberId, reaction: newState ? 'bookmark' : 'dislike' }, { onConflict: 'recipe_id,member_id' })
    showToast(newState ? '🔖 Guardada' : 'Eliminada de guardadas')
  }

  const handleShare = async () => {
    if (!recipe) return
    const url = window.location.href

    // Armar texto formateado para WhatsApp / notas
    const ingredientesTexto = (recipe.ingredientes ?? [])
      .map((i: { nombre: string; cantidad?: number | null; unidad?: string | null }) =>
        `• ${i.cantidad ? `${i.cantidad}${i.unidad ? ' ' + i.unidad : ''} ` : ''}${i.nombre}`)
      .join('\n')
    const pasosTexto = (recipe.pasos ?? [])
      .map((p: string, idx: number) => `${idx + 1}. ${p}`)
      .join('\n')

    const texto = [
      `🍽️ *${recipe.nombre}*`,
      recipe.descripcion_corta ? `_${recipe.descripcion_corta}_` : '',
      '',
      '📋 *Ingredientes:*',
      ingredientesTexto,
      '',
      '👨‍🍳 *Preparación:*',
      pasosTexto,
      '',
      `Ver receta completa: ${url}`,
    ].filter(l => l !== undefined).join('\n')

    if (navigator.share) {
      await navigator.share({ title: recipe.nombre, text: texto, url })
    } else {
      await navigator.clipboard.writeText(texto)
      showToast('📋 Receta copiada')
    }
  }

  const handleRating = async (rating: number) => {
    if (!memberId || !id) return
    await supabase.from('recipe_reactions').upsert({ recipe_id: id, member_id: memberId, reaction: 'like', rating }, { onConflict: 'recipe_id,member_id' })
    setMemberRating(rating)
    showToast('⭐ Valoración guardada')
  }

  const handleWizardConfirm = async (tipoComida: string[], tipoComponente: string) => {
    if (!id) return
    await supabase.from('recipes').update({ tipo_comida: tipoComida, tipo_componente: tipoComponente }).eq('id', id)
    setRecipe(r => r ? { ...r, tipo_comida: tipoComida, tipo_componente: tipoComponente } as Recipe : r)
    setShowWizard(false)
    showToast('Etiquetas actualizadas ✓')
  }

  const toggleEstelar = async () => {
    if (!id) return
    const nuevo = !esEstelar
    setEsEstelar(nuevo); setConfirmEstelar(false)
    await supabase.from('recipes').update({
      es_para_lucirse: nuevo,
      lucirse_marcada_por: nuevo ? session?.user?.id : null,
      lucirse_marcada_en: nuevo ? new Date().toISOString() : null,
    }).eq('id', id)
    showToast(nuevo ? '⭐ Marcada como receta estelar' : 'Marca removida')
  }

  const togglePasoCheck = (i: number) =>
    setPasosCheck(prev => { const s = new Set(prev); s.has(i) ? s.delete(i) : s.add(i); return s })

  const handleCalcularNutricion = async () => {
    if (!id || !recipe) return
    setCalculandoNut(true)
    try {
      const resultado = await calcularNutricion({
        nombre:       recipe.nombre,
        porciones:    recipe.porciones,
        ingredientes: recipe.ingredientes ?? [],
        dificultad:   recipe.dificultad,
      })
      await supabase.from('recipes').update({
        info_nutricional_aprox: resultado.info_nutricional_aprox,
        filtros_nutricionales:  resultado.filtros_nutricionales,
        perfiles: { ...(recipe as Recipe & { perfiles?: object }).perfiles ?? {}, ...resultado.perfiles },
      }).eq('id', id)
      setRecipe(r => r ? { ...r,
        info_nutricional_aprox: resultado.info_nutricional_aprox as unknown as Recipe['info_nutricional_aprox'],
      } : r)
      showToast('🔢 Nutrición calculada ✓')
    } catch {
      showToast('Error calculando nutrición')
    }
    setCalculandoNut(false)
  }

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (!recipe) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-muted text-sm">Cargando receta...</p></div>
  }

  const tc = (recipe as Recipe & { tipo_componente?: string }).tipo_componente

  // ── Vista pública (sin sesión) ────────────────────────────────────────────
  if (!session) {
    const returnUrl = encodeURIComponent(`/receta/${id}`)
    return (
      <div className="min-h-screen max-w-lg mx-auto">
        <div className="relative h-56 bg-accent-light overflow-hidden">
          {recipe.imagen_url
            ? <img src={recipe.imagen_url} alt={recipe.nombre} className="w-full h-full object-cover" />
            : <RecipePlaceholder tipo={tc} nombre={recipe.nombre} showName className="w-full h-full" />}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4">
            <p className="text-white text-2xl font-semibold leading-tight">{recipe.nombre}</p>
          </div>
        </div>
        <div className="px-4 py-6 flex flex-col gap-5">
          <div className="card flex flex-col gap-4 text-center py-6">
            <span className="text-4xl">🍽️</span>
            <div>
              <p className="font-semibold text-text">Ver receta completa</p>
              <p className="text-muted text-sm mt-1">Ingredientes, preparación y más — crea tu cuenta gratis.</p>
            </div>
            <button onClick={() => navigate(`/signup?return=${returnUrl}`)} className="btn-primary">Crear cuenta gratis</button>
            <button onClick={() => navigate(`/login?return=${returnUrl}`)} className="btn-ghost">Ya tengo cuenta — Entrar</button>
          </div>
        </div>
      </div>
    )
  }

  const imgSrc        = recipe.imagen_url ?? null
  const nut           = recipe.info_nutricional_aprox
  const basePorciones = recipe.porciones ?? 4
  const factor        = basePorciones > 0 ? porcionesActual / basePorciones : 1

  return (
    <div className="min-h-screen pb-28 max-w-lg mx-auto">

      {/* ── Modales ────────────────────────────────────────────────────── */}
      {showWizard && (
        <ClasificacionWizard titulo="Editar etiquetas"
          initialTipoComida={(recipe.tipo_comida ?? []) as string[]}
          initialTipoComponente={tc ?? null}
          onConfirm={handleWizardConfirm} onClose={() => setShowWizard(false)} />
      )}

      {showEdit && id && recipe && family && (
        <ConfirmacionReceta
          recipeId={id}
          familyId={family.id}
          receta={{
            nombre:                 recipe.nombre,
            descripcion_corta:      recipe.descripcion_corta ?? null,
            origen:                 recipe.origen ?? null,
            tipo_comida:            (recipe.tipo_comida ?? []) as string[],
            ocasion:                (recipe.ocasion ?? []) as string[],
            tiempo_total_min:       recipe.tiempo_total_min ?? null,
            tiempo_preparacion_min: recipe.tiempo_preparacion_min ?? null,
            tiempo_coccion_min:     recipe.tiempo_coccion_min ?? null,
            dificultad:             recipe.dificultad ?? null,
            porciones:              recipe.porciones ?? null,
            costo_estimado:         recipe.costo_estimado ?? null,
            ingredientes:           (recipe.ingredientes ?? []) as import('../../lib/claudeImport').IngredienteImport[],
            pasos:                  recipe.pasos ?? [],
            tags:                   recipe.tags ?? [],
            info_nutricional_aprox: recipe.info_nutricional_aprox ? {
              calorias_porcion:  recipe.info_nutricional_aprox.calorias_porcion,
              proteina_g:        recipe.info_nutricional_aprox.proteina_g,
              carbohidratos_g:   recipe.info_nutricional_aprox.carbohidratos_g,
              grasa_g:           recipe.info_nutricional_aprox.grasa_g,
              sodio_mg:          recipe.info_nutricional_aprox.sodio_mg ?? null,
              azucar_g:          recipe.info_nutricional_aprox.azucar_g ?? null,
              fibra_g:           recipe.info_nutricional_aprox.fibra_g ?? null,
            } : null,
            perfiles:               (recipe.perfiles ?? {}) as import('../../lib/claudeImport').RecipeImport['perfiles'],
            filtros_nutricionales:  (recipe.filtros_nutricionales ?? {}) as import('../../lib/claudeImport').RecipeImport['filtros_nutricionales'],
            source_url:             recipe.source_url ?? null,
            source_platform:        recipe.source_platform ?? null,
            language_original:      null,
            confidence:             'high',
            imagen_url:             recipe.imagen_url ?? null,
          }}
          onSaved={() => {
            setShowEdit(false)
            // Recargar receta desde BD
            supabase.from('recipes').select('*').eq('id', id).single()
              .then(({ data }) => { if (data) setRecipe(data as Recipe) })
          }}
          onBack={() => setShowEdit(false)}
        />
      )}

      {showPhotos && id && recipe && (
        <PhotosModal
          recipeId={id}
          recipeName={recipe.nombre}
          onClose={() => setShowPhotos(false)}
          onPrimaryChange={(url) => {
            setRecipe(r => r ? { ...r, imagen_url: url ?? undefined } as Recipe : r)
            setImgError(false)
            setImgLoaded(false)
          }}
        />
      )}

      {confirmEstelar && !esEstelar && (
        <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50 px-4 pb-8">
          <div className="card w-full max-w-sm flex flex-col gap-4">
            <p className="font-semibold text-text text-center">⭐ Marcar para lucirme</p>
            <p className="text-muted text-sm text-center">Esta receta quedará como "carta de presentación" para ocasiones especiales.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmEstelar(false)} className="btn-ghost flex-1">Cancelar</button>
              <button onClick={toggleEstelar} className="btn-primary flex-1">Sí, marcar ⭐</button>
            </div>
          </div>
        </div>
      )}

      {/* ⋯ Menú contextual */}
      {showMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
          <div className="fixed top-16 right-4 z-50 bg-white rounded-2xl shadow-xl border border-border overflow-hidden w-44">
            {isOwner && (
              <button onClick={() => { toggleBookmark(); setShowMenu(false) }}
                className="w-full text-left px-4 py-3 text-sm text-text hover:bg-gray-50 transition-colors border-b border-border">
                {isBookmarked ? '🔖 Quitar bookmark' : '🔖 Guardar'}
              </button>
            )}
            {isOwner && (
              <button onClick={() => { setConfirmEstelar(true); setShowMenu(false) }}
                className="w-full text-left px-4 py-3 text-sm text-text hover:bg-gray-50 transition-colors border-b border-border">
                {esEstelar ? '☆ Quitar estrella' : '⭐ Para lucirme'}
              </button>
            )}
            <button onClick={() => { setShowEdit(true); setShowMenu(false) }}
              className="w-full text-left px-4 py-3 text-sm text-text hover:bg-gray-50 transition-colors border-b border-border">
              ✏️ Editar receta
            </button>
            <button onClick={() => { setShowWizard(true); setShowMenu(false) }}
              className="w-full text-left px-4 py-3 text-sm text-text hover:bg-gray-50 transition-colors border-b border-border">
              🏷️ Editar etiquetas
            </button>
            <button onClick={() => { window.open(`/receta/${id}/imprimir`, '_blank'); setShowMenu(false) }}
              className="w-full text-left px-4 py-3 text-sm text-text hover:bg-gray-50 transition-colors border-b border-border">
              📄 Exportar PDF
            </button>
            <button onClick={handleShare}
              className="w-full text-left px-4 py-3 text-sm text-text hover:bg-gray-50 transition-colors">
              📤 Compartir
            </button>
          </div>
        </>
      )}

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="sticky top-0 bg-white/95 backdrop-blur z-20 px-4 pt-4 pb-3 flex items-center justify-between border-b border-border/50">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-muted hover:text-text transition-colors text-sm font-medium">
          ← Volver
        </button>
        <div className="flex items-center gap-2">
          {memberId && (
            <button onClick={toggleBookmark}
              className={`text-xl transition-all ${isBookmarked ? 'text-accent' : 'text-muted hover:text-accent'}`}>
              🔖
            </button>
          )}
          <button onClick={() => setShowMenu(s => !s)} className="text-muted hover:text-text transition-colors text-lg px-1">
            ⋯
          </button>
        </div>
      </div>

      {/* ── Foto grande ────────────────────────────────────────────────── */}
      <div className="relative w-full aspect-[4/3] overflow-hidden">
        {imgSrc && !imgError
          ? <img src={imgSrc} alt={recipe.nombre}
              className={`w-full h-full object-cover transition-opacity duration-500 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
              onLoad={() => setImgLoaded(true)} onError={() => setImgError(true)} />
          : <RecipePlaceholder tipo={tc} nombre={recipe.nombre} showName className="w-full h-full" />
        }
        {/* Botón de fotos */}
        <button
          onClick={() => setShowPhotos(true)}
          className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-black/50 hover:bg-black/70 text-white text-xs font-semibold px-3 py-1.5 rounded-full backdrop-blur-sm transition-colors">
          📷 {photos.length > 0 ? `Mis fotos (${photos.length})` : 'Subir foto'}
        </button>
      </div>

      {/* ── Título + etiquetas ─────────────────────────────────────────── */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-start gap-2 mb-2">
          <h1 className="text-2xl font-serif font-semibold text-text leading-tight flex-1">
            {recipe.nombre}
            {esEstelar && <span className="ml-2 text-xl">⭐</span>}
          </h1>
        </div>

        {recipe.descripcion_corta && (
          <p className="text-muted text-sm mb-3">{recipe.descripcion_corta}</p>
        )}

        {/* Chips editables */}
        <div className="flex flex-wrap gap-1.5 items-center">
          {recipe.tipo_comida?.slice(0,3).map(t => (
            <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-muted font-medium">
              {TIPO_ICONS[t] ?? ''} {t}
            </span>
          ))}
          {tc && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20 font-medium">
              {TC_EMOJI[tc] ?? ''} {tc.replace('_', ' ')}
            </span>
          )}
          <button onClick={() => setShowWizard(true)} title="Editar etiquetas"
            className="text-xs text-muted hover:text-accent transition-colors ml-1">✏️</button>
        </div>

        {/* Metadata chips */}
        <div className="flex flex-wrap gap-1.5 mt-2">
          {recipe.origen && <Chip>🌎 {recipe.origen}</Chip>}
          {recipe.tiempo_total_min && <Chip>⏱ {recipe.tiempo_total_min}min</Chip>}
          {recipe.dificultad && (
            <span className={`px-2 py-0.5 rounded-full border text-xs ${DIFICULTAD_COLOR[recipe.dificultad]}`}>
              {recipe.dificultad}
            </span>
          )}
          {recipe.costo_estimado && <Chip>💰 {recipe.costo_estimado}</Chip>}
        </div>
      </div>

      {/* ── 4 Botones de acción ────────────────────────────────────────── */}
      <div className="px-4 py-3">
        <div className="flex gap-2">
          {[
            { emoji: '📑', label: 'Guardar',    onClick: toggleBookmark },
            { emoji: '📤', label: 'Compartir',  onClick: handleShare    },
            { emoji: '🛒', label: 'Lista',      onClick: () => navigate('/mercado') },
            { emoji: '⭐', label: esEstelar ? 'Estelar ✓' : 'Estelar',
              onClick: () => esEstelar ? toggleEstelar() : setConfirmEstelar(true) },
          ].map(btn => (
            <button key={btn.label} onClick={btn.onClick}
              className="flex-1 flex flex-col items-center gap-1 py-3 rounded-2xl bg-gray-50 border border-border hover:border-accent hover:bg-accent/5 transition-all active:scale-95">
              <span className="text-xl leading-none">{btn.emoji}</span>
              <span className="text-[10px] text-muted font-medium">{btn.label}</span>
            </button>
          ))}
        </div>
      </div>

      <Divider />

      {/* ── Notas de receta ────────────────────────────────────────────── */}
      <div className="px-4 py-3 flex flex-col gap-3">
        <p className="text-xs font-semibold text-muted uppercase tracking-wider">Sobre esta receta</p>

        {/* Atribución de fuente */}
        {(() => {
          const r = recipe as Recipe & { source_url?: string; source_platform?: string }
          if (!r.source_url) return null
          const autor = extraerAutor(r.source_url, r.source_platform)
          const plataforma = nombrePlataforma(r.source_platform)
          return (
            <div className="flex flex-col gap-2 p-3 rounded-xl bg-gray-50 border border-border">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-base">{iconoPlataforma(r.source_platform)}</span>
                <span className="text-sm text-text font-medium">
                  Receta de {autor}
                </span>
                {plataforma && (
                  <span className="text-xs text-muted">en {plataforma}</span>
                )}
              </div>
              <a href={r.source_url} target="_blank" rel="noopener noreferrer"
                className="text-xs text-accent hover:underline break-all">
                🔗 Ver publicación original
              </a>
              <p className="text-xs text-muted leading-relaxed">
                Si te gustan las recetas, te invitamos a darle like y compartir ❤️
              </p>
            </div>
          )
        })()}

        {/* Rating del miembro */}
        {memberId && (
          <div>
            <p className="text-xs text-muted mb-1.5">Tu valoración</p>
            <div className="flex gap-2">
              {[1,2,3,4,5].map(s => (
                <button key={s} onClick={() => handleRating(s)}
                  className="text-2xl transition-transform hover:scale-110 active:scale-90"
                  style={{ color: s <= (memberRating ?? 0) ? '#EF9F27' : '#E5E7EB' }}>★</button>
              ))}
            </div>
          </div>
        )}

        {/* Valoraciones de la familia (solo owner) */}
        {isOwner && familyRatings.length > 0 && (
          <div className="p-3 rounded-xl bg-gray-50 border border-border">
            <p className="text-xs font-semibold text-muted mb-2">Valoraciones de la familia</p>
            {familyRatings.map(r => {
              const m = members.find(mb => mb.id === r.member_id)
              return (
                <div key={r.member_id} className="flex items-center gap-2 text-xs py-0.5">
                  <span>{m?.emoji ?? '👤'}</span>
                  <span className="flex-1 text-text">{m?.name ?? 'Miembro'}</span>
                  <span className="text-yellow-500">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <Divider />

      {/* ── Ingredientes con porciones dinámicas ──────────────────────── */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-muted uppercase tracking-wider">Ingredientes</p>
          {/* Selector porciones */}
          <div className="flex items-center gap-2">
            <button onClick={() => setPorcionesActual(p => Math.max(1, p - 1))}
              className="w-7 h-7 rounded-full border border-border flex items-center justify-center hover:border-accent hover:text-accent transition-colors">
              <Minus size={13} />
            </button>
            <span className="text-sm font-semibold text-text min-w-[24px] text-center">{porcionesActual}</span>
            <button onClick={() => setPorcionesActual(p => p + 1)}
              className="w-7 h-7 rounded-full border border-border flex items-center justify-center hover:border-accent hover:text-accent transition-colors">
              <Plus size={13} />
            </button>
            <span className="text-xs text-muted">porciones</span>
          </div>
        </div>

        {recipe.ingredientes.length === 0 ? (
          <p className="text-sm text-muted italic">Sin ingredientes registrados</p>
        ) : (
          <div className="flex flex-col">
            {/* Esenciales */}
            {recipe.ingredientes.filter(i => i.esencial).map((ing, idx) => {
              const tiene = inFridge(ing.nombre, fridgeItems)
              const cantStr = redondear(ing.cantidad, factor)
              return (
                <div key={`e-${idx}`} className="flex items-center gap-2.5 py-2.5 border-b border-border/50 last:border-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0 mt-0.5" />
                  <span className="flex-1 text-sm text-text">{ing.nombre}</span>
                  {cantStr && (
                    <span className="text-xs text-muted flex-shrink-0">
                      {cantStr} {ing.unidad ?? ''}
                    </span>
                  )}
                  {tiene ? (
                    <span className="text-[10px] bg-green-50 text-green-700 border border-green-200 px-1.5 py-0.5 rounded-full flex-shrink-0">✓</span>
                  ) : (
                    <span className="text-[10px] bg-orange-50 text-orange-600 border border-orange-200 px-1.5 py-0.5 rounded-full flex-shrink-0">🛒</span>
                  )}
                </div>
              )
            })}
            {/* Opcionales */}
            {recipe.ingredientes.some(i => !i.esencial) && (
              <>
                <p className="text-xs text-muted font-medium pt-3 pb-1">Opcionales</p>
                {recipe.ingredientes.filter(i => !i.esencial).map((ing, idx) => {
                  const cantStr = redondear(ing.cantidad, factor)
                  return (
                    <div key={`o-${idx}`} className="flex items-center gap-2.5 py-2 border-b border-border/30 last:border-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-300 flex-shrink-0 mt-0.5" />
                      <span className="flex-1 text-sm text-muted">{ing.nombre}</span>
                      {cantStr && <span className="text-xs text-muted">{cantStr} {ing.unidad ?? ''}</span>}
                    </div>
                  )
                })}
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Al servir ─────────────────────────────────────────────────── */}
      {(() => {
        const activos = members.filter(m => calcularMultiplicadorPorcion(m) !== 1.0)
        if (activos.length < 1) return null
        const { protein: pEmoji, carb: cEmoji } = inferirEmojisReceta(recipe.ingredientes ?? [])
        return (
          <>
            <Divider />
            <div className="px-4 py-3">
              <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Al servir</p>
              <div className="flex flex-col gap-2">
                {members.map(m => {
                  const mult = calcularMultiplicadorPorcion(m)
                  const frac = multToFraccion(mult)
                  return (
                    <div key={m.id} className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-base leading-none">{m.emoji}</span>
                      <span className="text-sm font-medium text-text">{m.name}:</span>
                      <span className="text-sm text-muted">{pEmoji} {frac} palma {cEmoji} {frac} puño</span>
                    </div>
                  )
                })}
              </div>
              <p className="text-[10px] text-muted mt-2">palma = proteína · puño = grano/carb</p>
            </div>
          </>
        )
      })()}

      {/* ── Pasos con checkmark ────────────────────────────────────────── */}
      {recipe.pasos?.length > 0 && (
        <>
          <Divider />
          <div className="px-4 py-3">
            <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Preparación</p>
            <div className="flex flex-col gap-3">
              {recipe.pasos.map((paso, i) => {
                const done = pasosCheck.has(i)
                return (
                  <button key={i} onClick={() => togglePasoCheck(i)}
                    className={`flex gap-3 text-left transition-all ${done ? 'opacity-50' : ''}`}>
                    <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold mt-0.5 transition-all
                      ${done ? 'bg-oliva text-white' : 'bg-accent text-white'}`}>
                      {done ? <Check size={14} /> : i + 1}
                    </div>
                    <p className={`text-sm leading-relaxed flex-1 ${done ? 'line-through text-muted' : 'text-text'}`}>
                      {paso}
                    </p>
                  </button>
                )
              })}
            </div>
            {pasosCheck.size > 0 && (
              <button onClick={() => setPasosCheck(new Set())}
                className="mt-3 text-xs text-muted hover:text-text transition-colors">
                ↩ Reiniciar pasos
              </button>
            )}
          </div>
        </>
      )}

      {/* ── Nutrición ─────────────────────────────────────────────────── */}
      {!nut && recipe.ingredientes?.length > 0 && (
        <>
          <Divider />
          <div className="px-4 py-3">
            <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Nutrición por porción</p>
            <div className="p-3 rounded-xl border border-border bg-gray-50 flex items-center justify-between gap-3">
              <p className="text-xs text-muted">Sin información nutricional registrada.</p>
              <button onClick={handleCalcularNutricion} disabled={calculandoNut}
                className="text-xs font-semibold text-accent hover:opacity-70 transition-opacity flex items-center gap-1 flex-shrink-0">
                {calculandoNut ? '...' : '🔄 Calcular'}
              </button>
            </div>
          </div>
        </>
      )}
      {nut && (
        <>
          <Divider />
          <div className="px-4 py-3">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-muted uppercase tracking-wider">Nutrición por porción</p>
              <button onClick={handleCalcularNutricion} disabled={calculandoNut}
                className="text-[10px] text-muted hover:text-accent transition-colors">
                {calculandoNut ? '...' : '🔄 Recalcular'}
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {[
                { label: 'Calorías', value: nut.calorias_porcion, unit: 'kcal' },
                { label: 'Proteína', value: nut.proteina_g,       unit: 'g'    },
                { label: 'Carbs',    value: nut.carbohidratos_g,  unit: 'g'    },
                { label: 'Grasa',    value: nut.grasa_g,          unit: 'g'    },
              ].map(m => (
                <div key={m.label} className="bg-gray-50 rounded-xl p-2.5 text-center border border-border">
                  <p className="text-base font-bold text-text">{m.value ?? '—'}</p>
                  <p className="text-[10px] text-muted">{m.unit}</p>
                  <p className="text-[9px] text-muted mt-0.5">{m.label}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── Tags ──────────────────────────────────────────────────────── */}
      {recipe.tags?.length > 0 && (
        <div className="px-4 pb-4 flex flex-wrap gap-1.5">
          {recipe.tags.map(t => (
            <span key={t} className="px-2.5 py-1 bg-accent-light text-accent text-xs rounded-full">{t}</span>
          ))}
        </div>
      )}

      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-text text-bg text-sm px-4 py-2.5 rounded-xl shadow-lg z-30 whitespace-nowrap">
          {toastMsg}
        </div>
      )}
    </div>
  )
}

function extraerAutor(url: string, platform?: string | null): string {
  try {
    const { hostname, pathname } = new URL(url)
    if (platform === 'instagram' || hostname.includes('instagram')) {
      // instagram.com/username/p/... o instagram.com/reel/...
      const parts = pathname.split('/').filter(Boolean)
      if (parts[0] && parts[0] !== 'p' && parts[0] !== 'reel' && parts[0] !== 'tv')
        return `@${parts[0]}`
    }
    if (platform === 'tiktok' || hostname.includes('tiktok')) {
      // tiktok.com/@username/video/...
      const match = pathname.match(/@([^/]+)/)
      if (match) return `@${match[1]}`
    }
    if (platform === 'youtube' || hostname.includes('youtube') || hostname.includes('youtu.be')) {
      // youtube.com/@channel o youtube.com/c/channel
      const match = pathname.match(/\/@?([^/]+)/)
      if (match) return match[1]
    }
    // Fallback: dominio limpio
    return hostname.replace('www.', '')
  } catch {
    return 'el autor original'
  }
}

function nombrePlataforma(platform?: string | null): string {
  const map: Record<string, string> = {
    instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube',
    facebook: 'Facebook', web: '', texto: '', foto: '', manual: '',
  }
  return map[platform ?? ''] ?? ''
}

function iconoPlataforma(platform?: string | null): string {
  const map: Record<string, string> = {
    instagram: '📸', tiktok: '🎵', youtube: '▶️',
    facebook: '👥', web: '🌐',
  }
  return map[platform ?? ''] ?? '🔗'
}

function Divider() {
  return <div className="h-2 bg-gray-50 border-y border-border/40" />
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="px-2 py-0.5 bg-white border border-border text-muted text-xs rounded-full">
      {children}
    </span>
  )
}
