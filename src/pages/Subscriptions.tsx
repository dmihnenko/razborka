import { useState, useMemo } from 'react'
import { Spinner } from '@/components/ui/Spinner'
import {
  CreditCard, TrendingUp, Plus, Trash2, Calendar, Building2,
  CheckCircle2, XCircle, Search, X, Infinity, Users, FileText,
  Wrench, ChevronDown, Edit2,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  getSubscriptionPlans, getAllCompanySubscriptions, getSubscriptionStats,
  deactivateSubscription, deleteCompanySubscription, assignSubscription,
  getStoCompanies, getPartsCompanies,
} from '@/services/subscriptionService'
import type { CompanySubscription, Subscription } from '@/types/subscription'
import { useConfirm } from '@/hooks/useConfirm'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { useBlockScroll } from '@/hooks/useBlockScroll'

// ─── Plan feature map ─────────────────────────────────────────────────────────

const PLAN_KEY = (p: Subscription) =>
  p.type === 'lifetime' ? 'lifetime' :
  (p.max_appointments === null && p.max_customers === null) ? 'pro' :
  (p.max_appointments ?? 999) <= 50 ? 'start' : 'business'

const PLAN_FEATURES_MAP: Record<string, string[]> = {
  start:    ['До 50 заявок на місяць', 'До 100 клієнтів', 'До 3 майстрів', 'Календар записів', 'Каталог послуг'],
  business: ['До 200 заявок на місяць', 'До 500 клієнтів', 'До 10 майстрів', 'Аналітика доходів', 'Всі функції'],
  pro:      ['Безліміт заявок', 'Безліміт клієнтів', 'Необм. кількість майстрів', 'Пріоритетна підтримка', 'Всі функції'],
  lifetime: ['Безліміт назавжди', 'Безліміт клієнтів', 'Необм. кількість майстрів', 'Оновлення безкоштовно', 'Всі функції'],
}

const PLAN_COLORS: Record<string, { color: string; bg: string; badge?: string }> = {
  start:    { color: '#2563EB', bg: '#EFF6FF' },
  business: { color: '#7C3AED', bg: '#F5F3FF', badge: 'Популярний' },
  pro:      { color: '#059669', bg: '#F0FDF4', badge: 'Вигідно' },
  lifetime: { color: '#D97706', bg: '#FFFBEB' },
}

const DURATION_OPTIONS = [
  { value: 1,   label: '1 місяць' },
  { value: 3,   label: '3 місяці' },
  { value: 6,   label: '6 місяців' },
  { value: 12,  label: '12 місяців (рік)' },
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
  active:   { label: 'Активна',   cls: 'bg-green-100 text-green-700' },
  expiring: { label: 'Спливає',   cls: 'bg-amber-100 text-amber-700' },
  expired:  { label: 'Прострочена', cls: 'bg-red-100 text-red-700' },
  inactive: { label: 'Неактивна', cls: 'bg-gray-100 text-gray-500' },
}

// ─── component ────────────────────────────────────────────────────────────────

