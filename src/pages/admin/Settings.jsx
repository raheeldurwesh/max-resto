// src/pages/admin/Settings.jsx

import { useState, useEffect, useRef, useCallback } from 'react'
import { useConfig }        from '../../hooks/useConfig'
import { useAuth }          from '../../contexts/AuthContext'
import { supabase }         from '../../supabase/client'
import { MiniSpinner }      from '../../components/Spinner'
import { QRCodeCanvas }     from 'qrcode.react'

const FIELDS = [
  { key: 'restaurant_name', label: 'Restaurant Name',  placeholder: 'Bella Cucina',       type: 'text' },
  { key: 'tagline',         label: 'Tagline',          placeholder: 'Authentic Italian…',  type: 'text' },
  { key: 'address',         label: 'Address',          placeholder: '12 MG Road, Mumbai',  type: 'text' },
  { key: 'phone',           label: 'Phone',            placeholder: '+91 98765 43210',      type: 'text' },
  { key: 'gst_number',      label: 'GST Number',       placeholder: '27AABCU9603R1ZX',     type: 'text' },
]

function Toast({ msg }) {
  if (!msg) return null
  return (
    <div className="fixed bottom-6 right-6 z-50 px-5 py-3 bg-card border border-border
                    rounded-xl text-bright text-sm font-body shadow-lifted animate-slide-up">
      {msg}
    </div>
  )
}

