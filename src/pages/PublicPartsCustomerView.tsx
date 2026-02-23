import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Package, Clock } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ru } from 'date-fns/locale'
import { getPartsOrderStatusColor, getPartsOrderStatusText } from '@/utils/status'
import { formatCurrency } from '@/utils/currency'

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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex justify-center items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-4 sm:py-8">
      <div className="max-w-5xl mx-auto px-3 sm:px-4">
        {/* Заголовок с скрытым именем */}
        <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-3xl font-bold text-gray-900 mb-1 sm:mb-2">
                Клиент: ******
              </h1>
              <p className="text-xs sm:text-sm text-gray-500">
                Публичная страница для просмотра заказов запчастей
              </p>
            </div>
            <div className="text-center sm:text-right">
              <div className="text-xs sm:text-sm text-gray-500">Заказов</div>
              <div className="text-xl sm:text-2xl font-bold text-primary">{orders?.length || 0}</div>
            </div>
          </div>
        </div>

        {/* Заказы запчастей */}
        <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 mb-4 sm:mb-6">
          <div className="flex items-center mb-3 sm:mb-4">
            <Package className="w-5 h-5 sm:w-6 sm:h-6 mr-2 text-primary" />
            <h2 className="text-lg sm:text-xl font-bold text-gray-900">
              Мои заказы
            </h2>
          </div>

          {orders && orders.length > 0 ? (
            <div className="space-y-3 sm:space-y-4">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="border border-gray-200 rounded-lg p-3 sm:p-5 bg-gray-50"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-2 sm:mb-3 gap-2">
                    <div className="flex-1">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
                        <h3 className="font-semibold text-gray-900 text-base sm:text-lg">
                          Заказ {order.order_number}
                        </h3>
                        <span className={`px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs font-medium ${getPartsOrderStatusColor(order.status)} w-fit`}>
                          {getPartsOrderStatusText(order.status)}
                        </span>
                      </div>
                    </div>
                    <div className="sm:text-right">
                      <div className="text-base sm:text-lg font-bold text-primary">
                        {formatCurrency(order.total_amount)}
                      </div>
                    </div>
                  </div>
                  
                  {/* Список позиций */}
                  {order.items && order.items.length > 0 && (
                    <div className="mb-2 sm:mb-3 p-2 sm:p-3 bg-white rounded border border-gray-100">
                      <div className="space-y-2">
                        {order.items.map((item: any) => (
                          <div key={item.id} className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-2 text-xs sm:text-sm pb-2 last:pb-0 border-b last:border-b-0 border-gray-100">
                            <div className="flex-1">
                              <div className="font-medium text-gray-900">
                                {item.inventory_item?.name || 'Запчасть'}
                              </div>
                              {item.inventory_item?.part_number && (
                                <div className="text-[10px] sm:text-xs text-gray-500">
                                  Артикул: {item.inventory_item.part_number}
                                </div>
                              )}
                            </div>
                            <div className="sm:text-right">
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
                    <div className="mb-2 sm:mb-3 p-2 sm:p-3 bg-blue-50 rounded border border-blue-100">
                      <p className="text-xs sm:text-sm text-gray-700">{order.notes}</p>
                    </div>
                  )}
                  
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pt-2 sm:pt-3 border-t border-gray-200 gap-2">
                    <div className="flex items-center text-xs sm:text-sm text-gray-600">
                      <Clock className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                      {new Date(order.order_date).toLocaleDateString('ru-RU', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </div>
                    <span className="text-[10px] sm:text-xs text-gray-500">
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
            <p className="text-gray-500 text-center py-6 sm:py-8 text-sm">Заказы не найдены</p>
          )}
        </div>

        {/* Футер */}
        <div className="mt-6 sm:mt-8 text-center text-xs sm:text-sm text-gray-500 px-2">
          <p>Эта страница создана для вашего удобства</p>
          <p className="mt-1">Здесь вы можете отслеживать состояние ваших заказов в любое время</p>
        </div>
      </div>
    </div>
  )
}
