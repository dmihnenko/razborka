import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell,
} from 'recharts'
import { Users, ClipboardList, ShoppingCart } from 'lucide-react'
import { fetchPlatformAnalytics } from '@/services/adminAnalyticsService'
import { getAdminStats } from '@/services/adminService'
import StatCard from '@/components/admin/StatCard'

const RANGES = [
  { id: 3, label: '3 мес' },
  { id: 6, label: '6 мес' },
  { id: 12, label: '12 мес' },
] as const

const PIE_COLORS = ['#6366F1', '#2563EB', '#F59E0B', '#10B981', '#EC4899', '#8B5CF6', '#64748B', '#06B6D4']

export default function AdminAnalytics() {
  const [months, setMonths] = useState<number>(6)

  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    staleTime: 2 * 60 * 1000,
    queryFn: () => getAdminStats(),
  })

  const { data, isLoading } = useQuery({
    queryKey: ['admin-analytics', months],
    staleTime: 5 * 60 * 1000,
    queryFn: () => fetchPlatformAnalytics(months),
  })

  return (
    <div className="space-y-5">
      {/* Заголовок + диапазон */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Аналитика платформы</h1>
          <p className="text-xs text-gray-400 mt-0.5">Динамика за выбранный период</p>
        </div>
        <div className="flex gap-1.5">
          {RANGES.map(r => (
            <button key={r.id} onClick={() => setMonths(r.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${months === r.id ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI за период */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <StatCard label="Новых пользователей" value={data?.totals.users ?? '—'} icon={Users} color="indigo" loading={isLoading} />
        <StatCard label="Заявок создано" value={data?.totals.appointments ?? '—'} icon={ClipboardList} color="blue" loading={isLoading} />
        <StatCard label="Заказов запчастей" value={data?.totals.orders ?? '—'} icon={ShoppingCart} color="orange" loading={isLoading} />
      </div>

      {/* График динамики */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
        <h2 className="text-sm font-bold text-gray-800 mb-3">Динамика по месяцам</h2>
        {isLoading ? (
          <div className="h-64 bg-gray-50 rounded-xl animate-pulse" />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data?.series || []} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0', fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="users" name="Пользователи" stroke="#6366F1" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="appointments" name="Заявки" stroke="#2563EB" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="orders" name="Заказы" stroke="#F59E0B" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Распределение по ролям + сводка компаний */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
          <h2 className="text-sm font-bold text-gray-800 mb-3">Пользователи по ролям</h2>
          {isLoading ? (
            <div className="h-56 bg-gray-50 rounded-xl animate-pulse" />
          ) : (data?.roles?.length ? (
            <ResponsiveContainer width="100%" height={224}>
              <PieChart>
                <Pie data={data.roles} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={45} paddingAngle={2}>
                  {data.roles.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-gray-400 py-16 text-center">Нет данных</p>)}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
          <h2 className="text-sm font-bold text-gray-800 mb-3">Сводка</h2>
          <dl className="divide-y divide-gray-100 text-sm">
            <Row label="Всего пользователей" value={stats?.users} />
            <Row label="Активных" value={stats?.activeUsers} />
            <Row label="Компаний СТО" value={stats?.stoCompanies} />
            <Row label="Разборок" value={stats?.partsCompanies} />
            <Row label="Активных подписок" value={stats?.subscriptions} />
            <Row label="Открытых обращений" value={stats?.openTickets} />
          </dl>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-bold text-gray-900">{value ?? '—'}</dd>
    </div>
  )
}
