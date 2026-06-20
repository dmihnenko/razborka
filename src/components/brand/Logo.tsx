import { BRAND } from '@/config/brand'

// ============================================================================
// Logo — эмблема Razborka.net (ink-монохром + тил-уголок «.net»).
// withText  → плашка: «RAZBORKA» (Montserrat 700) + таглайн + наклонный «.net».
// withText=false → иконка-монограм «R» (как favicon/PWA).
// Имя/таглайн — из src/config/brand.ts. Цвета — токены :root.
// ============================================================================

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  withText?: boolean
  className?: string
}

const S = {
  sm: { name: 16, tag: 0,    py: 7,  px: 11, r: 11, bd: 1.25, net: 9,  nt: -8,  nr: -9,  rot: 8, icon: 30 },
  md: { name: 21, tag: 9.5,  py: 11, px: 16, r: 13, bd: 1.5,  net: 11, nt: -10, nr: -11, rot: 9, icon: 38 },
  lg: { name: 28, tag: 11,   py: 15, px: 22, r: 15, bd: 1.5,  net: 13, nt: -12, nr: -13, rot: 9, icon: 48 },
} as const

/** Монограм «R» + тил-точка на чернильной плитке (favicon-форма). */
function Mark({ px }: { px: number }) {
  return (
    <svg width={px} height={px} viewBox="0 0 512 512" aria-hidden="true" className="flex-shrink-0">
      <rect width="512" height="512" rx="116" fill="var(--cab-ink, #16181D)" />
      <g fill="none" stroke="#FFFFFF" strokeWidth="46" strokeLinecap="round" strokeLinejoin="round">
        <path d="M190 150V362" />
        <path d="M190 150h62a54 54 0 0 1 0 108h-62" />
        <path d="M206 252 306 362" />
      </g>
      <circle cx="372" cy="372" r="30" fill="var(--logo-net, #0D9488)" />
    </svg>
  )
}

export function Logo({ size = 'md', withText = true, className = '' }: LogoProps) {
  const s = S[size]

  // Компактная иконка-монограм
  if (!withText) {
    return (
      <span className={`inline-flex ${className}`} aria-label={BRAND.name}>
        <Mark px={s.icon} />
      </span>
    )
  }

  // Полная эмблема-плашка
  return (
    <span
      className={`relative inline-flex flex-col items-center ${className}`}
      aria-label={BRAND.name}
      style={{
        background: 'var(--cab-surface-2, #F4F5F7)',
        border: `${s.bd}px solid var(--cab-ink, #16181D)`,
        borderRadius: s.r,
        padding: `${s.py}px ${s.px}px`,
        boxShadow: '0 7px 18px -8px rgba(20,20,40,.22), 0 1px 2px rgba(20,20,40,.06)',
        lineHeight: 1,
      }}
    >
      {/* Уголок «.net» */}
      <span
        style={{
          position: 'absolute', top: s.nt, right: s.nr, transform: `rotate(${s.rot}deg)`,
          background: 'var(--logo-net, #0D9488)', color: '#fff',
          fontFamily: "'Montserrat', var(--font-sans)", fontWeight: 700, fontSize: s.net,
          padding: '2px 7px', borderRadius: 7, border: '1.5px solid #fff',
          boxShadow: '0 6px 13px -4px rgba(20,20,40,.4)', letterSpacing: '-0.01em',
        }}
      >
        {BRAND.wordmark.accent}
      </span>

      {/* RAZBORKA */}
      <span style={{
        fontFamily: "'Montserrat', var(--font-sans)", fontWeight: 700, fontSize: s.name,
        letterSpacing: '-0.01em', color: 'var(--cab-ink, #16181D)',
      }}>
        {BRAND.wordmark.lead}
      </span>

      {/* Таглайн (скрыт на sm) */}
      {s.tag > 0 && (
        <span style={{
          fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: s.tag,
          textTransform: 'uppercase', letterSpacing: '0.2em',
          color: 'var(--cab-ink-3, #8B909A)', marginTop: 6, whiteSpace: 'nowrap',
        }}>
          {BRAND.tagline}
        </span>
      )}
    </span>
  )
}

export default Logo
