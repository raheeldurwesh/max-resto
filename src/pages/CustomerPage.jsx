// src/pages/CustomerPage.jsx
// UPDATED: Multi-restaurant support via /:slug route
// Falls back to legacy mode (no slug) for backward compatibility

import { useState, useMemo, useEffect } from 'react'
import { useSearchParams, useParams } from 'react-router-dom'
import { supabase } from '../supabase/client'
import { useMenu } from '../hooks/useMenu'
import { useOrders } from '../hooks/useOrders'
import { useConfig } from '../hooks/useConfig'
import { calcTotals } from '../utils/helpers'
import { generateInvoice } from '../utils/generatePDF'
import { fetchRestaurantBySlug } from '../services/restaurantService'
import MenuItem from '../components/MenuItem'
import MenuItemModal from '../components/MenuItemModal'
import CartDrawer from '../components/CartDrawer'
import Spinner, { MiniSpinner } from '../components/Spinner'
import Footer from '../components/Footer'

export default function CustomerPageWrapper() {
  const { slug } = useParams()
  const [restaurant, setRestaurant] = useState(null)
  const [restLoading, setRestLoading] = useState(!!slug)
  const [restError, setRestError] = useState('')

  useEffect(() => {
    if (!slug) { setRestLoading(false); return }
    setRestLoading(true)
    fetchRestaurantBySlug(slug)
      .then(r => { setRestaurant(r); setRestError('') })
      .catch(() => setRestError(`Restaurant "${slug}" not found.`))
      .finally(() => setRestLoading(false))

    // ── Real-time: Listen for restaurant status changes (for guests) ──
    const channel = supabase.channel(`guest-rest-status-${slug}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'restaurants', filter: `slug=eq.${slug}` },
        (payload) => {
          console.log('[Guest] Restaurant status updated instantly:', payload.new)
          setRestaurant(payload.new)
        }
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [slug])

  if (restLoading) {
    return (
      <div className="min-h-screen bg-base flex flex-col items-center justify-center space-y-4">
        <Spinner text="Locating restaurant…" />
      </div>
    )
  }

  if (restError) {
    return (
      <div className="min-h-screen bg-base flex items-center justify-center px-6">
        <div className="text-center space-y-3">
          <p className="text-4xl">🍽️</p>
          <p className="text-bright font-body">{restError}</p>
          <button onClick={() => window.location.href = '/'} className="btn-ghost inline-flex">← Back Home</button>
        </div>
      </div>
    )
  }

  // Restaurant disabled by Super Admin
  if (restaurant && restaurant.is_active === false) {
    return (
      <div className="min-h-screen bg-base flex items-center justify-center px-6">
        <div className="text-center space-y-4 max-w-sm animate-scale-in">
          <div className="w-20 h-20 rounded-full bg-danger/10 border-2 border-danger/30
                          flex items-center justify-center text-4xl mx-auto">
            🔒
          </div>
          <h1 className="font-display text-bright text-2xl">Temporarily Closed</h1>
          <p className="text-mid text-sm font-body leading-relaxed">
            <strong className="text-bright">{restaurant.name}</strong> is currently not accepting orders.
            Please check back later.
          </p>
        </div>
      </div>
    )
  }

  return <CustomerPagePayload restaurant={restaurant} />
}

function CustomerPagePayload({ restaurant }) {
  const [params] = useSearchParams()
  const tableNo = params.get('table') || '1'
  const restaurantId = restaurant?.id || null

  const { items, loading, error } = useMenu(restaurantId)
  const { placeOrder, getOrderByOrderId, orderCooldown } = useOrders(restaurantId, tableNo)
  const { config, settings } = useConfig(restaurantId)
  const taxPct = settings.taxPercentage

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [sort, setSort] = useState('newest')
  const [cart, setCart] = useState([])
  const [note, setNote] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [cartOpen, setCartOpen] = useState(false)
  const [successId, setSuccessId] = useState(null)
  const [lastOrder, setLastOrder] = useState(null)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [orderError, setOrderError] = useState('')
  const [foodType, setFoodType] = useState('all')
  const [selectedItem, setSelectedItem] = useState(null)

  // ── Dynamic categories from menu items ─────────────────────────────────────
  const categories = useMemo(() => {
    const cats = [...new Set(items.map(i => i.category).filter(Boolean))].sort()
    return ['All', ...cats]
  }, [items])

  // ── Filter + sort pipeline ─────────────────────────────────────────────────
  const visible = useMemo(() => {
    let list = items.filter(i => i.available !== false)
    if (category !== 'All') list = list.filter(i => i.category === category)
    if (foodType !== 'all') list = list.filter(i => i.foodType === foodType)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(i =>
        i.name.toLowerCase().includes(q) ||
        i.description?.toLowerCase().includes(q)
      )
    }
    if (sort === 'price-asc') list = [...list].sort((a, b) => a.price - b.price)
    if (sort === 'price-desc') list = [...list].sort((a, b) => b.price - a.price)
    return list
  }, [items, category, search, sort, foodType])

  // ── Cart helpers ───────────────────────────────────────────────────────────
  const addToCart = (item) =>
    setCart(prev => {
      const ex = prev.find(i => i.id === item.id)
      if (ex) return prev.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i)
      return [...prev, { id: item.id, name: item.name, price: item.price, qty: 1 }]
    })

  const removeFromCart = (id) =>
    setCart(prev => {
      const ex = prev.find(i => i.id === id)
      if (!ex) return prev
      if (ex.qty === 1) return prev.filter(i => i.id !== id)
      return prev.map(i => i.id === id ? { ...i, qty: i.qty - 1 } : i)
    })

  const getQty = (id) => cart.find(i => i.id === id)?.qty || 0
  const itemCount = cart.reduce((s, i) => s + i.qty, 0)

  // ── Totals — DISPLAY ONLY (estimated) ──────────────────────────────────────
  const { subtotal, tax, total } = useMemo(
    () => calcTotals(cart, taxPct),
    [cart, taxPct]
  )

  // ── Place order ────────────────────────────────────────────────────────────
  const handlePlaceOrder = async () => {
    if (cart.length === 0) return
    setOrderError('')
    try {
      const orderId = await placeOrder({
        table: tableNo,
        items: cart,
        total,
        tax,
        note,
        customerName,
        instructions: note,
      })

      let serverOrder = null
      try {
        serverOrder = await getOrderByOrderId(orderId)
      } catch {
        console.warn('Could not fetch server order, using local estimates')
      }

      if (serverOrder) {
        setLastOrder({
          orderId: serverOrder.orderId,
          table: serverOrder.table,
          customerName: serverOrder.customerName,
          items: serverOrder.items,
          subtotal: serverOrder.total,
          tax: serverOrder.tax,
          total: serverOrder.total + serverOrder.tax,
          note: serverOrder.note,
          createdAt: serverOrder.createdAt || new Date(),
        })
      } else {
        setLastOrder({
          orderId: orderId,
          table: tableNo,
          customerName: customerName.trim(),
          items: cart.map(i => ({ name: i.name, qty: i.qty, price: i.price })),
          subtotal: parseFloat(subtotal.toFixed(2)),
          tax: parseFloat(tax.toFixed(2)),
          total: parseFloat(total.toFixed(2)),
          note: note.trim(),
          createdAt: new Date(),
        })
      }

      setCart([])
      setNote('')
      setCustomerName('')
      setCartOpen(false)
      setSuccessId(orderId)
    } catch (err) {
      const msg = err.message || 'Failed to place order. Please try again.'
      setOrderError(msg)
      console.error('Order placement error:', err)
    }
  }

  const handleDownloadInvoice = async () => {
    if (!lastOrder) return
    setPdfLoading(true)
    try {
      generateInvoice(lastOrder, config)
    } catch (err) {
      console.error('Invoice error:', err)
    } finally {
      setPdfLoading(false)
    }
  }

  // ── Success screen ─────────────────────────────────────────────────────────
  if (successId) {
    return (
      <div className="min-h-screen bg-base flex items-center justify-center px-6 py-10">
        <div className="text-center max-w-sm animate-scale-in space-y-5 w-full">

          <div className="w-20 h-20 rounded-full bg-done/10 border-2 border-done/30
                          flex items-center justify-center text-4xl mx-auto">
            ✅
          </div>

          <div>
            <h1 className="font-display text-bright text-3xl mb-1">Order Placed!</h1>
            <p className="font-body font-bold text-amber text-xl tracking-wider">#{successId}</p>
            {lastOrder?.customerName && (
              <p className="text-mid text-sm mt-1">
                For <span className="text-bright font-semibold">{lastOrder.customerName}</span>
              </p>
            )}
          </div>

          <div className="card px-5 py-4 text-left space-y-2.5">
            <p className="text-mid text-xs font-semibold uppercase tracking-wider mb-3">
              Order Summary — Table #{tableNo}
            </p>

            {lastOrder?.items?.map((item, i) => (
              <div key={i} className="flex justify-between text-sm font-body">
                <span className="text-mid">
                  {item.qty}× <span className="text-bright">{item.name}</span>
                </span>
                <span className="text-bright">₹{(item.price * item.qty).toFixed(2)}</span>
              </div>
            ))}

            <div className="border-t border-border pt-2.5 space-y-1.5">
              <div className="flex justify-between text-sm font-body text-mid">
                <span>Subtotal</span>
                <span className="text-bright">₹{(lastOrder?.subtotal || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-body text-mid">
                <span>Tax ({taxPct}%)</span>
                <span className="text-bright">₹{(lastOrder?.tax || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-display font-bold border-t border-border pt-2">
                <span className="text-bright">Total</span>
                <span className="text-amber text-lg">₹{(lastOrder?.total || 0).toFixed(2)}</span>
              </div>
            </div>

            {lastOrder?.note && (
              <div className="bg-amber-soft border border-amber/20 rounded-xl px-3 py-2 mt-1">
                <p className="text-amber text-xs">📝 {lastOrder.note}</p>
              </div>
            )}
          </div>

          <div className="card px-4 py-3 flex items-start gap-2.5 text-left">
            <span className="text-amber text-lg flex-shrink-0">💳</span>
            <p className="text-mid text-xs leading-relaxed">
              Please pay <strong className="text-bright">₹{(lastOrder?.total || 0).toFixed(2)}</strong> at
              the counter when your order arrives.
            </p>
          </div>

          <button
            onClick={handleDownloadInvoice}
            disabled={pdfLoading}
            className="btn-amber w-full flex items-center justify-center gap-2 py-3"
          >
            {pdfLoading
              ? <><MiniSpinner /> Generating…</>
              : '⬇️ Download Bill PDF'
            }
          </button>

          <button onClick={() => setSuccessId(null)} className="btn-ghost w-full">
            Order More Items
          </button>

          <Footer />
        </div>
      </div>
    )
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="min-h-screen bg-base flex items-center justify-center px-6">
        <div className="text-center space-y-3">
          <p className="text-4xl">⚠️</p>
          <p className="text-bright font-body">Something went wrong loading the menu.</p>
          <button onClick={() => window.location.reload()} className="btn-ghost">Try Again</button>
        </div>
      </div>
    )
  }

  // ── Table validation ───────────────────────────────────────────────────────
  const tNum = parseInt(tableNo, 10)
  if (isNaN(tNum) || tNum < 1 || tNum > (settings.totalTables || 20)) {
    return (
      <div className="min-h-screen bg-base flex flex-col items-center justify-center px-6">
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border-2 border-red-500/30 flex items-center justify-center text-3xl mx-auto">
            🚫
          </div>
          <h2 className="text-2xl font-display font-bold text-bright">Invalid Table</h2>
          <p className="text-mid text-sm leading-relaxed">
            Table <strong className="text-bright">#{tableNo}</strong> does not exist. Please scan the QR code located on your actual table to access the correct menu.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-base pb-28">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 glass border-b border-border">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div>
            <h1 className="font-display italic text-amber text-xl leading-none">
              {config.restaurant_name || restaurant?.name || 'TableServe'}
            </h1>
            <p className="text-faint text-[10px] font-body">Table {tableNo}</p>
          </div>
          <button
            onClick={() => setCartOpen(true)}
            className="relative flex items-center gap-2 px-4 py-2 rounded-xl
                       border border-border text-mid text-sm font-body
                       hover:border-amber/40 hover:text-bright hover:bg-amber-soft transition-all"
          >
            🛒
            <span className="hidden sm:inline">Cart</span>
            {itemCount > 0 && (
              <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full
                               bg-amber text-base text-xs font-bold
                               flex items-center justify-center animate-scale-in">
                {itemCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* ── Search + filters ──────────────────────────────────────────── */}
      <div className="sticky top-14 z-30 glass border-b border-border">
        <div className="max-w-5xl mx-auto px-4 py-3 space-y-3">

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search menu…"
              className="input flex-1"
            />
            <select
              value={foodType}
              onChange={e => setFoodType(e.target.value)}
              className="input w-full sm:w-auto cursor-pointer"
            >
              <option value="all">🍽️ All</option>
              <option value="veg">🟢 Veg Only</option>
              <option value="non-veg">🔴 Non-Veg Only</option>
            </select>
            <select
              value={sort}
              onChange={e => setSort(e.target.value)}
              className="input w-full sm:w-auto cursor-pointer"
            >
              <option value="newest">Sort: Newest</option>
              <option value="price-asc">Price: Low → High</option>
              <option value="price-desc">Price: High → Low</option>
            </select>
          </div>

          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs
                            font-body font-semibold border transition-all duration-200
                            ${category === cat
                    ? 'bg-amber text-base border-amber'
                    : 'border-border text-mid hover:border-amber/40 hover:text-bright'
                  }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Order error banner ────────────────────────────────────────── */}
      {orderError && (
        <div className="max-w-5xl mx-auto px-4 pt-4">
          <div className="px-4 py-3 bg-danger/10 border border-danger/30 rounded-xl
                          text-danger text-sm font-body flex items-start gap-2">
            <span className="flex-shrink-0">⚠️</span>
            <div className="flex-1">
              <p>{orderError}</p>
              <button
                onClick={() => setOrderError('')}
                className="text-xs underline mt-1 opacity-70 hover:opacity-100"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Menu grid ─────────────────────────────────────────────────── */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        {loading ? (
          <Spinner text="Loading menu…" />
        ) : visible.length === 0 ? (
          <div className="text-center py-20 space-y-2">
            <p className="text-5xl">🍽️</p>
            <p className="text-mid font-body">
              {search ? 'No items match your search.' : 'No items in this category.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visible.map((item, i) => (
              <div key={item.id} className="animate-fade-in"
                style={{ animationDelay: `${Math.min(i * 0.04, 0.3)}s` }}>
                <MenuItem item={item} qty={getQty(item.id)}
                  onAdd={addToCart} onRemove={removeFromCart}
                  onClick={setSelectedItem} />
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ── Sticky bottom bar ─────────────────────────────────────────── */}
      {itemCount > 0 && !cartOpen && (
        <div className="fixed bottom-0 inset-x-0 z-40 p-4 bg-gradient-to-t from-base to-transparent">
          <div className="max-w-sm mx-auto">
            <button
              onClick={() => setCartOpen(true)}
              className="btn-amber w-full py-4 rounded-2xl text-base shadow-amber
                         flex items-center justify-between px-6 gap-4"
            >
              <span className="flex items-center gap-2">
                🛒 View Cart
                <span className="w-6 h-6 rounded-full bg-base/25 text-sm font-bold
                                 flex items-center justify-center">
                  {itemCount}
                </span>
              </span>
              <span className="font-display font-bold text-lg">₹{total.toFixed(2)}</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Cart drawer ───────────────────────────────────────────────── */}
      {cartOpen && (
        <CartDrawer
          cart={cart}
          subtotal={subtotal}
          tax={tax}
          total={total}
          taxPct={taxPct}
          customerName={customerName}
          onCustomerNameChange={setCustomerName}
          note={note}
          onNoteChange={setNote}
          onAdd={addToCart}
          onRemove={removeFromCart}
          onClear={() => setCart([])}
          onClose={() => setCartOpen(false)}
          onPlaceOrder={handlePlaceOrder}
          orderCooldown={orderCooldown}
        />
      )}

      {/* ── Menu item detail modal ──────────────────────────────────────── */}
      {selectedItem && (
        <MenuItemModal
          item={selectedItem}
          qty={getQty(selectedItem.id)}
          onAdd={addToCart}
          onRemove={removeFromCart}
          onClose={() => setSelectedItem(null)}
        />
      )}

      <div className="max-w-5xl mx-auto px-4 mt-8">
        <Footer />
      </div>
    </div>
  )
}
