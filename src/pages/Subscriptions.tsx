import { useState, useMemo } from 'react'
import { Spinner } from '@/components/ui/Spinner'
import {
  CreditCard, Plus, Trash2, Building2,
  CheckCircle2, XCircle, Search, X, Edit2, RotateCw, Car, Package, User,
  Bell, ChevronRight, ChevronLeft, Layers, Check,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  getSubscriptionPlans, getAllCompanySubscriptions, getSubscriptionStats,
  deactivateSubscription, deleteCompanySubscription, assignSubscription, adminSetCompanySubscription,
  getSubscriptionRequests, approveSubscriptionRequest, rejectSubscriptionRequest,
  getPartsCompaniesUsage, getSubscriptionPayments,
} from '@/services/subscriptionService'
import type { CompanySubscription, Subscription } from '@/types/subscription'
import { durationLabel } from '@/config/subscriptionPlans'
import { useConfirm } from '@/hooks/useConfirm'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import Modal from '@/components/ui/Modal'

const DURATION_OPTIONS = [
  { value: 1,  label: '1 мес' },
  { value: 2,  label: '2 мес' },
  { value: 3,  label: '3 мес' },
  { value: 6,  label: '6 мес' },
  { value: 12, label: '12 мес' },
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
  active:   { label: 'Активна',    cls: 'badge badge-green',  dot: 'bg-green-500', rail: 'before:bg-green-400' },
  expiring: { label: 'Истекает',   cls: 'badge badge-yellow', dot: 'bg-amber-500', rail: 'before:bg-amber-400' },
  expired:  { label: 'Просрочена', cls: 'badge badge-red',    dot: 'bg-red-500',   rail: 'before:bg-red-400' },
  inactive: { label: 'Неактивна',  cls: 'badge badge-gray',   dot: 'bg-gray-400',  rail: 'before:bg-gray-300' },
}

