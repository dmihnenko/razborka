import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Car, FileText, Clock, Package } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ru } from 'date-fns/locale'

export default function PublicCustomerView() {
  const { id } = useParams<{ id: string }>()

  // Получаем данные клиента СТО (нужны для телефона)
  const { data: customer } = useQuery({
    queryKey: ['public-customer', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('phone')
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
        .order('appointment_date', { ascending: false })
      
      if (error) throw error
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
            unit_price,
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

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      in_progress: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
      archived: 'bg-gray-100 text-gray-800',
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  const getStatusText = (status: string) => {
    const statuses: Record<string, string> = {
      pending: 'Ожидает',
      in_progress: 'В работе',
      completed: 'Завершено',
      cancelled: 'Отменено',
      archived: 'Архив',
    }
    return statuses[status] || status
  }

  const getOrderStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      new: 'bg-blue-100 text-blue-800',
      in_progress: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  const getOrderStatusText = (status: string) => {
    const statuses: Record<string, string> = {
      new: 'Новый',
      in_progress: 'В обработке',
      completed: 'Выполнен',
      cancelled: 'Отменен',
    }
    return statuses[status] || status
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount) + ' ₴'
  }

  if (vehiclesLoading || appointmentsLoading || partsOrdersLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex justify-center items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-5xl mx-auto px-4">
        {/* Заголовок с скрытым именем */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Клиент: ******
              </h1>
              <p className="text-sm text-gray-500">
                Публичная страница для просмотра заявок и заказов
              </p>
            </div>
            <div className="flex gap-4 text-right">
              <div>
                <div className="text-sm text-gray-500">Автомобилей</div>
                <div className="text-2xl font-bold text-primary">{vehicles?.length || 0}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Заявок</div>
                <div className="text-2xl font-bold text-blue-600">{appointments?.length || 0}</div>
              </div>
              {partsOrders && partsOrders.length > 0 && (
                <div>
                  <div className="text-sm text-gray-500">Заказов</div>
                  <div className="text-2xl font-bold text-green-600">{partsOrders.length}</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Автомобили */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center mb-4">
            <Car className="w-6 h-6 mr-2 text-primary" />
            <h2 className="text-xl font-bold text-gray-900">
              Мои автомобили
            </h2>
          </div>

          {vehicles && vehicles.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {vehicles.map((vehicle) => (
                <div key={vehicle.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <h3 className="font-semibold text-gray-900 mb-3 text-lg">
                    {vehicle.brand} {vehicle.model}
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Номер:</span>
                      <span className="font-medium text-gray-900">{vehicle.license_plate}</span>
                    </div>
                    {vehicle.year && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Год:</span>
                        <span className="font-medium text-gray-900">{vehicle.year}</span>
                      </div>
                    )}
                    {vehicle.vin && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">VIN:</span>
                        <span className="font-medium text-gray-900 font-mono text-xs">{vehicle.vin}</span>
                      </div>
                    )}
                    {vehicle.color && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Цвет:</span>
                        <span className="font-medium text-gray-900">{vehicle.color}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">Автомобили не добавлены</p>
          )}
        </div>

        {/* История заявок */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center mb-4">
            <FileText className="w-6 h-6 mr-2 text-primary" />
            <h2 className="text-xl font-bold text-gray-900">
              История обслуживания
            </h2>
          </div>

          {appointments && appointments.length > 0 ? (
            <div className="space-y-4">
              {appointments.map((appointment) => (
                <div
                  key={appointment.id}
                  className="border border-gray-200 rounded-lg p-5 bg-gray-50"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-gray-900 text-lg">
                          Заявка #{appointment.request_number}
                        </h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(appointment.status)}`}>
                          {getStatusText(appointment.status)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-1">
                        {appointment.vehicles?.brand} {appointment.vehicles?.model} • {appointment.vehicles?.license_plate}
                      </p>
                    </div>
                  </div>
                  
                  <div className="mb-3 p-3 bg-white rounded border border-gray-100">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{appointment.description}</p>
                  </div>
                  
                  <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                    <div className="flex items-center text-sm text-gray-600">
                      <Clock className="w-4 h-4 mr-1" />
                      {new Date(appointment.appointment_date).toLocaleDateString('ru-RU', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </div>
                    <span className="text-xs text-gray-500">
                      {formatDistanceToNow(new Date(appointment.created_at), { 
                        addSuffix: true,
                        locale: ru 
                      })}
                    </span>
                  </div>

                  {/* Информация об оплате */}
                  {(appointment.parts_paid !== null || appointment.work_paid !== null) && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="flex gap-4 text-sm">
                        {appointment.parts_paid !== null && (
                          <div className="flex items-center">
                            <span className="text-gray-600 mr-2">Запчасти:</span>
                            <span className={`font-medium ${appointment.parts_paid ? 'text-green-600' : 'text-red-600'}`}>
                              {appointment.parts_paid ? '✓ Оплачено' : '✗ Не оплачено'}
                            </span>
                          </div>
                        )}
                        {appointment.work_paid !== null && (
                          <div className="flex items-center">
                            <span className="text-gray-600 mr-2">Работы:</span>
                            <span className={`font-medium ${appointment.work_paid ? 'text-green-600' : 'text-red-600'}`}>
                              {appointment.work_paid ? '✓ Оплачено' : '✗ Не оплачено'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">История обслуживания пуста</p>
          )}
        </div>

        {/* Заказы запчастей */}
        {partsOrders && partsOrders.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center mb-4">
              <Package className="w-6 h-6 mr-2 text-primary" />
              <h2 className="text-xl font-bold text-gray-900">
                Заказы запчастей
              </h2>
            </div>

            <div className="space-y-4">
              {partsOrders.map((order) => (
                <div
                  key={order.id}
                  className="border border-gray-200 rounded-lg p-5 bg-gray-50"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-gray-900 text-lg">
                          Заказ {order.order_number}
                        </h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getOrderStatusColor(order.status)}`}>
                          {getOrderStatusText(order.status)}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-primary">
                        {formatCurrency(order.total_amount)}
                      </div>
                    </div>
                  </div>
                  
                  {/* Список позиций */}
                  {order.items && order.items.length > 0 && (
                    <div className="mb-3 p-3 bg-white rounded border border-gray-100">
                      <div className="space-y-2">
                        {order.items.map((item: any) => (
                          <div key={item.id} className="flex justify-between text-sm">
                            <div className="flex-1">
                              <div className="font-medium text-gray-900">
                                {item.inventory_item?.name || 'Запчасть'}
                              </div>
                              {item.inventory_item?.part_number && (
                                <div className="text-xs text-gray-500">
                                  Артикул: {item.inventory_item.part_number}
                                </div>
                              )}
                            </div>
                            <div className="text-right">
                              <div className="text-gray-900">
                                {item.quantity} шт × {formatCurrency(item.unit_price)}
                              </div>
                              <div className="font-medium text-primary">
                                {formatCurrency(item.subtotal)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Примечания */}
                  {order.notes && (
                    <div className="mb-3 p-3 bg-blue-50 rounded border border-blue-100">
                      <p className="text-sm text-gray-700">{order.notes}</p>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                    <div className="flex items-center text-sm text-gray-600">
                      <Clock className="w-4 h-4 mr-1" />
                      {new Date(order.order_date).toLocaleDateString('ru-RU', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </div>
                    <span className="text-xs text-gray-500">
                      {formatDistanceToNow(new Date(order.created_at), { 
                        addSuffix: true,
                        locale: ru 
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Футер */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Эта страница создана для вашего удобства</p>
          <p className="mt-1">Здесь вы можете отслеживать состояние ваших заявок в любое время</p>
        </div>
      </div>
    </div>
  )
}
