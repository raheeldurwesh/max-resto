// src/pages/admin/MenuManager.jsx
// Add, edit, delete menu items with image upload and availability toggle

import { useState, useMemo } from 'react'
import { useMenu }  from '../../hooks/useMenu'
import { useConfig } from '../../hooks/useConfig'
import Spinner, { MiniSpinner } from '../../components/Spinner'
import { fmt }      from '../../utils/helpers'

const EMPTY_FORM = {
  name: '', description: '', price: '', category: 'Other',
  available: true, imageUrl: '', foodType: '',
}

// ── Item Form (shared by Add and Edit) ─────────────────────────────────────
function ItemForm({ initial = EMPTY_FORM, onSave, onCancel, saving, categories }) {
  const [form,    setForm]    = useState(() => {
    const base = { ...EMPTY_FORM, ...initial }
    // If it's a new item (no id) and we have custom categories, 
    // default to the first custom category instead of 'Other'
    if (!initial.id && categories && categories.length > 0) {
      base.category = categories[0]
    }
    return base
  })
  const [imgFile, setImgFile] = useState(null)
  const [preview, setPreview] = useState(initial.imageUrl || '')

  const f = key => e => setForm(p => ({ ...p, [key]: e.target.value }))

  const handleImage = e => {
    const file = e.target.files?.[0]
    if (!file) return
    
    if (file.size > 500 * 1024) {
      alert('Image size exceeds 500 KB limit. Please choose a smaller image.')
      e.target.value = ''
      return
    }
    
    setImgFile(file)
    setPreview(URL.createObjectURL(file))
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Name */}
        <div className="sm:col-span-2">
          <label className="label">Item Name *</label>
          <input value={form.name} onChange={f('name')} placeholder="e.g. Margherita Pizza" className="input" required />
        </div>

        {/* Price + Category */}
        <div>
          <label className="label">Price ($) *</label>
          <input type="number" value={form.price} onChange={f('price')} placeholder="12.99" min="0" step="0.01" className="input" required />
        </div>
        <div>
          <label className="label">Category</label>
          <select value={form.category} onChange={f('category')} className="input cursor-pointer">
            {categories.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>

        {/* Food Type */}
        <div>
          <label className="label">Food Type</label>
          <select value={form.foodType} onChange={f('foodType')} className="input cursor-pointer">
            <option value="">Not Set</option>
            <option value="veg">🟢 Veg</option>
            <option value="non-veg">🔴 Non-Veg</option>
          </select>
        </div>

        {/* Description */}
        <div className="sm:col-span-2">
          <label className="label">Description</label>
          <textarea value={form.description} onChange={f('description')}
            placeholder="Short, appetizing description…" rows={2}
            className="input resize-none" />
        </div>

        {/* Image */}
        <div className="sm:col-span-2">
          <label className="label">Item Image</label>
          <div className="flex gap-3 items-center">
            {preview && (
              <img src={preview} alt="preview"
                   className="w-20 h-16 rounded-xl object-cover border border-border flex-shrink-0" />
            )}
            <div className="flex-1 space-y-2">
              <input type="file" accept="image/*" onChange={handleImage}
                     className="input text-mid file:btn-ghost file:mr-2 file:rounded-lg
                                file:border-0 file:text-xs file:px-3 file:py-1.5
                                file:bg-raised file:text-mid cursor-pointer" />
              <p className="text-faint text-xs">Or paste image URL:</p>
              <input value={form.imageUrl} onChange={e => { f('imageUrl')(e); setPreview(e.target.value) }}
                     placeholder="https://example.com/image.jpg" className="input text-xs" />
            </div>
          </div>
        </div>

        {/* Availability toggle */}
        <div className="sm:col-span-2 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setForm(p => ({ ...p, available: !p.available }))}
            className={`relative w-11 h-6 rounded-full transition-colors duration-300
                       ${form.available ? 'bg-done' : 'bg-border'}`}
          >
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow
                             transition-transform duration-300
                             ${form.available ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
          <span className="text-sm font-body text-mid">
            {form.available ? 'Available on menu' : 'Hidden from customers'}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={() => onSave(form, imgFile)}
          disabled={saving || !form.name || !form.price}
          className="btn-amber flex-1 py-3"
        >
          {saving ? <><MiniSpinner /> Saving…</> : initial.id ? '✓ Save Changes' : '+ Add Item'}
        </button>
        <button onClick={onCancel} className="btn-ghost px-5">Cancel</button>
      </div>
    </div>
  )
}

// ── Main Menu Manager ──────────────────────────────────────────────────────
export default function MenuManager({ restaurantId }) {
  const { items, loading, addItem, updateItem, deleteItem, toggleAvailability } = useMenu(restaurantId)
  const { config } = useConfig(restaurantId)

  const [mode,    setMode]    = useState('list')   // 'list' | 'add' | item-object (edit)
  const [saving,  setSaving]  = useState(false)
  const [deleting,setDeleting]= useState(null)
  const [toast,   setToast]   = useState('')
  const [search,  setSearch]  = useState('')

  const categories = useMemo(() => {
    if (!config?.categories) return ['Other']
    return config.categories.split(',').map(c => c.trim()).filter(Boolean)
  }, [config?.categories])

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const handleSave = async (form, imgFile) => {
    setSaving(true)
    try {
      if (mode?.id) {
        await updateItem(mode.id, form, imgFile)
        showToast('✓ Item updated')
      } else {
        await addItem(form, imgFile)
        showToast('✓ Item added to menu')
      }
      setMode('list')
    } catch (err) {
      showToast('❌ ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (item) => {
    if (!confirm(`Delete "${item.name}" from the menu?`)) return
    setDeleting(item.id)
    try {
      await deleteItem(item.id, item.imageUrl)
      showToast('Item removed')
    } catch (err) {
      showToast('❌ ' + err.message)
    } finally {
      setDeleting(null)
    }
  }

  const filtered = items.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    (i.category || '').toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return <Spinner text="Loading menu…" />

  // ── Add / Edit form ────────────────────────────────────────────────────
  if (mode === 'add' || (mode && mode.id)) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center gap-3">
          <button onClick={() => setMode('list')} className="btn-icon">←</button>
          <h2 className="section-title text-xl">{mode.id ? 'Edit Item' : 'Add New Item'}</h2>
        </div>
        <div className="card p-6">
          <ItemForm
            key={mode.id || categories.join(',')}
            initial={mode.id ? mode : EMPTY_FORM}
            onSave={handleSave}
            onCancel={() => setMode('list')}
            saving={saving}
            categories={categories}
          />
        </div>
      </div>
    )
  }

  // ── Item list ──────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 animate-fade-in">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 px-5 py-3 bg-card border border-border
                        rounded-xl text-bright text-sm font-body shadow-lifted
                        animate-slide-up">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="section-title text-xl">Menu Items</h2>
          <p className="text-mid text-xs mt-0.5">{items.length} items total</p>
        </div>
        <button onClick={() => setMode('add')} className="btn-amber">+ Add Item</button>
      </div>

      {/* Search */}
      <input value={search} onChange={e => setSearch(e.target.value)}
             placeholder="Search items…" className="input max-w-xs" />

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <p className="text-5xl">🍽️</p>
          <p className="text-mid font-body">No items yet. Add your first menu item!</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(item => (
            <div key={item.id} className="card overflow-hidden">
              {/* Image */}
              <div className="relative h-36 bg-surface">
                {item.imageUrl
                  ? <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-4xl">🍽️</div>
                }
                {/* Availability badge */}
                <span className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px]
                                 font-bold uppercase tracking-wide
                                 ${item.available !== false
                                   ? 'bg-done/20 text-done border border-done/30'
                                   : 'bg-danger/20 text-danger border border-danger/30'
                                 }`}>
                  {item.available !== false ? 'Available' : 'Hidden'}
                </span>
              </div>

              {/* Body */}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="font-body font-semibold text-bright text-sm leading-snug flex-1">
                    {item.name}
                  </h3>
                  <span className="text-amber font-display font-semibold text-sm flex-shrink-0">
                    {fmt(item.price)}
                  </span>
                </div>
                <p className="text-faint text-xs mb-1">{item.category}</p>
                {item.description && (
                  <p className="text-mid text-xs line-clamp-1 mb-3">{item.description}</p>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  <button onClick={() => setMode(item)} className="btn-ghost flex-1 text-xs py-2">
                    ✏️ Edit
                  </button>
                  <button
                    onClick={() => toggleAvailability(item.id, item.available !== false)}
                    className="btn-ghost flex-1 text-xs py-2"
                    title="Toggle availability"
                  >
                    {item.available !== false ? '🙈 Hide' : '👁 Show'}
                  </button>
                  <button
                    onClick={() => handleDelete(item)}
                    disabled={deleting === item.id}
                    className="btn-danger flex-1 text-xs py-2"
                  >
                    {deleting === item.id ? <MiniSpinner /> : '🗑️'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
