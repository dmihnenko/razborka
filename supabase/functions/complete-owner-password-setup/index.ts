import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { token, password } = await req.json()
    if (!token || !password) {
      return new Response(JSON.stringify({ error: 'token and password are required' }), {
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

    if (invite.invite_type !== 'password_reset') {
      return new Response(JSON.stringify({ error: 'Invite is not a password reset link' }), {
        status: 400,
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
      await supabaseAdmin.from('company_onboarding_invites').update({ status: 'expired' }).eq('id', invite.id)
      return new Response(JSON.stringify({ error: 'Invite expired' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!invite.owner_user_id) {
      return new Response(JSON.stringify({ error: 'Invite has no owner user' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(invite.owner_user_id, { password })
    if (updateError) {
      return new Response(JSON.stringify({ error: 'Failed to update password', details: updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { error: inviteUpdateError } = await supabaseAdmin
      .from('company_onboarding_invites')
      .update({ status: 'used', used_at: new Date().toISOString() })
      .eq('id', invite.id)

    if (inviteUpdateError) {
      return new Response(JSON.stringify({ error: 'Password updated, but invite update failed', details: inviteUpdateError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