export default function Subscriptions() {
  const [activeTab, setActiveTab] = useState<'companies' | 'plans'>('companies')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [isAssignOpen, setIsAssignOpen] = useState(false)
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

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['company-subscriptions'] })
    queryClient.invalidateQueries({ queryKey: ['subscription-stats'] })
  }

  const assignMutation = useMutation({
    mutationFn: assignSubscription,
    onSuccess: () => { invalidate(); toast.success('Підписку призначено'); setIsAssignOpen(false); setAssignForm({ companyType: 'sto', companyId: '', subscriptionId: '', months: 1 }) },
    onError: (e: any) => toast.error(e.message || 'Помилка'),
  })

  const deactivateMutation = useMutation({
    mutationFn: deactivateSubscription,
    onSuccess: () => { invalidate(); toast.success('Деактивовано') },
    onError: () => toast.error('Помилка деактивації'),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteCompanySubscription,
    onSuccess: () => { invalidate(); toast.success('Видалено') },
    onError: () => toast.error('Помилка видалення'),
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

  const stoPlans   = plans.filter(p => p.company_type === 'sto')
  const companies  = assignForm.companyType === 'sto' ? stoCompanies : partsCompanies
  const filteredPlans = plans.filter(p => p.company_type === assignForm.companyType)
  const selectedPlan  = plans.find(p => p.id === assignForm.subscriptionId)

  const handleAssignSubmit = () => {
    if (!assignForm.companyId || !assignForm.subscriptionId) { toast.error('Виберіть компанію та план'); return }
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
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Підписки</h1>
          <p className="text-sm text-gray-500 mt-0.5">Управління тарифами СТО та авторозборок</p>
        </div>
        <button onClick={() => setIsAssignOpen(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Призначити</span>
        </button>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: 'Активних',   value: stats?.total_active || 0,   icon: CheckCircle2, color: '#16A34A', bg: '#F0FDF4' },
          { label: 'Місячних',   value: stats?.total_monthly || 0,  icon: Calendar,     color: '#2563EB', bg: '#EFF6FF' },
          { label: 'Річних',     value: stats?.total_yearly || 0,   icon: TrendingUp,   color: '#7C3AED', bg: '#F5F3FF' },
          { label: 'Безстрок.',  value: stats?.total_lifetime || 0, icon: Infinity,     color: '#D97706', bg: '#FFFBEB' },
          { label: 'Дохід/міс', value: `₴${(stats?.revenue_this_month || 0).toLocaleString()}`, icon: CreditCard, color: '#059669', bg: '#F0FDF4' },
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
            { key: 'companies', label: `Компанії (${allSubs.length})` },
            { key: 'plans',     label: 'Тарифні плани' },
          ].map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key as any)}
              className={`px-5 py-3.5 text-sm font-semibold transition-colors ${activeTab === t.key ? 'border-b-2 border-primary text-primary' : 'text-gray-500 hover:text-gray-800'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Companies tab ── */}
        {activeTab === 'companies' && (
          <div>
            {/* Toolbar */}
            <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" placeholder="Пошук компанії..." value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
                {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>}
              </div>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white">
                <option value="all">Всі статуси</option>
                <option value="active">Активні</option>
                <option value="expiring">Спливають</option>
                <option value="expired">Прострочені</option>
                <option value="inactive">Неактивні</option>
              </select>
            </div>

            {subsLoading ? (
              <div className="flex justify-center py-12"><Spinner size="lg" /></div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <CreditCard className="w-12 h-12 text-gray-200 mb-3" />
                <p className="font-medium text-gray-500">Підписок не знайдено</p>
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
                            {sub.company_type === 'sto' ? 'СТО' : 'Розборка'}
                          </span>
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${stStyle.cls}`}>{stStyle.label}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                          <span className="font-medium text-gray-700">{sub.subscription?.name || '—'}</span>
                          <span>·</span>
                          <span>{new Date(sub.start_date).toLocaleDateString('uk-UA')}</span>
                          <span>→</span>
                          <span>{sub.end_date ? new Date(sub.end_date).toLocaleDateString('uk-UA') : '∞'}</span>
                          {dl !== null && dl <= 30 && (
                            <span className={`font-semibold ${dl <= 7 ? 'text-red-600' : 'text-amber-600'}`}>
                              {dl === 0 ? 'Сьогодні' : `${dl} ${dl === 1 ? 'день' : 'дн.'}`}
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
                            onClick={async () => { if (await showConfirm({ message: `Деактивувати підписку для ${sub.company?.name}?`, danger: true })) deactivateMutation.mutate(sub.id) }}
                            className="w-8 h-8 flex items-center justify-center text-amber-500 hover:bg-amber-50 rounded-xl transition-colors" title="Деактивувати">
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={async () => { if (await showConfirm({ message: `Видалити підписку для ${sub.company?.name}?`, danger: true })) deleteMutation.mutate(sub.id) }}
                          className="w-8 h-8 flex items-center justify-center text-red-400 hover:bg-red-50 rounded-xl transition-colors" title="Видалити">
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
                {stoPlans.map(plan => {
                  const key = PLAN_KEY(plan)
                  const clr = PLAN_COLORS[key] || PLAN_COLORS.start
                  const features = PLAN_FEATURES_MAP[key] || []
                  const companiesOnPlan = allSubs.filter(s => s.subscription_id === plan.id && s.is_active).length

                  return (
                    <div key={plan.id}
                      className="relative rounded-2xl border-2 overflow-hidden transition-all hover:shadow-md"
                      style={{ borderColor: clr.color + '40', backgroundColor: clr.bg }}>
                      {clr.badge && (
                        <div className="absolute top-3 right-3 text-xs font-bold px-2 py-0.5 rounded-full text-white"
                          style={{ backgroundColor: clr.color }}>
                          {clr.badge}
                        </div>
                      )}
                      <div className="p-5">
                        <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: clr.color }}>
                          {plan.type === 'lifetime' ? 'Безстроково' : plan.type === 'yearly' ? '12 місяців' : plan.duration_months ? `${plan.duration_months} міс.` : 'Місячний'}
                        </p>
                        <h3 className="text-xl font-bold text-gray-900 mb-3">{plan.name}</h3>

                        {/* Price */}
                        <div className="mb-4">
                          <span className="text-3xl font-bold text-gray-900" style={{ letterSpacing: '-0.03em' }}>
                            ₴{plan.price.toLocaleString()}
                          </span>
                          {plan.type === 'lifetime'
                            ? <span className="text-sm text-gray-500 ml-1">назавжди</span>
                            : <span className="text-sm text-gray-500 ml-1">/{plan.duration_months === 1 ? 'міс' : `${plan.duration_months} міс`}</span>
                          }
                        </div>

                        {/* Limits */}
                        <div className="flex items-center gap-3 mb-4 flex-wrap">
                          <div className="flex items-center gap-1.5 text-xs text-gray-600">
                            <FileText className="w-3.5 h-3.5" style={{ color: clr.color }} />
                            {plan.max_appointments === null ? '∞ заявок' : `${plan.max_appointments} заявок`}
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-gray-600">
                            <Users className="w-3.5 h-3.5" style={{ color: clr.color }} />
                            {plan.max_customers === null ? '∞ клієнтів' : `${plan.max_customers} клієнтів`}
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-gray-600">
                            <Wrench className="w-3.5 h-3.5" style={{ color: clr.color }} />
                            {plan.max_workers === null ? '∞ майстрів' : `${plan.max_workers} майстри`}
                          </div>
                        </div>

                        {/* Features */}
                        <ul className="space-y-1.5 mb-4">
                          {features.map(f => (
                            <li key={f} className="flex items-start gap-2 text-xs text-gray-700">
                              <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: clr.color }} />
                              {f}
                            </li>
                          ))}
                        </ul>

                        {/* Companies on plan */}
                        <div className="pt-3 border-t border-black/10 text-xs text-gray-500">
                          {companiesOnPlan > 0
                            ? `Використовують: ${companiesOnPlan} компані${companiesOnPlan === 1 ? 'я' : 'ї'}`
                            : 'Ніхто не підписаний'
                          }
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
    if (selectedPlan.type === 'lifetime') return 'Безстроково'
    const d = new Date()
    d.setMonth(d.getMonth() + form.months)
    return d.toLocaleDateString('uk-UA', { day: '2-digit', month: 'long', year: 'numeric' })
  })()

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[92vh] flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <h2 className="font-bold text-gray-900">Призначити підписку</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Company type */}
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-2">Тип компанії</label>
            <div className="flex gap-2">
              {['sto', 'parts'].map(t => (
                <button key={t} type="button"
                  onClick={() => onFormChange({ ...form, companyType: t, companyId: '', subscriptionId: '' })}
                  className={`flex-1 py-2 text-sm font-semibold rounded-xl border-2 transition-all ${form.companyType === t ? 'border-primary bg-primary/5 text-primary' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                  {t === 'sto' ? 'СТО' : 'Авторозборка'}
                </button>
              ))}
            </div>
          </div>

          {/* Company */}
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-2">Компанія *</label>
            <select value={form.companyId} onChange={e => onFormChange({ ...form, companyId: e.target.value })}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white">
              <option value="">Оберіть компанію...</option>
              {companies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Plan */}
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-2">Тарифний план *</label>
            <div className="space-y-2">
              {plans.filter((p: Subscription) => p.company_type === form.companyType).map((p: Subscription) => {
                const key = PLAN_KEY(p)
                const clr = PLAN_COLORS[key] || PLAN_COLORS.start
                const isSelected = form.subscriptionId === p.id
                return (
                  <button key={p.id} type="button"
                    onClick={() => onFormChange({ ...form, subscriptionId: p.id })}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all text-left ${isSelected ? 'border-primary bg-primary/5' : 'border-gray-100 hover:border-gray-200'}`}>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{p.name}</p>
                      <p className="text-xs text-gray-500">
                        {p.max_appointments ? `До ${p.max_appointments} заявок` : 'Безліміт'}
                        {' · '}
                        {p.max_customers ? `${p.max_customers} клієнтів` : 'Безліміт клієнтів'}
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
              <label className="text-sm font-semibold text-gray-700 block mb-2">Тривалість</label>
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
                  Дата закінчення: <span className="font-semibold text-gray-700">{endDatePreview}</span>
                </p>
              )}
            </div>
          )}

          {selectedPlan?.type === 'lifetime' && (
            <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 text-sm text-amber-800">
              ✓ Безстрокова підписка — жодної дати закінчення
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex gap-2 flex-shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">Скасувати</button>
          <button onClick={onSubmit} disabled={isPending || !form.companyId || !form.subscriptionId}
            className="flex-1 py-2.5 text-sm font-semibold text-white bg-primary hover:bg-primary/90 rounded-xl disabled:opacity-50 transition-colors">
            {isPending ? 'Збереження...' : 'Призначити'}
          </button>
        </div>
      </div>
    </div>
  )
}
