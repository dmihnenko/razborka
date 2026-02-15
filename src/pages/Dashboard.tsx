import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useUserProfile } from '@/hooks/useUserProfile'
import { Plus, FileText, Package, Wrench } from 'lucide-react'
import AppointmentModal from '@/components/appointments/AppointmentModal'
import MyVehicles from './MyVehicles'
import MonthlyStatistics from './MonthlyStatistics.tsx'

export default function Dashboard() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const { data: profile } = useUserProfile()

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

  // Если работник, показываем статистику
  if (!isStoOwner) {
    return <MonthlyStatistics />
  }

  // Получаем количество активных заявок (не архивных)
  const { data: activeAppointments, isLoading: activeLoading } = useQuery({
    queryKey: ['dashboard-active-count', profile?.sto_company_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select('id')
        .eq('sto_company_id', profile?.sto_company_id)
        .neq('status', 'archived')
      
      if (error) throw error
      return data
    },
    enabled: !!profile?.sto_company_id,
  })

  // Получаем статистику текущего месяца (сумма запчастей и работ)
  const { data: monthlyStats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-monthly-stats', profile?.sto_company_id],
    queryFn: async () => {
      const now = new Date()
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)

      const { data, error } = await supabase
        .from('appointments')
        .select('parts_cost, total_work_cost')
        .eq('sto_company_id', profile?.sto_company_id)
        .eq('status', 'archived')
        .gte('closed_date', firstDay.toISOString())
        .lte('closed_date', lastDay.toISOString())
      
      if (error) throw error

      const totalParts = data?.reduce((sum, app) => sum + (app.parts_cost || 0), 0) || 0
      const totalWork = data?.reduce((sum, app) => sum + (app.total_work_cost || 0), 0) || 0

      return {
        parts: Math.round(totalParts),
        work: Math.round(totalWork),
        total: Math.round(totalParts + totalWork)
      }
    },
    enabled: !!profile?.sto_company_id,
  })

  const activeCount = activeAppointments?.length || 0
  const partsCost = monthlyStats?.parts || 0
  const workCost = monthlyStats?.work || 0
  const totalCost = monthlyStats?.total || 0

  const isLoading = activeLoading || statsLoading

  // Получаем название текущего месяца
  const currentMonth = new Date().toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })

  return (
    <div className="container-mobile">
      {/* Header с кнопкой */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h1 className="heading-mobile-1">Панель управления</h1>
        
        <button
          onClick={() => setIsModalOpen(true)}
          className="btn-touch bg-primary text-white hover:bg-primary/90 flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5 flex-shrink-0" />
          <span>Новая запись</span>
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="space-y-4 sm:space-y-6">
          {/* Статистика активных заявок */}
          <div className="card-mobile">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="p-2.5 sm:p-3 rounded-lg bg-blue-100 flex-shrink-0">
                <FileText className="w-6 h-6 sm:w-7 sm:h-7 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-mobile-sm text-gray-600 mb-0.5 sm:mb-1">Активные заявки</p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900">{activeCount}</p>
                <p className="text-mobile-sm text-gray-500 mt-0.5 sm:mt-1">Всего заявок в работе</p>
              </div>
            </div>
          </div>

          {/* Статистика текущего месяца */}
          <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5 md:p-6">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">
              Статистика за {currentMonth}
            </h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
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
              <div className="p-3 sm:p-4 rounded-lg bg-blue-50 border border-blue-100 sm:col-span-2 lg:col-span-1">
                <div className="flex items-center gap-2 sm:gap-3 mb-2">
                  <div className="p-1.5 sm:p-2 rounded bg-blue-100">
                    <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
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