// Инициалы компании для аватара-бокса
function initials(name?: string | null): string {
  if (!name) return '—'
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '—'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

// Цвет прогресс-бара лимита по заполнению
function barColor(used: number, max: number | null | undefined): string {
  if (max == null) return 'var(--cab-signal)'
  if (used >= max) return '#DC2626'
  const pct = used / max
  if (pct >= 0.9) return '#DC2626'
  if (pct >= 0.7) return '#D97706'
  return '#16A34A'
}

// ─── component ────────────────────────────────────────────────────────────────

export default function Subscriptions() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null)
  const [renewing, setRenewing] = useState<CompanySubscription | null>(null)
  const [editingPlan, setEditingPlan] = useState<Subscription | null>(null)
  const [requestsOpen, setRequestsOpen] = useState(false)
  const [plansOpen, setPlansOpen] = useState(false)
  // Состояние выбора в детальной панели (план + срок)
  const [draftPlanId, setDraftPlanId] = useState<string>('')
  const [draftMonths, setDraftMonths] = useState<number>(1)

  const queryClient = useQueryClient()
  const { confirm: showConfirm, dialogProps } = useConfirm()

  const { data: plans = [], isLoading: plansLoading } = useQuery({ queryKey: ['subscription-plans'], queryFn: getSubscriptionPlans })
  const { data: allSubs = [],  isLoading: subsLoading  } = useQuery({ queryKey: ['company-subscriptions'], queryFn: getAllCompanySubscriptions })
  const { data: stats } = useQuery({ queryKey: ['subscription-stats'], queryFn: getSubscriptionStats })
  const { data: requests = [] } = useQuery({ queryKey: ['subscription-requests'], queryFn: () => getSubscriptionRequests('pending') })
  const { data: partsUsageMap = {} } = useQuery({ queryKey: ['parts-companies-usage'], queryFn: getPartsCompaniesUsage, staleTime: 2 * 60 * 1000 })
  const { data: payments = [] } = useQuery({ queryKey: ['subscription-payments'], queryFn: () => getSubscriptionPayments(200) })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['company-subscriptions'] })
    queryClient.invalidateQueries({ queryKey: ['subscription-stats'] })
    queryClient.invalidateQueries({ queryKey: ['subscription-payments'] })
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
    // через защищённый RPC: end_date считает сервер (months → срок; null → бессрочно)
    mutationFn: ({ companyId, planId, months }: { companyId: string; planId: string; months: number | null }) =>
      adminSetCompanySubscription(companyId, planId, months),
    onSuccess: () => { invalidate(); toast.success('Подписка назначена') },
    onError: (e: any) => toast.error(e.message || 'Ошибка'),
  })

  const deactivateMutation = useMutation({
    mutationFn: deactivateSubscription,
    onSuccess: () => { invalidate(); toast.success('Деактивировано') },
    onError: () => toast.error('Ошибка деактивации'),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteCompanySubscription,
    onSuccess: () => { invalidate(); toast.success('Удалено'); setSelectedCompanyId(null) },
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

  // Filtered company subscriptions (для списка слева)
  const filtered = useMemo(() => {
    let list = allSubs as CompanySubscription[]
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(s => s.company?.name?.toLowerCase().includes(q) || s.subscription?.name?.toLowerCase().includes(q))
    }
    if (statusFilter === 'demo') {
      list = list.filter(s => s.subscription?.is_demo)
    } else if (statusFilter !== 'all') {
      list = list.filter(s => subStatus(s) === statusFilter)
    }
    return list
  }, [allSubs, search, statusFilter])

  // Счётчики для фильтр-чипов (decision-driven: видно, где требуется внимание)
  const statusCounts = useMemo(() => {
    const c = { all: allSubs.length, active: 0, expiring: 0, expired: 0, demo: 0 }
    for (const s of allSubs as CompanySubscription[]) {
      const st = subStatus(s)
      if (st === 'active') c.active++
      else if (st === 'expiring') c.expiring++
      else if (st === 'expired') c.expired++
      if (s.subscription?.is_demo) c.demo++
    }
    return c
  }, [allSubs])

  // Выбранная подписка
  const selected = useMemo(
    () => (allSubs as CompanySubscription[]).find(s => s.company_id === selectedCompanyId) || null,
    [allSubs, selectedCompanyId],
  )

  // Планы для разборок (company_type='parts')
  const partsPlans = useMemo(() => plans.filter(p => p.company_type === 'parts'), [plans])

  // Платежи выбранной компании (по совпадению имени)
  const selectedPayments = useMemo(() => {
    if (!selected?.company?.name) return []
    return payments.filter((p: any) => p.company === selected.company?.name).slice(0, 5)
  }, [payments, selected])

  // Синхронизировать черновик при смене выбранной компании
  const syncDraft = (sub: CompanySubscription | null) => {
    setDraftPlanId(sub?.subscription_id || '')
    setDraftMonths(1)
  }
  const selectCompany = (companyId: string) => {
    const sub = (allSubs as CompanySubscription[]).find(s => s.company_id === companyId) || null
    setSelectedCompanyId(companyId)
    syncDraft(sub)
    setPlansOpen(false)
  }

  // Назначить выбранный план (с учётом бессрочных/бесплатных)
  const handleAssign = () => {
    if (!selectedCompanyId || !draftPlanId) { toast.error('Выберите тариф'); return }
    const plan = plans.find(p => p.id === draftPlanId)
    const termless = plan?.type === 'lifetime' || plan?.price === 0
    const months = termless ? null : Math.max(1, draftMonths || 1)
    assignMutation.mutate({ companyId: selectedCompanyId, planId: draftPlanId, months })
  }

  const draftPlan = plans.find(p => p.id === draftPlanId)
  const draftTermless = draftPlan ? (draftPlan.type === 'lifetime' || draftPlan.price === 0) : false
  const draftTotal = draftPlan && !draftTermless ? draftPlan.price * (draftMonths || 1) : 0

  // KPI: «требуют внимания сейчас» = истекают + просрочено + заявки
  const attention = statusCounts.expiring + statusCounts.expired + requests.length

  return (
    <div className="w-full space-y-5 pb-12">

      {/* ── Тонкая шапка: заголовок + инлайн-KPI + действие ── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="kicker mb-1">Биллинг · авторазборки</p>
          <h1 className="page-title">Подписки</h1>
        </div>

        <div className="flex items-center gap-5">
          {/* Инлайн-KPI */}
          <div className="hidden sm:flex items-stretch">
            <div className="flex flex-col px-4 border-r border-gray-200">
              <span className="text-base font-bold tabular-nums tracking-tight text-gray-900">
                {(stats?.revenue_this_month || 0).toLocaleString('ru-RU')} ₴
              </span>
              <span className="text-[11px] uppercase tracking-wide text-gray-500 mt-0.5">Доход / мес</span>
            </div>
            <div className="flex flex-col px-4 border-r border-gray-200">
              <span className="text-base font-bold tabular-nums tracking-tight text-gray-900">{stats?.total_active || 0}</span>
              <span className="text-[11px] uppercase tracking-wide text-gray-500 mt-0.5">Активных</span>
            </div>
            <button
              type="button"
              onClick={() => attention > 0 && setStatusFilter('expiring')}
              className="flex flex-col px-4 text-left disabled:cursor-default"
              disabled={attention === 0}
            >
              <span className={`text-base font-bold tabular-nums tracking-tight ${attention > 0 ? 'text-amber-600' : 'text-gray-900'}`}>{attention}</span>
              <span className="text-[11px] uppercase tracking-wide text-gray-500 mt-0.5">Требуют внимания</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPlansOpen(o => !o)}
              className="cab-btn cab-btn-secondary cab-btn-lg shrink-0"
            >
              <Layers className="w-4 h-4" />
              <span className="hidden sm:inline">Тарифные планы</span>
            </button>
            {selectedCompanyId && (
              <button
                type="button"
                onClick={() => { setSelectedCompanyId(null); syncDraft(null) }}
                className="cab-btn cab-btn-primary cab-btn-lg shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Новой компании</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Баннер очереди заявок ── */}
      {requests.length > 0 && (
        <div className="rounded-2xl bg-white border-l-4 border-amber-400 border-y border-r border-y-amber-200 border-r-amber-200 overflow-hidden">
          <button
            type="button"
            onClick={() => setRequestsOpen(o => !o)}
            className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-amber-50/50 transition-colors"
          >
            <span className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
              <Bell className="w-4.5 h-4.5 text-amber-600" strokeWidth={1.75} />
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-900 text-sm">
                {requests.length} {requests.length === 1 ? 'заявка ждёт' : requests.length < 5 ? 'заявки ждут' : 'заявок ждут'} подтверждения
              </p>
              <p className="text-xs text-gray-500">Нажмите, чтобы {requestsOpen ? 'свернуть' : 'подтвердить или отклонить'}</p>
            </div>
            <ChevronRight className={`w-5 h-5 text-amber-400 flex-shrink-0 transition-transform ${requestsOpen ? 'rotate-90' : ''}`} strokeWidth={1.75} />
          </button>

          {requestsOpen && (
            <div className="px-4 pb-4 pt-1 space-y-2.5 border-t border-amber-100">
              {requests.map((r: any) => (
                <div key={r.id}
                  className="rounded-xl border border-gray-200 bg-white p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-4 h-4 text-gray-500" strokeWidth={1.75} />
                      </span>
                      <span className="font-bold text-gray-900 text-sm truncate">{r.company_name}</span>
                      <span className="badge badge-gray">Разборка</span>
                    </div>
                    <div className="flex items-center gap-2 mt-2 text-xs text-gray-500 flex-wrap pl-9">
                      <span className="font-semibold text-gray-700">{r.plan?.name || 'Тариф'}</span>
                      <span className="text-gray-300">·</span>
                      <span>{durationLabel(r.months)}</span>
                      <span className="text-gray-300">·</span>
                      <span>{new Date(r.created_at).toLocaleDateString('ru-RU')}</span>
                    </div>
                    {(r.payment_proof_url || r.client_note) && (
                      <div className="mt-2 flex items-center gap-2 flex-wrap text-xs pl-9">
                        {r.payment_proof_url && (
                          <a href={r.payment_proof_url} target="_blank" rel="noopener noreferrer"
                             className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-semibold hover:bg-emerald-100 transition-colors">
                            <CreditCard className="w-3.5 h-3.5" /> Скрин оплаты
                          </a>
                        )}
                        {r.client_note && <span className="text-gray-500 italic truncate">«{r.client_note}»</span>}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 sm:flex-col sm:w-36">
                    <button
                      onClick={() => approveMutation.mutate(r.id)}
                      disabled={approveMutation.isPending}
                      className="cab-btn cab-btn-success cab-btn-sm flex-1 sm:w-full"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Подтвердить
                    </button>
                    <button
                      onClick={() => rejectMutation.mutate(r.id)}
                      disabled={rejectMutation.isPending}
                      className="cab-btn cab-btn-danger cab-btn-sm flex-1 sm:w-full"
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

      {/* ── Раскрываемая секция «Тарифные планы» ── */}
      {plansOpen && (
        <div className="card p-4 sm:p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-bold uppercase tracking-wide text-gray-500">Тарифные планы</p>
            <button type="button" onClick={() => setPlansOpen(false)} className="btn-icon-sm"><X className="w-4 h-4" /></button>
          </div>
          {plansLoading ? (
            <div className="flex justify-center py-10"><Spinner size="lg" /></div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {plans.map(plan => {
                const companiesOnPlan = allSubs.filter(s => s.subscription_id === plan.id && s.is_active).length
                const typeLabel = plan.type === 'lifetime' ? 'Бессрочный' : plan.price === 0 ? 'Демо' : 'Месячный'
                const free = plan.price === 0
                return (
                  <div key={plan.id}
                    className="group relative flex flex-col rounded-2xl border border-gray-200 bg-white overflow-hidden transition-all hover:border-gray-300 hover:shadow-sm">
                    <span className="absolute inset-x-0 top-0 h-1" style={{ background: 'var(--brand-gradient)' }} />
                    <div className="p-5 flex flex-col flex-1">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="kicker">{typeLabel}</span>
                        <button onClick={() => setEditingPlan(plan)}
                          className="btn-icon-sm opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                          title="Редактировать план">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                      <div className="mt-2 mb-4 flex items-baseline gap-1">
                        <span className="text-3xl font-extrabold text-gray-900 tracking-tight tabular-nums">{plan.price.toLocaleString()}</span>
                        <span className="text-sm text-gray-500">грн{plan.type === 'lifetime' ? ' · навсегда' : free ? '' : '/мес'}</span>
                      </div>
                      <div className="space-y-2 mb-4 flex-1">
                        {plan.is_custom ? (
                          <p className="text-sm font-medium text-gray-500">Индивидуальные условия</p>
                        ) : (
                          ([
                            [Car, 'Машин', plan.max_vehicles],
                            [Package, 'Запчастей', plan.max_parts],
                            [User, 'Сотрудников', plan.max_workers],
                          ] as const).map(([Icon, label, val]) => (
                            <div key={label} className="flex items-center justify-between text-sm">
                              <span className="flex items-center gap-2 text-gray-500">
                                <Icon className="w-4 h-4 text-gray-400" strokeWidth={1.75} /> {label}
                              </span>
                              <span className="font-bold text-gray-900 tabular-nums">{val ?? '∞'}</span>
                            </div>
                          ))
                        )}
                      </div>
                      <div className="pt-3 border-t border-gray-100 flex items-center gap-1.5 text-xs">
                        <Layers className="w-3.5 h-3.5 text-gray-400" strokeWidth={1.75} />
                        {companiesOnPlan > 0
                          ? <span className="text-gray-600">На плане: <b className="text-gray-900">{companiesOnPlan}</b></span>
                          : <span className="text-gray-400">Никто не подписан</span>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Двухпанельный грид master-detail ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4 items-start">

        {/* LEFT — список компаний */}
        <div className={`card overflow-hidden ${selectedCompanyId ? 'hidden lg:block' : ''}`}>
          {/* Поиск */}
          <div className="p-3.5 pb-2.5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" placeholder="Поиск компании…" value={search}
                onChange={e => setSearch(e.target.value)}
                className="form-input !pl-9 !pr-8 !py-2" />
              {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>}
            </div>
          </div>

          {/* Фильтр-чипы со счётчиками */}
          <div className="flex flex-wrap gap-1.5 px-3.5 pb-3 border-b border-gray-100">
            {([
              ['all', 'Все', statusCounts.all, false],
              ['active', 'Активные', statusCounts.active, false],
              ['expiring', 'Истекают', statusCounts.expiring, true],
              ['expired', 'Просрочено', statusCounts.expired, true],
              ['demo', 'Демо', statusCounts.demo, false],
            ] as const).map(([key, label, count, warn]) => {
              const on = statusFilter === key
              return (
                <button key={key} onClick={() => setStatusFilter(key)} className={`chip ${on ? 'chip-active' : ''}`}>
                  {label}
                  <span className={`text-[10px] font-bold px-1 rounded-full tabular-nums ${
                    on ? 'bg-white/25 text-white' : warn && count > 0 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                    {count}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Прокручиваемый список */}
          {subsLoading ? (
            <div className="flex justify-center py-16"><Spinner size="lg" /></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state !py-12">
              <div className="empty-state-icon"><CreditCard className="w-7 h-7 text-gray-300" /></div>
              <p className="empty-state-title">Не найдено</p>
              <p className="empty-state-text">Измените поиск или фильтр</p>
            </div>
          ) : (
            <div className="max-h-[calc(100vh-260px)] lg:max-h-[660px] overflow-y-auto">
              {filtered.map(sub => {
                const st = subStatus(sub)
                const stStyle = STATUS_STYLE[st]
                const dl = daysLeft(sub.end_date)
                const sel = sub.company_id === selectedCompanyId
                return (
                  <button key={sub.id} type="button" onClick={() => selectCompany(sub.company_id)}
                    className={`group w-full flex items-center gap-3 px-3.5 py-2.5 text-left border-b border-gray-50 relative transition-colors ${
                      sel ? 'before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px] before:bg-[color:var(--cab-signal)]' : 'hover:bg-gray-50'
                    }`}
                    style={sel ? { backgroundColor: 'var(--cab-signal-weak)' } : undefined}>
                    <span className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      sel ? 'bg-white border' : 'bg-gray-100 text-gray-600'}`}
                      style={sel ? { color: 'var(--cab-signal)', borderColor: 'var(--brand-line, #C9CCF6)' } : undefined}>
                      {initials(sub.company?.name)}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[13.5px] font-semibold text-gray-900 truncate">{sub.company?.name || '—'}</span>
                      <span className="block text-[11.5px] text-gray-500 truncate mt-0.5">
                        {sub.subscription?.is_demo ? 'Демо' : sub.subscription?.name || '—'}
                      </span>
                    </span>
                    <span className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-xs font-semibold min-w-[42px] text-right ${
                        sub.end_date == null ? 'text-gray-400 font-medium'
                          : st === 'expired' ? 'text-red-600'
                          : st === 'expiring' ? 'text-amber-600'
                          : 'text-gray-600'}`}>
                        {sub.end_date == null ? '∞' : dl === 0 ? 'сегодня' : `${dl} дн.`}
                      </span>
                      <span className={`w-2 h-2 rounded-full ${stStyle.dot}`} />
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* RIGHT — детальная панель */}
        <div className={`card ${selectedCompanyId ? '' : 'hidden lg:block'}`}>
          {!selected ? (
            <div className="empty-state !py-24">
              <div className="empty-state-icon"><Layers className="w-7 h-7 text-gray-300" /></div>
              <p className="empty-state-title">Выберите компанию слева</p>
              <p className="empty-state-text">Чтобы посмотреть и изменить подписку</p>
            </div>
          ) : (
            <DetailPanel
              sub={selected}
              partsPlans={partsPlans}
              usage={partsUsageMap[selected.company_id]}
              payments={selectedPayments}
              draftPlanId={draftPlanId}
              draftMonths={draftMonths}
              draftTermless={draftTermless}
              draftTotal={draftTotal}
              assignPending={assignMutation.isPending}
              onBack={() => { setSelectedCompanyId(null); syncDraft(null) }}
              onPickPlan={id => { setDraftPlanId(id); setDraftMonths(1) }}
              onPickMonths={setDraftMonths}
              onAssign={handleAssign}
              onRenew={() => setRenewing(selected)}
              onDeactivate={async () => { if (await showConfirm({ message: `Деактивировать подписку для ${selected.company?.name}?`, danger: true })) deactivateMutation.mutate(selected.id) }}
              onDelete={async () => { if (await showConfirm({ message: `Удалить подписку для ${selected.company?.name}?`, danger: true })) deleteMutation.mutate(selected.id) }}
            />
          )}
        </div>
      </div>

      {/* ── Plan Edit Modal ── */}
      {editingPlan && (
        <PlanEditModal
          plan={editingPlan}
          onClose={() => setEditingPlan(null)}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ['subscription-plans'] })}
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

// ─── Detail Panel ─────────────────────────────────────────────────────────────

function DetailPanel({
  sub, partsPlans, usage, payments,
  draftPlanId, draftMonths, draftTermless, draftTotal, assignPending,
  onBack, onPickPlan, onPickMonths, onAssign, onRenew, onDeactivate, onDelete,
}: {
  sub: CompanySubscription
  partsPlans: Subscription[]
  usage?: { parts: number; vehicles: number; workers?: number }
  payments: any[]
  draftPlanId: string
  draftMonths: number
  draftTermless: boolean
  draftTotal: number
  assignPending: boolean
  onBack: () => void
  onPickPlan: (id: string) => void
  onPickMonths: (m: number) => void
  onAssign: () => void
  onRenew: () => void
  onDeactivate: () => void
  onDelete: () => void
}) {
  const st = subStatus(sub)
  const stStyle = STATUS_STYLE[st]
  const dl = daysLeft(sub.end_date)
  const isDemo = sub.subscription?.is_demo
  const changed = draftPlanId && draftPlanId !== sub.subscription_id

  // Подзаголовок: «План · действует до DD.MM (N дн.)» / «Бессрочно» / «Демо»
  const subline = isDemo
    ? 'Демо-доступ'
    : sub.end_date == null
      ? 'Бессрочно'
      : `действует до ${new Date(sub.end_date).toLocaleDateString('ru-RU')}`

  // Лимиты текущей подписки
  const limits: Array<[string, number, number | null | undefined]> = sub.subscription ? [
    ['Запчасти', usage?.parts ?? 0, sub.subscription.max_parts],
    ['Авто', usage?.vehicles ?? 0, sub.subscription.max_vehicles],
    ['Сотрудники', usage?.workers ?? 0, sub.subscription.max_workers],
  ] : []

  return (
    <div className="p-5 sm:p-6">
      {/* Кнопка назад (мобайл) */}
      <button type="button" onClick={onBack}
        className="lg:hidden inline-flex items-center gap-1 text-sm font-semibold text-gray-500 hover:text-gray-900 mb-4">
        <ChevronLeft className="w-4 h-4" /> К списку
      </button>

      {/* Заголовок */}
      <div className="flex items-start justify-between gap-4 pb-5 border-b border-gray-100">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-11 h-11 rounded-xl text-white flex items-center justify-center text-base font-bold flex-shrink-0"
            style={{ backgroundColor: 'var(--cab-signal)' }}>
            {initials(sub.company?.name)}
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-900 tracking-tight truncate">{sub.company?.name || '—'}</h2>
            <p className="text-xs text-gray-500 mt-1 flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-gray-700">{isDemo ? 'Демо' : sub.subscription?.name || '—'}</span>
              <span className="text-gray-300">·</span>
              <span>{subline}</span>
              {dl != null && sub.end_date != null && (
                <>
                  <span className="text-gray-300">·</span>
                  <span className={st === 'expired' ? 'text-red-600 font-semibold' : st === 'expiring' ? 'text-amber-600 font-semibold' : ''}>
                    {dl === 0 ? 'сегодня' : `осталось ${dl} дн.`}
                  </span>
                </>
              )}
            </p>
          </div>
        </div>
        <span className={`${stStyle.cls} flex-shrink-0`}>{stStyle.label}</span>
      </div>

      {/* Лимиты */}
      {sub.subscription && (
        <div className="py-5 border-b border-gray-100">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-4">Лимиты</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {limits.map(([label, used, max]) => {
              const pct = max == null ? 8 : Math.min(100, Math.round((used / Math.max(1, max)) * 100))
              return (
                <div key={label}>
                  <div className="flex justify-between items-baseline mb-1.5">
                    <span className="text-[13px] font-semibold text-gray-700">{label}</span>
                    <span className="text-xs text-gray-500 tabular-nums">
                      <b className="text-gray-900">{used}</b> / {max ?? '∞'}
                    </span>
                  </div>
                  <div className="h-[7px] rounded-full bg-gray-100 overflow-hidden">
                    <span className="block h-full rounded-full transition-all" style={{ width: `${pct}%`, background: barColor(used, max) }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Сменить тариф */}
      <div className="py-5 border-b border-gray-100">
        <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-4">Сменить тариф</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
          {partsPlans.map(p => {
            const isCurrent = p.id === sub.subscription_id
            const isDraft = p.id === draftPlanId
            const free = p.price === 0
            return (
              <button key={p.id} type="button" onClick={() => onPickPlan(p.id)}
                className={`relative text-left rounded-xl border-[1.5px] p-3.5 transition-all ${
                  isDraft ? 'border-[color:var(--cab-signal)]' : 'border-gray-200 hover:border-gray-300'
                }`}
                style={isDraft ? { backgroundColor: 'var(--cab-signal-weak)' } : undefined}>
                {isCurrent && (
                  <span className="absolute top-2.5 right-2.5 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-white border"
                    style={{ color: 'var(--cab-signal)', borderColor: 'var(--brand-line, #C9CCF6)' }}>
                    Текущий
                  </span>
                )}
                <p className="text-[13.5px] font-bold text-gray-900">{p.name}</p>
                <p className="text-lg font-extrabold text-gray-900 mt-1.5 tabular-nums">
                  {p.price.toLocaleString()} ₴
                  <span className="text-xs font-medium text-gray-500"> {p.type === 'lifetime' ? '· навсегда' : free ? '' : '/мес'}</span>
                </p>
                <p className="text-[11.5px] text-gray-500 mt-1.5 leading-snug">
                  {p.max_parts ?? '∞'} запчастей · {p.max_vehicles ?? '∞'} авто · {p.max_workers ?? '∞'} сотр.
                </p>
              </button>
            )
          })}
        </div>

        {/* Срок + кнопка назначить */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {draftPlan(partsPlans, draftPlanId) && !draftTermless ? (
            <div className="inline-flex bg-gray-100 rounded-xl p-1">
              {DURATION_OPTIONS.map(opt => (
                <button key={opt.value} type="button" onClick={() => onPickMonths(opt.value)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
                    draftMonths === opt.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
                  }`}>
                  {opt.label}
                </button>
              ))}
            </div>
          ) : <span className="text-xs text-gray-500">{draftTermless ? 'Бессрочно — без даты окончания' : 'Выберите тариф'}</span>}

          <div className="flex items-center gap-4 ml-auto">
            {!draftTermless && draftTotal > 0 && (
              <span className="text-xs text-gray-500">Итого: <b className="text-sm text-gray-900 tabular-nums">{draftTotal.toLocaleString('ru-RU')} ₴</b></span>
            )}
            <button type="button" onClick={onAssign}
              disabled={!draftPlanId || assignPending}
              className="cab-btn cab-btn-primary cab-btn-sm">
              <Check className="w-4 h-4" />
              {assignPending ? 'Сохранение…' : changed ? 'Сменить тариф' : 'Назначить'}
            </button>
          </div>
        </div>
      </div>

      {/* Действия */}
      <div className="py-5 border-b border-gray-100">
        <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">Действия</p>
        <div className="flex gap-2.5 flex-wrap">
          <button type="button" onClick={onRenew} className="cab-btn cab-btn-secondary cab-btn-sm">
            <RotateCw className="w-4 h-4" /> Продлить
          </button>
          {sub.is_active && !isExpired(sub) && (
            <button type="button" onClick={onDeactivate} className="cab-btn cab-btn-secondary cab-btn-sm">
              <XCircle className="w-4 h-4" /> Деактивировать
            </button>
          )}
          <button type="button" onClick={onDelete} className="cab-btn cab-btn-danger cab-btn-sm">
            <Trash2 className="w-4 h-4" /> Удалить
          </button>
        </div>
      </div>

      {/* История платежей */}
      <div className="pt-5">
        <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">История платежей</p>
        {payments.length === 0 ? (
          <p className="text-sm text-gray-400 py-2">Платежей по этой компании пока нет</p>
        ) : (
          <div>
            {payments.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <CreditCard className="w-4 h-4 text-gray-500" strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-gray-700">{new Date(p.paid_at || p.created_at).toLocaleDateString('ru-RU')}</p>
                    <p className="text-[11.5px] text-gray-500 truncate">
                      {p.provider === 'manual' ? 'Вручную' : p.provider === 'liqpay' ? 'LiqPay' : p.provider}
                      {p.months ? ` · ${p.months} мес.` : ''}
                    </p>
                  </div>
                </div>
                <span className="text-[13.5px] font-bold tabular-nums flex-shrink-0">
                  {Math.round(p.amount).toLocaleString('ru-RU')} {p.currency === 'UAH' ? '₴' : p.currency}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// Маленький локальный хелпер: найти план по id в списке (для проверки выбора)
function draftPlan(list: Subscription[], id: string): Subscription | undefined {
  return list.find(p => p.id === id)
}

// ─── Renew / Activate Modal ───────────────────────────────────────────────────

function RenewModal({ sub, onClose, onConfirm, isPending }: { sub: CompanySubscription; onClose: () => void; onConfirm: (months: number) => void; isPending: boolean }) {
  const [months, setMonths] = useState(1)
  const base = sub.end_date && new Date(sub.end_date) > new Date() ? new Date(sub.end_date) : new Date()
  const preview = new Date(base); preview.setMonth(preview.getMonth() + months)
  const opts = [{ v: 1, l: '1 месяц' }, { v: 3, l: '3 месяца' }, { v: 6, l: '6 месяцев' }, { v: 12, l: '1 год' }]
  return (
    <Modal
      isOpen
      onClose={onClose}
      size="sm"
      title="Продление подписки"
      footer={
        <>
          <button onClick={onClose} className="cab-btn cab-btn-secondary flex-1">Отмена</button>
          <button onClick={() => onConfirm(months)} disabled={isPending} className="cab-btn cab-btn-primary flex-1">
            {isPending ? 'Сохранение…' : 'Продлить'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
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
    </Modal>
  )
}

// ─── Plan Edit Modal ──────────────────────────────────────────────────────────

import { supabase } from '@/lib/supabase'

function PlanEditModal({ plan, onClose, onSaved }: { plan: Subscription; onClose: () => void; onSaved: () => void }) {
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
      <label className="form-label">{label}</label>
      {hint && <p className="text-xs text-gray-500 mb-1">{hint}</p>}
      <input
        type={type}
        value={form[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        className="form-input"
      />
    </div>
  )

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="md"
      title={`Редактировать план: ${plan.name}`}
      footer={
        <>
          <button onClick={onClose} className="cab-btn cab-btn-secondary flex-1">Отмена</button>
          <button onClick={handleSave} disabled={saving || !form.name.trim() || !form.price} className="cab-btn cab-btn-primary flex-1">
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {field('Название', 'name')}
        {field('Описание', 'description')}
        {field('Цена (грн./мес)', 'price', 'number')}
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
            <p className="text-xs text-gray-500 mt-0.5">Включить модуль аналитики для этого тарифа</p>
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
        <p className="text-xs text-gray-500">
          Пустой лимит = без ограничения (например, тариф «Персональный»).
          Срок (месяц / год −15%) выбирается владельцем при оформлении.
        </p>
      </div>
    </Modal>
  )
}
