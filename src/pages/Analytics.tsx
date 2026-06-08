import { useQuery } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, PieChart, Pie, Cell
} from 'recharts'
import { TrendingUp, Calendar, CheckCircle, Clock, XCircle, Wrench, CreditCard, AlertCircle, Users, BarChart2, ArrowRight } from 'lucide-react'
import { useUserProfile } from '@/hooks/useUserProfile'
import { fetchStoEmployees } from '@/services/stoService'

const DOW = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

const MONTH_NAMES = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек']

function fmt(n: number) {
  if (n >= 1_000_000) return `₴${(n / 1_000_000).toFixed(1)}М`
  if (n >= 1_000) return `₴${(n / 1_000).toFixed(1)}к`
  return `₴${n}`
}

const PERIOD_OPTIONS = [
  { label: '1 мес', months: 1 },
  { label: '3 мес', months: 3 },
  { label: '6 мес', months: 6 },
  { label: '12 мес', months: 12 },
]

export default function Analytics() {
  const { data: profile } = useUserProfile()
  const navigate = useNavigate()
  const [period, setPeriod] = useState(6)

  const { data: monthlyStats } = useQuery({
    queryKey: ['analytics-monthly-stats', profile?.sto_company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('appointments')
        .select('closed_date, parts_cost, total_parts_cost, total_work_cost, parts_paid, work_paid')
        .eq('sto_company_id', profile?.sto_company_id)
        .eq('status', 'archived')
        .not('closed_date', 'is', null)
        .order('closed_date', { ascending: true })

      if (!data || data.length === 0) return []

      const monthlyData: Record<string, {
        count: number; parts: number; work: number; total: number
        partsPaid: number; workPaid: number; totalPaid: number
      }> = {}

      data.forEach((a: any) => {
        const date = new Date(a.closed_date)
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        if (!monthlyData[key]) monthlyData[key] = { count: 0, parts: 0, work: 0, total: 0, partsPaid: 0, workPaid: 0, totalPaid: 0 }
        const parts = (a.parts_cost || a.total_parts_cost) || 0
        const work = a.total_work_cost || 0
        monthlyData[key].count++
        monthlyData[key].parts += parts
        monthlyData[key].work += work
        monthlyData[key].total += parts + work
        if (a.parts_paid) { monthlyData[key].partsPaid += parts; monthlyData[key].totalPaid += parts }
        if (a.work_paid) { monthlyData[key].workPaid += work; monthlyData[key].totalPaid += work }
      })

      return Object.entries(monthlyData)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-12)
        .map(([month, s]) => {
          const [year, mNum] = month.split('-')
          return {
            month: `${MONTH_NAMES[parseInt(mNum) - 1]} ${year.slice(2)}`,
            count: s.count,
            parts: Math.round(s.parts),
            work: Math.round(s.work),
            total: Math.round(s.total),
            totalPaid: Math.round(s.totalPaid),
            unpaid: Math.round(s.total - s.totalPaid),
          }
        })
    },
    enabled: !!profile?.sto_company_id,
  })

  const { data: overallStats } = useQuery({
    queryKey: ['analytics-overall-stats', profile?.sto_company_id],
    queryFn: async () => {
      const { data: all } = await supabase
        .from('appointments')
        .select('status, parts_cost, total_parts_cost, total_work_cost, parts_paid, work_paid, closed_date, created_at')
        .eq('sto_company_id', profile?.sto_company_id)
        .not('status', 'in', '(pending_deletion,deleted)')

      if (!all) return null

      const completed = all.filter(a => a.status === 'archived')
      const inProgress = all.filter(a => a.status === 'in_progress')
      const scheduled = all.filter(a => a.status === 'scheduled')
      const cancelled = all.filter(a => a.status === 'cancelled')

      const totalParts = completed.reduce((s, a) => s + ((a.parts_cost || a.total_parts_cost) || 0), 0)
      const totalWork = completed.reduce((s, a) => s + (a.total_work_cost || 0), 0)
      const totalRevenue = totalWork
      const paidParts = completed.reduce((s, a) => s + (a.parts_paid ? ((a.parts_cost || a.total_parts_cost) || 0) : 0), 0)
      const paidWork = completed.reduce((s, a) => s + (a.work_paid ? (a.total_work_cost || 0) : 0), 0)
      const paidRevenue = paidWork
      const avgCheck = completed.length > 0 ? totalRevenue / completed.length : 0
      const withDates = completed.filter(a => a.closed_date && a.created_at)
      const avgDays = withDates.length > 0
        ? withDates.reduce((s, a) => s + (new Date(a.closed_date!).getTime() - new Date(a.created_at).getTime()) / 86400000, 0) / withDates.length
        : 0

      return {
        total: all.length, completed: completed.length,
        inProgress: inProgress.length, scheduled: scheduled.length, cancelled: cancelled.length,
        totalRevenue: Math.round(totalRevenue), paidRevenue: Math.round(paidRevenue),
        unpaidRevenue: Math.round(totalRevenue - paidRevenue),
        totalParts: Math.round(totalParts), paidParts: Math.round(paidParts),
        totalWork: Math.round(totalWork), paidWork: Math.round(paidWork),
        avgCheck: Math.round(avgCheck), avgDays: Math.round(avgDays * 10) / 10,
      }
    },
    enabled: !!profile?.sto_company_id,
  })

  const { data: employees = [] } = useQuery({
    queryKey: ['sto_employees', profile?.sto_company_id],
    queryFn: () => fetchStoEmployees(profile!.sto_company_id!),
    enabled: !!profile?.sto_company_id,
  })

  const { data: apptsRaw = [] } = useQuery({
    queryKey: ['analytics-appts', profile?.sto_company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('appointments')
        .select('assigned_to, total_work_cost, status, closed_date, completed_at, scheduled_date')
        .eq('sto_company_id', profile?.sto_company_id)
        .not('status', 'in', '(pending_deletion,deleted)')
      return (data || []) as any[]
    },
    enabled: !!profile?.sto_company_id,
  })

  const nameById = useMemo(() => {
    const m: Record<string, string> = {}
    for (const e of employees) m[e.id] = e.full_name || e.username || 'Мастер'
    return m
  }, [employees])

  const { byMaster, byDow } = useMemo(() => {
    const now = new Date()
    const cutoff = new Date(now.getFullYear(), now.getMonth() - (period - 1), 1)
    const masters: Record<string, { count: number; work: number }> = {}
    const dow = Array.from({ length: 7 }, () => 0)
    for (const a of apptsRaw) {
      if (a.scheduled_date) {
        const d = new Date(a.scheduled_date)
        if (!isNaN(d.getTime()) && d >= cutoff) dow[(d.getDay() + 6) % 7] += 1
      }
      if ((a.status === 'archived' || a.status === 'completed') && a.assigned_to) {
        const ds = a.closed_date || a.completed_at || a.scheduled_date
        const d = ds ? new Date(ds) : null
        if (d && !isNaN(d.getTime()) && d >= cutoff) {
          const s = masters[a.assigned_to] || (masters[a.assigned_to] = { count: 0, work: 0 })
          s.count += 1
          s.work += Number(a.total_work_cost) || 0
        }
      }
    }
    const byMaster = Object.entries(masters)
      .map(([id, s]) => ({ id, name: nameById[id] || 'Мастер', count: s.count, work: Math.round(s.work) }))
      .sort((a, b) => b.work - a.work)
    const byDow = DOW.map((label, i) => ({ day: label, count: dow[i] }))
    return { byMaster, byDow }
  }, [apptsRaw, period, nameById])

  const maxMasterWork = byMaster.reduce((m, x) => Math.max(m, x.work), 0) || 1

  const slicedMonthly = monthlyStats ? monthlyStats.slice(-period) : []

  const statusPie = overallStats ? [
    { name: 'Завершено', value: overallStats.completed, color: '#10b981' },
    { name: 'В работе', value: overallStats.inProgress, color: '#3b82f6' },
    { name: 'Запланировано', value: overallStats.scheduled, color: '#f59e0b' },
    { name: 'Отменено', value: overallStats.cancelled, color: '#ef4444' },
  ].filter(i => i.value > 0) : []

  const kpiCards = [
    { label: 'Всего заявок', value: overallStats?.total ?? '—', icon: Calendar, accent: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Завершено', value: overallStats?.completed ?? '—', icon: CheckCircle, accent: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'В работе', value: overallStats?.inProgress ?? '—', icon: Wrench, accent: 'text-orange-500', bg: 'bg-orange-50' },
    { label: 'Запланировано', value: overallStats?.scheduled ?? '—', icon: Clock, accent: 'text-sky-600', bg: 'bg-sky-50' },
    { label: 'Отменено', value: overallStats?.cancelled ?? '—', icon: XCircle, accent: 'text-red-500', bg: 'bg-red-50' },
    { label: 'Доход (работы)', value: overallStats ? fmt(overallStats.totalWork) : '—', icon: TrendingUp, accent: 'text-violet-600', bg: 'bg-violet-50' },
    { label: 'Доход (запчасти)', value: overallStats ? fmt(overallStats.totalParts) : '—', icon: TrendingUp, accent: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Оплачено', value: overallStats ? fmt(overallStats.paidRevenue) : '—', icon: CreditCard, accent: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'К оплате', value: overallStats ? fmt(overallStats.unpaidRevenue) : '—', icon: AlertCircle, accent: 'text-red-500', bg: 'bg-red-50' },
    { label: 'Средний чек', value: overallStats ? fmt(overallStats.avgCheck) : '—', icon: TrendingUp, accent: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Среднее время', value: overallStats ? `${overallStats.avgDays}д` : '—', icon: Clock, accent: 'text-slate-600', bg: 'bg-slate-50' },
  ]

  const CustomTooltipUAH = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-white border border-gray-200 rounded shadow-md p-2 text-xs">
        <p className="font-semibold text-gray-700 mb-1">{label}</p>
        {payload.map((p: any) => (
          <p key={p.name} style={{ color: p.color }}>{p.name}: {fmt(p.value)}</p>
        ))}
      </div>
    )
  }

  const CustomTooltipCount = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-white border border-gray-200 rounded shadow-md p-2 text-xs">
        <p className="font-semibold text-gray-700 mb-1">{label}</p>
        {payload.map((p: any) => (
          <p key={p.name} style={{ color: p.color }}>{p.name}: {p.value}</p>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-gray-900">Аналитика</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/statistics')}
            className="btn-secondary btn-sm flex items-center gap-1.5"
          >
            <BarChart2 className="w-4 h-4" /> <span className="hidden sm:inline">Помесячно</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {PERIOD_OPTIONS.map(opt => (
              <button
                key={opt.months}
                onClick={() => setPeriod(opt.months)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  period === opt.months
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-6 gap-2">
        {kpiCards.map(card => {
          const Icon = card.icon
          return (
            <div key={card.label} className="bg-white rounded-lg border border-gray-100 shadow-sm px-3 py-2.5 flex items-center gap-2.5">
              <div className={`${card.bg} rounded-md p-1.5 flex-shrink-0`}>
                <Icon className={`w-4 h-4 ${card.accent}`} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-gray-500 leading-none mb-0.5 truncate">{card.label}</p>
                <p className={`text-sm font-bold ${card.accent} leading-tight`}>{card.value}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Charts row 1: revenue line + bar count */}
      {slicedMonthly.length > 0 ? (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {/* Revenue line chart — spans 2 cols */}
            <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-4 lg:col-span-2">
              <p className="text-xs font-semibold text-gray-700 mb-3">Доходы по месяцам</p>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={slicedMonthly} margin={{ top: 2, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}к` : v} tick={{ fontSize: 10 }} width={36} />
                  <Tooltip content={<CustomTooltipUAH />} />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="parts" stroke="#f59e0b" strokeWidth={2} dot={false} name="Запчасти" />
                  <Line type="monotone" dataKey="work" stroke="#10b981" strokeWidth={2} dot={false} name="Работы" />
                  <Line type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2.5} dot={false} name="Итого" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Closed per month bar */}
            <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-4">
              <p className="text-xs font-semibold text-gray-700 mb-3">Закрытых заявок / мес</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={slicedMonthly} margin={{ top: 2, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={24} />
                  <Tooltip content={<CustomTooltipCount />} />
                  <Bar dataKey="count" fill="#3b82f6" name="Заявок" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Charts row 2: payment bar + status pie + payment progress */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {/* Paid vs unpaid bar */}
            <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-4 lg:col-span-2">
              <p className="text-xs font-semibold text-gray-700 mb-3">Начислено / Оплачено / Долг</p>
              <ResponsiveContainer width="100%" height={190}>
                <BarChart data={slicedMonthly} margin={{ top: 2, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}к` : v} tick={{ fontSize: 10 }} width={36} />
                  <Tooltip content={<CustomTooltipUAH />} />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="total" fill="#93c5fd" name="Начислено" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="totalPaid" fill="#10b981" name="Оплачено" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="unpaid" fill="#fca5a5" name="Долг" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Status distribution + payment % */}
            <div className="flex flex-col gap-3">
              {/* Pie chart */}
              {statusPie.length > 0 && (
                <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-4 flex-1">
                  <p className="text-xs font-semibold text-gray-700 mb-2">Статусы заявок</p>
                  <div className="flex items-center gap-2">
                    <ResponsiveContainer width="50%" height={110}>
                      <PieChart>
                        <Pie data={statusPie} cx="50%" cy="50%" innerRadius={28} outerRadius={48} dataKey="value" strokeWidth={0}>
                          {statusPie.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                        </Pie>
                        <Tooltip formatter={(v, n) => [v, n]} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-col gap-1 text-[11px]">
                      {statusPie.map(item => (
                        <div key={item.name} className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: item.color }} />
                          <span className="text-gray-600">{item.name}</span>
                          <span className="font-semibold text-gray-800 ml-auto pl-2">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Payment % progress */}
              {overallStats && (overallStats.totalRevenue > 0 || overallStats.totalParts > 0) && (
                <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-4">
                  <p className="text-xs font-semibold text-gray-700 mb-3">Статус оплаты</p>
                  <div className="flex flex-col gap-2.5">
                    {[
                      { label: 'Работы', paid: overallStats.paidWork, total: overallStats.totalWork, color: 'bg-emerald-500' },
                      { label: 'Запчасти', paid: overallStats.paidParts, total: overallStats.totalParts, color: 'bg-amber-400' },
                    ].filter(r => r.total > 0).map(row => {
                      const pct = Math.round((row.paid / row.total) * 100)
                      return (
                        <div key={row.label}>
                          <div className="flex justify-between text-[11px] text-gray-600 mb-0.5">
                            <span className="font-medium">{row.label}</span>
                            <span className="font-semibold">{pct}% · {fmt(row.paid)} / {fmt(row.total)}</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-1.5">
                            <div className={`${row.color} h-1.5 rounded-full transition-all`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-6 text-center">
          <p className="text-sm text-gray-500">Недостаточно данных. Закройте несколько заявок для получения статистики.</p>
        </div>
      )}

      {/* По мастерам + загруженность по дням недели */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* По мастерам */}
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-4">
          <p className="text-xs font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-gray-400" /> По мастерам (закрыто заявок / заработано)
          </p>
          {byMaster.length === 0 ? (
            <p className="text-xs text-gray-400 py-6 text-center">Нет данных за период</p>
          ) : (
            <div className="space-y-2.5">
              {byMaster.map(m => (
                <div key={m.id}>
                  <div className="flex justify-between text-[11px] text-gray-600 mb-0.5">
                    <span className="font-medium truncate mr-2">{m.name}</span>
                    <span className="font-semibold whitespace-nowrap">{m.count} зв · {fmt(m.work)}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div className="bg-violet-500 h-1.5 rounded-full" style={{ width: `${Math.round((m.work / maxMasterWork) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Загруженность по дням недели */}
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-4">
          <p className="text-xs font-semibold text-gray-700 mb-3">Загруженность по дням недели</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={byDow} margin={{ top: 2, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={24} />
              <Tooltip content={<CustomTooltipCount />} />
              <Bar dataKey="count" fill="#6366f1" name="Записей" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
