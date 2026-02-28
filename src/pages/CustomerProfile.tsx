import { useParams, Link, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Car, FileText, Phone, Mail, MapPin, Link2, Package, Plus, ChevronDown } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ru } from 'date-fns/locale'
import { toast } from 'sonner'
import { useState } from 'react'
import VehicleModal from '@/components/VehicleModal'
import { formatCurrency } from '@/utils/currency'
import { getStatusColor, getStatusText, getOrderStatusColor, getOrderStatusText } from '@/utils/status'

export default function CustomerProfile() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const [showVehicleModal, setShowVehicleModal] = useState(false)
  const [vehiclesExpanded, setVehiclesExpanded] = useState(false)

  const handleCopyPublicLink = async () => {
    const publicUrl = `${window.location.origin}/public/customer/${id}`
    try {
      await navigator.clipboard.writeText(publicUrl)
      toast.success('Публичная ссылка скопирована в буфер обмена', { duration: 2000 })
    } catch (err) {
      toast.error('Не удалось скопировать ссылку')
    }
  }

  // Получаем данные клиента
  const { data: customer, isLoading: customerLoading } = useQuery({
    queryKey: ['customer', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', id)
        .single()
      
      if (error) throw error
      return data
    },
  })

  // Получаем автомобили клиента
  const { data: vehicles, isLoading: vehiclesLoading } = useQuery({
    queryKey: ['customer-vehicles', id],
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
    queryKey: ['customer-appointments', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select('*, vehicles(brand, model, license_plate)')
        .eq('customer_id', id)
        .order('scheduled_date', { ascending: false })
      
      if (error) throw error
      return data
    },
  })

  // Получаем заказы запчастей клиента (через связь по телефону)
  const { data: partsOrders } = useQuery({
    queryKey: ['customer-parts-orders', customer?.phone],
    queryFn: async () => {
      if (!customer?.phone) return []
      
      // Находим parts_customer по телефону
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

  if (customerLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Клиент не найден</p>
      </div>
    )
  }



  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <Link
          to="/customers"
          className="inline-flex items-center text-primary hover:text-primary/80"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Назад к клиентам
        </Link>
      </div>

      {/* Информация о клиенте */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-900">{customer.name}</h1>
          <button
            onClick={handleCopyPublicLink}
            className="flex items-center gap-2 px-4 py-2 bg-blue-700 text-white rounded-md hover:bg-blue-800 transition-colors"
          >
            <Link2 className="w-5 h-5" />
            Ссылка клиента
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {customer.phone && (
            <div className="flex items-center text-gray-600">
              <Phone className="w-5 h-5 mr-3 text-gray-400" />
              <span>{customer.phone}</span>
            </div>
          )}
          
          {customer.email && (
            <div className="flex items-center text-gray-600">
              <Mail className="w-5 h-5 mr-3 text-gray-400" />
              <span>{customer.email}</span>
            </div>
          )}
          
          {customer.address && (
            <div className="flex items-center text-gray-600 md:col-span-2">
              <MapPin className="w-5 h-5 mr-3 text-gray-400" />
              <span>{customer.address}</span>
            </div>
          )}
        </div>

        {customer.notes && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{customer.notes}</p>
          </div>
        )}
      </div>

      {/* Секция автомобилей */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setVehiclesExpanded(!vehiclesExpanded)}
            className="flex items-center gap-2 flex-1 text-left"
          >
            <Car className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-bold text-gray-900">
              Автомобили ({vehicles?.length || 0})
            </h2>
            <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ml-1 ${vehiclesExpanded ? 'rotate-180' : ''}`} />
          </button>
          <button
            onClick={() => setShowVehicleModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Добавить авто
          </button>
        </div>

        {vehiclesExpanded && (
          vehiclesLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : vehicles && vehicles.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {vehicles.map((vehicle) => (
                <div key={vehicle.id} className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-2">
                    {vehicle.brand} {vehicle.model}
                  </h3>
                  <div className="space-y-1 text-sm text-gray-600">
                    <p>Номер: <span className="font-medium">{vehicle.license_plate}</span></p>
                    {vehicle.year && <p>Год: {vehicle.year}</p>}
                    {vehicle.vin && <p>VIN: {vehicle.vin}</p>}
                    {vehicle.color && <p>Цвет: {vehicle.color}</p>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">Автомобили не добавлены</p>
          )
        )}
      </div>

      {/* История заявок */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center mb-4">
          <FileText className="w-6 h-6 mr-2 text-primary" />
          <h2 className="text-xl font-bold text-gray-900">
            История заявок ({appointments?.length || 0})
          </h2>
        </div>

        {appointmentsLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : appointments && appointments.length > 0 ? (
          (() => {
            const active = appointments.filter((a: any) => a.status !== 'archived')
            const archived = appointments.filter((a: any) => a.status === 'archived')
            const renderCard = (appointment: any) => (
              <Link
                key={appointment.id}
                to={`/sto/appointments/${appointment.id}`}
                state={{ from: location.pathname }}
                className="block border border-gray-200 rounded-lg p-4 hover:border-primary transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      Заявка <span className="text-gray-400 font-normal opacity-60">#{appointment.request_number}</span>
                    </h3>
                    <p className="text-sm text-gray-600">
                      {appointment.vehicles?.brand} {appointment.vehicles?.model} • {appointment.vehicles?.license_plate}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(appointment.status)}`}>
                    {getStatusText(appointment.status)}
                  </span>
                </div>
                <p className="text-sm text-gray-700 mb-2">{appointment.description}</p>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{new Date(appointment.appointment_date).toLocaleDateString('ru-RU')}</span>
                  <span>{formatDistanceToNow(new Date(appointment.created_at), { addSuffix: true, locale: ru })}</span>
                </div>
              </Link>
            )
            return (
              <div className="space-y-4">
                {active.length > 0 && (
                  <div className="space-y-3">
                    {active.length > 0 && archived.length > 0 && (
                      <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Активные</p>
                    )}
                    {active.map(renderCard)}
                  </div>
                )}
                {archived.length > 0 && (
                  <div className="space-y-3">
                    {active.length > 0 && (
                      <p className="text-sm font-medium text-gray-400 uppercase tracking-wide mt-2">Архив</p>
                    )}
                    {archived.map(renderCard)}
                  </div>
                )}
              </div>
            )
          })()
        ) : (
          <p className="text-gray-500 text-center py-8">Заявки не найдены</p>
        )}
      </div>

      {/* Заказы запчастей */}
      {partsOrders && partsOrders.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center mb-4">
            <Package className="w-6 h-6 mr-2 text-primary" />
            <h2 className="text-xl font-bold text-gray-900">
              Заказы запчастей ({partsOrders.length})
            </h2>
          </div>

          <div className="space-y-4">
            {partsOrders.map((order: any) => (
              <div
                key={order.id}
                className="border border-gray-200 rounded-lg p-4"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-gray-900">
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
                  <div className="mb-3 p-3 bg-gray-50 rounded">
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
                              {item.quantity} шт × {formatCurrency(item.price_at_sale)}
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

                {order.notes && (
                  <div className="mb-2 p-2 bg-blue-50 rounded text-sm text-gray-700">
                    {order.notes}
                  </div>
                )}
                
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>
                    {new Date(order.order_date).toLocaleDateString('ru-RU')}
                  </span>
                  <span>
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

      {/* Модалка добавления автомобиля */}
      {showVehicleModal && (
        <VehicleModal
          onClose={() => setShowVehicleModal(false)}
          customerId={id}
          customerName={customer.name}
        />
      )}
    </div>
  )
}
