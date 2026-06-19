import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const ALLOWED_ORIGINS = [
  'https://razborka.net',
  'https://www.razborka.net',
  'http://localhost:5173',
  'http://localhost:4173',
]

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin') ?? ''
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Верифицируем вызывающего и проверяем что он admin
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } })
    }

    const { data: callerRoles } = await supabaseAdmin.from('user_roles').select('roles(name)').eq('user_id', user.id)
    const isAdmin = (callerRoles as any[])?.some((ur: any) => ur.roles?.name === 'admin')
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Only administrators can impersonate' }), { status: 403, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } })
    }

    const { userId } = await req.json()
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Missing userId' }), { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } })
    }
    if (userId === user.id) {
      return new Response(JSON.stringify({ error: 'Cannot impersonate yourself' }), { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } })
    }

    // Нельзя входить под другим админом
    const { data: targetRoles } = await supabaseAdmin.from('user_roles').select('roles(name)').eq('user_id', userId)
    if ((targetRoles as any[])?.some((ur: any) => ur.roles?.name === 'admin')) {
      return new Response(JSON.stringify({ error: 'Cannot impersonate another administrator' }), { status: 403, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } })
    }

    // Получаем email цели
    const { data: targetUser, error: getErr } = await supabaseAdmin.auth.admin.getUserById(userId)
    if (getErr || !targetUser?.user?.email) {
      return new Response(JSON.stringify({ error: 'Target user not found' }), { status: 404, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } })
    }
    const email = targetUser.user.email

    // Генерируем magic-link токен для входа под целью
    const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({ type: 'magiclink', email })
    if (linkErr || !linkData?.properties?.hashed_token) {
      return new Response(JSON.stringify({ error: 'Failed to generate session', details: linkErr?.message }), { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } })
    }

    const { data: profile } = await supabaseAdmin.from('user_profiles').select('full_name, username').eq('id', userId).maybeSingle()

    return new Response(
      JSON.stringify({
        token_hash: linkData.properties.hashed_token,
        email,
        name: (profile as any)?.full_name || (profile as any)?.username || email,
      }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    )
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || 'Internal server error' }), { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } })
  }
})
