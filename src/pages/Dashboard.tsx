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
  Clock, 
  CheckCircle,
  AlertCircle,
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
import MyVehicles from './MyVehicles'
import WorkerDashboard from './WorkerDashboard'
import { useNavigate, Link } from 'react-router-dom'
import { fetchStoClientStats } from '@/services/stoService'

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

  // Получаем количество работников
  const { data: workersCount = 0, isLoading: workersLoading } = useQuery({
    queryKey: ['dashboard-workers-count', profile?.sto_company_id],
    queryFn: async () => {
      const { data: workerRole, error: roleError } = await supabase
        .from('roles')
        .select('id')
        .eq('name', 'sto_worker')
        .single()

      if (roleError) throw roleError
      if (!workerRole) return 0

      const { data: userRoles, error: userRolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role_id', workerRole.id)

      if (userRolesError) throw userRolesError
      if (!userRoles) return 0

      const { count, error: countError } = await supabase
        .from('user_profiles')
        .select('id', { count: 'exact', head: true })
        .eq('sto_company_id', profile?.sto_company_id)
        .eq('is_active', true)
        .in('id', userRoles.map(ur => ur.user_id))

      if (countError) throw countError
      return count || 0
    },
    enabled: !!profile?.sto_company_id,
  })

  // Статистика клиентов и автомобилей
  const { data: clientsStats } = useQuery({
    queryKey: ['dashboard-clients-stats', profile?.sto_company_id],
    queryFn: () => fetchStoClientStats(profile!.sto_company_id!),
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

  const isLoading = statsLoading || monthlyLoading || workersLoading

  // Получаем название текущего месяца
  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Хедер страницы — стиль как в разборке */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900" style={{ letterSpacing: '-0.025em', lineHeight: 1.2 }}>
            СТО
          </h1>
          <p className="text-sm mt-0.5" style={{ color: '#64748B' }}>Управление сервисом и заявками</p>
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

      {/* Алерт о неоплаченных */}
      {!isLoading && unpaidCount > 0 && (
        <button onClick={() => navigate('/appointments')}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all"
          style={{ backgroundColor: 'rgba(220,38,38,0.07)', border: '1px solid rgba(220,38,38,0.25)' }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(220,38,38,0.12)' }}>
            <AlertCircle className="w-4 h-4" style={{ color: '#DC2626' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold" style={{ color: '#991B1B' }}>
              {unpaidCount} {unpaidCount === 1 ? 'заявка требует' : unpaidCount < 5 ? 'заявки требуют' : 'заявок требуют'} оплаты
            </p>
          </div>
          <ArrowRight className="w-4 h-4 flex-shrink-0" style={{ color: '#DC2626' }} />
        </button>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : (
        <div className="space-y-4 sm:space-y-6">
          {/* KPI — стиль как в разборке */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">

            {/* Заявки */}
            <button onClick={() => navigate('/appointments')}
              className="stat-card cursor-pointer text-left group">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(37,99,235,0.1)' }}>
                  <FileText className="w-5 h-5" style={{ color: '#2563EB' }} />
                </div>
                <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: '#2563EB' }} />
              </div>
              <p className="text-xs font-medium mb-0.5" style={{ color: '#64748B' }}>Заявки</p>
              <p className="text-3xl font-bold text-gray-900" style={{ letterSpacing: '-0.03em' }}>{activeCount}</p>
              <div className="mt-3 pt-3 space-y-1" style={{ borderTop: '1px solid #F1F5F9' }}>
                <div className="flex justify-between text-xs">
                  <span style={{ color: '#94A3B8' }}>Ожидают</span>
                  <span className="font-semibold" style={{ color: '#7C3AED' }}>{scheduledCount}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span style={{ color: '#94A3B8' }}>В работе</span>
                  <span className="font-semibold" style={{ color: '#D97706' }}>{inProgressCount}</span>
                </div>
              </div>
            </button>

            {/* Готовые */}
            <button onClick={() => navigate('/appointments?tab=completed')}
              className="stat-card cursor-pointer text-left group">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(22,163,74,0.1)' }}>
                  <CheckCircle className="w-5 h-5" style={{ color: '#16A34A' }} />
                </div>
                <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: '#16A34A' }} />
              </div>
              <p className="text-xs font-medium mb-0.5" style={{ color: '#64748B' }}>Готовые</p>
              <p className="text-3xl font-bold text-gray-900" style={{ letterSpacing: '-0.03em' }}>{readyCount}</p>
              <div className="mt-3 pt-3 space-y-1" style={{ borderTop: '1px solid #F1F5F9' }}>
                <div className="flex justify-between text-xs">
                  <span style={{ color: '#94A3B8' }}>Неоплачено</span>
                  <span className="font-semibold" style={{ color: unpaidCount > 0 ? '#DC2626' : '#94A3B8' }}>{unpaidCount}</span>
                </div>
              </div>
            </button>

            {/* Клиенты */}
            <button onClick={() => navigate('/customers')}
              className="stat-card cursor-pointer text-left group">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(99,102,241,0.1)' }}>
                  <Users className="w-5 h-5" style={{ color: '#6366F1' }} />
                </div>
                <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: '#6366F1' }} />
              </div>
              <p className="text-xs font-medium mb-0.5" style={{ color: '#64748B' }}>Клиенты</p>
              <p className="text-3xl font-bold text-gray-900" style={{ letterSpacing: '-0.03em' }}>{clientsStats?.customers || 0}</p>
              <div className="mt-3 pt-3 space-y-1" style={{ borderTop: '1px solid #F1F5F9' }}>
                <div className="flex justify-between text-xs">
                  <span style={{ color: '#94A3B8' }}>Автомобилей</span>
                  <span className="font-semibold text-gray-700">{clientsStats?.vehicles || 0}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span style={{ color: '#94A3B8' }}>Сотрудников</span>
                  <span className="font-semibold text-gray-700">{workersCount}</span>
                </div>
              </div>
            </button>

            {/* Выручка за месяц */}
            <button
              onClick={() => navigate(`/monthly-revenue?year=${new Date().getFullYear()}&month=${new Date().getMonth() + 1}`)}
              className="stat-card cursor-pointer text-left group"
              style={{ background: 'linear-gradient(135deg, #1E3A6E 0%, #1E40AF 100%)', border: 'none' }}>
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
                  <DollarSign className="w-5 h-5 text-white" />
                </div>
                <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity text-white" />
              </div>
              <p className="text-xs font-medium mb-0.5" style={{ color: 'rgba(255,255,255,0.7)' }}>Доход за месяц</p>
              <p className="text-3xl font-bold text-white" style={{ letterSpacing: '-0.03em' }}>
                {totalCost >= 1000 ? `${Math.round(totalCost/1000)}к` : totalCost} ₴
              </p>
              <div className="mt-3 pt-3 space-y-1" style={{ borderTop: '1px solid rgba(255,255,255,0.15)' }}>
                <div className="flex justify-between text-xs">
                  <span style={{ color: 'rgba(255,255,255,0.6)' }}>Работы</span>
                  <span className="font-semibold text-white">{workCost >= 1000 ? `${Math.round(workCost/1000)}к` : workCost} ₴</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span style={{ color: 'rgba(255,255,255,0.6)' }}>Запчасти</span>
                  <span className="font-semibold text-white">{partsCost >= 1000 ? `${Math.round(partsCost/1000)}к` : partsCost} ₴</span>
                </div>
              </div>
            </button>
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

              {/* Разбивка заявок по статусам */}
              <div className="card p-0 overflow-hidden">
                <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <p className="text-sm font-semibold text-gray-800">Заявки по статусам</p>
                  <button onClick={() => navigate('/appointments')} className="text-xs font-medium flex items-center gap-1" style={{ color: '#2563EB' }}>
                    Все <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-3 divide-x">
                  {[
                    { label: 'Ожидают', value: scheduledCount, color: '#7C3AED', bg: 'rgba(124,58,237,0.1)', icon: Clock, path: '/appointments?tab=scheduled' },
                    { label: 'В работе', value: inProgressCount, color: '#D97706', bg: 'rgba(217,119,6,0.1)', icon: Wrench, path: '/appointments?tab=in_progress' },
                    { label: 'Готовые', value: readyCount, color: '#16A34A', bg: 'rgba(22,163,74,0.1)', icon: CheckCircle, path: '/appointments?tab=completed' },
                  ].map(({ label, value, color, bg, icon: Icon, path }) => (
                    <button key={label} onClick={() => navigate(path)} className="px-4 py-4 text-left hover:bg-gray-50 transition-colors group">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ backgroundColor: bg }}>
                          <Icon className="w-3.5 h-3.5" style={{ color }} />
                        </div>
                        <span className="text-xs font-medium" style={{ color: '#64748B' }}>{label}</span>
                      </div>
                      <p className="text-2xl font-bold text-gray-900" style={{ letterSpacing: '-0.03em' }}>{value}</p>
                    </button>
                  ))}
                </div>
              </div>

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
