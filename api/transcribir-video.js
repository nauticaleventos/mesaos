// POST /api/transcribir-video
// Obtiene caption y/o transcripción de audio de videos en redes sociales
//
// Requiere variables de entorno:
//   GROQ_API_KEY   — console.groq.com (gratis, sin tarjeta)
//   APIFY_API_TOKEN — apify.com (gratis $5/mes crédito)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { url, plataforma } = req.body
  if (!url) return res.status(400).json({ error: 'url es requerido' })

  const plat = plataforma ?? detectPlatform(url)

  try {
    let caption      = ''
    let transcripcion = ''
    let thumbnail    = null

    // ── TIKTOK ───────────────────────────────────────────────────────────────
    if (plat === 'tiktok') {
      const result = await procesarTikTok(url)
      caption       = result.caption
      transcripcion = result.transcripcion
      thumbnail     = result.thumbnail
    }

    // ── YOUTUBE ──────────────────────────────────────────────────────────────
    else if (plat === 'youtube') {
      const result = await procesarYouTube(url)
      caption       = result.caption
      transcripcion = result.transcripcion
      thumbnail     = result.thumbnail
    }

    // ── INSTAGRAM / FACEBOOK ─────────────────────────────────────────────────
    else if (plat === 'instagram' || plat === 'facebook') {
      const result = await procesarInstagram(url, plat)
      caption       = result.caption
      transcripcion = result.transcripcion
      thumbnail     = result.thumbnail
    }

    else {
      return res.status(400).json({ error: `Plataforma no soportada: ${plat}` })
    }

    // Registrar uso en import_usage (best-effort, no falla si hay error)
    await registrarUso(plat, url).catch(() => {})

    return res.status(200).json({
      plataforma:    plat,
      caption:       caption.trim(),
      transcripcion: transcripcion.trim(),
      thumbnail,
      texto_completo: [caption, transcripcion].filter(Boolean).join('\n\n').trim(),
    })

  } catch (err) {
    console.error('transcribir-video error:', err)
    return res.status(500).json({
      error:   err.message ?? 'Error al procesar video',
      fallback: 'MANUAL',  // UI debe ofrecer pegar texto manualmente
    })
  }
}

// ─── TIKTOK ──────────────────────────────────────────────────────────────────

async function procesarTikTok(url) {
  let caption   = ''
  let thumbnail = null

  // 1. oEmbed para caption e imagen
  try {
    const oe = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`,
      { signal: AbortSignal.timeout(6000) })
    if (oe.ok) {
      const d = await oe.json()
      caption   = d.title   ?? ''
      thumbnail = d.thumbnail_url ?? null
    }
  } catch { /* continuar */ }

  // 2. tikwm.com → URL de audio → Groq Whisper
  let transcripcion = ''
  const groqKey = process.env.GROQ_API_KEY
  if (groqKey) {
    try {
      // Obtener URL de audio via tikwm
      const tikwmRes = await fetch(
        `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}&hd=1`,
        { signal: AbortSignal.timeout(10000) }
      )
      if (tikwmRes.ok) {
        const tikwmData = await tikwmRes.json()
        const audioUrl  = tikwmData?.data?.music ?? tikwmData?.data?.play ?? null

        if (audioUrl) {
          transcripcion = await transcribirConGroq(audioUrl, groqKey)
        }
      }
    } catch (err) {
      console.warn('tikwm/Groq falló:', err.message)
      // Fallback silencioso — solo usamos caption
    }
  } else {
    console.warn('GROQ_API_KEY no configurada — solo caption disponible')
  }

  return { caption, transcripcion, thumbnail }
}

// ─── YOUTUBE ─────────────────────────────────────────────────────────────────

async function procesarYouTube(url) {
  let caption   = ''
  let thumbnail = null

  // 1. oEmbed → título + canal
  try {
    const oe = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
      { signal: AbortSignal.timeout(6000) })
    if (oe.ok) {
      const d = await oe.json()
      caption   = `${d.title ?? ''}\nCanal: ${d.author_name ?? ''}`
      thumbnail = d.thumbnail_url ?? null
    }
  } catch { /* continuar */ }

  // 2. og:description de la página (suele tener descripción del video con ingredientes)
  try {
    const pageRes = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; mesa.os)' },
      signal: AbortSignal.timeout(8000),
    })
    if (pageRes.ok) {
      const html = await pageRes.text()
      const desc = (
        html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]{10,})"/i) ||
        html.match(/<meta[^>]+name="description"[^>]+content="([^"]{10,})"/i)
      )?.[1] ?? ''
      if (desc) caption += `\n\nDescripción: ${desc.substring(0, 3000)}`
    }
  } catch { /* ignorar */ }

  // 3. Intentar captions automáticos de YouTube
  let transcripcion = ''
  const videoId = extraerYouTubeId(url)
  if (videoId) {
    const caps = await obtenerCaptionsYouTube(videoId)
    if (caps) {
      transcripcion = caps
    } else {
      // Fallback: Groq si hay key (YouTube requiere descargar audio vía cobalt/otro)
      // TODO: implementar descarga de audio YouTube cuando tengamos servicio confiable
      console.log('YouTube sin captions disponibles — usando solo og:description')
    }
  }

  return { caption, transcripcion, thumbnail }
}

// ─── INSTAGRAM / FACEBOOK ────────────────────────────────────────────────────

async function procesarInstagram(url, plat) {
  const apifyToken = process.env.APIFY_API_TOKEN

  if (!apifyToken) {
    console.warn('APIFY_API_TOKEN no configurado — Instagram no disponible')
    throw new Error('INSTAGRAM_BLOCKED')
  }

  // Apify Instagram Post Scraper
  // Actor: apify/instagram-scraper o apify/instagram-reel-scraper
  // Apify usa ~ como separador en la API (no /)
  const actorId = plat === 'facebook' ? 'apify~facebook-posts-scraper' : 'apify~instagram-scraper'

  try {
    // Lanzar el actor de Apify (sync — espera resultado)
    const runRes = await fetch(`https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?timeout=50`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apifyToken}`,
      },
      body: JSON.stringify({
        directUrls:  [url],
        resultsType: 'posts',
        resultsLimit: 1,
        addParentData: false,
      }),
      signal: AbortSignal.timeout(55000),
    })

    if (!runRes.ok) {
      const errText = await runRes.text()
      console.error(`Apify error ${runRes.status}:`, errText.substring(0, 500))
      throw new Error(`Apify error ${runRes.status}: ${errText.substring(0, 200)}`)
    }

    const items = await runRes.json()
    const post  = Array.isArray(items) ? items[0] : null

    if (!post) throw new Error('Apify no devolvió datos del post')

    const caption   = post.caption ?? post.text ?? post.description ?? ''
    // displayUrl de Instagram CDN expira y no es fetchable desde Vercel → ignorar
    const thumbnail = null
    // Apify a veces incluye videoUrl para transcripción
    const videoUrl  = post.videoUrl ?? null

    let transcripcion = ''
    const groqKey = process.env.GROQ_API_KEY
    if (groqKey && videoUrl) {
      transcripcion = await transcribirConGroq(videoUrl, groqKey).catch(() => '')
    }

    return { caption, transcripcion, thumbnail }

  } catch (err) {
    if (err.message === 'INSTAGRAM_BLOCKED') throw err
    console.error('Apify Instagram error:', err.message)
    throw new Error('INSTAGRAM_BLOCKED')  // UI mostrará fallback
  }
}

