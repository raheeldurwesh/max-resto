// src/pages/admin/Analytics.jsx
// CHANGED: passes config to generateReport for branded PDFs; ₹ everywhere

import { useOrders }      from '../../hooks/useOrders'
import { useConfig }      from '../../hooks/useConfig'
import { generateReport } from '../../utils/generatePDF'
import { fmt }            from '../../utils/helpers'
import Spinner            from '../../components/Spinner'

export default function Analytics({ restaurantId }) {
  const { orders, todayOrders, monthOrders, loading } = useOrders(restaurantId)
  const { config } = useConfig(restaurantId)

  if (loading) return <Spinner text="Loading analytics…" />

  const dailyRevenue  = todayOrders.reduce( (s, o) => s + (o.total || 0), 0)
  const monthRevenue  = monthOrders.reduce((s, o) => s + (o.total || 0), 0)
  const totalRevenue  = orders.reduce(     (s, o) => s + (o.total || 0), 0)
  const avgOrderToday = todayOrders.length ? dailyRevenue / todayOrders.length  : 0
  const avgOrderMonth = monthOrders.length ? monthRevenue / monthOrders.length  : 0

  const stats = [
    { label: 'Orders Today',       value: todayOrders.length,  sub: 'orders',    color: 'text-amber'     },
    { label: 'Revenue Today',      value: fmt(dailyRevenue),   sub: 'total',     color: 'text-amber'     },
    { label: 'Avg Order Today',    value: fmt(avgOrderToday),  sub: 'per order', color: 'text-mid'       },
    { label: 'Orders This Month',  value: monthOrders.length,  sub: 'orders',    color: 'text-preparing' },
    { label: 'Revenue This Month', value: fmt(monthRevenue),   sub: 'total',     color: 'text-preparing' },
    { label: 'Avg Order Month',    value: fmt(avgOrderMonth),  sub: 'per order', color: 'text-mid'       },
    { label: 'Total Orders',       value: orders.length,       sub: 'all time',  color: 'text-done'      },
    { label: 'Total Revenue',      value: fmt(totalRevenue),   sub: 'all time',  color: 'text-done'      },
    { label: 'Most Ordered',       value: topItem(orders) || '—', sub: 'item',   color: 'text-mid'       },
  ]

  const now      = new Date()
  const dateLabel = now.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  const monLabel  = now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header + PDF buttons */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="section-title text-xl">Analytics</h2>
          <p className="text-mid text-xs mt-0.5">Sales performance overview</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => generateReport({ type: 'daily',   orders: todayOrders, label: dateLabel, config })}
            className="btn-ghost text-sm"
            disabled={todayOrders.length === 0}
          >
            ⬇️ Daily PDF
          </button>
          <button
            onClick={() => generateReport({ type: 'monthly', orders: monthOrders,  label: monLabel,  config })}
            className="btn-ghost text-sm"
            disabled={monthOrders.length === 0}
          >
            ⬇️ Monthly PDF
          </button>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map(s => (
          <div key={s.label} className="card p-5 space-y-1">
            <p className="text-mid text-xs font-body uppercase tracking-wider">{s.label}</p>
            <p className={`font-display font-bold text-2xl ${s.color}`}>{s.value}</p>
            <p className="text-faint text-xs">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Status breakdown */}
      <div className="card p-5">
        <h3 className="section-title text-base mb-4">Order Status — This Month</h3>
        <div className="space-y-3">
          {['pending', 'preparing', 'done'].map(status => {
            const count = monthOrders.filter(o => o.status === status).length
            const pct   = monthOrders.length ? Math.round(count / monthOrders.length * 100) : 0
            const bar   = { pending: 'bg-pending', preparing: 'bg-preparing', done: 'bg-done' }[status]
            return (
              <div key={status}>
                <div className="flex justify-between text-sm font-body mb-1.5">
                  <span className="text-mid capitalize">{status}</span>
                  <span className="text-bright font-semibold">
                    {count} <span className="text-faint font-normal">({pct}%)</span>
                  </span>
                </div>
                <div className="h-2 bg-raised rounded-full overflow-hidden">
                  <div className={`h-full ${bar} rounded-full transition-all duration-700`}
                       style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <TopItemsTable orders={monthOrders} />
    </div>
  )
}

function topItem(orders) {
  const freq = {}
  orders.forEach(o => o.items?.forEach(i => { freq[i.name] = (freq[i.name] || 0) + (i.qty || 1) }))
  return Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
}

function TopItemsTable({ orders }) {
  const freq = {}
  orders.forEach(o => o.items?.forEach(i => {
    if (!freq[i.name]) freq[i.name] = { qty: 0, revenue: 0 }
    freq[i.name].qty     += i.qty || 1
    freq[i.name].revenue += (i.price || 0) * (i.qty || 1)
  }))
  const rows = Object.entries(freq)
    .map(([name, d]) => ({ name, ...d }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 8)

  if (rows.length === 0) return null

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <h3 className="section-title text-base">Top Items — This Month</h3>
      </div>
      {rows.map((row, i) => (
        <div key={row.name}
             className="flex items-center gap-4 px-5 py-3 border-b border-border/50 last:border-0 hover:bg-raised transition-colors">
          <span className="text-faint text-sm w-5 text-right">{i + 1}</span>
          <span className="flex-1 font-body text-bright text-sm">{row.name}</span>
          <span className="text-mid text-sm">{row.qty} sold</span>
          <span className="text-amber font-semibold text-sm">{fmt(row.revenue)}</span>
        </div>
      ))}
    </div>
  )
}
