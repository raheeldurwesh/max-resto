// src/services/menuService.js
// All menu-related DB operations and image uploads
// UPDATED: restaurant_id filtering for multi-tenant SaaS

import { supabase } from '../supabase/client'

const TABLE  = 'menu'
const BUCKET = 'menu-images'

// ── Image upload ─────────────────────────────────────────────────────────────
export async function uploadMenuImage(file) {
  const ext  = file.name.split('.').pop()
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: false, contentType: file.type })

  if (upErr) throw new Error(`Image upload failed: ${upErr.message}`)

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('storage-updated'))
  }
  
  return data.publicUrl
}

// ── Delete image from Storage ─────────────────────────────────────────────────
export async function deleteMenuImage(publicUrl) {
  if (!publicUrl) return
  try {
    const marker = `${BUCKET}/`
    const idx    = publicUrl.indexOf(marker)
    if (idx === -1) return
    const path = publicUrl.slice(idx + marker.length)
    await supabase.storage.from(BUCKET).remove([path])
    
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('storage-updated'))
    }
  } catch {
    console.warn('Could not delete image from storage:', publicUrl)
  }
}

// ── Fetch menu items (filtered by restaurant_id) ─────────────────────────────
export async function fetchMenu(restaurantId) {
  if (!restaurantId) return [] // Never fetch unscoped menu

  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

// ── Add menu item ─────────────────────────────────────────────────────────────
export async function addMenuItem(formData, imageFile, restaurantId) {
  let imageUrl = formData.imageUrl || ''
  if (imageFile) imageUrl = await uploadMenuImage(imageFile)

  const row = {
    name:        formData.name.trim(),
    description: formData.description?.trim() || '',
    price:       Number(formData.price),
    category:    formData.category || 'Other',
    available:   formData.available !== false,
    image_url:   imageUrl,
    food_type:   formData.foodType || '',
  }
  if (restaurantId) row.restaurant_id = restaurantId

  const { data, error } = await supabase.from(TABLE).insert(row).select().single()
  if (error) throw error
  return data
}

// ── Update menu item ──────────────────────────────────────────────────────────
export async function updateMenuItem(id, formData, imageFile) {
  let imageUrl = formData.imageUrl || formData.image_url || ''

  if (imageFile) {
    const newImageUrl = await uploadMenuImage(imageFile)
    const oldUrl = formData.imageUrl || formData.image_url
    if (oldUrl && oldUrl !== newImageUrl) {
      await deleteMenuImage(oldUrl)
    }
    imageUrl = newImageUrl
  }

  const { data, error } = await supabase.from(TABLE).update({
    name:        formData.name.trim(),
    description: formData.description?.trim() || '',
    price:       Number(formData.price),
    category:    formData.category || 'Other',
    available:   formData.available !== false,
    image_url:   imageUrl,
    food_type:   formData.foodType || '',
  }).eq('id', id).select().single()

  if (error) throw error
  return data
}

// ── Delete menu item ──────────────────────────────────────────────────────────
export async function deleteMenuItem(id, imageUrl) {
  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  if (error) throw error
  await deleteMenuImage(imageUrl)
}

// ── Toggle availability ───────────────────────────────────────────────────────
export async function toggleItemAvailability(id, current) {
  const { error } = await supabase
    .from(TABLE)
    .update({ available: !current })
    .eq('id', id)
  if (error) throw error
}

// ── Subscribe to real-time changes ───────────────────────────────────────────
export function subscribeToMenu(onChange, restaurantId) {
  const channelName = `menu-changes-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  
  const filter = restaurantId
    ? { event: '*', schema: 'public', table: TABLE, filter: `restaurant_id=eq.${restaurantId}` }
    : { event: '*', schema: 'public', table: TABLE }

  const channel = supabase
    .channel(channelName)
    .on('postgres_changes', filter, onChange)
    .subscribe()

  return () => supabase.removeChannel(channel)
}
