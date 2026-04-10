// src/hooks/useOrders.js
// Real-time orders hook — supports restaurant_id filtering

import { useState, useEffect, useCallback } from 'react'
import {
  fetchOrders, placeOrder as svcPlace, fetchOrderByOrderId,
  updateOrderStatus, updateOrderItems as svcUpdateItems,
  deleteOrder as svcDelete,
  deleteAllOrders as svcDeleteAll,
  subscribeToOrders,
  normalise,
} from '../services/orderService'

export function useOrders(restaurantId, tableNo) {
  const [orders,  setOrders]  = useState([])
  const [loading, setLoading] = useState(true)

  // ── Cooldown Key (Unique per table) ──────────────────────────────────────────
  const cooldownKey = `lastOrder_${restaurantId || 'anon'}_${tableNo || 'none'}`

  const load = useCallback(async () => {
    if (!restaurantId) {
      setOrders([])
      setLoading(false)
      return
    }
    try {
      const data = await fetchOrders(restaurantId)
      setOrders(data)
    } catch (err) {
      console.error('useOrders fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [restaurantId])

  useEffect(() => {
    if (!restaurantId) {
      setOrders([])
      setLoading(false)
      return
    }
    load()
    
    // ── Instant Real-time ────────────────────────────────────────────
    const unsub = subscribeToOrders((payload) => {
      console.log('[useOrders] Change detected, refreshing instantly...')
      load() 
    }, restaurantId)

    return unsub
  }, [load, restaurantId])

  // ── Cooldown Logic ──────────────────────────────────────────────────────────
  const [orderCooldown, setOrderCooldown] = useState(0)

  useEffect(() => {
    const checkCooldown = () => {
      const lastOrder = localStorage.getItem(cooldownKey)
      if (lastOrder) {
        const diff = Math.floor((Date.now() - parseInt(lastOrder)) / 1000)
        const remaining = Math.max(0, 40 - diff)
        setOrderCooldown(remaining)
      } else {
        setOrderCooldown(0)
      }
    }

    checkCooldown()
    const timer = setInterval(() => {
      setOrderCooldown(prev => (prev > 0 ? prev - 1 : 0))
    }, 1000)

    return () => clearInterval(timer)
  }, [cooldownKey])

  // ── Actions ────────────────────────────────────────────────────────────────
  const placeOrder = async (payload) => {
    // Only enforce cooldown if we have a table No (Customer mode)
    if (tableNo && orderCooldown > 0) {
      throw new Error(`Please wait ${orderCooldown}s before ordering again from Table ${tableNo}.`)
    }

    const id = await svcPlace({ ...payload, restaurantId })
    
    // Set timestamp and start local countdown for THIS table
    localStorage.setItem(cooldownKey, Date.now().toString())
    setOrderCooldown(40)
    
    load()
    return id
  }

  const getOrderByOrderId = (orderId) => fetchOrderByOrderId(orderId)

  const updateStatus = async (id, status) => {
    await updateOrderStatus(id, status)
    load()
  }

  const updateItems = async (id, items, subtotal, tax) => {
    await svcUpdateItems(id, items, subtotal, tax)
    load()
  }

  const deleteOrder = async (id) => {
    await svcDelete(id)
    load()
  }

  const deleteAllOrderHistory = async () => {
    await svcDeleteAll(restaurantId)
    load()
  }

  // ── Derived filter helpers ─────────────────────────────────────────────────
  const todayOrders = orders.filter(o => {
    if (!o.createdAt) return false
    return o.createdAt.toDateString() === new Date().toDateString()
  })

  const monthOrders = orders.filter(o => {
    if (!o.createdAt) return false
    const now = new Date()
    return (
      o.createdAt.getMonth()    === now.getMonth() &&
      o.createdAt.getFullYear() === now.getFullYear()
    )
  })

  return {
    orders, todayOrders, monthOrders, loading,
    placeOrder, getOrderByOrderId, updateStatus, updateItems, deleteOrder, deleteAllOrderHistory,
    orderCooldown,
  }
}
