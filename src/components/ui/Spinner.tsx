import type { CSSProperties } from 'react'

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

// Размер точки/зазора под каждый size (сетка 3×3 квадратных точек).
const sizeVars: Record<NonNullable<SpinnerProps['size']>, CSSProperties> = {
  sm: { '--dot': '4px', '--dot-gap': '3px' } as CSSProperties,
  md: { '--dot': '6px', '--dot-gap': '4px' } as CSSProperties,
  lg: { '--dot': '8px', '--dot-gap': '5px' } as CSSProperties,
  xl: { '--dot': '7px', '--dot-gap': '4px' } as CSSProperties,
}

/** Спиннер загрузки — мерцающая сетка точек (Ink & Signal). Цвет наследуется
 *  из currentColor (по умолчанию сигнальный индиго); переопределяется text-*. */
export function Spinner({ size = 'lg', className = '' }: SpinnerProps) {
  return (
    <span
      className={`dot-spinner ${className}`}
      style={sizeVars[size]}
      role="status"
      aria-label="Загрузка"
    >
      {Array.from({ length: 9 }).map((_, i) => <i key={i} />)}
    </span>
  )
}

export function SpinnerPage() {
  return (
    <div className="min-h-dvh bg-gray-50 flex items-center justify-center p-4">
      <Spinner size="lg" />
    </div>
  )
}
