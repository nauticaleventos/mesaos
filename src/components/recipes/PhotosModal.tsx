import { useEffect, useRef, useState } from 'react'
import { X, Camera, Star, Trash2, Upload } from 'lucide-react'
import { useRecipePhotosStore } from '../../store/recipePhotosStore'
import { useFamilyStore } from '../../store/familyStore'
import { useAuthStore } from '../../store/authStore'

interface Props {
  recipeId:  string
  recipeName: string
  onClose:   () => void
  onPrimaryChange?: (url: string | null) => void
}

export default function PhotosModal({ recipeId, recipeName, onClose, onPrimaryChange }: Props) {
  const { family, members }                                    = useFamilyStore()
  const { session }                                            = useAuthStore()
  const { photos, loading, uploading, loadPhotos, uploadPhoto, setPrimary, deletePhoto } = useRecipePhotosStore()

  const [preview,     setPreview]     = useState<string | null>(null)
  const [previewFile, setPreviewFile] = useState<File | null>(null)
  const [makePrimary, setMakePrimary] = useState(true)
  const [confirmDel,  setConfirmDel]  = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const myMemberId = members.find(m => m.linked_user_id === session?.user?.id)?.id ?? ''

  useEffect(() => {
    if (family?.id) loadPhotos(recipeId, family.id)
  }, [recipeId, family?.id])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setPreviewFile(f)
    setPreview(URL.createObjectURL(f))
  }

  const handleUpload = async () => {
    if (!previewFile || !family?.id || !myMemberId) return
    const photo = await uploadPhoto({
      file:        previewFile,
      recipeId,
      familyId:    family.id,
      memberId:    myMemberId,
      makePrimary,
    })
    setPreview(null)
    setPreviewFile(null)
    if (photo?.is_primary) onPrimaryChange?.(photo.public_url)
  }

  const handleSetPrimary = async (photoId: string) => {
    if (!family?.id) return
    await setPrimary(photoId, recipeId, family.id)
    const p = photos.find(x => x.id === photoId)
    onPrimaryChange?.(p?.public_url ?? null)
  }

  const handleDelete = async (photoId: string) => {
    const p = photos.find(x => x.id === photoId)
    if (!p) return
    await deletePhoto(p)
    if (p.is_primary) onPrimaryChange?.(null)
    setConfirmDel(null)
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-end justify-center pointer-events-none">
        <div className="bg-white rounded-t-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto pointer-events-auto" style={{ backgroundColor: '#ffffff', isolation: 'isolate' }}>
          <div className="flex flex-col gap-4 p-5 pb-10">

            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900">Fotos de la receta</p>
                <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[220px]">{recipeName}</p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-gray-100">
                <X size={18} className="text-gray-400" />
              </button>
            </div>

            {/* Preview antes de subir */}
            {preview && (
              <div className="flex flex-col gap-3">
                <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden">
                  <img src={preview} alt="preview" className="w-full h-full object-cover" />
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={makePrimary}
                    onChange={e => setMakePrimary(e.target.checked)}
                    className="w-4 h-4 accent-orange-500" />
                  <span className="text-sm text-gray-700">Usar como foto principal de la receta</span>
                </label>
                <div className="flex gap-2">
                  <button onClick={() => { setPreview(null); setPreviewFile(null) }}
                    className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 font-medium">
                    Cancelar
                  </button>
                  <button onClick={handleUpload} disabled={uploading}
                    className="flex-1 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
                    {uploading ? (
                      <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Subiendo...</>
                    ) : (
                      <><Upload size={15} /> Subir foto</>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Botón de agregar foto */}
            {!preview && (
              <>
                <input ref={inputRef} type="file" accept="image/*" capture="environment"
                  className="hidden" onChange={handleFileChange} />
                <button onClick={() => inputRef.current?.click()}
                  className="w-full py-3 rounded-2xl border-2 border-dashed border-orange-300 bg-orange-50 text-orange-500 font-semibold text-sm flex items-center justify-center gap-2 hover:bg-orange-100 transition-colors">
                  <Camera size={18} /> Tomar foto o elegir de galería
                </button>
              </>
            )}

            {/* Galería de fotos existentes */}
            {loading && (
              <div className="flex justify-center py-4">
                <span className="w-6 h-6 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
              </div>
            )}

            {!loading && photos.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Fotos de tu familia ({photos.length})
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {photos.map(p => (
                    <div key={p.id} className="relative aspect-[4/3] rounded-xl overflow-hidden">
                      <img src={p.public_url} alt="receta" className="w-full h-full object-cover" />

                      {/* Badge principal */}
                      {p.is_primary && (
                        <div className="absolute top-2 left-2 flex items-center gap-1 bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                          <Star size={9} fill="white" /> Principal
                        </div>
                      )}

                      {/* Acciones */}
                      <div className="absolute bottom-0 inset-x-0 flex justify-between items-center p-2 bg-gradient-to-t from-black/60 to-transparent">
                        {!p.is_primary && (
                          <button onClick={() => handleSetPrimary(p.id)}
                            className="text-[10px] text-white/90 font-medium bg-black/30 px-2 py-0.5 rounded-full hover:bg-black/50">
                            ★ Principal
                          </button>
                        )}
                        <button onClick={() => setConfirmDel(p.id)}
                          className="ml-auto p-1 rounded-full bg-black/30 hover:bg-red-500/80 transition-colors">
                          <Trash2 size={12} className="text-white" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!loading && photos.length === 0 && !preview && (
              <p className="text-center text-sm text-gray-400 py-2">
                Aún no hay fotos de esta receta. ¡Sé el primero en subir una!
              </p>
            )}

          </div>
        </div>
      </div>

      {/* Confirm delete */}
      {confirmDel && (
        <>
          <div className="fixed inset-0 bg-black/60 z-60" onClick={() => setConfirmDel(null)} />
          <div className="fixed inset-0 z-70 flex items-center justify-center px-6 pointer-events-none">
            <div className="bg-white rounded-2xl p-5 w-full max-w-xs pointer-events-auto flex flex-col gap-4">
              <p className="font-semibold text-gray-900">¿Eliminar foto?</p>
              <p className="text-sm text-gray-500">Esta acción no se puede deshacer.</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmDel(null)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 font-medium">
                  Cancelar
                </button>
                <button onClick={() => handleDelete(confirmDel)}
                  className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold">
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
