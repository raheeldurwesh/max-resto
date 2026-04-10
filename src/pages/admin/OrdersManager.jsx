// src/pages/admin/OrdersManager.jsx
// Admin: view orders, update status, download invoice, delete

import { useState } from 'react'
import { useOrders }        from '../../hooks/useOrders'
import { useConfig }        from '../../hooks/useConfig'
import { useOrderNotification } from '../../hooks/useOrderNotification'
import { generateInvoice }  from '../../utils/generatePDF'
import OrderCard            from '../../components/OrderCard'
import EditOrderModal       from '../../components/EditOrderModal'
import Spinner              from '../../components/Spinner'
import { fmt }              from '../../utils/helpers'

function Toast({ msg }) {
  if (!msg) return null
  return (
    <div className="fixed bottom-6 right-6 z-50 px-5 py-3 bg-card border border-border
                    rounded-xl text-bright text-sm font-body shadow-lifted animate-slide-up">
      {msg}
    </div>
  )
}

export default function OrdersManager({ restaurantId }) {
  const {
    orders, todayOrders, monthOrders,
    loading, updateStatus, updateItems,
    deleteOrder, deleteAllOrderHistory,
  } = useOrders(restaurantId)
  const { config } = useConfig(restaurantId)
  const { toast: notifToast } = useOrderNotification(orders)

  const [filter,   setFilter]   = useState('today')
  const [deleting, setDeleting] = useState(null)
  const [purging,  setPurging]  = useState(false)
  const [toast,    setToast]    = useState('')
  const [editingOrder, setEditingOrder] = useState(null)

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const list = filter === 'today' ? todayOrders
             : filter === 'month' ? monthOrders
             : orders

  const revenue = list.reduce((s, o) => s + (o.total || 0), 0)

  const handleDelete = async (order) => {
    if (!confirm(`Delete order #${order.orderId}? This cannot be undone.`)) return
    setDeleting(order.id)
    try {
      await deleteOrder(order.id)
      showToast(`✓ Order #${order.orderId} deleted`)
    } catch (err) {
      showToast('❌ ' + err.message)
    } finally {
      setDeleting(null)
    }
  }

  const handlePurgeAll = async () => {
    if (!confirm(`⚠️ Delete ALL ${orders.length} orders?\n\nThis permanently removes all order history.`)) return
    setPurging(true)
    try {
      await deleteAllOrderHistory()
      showToast('✓ All order history deleted')
    } catch (err) {
      showToast('❌ ' + err.message)
    } finally {
      setPurging(false)
    }
  }

  const handleInvoice = (order) => {
    try {
      generateInvoice(order, config)
    } catch (err) {
      showToast('❌ PDF error: ' + err.message)
    }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <Toast msg={toast || notifToast} />

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="section-title text-xl">Orders</h2>
          <p className="text-mid text-xs mt-0.5">Real-time · Updates automatically</p>
        </div>
        {orders.length > 0 && (
          <button onClick={handlePurgeAll} disabled={purging} className="btn-danger text-xs py-2 px-4">
            {purging ? '…Deleting' : `🗑️ Purge All (${orders.length})`}
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'today', label: 'Today',      count: todayOrders.length },
          { key: 'month', label: 'This Month', count: monthOrders.length },
          { key: 'all',   label: 'All Time',   count: orders.length },
        ].map(tab => (
          <button key={tab.key} onClick={() => setFilter(tab.key)}
            className={`px-4 py-2 rounded-xl text-sm font-body font-semibold border
                       transition-all duration-200
                       ${filter === tab.key
                         ? 'bg-amber text-base border-amber'
                         : 'border-border text-mid hover:border-amber/40 hover:text-bright'
                       }`}>
            {tab.label}
            <span className="ml-1.5 opacity-60 text-xs">({tab.count})</span>
          </button>
        ))}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card p-4 text-center">
          <p className="font-display font-bold text-amber text-2xl">{list.length}</p>
          <p className="text-mid text-xs mt-0.5">Orders</p>
        </div>
        <div className="card p-4 text-center">
          <p className="font-display font-bold text-amber text-2xl">{fmt(revenue)}</p>
          <p className="text-mid text-xs mt-0.5">Revenue</p>
        </div>
      </div>

      {/* Orders grid */}
      {loading ? <Spinner /> : list.length === 0 ? (
        <div className="text-center py-16 space-y-2">
          <p className="text-5xl">📭</p>
          <p className="text-mid">No orders for this period.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map(order => (
            <div key={order.id} className="relative">
              <OrderCard order={order} onUpdateStatus={updateStatus} onEdit={setEditingOrder} />

              {/* Action buttons row — below the card */}
              <div className="flex gap-2 mt-2">
                {/* Download Invoice */}
                <button
                  onClick={() => handleInvoice(order)}
                  className="flex-1 flex items-center justify-center gap-1.5
                             py-2 rounded-xl text-xs font-body font-semibold
                             bg-amber/10 border border-amber/30 text-amber
                             hover:bg-amber/20 transition-all active:scale-95"
                  title="Download invoice PDF"
                >
                  ⬇️ Invoice
                </button>
                {/* Delete */}
                <button
                  onClick={() => handleDelete(order)}
                  disabled={deleting === order.id}
                  className="flex-1 flex items-center justify-center gap-1.5
                             py-2 rounded-xl text-xs font-body font-semibold
                             bg-danger/10 border border-danger/30 text-danger
                             hover:bg-danger/20 transition-all active:scale-95
                             disabled:opacity-40"
                  title="Delete order"
                >
                  {deleting === order.id ? '…' : '🗑️ Delete'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit order modal */}
      {editingOrder && (
        <EditOrderModal
          order={editingOrder}
          onSave={updateItems}
          onClose={() => setEditingOrder(null)}
        />
      )}
    </div>
  )
}
