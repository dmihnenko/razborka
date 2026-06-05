import { AlertTriangle, Zap, Clock } from 'lucide-react'
import { useSubscriptionLimits } from '@/hooks/useSubscription'
import { useNavigate } from 'react-router-dom'
import { useUserProfile } from '@/hooks/useUserProfile'

interface Props {
  context: 'appointments' | 'customers'
}

export default function SubscriptionBanner({ context }: Props) {
  const { data: profile } = useUserProfile()
  const isStoOwner = profile?.roles?.some((r: any) => r.name === 'sto_owner')
  const { hasSubscription, plan, usage, limits, usagePct, daysLeft, isExpiringSoon } = useSubscriptionLimits()
  const navigate = useNavigate()

  if (!isStoOwner) return null

  const maxVal   = context === 'appointments' ? limits.maxAppointments : limits.maxCustomers
  const usedVal  = context === 'appointments' ? usage.appointments     : usage.customers
  const pct      = context === 'appointments' ? usagePct.appointments  : usagePct.customers
  const label    = context === 'appointments' ? 'заявок' : 'клиентов'

  const isAtLimit    = maxVal !== null && usedVal >= maxVal
  const isNearLimit  = maxVal !== null && pct >= 80 && !isAtLimit
  const isUnlimited  = maxVal === null

  // Don't show if unlimited and subscription is fine
  if (isUnlimited && !isExpiringSoon) return null
  // Don't show if below 60% and not expiring
  if (!isAtLimit && !isNearLimit && !isExpiringSoon) return null

  const planName = hasSubscription ? plan?.name : 'Пробный'

  // Цветовая схема на токенах Tailwind (адаптируется к тёмной теме)
  const scheme = isAtLimit
    ? { wrap: 'bg-red-50 border-red-200',     icon: 'text-red-600',   text: 'text-red-800',   bar: 'bg-red-600',   btn: 'bg-red-600 hover:bg-red-700' }
    : isNearLimit
    ? { wrap: 'bg-amber-50 border-amber-200', icon: 'text-amber-600', text: 'text-amber-800', bar: 'bg-amber-600', btn: 'bg-amber-600 hover:bg-amber-700' }
    : { wrap: 'bg-blue-50 border-blue-200',   icon: 'text-blue-600',  text: 'text-blue-800',  bar: 'bg-blue-600',  btn: 'bg-blue-600 hover:bg-blue-700' }

  const Icon = isAtLimit ? AlertTriangle : isExpiringSoon ? Clock : Zap

  return (
    <div className={`rounded-xl border px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 mb-4 ${scheme.wrap}`}>
      <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
        <Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 sm:mt-0 ${scheme.icon}`} />

        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold leading-tight ${scheme.text}`}>
            {isAtLimit
              ? `Достигнут лимит ${label} (${usedVal}/${maxVal})`
              : isExpiringSoon && daysLeft !== null
              ? `Подписка «${planName}» истекает через ${daysLeft} ${daysLeft === 1 ? 'день' : daysLeft < 5 ? 'дня' : 'дней'}`
              : `Тариф «${planName}» · ${usedVal}/${maxVal} ${label}`
            }
          </p>

          {/* Usage bar */}
          {maxVal !== null && !isExpiringSoon && (
            <div className="mt-1.5 h-1.5 rounded-full bg-black/10 overflow-hidden max-w-[200px]">
              <div className={`h-full rounded-full transition-all ${scheme.bar}`} style={{ width: `${pct}%` }} />
            </div>
          )}
        </div>
      </div>

      <button
        onClick={() => navigate('/sto/subscription')}
        className={`flex-shrink-0 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap text-white ${scheme.btn}`}
      >
        {isAtLimit ? 'Обновить тариф' : 'Детали тарифа'}
      </button>
    </div>
  )
}
