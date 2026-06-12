import type { LucideIcon } from 'lucide-react'

interface UsageMeterProps {
  label: string
  used: number
  max: number | null  // null = unlimited
  icon?: LucideIcon
}

export default function UsageMeter({ label, used, max, icon: Icon }: UsageMeterProps) {
  const unlimited = max === null
  const pct = unlimited ? 0 : Math.min(100, Math.round((used / max) * 100))
  const isOver = !unlimited && used >= max
  const isWarning = !unlimited && !isOver && pct >= 70

  const barColor = isOver
    ? 'bg-red-500'
    : isWarning
    ? 'bg-amber-500'
    : 'bg-primary'

  const labelColor = isOver
    ? 'text-red-600'
    : isWarning
    ? 'text-amber-600'
    : 'text-gray-900'

  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1.5">
        <span className="flex items-center gap-1.5 text-gray-600 font-medium">
          {Icon && <Icon className="w-4 h-4 text-gray-400" strokeWidth={1.5} />}
          {label}
        </span>
        <span className={`font-semibold tabular-nums ${labelColor}`}>
          {unlimited
            ? `${used.toLocaleString('ru-RU')} • без ограничений`
            : `${used.toLocaleString('ru-RU')} / ${max!.toLocaleString('ru-RU')}`
          }
        </span>
      </div>
      {!unlimited && (
        <div
          className="h-2 rounded-full bg-gray-100 overflow-hidden"
          role="progressbar"
          aria-valuenow={used}
          aria-valuemin={0}
          aria-valuemax={max!}
          aria-label={label}
        >
          <div
            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  )
}
