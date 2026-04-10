// src/components/OrderCard.jsx
// FIXES:
//   1. Shows customerName when present
//   2. Shows instructions separately from note
//   3. Grand total = total + tax (correctly labelled)
//   4. Subtotal / tax / total breakdown in card footer

import { fmt, STATUS, timeAgo, fmtDateTime } from '../utils/helpers'

export default function OrderCard({ order, onUpdateStatus, onEdit, compact = false }) {
  const meta  = STATUS[order.status] || STATUS.pending
  const grand = (order.total || 0) + (order.tax || 0)

  return (
    <div className={`card p-5 space-y-4 transition-all duration-300
                    ${order.status === 'pending'   ? 'border-pending/25'   : ''}
                    ${order.status === 'preparing' ? 'border-preparing/25' : ''}
                    ${order.status === 'done'      ? 'border-done/20 opacity-75' : ''}`}>

      {/* Top row — order ID, table, customer, time, status badge */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display font-bold text-bright text-lg leading-none">
            #{order.orderId}
          </p>
          <p className="text-mid text-xs mt-1 font-body">
            Table <span className="text-bright font-semibold">{order.table}</span>
            {' · '}{fmtDateTime(order.createdAt)}
            <span className="text-faint ml-1">({timeAgo(order.createdAt)})</span>
          </p>
          {/* Customer name */}
          {order.customerName && (
            <p className="text-amber text-xs mt-0.5 font-body font-medium">
              👤 {order.customerName}
            </p>
          )}
        </div>
        <span className={meta.cls}>
          <span className={`w-1.5 h-1.5 rounded-full ${meta.dot} animate-pulse-dot`} />
          {meta.label}
        </span>
      </div>

      {/* Items list */}
      {!compact && (
        <div className="space-y-1.5 bg-raised rounded-xl p-3">
          {(order.items || []).map((item, i) => (
            <div key={i} className="flex justify-between text-sm font-body">
              <span className="text-mid">
                {item.qty}× <span className="text-bright">{item.name}</span>
              </span>
              <span className="text-mid text-right">{fmt(item.price * item.qty)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Note / instructions */}
      {(order.note || order.instructions) && (
        <div className="flex gap-2 bg-amber-soft border border-amber/20 rounded-xl px-3 py-2.5">
          <span className="text-amber text-sm flex-shrink-0">📝</span>
          <p className="text-bright text-xs font-body leading-relaxed">
            {order.note || order.instructions}
          </p>
        </div>
      )}

      {/* Totals + action buttons */}
      <div className="border-t border-border pt-3 space-y-2">
        {/* Subtotal / tax / grand total */}
        <div className="space-y-1 text-xs font-body text-mid">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span className="text-bright">{fmt(order.total || 0)}</span>
          </div>
          <div className="flex justify-between">
            <span>Tax</span>
            <span className="text-bright">{fmt(order.tax || 0)}</span>
          </div>
          <div className="flex justify-between font-semibold text-sm pt-1 border-t border-border">
            <span className="text-bright">Total</span>
            <span className="text-amber font-display">{fmt(grand)}</span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 pt-1">
          {order.status === 'pending' && (
            <button
              onClick={() => onUpdateStatus(order.id, 'preparing')}
              className="flex-1 btn px-3 py-2 text-xs rounded-xl
                         bg-preparing/10 border border-preparing/30 text-preparing
                         hover:bg-preparing/20"
            >
              Start Preparing
            </button>
          )}
          {order.status === 'preparing' && (
            <button
              onClick={() => onUpdateStatus(order.id, 'done')}
              className="flex-1 btn px-3 py-2 text-xs rounded-xl
                         bg-done/10 border border-done/30 text-done
                         hover:bg-done/20"
            >
              Mark Done ✓
            </button>
          )}
          {order.status === 'done' && (
            <span className="text-done text-xs font-body font-semibold px-3 py-2">
              ✓ Delivered
            </span>
          )}
          {/* Edit button — only for pending/preparing */}
          {onEdit && order.status !== 'done' && (
            <button
              onClick={() => onEdit(order)}
              className="btn px-3 py-2 text-xs rounded-xl
                         bg-amber/10 border border-amber/30 text-amber
                         hover:bg-amber/20"
            >
              ✏️ Edit
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
