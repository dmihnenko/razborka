import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Package, Phone, Mail, Link2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ru } from 'date-fns/locale'
import { toast } from 'sonner'
import { formatCurrency } from '@/utils/currency'
import { getPartsOrderStatusColor, getPartsOrderStatusText } from '@/utils/status'

export default function PartsCustomerProfile() {
  const { id } = useParams<{ id: string }>()

  const handleCopyPublicLink = async () => {
    const publicUrl = `${window.location.origin}/public/parts-customer/${id}`
    try {
      await navigator.clipboard.writeText(publicUrl)
      toast.success('Публичная ссылка скопирована в буфер обмена', { duration: 2000 })
    } catch (err) {
      toast.error('Не удалось скопировать ссылку')
    }
  }

  // Получаем данные клиента разборки
  const { data: customer, isLoading: customerLoading } = useQuery({
    queryKey: ['parts-customer', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parts_customers')
        .select('*')
        .eq('id', id)
        .single()
      
      if (error) throw error
      return data
    },
  })

  // Получаем заказы клиента
  const { data: orders, isLoading: ordersLoading } = useQuery({
    queryKey: ['parts-customer-orders', id],
    queryFn: async () => {
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
        .eq('customer_id', id)
        .order('order_date', { ascending: false })
      
      if (error) throw error
      return data
    },
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
          to="/parts/customers"
          className="inline-flex items-center text-primary hover:text-primary/80"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Назад к клиентам
        </Link>
      </div>

      {/* Информация о клиенте */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-900">{customer.full_name}</h1>
          <button
            onClick={handleCopyPublicLink}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <Link2 className="w-5 h-5" />
            Публичная ссылка
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
        </div>

        {customer.discount_percent > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="inline-flex items-center px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
              Скидка {customer.discount_percent}%
            </div>
          </div>
        )}

        {customer.notes && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{customer.notes}</p>
          </div>
        )}

        {/* Статистика */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-gray-500">Всего заказов</div>
              <div className="text-2xl font-bold text-gray-900">{customer.total_orders || 0}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Общая сумма</div>
              <div className="text-2xl font-bold text-primary">{formatCurrency(customer.total_spent || 0)}</div>
            </div>
            {customer.total_orders > 0 && (
              <div>
                <div className="text-sm text-gray-500">Средний заказ</div>
                <div className="text-2xl font-bold text-gray-900">
                  {formatCurrency((customer.total_spent || 0) / customer.total_orders)}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* История заказов */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center mb-4">
          <Package className="w-6 h-6 mr-2 text-primary" />
          <h2 className="text-xl font-bold text-gray-900">
            История заказов ({orders?.length || 0})
          </h2>
        </div>

        {ordersLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : orders && orders.length > 0 ? (
          <div className="space-y-4">
            {orders.map((order: any) => (
              <Link
                key={order.id}
                to={`/parts/orders/${order.id}`}
                className="block border border-gray-200 rounded-lg p-4 hover:border-primary transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-gray-900">
                        Заказ {order.order_number}
                      </h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getPartsOrderStatusColor(order.status)}`}>
                        {getPartsOrderStatusText(order.status)}
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
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">Заказы не найдены</p>
        )}
      </div>
    </div>
  )
}
