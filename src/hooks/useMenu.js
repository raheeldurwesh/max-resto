// src/hooks/useMenu.js
// Real-time menu hook — supports restaurant_id filtering

import { useState, useEffect, useCallback } from 'react'
import {
  fetchMenu, addMenuItem, updateMenuItem,
  deleteMenuItem, toggleItemAvailability, subscribeToMenu,
} from '../services/menuService'

export function useMenu(restaurantId) {
  const [items,   setItems]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const load = useCallback(async () => {
    try {
      const data = await fetchMenu(restaurantId)
      setItems(data.map(normaliseItem))
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [restaurantId])

  useEffect(() => {
    load()
    // ── Instant Real-time ────────────────────────────────────────────
    const unsub = subscribeToMenu((payload) => {
      console.log('[useMenu] Menu change detected, refreshing instantly...')
      load()
    }, restaurantId)
    return unsub
  }, [load, restaurantId])

  const addItem    = (data, img) => addMenuItem(data, img, restaurantId)
  const updateItem = (id, data, img) => updateMenuItem(id, data, img)
  const deleteItem = (id, imageUrl) => deleteMenuItem(id, imageUrl)
  const toggleAvailability = (id, current) => toggleItemAvailability(id, current)

  return { items, loading, error, addItem, updateItem, deleteItem, toggleAvailability }
}

// Map DB snake_case → UI camelCase
function normaliseItem(row) {
  return {
    id:          row.id,
    name:        row.name,
    description: row.description || '',
    price:       row.price,
    category:    row.category || 'Other',
    available:   row.available !== false,
    imageUrl:    row.image_url || '',
    foodType:    row.food_type || '',
    createdAt:   row.created_at ? new Date(row.created_at) : null,
  }
}
