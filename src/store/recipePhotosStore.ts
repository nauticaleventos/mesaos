import { create } from 'zustand'
import { supabase } from '../lib/supabase'

export interface RecipePhoto {
  id:           string
  recipe_id:    string
  family_id:    string
  uploaded_by:  string | null
  storage_path: string
  public_url:   string
  is_primary:   boolean
  visibility:   'family_only' | 'family_and_owner' | 'community'
  votes_count:  number
  created_at:   string
}

interface RecipePhotosState {
  photos:       RecipePhoto[]
  loading:      boolean
  uploading:    boolean
  loadPhotos:   (recipeId: string, familyId: string) => Promise<void>
  uploadPhoto:  (opts: UploadOpts) => Promise<RecipePhoto | null>
  setPrimary:   (photoId: string, recipeId: string, familyId: string) => Promise<void>
  deletePhoto:  (photo: RecipePhoto) => Promise<void>
  primaryFor:   (recipeId: string) => RecipePhoto | null
}

interface UploadOpts {
  file:       File
  recipeId:   string
  familyId:   string
  memberId:   string
  makePrimary: boolean
}

/** Comprime la imagen a max 1200x900, JPG quality 85 usando Canvas */
async function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const MAX_W = 1200, MAX_H = 900
      let { width, height } = img
      const ratio = Math.min(MAX_W / width, MAX_H / height, 1)
      width  = Math.round(width  * ratio)
      height = Math.round(height * ratio)

      const canvas = document.createElement('canvas')
      canvas.width  = width
      canvas.height = height
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
      URL.revokeObjectURL(url)
      canvas.toBlob(blob => resolve(blob!), 'image/jpeg', 0.85)
    }
    img.src = url
  })
}

export const useRecipePhotosStore = create<RecipePhotosState>((set, get) => ({
  photos:    [],
  loading:   false,
  uploading: false,

  loadPhotos: async (recipeId, familyId) => {
    set({ loading: true })
    const { data } = await supabase
      .from('recipe_photos')
      .select('*')
      .eq('recipe_id', recipeId)
      .eq('family_id', familyId)
      .order('is_primary', { ascending: false })
      .order('created_at',  { ascending: false })
    set({ photos: (data ?? []) as RecipePhoto[], loading: false })
  },

  uploadPhoto: async ({ file, recipeId, familyId, memberId, makePrimary }) => {
    set({ uploading: true })

    const compressed = await compressImage(file)
    const photoId    = crypto.randomUUID()
    const path       = `${familyId}/${recipeId}/${photoId}.jpg`

    const { error: uploadErr } = await supabase.storage
      .from('recipe-photos')
      .upload(path, compressed, { contentType: 'image/jpeg', upsert: false })

    if (uploadErr) { set({ uploading: false }); return null }

    const { data: { publicUrl } } = supabase.storage
      .from('recipe-photos')
      .getPublicUrl(path)

    // Si va a ser principal, desmarcar las anteriores primero
    if (makePrimary) {
      await supabase.from('recipe_photos')
        .update({ is_primary: false })
        .eq('recipe_id', recipeId)
        .eq('family_id', familyId)
        .eq('is_primary', true)
    }

    const { data } = await supabase.from('recipe_photos').insert({
      recipe_id:    recipeId,
      family_id:    familyId,
      uploaded_by:  memberId,
      storage_path: path,
      public_url:   publicUrl,
      is_primary:   makePrimary,
      visibility:   'family_and_owner',
    }).select().single()

    if (data) {
      set(s => ({ photos: [data as RecipePhoto, ...s.photos], uploading: false }))
    } else {
      set({ uploading: false })
    }
    return data as RecipePhoto | null
  },

  setPrimary: async (photoId, recipeId, familyId) => {
    // Desmarcar todas
    await supabase.from('recipe_photos')
      .update({ is_primary: false })
      .eq('recipe_id', recipeId)
      .eq('family_id', familyId)
    // Marcar la nueva
    await supabase.from('recipe_photos')
      .update({ is_primary: true })
      .eq('id', photoId)

    set(s => ({
      photos: s.photos.map(p => ({
        ...p,
        is_primary: p.id === photoId,
      }))
    }))
  },

  deletePhoto: async (photo) => {
    await supabase.storage.from('recipe-photos').remove([photo.storage_path])
    await supabase.from('recipe_photos').delete().eq('id', photo.id)
    set(s => ({ photos: s.photos.filter(p => p.id !== photo.id) }))
  },

  primaryFor: (recipeId) => {
    return get().photos.find(p => p.recipe_id === recipeId && p.is_primary) ?? null
  },
}))
