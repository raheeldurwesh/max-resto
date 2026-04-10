// src/services/orderService.js
// All order DB operations — place, update status, delete, real-time subscription
// UPDATED: restaurant_id filtering for multi-tenant SaaS

import { supabase } from '../supabase/client'

const TABLE = 'orders'

function generateOrderId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

// ── Fetch orders (filtered by restaurant_id) ─────────────────────────────────
export async function fetchOrders(restaurantId) {
  if (!restaurantId) return [] // Never fetch unscoped orders

  const { data, error } = await supabase
    .from(TABLE)
    .select('*, order_items(*)')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data || []).map(normalise)
}

// ── Place a new order ─────────────────────────────────────────────────────────
export async function placeOrder({ table, items, total, tax, note, customerName, instructions, restaurantId }) {
  // --- Try secure RPC first ---
  try {
    const secureItems = items.map(i => ({
      menu_item_id: i.id,
      qty:          i.qty,
    }))

    const { data, error } = await supabase.rpc('place_order_secure', {
      p_restaurant_id: restaurantId,
      p_table_no:      String(table),
      p_customer_name: (customerName || '').trim(),
      p_items:         secureItems,
      p_note:          (note || '').trim(),
      p_instructions:  (instructions || '').trim(),
    })

    if (error) {
      const msg = (error.message || '').toLowerCase()
      if (msg.includes('function') || msg.includes('not found') || msg.includes('does not exist') || error.code === '42883') {
        console.warn('place_order_secure RPC not found — falling back to direct insert.')
      } else {
        throw error
      }
    } else {
      return data
    }
  } catch (rpcErr) {
    const msg = (rpcErr.message || '').toLowerCase()
    if (!msg.includes('function') && !msg.includes('not found') && !msg.includes('does not exist')) {
      throw rpcErr
    }
    console.warn('place_order_secure RPC not available — using direct insert fallback.')
  }

  // --- Fallback: direct insert ---
  const orderId = generateOrderId()

  const row = {
    order_id:      orderId,
    table_no:      String(table),
    customer_name: (customerName || '').trim(),
    items:         items.map(i => ({ name: i.name, qty: i.qty, price: i.price })),
    total:         parseFloat(total.toFixed(2)),
    tax:           parseFloat(tax.toFixed(2)),
    note:          (note || '').trim(),
    instructions:  (instructions || '').trim(),
    status:        'pending',
  }
  if (restaurantId) row.restaurant_id = restaurantId

  const { error } = await supabase.from(TABLE).insert(row)
  if (error) throw error
  return orderId
}

// ── Fetch a single order by order_id ─────────────────────────────────────────
export async function fetchOrderByOrderId(orderId) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*, order_items(*)')
    .eq('order_id', orderId)
    .single()

  if (error) throw error
  return normalise(data)
}

// ── Update order status ───────────────────────────────────────────────────────
export async function updateOrderStatus(id, status) {
  const { error } = await supabase
    .from(TABLE)
    .update({ status })
    .eq('id', id)
  if (error) throw error
}

// ── Update order items (admin/waiter edit) ────────────────────────────────────
export async function updateOrderItems(id, items, subtotal, tax) {
  const { error } = await supabase
    .from(TABLE)
    .update({
      items:  items.map(i => ({ name: i.name, qty: i.qty, price: i.price })),
      total:  parseFloat(subtotal.toFixed(2)),
      tax:    parseFloat(tax.toFixed(2)),
    })
    .eq('id', id)
  if (error) throw error
}

// ── Delete a single order ─────────────────────────────────────────────────────
export async function deleteOrder(id) {
  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  if (error) throw error
}

// ── Delete all orders (scoped by restaurant_id) ───────────────────────────────
export async function deleteAllOrders(restaurantId) {
  let query = supabase.from(TABLE).delete()

  if (restaurantId) {
    query = query.eq('restaurant_id', restaurantId)
  } else {
    query = query.neq('id', '00000000-0000-0000-0000-000000000000')
  }

  const { error } = await query
  if (error) throw error
}

// ── Real-time subscription ────────────────────────────────────────────────────
export function subscribeToOrders(onChange, restaurantId) {
  const channelName = `orders-changes-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  console.log(`[Supabase] Subscribing to ${channelName}...`)

  const filter = restaurantId
    ? { event: '*', schema: 'public', table: TABLE, filter: `restaurant_id=eq.${restaurantId}` }
    : { event: '*', schema: 'public', table: TABLE }

  const channel = supabase
    .channel(channelName)
    .on('postgres_changes', filter, (payload) => {
      console.log(`[Supabase] REALTIME PAYLOAD for ${TABLE}:`, payload)
      onChange(payload)
    })
    .subscribe((status, err) => {
      console.log(`[Supabase] Channel ${channelName} status:`, status, err || '')
    })

  return () => {
    console.log(`[Supabase] Unsubscribing ${channelName}`)
    supabase.removeChannel(channel)
  }
}

// ── Internal: normalise DB row → UI shape ─────────────────────────────────────
export function normalise(row) {
  // Bridge normalized order_items into the legacy .items array shape if order_items exists
  const resolvedItems = (row.order_items && row.order_items.length > 0)
    ? row.order_items.map(i => ({ id: i.menu_item_id, name: i.name, qty: i.qty, price: i.price }))
    : (row.items || [])

  return {
    id:           row.id,
    orderId:      row.order_id,
    table:        row.table_no,
    customerName: row.customer_name || '',
    items:        resolvedItems,
    total:        row.total         || 0,
    tax:          row.tax           || 0,
    note:         row.note          || '',
    instructions: row.instructions  || '',
    status:       row.status        || 'pending',
    restaurantId: row.restaurant_id || null,
    createdAt:    row.created_at ? new Date(row.created_at) : null,
  }
}
