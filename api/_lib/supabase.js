// api/_lib/supabase.js
// -----------------------------------------------------------------------------
// Punto ÚNICO de configuración de Supabase para el backend (funciones de /api).
// Unifica los nombres de env var que estaban dispersos:
//   URL:         SUPABASE_URL            (fallback VITE_SUPABASE_URL)
//   service key: SUPABASE_SERVICE_KEY    (fallback SUPABASE_SERVICE_ROLE_KEY)
//   anon key:    SUPABASE_ANON_KEY       (fallback VITE_SUPABASE_ANON_KEY)
// La resolución es un SUPERSET de lo que leía cada archivo, así nadie pierde acceso.
//
// Carpeta `_lib`: Vercel ignora archivos/carpetas con prefijo `_` para el routing,
// así que esto NO se expone como endpoint — es solo código compartido.
// -----------------------------------------------------------------------------

import { createClient } from '@supabase/supabase-js'

export const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || null

export const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || null

export const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || null

/** Cliente admin (service role) — bypassa RLS. Escrituras server-side, webhooks, crons.
 *  Devuelve null si falta configuración (el caller decide el error). */
export function adminClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } })
}

/** Cliente con anon key — para validar JWTs de usuario vía auth.getUser(jwt).
 *  Cae a la service key si no hay anon (getUser usa el jwt pasado, no la key). */
export function authClient() {
  const key = SUPABASE_ANON_KEY || SUPABASE_SERVICE_KEY
  if (!SUPABASE_URL || !key) return null
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false } })
}
