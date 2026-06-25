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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }

  try {
    // ── Авторизация: вызывающий ОБЯЗАН быть аутентифицирован ──
    // Иначе любой аноним мог бы спамить/подделывать «регистрации» в админ-панели.
    const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '').trim()
    if (!jwt) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client with service role for sending notifications
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Верифицируем токен и достаём личность вызывающего
    const { data: { user: caller }, error: callerErr } = await supabaseAdmin.auth.getUser(jwt)
    if (callerErr || !caller) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      )
    }

    const { userId, username, email, fullName } = await req.json()

    if (!username && !email) {
      return new Response(
        JSON.stringify({ error: 'Missing username or email' }),
        { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      )
    }

    // Является ли вызывающий админом? Только админ вправе слать уведомление о ДРУГОМ
    // пользователе (создание юзера в админке). Обычный пользователь может уведомить
    // только о САМОМ СЕБЕ (саморегистрация) — иначе подмена/спам.
    const { data: callerRoles } = await supabaseAdmin
      .from('user_roles')
      .select('roles(name)')
      .eq('user_id', caller.id)
    const callerIsAdmin = (callerRoles ?? []).some((r: any) => r.roles?.name === 'admin')

    const subject = callerIsAdmin
      ? { id: userId || null, username: username || email, fullName: fullName, email: email }
      : { id: caller.id, username: username || caller.email, fullName: fullName, email: caller.email }

    if (!callerIsAdmin && userId && userId !== caller.id) {
      return new Response(
        JSON.stringify({ error: 'Forbidden' }),
        { status: 403, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      )
    }

    // Send notification through Realtime to all admins
    const message = {
      type: 'user_registered',
      timestamp: new Date().toISOString(),
      user: subject
    }

    // Broadcast to admin channel - this will reach all connected admins
    const adminChannel = supabaseAdmin.channel('admin-notifications')
    adminChannel.send('broadcast', {
      event: 'user_registered',
      payload: message
    })

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Notification sent to admins'
      }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('Error sending notification:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    )
  }
})
