import { Car } from 'lucide-react'
import { BRAND } from '@/config/brand'

// ============================================================================
// Logo — бренд из src/config/brand.ts (имя берётся из BRAND — менять там).
// squircle с брендовым градиентом + иконка Car + текст
// ============================================================================

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  withText?: boolean
  className?: string
}

const SIZE_MAP = {
  sm: {
    tile: 'w-7 h-7 rounded-lg',
    icon: 'w-4 h-4',
    brand: 'text-sm font-extrabold',
    sub: 'text-[10px]',
  },
  md: {
    tile: 'w-9 h-9 rounded-xl',
    icon: 'w-5 h-5',
    brand: 'text-base font-extrabold',
    sub: 'text-[11px]',
  },
  lg: {
    tile: 'w-12 h-12 rounded-2xl',
    icon: 'w-6 h-6',
    brand: 'text-lg font-extrabold',
    sub: 'text-xs',
  },
}

export function Logo({ size = 'md', withText = true, className = '' }: LogoProps) {
  const s = SIZE_MAP[size]

  return (
    <div className={`flex items-center gap-2.5 flex-shrink-0 ${className}`}>
      {/* Squircle icon tile */}
      <span
        className={`${s.tile} flex items-center justify-center flex-shrink-0`}
        style={{
          background: 'linear-gradient(135deg, #1E40AF 0%, #2563EB 55%, #3B82F6 100%)',
          boxShadow: '0 2px 8px -2px rgba(37,99,235,0.55), inset 0 1px 0 rgba(255,255,255,0.18)',
        }}
      >
        <Car className={`${s.icon} text-white`} strokeWidth={1.5} />
      </span>

      {withText && (
        <span className="flex flex-col leading-none min-w-0">
          <span className={`${s.brand} tracking-tight text-gray-900`}>
            {BRAND.wordmark.lead}
            <span className="text-gradient-brand">{BRAND.wordmark.accent}</span>
          </span>
          {size !== 'sm' && (
            <span className={`${s.sub} font-medium text-gray-400 mt-0.5`}>
              {BRAND.tagline}
            </span>
          )}
        </span>
      )}
    </div>
  )
}

export default Logo
