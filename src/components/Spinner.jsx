// src/components/Spinner.jsx
export default function Spinner({ text = 'Loading…' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="w-10 h-10 rounded-full border-2 border-amber/30 border-t-amber animate-spin" />
      <p className="text-mid text-sm font-body">{text}</p>
    </div>
  )
}

// Inline micro-spinner for buttons
export function MiniSpinner() {
  return (
    <span className="w-4 h-4 rounded-full border-2 border-current/30 border-t-current animate-spin inline-block" />
  )
}
