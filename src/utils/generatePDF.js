// src/utils/generatePDF.js
// FIXES:
//   1. Invoice: order.total IS the subtotal; grand total = total + tax
//   2. Customer name displayed in invoice meta box
//   3. Tax label shows dynamic percentage from config
//   4. Column alignment fixed — price/total right-aligned with consistent x positions
//   5. Subtotal row added before tax row (was missing before)

import jsPDF from 'jspdf'

// Custom formatter replacing ₹ with Rs. because jsPDF standard fonts don't support UTF-8 currency symbols
const fmt = (n) => `Rs. ${Number(n).toFixed(2)}`

// ─────────────────────────────────────────────────────────────────────────────
// SINGLE ORDER INVOICE
// ─────────────────────────────────────────────────────────────────────────────
export function generateInvoice(order, config = {}) {
  const restaurantName = config.restaurant_name || 'TableServe'
  const tagline        = config.tagline         || 'Restaurant Management System'
  const address        = config.address         || ''
  const phone          = config.phone           || ''
  const gstNumber      = config.gst_number      || ''
  
  const taxVal         = Number(config.tax_percentage)
  const taxPct         = isNaN(taxVal) || taxVal < 0 ? 8 : taxVal

  const doc = new jsPDF({ unit: 'mm', format: 'a5', orientation: 'portrait' })
  const W   = doc.internal.pageSize.getWidth()   // 148mm
  const M   = 12
  const R   = W - M
  let   y   = 0

  const t   = (str, x, cy, opts = {}) => doc.text(String(str), x, cy, opts)
  const hr  = (cy, color = [220, 210, 195]) => {
    doc.setDrawColor(...color)
    doc.setLineWidth(0.25)
    doc.line(M, cy, R, cy)
  }

  // ── Header ──────────────────────────────────────────────────────────────
  doc.setFillColor(14, 14, 16)
  doc.rect(0, 0, W, 34, 'F')

  y = 11
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(245, 158, 11)
  t(restaurantName, W / 2, y, { align: 'center' })

  y = 17
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(7.5)
  doc.setTextColor(180, 170, 160)
  t(tagline, W / 2, y, { align: 'center' })

  if (address) {
    y = 22
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(140, 130, 120)
    t(address, W / 2, y, { align: 'center' })
  }

  const contactParts = [phone, gstNumber ? `GST: ${gstNumber}` : ''].filter(Boolean)
  if (contactParts.length) {
    y = 28
    doc.setFontSize(7)
    doc.setTextColor(140, 130, 120)
    t(contactParts.join('  ·  '), W / 2, y, { align: 'center' })
  }

  // ── INVOICE title ────────────────────────────────────────────────────────
  y = 42
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(30, 30, 30)
  t('INVOICE', W / 2, y, { align: 'center' })

  // ── Order meta box ───────────────────────────────────────────────────────
  y = 47
  const hasCustomer = !!(order.customerName)
  const metaH       = hasCustomer ? 28 : 22
  doc.setFillColor(245, 242, 235)
  doc.roundedRect(M, y, W - M * 2, metaH, 2, 2, 'F')

  const col1 = M + 4
  const col2 = W / 2 - 2
  const col3 = R - 28

  y += 6
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.5)
  doc.setTextColor(130, 120, 100)
  t('ORDER ID', col1, y)
  t('TABLE',    col2, y)
  t('DATE',     col3, y)

  y += 7
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(200, 120, 20)
  t(`#${order.orderId}`, col1, y)

  doc.setFontSize(12)
  doc.setTextColor(30, 30, 30)
  t(String(order.table), col2, y)

  const orderDate = order.createdAt
    ? new Date(order.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  const orderTime = order.createdAt
    ? new Date(order.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
    : ''
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(60, 55, 45)
  t(orderDate, col3, y - 2)
  t(orderTime, col3, y + 4)

  // Customer name row
  if (hasCustomer) {
    y += 9
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6.5)
    doc.setTextColor(130, 120, 100)
    t('CUSTOMER', col1, y)
    y += 5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(30, 30, 30)
    t(order.customerName, col1, y)
  }

  // ── Items table header ───────────────────────────────────────────────────
  y = 47 + metaH + 6
  doc.setFillColor(30, 30, 36)
  doc.rect(M, y, W - M * 2, 8, 'F')

  // Fixed column x positions — right-aligned numerics
  const C_ITEM  = M + 3        // item name  — left
  const C_QTY   = R - 38       // qty        — left
  const C_PRICE = R - 18       // unit price — RIGHT aligned
  const C_TOTAL = R - 2        // line total — right

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(245, 158, 11)
  t('ITEM',    C_ITEM,  y + 5.5)
  t('QTY',     C_QTY,   y + 5.5)
  t('PRICE',   C_PRICE, y + 5.5, { align: 'right' })
  t('TOTAL',   C_TOTAL, y + 5.5, { align: 'right' })

  // ── Items rows ───────────────────────────────────────────────────────────
  y += 10
  const items = order.items || []
  items.forEach((item, idx) => {
    if (idx % 2 === 0) {
      doc.setFillColor(251, 248, 243)
      doc.rect(M, y - 2, W - M * 2, 8.5, 'F')
    }
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(35, 30, 20)
    const name = item.name.length > 24 ? item.name.slice(0, 24) + '...' : item.name
    t(name,                          C_ITEM,  y + 4)
    t(String(item.qty),              C_QTY,   y + 4)
    t(fmt(item.price),               C_PRICE, y + 4, { align: 'right' })
    t(fmt(item.price * item.qty),    C_TOTAL, y + 4, { align: 'right' })
    y += 8.5
  })

  // ── Divider ──────────────────────────────────────────────────────────────
  y += 3
  hr(y)
  y += 7

  // ── Totals section ───────────────────────────────────────────────────────
  // UI sends order.subtotal explicitly. DB rows use order.total for subtotal.
  const subtotal   = order.subtotal !== undefined ? order.subtotal : (order.total || 0)
  const taxAmt     = order.tax   || 0
  const grandTotal = subtotal + taxAmt

  const LX = R - 40   // label x
  const VX = R - 2    // value x (right-aligned)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(100, 90, 75)
  t('Subtotal',         LX, y);             t(fmt(subtotal),   VX, y, { align: 'right' })
  y += 7
  t(`Tax (${taxPct}%)`, LX, y);             t(fmt(taxAmt),     VX, y, { align: 'right' })

  // ── Grand total box ──────────────────────────────────────────────────────
  y += 5
  doc.setFillColor(14, 14, 16)
  doc.roundedRect(M, y, W - M * 2, 13, 2, 2, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(255, 255, 255)
  t('TOTAL AMOUNT', M + 5, y + 8.5)
  doc.setFontSize(11)
  doc.setTextColor(245, 158, 11)
  t(fmt(grandTotal), R - 3, y + 8.5, { align: 'right' })

  y += 19

  // ── Note / instructions ───────────────────────────────────────────────────
  const noteText = order.note || order.instructions || ''
  if (noteText) {
    doc.setFillColor(255, 250, 230)
    const noteLines = doc.splitTextToSize(`Note: ${noteText}`, W - M * 2 - 8)
    const noteH     = noteLines.length * 5 + 8
    doc.roundedRect(M, y, W - M * 2, noteH, 2, 2, 'F')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(90, 75, 50)
    doc.text(noteLines, M + 4, y + 6)
    y += noteH + 6
  }

  // ── Footer ───────────────────────────────────────────────────────────────
  y += 4
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(160, 150, 130)
  t('Thank you for dining with us!', W / 2, y, { align: 'center' })
  y += 5
  t('Please pay at the counter.', W / 2, y, { align: 'center' })
  y += 5
  doc.setTextColor(200, 120, 20)
  t('We look forward to welcoming you again', W / 2, y, { align: 'center' })

  const filename = `Invoice-${order.orderId || 'order'}-Table${order.table}.pdf`
  doc.save(filename)
}

// ─────────────────────────────────────────────────────────────────────────────
// DAILY / MONTHLY REPORT
// ─────────────────────────────────────────────────────────────────────────────
export function generateReport({ type, orders, label, config = {} }) {
  const restaurantName = config.restaurant_name || 'TableServe'
  const tagline        = config.tagline         || 'Restaurant Management System'
  const address        = config.address         || ''
  const phone          = config.phone           || ''
  const gstNumber      = config.gst_number      || ''

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  const W   = doc.internal.pageSize.getWidth()
  const M   = 16
  const R   = W - M
  let   y   = 0

  const t  = (str, x, cy, opts = {}) => doc.text(String(str), x, cy, opts)

  // ── Header ──────────────────────────────────────────────────────────────
  doc.setFillColor(14, 14, 16)
  doc.rect(0, 0, W, 36, 'F')

  y = 12
  doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(245, 158, 11)
  t(restaurantName, W / 2, y, { align: 'center' })

  y = 19
  doc.setFont('helvetica', 'italic'); doc.setFontSize(8.5); doc.setTextColor(180, 170, 160)
  t(tagline, W / 2, y, { align: 'center' })

  y = 25
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(140, 130, 120)
  if (address) t(address, W / 2, y, { align: 'center' })

  y = 30
  const contactParts = [phone, gstNumber ? `GST: ${gstNumber}` : ''].filter(Boolean)
  if (contactParts.length) t(contactParts.join('  ·  '), W / 2, y, { align: 'center' })

  // ── Report title ─────────────────────────────────────────────────────────
  y = 46
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(30, 30, 30)
  t(type === 'daily' ? 'Daily Sales Report' : 'Monthly Sales Report', W / 2, y, { align: 'center' })

  y = 53
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(100, 100, 100)
  t(label, W / 2, y, { align: 'center' })

  // ── Summary stats ────────────────────────────────────────────────────────
  y += 10
  // grand total per order = total (subtotal) + tax
  const totalRevenue = orders.reduce((s, o) => s + (o.total || 0) + (o.tax || 0), 0)
  const totalOrders  = orders.length
  const avgOrder     = totalOrders ? totalRevenue / totalOrders : 0

  doc.setFillColor(248, 245, 240)
  doc.roundedRect(M, y, W - M * 2, 32, 3, 3, 'F')
  doc.setDrawColor(225, 215, 195); doc.setLineWidth(0.3)
  doc.roundedRect(M, y, W - M * 2, 32, 3, 3, 'S')

  const cw = (W - M * 2) / 3
  ;[
    { label: 'Total Revenue', value: fmt(totalRevenue) },
    { label: 'Total Orders',  value: String(totalOrders) },
    { label: 'Average Order', value: fmt(avgOrder) },
  ].forEach((col, i) => {
    const cx = M + cw * i + cw / 2
    doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(200, 120, 20)
    t(col.value, cx, y + 14, { align: 'center' })
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(120, 100, 80)
    t(col.label, cx, y + 22, { align: 'center' })
  })

  // ── Orders table ─────────────────────────────────────────────────────────
  y += 40
  doc.setFillColor(30, 30, 36)
  doc.rect(M, y, W - M * 2, 8, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(245, 158, 11)

  const CX = [M + 4, M + 32, M + 52, M + 90, R - 38, R - 4]
  const HDRS = ['Order ID', 'Table', 'Customer', 'Items', 'Status', 'Total']
  const ALIGNS = ['left', 'left', 'left', 'left', 'left', 'right']
  HDRS.forEach((h, i) => t(h, CX[i], y + 5.5, { align: ALIGNS[i] }))
  y += 10

  orders.forEach((order, idx) => {
    const itemStr = (order.items || []).map(i => `${i.qty}x ${i.name}`).join(', ')
    const itemLines = doc.splitTextToSize(itemStr, 46)
    const grand   = (order.total || 0) + (order.tax || 0)
    
    // Calculate required row height
    const rowH = Math.max(8.5, itemLines.length * 4 + 4.5)

    if (y + rowH > 275) { doc.addPage(); y = 20 }
    
    if (idx % 2 === 0) {
      doc.setFillColor(250, 248, 244)
      doc.rect(M, y - 2, W - M * 2, rowH, 'F')
    }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(40, 35, 30)

    t(order.orderId || '-',         CX[0], y + 3.5)
    t(order.table   || '-',         CX[1], y + 3.5)
    t((order.customerName || '-').slice(0, 14), CX[2], y + 3.5)
    doc.text(itemLines,             CX[3], y + 3.5)

    const statusColor = {
      done:      [34, 197, 94],
      preparing: [96, 165, 250],
      pending:   [250, 204, 21],
    }[order.status] || [100, 100, 100]
    doc.setTextColor(...statusColor)
    t(order.status || '-',          CX[4], y + 3.5)

    doc.setTextColor(40, 35, 30)
    t(fmt(grand),                   CX[5], y + 3.5, { align: 'right' })
    y += rowH
  })

  // ── Generated timestamp ───────────────────────────────────────────────────
  const pageH = doc.internal.pageSize.getHeight()
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(160, 150, 140)
  t(`Generated: ${new Date().toLocaleString('en-IN')}`, W / 2, pageH - 8, { align: 'center' })

  const filename = type === 'daily'
    ? `${restaurantName.replace(/\s+/g, '-')}-Daily-${new Date().toISOString().slice(0, 10)}.pdf`
    : `${restaurantName.replace(/\s+/g, '-')}-Monthly-${new Date().toISOString().slice(0, 7)}.pdf`

  doc.save(filename)
}
