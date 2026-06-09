import { useState, useMemo } from 'react'
import { Spinner } from '@/components/ui/Spinner'
import {
  CreditCard, TrendingUp, Plus, Trash2, Calendar, Building2,
  CheckCircle2, XCircle, Search, X, Infinity, Edit2,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  getSubscriptionPlans, getAllCompanySubscriptions, getSubscriptionStats,
  deactivateSubscription, deleteCompanySubscription, assignSubscription,
  getStoCompanies, getPartsCompanies,
  getSubscriptionRequests, approveSubscriptionRequest, rejectSubscriptionRequest,
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
  const [isAssignOpen, setIsAssignOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<Subscription | null>(null)
  const [assignForm, setAssignForm] = useState({
    companyType: 'sto' as 'sto' | 'parts',
    companyId: '',
    subscriptionId: '',
    months: 1,
  })
  const queryClient = useQueryClient()
  const { confirm: showConfirm, dialogProps } = useConfirm()

  const { data: plans = [], isLoading: plansLoading } = useQuery({ queryKey: ['subscription-plans'], queryFn: getSubscriptionPlans })
  const { data: allSubs = [],  isLoading: subsLoading  } = useQuery({ queryKey: ['company-subscriptions'], queryFn: getAllCompanySubscriptions })
  const { data: stats } = useQuery({ queryKey: ['subscription-stats'], queryFn: getSubscriptionStats })
  const { data: stoCompanies  = [] } = useQuery({ queryKey: ['sto-companies-list'],  queryFn: getStoCompanies,   enabled: assignForm.companyType === 'sto' })
  const { data: partsCompanies = [] } = useQuery({ queryKey: ['parts-companies-list'], queryFn: getPartsCompanies, enabled: assignForm.companyType === 'parts' })
  const { data: requests = [] } = useQuery({ queryKey: ['subscription-requests'], queryFn: () => getSubscriptionRequests('pending') })

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
    onSuccess: () => { invalidate(); toast.success('Подписка назначена'); setIsAssignOpen(false); setAssignForm({ companyType: 'sto', companyId: '', subscriptionId: '', months: 1 }) },
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
    onError: () => toast.error('Ошибка видалення'),
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

  const companies  = assignForm.companyType === 'sto' ? stoCompanies : partsCompanies
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
          <p className="text-sm text-gray-500 mt-0.5">Управление тарифами СТО и авторазборок</p>
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
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${r.company_type === 'sto' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                          {r.company_type === 'sto' ? 'СТО' : 'Разборка'}
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
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${sub.company_type === 'sto' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                            {sub.company_type === 'sto' ? 'СТО' : 'Разборка'}
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
                      </div>

                      {/* Price */}
                      <div className="hidden sm:block text-right flex-shrink-0 mr-2">
                        <p className="text-sm font-bold text-gray-900">₴{sub.subscription?.price?.toLocaleString() || 0}</p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 flex-shrink-0">
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
                  const isParts = plan.company_type === 'parts'
                  const clr = isParts ? { color: '#16A34A', bg: '#F0FDF4' } : { color: '#2563EB', bg: '#EFF6FF' }
                  const companiesOnPlan = allSubs.filter(s => s.subscription_id === plan.id && s.is_active).length

                  return (
                    <div key={plan.id}
                      className="relative rounded-2xl border-2 overflow-hidden transition-all hover:shadow-md"
                      style={{ borderColor: clr.color + '40', backgroundColor: clr.bg }}>
                      <div className="p-5">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: clr.color }}>
                            {isParts ? 'Разборка' : 'СТО'}
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

                        {plan.description && (
                          <p className="text-xs text-gray-500 mb-4 leading-relaxed">{plan.description}</p>
                        )}

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

      <ConfirmDialog {...dialogProps} />
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
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[92vh] flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <h2 className="font-bold text-gray-900">Назначить подписку</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Company type */}
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-2">Тип компании</label>
            <div className="flex gap-2">
              {['sto', 'parts'].map(t => (
                <button key={t} type="button"
                  onClick={() => onFormChange({ ...form, companyType: t, companyId: '', subscriptionId: '' })}
                  className={`flex-1 py-2 text-sm font-semibold rounded-xl border-2 transition-all ${form.companyType === t ? 'border-primary bg-primary/5 text-primary' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                  {t === 'sto' ? 'СТО' : 'Авторазборка'}
                </button>
              ))}
            </div>
          </div>

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
    max_workers:      plan.max_workers != null ? String(plan.max_workers) : '',
    max_appointments: plan.max_appointments != null ? String(plan.max_appointments) : '',
    max_customers:    plan.max_customers != null ? String(plan.max_customers) : '',
    sort_order:       plan.sort_order != null ? String(plan.sort_order) : '0',
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
        max_workers:      numOrNull(form.max_workers),
        max_appointments: numOrNull(form.max_appointments),
        max_customers:    numOrNull(form.max_customers),
        sort_order:       Number(form.sort_order) || 0,
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

  const field = (label: string, key: keyof typeof form, type = 'text', hint?: string) => (
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
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[92vh] flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <h2 className="font-bold text-gray-900">Редактировать план: {plan.name}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {field('Название', 'name')}
          {field('Описание', 'description')}
          {field('Цена (₴/мес)', 'price', 'number')}
          <div className="grid grid-cols-3 gap-2">
            {field('Механики', 'max_workers', 'number')}
            {field('Заявок/мес', 'max_appointments', 'number')}
            {field('Клиентов', 'max_customers', 'number')}
          </div>
          {field('Порядок', 'sort_order', 'number')}
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
