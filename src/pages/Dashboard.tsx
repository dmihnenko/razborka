import { useState } from 'react'
import { Spinner } from '@/components/ui/Spinner'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useUserProfile } from '@/hooks/useUserProfile'
import { 
  Plus,
  FileText,
  Package,
  Wrench,
  TrendingUp,
  Users,
  DollarSign,
  Trash2,
  ArrowRight,
  Car,
  Users as UsersIcon,
  Settings as SettingsIcon,
  CalendarDays
} from 'lucide-react'
import AppointmentModal from '@/components/appointments/AppointmentModal'
import StoAlerts from '@/components/dashboard/StoAlerts'
import { fetchStoAlerts } from '@/services/stoService'
import ContactsReminder from '@/components/dashboard/ContactsReminder'
import MyVehicles from './MyVehicles'
import WorkerDashboard from './WorkerDashboard'
import { useNavigate, Link } from 'react-router-dom'
import { fmtMoneyShort } from '@/utils/money'

export default function Dashboard() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const { data: profile } = useUserProfile()
  const navigate = useNavigate()

  // Проверяем активную роль для админа или primary роль
  const primaryRole = profile?.roles?.find((role: any) => role.is_primary)
  let activeRole = primaryRole?.name
  
  if (primaryRole?.name === 'admin') {
    activeRole = localStorage.getItem('activeRole') || 'user'
  }
  
  // Проверяем, является ли пользователь владельцем СТО
  const isStoOwner = profile?.roles?.some((r: any) => r.name === 'sto_owner')

  // Получаем детальную статистику по заявкам (хуки должны быть до ранних возвратов)
  const { data: appointmentsStats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-appointments-stats', profile?.sto_company_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select('id, status, parts_cost, total_work_cost, parts_paid, work_paid')
        .eq('sto_company_id', profile?.sto_company_id)
      
      if (error) throw error

      // Подсчитываем статистику
      const active = data?.filter(a => a.status !== 'archived' && a.status !== 'deleted') || []
      const scheduled = active.filter(a => a.status === 'scheduled')
      const inProgress = active.filter(a => a.status === 'in_progress')
      const ready = active.filter(a => a.status === 'ready' || a.status === 'completed')
      
      // Неоплаченные
      const unpaid = active.filter(a => {
        const hasParts = (a.parts_cost || 0) > 0
        const hasWork = (a.total_work_cost || 0) > 0
        return (hasParts && !a.parts_paid) || (hasWork && !a.work_paid)
      })

      return {
        total: active.length,
        scheduled: scheduled.length,
        inProgress: inProgress.length,
        ready: ready.length,
        unpaid: unpaid.length
      }
    },
    enabled: !!profile?.sto_company_id,
  })

  // Получаем статистику текущего месяца (доход)
  const { data: monthlyStats, isLoading: monthlyLoading } = useQuery({
    queryKey: ['dashboard-monthly-revenue', profile?.sto_company_id],
    queryFn: async () => {
      const now = new Date()
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)

      const { data, error } = await supabase
        .from('appointments')
        .select('parts_cost, total_work_cost, exclude_from_stats')
        .eq('sto_company_id', profile?.sto_company_id)
        .eq('status', 'archived')
        .eq('exclude_from_stats', false)
        .gte('closed_date', firstDay.toISOString())
        .lt('closed_date', nextMonth.toISOString())
      
      if (error) throw error

      const totalParts = data?.reduce((sum, app) => sum + (app.parts_cost || 0), 0) || 0
      const totalWork = data?.reduce((sum, app) => sum + (app.total_work_cost || 0), 0) || 0

      return {
        parts: Math.round(totalParts),
        work: Math.round(totalWork),
        total: Math.round(totalParts + totalWork),
        count: data?.length || 0
      }
    },
    enabled: !!profile?.sto_company_id,
  })


  // Последние заявки для дашборда
  const { data: recentAppointments = [] } = useQuery({
    queryKey: ['dashboard-recent-appointments', profile?.sto_company_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select('id, status, created_at, customers(name), vehicles(brand, model)')
        .eq('sto_company_id', profile?.sto_company_id)
        .not('status', 'in', '(archived,deleted)')
        .order('created_at', { ascending: false })
        .limit(5)
      if (error) throw error
      return data ?? []
    },
    enabled: !!profile?.sto_company_id,
  })

  // Получаем заявки с запросом на удаление
  const { data: pendingDeletionAppointments = [] } = useQuery({
    queryKey: ['dashboard-pending-deletion', profile?.sto_company_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select('id, customers(name), vehicles(brand, model)')
        .eq('sto_company_id', profile?.sto_company_id)
        .eq('status', 'pending_deletion')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    enabled: !!profile?.sto_company_id && !!isStoOwner,
  })

  // Записи на сегодня
  const { data: todayAppointments = [] } = useQuery({
    queryKey: ['dashboard-today', profile?.sto_company_id],
    queryFn: async () => {
      const pad = (n: number) => String(n).padStart(2, '0')
      const d0 = new Date()
      const today = `${d0.getFullYear()}-${pad(d0.getMonth() + 1)}-${pad(d0.getDate())}`
      const dN = new Date(); dN.setDate(dN.getDate() + 1)
      const next = `${dN.getFullYear()}-${pad(dN.getMonth() + 1)}-${pad(dN.getDate())}`
      const { data, error } = await supabase
        .from('appointments')
        .select('id, status, scheduled_date, customers(name), vehicles(brand, model)')
        .eq('sto_company_id', profile?.sto_company_id)
        .gte('scheduled_date', `${today}T00:00`)
        .lt('scheduled_date', `${next}T00:00`)
        .not('status', 'in', '(archived,deleted,cancelled,pending_deletion)')
        .order('scheduled_date', { ascending: true })
      if (error) throw error
      return (data ?? []).filter((a: any) => String(a.scheduled_date || '').startsWith(today))
    },
    enabled: !!profile?.sto_company_id && !!isStoOwner,
  })

  // Алерты дашборда — грузим вместе с остальным, чтобы не подгружались с запозданием
  const { data: alertsData, isLoading: alertsLoading } = useQuery({
    queryKey: ['sto-alerts', profile?.sto_company_id],
    queryFn: () => fetchStoAlerts(profile!.sto_company_id!),
    enabled: !!profile?.sto_company_id && !!isStoOwner,
    staleTime: 60_000,
  })

  // Ранние возвраты — после всех хуков
  if (activeRole === 'user') return <MyVehicles />
  if (!isStoOwner) return <WorkerDashboard />

  const activeCount = appointmentsStats?.total || 0
  const scheduledCount = appointmentsStats?.scheduled || 0
  const inProgressCount = appointmentsStats?.inProgress || 0
  const readyCount = appointmentsStats?.ready || 0
  const unpaidCount = appointmentsStats?.unpaid || 0

  const partsCost = monthlyStats?.parts || 0
  const workCost = monthlyStats?.work || 0
  const totalCost = monthlyStats?.total || 0
  const completedCount = monthlyStats?.count || 0

  const isLoading = statsLoading || monthlyLoading || alertsLoading

  // Приветствие + дата
  const hour = new Date().getHours()
  const greeting = hour < 6 ? 'Доброй ночи' : hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер'
  const ownerName = (profile?.full_name || '').trim().split(/\s+/)[0] || ''
  const todayStr = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })
  const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
    scheduled: { label: 'Ожидает', cls: 'bg-violet-100 text-violet-700' },
    in_progress: { label: 'В работе', cls: 'bg-amber-100 text-amber-700' },
    ready: { label: 'Готово', cls: 'bg-green-100 text-green-700' },
    completed: { label: 'Завершена', cls: 'bg-green-100 text-green-700' },
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Хедер страницы — стиль как в разборке */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{greeting}{ownerName ? `, ${ownerName}` : ''}</h1>
          <p className="text-sm text-gray-500 mt-0.5 capitalize">{todayStr}</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button onClick={() => navigate('/customers')}
            className="btn-secondary btn-sm hidden sm:flex items-center gap-1.5">
            <Users className="w-4 h-4" />
            <span>Клиенты</span>
          </button>
          <button onClick={() => navigate('/vehicles')}
            className="btn-secondary btn-sm hidden sm:flex items-center gap-1.5">
            <Car className="w-4 h-4" />
            <span>Авто</span>
          </button>
          <button onClick={() => navigate('/appointments?view=week')}
            className="btn-secondary btn-sm flex items-center gap-1.5">
            <CalendarDays className="w-4 h-4" />
            <span className="hidden sm:inline">Записи</span>
          </button>
          <button onClick={() => setIsModalOpen(true)}
            className="btn-primary btn-sm flex items-center gap-1.5">
            <Plus className="w-4 h-4" />
            <span>Новая запись</span>
          </button>
        </div>
      </div>

      {/* Напоминание заполнить контакты СТО */}
      <ContactsReminder kind="sto" companyId={profile?.sto_company_id} />

      {/* Уведомления: готовые без оплаты + записи на завтра */}
      {!isLoading && <StoAlerts data={alertsData} />}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : (
        <div className="space-y-4 sm:space-y-6">
          {/* Компактные KPI */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {[
              { label: 'Активные', value: activeCount, color: 'text-blue-600', path: '/appointments' },
              { label: 'Ожидают', value: scheduledCount, color: 'text-violet-600', path: '/appointments?tab=scheduled' },
              { label: 'В работе', value: inProgressCount, color: 'text-amber-600', path: '/appointments?tab=in_progress' },
              { label: 'Готовые', value: readyCount, color: 'text-green-600', path: '/appointments?tab=completed' },
              { label: 'Неоплачено', value: unpaidCount, color: unpaidCount > 0 ? 'text-red-600' : 'text-gray-400', path: '/appointments' },
              { label: 'Доход/мес', value: fmtMoneyShort(totalCost), color: 'text-blue-700', path: `/monthly-revenue?year=${new Date().getFullYear()}&month=${new Date().getMonth() + 1}` },
            ].map(k => (
              <button key={k.label} onClick={() => navigate(k.path)}
                className="bg-white rounded-xl border border-gray-100 shadow-sm px-3 py-3 text-left hover:shadow-md transition-shadow">
                <p className="text-[11px] text-gray-500 leading-none mb-1 truncate">{k.label}</p>
                <p className={`text-lg sm:text-xl font-bold tabular-nums leading-none ${k.color}`}>{k.value}</p>
              </button>
            ))}
          </div>

          {/* Сегодня */}
          <div className="card p-0 overflow-hidden">
            <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #F1F5F9' }}>
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-primary" />
                <p className="text-sm font-semibold text-gray-800">Сегодня</p>
                <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full font-medium">{todayAppointments.length}</span>
              </div>
              <button onClick={() => navigate('/appointments?view=week')} className="text-xs font-medium flex items-center gap-1" style={{ color: '#2563EB' }}>
                Календарь <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            {todayAppointments.length > 0 ? (
              <div className="divide-y divide-gray-50">
                {todayAppointments.map((a: any) => {
                  const b = STATUS_BADGE[a.status] || { label: a.status, cls: 'bg-gray-100 text-gray-600' }
                  const time = (String(a.scheduled_date || '').match(/T(\d{2}:\d{2})/) || [])[1] || ''
                  return (
                    <button key={a.id} onClick={() => navigate(`/sto/appointments/${a.id}`)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left">
                      {time && <span className="text-sm font-bold tabular-nums text-gray-900 w-12 flex-shrink-0">{time}</span>}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{a.customers?.name || 'Клиент'}</p>
                        {a.vehicles && <p className="text-xs text-gray-500 truncate">{a.vehicles.brand} {a.vehicles.model}</p>}
                      </div>
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md flex-shrink-0 ${b.cls}`}>{b.label}</span>
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="py-8 text-center">
                <p className="text-sm text-gray-400">Сегодня записей нет</p>
              </div>
            )}
          </div>

          {/* Алерты и информация */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            {/* Заявки на удаление */}
            {pendingDeletionAppointments.length > 0 && (
              <div className="card-mobile bg-red-50 border-2 border-red-300 md:col-span-2">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-red-100 flex-shrink-0">
                    <Trash2 className="w-5 h-5 text-red-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-mobile-base font-semibold text-red-900 mb-2">
                      🗑️ Запросы на удаление ({pendingDeletionAppointments.length})
                    </p>
                    <div className="space-y-1.5">
                      {pendingDeletionAppointments.map((appt: any) => (
                        <Link
                          key={appt.id}
                          to={`/sto/appointments/${appt.id}`}
                          className="flex items-center justify-between p-2 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                        >
                          <span className="text-sm text-gray-800">
                            {appt.customers?.name || 'Клиент не указан'}
                            {appt.vehicles ? ` — ${appt.vehicles.brand} ${appt.vehicles.model}` : ''}
                          </span>
                          <span className="text-xs text-red-600 font-medium ml-2 flex-shrink-0">Подтвердить →</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}



          </div>

          {/* ── Нижний блок: разбивка + управление + последние заявки ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Левая колонка (2/3) */}
            <div className="lg:col-span-2 space-y-4">

              {/* Финансовая разбивка месяца */}
              <div className="card p-0 overflow-hidden">
                <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <p className="text-sm font-semibold text-gray-800">Доход за месяц</p>
                  <button onClick={() => navigate('/statistics')} className="text-xs font-medium flex items-center gap-1" style={{ color: '#2563EB' }}>
                    Подробнее <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-3 divide-x">
                  {[
                    { label: 'Запчасти', value: partsCost, color: '#16A34A', bg: 'rgba(22,163,74,0.1)', icon: Package },
                    { label: 'Работы', value: workCost, color: '#7C3AED', bg: 'rgba(124,58,237,0.1)', icon: Wrench },
                    { label: 'Итого', value: totalCost, color: '#2563EB', bg: 'rgba(37,99,235,0.1)', icon: DollarSign },
                  ].map(({ label, value, color, bg, icon: Icon }) => (
                    <div key={label} className="px-4 py-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ backgroundColor: bg }}>
                          <Icon className="w-3.5 h-3.5" style={{ color }} />
                        </div>
                        <span className="text-xs font-medium" style={{ color: '#64748B' }}>{label}</span>
                      </div>
                      <p className="text-xl font-bold text-gray-900" style={{ letterSpacing: '-0.02em' }}>
                        {value >= 1000 ? Math.round(value/1000) + "к" : value} ₴
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>закрыто: {completedCount}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Быстрые ссылки */}
              <div className="card p-0 overflow-hidden">
                <div className="px-4 py-3" style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <p className="text-sm font-semibold text-gray-800">Управление</p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5">
                  {[
                    { label: 'Клиенты', icon: Users, path: '/customers', color: '#2563EB', bg: 'rgba(37,99,235,0.09)' },
                    { label: 'Автомобили', icon: Car, path: '/vehicles', color: '#D97706', bg: 'rgba(217,119,6,0.09)' },
                    { label: 'Сотрудники', icon: UsersIcon, path: '/sto/employees', color: '#16A34A', bg: 'rgba(22,163,74,0.09)' },
                    { label: 'Аналитика', icon: TrendingUp, path: '/analytics', color: '#7C3AED', bg: 'rgba(124,58,237,0.09)' },
                    { label: 'Настройки', icon: SettingsIcon, path: '/sto/settings', color: '#475569', bg: 'rgba(71,85,105,0.09)' },
                  ].map(({ label, icon: Icon, path, color, bg }) => (
                    <button key={path} onClick={() => navigate(path)}
                      className="flex flex-col items-center gap-2 py-5 px-3 hover:bg-gray-50 transition-colors group"
                      style={{ borderRight: '1px solid #F1F5F9' }}>
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105" style={{ backgroundColor: bg }}>
                        <Icon className="w-5 h-5" style={{ color }} />
                      </div>
                      <span className="text-xs font-medium text-gray-600">{label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Правая колонка: последние заявки */}
            <div className="card p-0 overflow-hidden flex flex-col">
              <div className="px-4 py-3 flex items-center justify-between flex-shrink-0" style={{ borderBottom: '1px solid #F1F5F9' }}>
                <p className="text-sm font-semibold text-gray-800">Последние заявки</p>
                <button onClick={() => navigate('/appointments')} className="text-xs font-medium flex items-center gap-1" style={{ color: '#2563EB' }}>
                  Все <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {recentAppointments.length > 0 ? (
                <div className="flex-1 overflow-auto divide-y">
                  {recentAppointments.map((appt: any) => (
                    <button key={appt.id} onClick={() => navigate('/sto/appointments/' + appt.id)}
                      className="w-full px-4 py-3 hover:bg-gray-50 transition-colors text-left">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span className="text-sm font-semibold text-gray-900 truncate">{appt.customers?.name || 'Клиент'}</span>
                        <span className="text-xs font-semibold px-1.5 py-0.5 rounded flex-shrink-0" style={{
                          backgroundColor: appt.status === 'ready' ? 'rgba(22,163,74,0.1)' : appt.status === 'in_progress' ? 'rgba(217,119,6,0.1)' : 'rgba(124,58,237,0.1)',
                          color: appt.status === 'ready' ? '#16A34A' : appt.status === 'in_progress' ? '#D97706' : '#7C3AED'
                        }}>
                          {appt.status === 'scheduled' ? 'Ожидает' : appt.status === 'in_progress' ? 'В работе' : appt.status === 'ready' ? 'Готово' : appt.status}
                        </span>
                      </div>
                      {appt.vehicles && (
                        <p className="text-xs truncate" style={{ color: '#64748B' }}>{appt.vehicles.brand} {appt.vehicles.model}</p>
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center py-10 px-4 text-center">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3" style={{ backgroundColor: '#F1F5F9' }}>
                    <FileText className="w-6 h-6" style={{ color: '#94A3B8' }} />
                  </div>
                  <p className="text-sm font-medium text-gray-600">Нет заявок</p>
                </div>
              )}

            </div>
          </div>

        </div>
      )}

      {/* Модальное окно для создания новой записи */}
      <AppointmentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />

    </div>
  )
}
