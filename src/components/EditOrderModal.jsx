// src/components/EditOrderModal.jsx
// Modal for admin/waiter to edit order items (add/remove/change qty).
// Recalculates totals using config tax percentage.

import { useState, useMemo } from 'react'
import { useMenu }   from '../hooks/useMenu'
import { useConfig } from '../hooks/useConfig'
import { fmt, calcTotals } from '../utils/helpers'
import { MiniSpinner } from './Spinner'

export default function EditOrderModal({ order, onSave, onClose }) {
  const { items: menuItems } = useMenu()
  const { settings } = useConfig()

  // Local editable copy of order items
  const [items, setItems] = useState(
    (order.items || []).map((it, i) => ({ ...it, _key: `existing-${i}` }))
  )
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')

  // Totals (recalculated live)
  const { subtotal, tax, total } = useMemo(
    () => calcTotals(items, settings.taxPercentage),
    [items, settings.taxPercentage]
  )

  // Menu items not yet in the order, filtered by search
  const availableMenu = useMemo(() => {
    const inOrder = new Set(items.map(i => i.name.toLowerCase()))
    let list = menuItems.filter(m => m.available !== false && !inOrder.has(m.name.toLowerCase()))
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(m => m.name.toLowerCase().includes(q) || m.category?.toLowerCase().includes(q))
    }
    return list
  }, [menuItems, items, search])

  const updateQty = (key, delta) => {
    setItems(prev => prev.map(it => {
      if (it._key !== key) return it
      const newQty = Math.max(0, (it.qty || 1) + delta)
      return newQty === 0 ? null : { ...it, qty: newQty }
    }).filter(Boolean))
  }

  const removeItem = (key) => {
    setItems(prev => prev.filter(it => it._key !== key))
  }

  const addFromMenu = (menuItem) => {
    // Check if already exists (by name)
    const existing = items.find(it => it.name.toLowerCase() === menuItem.name.toLowerCase())
    if (existing) {
      updateQty(existing._key, 1)
      return
    }
    setItems(prev => [...prev, {
      name:  menuItem.name,
      price: menuItem.price,
      qty:   1,
      _key:  `new-${Date.now()}-${menuItem.id}`,
    }])
  }

  const handleSave = async () => {
    if (items.length === 0) return
    setSaving(true)
    try {
      // Strip internal _key before saving
      const cleanItems = items.map(({ _key, ...rest }) => rest)
      await onSave(order.id, cleanItems, subtotal, tax)
      onClose()
    } catch (err) {
      alert('Failed to save: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-surface rounded-2xl border border-border shadow-lifted
                        w-full max-w-lg max-h-[90vh] flex flex-col animate-scale-in">

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
            <div>
              <h2 className="section-title text-lg">Edit Order #{order.orderId}</h2>
              <p className="text-faint text-xs">Table {order.table}</p>
            </div>
            <button onClick={onClose} className="btn-icon text-xl leading-none">×</button>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

            {/* Current items */}
            <div>
              <p className="label mb-2">Order Items</p>
              {items.length === 0 ? (
                <p className="text-mid text-sm py-4 text-center">No items — add from menu below</p>
              ) : (
                <div className="space-y-2">
                  {items.map(item => (
                    <div key={item._key}
                         className="flex items-center gap-3 bg-raised rounded-xl px-3 py-2.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-bright text-sm font-body font-semibold truncate">{item.name}</p>
                        <p className="text-faint text-xs">{fmt(item.price)} each</p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button onClick={() => updateQty(item._key, -1)}
                                className="w-7 h-7 rounded-full border border-border text-mid
                                           flex items-center justify-center hover:border-amber/40
                                           hover:text-amber transition-all active:scale-90 text-sm">−</button>
                        <span className="w-6 text-center font-display font-bold text-amber text-sm">{item.qty}</span>
                        <button onClick={() => updateQty(item._key, 1)}
                                className="w-7 h-7 rounded-full bg-amber text-base font-bold
                                           flex items-center justify-center hover:bg-amber-dim
                                           transition-all active:scale-90 text-sm">+</button>
                      </div>
                      <span className="text-bright text-sm font-semibold w-16 text-right">
                        {fmt(item.price * item.qty)}
                      </span>
                      <button onClick={() => removeItem(item._key)}
                              className="text-danger text-xs hover:text-danger/80 ml-1">✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add from menu */}
            <div>
              <p className="label mb-2">Add Items from Menu</p>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search menu…"
                className="input mb-2"
              />
              <div className="max-h-40 overflow-y-auto space-y-1">
                {availableMenu.length === 0 ? (
                  <p className="text-faint text-xs text-center py-2">
                    {search ? 'No matching items' : 'All menu items already in order'}
                  </p>
                ) : (
                  availableMenu.slice(0, 10).map(m => (
                    <button
                      key={m.id}
                      onClick={() => addFromMenu(m)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl
                                 bg-card border border-border hover:border-amber/30
                                 hover:bg-amber-soft transition-all text-left"
                    >
                      <span className="text-bright text-sm font-body">{m.name}</span>
                      <span className="text-amber text-sm font-semibold">{fmt(m.price)}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Footer — totals + save */}
          <div className="px-5 py-4 border-t border-border space-y-3 flex-shrink-0">
            <div className="space-y-1">
              <div className="flex justify-between text-sm font-body text-mid">
                <span>Subtotal</span>
                <span className="text-bright">{fmt(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm font-body text-mid">
                <span>Tax ({settings.taxPercentage}%)</span>
                <span className="text-bright">{fmt(tax)}</span>
              </div>
              <div className="flex justify-between font-display font-bold border-t border-border pt-2">
                <span className="text-bright">Total</span>
                <span className="text-amber text-lg">{fmt(total)}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleSave} disabled={saving || items.length === 0}
                      className="btn-amber flex-1 py-3">
                {saving ? <><MiniSpinner /> Saving…</> : '✓ Save Changes'}
              </button>
              <button onClick={onClose} className="btn-ghost px-5">Cancel</button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
