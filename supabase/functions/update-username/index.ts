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
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } })

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !user) return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } })

    const { data: roles } = await supabaseAdmin.from('user_roles').select('roles(name)').eq('user_id', user.id)
    const isAdmin = (roles as any[])?.some((r: any) => r.roles?.name === 'admin')
    if (!isAdmin) return new Response(JSON.stringify({ error: 'Admin only' }), { status: 403, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } })

    const { targetUserId, newUsername } = await req.json()
    if (!targetUserId || !newUsername) return new Response(JSON.stringify({ error: 'Missing params' }), { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } })

    if (!/^[a-zA-Z0-9_]{3,30}$/.test(newUsername)) {
      return new Response(JSON.stringify({ error: 'Логин: 3-30 символов, только латиница, цифры, _' }), { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } })
    }

    const { data: existing } = await supabaseAdmin.from('user_profiles').select('id').eq('username', newUsername.toLowerCase()).neq('id', targetUserId).maybeSingle()
    if (existing) return new Response(JSON.stringify({ error: 'Этот логин уже занят' }), { status: 409, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } })

    const { data: { user: targetUser } } = await supabaseAdmin.auth.admin.getUserById(targetUserId)
    if (!targetUser) return new Response(JSON.stringify({ error: 'User not found' }), { status: 404, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } })

    const fakeEmailDomains = ['@internal.tsp.local', '@internal.local', '@sto-worker.local', '@example.com']
    const isFakeEmail = fakeEmailDomains.some(d => targetUser.email?.endsWith(d))

    if (isFakeEmail) {
      await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
        email: `${newUsername.toLowerCase()}@internal.tsp.local`
      })
    }

    await supabaseAdmin.from('user_profiles').update({ username: newUsername.toLowerCase() }).eq('id', targetUserId)

    return new Response(JSON.stringify({ success: true }), { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } })
  }
})
