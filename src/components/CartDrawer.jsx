// src/components/CartDrawer.jsx
// FIXES:
//   1. Added customerName field + prop
//   2. Instructions textarea — high-contrast styling (bg-card, border-amber/30)
//   3. Full order summary with subtotal / tax / total breakdown

import { useState } from 'react'
import { fmt }      from '../utils/helpers'
import { MiniSpinner } from './Spinner'

export default function CartDrawer({
  cart, subtotal, tax, total,
  taxPct,
  customerName, onCustomerNameChange,
  note, onNoteChange,
  onAdd, onRemove, onClear, onClose,
  onPlaceOrder,
  orderCooldown = 0,
}) {
  const [placing, setPlacing] = useState(false)

  const handlePlace = async () => {
    if (cart.length === 0) return
    setPlacing(true)
    try {
      await onPlaceOrder()
    } finally {
      setPlacing(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-x-0 bottom-0 z-50 flex flex-col
                      max-h-[92vh] bg-surface rounded-t-3xl border-t border-border
                      shadow-lifted animate-slide-up">

        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border flex-shrink-0">
          <h2 className="section-title text-lg">
            Your Cart
            {cart.length > 0 && (
              <span className="ml-2 text-sm text-mid font-body font-normal">
                ({cart.reduce((s, i) => s + i.qty, 0)} items)
              </span>
            )}
          </h2>
          <button onClick={onClose} className="btn-icon text-xl leading-none">×</button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* Empty state */}
          {cart.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
              <span className="text-5xl">🛒</span>
              <p className="text-mid text-sm">Your cart is empty</p>
              <p className="text-faint text-xs">Add items from the menu</p>
            </div>
          )}

          {/* Items */}
          {cart.map(item => (
            <div key={item.id}
                 className="flex items-center gap-3 py-3 border-b border-border last:border-0">
              <div className="flex-1 min-w-0">
                <p className="font-body font-semibold text-bright text-sm truncate">{item.name}</p>
                <p className="text-mid text-xs mt-0.5">{fmt(item.price)} each</p>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => onRemove(item.id)}
                        className="w-7 h-7 rounded-full border border-border text-mid text-base
                                   flex items-center justify-center
                                   hover:border-amber/40 hover:text-amber transition-all active:scale-90">
                  −
                </button>
                <span className="w-5 text-center font-display font-bold text-amber text-sm">
                  {item.qty}
                </span>
                <button onClick={() => onAdd(item)}
                        className="w-7 h-7 rounded-full bg-amber text-base text-base font-bold
                                   flex items-center justify-center
                                   hover:bg-amber-dim transition-all active:scale-90">
                  +
                </button>
              </div>

              <div className="w-16 text-right flex-shrink-0">
                <span className="font-body font-semibold text-bright text-sm">
                  {fmt(item.price * item.qty)}
                </span>
              </div>
            </div>
          ))}

          {/* Customer fields — only when cart has items */}
          {cart.length > 0 && (
            <div className="space-y-3 pt-1">
              {/* Customer name */}
              <div>
                <label className="label">Your Name (optional)</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={e => onCustomerNameChange(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full bg-card border border-border rounded-xl
                             text-bright placeholder-faint font-body text-sm
                             px-4 py-2.5 outline-none
                             transition-all duration-200
                             focus:border-amber/50 focus:ring-2 focus:ring-amber/10"
                />
              </div>

              {/* Special instructions — FIX: high contrast background + visible border */}
              <div>
                <label className="label">Special Instructions (optional)</label>
                <textarea
                  value={note}
                  onChange={e => onNoteChange(e.target.value)}
                  placeholder="Allergies, dietary needs, special requests…"
                  rows={3}
                  className="w-full bg-card border border-amber/20 rounded-xl
                             text-bright placeholder-mid font-body text-sm
                             px-4 py-3 outline-none resize-none
                             transition-all duration-200
                             focus:border-amber/50 focus:ring-2 focus:ring-amber/10"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer — totals + actions */}
        {cart.length > 0 && (
          <div className="px-5 py-4 border-t border-border space-y-3 bg-surface flex-shrink-0">
            {/* Price breakdown */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm font-body text-mid">
                <span>Subtotal</span>
                <span className="text-bright font-medium">{fmt(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm font-body text-mid">
                <span>Tax ({taxPct}%)</span>
                <span className="text-bright font-medium">{fmt(tax)}</span>
              </div>
              <div className="flex justify-between font-display font-bold border-t border-border pt-2">
                <span className="text-bright text-base">Total</span>
                <span className="text-amber text-xl">{fmt(total)}</span>
              </div>
            </div>

            {/* Place Order */}
            <button
              onClick={handlePlace}
              disabled={placing || orderCooldown > 0}
              className={`btn-amber w-full py-3.5 text-base rounded-2xl shadow-amber gap-2 transition-all duration-300
                        ${orderCooldown > 0 ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
            >
              {placing ? (
                <><MiniSpinner /> Placing Order…</>
              ) : orderCooldown > 0 ? (
                <>⏳ Wait ({orderCooldown}s)</>
              ) : (
                '🍽️ Place Order'
              )}
            </button>
            <button
              onClick={onClear}
              className="w-full text-faint text-xs font-body hover:text-mid transition-colors py-1"
            >
              Clear cart
            </button>
          </div>
        )}
      </div>
    </>
  )
}
