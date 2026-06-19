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
    const { userId, username, email, fullName } = await req.json()

    if (!username && !email) {
      return new Response(
        JSON.stringify({ error: 'Missing username or email' }),
        { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
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

    // Get admin role id first
    const { data: adminRole, error: adminRoleError } = await supabaseAdmin
      .from('roles')
      .select('id')
      .eq('name', 'admin')
      .single()

    if (adminRoleError || !adminRole) {
      console.error('Failed to get admin role:', adminRoleError)
      throw new Error('Admin role not found')
    }

    // Get all admin user ids
    const { data: adminUserRoles, error: adminRolesError } = await supabaseAdmin
      .from('user_roles')
      .select('user_id')
      .eq('role_id', adminRole.id)

    if (adminRolesError) {
      console.error('Failed to get admin users:', adminRolesError)
      throw new Error('Failed to get admin users')
    }

    console.log('Found admin users:', adminUserRoles)

    // Send notification through Realtime to all admins
    const message = {
      type: 'user_registered',
      timestamp: new Date().toISOString(),
      user: {
        id: userId,
        username: username || email,
        fullName: fullName,
        email: email
      }
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
