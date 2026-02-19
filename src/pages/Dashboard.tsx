import { useState } from 'react'
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
  DollarSign
} from 'lucide-react'
import AppointmentModal from '@/components/appointments/AppointmentModal'
import MyVehicles from './MyVehicles'
import WorkerDashboard from './WorkerDashboard'
import { useNavigate } from 'react-router-dom'

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
  
  // Если активная роль user, показываем страницу "Мои автомобили"
  if (activeRole === 'user') {
    return <MyVehicles />
  }

  // Проверяем, является ли пользователь владельцем СТО
  const isStoOwner = profile?.roles?.some((r: any) => r.name === 'sto_owner')

  // Если работник, показываем worker dashboard
  if (!isStoOwner) {
    return <WorkerDashboard />
  }

  // Получаем детальную статистику по заявкам
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
      
      console.log('Dashboard stats:', {
        total: data?.length,
        active: active.length,
        scheduled: scheduled.length,
        inProgress: inProgress.length,
        ready: ready.length,
        readyItems: ready
      })
      
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
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)

      const { data, error } = await supabase
        .from('appointments')
        .select('parts_cost, total_work_cost, exclude_from_stats')
        .eq('sto_company_id', profile?.sto_company_id)
        .eq('status', 'archived')
        .eq('exclude_from_stats', false)
        .gte('closed_date', firstDay.toISOString())
        .lte('closed_date', lastDay.toISOString())
      
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
      const { data: workerRole } = await supabase
        .from('roles')
        .select('id')
        .eq('name', 'sto_worker')
        .single()

      if (!workerRole) return 0

      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role_id', workerRole.id)

      if (!userRoles) return 0

      const { count } = await supabase
        .from('user_profiles')
        .select('id', { count: 'exact', head: true })
        .eq('sto_company_id', profile?.sto_company_id)
        .eq('is_active', true)
        .in('id', userRoles.map(ur => ur.user_id))

      return count || 0
    },
    enabled: !!profile?.sto_company_id,
  })

  const activeCount = appointmentsStats?.total || 0
  const scheduledCount = appointmentsStats?.scheduled || 0
  const inProgressCount = appointmentsStats?.inProgress || 0
  const readyCount = appointmentsStats?.ready || 0
  const unpaidCount = appointmentsStats?.unpaid || 0

  console.log('Dashboard readyCount:', readyCount, 'appointmentsStats:', appointmentsStats)

  const partsCost = monthlyStats?.parts || 0
  const workCost = monthlyStats?.work || 0
  const totalCost = monthlyStats?.total || 0
  const completedCount = monthlyStats?.count || 0

  const isLoading = statsLoading || monthlyLoading || workersLoading

  // Получаем название текущего месяца
  const currentMonth = new Date().toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })

  return (
    <div className="container-mobile">
      {/* Header с кнопками */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-6">
        <h1 className="heading-mobile-1">Панель управления</h1>
        
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
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="space-y-4 sm:space-y-6">
          {/* Быстрая статистика по заявкам */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Активные заявки */}
            <div 
              onClick={() => navigate('/appointments')}
              className="card-mobile cursor-pointer hover:shadow-md transition-shadow"
            >
              <div className="flex flex-col">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 rounded-lg bg-blue-100">
                    <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                  </div>
                  <p className="text-mobile-sm text-gray-600">Активные</p>
                </div>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900">{activeCount}</p>
              </div>
            </div>

            {/* Запланированные */}
            <div 
              onClick={() => navigate('/appointments')}
              className="card-mobile cursor-pointer hover:shadow-md transition-shadow"
            >
              <div className="flex flex-col">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 rounded-lg bg-purple-100">
                    <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
                  </div>
                  <p className="text-mobile-sm text-gray-600">Ожидают</p>
                </div>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900">{scheduledCount}</p>
              </div>
            </div>

            {/* В работе */}
            <div 
              onClick={() => navigate('/appointments')}
              className="card-mobile cursor-pointer hover:shadow-md transition-shadow"
            >
              <div className="flex flex-col">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 rounded-lg bg-orange-100">
                    <Wrench className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600" />
                  </div>
                  <p className="text-mobile-sm text-gray-600">В работе</p>
                </div>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900">{inProgressCount}</p>
              </div>
            </div>

            {/* Готовые */}
            <div 
              onClick={() => navigate('/appointments?status=ready')}
              className="card-mobile cursor-pointer hover:shadow-md transition-shadow"
            >
              <div className="flex flex-col">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 rounded-lg bg-green-100">
                    <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                  </div>
                  <p className="text-mobile-sm text-gray-600">Готовые</p>
                </div>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900">
                  {readyCount}
                </p>
              </div>
            </div>
          </div>

          {/* Алерты и информация */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
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
                    <p className="text-mobile-sm text-red-700">
                      {unpaidCount} {unpaidCount === 1 ? 'заявка' : unpaidCount < 5 ? 'заявки' : 'заявок'} с неоплаченными услугами
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Информация о работниках */}
            <div 
              onClick={() => navigate('/sto/employees')}
              className="card-mobile cursor-pointer hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-indigo-100">
                  <Users className="w-5 h-5 text-indigo-600" />
                </div>
                <div className="flex-1">
                  <p className="text-mobile-base font-semibold text-gray-900 mb-1">
                    Работники СТО
                  </p>
                  <p className="text-mobile-sm text-gray-600">
                    Всего сотрудников: {workersCount}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Статистика текущего месяца */}
          <div 
            onClick={() => navigate(`/monthly-revenue?year=${new Date().getFullYear()}&month=${new Date().getMonth() + 1}`)}
            className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5 md:p-6 cursor-pointer hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900">
                Доход за {currentMonth}
              </h2>
              <span className="text-mobile-sm text-gray-600">
                Закрыто: {completedCount}
              </span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              {/* Сумма запчастей */}
              <div className="p-3 sm:p-4 rounded-lg bg-green-50 border border-green-100">
                <div className="flex items-center gap-2 sm:gap-3 mb-2">
                  <div className="p-1.5 sm:p-2 rounded bg-green-100">
                    <Package className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                  </div>
                  <p className="text-mobile-sm text-green-700 font-medium">Запчасти</p>
                </div>
                <p className="text-xl sm:text-2xl font-bold text-green-900">
                  {partsCost.toLocaleString('ru-RU')} ₴
                </p>
              </div>

              {/* Сумма работ */}
              <div className="p-3 sm:p-4 rounded-lg bg-purple-50 border border-purple-100">
                <div className="flex items-center gap-2 sm:gap-3 mb-2">
                  <div className="p-1.5 sm:p-2 rounded bg-purple-100">
                    <Wrench className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
                  </div>
                  <p className="text-mobile-sm text-purple-700 font-medium">Работы</p>
                </div>
                <p className="text-xl sm:text-2xl font-bold text-purple-900">
                  {workCost.toLocaleString('ru-RU')} ₴
                </p>
              </div>

              {/* Общая сумма */}
              <div className="p-3 sm:p-4 rounded-lg bg-blue-50 border border-blue-100">
                <div className="flex items-center gap-2 sm:gap-3 mb-2">
                  <div className="p-1.5 sm:p-2 rounded bg-blue-100">
                    <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                  </div>
                  <p className="text-mobile-sm text-blue-700 font-medium">Всего</p>
                </div>
                <p className="text-xl sm:text-2xl font-bold text-blue-900">
                  {totalCost.toLocaleString('ru-RU')} ₴
                </p>
              </div>
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
