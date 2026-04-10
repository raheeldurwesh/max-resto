# TableServe POS 🏪 — SaaS Restaurant Management System

**Handcrafted for Excellence**
Developed by **[Raheel Durwesh](https://www.instagram.com/raheeldurwesh)**

TableServe is a high-performance, multi-tenant SaaS platform built for modern restaurant operations. It seamlessly bridges the gap between guest ordering, kitchen coordination, and administrative control using real-time cloud architecture.

---

## 🚀 Key Features

### 👤 Multi-Tenant Dashboards
- **Super Admin Control Center**: Manage multiple restaurants, onboard new owners via email invitation, and monitor global storage/status.
- **Restaurant Admin Panel**: Total control over menu items, categories, tax settings, and live revenue analytics.
- **Live Waiter Board**: Real-time order tracking with instant push notifications and status management (Pending → Preparing → Done).

### 🍽️ Customer Dining Experience
- **QR-Driven Menus**: Slug-based dynamic routing (e.g., `tableserve.com/nasheman?table=5`).
- **Real-time Availability**: Instant updates when an item is toggled 'out of stock' by the admin.
- **Digital Cart & Invoicing**: Estimated totals with tax calculation and downloadable PDF bills.

### 🔐 Enterprise-Grade Security
- **Role-Based Access Control (RBAC)**: Strict isolation between Super Admins, Admins, and Waiters.
- **Impersonation Mode**: Allows Super Admins to safely view and manage specific restaurant dashboards with a secure exit flow.
- **Invitation System**: Secure onboarding where owners set their own passwords via email verification.
- **Forgot Password**: Self-service account recovery for management-level roles.

---

## 🛠️ Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS
- **Interactivity**: Framer Motion (Animations), Lucide React
- **Backend / Real-time**: [Supabase](https://supabase.com/) (PostgreSQL + GoTrue + Realtime)
- **State Management**: React Context API
- **Routing**: React Router v6 (Slug-based dynamic architecture)
- **Utilities**: jsPDF (Invoice generation), Date-fns

---

## 📋 Getting Started

### 1. Prerequisites
- Node.js (v18+)
- Supabase Project

### 2. Environment Variables
Create a `.env` file in the root directory:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_public_key
VITE_SUPABASE_SERVICE_ROLE_KEY=your_service_role_key (Restricted to Super Admin features)
```

### 3. Installation
```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

---

## 🧱 Architecture Highlights

### Row-Level Security (RLS)
The database is secured by PostgreSQL RLS policies ensuring that:
- **Restaurant Admins** only see their own menu and orders.
- **Waiters** only see active orders for their assigned restaurant.
- **Guests** can only read the menu for the restaurant identified by the URL slug.

### Real-time Sync
Utilizes Supabase Postgres Changes and Broadcast channels to ensure that the Waiter Board reflects new orders the millisecond they are placed by customers.

---

## 🎨 Branding
This system features premium branding for the developer:
- **Signature**: "Developed by Raheel Durwesh" integrated platform-wide.
- **Social**: Linked directly to [@raheeldurwesh](https://www.instagram.com/raheeldurwesh) on Instagram.

---

## ⚖️ License
© 2026 Raheel Durwesh. All Rights Reserved. Part of the TableServe Ecosystem.
