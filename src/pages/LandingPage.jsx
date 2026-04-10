// src/pages/LandingPage.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import hero1 from '../assets/hero1.png'
import hero2 from '../assets/hero2.png'
import hero3 from '../assets/hero3.png'
import Footer from '../components/Footer'

const IMAGES = [hero1, hero2, hero3]

export default function LandingPage() {
  const navigate = useNavigate()
  const [activeSlide, setActiveSlide] = useState(0)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlide(prev => (prev + 1) % IMAGES.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [])

  const ROLES = [
    { id: 'superadmin', name: 'Super Admin', icon: '🛡️', desc: 'Platform Management', accent: 'amber' },
    { id: 'admin',      name: 'Restaurant Admin', icon: '⚙️', desc: 'Menu & Staff Control', accent: 'amber' },
    { id: 'waiter',     name: 'Waiter Dashboard', icon: '👨‍🍳', desc: 'Order Tracking', accent: 'amber' },
  ]

  return (
    <div className="min-h-screen bg-base font-body text-bright">
      {/* ── Navbar ─────────────────────────────────────────────────── */}
      <nav className="fixed top-0 z-50 w-full glass border-b border-border/50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-display italic text-amber text-2xl tracking-tight">TableServe</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-body">
            <div className="flex items-center gap-8 text-mid font-semibold">
              <a href="#home" className="hover:text-bright transition-colors">Home</a>
              <a href="#how-it-works" className="hover:text-bright transition-colors">How It Works</a>
              <a href="#about" className="hover:text-bright transition-colors">About Us</a>
              <a href="#contact" className="hover:text-bright transition-colors">Contact</a>
            </div>
            <button 
              onClick={() => document.getElementById('login-section')?.scrollIntoView({ behavior: 'smooth' })}
              className="btn-amber py-2 px-5 text-sm font-bold shadow-sm"
            >
              Sign In
            </button>
          </div>

          {/* Mobile Menu Toggle */}
          <button 
            className="md:hidden text-bright p-2"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            <div className="space-y-1.5">
              <div className={`w-6 h-0.5 bg-amber transition-all ${isMobileMenuOpen ? 'rotate-45 translate-y-2' : ''}`} />
              <div className={`w-6 h-0.5 bg-amber transition-all ${isMobileMenuOpen ? 'opacity-0' : ''}`} />
              <div className={`w-6 h-0.5 bg-amber transition-all ${isMobileMenuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
            </div>
          </button>
        </div>

        {/* Mobile Menu Overlay */}
        <div className={`fixed inset-x-0 top-16 glass border-b border-border/50 md:hidden transition-all duration-300 overflow-hidden ${isMobileMenuOpen ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0'}`}>
          <div className="px-6 py-8 flex flex-col gap-6 text-lg font-semibold text-mid">
            <a href="#home" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-amber transition-colors">Home</a>
            <a href="#how-it-works" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-amber transition-colors">How It Works</a>
            <a href="#about" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-amber transition-colors">About Us</a>
            <a href="#contact" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-amber transition-colors">Contact</a>
            <button 
              onClick={() => {
                setIsMobileMenuOpen(false);
                document.getElementById('login-section')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="btn-amber py-3 px-6 w-full"
            >
              Sign In
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero Carousel ──────────────────────────────────────────── */}
      <section id="home" className="relative h-screen w-full overflow-hidden">
        <div className="carousel-container h-full">
          <div 
            className="carousel-track h-full" 
            style={{ transform: `translateX(-${activeSlide * 100}%)` }}
          >
            {IMAGES.map((img, i) => (
              <div key={i} className="carousel-slide h-full relative">
                <img src={img} alt={`Slide ${i}`} className="w-full h-full object-cover opacity-60" />
                <div className="absolute inset-0 bg-gradient-to-t from-base via-base/20 to-transparent" />
              </div>
            ))}
          </div>
        </div>

        {/* Hero Content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 z-10">
          <div className="max-w-4xl mx-auto space-y-8 animate-slide-up">
            <h1 className="text-4xl sm:text-5xl md:text-7xl font-display font-bold bg-gradient-to-r from-amber to-amber-dim bg-clip-text text-transparent italic leading-[1.1] mb-2">
              Modernizing Your <br /> Dining Experience
            </h1>
            <p className="text-base md:text-xl text-mid max-w-2xl mx-auto leading-relaxed italic opacity-90">
              TableServe is the all-in-one SaaS platform for visionary restaurant owners. 
              Automate orders, manage staff, and delight your guests with ease.
            </p>
            <div className="pt-4">
              <button 
                onClick={() => document.getElementById('login-section')?.scrollIntoView({ behavior: 'smooth' })}
                className="btn-amber text-lg py-4 px-12 shadow-2xl shadow-amber/10 active:scale-95 transition-all"
              >
                Get Started Now
              </button>
            </div>
          </div>
        </div>

        {/* Carousel Indicators */}
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-3 z-20">
          {IMAGES.map((_, i) => (
            <button 
              key={i} 
              onClick={() => setActiveSlide(i)}
              className={`transition-all duration-300 rounded-full ${
                activeSlide === i 
                  ? 'w-10 h-1.5 bg-amber shadow-[0_0_10px_rgba(251,191,36,0.5)]' 
                  : 'w-2 h-2 bg-mid/30 hover:bg-mid/50'
              }`}
            />
          ))}
        </div>
      </section>

      {/* ── How It Works Section ───────────────────────────────────── */}
      <section id="how-it-works" className="py-16 md:py-24 px-6 relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] md:w-[800px] h-[300px] md:h-[400px] bg-amber/5 rounded-full blur-[80px] md:blur-[120px] pointer-events-none" />

        <div className="max-w-6xl mx-auto relative z-10">
          <div className="text-center mb-20">
            <h2 className="section-title text-4xl mb-4">The TableServe Journey</h2>
            <p className="text-mid max-w-lg mx-auto italic">Four simple steps to transform your restaurant operations.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              { step: '01', title: 'Scan & Enter', desc: 'Customers scan the QR code to access your branded menu instantly.', icon: '📱' },
              { step: '02', title: 'Digital Orders', desc: 'Guests browse categories and place orders directly from their phones.', icon: '🛒' },
              { step: '03', title: 'Instant Sync', desc: 'Orders appear on the Waiter board immediately via cloud sync.', icon: '⚡' },
              { step: '04', title: 'Live Growth', desc: 'Admins track every sale and update configurations in real-time.', icon: '📈' },
            ].map((s, i) => (
              <div key={i} className="group relative pt-8 flex flex-col items-center md:items-start text-center md:text-left animate-fade-in" style={{ animationDelay: `${i * 150}ms` }}>
                <div className="absolute top-0 left-1/2 -translate-x-1/2 md:left-0 md:translate-x-0 text-7xl font-display font-black text-amber/5 group-hover:text-amber/10 transition-colors pointer-events-none">
                  {s.step}
                </div>
                <div className="relative z-10 space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-amber/10 flex items-center justify-center text-3xl group-hover:bg-amber/20 transition-all group-hover:scale-110 mx-auto md:mx-0">
                    {s.icon}
                  </div>
                  <h3 className="text-xl font-display font-bold text-bright">{s.title}</h3>
                  <p className="text-mid text-sm leading-relaxed max-w-[280px] md:max-w-none">{s.desc}</p>
                </div>
                {i < 3 && (
                  <div className="hidden md:block absolute top-[60px] -right-4 w-8 h-[2px] bg-gradient-to-r from-amber/20 to-transparent" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Login/Roles Section ────────────────────────────────────── */}
      <section id="login-section" className="py-16 md:py-24 px-6 bg-surface/30">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="section-title text-3xl md:text-4xl mb-4">Choose Your Portal</h2>
          <p className="text-mid mb-12 md:mb-16 max-w-lg mx-auto italic">Select your role to access your personalized dashboard.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {ROLES.map((r, i) => (
              <div 
                key={r.id}
                onClick={() => navigate(`/login/${r.id}`)}
                className="group glass-card p-8 md:p-10 rounded-3xl cursor-pointer hover:border-amber/40 transition-all active:scale-[0.98] animate-scale-in"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className="w-20 h-20 rounded-2xl bg-amber/10 flex items-center justify-center text-4xl mb-6 group-hover:scale-110 transition-transform">
                  {r.icon}
                </div>
                <h3 className="text-2xl font-display font-semibold mb-2">{r.name}</h3>
                <p className="text-mid text-sm mb-8">{r.desc}</p>
                <div className="flex items-center justify-center gap-2 text-amber font-bold text-sm uppercase tracking-widest">
                  Sign In <span>→</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── About Section ─────────────────────────────────────────── */}
      <section id="about" className="py-16 md:py-24 px-6 bg-base overflow-hidden">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center gap-12 md:gap-16">
          <div className="flex-1 space-y-6 text-center md:text-left">
            <h2 className="section-title text-3xl md:text-4xl leading-tight">Built for Scale,<br />Designed for People</h2>
            <div className="space-y-4 text-mid leading-relaxed italic text-center md:text-left mx-auto md:mx-0 max-w-[320px] sm:max-w-none">
              <p>
                TableServe was founded by <strong>Raheel Durwesh</strong> with a singular mission: to bridge the gap between human hospitality and digital efficiency.
              </p>
              <p>
                We believe that technology should fade into the background, leaving only the warmth of a great meal and the precision of a well-run business.
              </p>
              <p>
                Whether you are a local café or a multi-city franchise, TableServe grows with you.
              </p>
            </div>
          </div>
          <div className="w-64 h-64 md:w-80 md:h-80 rounded-3xl overflow-hidden border-2 border-amber/20 shadow-2xl rotate-3 mx-auto md:mx-0">
             <img src={hero2} alt="Raheel Durwesh" className="w-full h-full object-cover" />
          </div>
        </div>
      </section>

      {/* ── Contact Section ───────────────────────────────────────── */}
      <section id="contact" className="py-24 px-6 bg-surface/50 relative overflow-hidden">
        {/* Contact Background Glow */}
        <div className="absolute -bottom-40 -left-20 w-64 md:w-96 h-64 md:h-96 bg-amber/10 rounded-full blur-[80px] md:blur-[100px] pointer-events-none" />
        
        <div className="max-w-6xl mx-auto">
          <div className="glass-card rounded-[32px] md:rounded-[40px] p-8 md:p-12 overflow-hidden relative">
            <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16">
              <div className="text-center md:text-left">
                <h2 className="section-title text-3xl md:text-4xl mb-6">Let's Connect</h2>
                <p className="text-mid mb-10 text-base md:text-lg italic">
                  Have questions or need a custom solution? Reach out directly to our founder.
                </p>
                
                <div className="space-y-8">
                  <a 
                    href="https://wa.me/919359300613" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="flex items-center justify-center md:justify-start gap-5 group/item cursor-pointer"
                  >
                    <div className="w-12 h-12 rounded-xl bg-amber/10 flex items-center justify-center text-xl group-hover/item:bg-amber/20 transition-colors">📱</div>
                    <div>
                      <p className="text-xs text-amber font-bold uppercase tracking-widest">WhatsApp</p>
                      <p className="text-bright font-semibold group-hover/item:text-amber transition-colors">+91 93593 00613</p>
                    </div>
                  </a>
                  <div className="flex items-center gap-5">
                    <div className="w-12 h-12 rounded-xl bg-amber/10 flex items-center justify-center text-xl">📸</div>
                    <div>
                      <p className="text-xs text-amber font-bold uppercase tracking-widest">Instagram</p>
                      <a href="https://www.instagram.com/raheeldurwesh" target="_blank" rel="noopener noreferrer" className="text-bright font-semibold hover:text-amber transition-colors">
                        @raheeldurwesh
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              <form className="space-y-4" onSubmit={e => e.preventDefault()}>
                <input className="input h-14" placeholder="Your Name" />
                <input className="input h-14" placeholder="Email Address" />
                <textarea className="input min-h-[140px]" placeholder="How can we help?" />
                <button className="btn-amber w-full py-4 text-base shadow-xl">Send Message</button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <div className="bg-base px-6">
        <Footer />
      </div>
    </div>
  )
}
