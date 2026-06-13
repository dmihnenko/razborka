import { useState, useMemo } from 'react'
import { Spinner } from '@/components/ui/Spinner'
import {
  CreditCard, TrendingUp, Plus, Trash2, Calendar, Building2,
  CheckCircle2, XCircle, Search, X, Infinity, Edit2, RotateCw, Car, Package, User,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  getSubscriptionPlans, getAllCompanySubscriptions, getSubscriptionStats,
  deactivateSubscription, deleteCompanySubscription, assignSubscription,
  getPartsCompanies,
  getSubscriptionRequests, approveSubscriptionRequest, rejectSubscriptionRequest,
  getPartsCompaniesUsage,
} from '@/services/subscriptionService'
import type { CompanySubscription, Subscription } from '@/types/subscription'
import { durationLabel } from '@/config/subscriptionPlans'
import { useConfirm } from '@/hooks/useConfirm'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { useBlockScroll } from '@/hooks/useBlockScroll'

const DURATION_OPTIONS = [
  { value: 1,  label: '1 месяц' },
  { value: 3,  label: '3 месяца' },
  { value: 6,  label: '6 месяцев' },
  { value: 12, label: '12 месяцев (год)' },
]

// ─── helpers ──────────────────────────────────────────────────────────────────

function daysLeft(endDate: string | null): number | null {
  if (!endDate) return null
  const diff = new Date(endDate).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / 86_400_000))
}

function isExpired(sub: CompanySubscription) {
  if (!sub.end_date) return false
  return new Date(sub.end_date) < new Date()
}

function subStatus(sub: CompanySubscription): 'active' | 'expiring' | 'expired' | 'inactive' {
  if (!sub.is_active) return 'inactive'
  if (isExpired(sub)) return 'expired'
  const dl = daysLeft(sub.end_date)
  if (dl !== null && dl <= 14) return 'expiring'
  return 'active'
}

const STATUS_STYLE = {
  active:   { label: 'Активна',     cls: 'bg-green-100 text-green-700' },
  expiring: { label: 'Истекает',    cls: 'bg-amber-100 text-amber-700' },
  expired:  { label: 'Просрочена',  cls: 'bg-red-100 text-red-700' },
  inactive: { label: 'Неактивна',   cls: 'bg-gray-100 text-gray-500' },
}

// ─── component ────────────────────────────────────────────────────────────────

