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

serve(async (req) => {
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }

  try {
    // Получаем токен из заголовка Authorization
    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader) {
      console.error('No Authorization header');
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client from request (автоматически получает JWT из заголовков)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    )

    // Проверяем авторизацию
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    
    if (userError || !user) {
      console.error('Auth error:', userError)
      return new Response(
        JSON.stringify({ error: 'Invalid authentication token', details: userError?.message }),
        { status: 401, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      )
    }

    console.log('Authenticated user:', user.id, user.email);

    // Get user data from request body
    const { email, password, full_name, phone, role_ids, primary_role_id, sto_company_id, parts_company_id, username } = await req.json()
    
    if (!password) {
      return new Response(
        JSON.stringify({ error: 'Password is required' }),
        { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      )
    }

    // Check if user has admin role
    // Сначала получаем role_ids пользователя
    const { data: userRolesData, error: userRolesError } = await supabaseClient
      .from('user_roles')
      .select('role_id')
      .eq('user_id', user.id)

    console.log('User roles query:', { userRolesData, userRolesError })

    if (userRolesError) {
      console.error('Error fetching user roles:', userRolesError)
      return new Response(
        JSON.stringify({ error: 'Failed to check user permissions', details: userRolesError.message }),
        { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      )
    }

    if (!userRolesData || userRolesData.length === 0) {
      console.error('User has no roles assigned')
      return new Response(
        JSON.stringify({ error: 'User has no roles assigned' }),
        { status: 403, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      )
    }

    // Получаем информацию о ролях
    const roleIds = userRolesData.map(ur => ur.role_id)
    console.log('Role IDs:', roleIds)
    
    const { data: rolesData, error: rolesError } = await supabaseClient
      .from('roles')
      .select('name')
      .in('id', roleIds)

    console.log('Roles data:', { rolesData, rolesError })

    if (rolesError) {
      console.error('Error fetching roles:', rolesError)
      return new Response(
        JSON.stringify({ error: 'Failed to check user permissions', details: rolesError.message }),
        { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      )
    }

    const userRoleNames = rolesData?.map((role: any) => role.name) || []
    const isAdmin = userRoleNames.includes('admin')
    const isStoOwner = userRoleNames.includes('sto_owner')
    const isPartsOwner = userRoleNames.includes('parts_owner')
    const canCreateUsers = isAdmin || isStoOwner || isPartsOwner
    console.log('User roles:', userRoleNames, 'canCreateUsers:', canCreateUsers)
    
    // Create Supabase admin client with service_role key for user creation
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
    
    if (!canCreateUsers) {
      return new Response(
        JSON.stringify({ error: 'Only administrators and company owners can create users' }),
        { status: 403, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      )
    }

    // SECURITY: только админ может задавать произвольные роли и компанию.
    // Владелец компании (sto_owner/parts_owner) может создавать ТОЛЬКО работника
    // СВОЕЙ компании — не доверяем role_ids/company_id из запроса для не-админа,
    // иначе владелец мог бы выдать себе/другому роль admin или чужую компанию.
    let finalRoleIds: string[] = Array.isArray(role_ids) ? role_ids : []
    let finalPrimaryRoleId: string | null = primary_role_id ?? null
    let finalStoCompanyId: string | null = sto_company_id || null
    let finalPartsCompanyId: string | null = parts_company_id || null

    if (!isAdmin) {
      // Компания берётся из профиля вызывающего, а не из тела запроса
      const { data: callerProfile } = await supabaseAdmin
        .from('user_profiles')
        .select('sto_company_id, parts_company_id')
        .eq('id', user.id)
        .single()

      const allowedRoleName = isStoOwner ? 'sto_worker' : 'parts_worker'
      const { data: workerRole, error: workerRoleError } = await supabaseAdmin
        .from('roles')
        .select('id')
        .eq('name', allowedRoleName)
        .single()

      if (workerRoleError || !workerRole) {
        return new Response(
          JSON.stringify({ error: 'Failed to resolve worker role' }),
          { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
        )
      }

      finalRoleIds = [workerRole.id]
      finalPrimaryRoleId = workerRole.id
      finalStoCompanyId = isStoOwner ? (callerProfile?.sto_company_id ?? null) : null
      finalPartsCompanyId = isPartsOwner && !isStoOwner ? (callerProfile?.parts_company_id ?? null) : null
    }

    // Генерируем email-заглушку если не указан
    // Санитизируем username для email — убираем спецсимволы
    const safeUsername = (username || String(Date.now()))
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, '_')
    const finalEmail = email || `${safeUsername}@internal.tsp.local`;

    // Create new user in auth.users
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: finalEmail,
      password,
      email_confirm: true,
      user_metadata: {
        full_name,
        phone
      }
    })
    
    if (createError) {
      throw createError
    }

    if (!newUser.user) {
      throw new Error('Failed to create user')
    }

    // Вставляем запись в таблицу users (требуется для FK user_roles)
    const { error: usersInsertError } = await supabaseAdmin
      .from('users')
      .insert({ id: newUser.user.id, email: finalEmail })

    if (usersInsertError && usersInsertError.code !== '23505') {
      // Игнорируем duplicate key — запись уже есть (триггер мог создать)
      console.error('Users insert error:', usersInsertError)
    }

    // Upsert user profile (UPDATE если профиль уже создан триггером, иначе INSERT)
    // Auto-activate if company is assigned, otherwise require admin confirmation
    const isCompanyAssigned = !!(finalStoCompanyId || finalPartsCompanyId)
    const profilePayload = {
      id: newUser.user.id,
      full_name: full_name || null,
      phone: phone || null,
      email: finalEmail,
      username: username || null,
      sto_company_id: finalStoCompanyId,
      parts_company_id: finalPartsCompanyId,
      is_active: isCompanyAssigned
    }

    const { error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .upsert(profilePayload, { onConflict: 'id' })

    if (profileError) {
      console.error('Profile upsert error:', profileError)
      throw new Error('Ошибка при создании профиля: ' + profileError.message)
    }

    // Add user roles (для не-админа finalRoleIds принудительно = [worker role])
    if (finalRoleIds.length > 0) {
      const newUserRoles = finalRoleIds.map((roleId: string) => ({
        user_id: newUser.user!.id,
        role_id: roleId,
        is_primary: roleId === finalPrimaryRoleId
      }))

      const { error: rolesInsertError } = await supabaseAdmin
        .from('user_roles')
        .insert(newUserRoles)

      if (rolesInsertError) {
        console.error('Roles insert error:', rolesInsertError)
        throw new Error('Ошибка при назначении ролей: ' + rolesInsertError.message)
      }
    }

    // Send admin notification about user creation
    try {
      const notifyPayload = {
        userId: newUser.user.id,
        username: username || newUser.user.email,
        email: finalEmail,
        fullName: full_name || null
      }

      // We can't make HTTP calls from Edge Functions easily, so we'll use Realtime instead
      // The client-side code will handle notifications
      console.log('User created - notification should be sent from client:', notifyPayload)
    } catch (notifyError) {
      console.error('Error preparing notification:', notifyError)
      // Don't fail user creation if notification fails
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'User created successfully',
        user: {
          id: newUser.user.id,
          email: newUser.user.email
        }
      }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('Error creating user:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    )
  }
})
