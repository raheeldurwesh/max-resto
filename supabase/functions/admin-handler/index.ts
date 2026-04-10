import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

serve(async (req) => {
  // 1. Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    
    // Parse Action & Params
    let action = '';
    let params: any = {};

    if (req.method === 'GET') {
      const url = new URL(req.url)
      action = url.searchParams.get('action') || ''
      try {
        params = JSON.parse(url.searchParams.get('params') || '{}')
      } catch { params = {} }
    } else {
      const body = await req.json().catch(() => ({}))
      action = body.action || ''
      params = body.params || {}
    }

    // ── Diagnostic: Ping ──
    if (action === 'ping') {
      return new Response(JSON.stringify({ status: 'ok', msg: 'Gatekeeper v2 is alive' }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    // ── Diagnostic: Debug ──
    if (action === 'debug') {
      const authHeader = req.headers.get('Authorization')
      return new Response(JSON.stringify({ 
        hasUrl: !!supabaseUrl,
        hasServiceKey: !!supabaseServiceKey,
        authHeaderPresent: !!authHeader,
        time: new Date().toISOString()
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ── 1. Secure authorization ──
    const authHeader = req.headers.get('Authorization')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
    
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { 
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    // Client 1: User Context (for identity check)
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false }
    })

    // Client 2: Admin Context (for restricted tasks)
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // ── 2. Identity Check (Standard way) ──
    const token = authHeader.replace(/^bearer /i, '')
    const { data: { user }, error: authError } = await userClient.auth.getUser(token)
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: `Auth Error: ${authError?.message || 'Invalid Session'}` }), { 
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    const requester = user

    // ── 3. Role Check (Must be Super Admin in profiles) ──
    const { data: profile, error: profErr } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', requester.id)
      .maybeSingle()

    if (profErr || profile?.role !== 'super_admin') {
      return new Response(JSON.stringify({ error: `Access Denied: Super Admin only (You are: ${profile?.role || 'none'})` }), { 
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    console.log(`[Gatekeeper] Super Admin verified: ${user.email}`)

    // ── 4. Main Actions ──
    switch (action) {
      case 'getImpersonationLink': {
        const { restaurantId, targetPath = 'admin' } = params
        if (!restaurantId) throw new Error('restaurantId is required')

        // Fetch target admin via RPC
        const { data: users, error: rpcErr } = await adminClient.rpc('get_restaurant_users', { p_restaurant_id: restaurantId })
        if (rpcErr) throw new Error(`Database Error: ${rpcErr.message}`)
        
        const targetAdmin = users?.find((u: any) => u.role?.toLowerCase() === 'admin')
        if (!targetAdmin) throw new Error(`No internal admin found for restaurant: ${restaurantId}`)

        // Get restaurant slug
        const { data: rest, error: restErr } = await adminClient.from('restaurants').select('slug').eq('id', restaurantId).maybeSingle()
        if (restErr || !rest) throw new Error('Restaurant not found in database')

        // Generate magic link
        const host = req.headers.get('origin') || ''
        const { data, error: linkErr } = await adminClient.auth.admin.generateLink({
          type: 'magiclink',
          email: targetAdmin.email,
          options: { redirectTo: `${host}/${rest.slug}/${targetPath}` }
        })

        if (linkErr) throw new Error(`Link Error: ${linkErr.message}`)
        return new Response(JSON.stringify({ link: data.properties.action_link }), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        })
      }

      case 'getStorageStatsByRestaurant': {
        try {
          const { data: menuItems } = await adminClient.from('menu').select('restaurant_id, image_url').not('image_url', 'is', null)
          const { data: files } = await adminClient.storage.from('menu-images').list('', { limit: 1000 })
          
          const sizeMap = new Map<string, number>()
          files?.forEach((f: any) => sizeMap.set(f.name, f.metadata?.size || 0))

          const stats: any = {}
          menuItems?.forEach((item: any) => {
            const rid = item.restaurant_id
            if (!stats[rid]) stats[rid] = { usedBytes: 0, fileCount: 0 }
            const filename = item.image_url?.split('/').pop()
            const size = sizeMap.get(filename) || 0
            if (size > 0) {
              stats[rid].usedBytes += size
              stats[rid].fileCount += 1
            }
          })
          return new Response(JSON.stringify(stats), { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          })
        } catch (e) {
          return new Response(JSON.stringify({}), { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          })
        }
      }

      case 'toggleUserStatus': {
        const { userId, disable } = params
        if (!userId) throw new Error('userId is required')
        
        // 1. Update Auth status (ban or unban)
        const { error: authErr } = await adminClient.auth.admin.updateUserById(userId, {
            ban_duration: disable ? '876000h' : 'none',
        })
        if (authErr) throw authErr

        // 2. Update profile switch
        const { error: profErr } = await adminClient.from('profiles').update({ is_disabled: !!disable }).eq('id', userId)
        if (profErr) throw profErr
        
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      case 'toggleRestaurantStatus': {
        const { restaurantId, setActive } = params
        const isDisabled = !setActive

        // 1. Update restaurant
        const { error: restErr } = await adminClient.from('restaurants').update({ is_active: setActive }).eq('id', restaurantId)
        if (restErr) throw restErr

        // 2. Update all associated users
        const { data: profiles, error: pErr } = await adminClient.from('profiles').select('id, role').eq('restaurant_id', restaurantId)
        if (pErr) throw pErr

        if (profiles) {
          for (const p of profiles) {
            // Never disable super admins
            if (p.role === 'super_admin') continue
            
            // Ban in Auth
            await adminClient.auth.admin.updateUserById(p.id, { 
              ban_duration: setActive ? 'none' : '876000h' 
            })
            // Update Profile
            await adminClient.from('profiles').update({ is_disabled: isDisabled }).eq('id', p.id)
          }
        }
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      case 'deleteRestaurant': {
        const { restaurantId } = params
        const { data: profiles } = await adminClient.from('profiles').select('id').eq('restaurant_id', restaurantId)
        if (profiles) {
          for (const p of profiles) { await adminClient.auth.admin.deleteUser(p.id) }
        }
        const { error: delErr } = await adminClient.from('restaurants').delete().eq('id', restaurantId)
        if (delErr) throw delErr
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      case 'isEmailAvailable': {
        const { email } = params
        const { data } = await adminClient.auth.admin.getUserByEmail(email.trim().toLowerCase())
        return new Response(JSON.stringify({ available: !data?.user }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), { 
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        })
    }

  } catch (err: any) {
    console.error(`[Gatekeeper] Critical error: ${err.message}`)
    return new Response(JSON.stringify({ error: err.message, detailed: true }), { 
      status: 400, 
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json',
        'x-debug-error': err.message.slice(0, 100)
      } 
    })
  }
})
