import { CheckCircle2, Zap, Clock, AlertTriangle, MessageCircle, Users, FileText, Wrench, Infinity } from 'lucide-react'
import { useSubscriptionLimits, useCompanySubscription } from '@/hooks/useSubscription'
import { Spinner } from '@/components/ui/Spinner'
import { useNavigate } from 'react-router-dom'

// ─── Plan comparison data ─────────────────────────────────────────────────────

const PLANS = [
  {
    key: 'free',
    name: 'Пробний',
    subtitle: 'Безкоштовно',
    price: 0,
    priceLabel: 'Безкоштовно',
    maxAppointments: 10,
    maxCustomers: 15,
    maxWorkers: 1,
    color: '#94A3B8',
    bg: '#F8FAFC',
    features: ['До 10 заявок', 'До 15 клієнтів', '1 майстер', 'Базовий Calendar'],
  },
  {
    key: 'start',
    name: 'Старт',
    subtitle: '1 місяць',
    price: 499,
    priceLabel: '₴499 / міс',
    maxAppointments: 50,
    maxCustomers: 100,
    maxWorkers: 3,
    color: '#2563EB',
    bg: '#EFF6FF',
    features: ['До 50 заявок', 'До 100 клієнтів', 'До 3 майстрів', 'Каталог послуг', 'Повний Calendar'],
  },
  {
    key: 'business',
    name: 'Бізнес',
    subtitle: '6 місяців',
    price: 2499,
    priceLabel: '₴2 499 / 6 міс',
    maxAppointments: 200,
    maxCustomers: 500,
    maxWorkers: 10,
    color: '#7C3AED',
    bg: '#F5F3FF',
    badge: 'Популярний',
    features: ['До 200 заявок', 'До 500 клієнтів', 'До 10 майстрів', 'Повна аналітика', 'Всі функції'],
  },
  {
    key: 'pro',
    name: 'Профі',
    subtitle: '12 місяців',
    price: 4499,
    priceLabel: '₴4 499 / рік',
    maxAppointments: null,
    maxCustomers: null,
    maxWorkers: null,
    color: '#059669',
    bg: '#F0FDF4',
    features: ['Безліміт заявок', 'Безліміт клієнтів', 'Необм. майстри', 'Пріоритетна підтримка', 'Всі функції'],
  },
  {
    key: 'lifetime',
    name: 'Навсегда',
    subtitle: 'Безстроково',
    price: 9999,
    priceLabel: '₴9 999 раз',
    maxAppointments: null,
    maxCustomers: null,
    maxWorkers: null,
    color: '#D97706',
    bg: '#FFFBEB',
    badge: 'Вигідно',
    features: ['Безліміт назавжди', 'Всі поточні функції', 'Майбутні оновлення', 'Найвища підтримка'],
  },
]

// ─── Usage bar ────────────────────────────────────────────────────────────────

