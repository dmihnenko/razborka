import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowUpRight } from 'lucide-react'
import UsageMeter from './UsageMeter'

interface LimitReachedBannerProps {
  used: number
  max: number
  label: string
  /** Роут на страницу подписок */
  ctaHref: string
}

export default function LimitReachedBanner({ used, max, label, ctaHref }: LimitReachedBannerProps) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-4 space-y-3 animate-fade-in">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
          <AlertTriangle className="w-4.5 h-4.5 text-red-600" strokeWidth={1.5} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-red-700">
            Достигнут лимит тарифа: {label}
          </p>
          <p className="text-xs text-red-600 mt-0.5">
            Использовано {used} из {max}. Повысьте тариф, чтобы добавить больше.
          </p>
        </div>
      </div>

      <div className="px-1">
        <UsageMeter label={label} used={used} max={max} />
      </div>

      <Link
        to={ctaHref}
        className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white rounded-xl transition-colors"
        style={{ backgroundColor: '#2563EB' }}
      >
        Повысить тариф
        <ArrowUpRight className="w-4 h-4" strokeWidth={1.5} />
      </Link>
    </div>
  )
}
