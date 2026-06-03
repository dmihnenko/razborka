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
  const label    = context === 'appointments' ? 'заявок' : 'клієнтів'

  const isAtLimit    = maxVal !== null && usedVal >= maxVal
  const isNearLimit  = maxVal !== null && pct >= 80 && !isAtLimit
  const isUnlimited  = maxVal === null

  // Don't show if unlimited and subscription is fine
  if (isUnlimited && !isExpiringSoon) return null
  // Don't show if below 60% and not expiring
  if (!isAtLimit && !isNearLimit && !isExpiringSoon) return null

  const planName = hasSubscription ? plan?.name : 'Пробний'

  // Color scheme
  const scheme = isAtLimit
    ? { bg: '#FEF2F2', border: '#FECACA', icon: '#DC2626', text: '#991B1B', bar: '#DC2626' }
    : isNearLimit
    ? { bg: '#FFFBEB', border: '#FDE68A', icon: '#D97706', text: '#92400E', bar: '#D97706' }
    : { bg: '#EFF6FF', border: '#BFDBFE', icon: '#2563EB', text: '#1E40AF', bar: '#2563EB' }

  return (
    <div
      className="rounded-xl border px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 mb-4"
      style={{ backgroundColor: scheme.bg, borderColor: scheme.border }}
    >
      <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
        {isAtLimit
          ? <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 sm:mt-0" style={{ color: scheme.icon }} />
          : isExpiringSoon
          ? <Clock className="w-4 h-4 flex-shrink-0 mt-0.5 sm:mt-0" style={{ color: scheme.icon }} />
          : <Zap className="w-4 h-4 flex-shrink-0 mt-0.5 sm:mt-0" style={{ color: scheme.icon }} />
        }

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight" style={{ color: scheme.text }}>
            {isAtLimit
              ? `Досягнуто ліміту ${label} (${usedVal}/${maxVal})`
              : isExpiringSoon && daysLeft !== null
              ? `Підписка «${planName}» закінчується через ${daysLeft} ${daysLeft === 1 ? 'день' : daysLeft < 5 ? 'дні' : 'днів'}`
              : `Тариф «${planName}» · ${usedVal}/${maxVal} ${label}`
            }
          </p>

          {/* Usage bar */}
          {maxVal !== null && !isExpiringSoon && (
            <div className="mt-1.5 h-1.5 rounded-full bg-black/10 overflow-hidden" style={{ maxWidth: 200 }}>
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, backgroundColor: scheme.bar }}
              />
            </div>
          )}
        </div>
      </div>

      <button
        onClick={() => navigate('/sto/subscription')}
        className="flex-shrink-0 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap"
        style={{ backgroundColor: scheme.icon, color: '#fff' }}
      >
        {isAtLimit ? 'Оновити тариф' : 'Деталі тарифу'}
      </button>
    </div>
  )
}
