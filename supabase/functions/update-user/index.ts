import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const ALLOWED_ORIGINS = [
  'https://tsp.pp.ua',
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

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json(req, { error: 'Missing authorization header' }, 401)

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Верифицируем вызывающего
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
    if (userError || !user) return json(req, { error: 'Invalid authentication token' }, 401)

    // Только админ может полностью редактировать пользователя (email/пароль/профиль)
    const { data: callerRoles } = await supabaseAdmin
      .from('user_roles')
      .select('roles(name)')
      .eq('user_id', user.id)
    const roleNames = (callerRoles as any[])?.map((ur: any) => ur.roles?.name) || []
    if (!roleNames.includes('admin')) {
      return json(req, { error: 'Access denied: только администратор' }, 403)
    }

    const { userId, email, password, full_name, phone, username } = await req.json()
    if (!userId) return json(req, { error: 'Missing userId' }, 400)

    if (email !== undefined) {
      const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!email || !emailRe.test(String(email).trim())) {
        return json(req, { error: 'Некорректный email' }, 400)
      }
    }
    if (password !== undefined && String(password).length < 6) {
      return json(req, { error: 'Пароль должен содержать минимум 6 символов' }, 400)
    }

    const normalizedUsername =
      username !== undefined && username !== null && String(username).trim() !== ''
        ? String(username).toLowerCase().trim()
        : undefined

    // username должен быть уникален среди других пользователей
    if (normalizedUsername) {
      const { data: clash } = await supabaseAdmin
        .from('user_profiles')
        .select('id')
        .eq('username', normalizedUsername)
        .neq('id', userId)
        .maybeSingle()
      if (clash) return json(req, { error: 'Этот логин уже занят' }, 400)
    }

    // 1) Обновляем auth.users (email/пароль/метаданные)
    const authUpdate: Record<string, unknown> = {}
    if (email !== undefined) {
      authUpdate.email = String(email).trim()
      authUpdate.email_confirm = true
    }
    if (password !== undefined) authUpdate.password = password
    const meta: Record<string, unknown> = {}
    if (full_name !== undefined) meta.full_name = full_name
    if (phone !== undefined) meta.phone = phone
    if (normalizedUsername) meta.username = normalizedUsername
    if (Object.keys(meta).length) authUpdate.user_metadata = meta

    if (Object.keys(authUpdate).length) {
      const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(userId, authUpdate)
      if (authErr) return json(req, { error: authErr.message }, 500)
    }

    // 2) Обновляем профиль (только переданные поля)
    const profileUpdate: Record<string, unknown> = {}
    if (email !== undefined) profileUpdate.email = String(email).trim()
    if (full_name !== undefined) profileUpdate.full_name = full_name
    if (phone !== undefined) profileUpdate.phone = phone
    if (normalizedUsername) profileUpdate.username = normalizedUsername

    if (Object.keys(profileUpdate).length) {
      const { error: profErr } = await supabaseAdmin
        .from('user_profiles')
        .update(profileUpdate)
        .eq('id', userId)
      if (profErr) return json(req, { error: profErr.message }, 500)
    }

    return json(req, { success: true })
  } catch (error: any) {
    return json(req, { error: error?.message || 'Internal server error' }, 500)
  }
})
