import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Clock, CheckCircle2, AlertTriangle, Infinity as InfinityIcon,
  MessageCircle, Send, Hourglass, Package, Car, Check, Users,
} from 'lucide-react'
import { Spinner } from '@/components/ui/Spinner'
import { toast } from 'sonner'
import { useUserProfile } from '@/hooks/useUserProfile'
import { useCompanySubscription, useSubscriptionLimits } from '@/hooks/useSubscription'
import {
  getSubscriptionTiers, getMyLatestRequest, createSubscriptionRequest,
} from '@/services/subscriptionService'
import UsageMeter from '@/components/subscription/UsageMeter'
import PartsPageHeader from '@/components/parts/PartsPageHeader'
import {
  DURATIONS, tierTermPrice, tierTermPerMonth, durationLabel, discountPct, fmtPrice,
} from '@/config/subscriptionPlans'

export default function PartsSubscriptionPage() {
  const { data: profile } = useUserProfile()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const companyId = profile?.parts_company_id

  const [months, setMonths] = useState(1)
  const [selectedTierId, setSelectedTierId] = useState<string | null>(null)

  const { data: companySub, isLoading } = useCompanySubscription()
  const { usage, limits, isExpiringSoon, daysLeft: subDaysLeft } = useSubscriptionLimits()

  const { data: tiers = [] } = useQuery({
    queryKey: ['subscription-tiers', 'parts'],
    queryFn: () => getSubscriptionTiers('parts'),
  })
  const { data: latestReq } = useQuery({
    queryKey: ['my-sub-request', 'parts', companyId],
    queryFn: () => getMyLatestRequest('parts', companyId!),
    enabled: !!companyId,
  })

  const hasActive  = !!companySub
  const isLifetime = !!companySub && !companySub.end_date
  const endDate    = companySub?.end_date
  const daysLeft   = endDate
    ? Math.max(0, Math.ceil((new Date(endDate).getTime() - Date.now()) / 86_400_000))
    : null
  const expiringSoon = daysLeft !== null && daysLeft <= 14
  const pending = latestReq?.status === 'pending'
  const selectedTier = tiers.find(t => t.id === selectedTierId) || null
  const planName = companySub?.subscription?.name || 'Бесплатный режим'

  const requestMutation = useMutation({
    mutationFn: () => createSubscriptionRequest({
      company_type: 'parts', company_id: companyId!, plan_id: selectedTierId!, months,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-sub-request'] })
      toast.success('Заявка отправлена администратору')
    },
    onError: (e: Error & { message?: string }) =>
      toast.error(e?.message || 'Не удалось отправить заявку'),
  })

  if (isLoading) return (
    <div className="flex justify-center items-center min-h-[60vh]">
      <Spinner size="lg" />
    </div>
  )

  return (
    <div className="min-h-dvh bg-gray-50">
      <PartsPageHeader
        title="Тариф разборки"
        subtitle="Текущий план, лимиты и оформление подписки"
        backPath="/parts/dashboard"
      />

      <div className="w-full py-5 sm:py-6 pb-12 space-y-5 animate-fade-in">

      {/* ── Алерт: подписка истекает ──────────────────────────── */}
      {isExpiringSoon && subDaysLeft !== null && (
        <div className="alert alert-warning">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
          <p className="font-semibold">
            Подписка заканчивается через{' '}
            <span className="font-extrabold">
              {subDaysLeft}{' '}
              {subDaysLeft === 1 ? 'день' : subDaysLeft < 5 ? 'дня' : 'дней'}
            </span>. Продлите заранее, чтобы не потерять доступ.
          </p>
        </div>
      )}

      {/* ── Текущий тариф ─────────────────────────────────────── */}
      <div className="cab-card overflow-hidden">
        <div className="px-5 sm:px-6 py-5 bg-[color:var(--cab-surface-2)] border-b border-gray-100">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="kicker">Текущий тариф</span>
                {hasActive && (
                  <span className="badge badge-green">Активна</span>
                )}
              </div>
              <h2 className="heading-2 truncate">{planName}</h2>

              {isLifetime ? (
                <p className="page-subtitle mt-1.5 flex items-center gap-1.5">
                  <InfinityIcon className="w-4 h-4" strokeWidth={1.5} />
                  Бессрочная подписка
                </p>
              ) : endDate ? (
                <p className="page-subtitle mt-1.5 flex items-center gap-1.5 flex-wrap">
                  <Clock className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
                  Действует до{' '}
                  {new Date(endDate).toLocaleDateString('ru-RU', {
                    day: '2-digit', month: 'long', year: 'numeric',
                  })}
                  {daysLeft !== null && (
                    <span className={`font-bold tabular ${expiringSoon ? 'text-amber-600' : 'text-gray-600'}`}>
                      ({daysLeft}{' '}
                      {daysLeft === 1 ? 'день' : daysLeft < 5 ? 'дня' : 'дней'})
                    </span>
                  )}
                </p>
              ) : (
                <p className="page-subtitle mt-1.5">
                  Базовый бесплатный доступ с ограничениями
                </p>
              )}

              {expiringSoon && (
                <div className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5
                                bg-amber-50 border border-amber-200 rounded-lg
                                text-sm text-amber-700 font-semibold">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
                  Продлите заранее, чтобы не потерять доступ
                </div>
              )}
            </div>

            <div className="icon-tile-lg bg-slate-100 flex-shrink-0">
              <Package className="w-6 h-6 text-slate-700" strokeWidth={1.5} />
            </div>
          </div>
        </div>

        {/* ── Загрузка лимитов ──────────────────────────────────── */}
        <div className="px-5 sm:px-6 py-5">
          <p className="kicker mb-4">Текущая загрузка</p>
          <div className="space-y-4">
            <UsageMeter
              icon={Car}
              label="Машины"
              used={usage.vehicles}
              max={limits.maxVehicles}
            />
            <UsageMeter
              icon={Package}
              label="Запчасти"
              used={usage.parts}
              max={limits.maxParts}
            />
            {limits.maxWorkers !== undefined && (
              <UsageMeter
                icon={Users}
                label="Сотрудники"
                used={usage.workers}
                max={limits.maxWorkers}
              />
            )}
          </div>
        </div>
      </div>

      {/* ── Выбор тарифа ──────────────────────────────────────── */}
      {isLifetime ? (
        <div className="cab-card p-4">
          <div className="empty-state py-10">
            <div className="empty-state-icon">
              <InfinityIcon className="w-8 h-8 text-gray-400" strokeWidth={1.5} />
            </div>
            <p className="empty-state-title">У вас бессрочная подписка</p>
            <p className="empty-state-text">Оформление не требуется</p>
          </div>
        </div>
      ) : pending ? (
        <div className="cab-card p-4 border-amber-200">
          <div className="flex items-start gap-4">
            <div className="icon-tile bg-amber-100 flex-shrink-0">
              <Hourglass className="w-5 h-5 text-amber-600" strokeWidth={1.5} />
            </div>
            <div>
              <p className="font-semibold text-gray-900">Заявка на рассмотрении</p>
              <p className="text-sm text-gray-500 mt-1">
                Запрошен срок:{' '}
                <span className="font-medium text-gray-700">
                  {durationLabel(latestReq!.months)}
                </span>.{' '}
                Администратор подтвердит подписку в ближайшее время.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="cab-card overflow-hidden">
          {/* Шапка секции */}
          <div className="px-5 sm:px-6 py-4 border-b border-gray-100
                          flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="heading-3">
                {hasActive ? 'Сменить или продлить тариф' : 'Выбрать тариф'}
              </h2>
              <p className="page-subtitle">При оплате за год — скидка 15%</p>
            </div>

            {/* Переключатель срока */}
            <div className="inline-flex rounded-xl bg-gray-100 p-1 self-start sm:self-center flex-shrink-0">
              {DURATIONS.map(d => (
                <button
                  key={d.months}
                  onClick={() => setMonths(d.months)}
                  className={[
                    'px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors',
                    months === d.months
                      ? 'bg-white shadow-sm text-gray-900'
                      : 'text-gray-500 hover:text-gray-700',
                  ].join(' ')}
                >
                  {d.label}
                  {d.discount > 0 && (
                    <span className="ml-1 text-[10px] font-bold text-emerald-600">
                      −{discountPct(d.months)}%
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="px-5 sm:px-6 py-5">
            {tiers.length === 0 ? (
              <div className="empty-state py-10">
                <div className="empty-state-icon">
                  <Package className="w-8 h-8 text-gray-400" strokeWidth={1.5} />
                </div>
                <p className="empty-state-title">Тарифы временно недоступны</p>
                <p className="empty-state-text">Обратитесь к администратору</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 stagger-children">
                {tiers.map(t => {
                  const isCurrent = companySub?.subscription?.id === t.id
                  const isSelected = selectedTierId === t.id
                  const isRecommended = !isCurrent && tiers.indexOf(t) === 1

                  if (t.is_custom) {
                    return (
                      <div
                        key={t.id}
                        className="cab-card p-4 border-dashed border-gray-200 flex flex-col"
                      >
                        <p className="font-bold text-gray-900">{t.name}</p>
                        <p className="text-sm text-gray-500 mt-1 flex-1">
                          {t.description || 'Индивидуальные условия'}
                        </p>
                        <p className="text-lg font-bold text-gray-900 tabular my-3">
                          Индивидуально
                        </p>
                        <button
                          onClick={() => navigate('/support')}
                          className="cab-btn cab-btn-secondary cab-btn-sm w-full justify-center"
                        >
                          Обсудить
                        </button>
                      </div>
                    )
                  }

                  const price = tierTermPrice(t.price, months)

                  return (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTierId(t.id)}
                      className={[
                        'cab-card text-left flex flex-col transition-all duration-150 p-4',
                        isSelected
                          ? 'ring-2 ring-primary shadow-md'
                          : isCurrent
                          ? 'ring-2 ring-green-500'
                          : isRecommended
                          ? 'ring-1 ring-primary/40 hover:ring-primary'
                          : 'hover:border-gray-200',
                      ].join(' ')}
                    >
                      {/* Шапка карточки */}
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-bold text-gray-900 text-sm">{t.name}</p>
                        <div className="flex items-center gap-1.5">
                          {isCurrent && (
                            <span className="badge badge-green">Текущий</span>
                          )}
                          {isRecommended && !isCurrent && (
                            <span className="cab-chip cab-chip-signal">Хит</span>
                          )}
                          {isSelected && (
                            <Check
                              className="w-4 h-4 text-primary flex-shrink-0"
                              strokeWidth={3}
                            />
                          )}
                        </div>
                      </div>

                      {/* Цена */}
                      <div className="my-2">
                        <p className="text-2xl font-extrabold text-primary tabular leading-none">
                          {fmtPrice(price)}
                        </p>
                        <p className="text-[11px] text-gray-400 mt-1">
                          {months === 12
                            ? `${fmtPrice(tierTermPerMonth(t.price, months))}/мес · за год`
                            : 'в месяц'}
                        </p>
                      </div>

                      {/* Фичи */}
                      <ul className="text-xs text-gray-600 space-y-1.5 mt-1">
                        {t.max_vehicles != null && (
                          <li className="flex items-center gap-1.5">
                            <Car className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" strokeWidth={1.5} />
                            до {t.max_vehicles} машин
                          </li>
                        )}
                        {t.max_parts != null && (
                          <li className="flex items-center gap-1.5">
                            <Package className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" strokeWidth={1.5} />
                            до {t.max_parts} запчастей
                          </li>
                        )}
                        {t.max_workers != null && (
                          <li className="flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" strokeWidth={1.5} />
                            до {t.max_workers} сотрудников
                          </li>
                        )}
                      </ul>
                    </button>
                  )
                })}
              </div>
            )}

            {/* CTA — отправить заявку */}
            {selectedTier && !selectedTier.is_custom && (
              <div className="mt-5">
                <button
                  onClick={() => requestMutation.mutate()}
                  disabled={requestMutation.isPending || !companyId}
                  className="cab-btn cab-btn-primary cab-btn-lg w-full justify-center"
                >
                  <Send className="w-4 h-4" strokeWidth={1.5} />
                  {requestMutation.isPending
                    ? 'Отправка…'
                    : `Оставить заявку · ${selectedTier.name} · ${durationLabel(months)} · ${fmtPrice(tierTermPrice(selectedTier.price, months))}`}
                </button>
                <p className="text-xs text-gray-400 text-center mt-2">
                  Оплата и активация — через администратора.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Поддержка ─────────────────────────────────────────── */}
      <div className="cab-card p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4
                      bg-[color:var(--cab-surface-2)]">
        <div className="icon-tile-lg bg-slate-100 flex-shrink-0">
          <MessageCircle className="w-5 h-5 text-slate-700" strokeWidth={1.5} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900">Вопросы по тарифу?</p>
          <p className="page-subtitle mt-0.5">
            Напишите в поддержку — поможем с оформлением и оплатой.
          </p>
        </div>
        <button
          onClick={() => navigate('/support')}
          className="cab-btn cab-btn-primary flex-shrink-0"
        >
          <MessageCircle className="w-4 h-4" strokeWidth={1.5} />
          Написать поддержке
        </button>
      </div>

      {/* ── Подсказка ─────────────────────────────────────────── */}
      <p className="text-xs text-gray-400 flex items-center gap-1.5">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" strokeWidth={1.5} />
        Лимиты тарифа: количество машин и запчастей в базе разборки.
      </p>
      </div>
    </div>
  )
}
