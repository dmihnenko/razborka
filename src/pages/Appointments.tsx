import { useState } from 'react'
import { Spinner } from '@/components/ui/Spinner'
import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useUserProfile } from '@/hooks/useUserProfile'
import { Plus, List, TrendingUp, Check } from 'lucide-react'
import AppointmentModal from '@/components/appointments/AppointmentModal'
import ReassignWorkerModal from '@/components/appointments/ReassignWorkerModal'
import { useNavigate, useSearchParams } from 'react-router-dom'

export default function Appointments() {
  const [searchParams, setSearchParams] = useSearchParams()
  const statusFilter = searchParams.get('status')
  const vehicleIdFilter = searchParams.get('vehicleId')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingAppointment, setEditingAppointment] = useState<any>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [reassignModal, setReassignModal] = useState<{
    isOpen: boolean
    appointmentId: string
    currentWorkerId: string | null
    customerName: string
    vehicleName: string
  } | null>(null)
  const { data: profile } = useUserProfile()
  const navigate = useNavigate()

  // Проверяем, является ли пользователь владельцем СТО
  const isStoOwner = profile?.roles?.some((r: any) => r.name === 'sto_owner')

  const toggleGroup = (customerId: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev)
      if (newSet.has(customerId)) {
        newSet.delete(customerId)
      } else {
        newSet.add(customerId)
      }
      return newSet
    })
  }

  const { data: appointments, isLoading } = useQuery({
    queryKey: ['appointments', profile?.id, showArchived, statusFilter, vehicleIdFilter],
    queryFn: async () => {
      let query = supabase
        .from('appointments')
        .select(`
          *,
          customers(id, name, phone),
          vehicles(brand, model, license_plate, vin),
          appointment_parts(id, description, created_at),
          created_by_profile:user_profiles!created_by(full_name, email),
          assigned_to_profile:user_profiles!assigned_to(full_name, email)
        `)

      // Фильтруем по СТО пользователя
      if (profile?.sto_company_id) {
        query = query.eq('sto_company_id', profile.sto_company_id)
      }

      // Фильтруем по архиву
      if (showArchived) {
        query = query.eq('status', 'archived')
      } else {
        query = query.not('status', 'in', '(archived,deleted)')
      }

      // Фильтруем по статусу из URL параметров
      if (statusFilter && !showArchived) {
        // Для фильтра "ready" показываем также "completed"
        if (statusFilter === 'ready') {
          query = query.in('status', ['ready', 'completed'])
        } else {
          query = query.eq('status', statusFilter)
        }
      }

      // Фильтруем по автомобилю
      if (vehicleIdFilter) {
        query = query.eq('vehicle_id', vehicleIdFilter)
      }

      // Если пользователь - работник (не владелец), показываем только его заявки
      if (!isStoOwner && profile?.id) {
        query = query.eq('assigned_to', profile.id)
      }

      const { data, error } = await query.order('scheduled_date', { ascending: false })
      
      if (error) throw error
      return data
    },
    enabled: !!profile?.sto_company_id,
  })

  // Группируем заявки по клиентам
  const groupedAppointments = appointments?.reduce((acc: any, appointment: any) => {
    const customerId = appointment.customers?.id
    if (!customerId) return acc
    
    if (!acc[customerId]) {
      acc[customerId] = {
        customer: appointment.customers,
        appointments: []
      }
    }
    acc[customerId].appointments.push(appointment)
    return acc
  }, {})

  // Сортируем: сначала клиенты с 1 заявкой, потом с 2+
  const customerGroups = groupedAppointments 
    ? Object.values(groupedAppointments).sort((a: any, b: any) => {
        return a.appointments.length - b.appointments.length
      })
    : []

  const statusColors = {
    scheduled: 'bg-purple-100 text-purple-800',
    in_progress: 'bg-orange-100 text-orange-800',
    ready: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    archived: 'bg-gray-100 text-gray-800',
    cancelled: 'bg-gray-100 text-gray-800',
    pending_deletion: 'bg-red-100 text-red-800',
    deleted: 'bg-gray-200 text-gray-600',
  }

  const statusLabels = {
    scheduled: 'Запланирована',
    in_progress: 'В работе',
    ready: 'Готова',
    completed: 'Завершена',
    archived: 'Архив',
    cancelled: 'Отменена',
    pending_deletion: 'Ожидает удаления',
    deleted: 'Удалена',
  }

  return (
    <div className="container-mobile">
      {/* Actions */}
      <div className="flex justify-end gap-2 flex-wrap mb-4 sm:mb-6">
        {statusFilter && (
          <button
            onClick={() => setSearchParams({})}
            className="btn-touch-sm text-gray-700 bg-blue-50 border border-blue-300 hover:bg-blue-100 flex items-center gap-1.5"
          >
            <span>Показать все ({statusLabels[statusFilter as keyof typeof statusLabels] ?? statusFilter})</span>
          </button>
        )}
        <button
          onClick={() => setShowArchived(!showArchived)}
          className="btn-touch-sm text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 flex items-center gap-1.5"
        >
          {showArchived ? (
            <>
              <List className="w-4 h-4 flex-shrink-0" />
              <span>Активные</span>
            </>
          ) : (
            <span>Архив</span>
          )}
        </button>
        {isStoOwner && (
          <button
            onClick={() => navigate('/statistics')}
            className="btn-touch-sm text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 flex items-center gap-1.5"
          >
            <TrendingUp className="w-4 h-4 flex-shrink-0" />
            <span className="hidden sm:inline">Статистика</span>
          </button>
        )}
        {!showArchived && (
          <button
            onClick={() => {
              setEditingAppointment(null)
              setIsModalOpen(true)
            }}
            className="btn-touch-sm bg-primary text-white hover:bg-primary/90 flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4 flex-shrink-0" />
            <span>Новая заявка</span>
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : (
        <>
          {/* Desktop таблица */}
          <div className="hidden md:block bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Клиент
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Автомобиль
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Дата создания
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Статус
                    </th>
                    {!isStoOwner && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Сумма
                      </th>
                    )}
                    {!showArchived && (
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                        Оплаты
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {customerGroups.map((group: any) => {
                    const customerId = group.customer.id
                    const isExpanded = expandedGroups.has(customerId)
                    const hasMultiple = group.appointments.length > 1
                    
                    if (!hasMultiple) {
                      // Если у клиента одна заявка - показываем как обычно
                      const appointment = group.appointments[0]
                      return (
                        <tr 
                          key={appointment.id}
                          onClick={() => navigate(`/sto/appointments/${appointment.id}`)}
                          className="cursor-pointer hover:bg-gray-50 transition-colors"
                        >
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">{appointment.customers?.name}</div>
                              <div className="text-sm text-gray-500">{appointment.customers?.phone}</div>
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                            {(() => {
                              const brand = appointment.vehicles?.brand || ''
                              const model = appointment.vehicles?.model || ''
                              
                              if (model.toLowerCase() === brand.toLowerCase() || 
                                  model.toLowerCase().startsWith(brand.toLowerCase() + ' ')) {
                                return model
                              }
                              
                              return `${brand} ${model}`.trim()
                            })()}

                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                            {new Date(appointment.created_at).toLocaleDateString('ru-RU', { 
                              day: '2-digit', 
                              month: '2-digit', 
                              year: 'numeric' 
                            })}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded ${statusColors[appointment.status as keyof typeof statusColors]}`}>
                              {statusLabels[appointment.status as keyof typeof statusLabels]}
                            </span>
                          </td>
                          {!isStoOwner && (
                            <td className="px-4 py-3 whitespace-nowrap text-sm">
                              {(((appointment.parts_cost || appointment.total_parts_cost) || 0) + (appointment.total_work_cost || 0)) > 0 && (
                                <div className="space-y-1">
                                  {((appointment.parts_cost || appointment.total_parts_cost) || 0) > 0 && (
                                    <div className="text-black">
                                      ₴{((appointment.parts_cost || appointment.total_parts_cost) || 0).toLocaleString('ru-RU')}
                                    </div>
                                  )}
                                  {(appointment.total_work_cost || 0) > 0 && (
                                    <div className="text-black">
                                      ₴{(appointment.total_work_cost || 0).toLocaleString('ru-RU')}
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>
                          )}
                          {!showArchived && (
                            <td className="px-4 py-3 text-center">
                              <div className="flex items-center justify-center gap-2">
                                {appointment.parts_paid && (
                                  <div className="flex items-center gap-1 text-green-600 text-xs">
                                    <Check className="w-3 h-3" />
                                    <span>З</span>
                                  </div>
                                )}
                                {appointment.work_paid && (
                                  <div className="flex items-center gap-1 text-green-600 text-xs">
                                    <Check className="w-3 h-3" />
                                    <span>Р</span>
                                  </div>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      )
                    }
                    
                    // Если у клиента несколько заявок - группируем
                    return (
                      <React.Fragment key={customerId}>
                        {/* Заголовок группы */}
                        <tr 
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleGroup(customerId)
                          }}
                          className="cursor-pointer bg-blue-50 hover:bg-blue-100 transition-colors"
                        >
                          <td className="px-4 py-3" colSpan={!isStoOwner ? (!showArchived ? 6 : 5) : (!showArchived ? 5 : 4)}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <svg 
                                  className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                                  fill="none" 
                                  stroke="currentColor" 
                                  viewBox="0 0 24 24"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                                <div>
                                  <div className="text-sm font-semibold text-gray-900">{group.customer.name}</div>
                                  <div className="text-sm text-gray-500">{group.customer.phone}</div>
                                </div>
                              </div>
                              <span className="px-2.5 py-1 bg-blue-200 text-blue-800 text-xs font-bold rounded">
                                {group.appointments.length} {group.appointments.length === 1 ? 'заявка' : group.appointments.length < 5 ? 'заявки' : 'заявок'}
                              </span>
                            </div>
                          </td>
                        </tr>
                        
                        {/* Заявки группы */}
                        {isExpanded && group.appointments.map((appointment: any) => (
                      <tr 
                        key={appointment.id}
                        onClick={() => navigate(`/sto/appointments/${appointment.id}`)}
                        className="cursor-pointer hover:bg-gray-50 transition-colors bg-blue-25"
                      >
                        <td className="px-4 py-3 pl-10 whitespace-nowrap">
                          <div className="text-sm text-gray-600">{appointment.vehicles?.brand} {appointment.vehicles?.model}</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {new Date(appointment.scheduled_date).toLocaleDateString('ru-RU')}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                          {new Date(appointment.created_at).toLocaleDateString('ru-RU', { 
                            day: '2-digit', 
                            month: '2-digit', 
                            year: 'numeric' 
                          })}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded ${statusColors[appointment.status as keyof typeof statusColors]}`}>
                            {statusLabels[appointment.status as keyof typeof statusLabels]}
                          </span>
                        </td>
                        {!isStoOwner && (
                          <td className="px-4 py-3 whitespace-nowrap text-sm">
                            <div className="flex flex-col gap-1">
                              {((appointment.parts_cost || appointment.total_parts_cost) || 0) > 0 && (
                                <div className="font-semibold text-black">
                                  ₴{((appointment.parts_cost || appointment.total_parts_cost) || 0).toLocaleString('ru-RU')}
                                </div>
                              )}
                              {(appointment.total_work_cost || 0) > 0 && (
                                <div className="font-semibold text-black">
                                  ₴{(appointment.total_work_cost || 0).toLocaleString('ru-RU')}
                                </div>
                              )}
                              {(((appointment.parts_cost || appointment.total_parts_cost) || 0) + (appointment.total_work_cost || 0)) > 0 && (
                                <div className="text-gray-900 font-bold border-t border-gray-200 pt-1">
                                  ₴{(((appointment.parts_cost || appointment.total_parts_cost) || 0) + (appointment.total_work_cost || 0)).toLocaleString('ru-RU')}
                                </div>
                              )}
                            </div>
                          </td>
                        )}
                        {!showArchived && (
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                            <div className="flex flex-col gap-1 items-start">
                              {((appointment.parts_cost || appointment.total_parts_cost) || 0) > 0 && (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-gray-600">Запчасти:</span>
                                  {appointment.parts_paid ? (
                                    <Check className="w-4 h-4 text-green-600" />
                                  ) : (
                                    <span className="text-xs text-gray-400">—</span>
                                  )}
                                </div>
                              )}
                              {(appointment.total_work_cost || 0) > 0 && (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-gray-600">Работы:</span>
                                  {appointment.work_paid ? (
                                    <Check className="w-4 h-4 text-green-600" />
                                  ) : (
                                    <span className="text-xs text-gray-400">—</span>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                      ))}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile карточки */}
          <div className="md:hidden space-y-2.5">
            {customerGroups.map((group: any) => {
              const customerId = group.customer.id
              const isExpanded = expandedGroups.has(customerId)
              const hasMultiple = group.appointments.length > 1
              
              return (
                <div key={customerId} className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                  {/* Заголовок группы клиента */}
                  <div 
                    onClick={() => hasMultiple && toggleGroup(customerId)}
                    className={`bg-gradient-to-r from-blue-50 to-white px-3 py-2.5 border-b border-gray-100 flex items-center justify-between ${
                      hasMultiple ? 'cursor-pointer active:bg-blue-100' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {hasMultiple && (
                        <svg 
                          className={`w-4 h-4 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-90' : ''}`}
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      )}
                      <h3 className="text-base font-semibold text-gray-900 truncate">
                        {group.customer.name}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {!hasMultiple && (
                        <span className="text-xs text-gray-500">
                          {new Date(group.appointments[0].created_at).toLocaleDateString('ru-RU', { 
                            day: '2-digit', 
                            month: '2-digit' 
                          })}
                        </span>
                      )}
                      {hasMultiple && (
                        <span className="px-2.5 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded">
                          {group.appointments.length} {group.appointments.length === 1 ? 'заявка' : group.appointments.length < 5 ? 'заявки' : 'заявок'}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Заявки клиента */}
                  <div className="divide-y divide-gray-100">
                    {(!hasMultiple || isExpanded) && group.appointments.map((appointment: any) => (
                    <div
                      key={appointment.id}
                      onClick={() => navigate(`/sto/appointments/${appointment.id}`)}
                      className="p-3 hover:bg-gray-50 active:bg-gray-100 transition-colors cursor-pointer"
                    >
                    {/* Автомобиль */}
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-mobile-sm text-gray-600 truncate">
                          {(() => {
                            const brand = appointment.vehicles?.brand || ''
                            const model = appointment.vehicles?.model || ''
                            
                            if (model.toLowerCase() === brand.toLowerCase() || 
                                model.toLowerCase().startsWith(brand.toLowerCase() + ' ')) {
                              return model
                            }
                            
                            return `${brand} ${model}`.trim()
                          })()}
                          {appointment.vehicles?.vin && (
                            <span className="ml-2 text-gray-400 text-xs">
                              {appointment.vehicles.vin}
                            </span>
                          )}
                        </p>
                      </div>
                  
                  {/* Статус */}
                  <span className={`badge-mobile flex-shrink-0 ${statusColors[appointment.status as keyof typeof statusColors]}`}>
                    {statusLabels[appointment.status as keyof typeof statusLabels]}
                  </span>
                </div>

                {/* Дополнительная информация - цены */}
                {!isStoOwner && (((appointment.parts_cost || appointment.total_parts_cost) || 0) + (appointment.total_work_cost || 0)) > 0 && (
                  <div className="mt-2 space-y-1">
                    {((appointment.parts_cost || appointment.total_parts_cost) || 0) > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-mobile-sm text-gray-600">Запчасти:</span>
                        <span className="font-semibold text-mobile-base text-black">
                          ₴{((appointment.parts_cost || appointment.total_parts_cost) || 0).toLocaleString('ru-RU')}
                        </span>
                      </div>
                    )}
                    {(appointment.total_work_cost || 0) > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-mobile-sm text-gray-600">Работы:</span>
                        <span className="font-semibold text-mobile-base text-black">
                          ₴{(appointment.total_work_cost || 0).toLocaleString('ru-RU')}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-1 border-t border-gray-200">
                      <span className="text-mobile-base font-medium text-gray-900">Итого:</span>
                      <span className="font-bold text-primary text-mobile-lg">
                        ₴{(((appointment.parts_cost || appointment.total_parts_cost) || 0) + (appointment.total_work_cost || 0)).toLocaleString('ru-RU')}
                      </span>
                    </div>
                  </div>
                )}

                {/* Оплаты (если не архив) */}
                {!showArchived && (appointment.parts_paid || appointment.work_paid) && (
                  <div className="mt-2 flex gap-2 text-mobile-sm">
                    {appointment.parts_paid && (
                      <div className="flex items-center gap-1 text-green-600">
                        <Check className="w-3 h-3" />
                        <span>Запчасти</span>
                      </div>
                    )}
                    {appointment.work_paid && (
                      <div className="flex items-center gap-1 text-green-600">
                        <Check className="w-3 h-3" />
                        <span>Работы</span>
                      </div>
                    )}
                  </div>
                )}
                    </div>
                  ))}
                </div>
              </div>
              )
            })}

            {appointments?.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <p>Нет заявок</p>
              </div>
            )}
          </div>
        </>
      )}

      <AppointmentModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setEditingAppointment(null)
        }}
        appointmentId={editingAppointment?.id}
        onSuccess={() => {
          setIsModalOpen(false)
          setEditingAppointment(null)
        }}
      />

      {reassignModal && (
        <ReassignWorkerModal
          isOpen={reassignModal.isOpen}
          onClose={() => setReassignModal(null)}
          appointmentId={reassignModal.appointmentId}
          currentWorkerId={reassignModal.currentWorkerId}
          appointmentInfo={{
            customerName: reassignModal.customerName,
            vehicleName: reassignModal.vehicleName,
          }}
        />
      )}
    </div>
  )
}

