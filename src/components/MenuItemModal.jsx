// src/components/MenuItemModal.jsx
// Full-screen modal showing menu item details with image, description, price, and add-to-cart.

import { useState } from 'react'
import { fmt } from '../utils/helpers'

export default function MenuItemModal({ item, qty, onAdd, onRemove, onClose }) {
  const [imgErr, setImgErr] = useState(false)

  if (!item) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
        <div className="bg-surface rounded-t-3xl sm:rounded-2xl border-t sm:border border-border
                        shadow-lifted w-full sm:max-w-md max-h-[90vh] flex flex-col
                        animate-slide-up overflow-hidden">

          {/* Image */}
          <div className="relative h-56 sm:h-64 bg-raised flex-shrink-0 overflow-hidden">
            {!imgErr && item.imageUrl ? (
              <img
                src={item.imageUrl}
                alt={item.name}
                onError={() => setImgErr(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-6xl bg-raised">
                🍽️
              </div>
            )}

            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-base/70
                         backdrop-blur-sm flex items-center justify-center text-bright
                         hover:bg-base/90 transition-all text-lg"
            >
              ×
            </button>

            {/* Category + food type badges */}
            <div className="absolute bottom-3 left-3 flex gap-2">
              <span className="px-2.5 py-1 rounded-full bg-base/70 backdrop-blur-sm
                               text-mid text-[10px] font-semibold uppercase tracking-wider">
                {item.category}
              </span>
              {item.foodType && (
                <span className={`px-2.5 py-1 rounded-full backdrop-blur-sm text-[10px]
                                  font-bold uppercase tracking-wider
                                  ${item.foodType === 'veg'
                                    ? 'bg-done/20 text-done border border-done/30'
                                    : 'bg-danger/20 text-danger border border-danger/30'
                                  }`}>
                  {item.foodType === 'veg' ? '🟢 Veg' : '🔴 Non-Veg'}
                </span>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
            <div>
              <h2 className="font-display font-bold text-bright text-2xl mb-1">{item.name}</h2>
              <span className="font-display font-semibold text-amber text-xl">{fmt(item.price)}</span>
            </div>

            {item.description && (
              <p className="text-mid text-sm font-body leading-relaxed">{item.description}</p>
            )}
          </div>

          {/* Add to cart controls */}
          <div className="px-5 py-4 border-t border-border flex-shrink-0">
            {qty === 0 ? (
              <button
                onClick={() => { onAdd(item); onClose() }}
                className="btn-amber w-full py-3.5 text-base rounded-2xl shadow-amber"
              >
                + Add to Cart — {fmt(item.price)}
              </button>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => onRemove(item.id)}
                    className="w-10 h-10 rounded-full border border-amber/40 text-amber
                               flex items-center justify-center text-xl font-bold
                               hover:bg-amber hover:text-base transition-all active:scale-90"
                  >
                    −
                  </button>
                  <span className="font-display font-bold text-amber text-xl w-8 text-center">{qty}</span>
                  <button
                    onClick={() => onAdd(item)}
                    className="w-10 h-10 rounded-full bg-amber text-base
                               flex items-center justify-center text-xl font-bold
                               hover:bg-amber-dim transition-all active:scale-90"
                  >
                    +
                  </button>
                </div>
                <span className="font-display font-bold text-bright text-lg">
                  {fmt(item.price * qty)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
