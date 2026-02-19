import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Package, Clock } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ru } from 'date-fns/locale'

export default function PublicPartsCustomerView() {
  const { id } = useParams<{ id: string }>()

  // Получаем заказы клиента разборки
  const { data: orders, isLoading } = useQuery({
    queryKey: ['public-parts-customer-orders', id],
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

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      new: 'bg-blue-100 text-blue-800',
      in_progress: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  const getStatusText = (status: string) => {
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

  if (isLoading) {
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
                Публичная страница для просмотра заказов запчастей
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500">Заказов</div>
              <div className="text-2xl font-bold text-primary">{orders?.length || 0}</div>
            </div>
          </div>
        </div>

        {/* Заказы запчастей */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center mb-4">
            <Package className="w-6 h-6 mr-2 text-primary" />
            <h2 className="text-xl font-bold text-gray-900">
              Мои заказы
            </h2>
          </div>

          {orders && orders.length > 0 ? (
            <div className="space-y-4">
              {orders.map((order) => (
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
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                          {getStatusText(order.status)}
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
          ) : (
            <p className="text-gray-500 text-center py-8">Заказы не найдены</p>
          )}
        </div>

        {/* Футер */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Эта страница создана для вашего удобства</p>
          <p className="mt-1">Здесь вы можете отслеживать состояние ваших заказов в любое время</p>
        </div>
      </div>
    </div>
  )
}
