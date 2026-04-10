// src/components/WakeUp.jsx
// Shown when Supabase project is waking up from auto-pause (free tier)

export default function WakeUp({ onRetry }) {
  return (
    <div className="fixed inset-0 z-[100] bg-base/95 backdrop-blur-sm
                    flex items-center justify-center px-6">
      <div className="text-center max-w-sm animate-fade-in space-y-6">
        {/* Animated pulse */}
        <div className="relative mx-auto w-20 h-20">
          <div className="absolute inset-0 rounded-full bg-amber/20 animate-ping" />
          <div className="relative w-20 h-20 rounded-full bg-amber/10 border-2 border-amber/30
                          flex items-center justify-center text-3xl">
            ☕
          </div>
        </div>

        <div>
          <h2 className="font-display text-bright text-2xl mb-2">Waking up server…</h2>
          <p className="text-mid text-sm font-body leading-relaxed">
            The database is starting after a period of inactivity.
            This usually takes <strong className="text-bright">20–30 seconds</strong>.
          </p>
        </div>

        {/* Animated dots */}
        <div className="flex justify-center gap-2">
          {[0, 1, 2].map(i => (
            <span
              key={i}
              className="w-2 h-2 rounded-full bg-amber animate-pulse-dot"
              style={{ animationDelay: `${i * 0.25}s` }}
            />
          ))}
        </div>

        <div className="space-y-3">
          <p className="text-faint text-xs font-body">
            Retrying automatically…
          </p>
          <button onClick={onRetry} className="btn-ghost text-sm px-5 py-2">
            Retry Now
          </button>
        </div>
      </div>
    </div>
  )
}
