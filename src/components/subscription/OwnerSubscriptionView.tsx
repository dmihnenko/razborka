import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Clock, CheckCircle2, AlertTriangle, Infinity as InfinityIcon,
  MessageCircle, Send, Hourglass, Wrench, Package,
} from 'lucide-react'
import { Spinner } from '@/components/ui/Spinner'
import { toast } from 'sonner'
import { useUserProfile } from '@/hooks/useUserProfile'
import { useCompanySubscription } from '@/hooks/useSubscription'
import {
  getActivePaidPlan, getMyLatestRequest, createSubscriptionRequest,
} from '@/services/subscriptionService'
import {
  DURATIONS, durationPrice, pricePerMonth, durationLabel, discountPct, fmtPrice,
  type CompanyType,
} from '@/config/subscriptionPlans'

export default function OwnerSubscriptionView({ companyType }: { companyType: CompanyType }) {
  const { data: profile } = useUserProfile()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const companyId = companyType === 'sto' ? profile?.sto_company_id : profile?.parts_company_id
  const accent = companyType === 'sto' ? '#2563EB' : '#16A34A'
  const TypeIcon = companyType === 'sto' ? Wrench : Package

  const [months, setMonths] = useState(3)

  const { data: companySub, isLoading } = useCompanySubscription()
  const { data: plan } = useQuery({
    queryKey: ['paid-plan', companyType],
    queryFn: () => getActivePaidPlan(companyType),
  })
  const { data: latestReq } = useQuery({
    queryKey: ['my-sub-request', companyType, companyId],
    queryFn: () => getMyLatestRequest(companyType, companyId!),
    enabled: !!companyId,
  })

  const hasActive  = !!companySub
  const isLifetime = !!companySub && !companySub.end_date
  const endDate    = companySub?.end_date
  const daysLeft   = endDate ? Math.max(0, Math.ceil((new Date(endDate).getTime() - Date.now()) / 86_400_000)) : null
  const expiringSoon = daysLeft !== null && daysLeft <= 14
  const pending = latestReq?.status === 'pending'

  const requestMutation = useMutation({
    mutationFn: () => createSubscriptionRequest({
      company_type: companyType, company_id: companyId!, plan_id: plan!.id, months,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-sub-request'] })
      toast.success('Заявка отправлена администратору')
    },
    onError: (e: any) => toast.error(e?.message || 'Не удалось отправить заявку'),
  })

  if (isLoading) return (
    <div className="flex justify-center items-center min-h-[60vh]"><Spinner size="lg" /></div>
  )

  const planName = companySub?.subscription?.name || (companyType === 'sto' ? 'Бесплатный режим' : 'Бесплатный режим')

  return (
    <div className="w-full pb-12 space-y-6">

      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
          {companyType === 'sto' ? 'Тариф СТО' : 'Тариф разборки'}
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Подписка и срок действия</p>
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

      {/* ── Оформить / продлить ───────────────────────────────────────── */}
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
          <h2 className="text-base font-bold text-gray-900 mb-1">
            {hasActive ? 'Продлить подписку' : 'Оформить подписку'}
          </h2>
          <p className="text-sm text-gray-500 mb-4">Выберите срок — чем дольше, тем выгоднее</p>

          {!plan ? (
            <p className="text-sm text-gray-400">Тариф временно недоступен. Обратитесь к администратору.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                {DURATIONS.map(d => {
                  const active = months === d.months
                  const price = durationPrice(companyType, d.months)
                  const pct = discountPct(d.months)
                  return (
                    <button
                      key={d.months}
                      onClick={() => setMonths(d.months)}
                      className={`relative rounded-xl border-2 p-3 text-left transition-all ${active ? 'shadow-sm' : 'hover:border-gray-300'}`}
                      style={{ borderColor: active ? accent : '#E5E7EB', backgroundColor: active ? `${accent}08` : '#fff' }}
                    >
                      {pct > 0 && (
                        <span className="absolute top-2 right-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: accent }}>
                          −{pct}%
                        </span>
                      )}
                      <p className="text-sm font-semibold text-gray-900">{durationLabel(d.months)}</p>
                      <p className="text-lg font-bold mt-1" style={{ color: accent }}>{fmtPrice(price)}</p>
                      <p className="text-[11px] text-gray-400">{fmtPrice(pricePerMonth(companyType, d.months))}/мес</p>
                    </button>
                  )
                })}
              </div>

              <button
                onClick={() => requestMutation.mutate()}
                disabled={requestMutation.isPending || !companyId}
                className="w-full inline-flex items-center justify-center gap-2 py-3 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
                style={{ backgroundColor: accent }}
              >
                <Send className="w-4 h-4" />
                {requestMutation.isPending ? 'Отправка…' : `Оставить заявку · ${durationLabel(months)} · ${fmtPrice(durationPrice(companyType, months))}`}
              </button>
              <p className="text-xs text-gray-400 text-center mt-2">
                Оплата и активация — через администратора. Бессрочный тариф оформляется только администратором.
              </p>
            </>
          )}
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
        Пока подписка активна — доступ к функциям без ограничений по количеству.
      </p>
    </div>
  )
}