export default function Subscriptions() {
  const [activeTab, setActiveTab] = useState<'companies' | 'plans' | 'requests'>('companies')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [renewing, setRenewing] = useState<CompanySubscription | null>(null)
  const [isAssignOpen, setIsAssignOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<Subscription | null>(null)
  const [assignForm, setAssignForm] = useState({
    companyType: 'parts' as const,
    companyId: '',
    subscriptionId: '',
    months: 1,
  })
  const queryClient = useQueryClient()
  const { confirm: showConfirm, dialogProps } = useConfirm()

  const { data: plans = [], isLoading: plansLoading } = useQuery({ queryKey: ['subscription-plans'], queryFn: getSubscriptionPlans })
  const { data: allSubs = [],  isLoading: subsLoading  } = useQuery({ queryKey: ['company-subscriptions'], queryFn: getAllCompanySubscriptions })
  const { data: stats } = useQuery({ queryKey: ['subscription-stats'], queryFn: getSubscriptionStats })
  const { data: partsCompanies = [] } = useQuery({ queryKey: ['parts-companies-list'], queryFn: getPartsCompanies })
  const { data: requests = [] } = useQuery({ queryKey: ['subscription-requests'], queryFn: () => getSubscriptionRequests('pending') })
  const { data: partsUsageMap = {} } = useQuery({ queryKey: ['parts-companies-usage'], queryFn: getPartsCompaniesUsage, staleTime: 2 * 60 * 1000 })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['company-subscriptions'] })
    queryClient.invalidateQueries({ queryKey: ['subscription-stats'] })
  }

  const approveMutation = useMutation({
    mutationFn: approveSubscriptionRequest,
    onSuccess: () => { invalidate(); queryClient.invalidateQueries({ queryKey: ['subscription-requests'] }); toast.success('Заявка подтверждена, подписка назначена') },
    onError: (e: any) => toast.error(e.message || 'Ошибка'),
  })
  const rejectMutation = useMutation({
    mutationFn: (id: string) => rejectSubscriptionRequest(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['subscription-requests'] }); toast.success('Заявка отклонена') },
    onError: (e: any) => toast.error(e.message || 'Ошибка'),
  })

  const assignMutation = useMutation({
    mutationFn: assignSubscription,
    onSuccess: () => { invalidate(); toast.success('Подписка назначена'); setIsAssignOpen(false); setAssignForm({ companyType: 'parts', companyId: '', subscriptionId: '', months: 1 }) },
    onError: (e: any) => toast.error(e.message || 'Ошибка'),
  })

  const deactivateMutation = useMutation({
    mutationFn: deactivateSubscription,
    onSuccess: () => { invalidate(); toast.success('Деактивировано') },
    onError: () => toast.error('Ошибка деактивации'),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteCompanySubscription,
    onSuccess: () => { invalidate(); toast.success('Удалено') },
    onError: () => toast.error('Ошибка удаления'),
  })

  // Продление/активация: продлеваем от даты окончания (если в будущем) или от сегодня
  const renewMutation = useMutation({
    mutationFn: ({ sub, months }: { sub: CompanySubscription; months: number }) => {
      const base = sub.end_date && new Date(sub.end_date) > new Date() ? new Date(sub.end_date) : new Date()
      base.setMonth(base.getMonth() + months)
      return assignSubscription({
        company_type: sub.company_type, company_id: sub.company_id,
        subscription_id: sub.subscription_id, end_date: base.toISOString(),
      })
    },
    onSuccess: () => { invalidate(); toast.success('Подписка продлена и активирована'); setRenewing(null) },
    onError: (e: any) => toast.error(e.message || 'Ошибка продления'),
  })

  // Filtered company subscriptions
  const filtered = useMemo(() => {
    let list = allSubs as CompanySubscription[]
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(s => s.company?.name?.toLowerCase().includes(q) || s.subscription?.name?.toLowerCase().includes(q))
    }
    if (statusFilter !== 'all') {
      list = list.filter(s => subStatus(s) === statusFilter)
    }
    return list
  }, [allSubs, search, statusFilter])

  const companies  = partsCompanies
  const filteredPlans = plans.filter(p => p.company_type === assignForm.companyType)
  const selectedPlan  = plans.find(p => p.id === assignForm.subscriptionId)

  const handleAssignSubmit = () => {
    if (!assignForm.companyId || !assignForm.subscriptionId) { toast.error('Выберите компанию и план'); return }
    const plan = plans.find(p => p.id === assignForm.subscriptionId)
    let endDate: string | undefined
    if (plan?.type !== 'lifetime') {
      const d = new Date()
      d.setMonth(d.getMonth() + assignForm.months)
      endDate = d.toISOString()
    }
    assignMutation.mutate({ company_id: assignForm.companyId, company_type: assignForm.companyType, subscription_id: assignForm.subscriptionId, end_date: endDate })
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5 pb-10">

      {/* ── Page header ── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Подписки</h1>
          <p className="text-sm text-gray-500 mt-0.5">Управление тарифами авторазборок</p>
        </div>
        <button onClick={() => setIsAssignOpen(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Назначить</span>
        </button>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: 'Активных',   value: stats?.total_active || 0,   icon: CheckCircle2, color: '#16A34A', bg: '#F0FDF4' },
          { label: 'Месячных',   value: stats?.total_monthly || 0,  icon: Calendar,     color: '#2563EB', bg: '#EFF6FF' },
          { label: 'Годовых',    value: stats?.total_yearly || 0,   icon: TrendingUp,   color: '#7C3AED', bg: '#F5F3FF' },
          { label: 'Бессрочных', value: stats?.total_lifetime || 0, icon: Infinity,     color: '#D97706', bg: '#FFFBEB' },
          { label: 'Доход/мес',  value: `₴${(stats?.revenue_this_month || 0).toLocaleString()}`, icon: CreditCard, color: '#059669', bg: '#F0FDF4' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: bg }}>
              <Icon className="w-4 h-4" style={{ color }} />
            </div>
            <div className="min-w-0">
              <p className="text-lg font-bold text-gray-900 leading-tight">{value}</p>
              <p className="text-xs text-gray-500 truncate">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-100">
          {[
            { key: 'requests',  label: `Заявки (${requests.length})` },
            { key: 'companies', label: `Компании (${allSubs.length})` },
            { key: 'plans',     label: 'Тарифные планы' },
          ].map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key as any)}
              className={`px-5 py-3.5 text-sm font-semibold transition-colors ${activeTab === t.key ? 'border-b-2 border-primary text-primary' : 'text-gray-500 hover:text-gray-800'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Requests tab ── */}
        {activeTab === 'requests' && (
          <div className="p-4">
            {requests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-center">
                <CheckCircle2 className="w-12 h-12 text-gray-200 mb-3" />
                <p className="font-medium text-gray-500">Нет новых заявок</p>
                <p className="text-sm text-gray-400 mt-1">Заявки владельцев на подписку появятся здесь</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {requests.map((r: any) => (
                  <div key={r.id} className="py-3.5 flex items-center gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <span className="font-semibold text-gray-900 text-sm truncate">{r.company_name}</span>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                          Разборка
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                        <span className="font-medium text-gray-700">{r.plan?.name || 'Тариф'}</span>
                        <span>·</span>
                        <span>Срок: {durationLabel(r.months)}</span>
                        <span>·</span>
                        <span>{new Date(r.created_at).toLocaleDateString('ru-RU')}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => approveMutation.mutate(r.id)}
                        disabled={approveMutation.isPending}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-4 h-4" /> Подтвердить
                      </button>
                      <button
                        onClick={() => rejectMutation.mutate(r.id)}
                        disabled={rejectMutation.isPending}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                      >
                        <XCircle className="w-4 h-4" /> Отклонить
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Companies tab ── */}
        {activeTab === 'companies' && (
          <div>
            {/* Toolbar */}
            <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" placeholder="Поиск компании..." value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
                {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>}
              </div>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white">
                <option value="all">Все статусы</option>
                <option value="active">Активные</option>
                <option value="expiring">Истекают</option>
                <option value="expired">Просроченные</option>
                <option value="inactive">Неактивные</option>
              </select>
            </div>

            {subsLoading ? (
              <div className="flex justify-center py-12"><Spinner size="lg" /></div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <CreditCard className="w-12 h-12 text-gray-200 mb-3" />
                <p className="font-medium text-gray-500">Подписки не найдены</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {filtered.map(sub => {
                  const st = subStatus(sub)
                  const stStyle = STATUS_STYLE[st]
                  const dl = daysLeft(sub.end_date)
                  return (
                    <div key={sub.id} className="px-4 sm:px-5 py-3.5 flex items-center gap-3 hover:bg-gray-50/50 transition-colors">
                      {/* Company */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <span className="font-semibold text-gray-900 text-sm truncate">{sub.company?.name || '—'}</span>
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
                            Разборка
                          </span>
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${stStyle.cls}`}>{stStyle.label}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                          <span className="font-medium text-gray-700">{sub.subscription?.name || '—'}</span>
                          <span>·</span>
                          <span>{new Date(sub.start_date).toLocaleDateString('ru-RU')}</span>
                          <span>→</span>
                          <span>{sub.end_date ? new Date(sub.end_date).toLocaleDateString('ru-RU') : '∞'}</span>
                          {dl !== null && dl <= 30 && (
                            <span className={`font-semibold ${dl <= 7 ? 'text-red-600' : 'text-amber-600'}`}>
                              {dl === 0 ? 'Сегодня' : `${dl} ${dl === 1 ? 'день' : 'дн.'}`}
                            </span>
                          )}
                        </div>
                        {/* Загрузка против лимитов (разборка) */}
                        {partsUsageMap[sub.company_id] && sub.subscription && (
                          <div className="flex items-center gap-3 mt-1.5 text-[11px] text-gray-500 flex-wrap">
                            {([
                              ['Машины', partsUsageMap[sub.company_id].vehicles, sub.subscription.max_vehicles],
                              ['Запчасти', partsUsageMap[sub.company_id].parts, sub.subscription.max_parts],
                            ] as const).map(([label, used, max]) => {
                              const over = max != null && used >= max
                              return (
                                <span key={label} className="inline-flex items-center gap-1">
                                  {label}: <b className={over ? 'text-red-600' : 'text-gray-700'}>{used}/{max ?? '∞'}</b>
                                </span>
                              )
                            })}
                          </div>
                        )}
                      </div>

                      {/* Price */}
                      <div className="hidden sm:block text-right flex-shrink-0 mr-2">
                        <p className="text-sm font-bold text-gray-900">₴{sub.subscription?.price?.toLocaleString() || 0}</p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => setRenewing(sub)}
                          className="w-8 h-8 flex items-center justify-center text-green-600 hover:bg-green-50 rounded-xl transition-colors"
                          title={st === 'active' || st === 'expiring' ? 'Продлить' : 'Активировать / продлить'}>
                          <RotateCw className="w-4 h-4" />
                        </button>
                        {sub.is_active && !isExpired(sub) && (
                          <button
                            onClick={async () => { if (await showConfirm({ message: `Деактивировать подписку для ${sub.company?.name}?`, danger: true })) deactivateMutation.mutate(sub.id) }}
                            className="w-8 h-8 flex items-center justify-center text-amber-500 hover:bg-amber-50 rounded-xl transition-colors" title="Деактивировать">
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={async () => { if (await showConfirm({ message: `Удалить подписку для ${sub.company?.name}?`, danger: true })) deleteMutation.mutate(sub.id) }}
                          className="w-8 h-8 flex items-center justify-center text-red-400 hover:bg-red-50 rounded-xl transition-colors" title="Удалить">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Plans tab ── */}
        {activeTab === 'plans' && (
          <div className="p-4 sm:p-5">
            {plansLoading ? (
              <div className="flex justify-center py-12"><Spinner size="lg" /></div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {plans.map(plan => {
                  const clr = { color: '#16A34A', bg: '#F0FDF4' }
                  const companiesOnPlan = allSubs.filter(s => s.subscription_id === plan.id && s.is_active).length

                  return (
                    <div key={plan.id}
                      className="relative rounded-2xl border-2 overflow-hidden transition-all hover:shadow-md"
                      style={{ borderColor: clr.color + '40', backgroundColor: clr.bg }}>
                      <div className="p-5">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: clr.color }}>
                            Разборка
                          </span>
                          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                            {plan.type === 'lifetime' ? 'Бессрочный' : plan.price === 0 ? 'Демо' : 'Месячный'}
                          </span>
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-3">{plan.name}</h3>

                        {/* Price */}
                        <div className="mb-4">
                          <span className="text-3xl font-bold text-gray-900" style={{ letterSpacing: '-0.03em' }}>
                            ₴{plan.price.toLocaleString()}
                          </span>
                          <span className="text-sm text-gray-500 ml-1">
                            {plan.type === 'lifetime' ? 'навсегда' : plan.price === 0 ? '' : '/мес'}
                          </span>
                        </div>

                        {/* Лимиты тарифа */}
                        <div className="mb-4 space-y-1.5">
                          {plan.is_custom ? (
                            <p className="text-xs font-medium text-gray-500">Индивидуальные условия</p>
                          ) : (
                            <>
                              <p className="text-xs text-gray-600 flex items-center gap-1.5"><Car className="w-3.5 h-3.5 text-gray-400" /> Машин: <span className="font-semibold">{plan.max_vehicles ?? '∞'}</span></p>
                              <p className="text-xs text-gray-600 flex items-center gap-1.5"><Package className="w-3.5 h-3.5 text-gray-400" /> Запчастей: <span className="font-semibold">{plan.max_parts ?? '∞'}</span></p>
                              <p className="text-xs text-gray-600 flex items-center gap-1.5"><User className="w-3.5 h-3.5 text-gray-400" /> Сотрудников: <span className="font-semibold">{plan.max_workers ?? '∞'}</span></p>
                            </>
                          )}
                          {plan.has_analytics && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                              <TrendingUp className="w-3 h-3" /> Аналитика
                            </span>
                          )}
                        </div>

                        {/* Companies on plan + edit */}
                        <div className="pt-3 border-t border-black/10 flex items-center justify-between">
                          <span className="text-xs text-gray-500">
                            {companiesOnPlan > 0
                              ? `Используют: ${companiesOnPlan} компани${companiesOnPlan === 1 ? 'я' : 'й'}`
                              : 'Никто не подписан'
                            }
                          </span>
                          <button
                            onClick={() => setEditingPlan(plan)}
                            className="flex items-center gap-1 text-xs text-gray-400 hover:text-primary transition-colors px-2 py-1 rounded-lg hover:bg-primary/10"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            Изменить
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Plan Edit Modal ── */}
      {editingPlan && (
        <PlanEditModal
          plan={editingPlan}
          onClose={() => setEditingPlan(null)}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ['subscription-plans'] })}
        />
      )}

      {/* ── Assign Modal ── */}
      {isAssignOpen && (
        <AssignModal
          plans={filteredPlans}
          allPlans={plans}
          companies={companies}
          form={assignForm}
          onFormChange={setAssignForm}
          onSubmit={handleAssignSubmit}
          onClose={() => setIsAssignOpen(false)}
          isPending={assignMutation.isPending}
          selectedPlan={selectedPlan}
        />
      )}

      {/* ── Renew / Activate Modal ── */}
      {renewing && (
        <RenewModal
          sub={renewing}
          onClose={() => setRenewing(null)}
          onConfirm={(months) => renewMutation.mutate({ sub: renewing, months })}
          isPending={renewMutation.isPending}
        />
      )}

      <ConfirmDialog {...dialogProps} />
    </div>
  )
}

// ─── Renew / Activate Modal ───────────────────────────────────────────────────

function RenewModal({ sub, onClose, onConfirm, isPending }: { sub: CompanySubscription; onClose: () => void; onConfirm: (months: number) => void; isPending: boolean }) {
  useBlockScroll(true)
  const [months, setMonths] = useState(1)
  const base = sub.end_date && new Date(sub.end_date) > new Date() ? new Date(sub.end_date) : new Date()
  const preview = new Date(base); preview.setMonth(preview.getMonth() + months)
  const opts = [{ v: 1, l: '1 месяц' }, { v: 3, l: '3 месяца' }, { v: 6, l: '6 месяцев' }, { v: 12, l: '1 год' }]
  return (
    <div className="fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center z-50 px-3 py-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-gray-900">Продление подписки</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="text-sm">
            <p className="font-semibold text-gray-900">{sub.company?.name}</p>
            <p className="text-gray-500 text-xs mt-0.5">
              {sub.subscription?.name} · до {sub.end_date ? new Date(sub.end_date).toLocaleDateString('ru-RU') : '∞'}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {opts.map(o => (
              <button key={o.v} onClick={() => setMonths(o.v)}
                className={`py-2.5 text-sm font-semibold rounded-xl border-2 transition-all ${months === o.v ? 'border-primary bg-primary/5 text-primary' : 'border-gray-100 text-gray-600 hover:border-gray-200'}`}>
                {o.l}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500">
            Новая дата окончания: <span className="font-semibold text-gray-700">{preview.toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
          </p>
        </div>
        <div className="px-5 py-4 border-t border-gray-100 flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl">Отмена</button>
          <button onClick={() => onConfirm(months)} disabled={isPending}
            className="flex-1 py-2.5 text-sm font-semibold text-white bg-primary hover:bg-primary/90 rounded-xl disabled:opacity-50">
            {isPending ? 'Сохранение…' : 'Продлить'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Assign Modal ─────────────────────────────────────────────────────────────

function AssignModal({ plans, allPlans, companies, form, onFormChange, onSubmit, onClose, isPending, selectedPlan }: any) {
  useBlockScroll(true)

  const endDatePreview = (() => {
    if (!selectedPlan) return null
    if (selectedPlan.type === 'lifetime') return 'Бессрочно'
    const d = new Date()
    d.setMonth(d.getMonth() + form.months)
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' })
  })()

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center z-50 px-3 py-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[92vh] flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <h2 className="font-bold text-gray-900">Назначить подписку</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Company */}
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-2">Компания *</label>
            <select value={form.companyId} onChange={e => onFormChange({ ...form, companyId: e.target.value })}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white">
              <option value="">Выберите компанию...</option>
              {companies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Plan */}
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-2">Тарифный план *</label>
            <div className="space-y-2">
              {plans.filter((p: Subscription) => p.company_type === form.companyType).map((p: Subscription) => {
                const isSelected = form.subscriptionId === p.id
                return (
                  <button key={p.id} type="button"
                    onClick={() => onFormChange({ ...form, subscriptionId: p.id })}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all text-left ${isSelected ? 'border-primary bg-primary/5' : 'border-gray-100 hover:border-gray-200'}`}>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{p.name}</p>
                      <p className="text-xs text-gray-500">
                        {p.type === 'lifetime' ? 'Бессрочный' : p.price === 0 ? 'Демо · 1 месяц' : 'Месячный · выбор срока ниже'}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0 ml-3">
                      <p className="text-sm font-bold text-gray-900">₴{p.price.toLocaleString()}</p>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-primary ml-auto mt-0.5" />}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Duration (if not lifetime) */}
          {selectedPlan && selectedPlan.type !== 'lifetime' && (
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-2">Длительность</label>
              <div className="grid grid-cols-2 gap-2">
                {DURATION_OPTIONS.map(opt => (
                  <button key={opt.value} type="button"
                    onClick={() => onFormChange({ ...form, months: opt.value })}
                    className={`py-2.5 px-3 text-sm font-semibold rounded-xl border-2 transition-all ${form.months === opt.value ? 'border-primary bg-primary/5 text-primary' : 'border-gray-100 text-gray-600 hover:border-gray-200'}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
              {endDatePreview && (
                <p className="mt-2 text-xs text-gray-500">
                  Дата окончания: <span className="font-semibold text-gray-700">{endDatePreview}</span>
                </p>
              )}
            </div>
          )}

          {selectedPlan?.type === 'lifetime' && (
            <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 text-sm text-amber-800">
              ✓ Бессрочная подписка — без даты окончания
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex gap-2 flex-shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">Отмена</button>
          <button onClick={onSubmit} disabled={isPending || !form.companyId || !form.subscriptionId}
            className="flex-1 py-2.5 text-sm font-semibold text-white bg-primary hover:bg-primary/90 rounded-xl disabled:opacity-50 transition-colors">
            {isPending ? 'Сохранение...' : 'Назначить'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Plan Edit Modal ──────────────────────────────────────────────────────────

import { supabase } from '@/lib/supabase'

function PlanEditModal({ plan, onClose, onSaved }: { plan: Subscription; onClose: () => void; onSaved: () => void }) {
  useBlockScroll(true)
  const [form, setForm] = useState({
    name:             plan.name,
    description:      plan.description || '',
    price:            String(plan.price),
    max_vehicles:     plan.max_vehicles != null ? String(plan.max_vehicles) : '',
    max_parts:        plan.max_parts != null ? String(plan.max_parts) : '',
    max_workers:      plan.max_workers != null ? String(plan.max_workers) : '',
    sort_order:       plan.sort_order != null ? String(plan.sort_order) : '0',
    has_analytics:    plan.has_analytics ?? false,
  })
  const [saving, setSaving] = useState(false)

  const numOrNull = (v: string) => (v.trim() === '' ? null : Number(v))

  const handleSave = async () => {
    setSaving(true)
    try {
      const { error } = await supabase.from('subscriptions').update({
        name:             form.name.trim(),
        description:      form.description.trim() || null,
        price:            Number(form.price),
        max_vehicles:     numOrNull(form.max_vehicles),
        max_parts:        numOrNull(form.max_parts),
        max_workers:      numOrNull(form.max_workers),
        sort_order:       Number(form.sort_order) || 0,
        has_analytics:    form.has_analytics,
      }).eq('id', plan.id)
      if (error) throw error
      toast.success('План обновлён')
      onSaved()
      onClose()
    } catch (e: any) {
      toast.error(e.message || 'Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  type StringFormKey = { [K in keyof typeof form]: (typeof form)[K] extends string ? K : never }[keyof typeof form]
  const field = (label: string, key: StringFormKey, type = 'text', hint?: string) => (
    <div>
      <label className="text-sm font-semibold text-gray-700 block mb-1">{label}</label>
      {hint && <p className="text-xs text-gray-400 mb-1">{hint}</p>}
      <input
        type={type}
        value={form[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
      />
    </div>
  )

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center z-50 px-3 py-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[92vh] flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <h2 className="font-bold text-gray-900">Редактировать план: {plan.name}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {field('Название', 'name')}
          {field('Описание', 'description')}
          {field('Цена (₴/мес)', 'price', 'number')}
          <div className="grid grid-cols-2 gap-2">
            {field('Машины', 'max_vehicles', 'number')}
            {field('Запчасти', 'max_parts', 'number')}
          </div>
          {field('Сотрудников (max_workers)', 'max_workers', 'number', 'Пусто = без лимита')}
          {field('Порядок', 'sort_order', 'number')}
          {/* Аналитика тоггл */}
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-semibold text-gray-700">Аналитика и окупаемость</p>
              <p className="text-xs text-gray-400 mt-0.5">Включить модуль аналитики для этого тарифа</p>
            </div>
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, has_analytics: !f.has_analytics }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
                form.has_analytics ? 'bg-primary' : 'bg-gray-200'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                form.has_analytics ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>
          <p className="text-xs text-gray-400">
            Пустой лимит = без ограничения (например, тариф «Персональный»).
            Срок (месяц / год −15%) выбирается владельцем при оформлении.
          </p>
        </div>
        <div className="px-5 py-4 border-t border-gray-100 flex gap-2 flex-shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">Отмена</button>
          <button onClick={handleSave} disabled={saving || !form.name.trim() || !form.price}
            className="flex-1 py-2.5 text-sm font-semibold text-white bg-primary hover:bg-primary/90 rounded-xl disabled:opacity-50 transition-colors">
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  )
}