export default function Settings({ restaurantId }) {
  const { config, loading, saveConfig } = useConfig(restaurantId)
  const [restaurantSlug, setRestaurantSlug] = useState('')

  // Fetch slug for QR code URL generation
  useEffect(() => {
    if (!restaurantId) return
    supabase.from('restaurants').select('slug').eq('id', restaurantId).single()
      .then(({ data }) => { if (data?.slug) setRestaurantSlug(data.slug) })
  }, [restaurantId])
  const [form,   setForm]   = useState({})
  const [taxPct, setTaxPct] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast,  setToast]  = useState('')

  useEffect(() => {
    if (!loading) {
      setForm({
        restaurant_name: config.restaurant_name || '',
        tagline:         config.tagline         || '',
        address:         config.address         || '',
        phone:           config.phone           || '',
        gst_number:      config.gst_number      || '',
        total_tables:    config.total_tables    || 20,
      })
      setTaxPct(String(config.tax_percentage ?? 8))
    }
  }, [loading, config])

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const handleSave = async (e) => {
    e.preventDefault()
    const taxVal = parseFloat(taxPct)
    if (isNaN(taxVal) || taxVal < 0 || taxVal > 100) {
      showToast('❌ Tax must be between 0 and 100')
      return
    }
    const tTables = parseInt(form.total_tables, 10)
    if (isNaN(tTables) || tTables < 1 || tTables > 100) {
      window.alert('❌ Limit Reached: Total tables must be between 1 and 100.')
      return
    }
    setSaving(true)
    try {
      await saveConfig({ ...form, tax_percentage: taxVal, total_tables: tTables })
      showToast('✓ Settings saved — reflected everywhere instantly')
    } catch (err) {
      showToast('❌ ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <Toast msg={toast} />

      <div>
        <h2 className="section-title text-xl">Settings</h2>
        <p className="text-mid text-xs mt-0.5">
          Stored in Supabase · Reflected in UI, invoices, and PDFs automatically
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        {/* ── Restaurant Info ──────────────────────────────────────── */}
        <div className="card p-6 space-y-4">
          <h3 className="section-title text-base">Restaurant Info</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {FIELDS.map(f => (
              <div key={f.key} className={f.key === 'address' ? 'sm:col-span-2' : ''}>
                <label className="label">{f.label}</label>
                <input
                  type={f.type}
                  value={form[f.key] || ''}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="input"
                  disabled={loading}
                />
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-border">
            <h3 className="section-title text-base sm:whitespace-nowrap">Table Management</h3>
            <div className="flex gap-4 items-center mt-3">
              <label className="label whitespace-nowrap mb-0 w-32">Total Tables</label>
              <input
                type="number"
                value={form.total_tables || ''}
                onChange={e => setForm(p => ({ ...p, total_tables: e.target.value }))}
                min="1" max="100"
                className="input max-w-[120px]"
                disabled={loading}
              />
            </div>
            <p className="text-faint text-xs mt-2">
              Limits how many tables customers can order from. Any number beyond this limit will be blocked.
            </p>
          </div>
        </div>

        {/* ── Tax Rate ─────────────────────────────────────────────── */}
        <div className="card p-6 space-y-4">
          <h3 className="section-title text-base">Tax / GST Rate</h3>
          <p className="text-mid text-xs">Applied to every order at checkout.</p>

          <div className="flex gap-3 items-center">
            <input
              type="number"
              value={taxPct}
              onChange={e => setTaxPct(e.target.value)}
              min="0" max="100" step="0.1"
              placeholder="8"
              className="input max-w-[120px]"
              disabled={loading}
            />
            <span className="text-mid text-sm font-body">%</span>
          </div>

          {taxPct && !isNaN(taxPct) && (
            <div className="bg-raised rounded-xl p-4 space-y-2 border border-border text-sm font-body">
              <p className="text-mid text-xs uppercase tracking-wide font-semibold mb-2">
                Live Preview — ₹1,000 order
              </p>
              <div className="flex justify-between text-mid">
                <span>Subtotal</span>
                <span className="text-bright">₹1,000.00</span>
              </div>
              <div className="flex justify-between text-mid">
                <span>Tax ({taxPct}%)</span>
                <span className="text-bright">
                  ₹{(1000 * parseFloat(taxPct) / 100).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between font-semibold border-t border-border pt-2">
                <span className="text-bright">Total</span>
                <span className="text-amber">
                  ₹{(1000 + 1000 * parseFloat(taxPct) / 100).toFixed(2)}
                </span>
              </div>
            </div>
          )}
        </div>

        <button type="submit" disabled={saving || loading} className="btn-amber py-3 px-8">
          {saving ? <><MiniSpinner /> Saving…</> : '✓ Save All Settings'}
        </button>
      </form>

        {/* ── Table QR Codes ───────────────────────────────────────── */}
      <div className="card p-6">
        <h3 className="section-title text-base mb-1">Table QR Codes</h3>
        <p className="text-mid text-xs mb-5">
          Each QR opens the menu for that table. Click ⬇️ to download as PNG.
        </p>
        <TableQRGrid 
          count={Math.min(parseInt(form.total_tables) || 0, 100)} 
          slug={restaurantSlug} 
        />
      </div>
    </div>
  )
}

// ── QR Grid with individual download buttons ──────────────────────────────────
function TableQRGrid({ count, slug }) {
  const [downloading, setDownloading] = useState(null)
  const canvasRefs = useRef({})

  const base = typeof window !== 'undefined' ? window.location.origin : 'https://yoursite.com'
  const urlPrefix = slug ? `${base}/${slug}` : `${base}/`

  // Download a single QR as PNG
  const downloadQR = useCallback((tableNum) => {
    setDownloading(tableNum)
    try {
      // The QRCodeCanvas renders into a <canvas> element — grab it by id
      const canvas = document.getElementById(`qr-canvas-${tableNum}`)
      if (!canvas) return

      // Create a new canvas with padding + label
      const padded = document.createElement('canvas')
      const size   = 160
      const pad    = 20
      const labelH = 30
      padded.width  = size + pad * 2
      padded.height = size + pad * 2 + labelH

      const ctx = padded.getContext('2d')
      // White background
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, padded.width, padded.height)
      // QR code
      ctx.drawImage(canvas, pad, pad, size, size)
      // Label text
      ctx.fillStyle = '#1a1a1a'
      ctx.font      = 'bold 14px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(`Table ${tableNum}`, padded.width / 2, size + pad + labelH - 8)

      // Trigger download
      const link   = document.createElement('a')
      link.download = `Table-${tableNum}-QR.png`
      link.href     = padded.toDataURL('image/png')
      link.click()
    } finally {
      setTimeout(() => setDownloading(null), 600)
    }
  }, [])

  // Download ALL QR codes as HD PDF
  const downloadAllPDF = useCallback(() => {
    import('jspdf').then(({ default: jsPDF }) => {
      const doc = new jsPDF({ format: 'a4', unit: 'mm' })
      const cols = 4
      const rows = 5
      const perPage = cols * rows
      
      // Calculate centering for A4 (210x297)
      const qrSize = 40
      const cellW = 45
      const cellH = 55
      const totalW = cols * cellW
      const startX = (210 - totalW) / 2 + 2.5
      const startY = 20

      for (let t = 1; t <= count; t++) {
        const pageIdx = Math.floor((t - 1) / perPage)
        const inPageIdx = (t - 1) % perPage
        
        if (inPageIdx === 0 && pageIdx > 0) {
          doc.addPage()
        }
        
        const col = inPageIdx % cols
        const row = Math.floor(inPageIdx / cols)
        
        const x = startX + col * cellW
        const y = startY + row * cellH
        
        const canvas = document.getElementById(`qr-canvas-${t}`)
        if (!canvas) continue

        const imgData = canvas.toDataURL('image/png', 1.0)
        doc.addImage(imgData, 'PNG', x, y, qrSize, qrSize)
        
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(12)
        doc.setTextColor(30, 30, 30)
        doc.text(`Table ${t}`, x + qrSize / 2, y + qrSize + 6, { align: 'center' })
      }
      
      doc.save('Table-QRCodes-HD.pdf')
    })
  }, [count])

  // Download ALL QR codes as a single multi-column PNG
  const downloadAllPNG = useCallback(() => {
    const cols    = 4
    const rows    = Math.ceil(count / cols)
    const qrSize  = 160
    const pad     = 16
    const labelH  = 28
    const cellW   = qrSize + pad * 2
    const cellH   = qrSize + pad * 2 + labelH
    const totalW  = cellW * cols
    const totalH  = cellH * rows

    const combined = document.createElement('canvas')
    combined.width  = totalW
    combined.height = totalH

    const ctx = combined.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, totalW, totalH)

    for (let t = 1; t <= count; t++) {
      const canvas = document.getElementById(`qr-canvas-${t}`)
      if (!canvas) continue
      const col = (t - 1) % cols
      const row = Math.floor((t - 1) / cols)
      const x   = col * cellW + pad
      const y   = row * cellH + pad
      ctx.drawImage(canvas, x, y, qrSize, qrSize)
      ctx.fillStyle  = '#1a1a1a'
      ctx.font       = 'bold 13px sans-serif'
      ctx.textAlign  = 'center'
      ctx.fillText(`Table ${t}`, x + qrSize / 2, y + qrSize + 20)
    }

    const link    = document.createElement('a')
    link.download = 'All-Table-QRCodes.png'
    link.href     = combined.toDataURL('image/png')
    link.click()
  }, [count])

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex justify-end gap-3 flex-wrap">
        <button
          onClick={downloadAllPNG}
          className="btn-ghost text-sm py-2 px-5 flex items-center gap-2"
        >
          🖼️ Download All (PNG)
        </button>
        <button
          onClick={downloadAllPDF}
          className="btn-amber text-sm py-2 px-5 flex items-center gap-2"
        >
          📄 Download All (HD PDF)
        </button>
      </div>

      {/* QR Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {Array.from({ length: count }, (_, i) => i + 1).map(t => (
          <div key={t} className="bg-raised border border-border rounded-xl p-3 text-center space-y-2">
            <p className="text-mid text-[10px] font-body uppercase tracking-widest">
              Table {t}
            </p>

            {/* Hidden canvas used for download — QRCodeCanvas renders to actual canvas */}
            <div className="bg-white p-2 rounded-lg inline-block">
              <QRCodeCanvas
                id={`qr-canvas-${t}`}
                value={`${urlPrefix}?table=${t}`}
                size={120}
                bgColor="#ffffff"
                fgColor="#0e0e10"
                level="M"
              />
            </div>

            <p className="text-faint text-[9px] break-all">?table={t}</p>

            {/* Download button */}
            <button
              onClick={() => downloadQR(t)}
              disabled={downloading === t}
              className="w-full py-1.5 rounded-lg text-xs font-body font-semibold
                         bg-amber/10 border border-amber/25 text-amber
                         hover:bg-amber/20 transition-all active:scale-95
                         disabled:opacity-50 flex items-center justify-center gap-1"
            >
              {downloading === t ? '…' : '⬇️ Download'}
            </button>
          </div>
        ))}
      </div>

      <p className="text-faint text-xs">
        Or use Ctrl+P to print this page with all QR codes.
      </p>
    </div>
  )
}
