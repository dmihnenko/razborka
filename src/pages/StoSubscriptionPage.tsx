import { CheckCircle2, Clock, AlertTriangle, MessageCircle, Users, FileText, Wrench, Infinity } from 'lucide-react'
import { useSubscriptionLimits, useCompanySubscription } from '@/hooks/useSubscription'
import { Spinner } from '@/components/ui/Spinner'
import { useNavigate } from 'react-router-dom'

const PLANS = [
  {
    key: 'free',
    name: 'Пробный',
    subtitle: 'Бесплатно',
    priceLabel: 'Бесплатно',
    maxAppointments: 10,
    maxCustomers: 15,
    maxWorkers: 1,
    color: '#94A3B8',
    bg: '#F8FAFC',
    features: ['До 10 заявок', 'До 15 клиентов', '1 мастер', 'Базовый функционал'],
  },
  {
    key: 'start',
    name: 'Старт',
    subtitle: '1 месяц',
    priceLabel: '₴499 / мес',
    maxAppointments: 50,
    maxCustomers: 100,
    maxWorkers: 3,
    color: '#2563EB',
    bg: '#EFF6FF',
    features: ['До 50 заявок', 'До 100 клиентов', 'До 3 мастеров', 'Каталог услуг', 'Календарь'],
  },
  {
    key: 'business',
    name: 'Бизнес',
    subtitle: '6 месяцев',
    priceLabel: '₴2 499 / 6 мес',
    maxAppointments: 200,
    maxCustomers: 500,
    maxWorkers: 10,
    color: '#7C3AED',
    bg: '#F5F3FF',
    badge: 'Популярный',
    features: ['До 200 заявок', 'До 500 клиентов', 'До 10 мастеров', 'Полная аналитика', 'Все функции'],
  },
  {
    key: 'pro',
    name: 'Профи',
    subtitle: '12 месяцев',
    priceLabel: '₴4 499 / год',
    maxAppointments: null,
    maxCustomers: null,
    maxWorkers: null,
    color: '#059669',
    bg: '#F0FDF4',
    features: ['Безлимит заявок', 'Безлимит клиентов', 'Неогр. мастера', 'Приоритетная поддержка', 'Все функции'],
  },
  {
    key: 'lifetime',
    name: 'Навсегда',
    subtitle: 'Бессрочно',
    priceLabel: '₴9 999 разово',
    maxAppointments: null,
    maxCustomers: null,
    maxWorkers: null,
    color: '#D97706',
    bg: '#FFFBEB',
    badge: 'Выгодно',
    features: ['Безлимит навсегда', 'Все функции', 'Будущие обновления', 'Высшая поддержка'],
  },
]

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
          {pct === 100 ? 'Лимит исчерпан' : `${pct}% лимита использовано`}
        </p>
      )}
    </div>
  )
}

