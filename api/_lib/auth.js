// api/_lib/auth.js
// -----------------------------------------------------------------------------
// Auth server-side: valida el JWT de Supabase que manda el cliente en el header
// `Authorization: Bearer <access_token>` y resuelve la FAMILIA del usuario dueño.
// Base de los endpoints de pago (hoy el backend no identificaba usuarios).
//
// Uso en un handler:
//   import { resolveFamily } from './_lib/auth.js'
//   const ctx = await resolveFamily(req)
//   if (ctx.error) return res.status(ctx.status).json({ error: ctx.error })
//   // ctx.user, ctx.family, ctx.familyId disponibles
// -----------------------------------------------------------------------------

import { adminClient, authClient } from './supabase.js'

/**
 * Valida el token y devuelve la familia que el usuario posee como 'owner'.
 * @returns {Promise<{user, family, familyId} | {error: string, status: number}>}
 */
export async function resolveFamily(req) {
  const header = req.headers?.authorization || req.headers?.Authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null
  if (!token) return { error: 'Falta el token de autenticación.', status: 401 }

  const auth = authClient()
  const admin = adminClient()
  if (!auth || !admin) return { error: 'Configuración de Supabase incompleta en el servidor.', status: 500 }

  // 1. Validar el JWT contra Supabase Auth → usuario real.
  const { data: userData, error: userErr } = await auth.auth.getUser(token)
  if (userErr || !userData?.user) return { error: 'Token inválido o expirado.', status: 401 }
  const user = userData.user

  // 2. Resolver la familia que este usuario posee (billing = dueño de la familia).
  //    Se usa el cliente admin (service role) para saltar RLS de forma controlada.
  const { data: fu, error: fuErr } = await admin
    .from('family_users')
    .select('family_id, families(*)')
    .eq('user_id', user.id)
    .eq('base_role', 'owner')
    .eq('is_active', true)
    .maybeSingle()

  if (fuErr) return { error: 'Error consultando la familia.', status: 500 }
  if (!fu || !fu.families) return { error: 'El usuario no es dueño de ninguna familia.', status: 403 }

  return { user, family: fu.families, familyId: fu.family_id }
}
