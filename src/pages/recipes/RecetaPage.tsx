import { useEffect, useState } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { useRecipesStore, type Recipe } from '../../store/recipesStore'
import { useFamilyStore } from '../../store/familyStore'
import { useFridgeStore, type FridgeItem } from '../../store/fridgeStore'

type Tab = 'ingredientes' | 'pasos' | 'nutricion'

const DIFICULTAD_COLOR: Record<string, string> = {
  facil:   'bg-green-50 text-green-700 border-green-200',
  media:   'bg-yellow-50 text-yellow-700 border-yellow-200',
  dificil: 'bg-red-50 text-red-700 border-red-200',
}

const TIPO_ICONS: Record<string, string> = {
  desayuno: '☀️', almuerzo: '🍽️', cena: '🌙',
  snack: '🍎', postre: '🍰', brunch: '🥞',
}

function inFridge(name: string, items: FridgeItem[]) {
  const n = name.toLowerCase()
  return items.some(f => f.name.toLowerCase().includes(n) || n.includes(f.name.toLowerCase()))
}

export default function RecetaPage() {
  const { id }                    = useParams<{ id: string }>()
  const [searchParams]            = useSearchParams()
  const memberId                  = searchParams.get('m') ?? undefined
  const navigate                  = useNavigate()

  const { session }                       = useAuthStore()
  const { recipes, loadRecipes }          = useRecipesStore()
  const { family }                        = useFamilyStore()
  const { items: fridgeItems, loadItems } = useFridgeStore()

  const [recipe, setRecipe]           = useState<Recipe | null>(null)
  const [activeTab, setActiveTab]     = useState<Tab>('ingredientes')
  const [memberRating, setMemberRating] = useState<number | undefined>()
  const [isBookmarked, setIsBookmarked] = useState(false)
  const [toastMsg, setToastMsg]       = useState<string | null>(null)
  const [imgError, setImgError]       = useState(false)
  const [imgLoaded, setImgLoaded]     = useState(false)

  // Cargar receta
  useEffect(() => {
    const found = recipes.find(r => r.id === id)
    if (found) { setRecipe(found); return }
    if (id) {
      supabase.from('recipes').select('*').eq('id', id).single()
        .then(({ data }) => { if (data) setRecipe(data as Recipe) })
    }
  }, [id, recipes])

  // Cargar recipes del store si está vacío
  useEffect(() => {
    if (family?.id && recipes.length === 0) loadRecipes(family.id)
  }, [family?.id, recipes.length, loadRecipes])

  // Cargar items de nevera
  useEffect(() => {
    if (family?.id) loadItems(family.id)
  }, [family?.id, loadItems])

  // Cargar reacción del miembro
  useEffect(() => {
    if (!memberId || !id) return
    supabase.from('recipe_reactions')
      .select('reaction, rating')
      .eq('recipe_id', id).eq('member_id', memberId)
      .single()
      .then(({ data }) => {
        if (data) {
          setMemberRating(data.rating ?? undefined)
          setIsBookmarked(data.reaction === 'bookmark')
        }
      })
  }, [id, memberId])

  const showToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 2500)
  }

  const toggleBookmark = async () => {
    if (!memberId || !id) return
    const newState = !isBookmarked
    setIsBookmarked(newState)
    await supabase.from('recipe_reactions').upsert({
      recipe_id: id, member_id: memberId,
      reaction: newState ? 'bookmark' : 'dislike',
    }, { onConflict: 'recipe_id,member_id' })
    showToast(newState ? '🔖 Guardada en tu lista' : 'Eliminada de guardadas')
  }

  const handleShare = async () => {
    const url = window.location.href
    if (navigator.share) {
      await navigator.share({ title: recipe?.nombre ?? '', url })
    } else {
      await navigator.clipboard.writeText(url)
      showToast('🔗 Enlace copiado')
    }
  }

  const handleAddToList = () => showToast('🛒 Lista de mercado próximamente')

  const handleRating = async (rating: number) => {
    if (!memberId || !id) return
    await supabase.from('recipe_reactions').upsert({
      recipe_id: id, member_id: memberId, reaction: 'like', rating,
    }, { onConflict: 'recipe_id,member_id' })
    setMemberRating(rating)
    showToast(`⭐ Valoración guardada`)
  }

  if (!recipe) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted text-sm">Cargando receta...</p>
      </div>
    )
  }

  // ── Vista pública (sin sesión) ────────────────────────────────────────────
  if (!session) {
    const returnUrl = encodeURIComponent(`/receta/${id}`)
    return (
      <div className="min-h-screen max-w-lg mx-auto">
        <div className="relative h-56 bg-accent-light overflow-hidden">
          <img
            src={`https://source.unsplash.com/featured/800x500/?${encodeURIComponent(recipe.nombre + ' food')}`}
            alt={recipe.nombre}
            className="w-full h-full object-cover"
            onError={e => (e.currentTarget.style.display = 'none')}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4">
            <p className="text-white text-2xl font-semibold leading-tight">{recipe.nombre}</p>
            {recipe.origen && <p className="text-white/80 text-sm mt-0.5">🌎 {recipe.origen}</p>}
          </div>
        </div>

        <div className="px-4 py-6 flex flex-col gap-5">
          {recipe.descripcion_corta && (
            <p className="text-muted text-sm">{recipe.descripcion_corta}</p>
          )}
          <div className="flex flex-wrap gap-2">
            {recipe.tiempo_total_min && <Chip>⏱ {recipe.tiempo_total_min}min</Chip>}
            {recipe.dificultad && (
              <span className={`px-2 py-0.5 rounded-full border text-xs ${DIFICULTAD_COLOR[recipe.dificultad]}`}>
                {recipe.dificultad}
              </span>
            )}
            {recipe.porciones && <Chip>👥 {recipe.porciones} porciones</Chip>}
          </div>

          <div className="card flex flex-col gap-4 text-center py-6">
            <span className="text-4xl">🍽️</span>
            <div>
              <p className="font-semibold text-text">Ver receta completa</p>
              <p className="text-muted text-sm mt-1">
                Ingredientes, preparación y más — crea tu cuenta gratis.
              </p>
            </div>
            <button onClick={() => navigate(`/signup?return=${returnUrl}`)} className="btn-primary">
              Crear cuenta gratis
            </button>
            <button onClick={() => navigate(`/login?return=${returnUrl}`)} className="btn-ghost">
              Ya tengo cuenta — Entrar
            </button>
          </div>
        </div>
      </div>
    )
  }

  const imgSrc = recipe.imagen_url
    ?? `https://source.unsplash.com/featured/800x500/?${encodeURIComponent(recipe.nombre.split(' ').slice(0,3).join(' ') + ' food')}`
  const nut    = recipe.info_nutricional_aprox
  const totalMacros = nut ? nut.proteina_g + nut.carbohidratos_g + nut.grasa_g : 1

  return (
    <div className="min-h-screen pb-28 max-w-lg mx-auto">

      {/* Sticky header */}
      <div className="sticky top-0 bg-bg/95 backdrop-blur z-20 px-4 pt-5 pb-3 flex items-center justify-between">
        <button onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-muted hover:text-text transition-colors text-sm">
          ← Volver
        </button>
        <div className="flex gap-3">
          <button onClick={toggleBookmark}
            className={`text-xl transition-all ${isBookmarked ? 'text-accent scale-110' : 'text-muted hover:text-accent'}`}
            title={isBookmarked ? 'Quitar de guardadas' : 'Guardar'}>
            🔖
          </button>
          <button onClick={handleShare} className="text-muted hover:text-text transition-colors text-xl" title="Compartir">
            ↗
          </button>
        </div>
      </div>

      {/* Foto */}
      <div className="relative h-52 bg-accent-light overflow-hidden">
        {!imgError && (
          <img src={imgSrc} alt={recipe.nombre}
            className={`w-full h-full object-cover transition-opacity duration-500 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
            onLoad={() => setImgLoaded(true)} onError={() => setImgError(true)} />
        )}
        {(!imgLoaded || imgError) && (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-accent-light to-accent/40">
            <span className="text-7xl">{TIPO_ICONS[recipe.tipo_comida[0]] ?? '🍽️'}</span>
          </div>
        )}
      </div>

      {/* Crédito Unsplash */}
      {recipe.imagen_credito && imgLoaded && (
        <p className="text-right px-3 py-1 text-[11px] text-muted">
          Foto:{' '}
          <a href={recipe.imagen_credito.perfil_url} target="_blank" rel="noopener noreferrer"
            className="underline hover:text-text transition-colors">
            {recipe.imagen_credito.fotografo}
          </a>
          {' '}en Unsplash
        </p>
      )}

      {/* Info principal */}
      <div className="px-4 pt-4 pb-3">
        <h1 className="text-2xl font-serif font-semibold text-text leading-tight">{recipe.nombre}</h1>
        {recipe.descripcion_corta && (
          <p className="text-muted text-sm mt-1">{recipe.descripcion_corta}</p>
        )}
        <div className="flex flex-wrap gap-2 mt-3">
          {recipe.tipo_comida.slice(0,2).map(t => (
            <span key={t} className="text-xs text-muted">{TIPO_ICONS[t] ?? ''} {t}</span>
          ))}
          {recipe.origen && <Chip>🌎 {recipe.origen}</Chip>}
          {recipe.tiempo_total_min && <Chip>⏱ {recipe.tiempo_total_min}min</Chip>}
          {recipe.dificultad && (
            <span className={`px-2 py-0.5 rounded-full border text-xs ${DIFICULTAD_COLOR[recipe.dificultad]}`}>
              {recipe.dificultad}
            </span>
          )}
          {recipe.porciones && <Chip>👥 {recipe.porciones} porciones</Chip>}
        </div>

        {/* Rating del miembro */}
        {memberId && (
          <div className="mt-3">
            <p className="text-xs text-muted mb-1">Tu valoración</p>
            <div className="flex gap-1.5">
              {[1,2,3,4,5].map(s => (
                <button key={s} onClick={() => handleRating(s)}
                  className="text-2xl transition-transform hover:scale-110 active:scale-90"
                  style={{ color: s <= (memberRating ?? 0) ? '#EF9F27' : '#E5E7EB' }}>★</button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="px-4 mb-0">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {(['ingredientes', 'pasos', 'nutricion'] as Tab[]).map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all
                ${activeTab === t ? 'bg-white text-text shadow-sm' : 'text-muted hover:text-text'}`}>
              {t === 'ingredientes' ? '🧅 Ingredientes' : t === 'pasos' ? '📋 Pasos' : '📊 Nutrición'}
            </button>
          ))}
        </div>
      </div>

      {/* Tab: Ingredientes */}
      {activeTab === 'ingredientes' && (
        <div className="px-4 pt-4 flex flex-col gap-4">
          {/* Esenciales */}
          <div>
            <p className="text-xs text-muted uppercase tracking-wider font-semibold mb-2">Esenciales</p>
            <div className="flex flex-col">
              {recipe.ingredientes.filter(i => i.esencial).map((ing, idx) => {
                const tieneEnNevera = inFridge(ing.nombre, fridgeItems)
                return (
                  <div key={idx} className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-accent flex-shrink-0" />
                      <span className="text-text text-sm">{ing.nombre}</span>
                      {ing.cantidad && (
                        <span className="text-muted text-xs">{ing.cantidad} {ing.unidad ?? ''}</span>
                      )}
                    </div>
                    {tieneEnNevera ? (
                      <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full flex-shrink-0">
                        ✓ Tienes
                      </span>
                    ) : (
                      <button onClick={handleAddToList}
                        className="text-xs bg-blue-50 text-blue-600 border border-blue-200 px-2 py-0.5 rounded-full flex-shrink-0 hover:bg-blue-100 transition-all">
                        + Lista
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Opcionales */}
          {recipe.ingredientes.some(i => !i.esencial) && (
            <div>
              <p className="text-xs text-muted uppercase tracking-wider font-semibold mb-2">Opcionales</p>
              <div className="flex flex-col">
                {recipe.ingredientes.filter(i => !i.esencial).map((ing, idx) => (
                  <div key={idx} className="flex items-center gap-2 py-2.5 border-b border-border last:border-0">
                    <span className="w-2 h-2 rounded-full bg-border flex-shrink-0" />
                    <span className="text-text text-sm">{ing.nombre}</span>
                    {ing.cantidad && (
                      <span className="text-muted text-xs ml-auto">{ing.cantidad} {ing.unidad ?? ''}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Pasos */}
      {activeTab === 'pasos' && (
        <div className="px-4 pt-4 flex flex-col gap-4">
          {recipe.pasos.map((paso, i) => (
            <div key={i} className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-accent text-white text-sm font-bold flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
                {i + 1}
              </div>
              <div className="card flex-1 py-3 px-4">
                <p className="text-text text-sm leading-relaxed">{paso}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Nutrición */}
      {activeTab === 'nutricion' && nut && (
        <div className="px-4 pt-4 flex flex-col gap-4">
          <div className="card text-center py-5">
            <p className="text-5xl font-bold text-text">{nut.calorias_porcion}</p>
            <p className="text-muted text-sm mt-1">kcal por porción</p>
            {recipe.porciones && (
              <p className="text-xs text-muted mt-0.5">{recipe.porciones} porciones totales</p>
            )}
          </div>

          <div className="card flex flex-col gap-4">
            <MacroBar label="Proteína"      value={nut.proteina_g}      total={totalMacros} color="bg-blue-500"   unit="g" />
            <MacroBar label="Carbohidratos" value={nut.carbohidratos_g} total={totalMacros} color="bg-yellow-400" unit="g" />
            <MacroBar label="Grasa"         value={nut.grasa_g}         total={totalMacros} color="bg-red-400"    unit="g" />
          </div>

          {recipe.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {recipe.tags.map(t => (
                <span key={t} className="px-2.5 py-1 bg-accent-light text-accent text-xs rounded-full">{t}</span>
              ))}
            </div>
          )}
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

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="px-2 py-0.5 bg-white border border-border text-muted text-xs rounded-full">
      {children}
    </span>
  )
}

function MacroBar({ label, value, total, color, unit }: {
  label: string; value: number; total: number; color: string; unit: string
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-text font-medium">{label}</span>
        <span className="text-sm font-semibold text-text">{value}{unit} <span className="text-xs text-muted font-normal">({pct}%)</span></span>
      </div>
      <div className="w-full bg-border rounded-full h-2.5 overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
