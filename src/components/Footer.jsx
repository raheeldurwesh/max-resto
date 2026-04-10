// src/components/Footer.jsx

export default function Footer() {
  return (
    <footer className="w-full py-8 mt-12 border-t border-border/50 text-center space-y-2">
      <p className="text-[10px] text-faint uppercase font-bold tracking-[0.2em]">
        Handcrafted for Excellence
      </p>
      <p className="text-mid text-xs font-body">
        Developed by{' '}
        <a 
          href="https://www.instagram.com/raheeldurwesh?igsh=MWkxcTd0d2prbG40YQ==" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-amber font-display italic hover:underline decoration-amber/30 underline-offset-4 transition-all"
        >
          Raheel Durwesh
        </a>
      </p>
      <p className="text-[9px] text-faint font-body mt-2">
        &copy; {new Date().getFullYear()} TableServe Ecosystem • All Rights Reserved
      </p>
    </footer>
  )
}
