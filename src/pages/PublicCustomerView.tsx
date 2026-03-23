import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Car, FileText, Clock, Package, ChevronDown, ChevronUp, CheckCircle, Archive, Phone } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ru } from 'date-fns/locale'
import { formatCurrency } from '@/utils/currency'
import { getAppointmentStatusColor, getAppointmentStatusText, getPartsOrderStatusColor, getPartsOrderStatusText } from '@/utils/status'

const ACTIVE_STATUSES = new Set(['pending', 'scheduled', 'in_progress'])
const DONE_STATUSES = new Set(['completed', 'cancelled', 'archived'])

export default function PublicCustomerView() {
  const { id } = useParams<{ id: string }>()
  const [vehiclesOpen, setVehiclesOpen] = useState(false)

  // Получаем данные клиента СТО (нужны для телефона)
  const { data: customer } = useQuery({
    queryKey: ['public-customer', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('name, phone')
        .eq('id', id)
        .single()
      
      if (error) throw error
      return data
    },
  })

  // Получаем автомобили клиента
  const { data: vehicles, isLoading: vehiclesLoading } = useQuery({
    queryKey: ['public-customer-vehicles', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .eq('customer_id', id)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      return data
    },
  })

  // Получаем заявки клиента
  const { data: appointments, isLoading: appointmentsLoading } = useQuery({
    queryKey: ['public-customer-appointments', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          *,
          vehicles (
            brand,
            model,
            license_plate,
            vin
          )
        `)
        .eq('customer_id', id)
        .order('scheduled_date', { ascending: false })
      
      if (error) {
        console.error('Appointments error:', error)
        throw error
      }
      return data
    },
  })

  // Получаем заказы запчастей клиента (через связь по телефону)
  const { data: partsOrders, isLoading: partsOrdersLoading } = useQuery({
    queryKey: ['public-customer-parts-orders', customer?.phone],
    queryFn: async () => {
      if (!customer?.phone) return []
      
      // Сначала находим parts_customer по телефону
      const { data: partsCustomers, error: customerError } = await supabase
        .from('parts_customers')
        .select('id')
        .eq('phone', customer.phone)
      
      if (customerError) throw customerError
      if (!partsCustomers || partsCustomers.length === 0) return []
      
      // Получаем все заказы для найденных parts_customers
      const customerIds = partsCustomers.map(c => c.id)
      const { data, error } = await supabase
        .from('parts_orders')
        .select(`
          *,
          items:parts_order_items(
            id,
            quantity,
            price_at_sale,
            subtotal,
            inventory_item:parts_inventory(
              name,
              part_number
            )
          )
        `)
        .in('customer_id', customerIds)
        .order('order_date', { ascending: false })
      
      if (error) throw error
      return data
    },
    enabled: !!customer?.phone
  })

  if (vehiclesLoading || appointmentsLoading || partsOrdersLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex justify-center items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  const activeAppointments = (appointments ?? []).filter(a => ACTIVE_STATUSES.has(a.status))
  const archivedAppointments = (appointments ?? []).filter(a => DONE_STATUSES.has(a.status))

  return (
    <div className="min-h-screen bg-gray-50 py-3 sm:py-6">
      <div className="max-w-2xl mx-auto px-3 sm:px-4">

        {/* Заголовок */}
        <div className="bg-white rounded-xl shadow-sm p-4 sm:p-5 mb-3 sm:mb-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-lg sm:text-2xl font-bold text-gray-900">
                ******
              </h1>
              {customer?.phone && (
                <a
                  href={`tel:${customer.phone}`}
                  className="flex items-center gap-1 text-xs sm:text-sm text-primary mt-0.5 hover:underline"
                >
                  <Phone className="w-3 h-3" />
                  {customer.phone}
                </a>
              )}
              <p className="text-xs text-gray-400 mt-0.5">История обслуживания и заявок</p>
            </div>
            <div className="flex gap-3 sm:gap-4 shrink-0">
              <div className="text-center">
                <p className="text-[10px] text-gray-400">Активных</p>
                <p className="text-base sm:text-xl font-bold text-blue-600">{activeAppointments.length}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-gray-400">Завершённых</p>
                <p className="text-base sm:text-xl font-bold text-gray-500">{archivedAppointments.length}</p>
              </div>
              {partsOrders && partsOrders.length > 0 && (
                <div className="text-center">
                  <p className="text-[10px] text-gray-400">Заказов</p>
                  <p className="text-base sm:text-xl font-bold text-green-600">{partsOrders.length}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Автомобили — коллапсируемый блок */}
        <div className="bg-white rounded-xl shadow-sm mb-3 sm:mb-4 overflow-hidden">
          <button
            onClick={() => setVehiclesOpen(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 sm:py-3.5 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Car className="w-4 h-4 text-primary" />
              <span className="text-sm sm:text-base font-semibold text-gray-900">Мои автомобили</span>
              <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full font-medium">
                {vehicles?.length ?? 0}
              </span>
            </div>
            {vehiclesOpen
              ? <ChevronUp className="w-4 h-4 text-gray-400" />
              : <ChevronDown className="w-4 h-4 text-gray-400" />
            }
          </button>

          {vehiclesOpen && (
            <div className="border-t border-gray-100 px-3 pt-3 pb-3 space-y-2">
              {vehicles && vehicles.length > 0 ? vehicles.map((vehicle) => (
                <div key={vehicle.id} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2.5">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Car className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {vehicle.brand} {vehicle.model}
                      {vehicle.year && <span className="font-normal text-gray-500"> · {vehicle.year}</span>}
                    </p>
                    <p className="text-xs text-gray-500">
                      {vehicle.license_plate}
                      {vehicle.color && <span> · {vehicle.color}</span>}
                    </p>
                    {vehicle.vin && (
                      <p className="text-[10px] text-gray-400 font-mono truncate mt-0.5">{vehicle.vin}</p>
                    )}
                  </div>
                </div>
              )) : (
                <p className="text-sm text-gray-400 text-center py-3">Автомобили не добавлены</p>
              )}
            </div>
          )}
        </div>

        {/* Активные заявки */}
        <div className="bg-white rounded-xl shadow-sm p-4 sm:p-5 mb-3 sm:mb-4">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-4 h-4 text-blue-500" />
            <h2 className="text-sm sm:text-base font-bold text-gray-900">Активные заявки</h2>
            {activeAppointments.length > 0 && (
              <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">
                {activeAppointments.length}
              </span>
            )}
          </div>

          {activeAppointments.length > 0 ? (
            <div className="space-y-2.5">
              {activeAppointments.map(appointment => (
                <AppointmentCard key={appointment.id} appointment={appointment} />
              ))}
            </div>
          ) : (
            <div className="text-center py-5">
              <CheckCircle className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Активных заявок нет</p>
            </div>
          )}
        </div>

        {/* Архивные заявки */}
        {archivedAppointments.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-5 mb-3 sm:mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Archive className="w-4 h-4 text-gray-400" />
              <h2 className="text-sm sm:text-base font-bold text-gray-700">Архив обслуживания</h2>
              <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-medium">
                {archivedAppointments.length}
              </span>
            </div>
            <div className="space-y-2.5">
              {archivedAppointments.map(appointment => (
                <AppointmentCard key={appointment.id} appointment={appointment} />
              ))}
            </div>
          </div>
        )}

        {/* Заказы запчастей */}
        {partsOrders && partsOrders.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-5 mb-3 sm:mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Package className="w-4 h-4 text-primary" />
              <h2 className="text-sm sm:text-base font-bold text-gray-900">Заказы запчастей</h2>
              <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">
                {partsOrders.length}
              </span>
            </div>
            <div className="space-y-2.5">
              {partsOrders.map((order) => (
                <div key={order.id} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getPartsOrderStatusColor(order.status)}`}>
                      {getPartsOrderStatusText(order.status)}
                    </span>
                    <span className="text-sm font-bold text-primary shrink-0">{formatCurrency(order.total_amount)}</span>
                  </div>

                  {order.items && order.items.length > 0 && (
                    <div className="space-y-1 mb-2">
                      {order.items.map((item: any) => (
                        <div key={item.id} className="flex justify-between gap-2 text-xs text-gray-700">
                          <span className="truncate">{item.inventory_item?.name || 'Запчасть'}</span>
                          <span className="shrink-0 text-gray-500">{item.quantity} шт</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[10px] text-gray-400 pt-1.5 border-t border-gray-200">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(order.order_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                    <span>{formatDistanceToNow(new Date(order.created_at), { addSuffix: true, locale: ru })}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Футер */}
        <p className="text-center text-[10px] sm:text-xs text-gray-400 py-4 px-2">
          Эта страница создана для вашего удобства · Здесь вы можете отслеживать состояние заявок в любое время
        </p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Компонент карточки заявки
// ─────────────────────────────────────────────────────────────
function AppointmentCard({ appointment }: { appointment: any }) {
  return (
    <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 sm:p-4">
      {/* Шапка: [Марка Модель] [VIN] слева, [Статус] справа */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          {appointment.vehicles && (
            <span className="text-sm font-semibold text-gray-900 shrink-0">
              {appointment.vehicles.brand} {appointment.vehicles.model}
            </span>
          )}
          {appointment.vehicles?.vin && (
            <span className="font-mono text-[10px] text-gray-400 truncate">
              {appointment.vehicles.vin}
            </span>
          )}
        </div>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${getAppointmentStatusColor(appointment.status)}`}>
          {getAppointmentStatusText(appointment.status)}
        </span>
      </div>

      {/* Описание */}
      {appointment.description && (
        <p className="text-xs sm:text-sm text-gray-700 bg-white rounded px-2.5 py-2 border border-gray-100 whitespace-pre-wrap mb-2">
          {appointment.description}
        </p>
      )}

      {/* Оплата */}
      {((appointment.parts_cost || appointment.total_parts_cost || 0) > 0 || (appointment.total_work_cost || 0) > 0) && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs mb-2">
          {(appointment.parts_cost || appointment.total_parts_cost || 0) > 0 && (
            <span className={appointment.parts_paid ? 'text-green-600' : 'text-red-500'}>
              Запчасти: {appointment.parts_paid ? '✓ Оплачено' : '✗ Не оплачено'}
            </span>
          )}
          {(appointment.total_work_cost || 0) > 0 && (
            <span className={appointment.work_paid ? 'text-green-600' : 'text-red-500'}>
              Работы: {appointment.work_paid ? '✓ Оплачено' : '✗ Не оплачено'}
            </span>
          )}
        </div>
      )}

      {/* Дата */}
      <div className="flex items-center justify-between text-[10px] text-gray-400 pt-1.5 border-t border-gray-200">
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {new Date(appointment.scheduled_date).toLocaleDateString('ru-RU', {
            day: 'numeric', month: 'short', year: 'numeric'
          })}
        </span>
        <span>
          {formatDistanceToNow(new Date(appointment.created_at), { addSuffix: true, locale: ru })}
        </span>
      </div>
    </div>
  )
}
