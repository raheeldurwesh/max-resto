/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        body:    ['"DM Sans"', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Core surfaces
        base:    '#0e0e10',
        surface: '#16161a',
        card:    '#1e1e24',
        raised:  '#26262e',
        border:  '#2e2e38',
        // Amber accent
        amber: {
          DEFAULT: '#f59e0b',
          dim:     '#d97706',
          glow:    'rgba(245,158,11,0.15)',
          soft:    'rgba(245,158,11,0.08)',
        },
        // Text
        bright: '#f0ede8',
        mid:    '#a09890',
        faint:  '#504840',
        // Status colors
        pending:    '#facc15',
        preparing:  '#60a5fa',
        done:       '#34d399',
        danger:     '#f87171',
      },
      boxShadow: {
        card:    '0 2px 16px rgba(0,0,0,0.35)',
        lifted:  '0 8px 32px rgba(0,0,0,0.5)',
        amber:   '0 0 24px rgba(245,158,11,0.2)',
        glow:    '0 0 0 2px rgba(245,158,11,0.35)',
      },
      animation: {
        'slide-up':   'slideUp 0.4s cubic-bezier(0.16,1,0.3,1) both',
        'fade-in':    'fadeIn 0.35s ease both',
        'scale-in':   'scaleIn 0.3s cubic-bezier(0.34,1.56,0.64,1) both',
        'pulse-dot':  'pulseDot 1.5s ease-in-out infinite',
      },
      keyframes: {
        slideUp:   { from:{ opacity:0, transform:'translateY(20px)' }, to:{ opacity:1, transform:'translateY(0)' } },
        fadeIn:    { from:{ opacity:0 }, to:{ opacity:1 } },
        scaleIn:   { from:{ opacity:0, transform:'scale(0.88)' }, to:{ opacity:1, transform:'scale(1)' } },
        pulseDot:  { '0%,100%':{ transform:'scale(1)', opacity:1 }, '50%':{ transform:'scale(1.4)', opacity:0.6 } },
      },
    },
  },
  plugins: [],
}
