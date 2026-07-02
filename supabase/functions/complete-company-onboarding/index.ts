import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { token, company, owner } = await req.json()

    if (!token) {
      return new Response(JSON.stringify({ error: 'token is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!company?.name || !owner?.full_name || !owner?.username || !owner?.password) {
      return new Response(JSON.stringify({ error: 'company and owner fields are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: invite, error: inviteError } = await supabaseAdmin
      .from('company_onboarding_invites')
      .select('*')
      .eq('token', token)
      .maybeSingle()

    if (inviteError) {
      return new Response(JSON.stringify({ error: 'Failed to load invite', details: inviteError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!invite) {
      return new Response(JSON.stringify({ error: 'Invite not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (invite.status !== 'pending') {
      return new Response(JSON.stringify({ error: `Invite is ${invite.status}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (new Date(invite.expires_at) < new Date()) {
      await supabaseAdmin
        .from('company_onboarding_invites')
        .update({ status: 'expired' })
        .eq('id', invite.id)

      return new Response(JSON.stringify({ error: 'Invite expired' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const username = String(owner.username).trim().toLowerCase()
    const email = owner.email?.trim() || `${username}@internal.local`

    const { data: existingProfile, error: existingProfileError } = await supabaseAdmin
      .from('user_profiles')
      .select('id')
      .eq('username', username)
      .maybeSingle()

    if (existingProfileError) {
      return new Response(JSON.stringify({ error: 'Failed to check username', details: existingProfileError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (existingProfile) {
      return new Response(JSON.stringify({ error: 'Username already taken' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: authUserData, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: owner.password,
      email_confirm: true,
      user_metadata: {
        username,
        real_email: owner.email?.trim() || null,
      },
    })

    if (createUserError || !authUserData.user) {
      return new Response(JSON.stringify({ error: 'Failed to create owner auth user', details: createUserError?.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const ownerUserId = authUserData.user.id
    const roleName = 'parts_owner'

    const { data: ownerRole, error: ownerRoleError } = await supabaseAdmin
      .from('roles')
      .select('id')
      .eq('name', roleName)
      .single()

    if (ownerRoleError || !ownerRole?.id) {
      await supabaseAdmin.auth.admin.deleteUser(ownerUserId)
      return new Response(JSON.stringify({ error: 'Failed to resolve owner role', details: ownerRoleError?.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let companyId: string | null = null

    const { data: companyData, error: companyError } = await supabaseAdmin
      .from('parts_companies')
      .insert({
        name: company.name,
        address: company.address || null,
        phone: company.phone || null,
        email: company.email || null,
        description: company.description || null,
        is_active: true,
      })
      .select('id')
      .single()

    if (companyError || !companyData?.id) {
      await supabaseAdmin.auth.admin.deleteUser(ownerUserId)
      return new Response(JSON.stringify({ error: 'Failed to create parts company', details: companyError?.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    companyId = companyData.id

    // upsert: триггер handle_new_user уже мог создать профиль при createUser → апдейтим его
    const { error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .upsert({
        id: ownerUserId,
        email,
        username,
        full_name: owner.full_name,
        phone: owner.phone || null,
        parts_company_id: companyId,
        is_active: true,
      }, { onConflict: 'id' })

    if (profileError) {
      await supabaseAdmin.from('parts_companies').delete().eq('id', companyId)
      await supabaseAdmin.auth.admin.deleteUser(ownerUserId)
      return new Response(JSON.stringify({ error: 'Failed to create owner profile', details: profileError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { error: roleAssignError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: ownerUserId,
        role_id: ownerRole.id,
        is_primary: true,
      })

    if (roleAssignError) {
      await supabaseAdmin.from('parts_companies').delete().eq('id', companyId)
      await supabaseAdmin.from('user_profiles').delete().eq('id', ownerUserId)
      await supabaseAdmin.auth.admin.deleteUser(ownerUserId)
      return new Response(JSON.stringify({ error: 'Failed to assign owner role', details: roleAssignError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { error: inviteUpdateError } = await supabaseAdmin
      .from('company_onboarding_invites')
      .update({
        status: 'used',
        used_at: new Date().toISOString(),
        owner_user_id: ownerUserId,
        company_id: companyId,
      })
      .eq('id', invite.id)

    if (inviteUpdateError) {
      return new Response(JSON.stringify({ error: 'Owner created, but invite update failed', details: inviteUpdateError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({
      success: true,
      companyType: invite.company_type,
      companyId,
      ownerUserId,
      username,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
