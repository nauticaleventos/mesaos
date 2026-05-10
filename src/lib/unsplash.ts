export interface UnsplashPhoto {
  url:       string
  fotografo: string
  perfil:    string
}

export async function buscarFotoUnsplash(query: string): Promise<UnsplashPhoto | null> {
  const key = import.meta.env.VITE_UNSPLASH_ACCESS_KEY
  if (!key) return null
  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query + ' food dish')}&orientation=landscape&content_filter=high&per_page=1`,
      { headers: { Authorization: `Client-ID ${key}` } }
    )
    const data = await res.json()
    const photo = data.results?.[0]
    if (!photo) return null
    return {
      url:       photo.urls?.regular ?? photo.urls?.full,
      fotografo: photo.user?.name ?? 'Unsplash',
      perfil:    photo.user?.links?.html ?? 'https://unsplash.com',
    }
  } catch {
    return null
  }
}
