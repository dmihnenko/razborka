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
  Calendar
} from 'lucide-react'
import AppointmentModal from '@/components/appointments/AppointmentModal'
import MyVehicles from './MyVehicles'
import WorkerDashboard from './WorkerDashboard'
import { useNavigate, Link } from 'react-router-dom'
import PageHeader from '@/components/PageHeader'

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
  const currentMonth = new Date().toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })

  return (
    <div className="container-mobile">
      <PageHeader
        title="Панель управления"
        actions={
          <div className="flex gap-2">
            <button
              onClick={() => navigate('/statistics')}
              className="btn-touch-sm text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 flex items-center gap-1.5"
            >
              <TrendingUp className="w-4 h-4 flex-shrink-0" />
              <span className="hidden sm:inline">Статистика</span>
            </button>
            <button
              onClick={() => setIsModalOpen(true)}
              className="btn-touch bg-primary text-white hover:bg-primary/90 flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5 flex-shrink-0" />
              <span>Новая запись</span>
            </button>
          </div>
        }
      />

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
            <button onClick={() => navigate('/appointments?status=ready')}
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

            {/* Работники */}
            <button onClick={() => navigate('/sto/employees')}
              className="stat-card cursor-pointer text-left group">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(99,102,241,0.1)' }}>
                  <Users className="w-5 h-5" style={{ color: '#6366F1' }} />
                </div>
                <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: '#6366F1' }} />
              </div>
              <p className="text-xs font-medium mb-0.5" style={{ color: '#64748B' }}>Сотрудники</p>
              <p className="text-3xl font-bold text-gray-900" style={{ letterSpacing: '-0.03em' }}>{workersCount}</p>
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

            {/* Неоплаченные заявки */}
            {unpaidCount > 0 && (
              <div className="card-mobile bg-red-50 border-red-200">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-red-100">
                    <AlertCircle className="w-5 h-5 text-red-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-mobile-base font-semibold text-red-900 mb-1">
                      Требуют оплаты
                    </p>
                    <p className="text-sm text-red-700">
                      {unpaidCount} {unpaidCount === 1 ? 'заявка' : unpaidCount < 5 ? 'заявки' : 'заявок'} с неоплаченными услугами
                    </p>
                  </div>
                </div>
              </div>
            )}

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