// ─── GROQ WHISPER ────────────────────────────────────────────────────────────

async function transcribirConGroq(audioUrl, groqKey) {
  // Descargar audio en memoria
  const audioRes = await fetch(audioUrl, { signal: AbortSignal.timeout(20000) })
  if (!audioRes.ok) throw new Error(`No se pudo descargar el audio: ${audioRes.status}`)

  const audioBuffer = await audioRes.arrayBuffer()
  const audioBlob   = new Blob([audioBuffer], { type: 'audio/mpeg' })

  // Enviar a Groq Whisper
  const form = new FormData()
  form.append('file', audioBlob, 'audio.mp3')
  form.append('model', 'whisper-large-v3-turbo')
  form.append('language', 'es')  // español latinoamericano primero
  form.append('response_format', 'text')

  const groqRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${groqKey}` },
    body: form,
    signal: AbortSignal.timeout(30000),
  })

  if (!groqRes.ok) {
    const err = await groqRes.text()
    throw new Error(`Groq error ${groqRes.status}: ${err.substring(0, 200)}`)
  }

  return await groqRes.text()
}

// ─── YOUTUBE CAPTIONS ────────────────────────────────────────────────────────

async function obtenerCaptionsYouTube(videoId) {
  // Intentar captions automáticos en español e inglés
  for (const lang of ['es', 'en']) {
    try {
      const res = await fetch(
        `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}&fmt=json3`,
        { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; mesa.os)' },
          signal: AbortSignal.timeout(5000) }
      )
      if (res.ok) {
        const data = await res.json()
        const text = (data.events ?? [])
          .flatMap(e => (e.segs ?? []).map(s => s.utf8 ?? ''))
          .join(' ')
          .replace(/\n/g, ' ')
          .trim()
        if (text.length > 50) return text
      }
    } catch { /* siguiente idioma */ }
  }
  return null
}

function extraerYouTubeId(url) {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  )
  return match?.[1] ?? null
}

// ─── REGISTRO DE USO ─────────────────────────────────────────────────────────

async function registrarUso(plataforma, url) {
  // TODO: conectar a Supabase para guardar en tabla import_usage
  // Por ahora solo log
  console.log(`[import_usage] plataforma=${plataforma} url=${url.substring(0, 80)}`)
}

// ─── DETECTAR PLATAFORMA ─────────────────────────────────────────────────────

function detectPlatform(url) {
  if (/instagram\.com/i.test(url))            return 'instagram'
  if (/tiktok\.com/i.test(url))               return 'tiktok'
  if (/youtube\.com|youtu\.be/i.test(url))    return 'youtube'
  if (/facebook\.com|fb\.watch/i.test(url))   return 'facebook'
  return 'web'
}
