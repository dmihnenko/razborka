import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Package, Phone, Mail, Link2, ShoppingCart, Plus, Minus, X, Trash2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ru } from 'date-fns/locale'
import { toast } from 'sonner'
import { formatCurrency, formatPrice } from '@/utils/currency'
import { getPartsOrderStatusColor, getPartsOrderStatusText } from '@/utils/status'
import { useUserProfile } from '@/hooks/useUserProfile'
import { getPartsInventory, createPartsOrder, createPartsOrderItem, updatePartsOrderTotal, updatePartsInventoryItem } from '@/services/partsService'

interface CartItem {
  id: string
  name: string
  part_number?: string
  price: number
  currency: 'UAH' | 'USD'
  quantity: number
  maxQty: number
}

export default function PartsCustomerProfile() {
  const { id } = useParams<{ id: string }>()
  const { data: profile } = useUserProfile()
  const partsCompanyId = profile?.parts_company_id
  const queryClient = useQueryClient()

  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false)
  const [cart, setCart] = useState<CartItem[]>([])
  const [orderNotes, setOrderNotes] = useState('')

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
            price_at_sale,
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

  // Available inventory for order creation
  const { data: inventory = [] } = useQuery({
    queryKey: ['parts-inventory', partsCompanyId],
    queryFn: () => getPartsInventory(partsCompanyId!),
    enabled: !!partsCompanyId && isOrderModalOpen,
  })
  const availableInventory = inventory.filter((i: any) => i.status === 'available')

  // Cart helpers
  const cartTotal = cart.reduce((s, i) => s + i.price * i.quantity, 0)

  const addToCart = (item: any) => {
    setCart(prev => {
      const existing = prev.find(c => c.id === item.id)
      if (existing) return prev.map(c => c.id === item.id ? { ...c, quantity: Math.min(c.quantity + 1, c.maxQty) } : c)
      return [...prev, {
        id: item.id,
        name: item.name,
        part_number: item.part_number,
        price: item.selling_price || 0,
        currency: (item.price_currency as 'UAH' | 'USD') || 'USD',
        quantity: 1,
        maxQty: item.quantity || 1,
      }]
    })
  }

  const removeFromCart = (itemId: string) => setCart(prev => prev.filter(c => c.id !== itemId))
  const updateCartQty = (itemId: string, qty: number) => setCart(prev =>
    prev.map(c => c.id === itemId ? { ...c, quantity: Math.max(1, Math.min(qty, c.maxQty)) } : c)
  )

  // Mutation: create order from cart
  const createOrderMutation = useMutation({
    mutationFn: async () => {
      if (!partsCompanyId) throw new Error('No company')
      const order = await createPartsOrder(partsCompanyId, {
        customer_id: id,
        notes: orderNotes || undefined,
        order_date: new Date().toISOString(),
      })
      for (const cartItem of cart) {
        await createPartsOrderItem(order.id, {
          inventory_item_id: cartItem.id,
          quantity: cartItem.quantity,
          price_at_sale: cartItem.price,
          price_at_sale_currency: cartItem.currency,
        })
        // Mark as sold if quantity becomes 0
        await updatePartsInventoryItem(cartItem.id, { status: 'sold', sold_price: cartItem.price, price_currency: cartItem.currency })
      }
      await updatePartsOrderTotal(order.id)
      return order
    },
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: ['parts-inventory'] })
      queryClient.invalidateQueries({ queryKey: ['parts-customer-orders', id] })
      queryClient.invalidateQueries({ queryKey: ['parts-customer', id] })
      toast.success(`Заказ ${order.order_number} создан`)
      setIsOrderModalOpen(false)
      setCart([])
      setOrderNotes('')
    },
    onError: () => toast.error('Ошибка при создании заказа'),
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
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setCart([]); setIsOrderModalOpen(true) }}
              className="flex items-center gap-2 px-4 py-2 bg-green-700 text-white rounded-md hover:bg-green-800 transition-colors"
            >
              <ShoppingCart className="w-5 h-5" />
              <span className="hidden sm:inline">Создать заказ</span>
            </button>
            <button
              onClick={handleCopyPublicLink}
              className="flex items-center gap-2 px-4 py-2 bg-blue-700 text-white rounded-md hover:bg-blue-800 transition-colors"
            >
              <Link2 className="w-5 h-5" />
              <span className="hidden sm:inline">Публичная ссылка</span>
            </button>
          </div>
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
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">Заказы не найдены</p>
        )}
      </div>

      {/* Order from inventory modal */}
      {isOrderModalOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={() => setIsOrderModalOpen(false)} />
          <div className="absolute inset-y-0 right-0 flex max-w-full">
            <div className="relative w-full max-w-2xl bg-white shadow-xl flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Новый заказ</h2>
                  <p className="text-sm text-gray-500">{customer.full_name}</p>
                </div>
                <button onClick={() => setIsOrderModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex flex-col md:flex-row flex-1 min-h-0">
                {/* Left: Available parts */}
                <div className="flex-1 overflow-y-auto p-4 border-r border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Склад в наличии ({availableInventory.length})</h3>
                  {availableInventory.length === 0 ? (
                    <p className="text-gray-400 text-sm text-center py-8">Нет доступных запчастей</p>
                  ) : (
                    <div className="space-y-2">
                      {availableInventory.map((item: any) => {
                        const inCart = cart.find(c => c.id === item.id)
                        return (
                          <div key={item.id} className={`flex items-center justify-between p-3 rounded-lg border ${inCart ? 'border-green-300 bg-green-50' : 'border-gray-200 hover:border-gray-300'}`}>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                              <p className="text-xs text-gray-500">
                                {item.part_number && `Арт: ${item.part_number} · `}
                                {item.selling_price ? formatPrice(item.selling_price, (item.price_currency as 'UAH' | 'USD') || 'USD') : 'Без цены'}
                              </p>
                            </div>
                            <button
                              onClick={() => addToCart(item)}
                              disabled={!!inCart && inCart.quantity >= inCart.maxQty}
                              className="ml-3 flex-shrink-0 p-1.5 rounded-lg bg-green-700 text-white hover:bg-green-800 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Right: Cart */}
                <div className="w-full md:w-72 flex flex-col border-t md:border-t-0 border-gray-100">
                  <div className="flex-1 overflow-y-auto p-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Корзина ({cart.length})</h3>
                    {cart.length === 0 ? (
                      <p className="text-gray-400 text-sm text-center py-8">Добавьте запчасти из списка</p>
                    ) : (
                      <div className="space-y-3">
                        {cart.map((item) => (
                          <div key={item.id} className="p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <p className="text-sm font-medium text-gray-900 leading-tight">{item.name}</p>
                              <button onClick={() => removeFromCart(item.id)} className="text-gray-400 hover:text-red-600 flex-shrink-0">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1">
                                <button onClick={() => updateCartQty(item.id, item.quantity - 1)} className="p-1 rounded border border-gray-200 hover:bg-gray-100">
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className="text-sm font-medium w-6 text-center">{item.quantity}</span>
                                <button onClick={() => updateCartQty(item.id, item.quantity + 1)} disabled={item.quantity >= item.maxQty} className="p-1 rounded border border-gray-200 hover:bg-gray-100 disabled:opacity-40">
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                              <span className="text-sm font-semibold text-primary">
                                {formatPrice(item.price * item.quantity, item.currency)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="p-4 border-t border-gray-200 bg-gray-50">
                    <textarea
                      value={orderNotes}
                      onChange={(e) => setOrderNotes(e.target.value)}
                      placeholder="Примечания к заказу..."
                      rows={2}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                    />
                    {cart.length > 0 && (
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-sm text-gray-600">Итого:</span>
                        <span className="text-base font-bold text-primary">{formatCurrency(cartTotal)}</span>
                      </div>
                    )}
                    <button
                      onClick={() => createOrderMutation.mutate()}
                      disabled={cart.length === 0 || createOrderMutation.isPending}
                      className="w-full px-4 py-2.5 bg-green-700 text-white rounded-lg text-sm font-medium hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {createOrderMutation.isPending ? 'Создание...' : `Создать заказ (${cart.length} поз.)`}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