export default function StoSubscriptionPage() {
  const { data: companySub, isLoading } = useCompanySubscription()
  const { plan, usage, limits, daysLeft, isExpiringSoon, hasSubscription } = useSubscriptionLimits()
  const navigate = useNavigate()

  if (isLoading) return (
    <div className="flex justify-center items-center min-h-[60vh]"><Spinner size="lg" /></div>
  )

  const currentPlanName = hasSubscription ? plan?.name : 'Пробный'
  const maxAppt = limits.maxAppointments
  const maxCust = limits.maxCustomers

  const currentKey = !hasSubscription ? 'free' :
    plan?.type === 'lifetime' ? 'lifetime' :
    (plan?.max_appointments === null) ? 'pro' :
    (plan?.max_appointments ?? 999) <= 50 ? 'start' : 'business'

  const planColor = PLANS.find(p => p.key === currentKey)?.color || '#94A3B8'
  const planBg    = PLANS.find(p => p.key === currentKey)?.bg    || '#F8FAFC'

  return (
    <div className="w-full pb-12 space-y-6">

      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Мой тариф</h1>
        <p className="text-sm text-gray-500 mt-0.5">Управление подпиской и лимитами</p>
      </div>

      {/* Current plan card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 sm:px-6 py-5 border-b border-gray-100"
          style={{ background: `linear-gradient(135deg, ${planBg} 0%, #fff 100%)` }}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Текущий тариф</p>
                {hasSubscription && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Активен</span>
                )}
              </div>
              <h2 className="text-2xl font-bold text-gray-900">{currentPlanName}</h2>
              {companySub?.end_date && (
                <p className="text-sm text-gray-500 mt-1 flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  Действует до {new Date(companySub.end_date).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' })}
                  {daysLeft !== null && (
                    <span className={`font-semibold ${isExpiringSoon ? 'text-amber-600' : 'text-gray-600'}`}>
                      ({daysLeft} {daysLeft === 1 ? 'день' : daysLeft < 5 ? 'дня' : 'дней'})
                    </span>
                  )}
                </p>
              )}
              {!hasSubscription && (
                <p className="text-sm text-gray-500 mt-1">Базовый бесплатный доступ с ограничениями</p>
              )}
              {companySub && !companySub.end_date && (
                <p className="text-sm text-gray-500 mt-1 flex items-center gap-1.5">
                  <Infinity className="w-4 h-4" />Бессрочная подписка
                </p>
              )}
            </div>
            {isExpiringSoon && (
              <div className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700 font-semibold">
                <AlertTriangle className="w-4 h-4" />Истекает скоро
              </div>
            )}
          </div>
        </div>

        {/* Usage meters */}
        <div className="px-5 sm:px-6 py-5 grid grid-cols-1 sm:grid-cols-3 gap-5">
          <UsageBar label="Активные заявки" used={usage.appointments} max={maxAppt} color={planColor} />
          <UsageBar label="Клиенты" used={usage.customers} max={maxCust} color={planColor} />
          <div>
            <p className="text-sm font-medium text-gray-700 mb-1.5">Мастера</p>
            <p className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
              <Wrench className="w-4 h-4 text-gray-400" />
              {limits.maxWorkers === null ? <><Infinity className="w-4 h-4" /> Неограничено</> : `До ${limits.maxWorkers}`}
            </p>
          </div>
        </div>
      </div>

      {/* Plan comparison */}
      <div>
        <h2 className="text-base font-bold text-gray-900 mb-4">Доступные тарифы</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {PLANS.filter(p => p.key !== 'free').map(p => {
            const isCurrent = p.key === currentKey
            return (
              <div key={p.key}
                className={`relative rounded-2xl border-2 overflow-hidden transition-all ${isCurrent ? 'shadow-md' : 'hover:shadow-md'}`}
                style={{ borderColor: isCurrent ? p.color : p.color + '30', backgroundColor: isCurrent ? p.bg : '#fff' }}>
                {isCurrent && <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: p.color }} />}
                {(p.badge && !isCurrent) && (
                  <div className="absolute top-3 right-3 text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: p.color }}>{p.badge}</div>
                )}
                {isCurrent && (
                  <div className="absolute top-3 right-3 text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: p.color }}>Ваш тариф</div>
                )}
                <div className="p-5">
                  <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: p.color }}>{p.subtitle}</p>
                  <h3 className="text-xl font-bold text-gray-900 mb-1">{p.name}</h3>
                  <p className="text-lg font-bold text-gray-900 mb-4" style={{ letterSpacing: '-0.02em' }}>{p.priceLabel}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 mb-4">
                    {[
                      { icon: FileText, val: p.maxAppointments, suffix: 'заявок' },
                      { icon: Users,    val: p.maxCustomers,    suffix: 'клиентов' },
                      { icon: Wrench,   val: p.maxWorkers,      suffix: 'мастера' },
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

      {/* CTA */}
      <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <MessageCircle className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900">Хотите изменить тариф?</p>
          <p className="text-sm text-gray-500 mt-0.5">
            Обратитесь к администратору системы для обновления подписки или получения демо-доступа к PRO функциям.
          </p>
        </div>
        <button onClick={() => navigate('/support')}
          className="flex-shrink-0 inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 transition-colors">
          <MessageCircle className="w-4 h-4" />Написать поддержке
        </button>
      </div>
    </div>
  )
}