function UsageBar({ label, used, max, color }: { label: string; used: number; max: number | null; color: string }) {
  const pct = max ? Math.min(100, Math.round((used / max) * 100)) : 0
  const isHigh = pct >= 80
  const barColor = isHigh ? '#DC2626' : color

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span className={`text-sm font-bold tabular-nums ${isHigh ? 'text-red-600' : 'text-gray-900'}`}>
          {used} / {max === null ? '∞' : max}
        </span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500"
          style={{ width: `${max === null ? 0 : pct}%`, backgroundColor: barColor }} />
      </div>
      {isHigh && max !== null && (
        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          {pct === 100 ? 'Ліміт вичерпано' : `${pct}% ліміту використано`}
        </p>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function StoSubscriptionPage() {
  const { data: companySub, isLoading } = useCompanySubscription()
  const { plan, usage, limits, daysLeft, isExpiringSoon, hasSubscription } = useSubscriptionLimits()
  const navigate = useNavigate()

  if (isLoading) return (
    <div className="flex justify-center items-center min-h-[60vh]">
      <Spinner size="lg" />
    </div>
  )

  const currentPlanName = hasSubscription ? plan?.name : 'Пробний'
  const maxAppt = limits.maxAppointments
  const maxCust = limits.maxCustomers

  // Determine which plan key is "current"
  const currentKey = !hasSubscription ? 'free' :
    plan?.type === 'lifetime' ? 'lifetime' :
    (plan?.max_appointments === null) ? 'pro' :
    (plan?.max_appointments ?? 999) <= 50 ? 'start' : 'business'

  return (
    <div className="max-w-4xl mx-auto pb-12 space-y-6">

      {/* ── Page header ── */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Мій тариф</h1>
        <p className="text-sm text-gray-500 mt-0.5">Керування підпискою та лімітами</p>
      </div>

      {/* ── Current plan card ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Plan header */}
        <div className="px-5 sm:px-6 py-5 border-b border-gray-100"
          style={{ background: hasSubscription ? `linear-gradient(135deg, ${PLANS.find(p => p.key === currentKey)?.bg || '#F8FAFC'} 0%, #fff 100%)` : 'linear-gradient(135deg, #F8FAFC 0%, #fff 100%)' }}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Поточний тариф</p>
                {hasSubscription && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Активний</span>
                )}
              </div>
              <h2 className="text-2xl font-bold text-gray-900">{currentPlanName}</h2>
              {companySub?.end_date && (
                <p className="text-sm text-gray-500 mt-1 flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  Діє до {new Date(companySub.end_date).toLocaleDateString('uk-UA', { day: '2-digit', month: 'long', year: 'numeric' })}
                  {daysLeft !== null && (
                    <span className={`font-semibold ${isExpiringSoon ? 'text-amber-600' : 'text-gray-600'}`}>
                      ({daysLeft} {daysLeft === 1 ? 'день' : daysLeft < 5 ? 'дні' : 'днів'})
                    </span>
                  )}
                </p>
              )}
              {!hasSubscription && (
                <p className="text-sm text-gray-500 mt-1">Базовий безкоштовний доступ з обмеженнями</p>
              )}
              {companySub && !companySub.end_date && (
                <p className="text-sm text-gray-500 mt-1 flex items-center gap-1.5">
                  <Infinity className="w-4 h-4" />Безстрокова підписка
                </p>
              )}
            </div>

            {isExpiringSoon && (
              <div className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700 font-semibold">
                <AlertTriangle className="w-4 h-4" />
                Спливає скоро
              </div>
            )}
          </div>
        </div>

        {/* Usage meters */}
        <div className="px-5 sm:px-6 py-5 grid grid-cols-1 sm:grid-cols-3 gap-5">
          <UsageBar
            label="Активні заявки"
            used={usage.appointments}
            max={maxAppt}
            color={PLANS.find(p => p.key === currentKey)?.color || '#94A3B8'}
          />
          <UsageBar
            label="Клієнти"
            used={usage.customers}
            max={maxCust}
            color={PLANS.find(p => p.key === currentKey)?.color || '#94A3B8'}
          />
          <div>
            <p className="text-sm font-medium text-gray-700 mb-1.5">Майстри</p>
            <p className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
              <Wrench className="w-4 h-4 text-gray-400" />
              {limits.maxWorkers === null ? <><Infinity className="w-4 h-4" /> Необмежено</> : `До ${limits.maxWorkers}`}
            </p>
          </div>
        </div>
      </div>

      {/* ── Plan comparison ── */}
      <div>
        <h2 className="text-base font-bold text-gray-900 mb-4">Доступні тарифи</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {PLANS.filter(p => p.key !== 'free').map(p => {
            const isCurrent = p.key === currentKey
            return (
              <div
                key={p.key}
                className={`relative rounded-2xl border-2 overflow-hidden transition-all ${isCurrent ? 'shadow-md' : 'hover:shadow-md'}`}
                style={{
                  borderColor: isCurrent ? p.color : p.color + '30',
                  backgroundColor: isCurrent ? p.bg : '#fff',
                }}
              >
                {isCurrent && (
                  <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: p.color }} />
                )}
                {p.badge && !isCurrent && (
                  <div className="absolute top-3 right-3 text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: p.color }}>
                    {p.badge}
                  </div>
                )}
                {isCurrent && (
                  <div className="absolute top-3 right-3 text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: p.color }}>
                    Ваш тариф
                  </div>
                )}

                <div className="p-5">
                  <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: p.color }}>{p.subtitle}</p>
                  <h3 className="text-xl font-bold text-gray-900 mb-1">{p.name}</h3>
                  <p className="text-lg font-bold text-gray-900 mb-4" style={{ letterSpacing: '-0.02em' }}>{p.priceLabel}</p>

                  {/* Limits row */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 mb-4">
                    {[
                      { icon: FileText, val: p.maxAppointments, suffix: 'заявок' },
                      { icon: Users,    val: p.maxCustomers,    suffix: 'клієнтів' },
                      { icon: Wrench,   val: p.maxWorkers,      suffix: 'майстри' },
                    ].map(({ icon: Icon, val, suffix }) => (
                      <div key={suffix} className="flex items-center gap-1.5 text-xs text-gray-600">
                        <Icon className="w-3.5 h-3.5" style={{ color: p.color }} />
                        {val === null ? `∞ ${suffix}` : `${val} ${suffix}`}
                      </div>
                    ))}
                  </div>

                  <ul className="space-y-1.5">
                    {p.features.map(f => (
                      <li key={f} className="flex items-start gap-2 text-xs text-gray-600">
                        <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: p.color }} />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Contact admin CTA ── */}
      <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <MessageCircle className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900">Хочете змінити тариф?</p>
          <p className="text-sm text-gray-500 mt-0.5">
            Зверніться до адміністратора системи для оновлення підписки або отримання демо-доступу до PRO функцій.
          </p>
        </div>
        <button onClick={() => navigate('/support')}
          className="flex-shrink-0 inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 transition-colors">
          <MessageCircle className="w-4 h-4" />
          Написати підтримці
        </button>
      </div>
    </div>
  )
}
