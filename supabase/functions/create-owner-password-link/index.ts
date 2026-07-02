import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid authentication token', details: userError?.message }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { companyType, ownerUserId, companyId, note, expiresInHours = 24 } = await req.json()
    if (!companyType || !ownerUserId || !companyId) {
      return new Response(JSON.stringify({ error: 'companyType, ownerUserId and companyId are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: adminRole } = await supabaseAdmin
      .from('roles')
      .select('id')
      .eq('name', 'admin')
      .single()

    const { data: adminMembership } = await supabaseAdmin
      .from('user_roles')
      .select('user_id')
      .eq('user_id', user.id)
      .eq('role_id', adminRole?.id)
      .maybeSingle()

    if (!adminMembership) {
      return new Response(JSON.stringify({ error: 'Only administrators can create password links' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const token = crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '')
    const expiresAt = new Date(Date.now() + Number(expiresInHours) * 60 * 60 * 1000).toISOString()

    const { data: invite, error: inviteError } = await supabaseAdmin
      .from('company_onboarding_invites')
      .insert({
        token,
        invite_type: 'password_reset',
        company_type: companyType,
        status: 'pending',
        created_by: user.id,
        expires_at: expiresAt,
        owner_user_id: ownerUserId,
        company_id: companyId,
        note: note || null,
      })
      .select('id, token, company_type, invite_type, status, expires_at')
      .single()

    if (inviteError) {
      return new Response(JSON.stringify({ error: 'Failed to create password link', details: inviteError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const baseUrl = Deno.env.get('WEBSITE_URL') || 'http://localhost:5173'
    const url = `${baseUrl}/owner/password-setup?token=${token}`

    return new Response(JSON.stringify({ success: true, inviteId: invite.id, token, url, invite }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
