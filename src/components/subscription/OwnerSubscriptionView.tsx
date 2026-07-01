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
import UsageMeter from './UsageMeter'
import {
  DURATIONS, tierTermPrice, tierTermPerMonth, durationLabel, discountPct, fmtPrice,
  type CompanyType,
} from '@/config/subscriptionPlans'

export default function OwnerSubscriptionView({ companyType }: { companyType: CompanyType }) {
  const { data: profile } = useUserProfile()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const companyId = profile?.parts_company_id
  const accent = '#16A34A'
  const TypeIcon = Package

  const [months, setMonths] = useState(1)
  const [selectedTierId, setSelectedTierId] = useState<string | null>(null)

  const { data: companySub, isLoading } = useCompanySubscription()
  const { usage, limits } = useSubscriptionLimits()
  const { data: tiers = [] } = useQuery({
    queryKey: ['subscription-tiers', companyType],
    queryFn: () => getSubscriptionTiers(companyType),
  })
  const { data: latestReq } = useQuery({
    queryKey: ['my-sub-request', companyType, companyId],
    queryFn: () => getMyLatestRequest(companyType, companyId!),
    enabled: !!companyId,
  })

  const { isExpiringSoon, daysLeft: subDaysLeft } = useSubscriptionLimits()

  const hasActive  = !!companySub
  const isLifetime = !!companySub && !companySub.end_date
  const endDate    = companySub?.end_date
  const daysLeft   = endDate ? Math.max(0, Math.ceil((new Date(endDate).getTime() - Date.now()) / 86_400_000)) : null
  const expiringSoon = daysLeft !== null && daysLeft <= 14
  const pending = latestReq?.status === 'pending'
  const selectedTier = tiers.find(t => t.id === selectedTierId) || null

  const requestMutation = useMutation({
    mutationFn: () => createSubscriptionRequest({
      company_type: companyType, company_id: companyId!, plan_id: selectedTierId!, months,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-sub-request'] })
      toast.success('Заявка отправлена администратору')
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Не удалось отправить заявку'),
  })

  if (isLoading) return (
    <div className="flex justify-center items-center min-h-[60vh]"><Spinner size="lg" /></div>
  )

  const planName = companySub?.subscription?.name || 'Бесплатный режим'

  return (
    <div className="w-full pb-12 space-y-6">

      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
          Тариф разборки
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Выберите план и срок действия</p>
      </div>

      {/* ── Текущий тариф ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 sm:px-6 py-5 border-b border-gray-100"
          style={{ background: `linear-gradient(135deg, ${accent}10 0%, #fff 100%)` }}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Текущий тариф</p>
                {hasActive && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Активна</span>
                )}
              </div>
              <h2 className="text-2xl font-bold text-gray-900">{planName}</h2>

              {isLifetime ? (
                <p className="text-sm text-gray-500 mt-1 flex items-center gap-1.5">
                  <InfinityIcon className="w-4 h-4" /> Бессрочная подписка
                </p>
              ) : endDate ? (
                <p className="text-sm text-gray-500 mt-1 flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  Действует до {new Date(endDate).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' })}
                  {daysLeft !== null && (
                    <span className={`font-semibold ${expiringSoon ? 'text-amber-600' : 'text-gray-600'}`}>
                      ({daysLeft} {daysLeft === 1 ? 'день' : daysLeft < 5 ? 'дня' : 'дней'})
                    </span>
                  )}
                </p>
              ) : (
                <p className="text-sm text-gray-500 mt-1">Базовый бесплатный доступ с ограничениями</p>
              )}
            </div>
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${accent}15` }}>
              <TypeIcon className="w-6 h-6" style={{ color: accent }} />
            </div>
          </div>

          {expiringSoon && (
            <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700 font-semibold">
              <AlertTriangle className="w-4 h-4" /> Подписка скоро истекает — продлите заранее
            </div>
          )}
        </div>
      </div>

      {/* ── Предупреждение: подписка истекает ───────────────────────── */}
      {isExpiringSoon && subDaysLeft !== null && (
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-2xl">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" strokeWidth={1.5} />
          <p className="text-sm font-semibold text-amber-800">
            Подписка заканчивается через{' '}
            <span className="font-extrabold">
              {subDaysLeft} {subDaysLeft === 1 ? 'день' : subDaysLeft < 5 ? 'дня' : 'дней'}
            </span>. Продлите заранее, чтобы не потерять доступ.
          </p>
        </div>
      )}

      {/* ── Текущая загрузка ──────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6">
        <h2 className="text-base font-bold text-gray-900 mb-4">Текущая загрузка</h2>
        <div className="space-y-4">
          <UsageMeter icon={Car}     label="Машины"      used={usage.vehicles} max={limits.maxVehicles} />
          <UsageMeter icon={Package} label="Запчасти"    used={usage.parts}    max={limits.maxParts} />
          {limits.maxWorkers !== undefined && (
            <UsageMeter icon={Users} label="Сотрудники" used={usage.workers} max={limits.maxWorkers} />
          )}
        </div>
      </div>

      {/* ── Выбор тарифа ──────────────────────────────────────────────── */}
      {isLifetime ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center">
          <InfinityIcon className="w-10 h-10 mx-auto mb-2 text-gray-300" />
          <p className="font-semibold text-gray-900">У вас бессрочная подписка</p>
          <p className="text-sm text-gray-500 mt-1">Оформление не требуется</p>
        </div>
      ) : pending ? (
        <div className="bg-white rounded-2xl border border-amber-200 shadow-sm p-6">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
              <Hourglass className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">Заявка на рассмотрении</p>
              <p className="text-sm text-gray-500 mt-1">
                Запрошен срок: <span className="font-medium text-gray-700">{durationLabel(latestReq!.months)}</span>.
                Администратор подтвердит подписку в ближайшее время.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
            <div>
              <h2 className="text-base font-bold text-gray-900">{hasActive ? 'Сменить или продлить тариф' : 'Выбрать тариф'}</h2>
              <p className="text-sm text-gray-500">При оплате за год — скидка 15%</p>
            </div>
            {/* Переключатель срока */}
            <div className="inline-flex rounded-xl bg-gray-100 p-1 self-start">
              {DURATIONS.map(d => (
                <button key={d.months} onClick={() => setMonths(d.months)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${months === d.months ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                  {d.label}
                  {d.discount > 0 && <span className="ml-1 text-[10px] font-bold text-green-600">−{discountPct(d.months)}%</span>}
                </button>
              ))}
            </div>
          </div>

          {tiers.length === 0 ? (
            <p className="text-sm text-gray-400">Тарифы временно недоступны. Обратитесь к администратору.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {tiers.map(t => {
                if (t.is_custom) {
                  return (
                    <div key={t.id} className="rounded-2xl border-2 border-dashed border-gray-200 p-4 flex flex-col">
                      <p className="font-bold text-gray-900">{t.name}</p>
                      <p className="text-sm text-gray-500 mt-1 flex-1">{t.description || 'Индивидуальные условия'}</p>
                      <p className="text-lg font-bold text-gray-900 my-2">Индивидуально</p>
                      <button onClick={() => navigate('/support')}
                        className="w-full py-2 text-sm font-semibold rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors">
                        Обсудить
                      </button>
                    </div>
                  )
                }
                const price = tierTermPrice(t.price, months)
                const selected = selectedTierId === t.id
                return (
                  <button key={t.id} onClick={() => setSelectedTierId(t.id)}
                    className={`text-left rounded-2xl border-2 p-4 flex flex-col transition-all ${selected ? 'shadow-md' : 'hover:border-gray-300'}`}
                    style={{ borderColor: selected ? accent : '#E5E7EB', backgroundColor: selected ? `${accent}08` : '#fff' }}>
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-gray-900">{t.name}</p>
                      {selected && <Check className="w-4 h-4" style={{ color: accent }} strokeWidth={3} />}
                    </div>
                    <div className="my-2">
                      <p className="text-2xl font-bold leading-none" style={{ color: accent }}>{fmtPrice(price)}</p>
                      <p className="text-[11px] text-gray-400 mt-1">
                        {months === 12 ? `${fmtPrice(tierTermPerMonth(t.price, months))}/мес · за год` : 'в месяц'}
                      </p>
                    </div>
                    <ul className="text-xs text-gray-600 space-y-1.5 mt-1">
                      {t.max_vehicles != null && <li className="flex items-center gap-1.5"><Car className="w-3.5 h-3.5 text-gray-400" /> до {t.max_vehicles} машин</li>}
                      {t.max_parts != null && <li className="flex items-center gap-1.5"><Package className="w-3.5 h-3.5 text-gray-400" /> до {t.max_parts} запчастей</li>}
                    </ul>
                  </button>
                )
              })}
            </div>
          )}

          {selectedTier && !selectedTier.is_custom && (
            <button
              onClick={() => requestMutation.mutate()}
              disabled={requestMutation.isPending || !companyId}
              className="mt-5 w-full inline-flex items-center justify-center gap-2 py-3 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
              style={{ backgroundColor: accent }}
            >
              <Send className="w-4 h-4" />
              {requestMutation.isPending
                ? 'Отправка…'
                : `Оставить заявку · ${selectedTier.name} · ${durationLabel(months)} · ${fmtPrice(tierTermPrice(selectedTier.price, months))}`}
            </button>
          )}
          <p className="text-xs text-gray-400 text-center mt-2">
            Оплата и активация — через администратора.
          </p>
        </div>
      )}

      {/* ── Поддержка ─────────────────────────────────────────────────── */}
      <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <MessageCircle className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900">Вопросы по тарифу?</p>
          <p className="text-sm text-gray-500 mt-0.5">Напишите в поддержку — поможем с оформлением и оплатой.</p>
        </div>
        <button onClick={() => navigate('/support')}
          className="flex-shrink-0 inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 transition-colors">
          <MessageCircle className="w-4 h-4" /> Написать поддержке
        </button>
      </div>

      <p className="text-xs text-gray-400 flex items-center gap-1.5">
        <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
        Лимиты тарифа: количество машин и запчастей в базе разборки.
      </p>
    </div>
  )
}

