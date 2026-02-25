import { useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Package, Phone, Mail, Link2, ShoppingCart, Plus, Minus, X, Trash2, Search, ChevronRight, Car } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ru } from 'date-fns/locale'
import { toast } from 'sonner'
import { formatCurrency, formatPrice } from '@/utils/currency'
import { getPartsOrderStatusColor, getPartsOrderStatusText } from '@/utils/status'
import { useUserProfile } from '@/hooks/useUserProfile'
import { getPartsInventory, createPartsOrder, createPartsOrderItem, updatePartsOrderTotal, updatePartsInventoryItem } from '@/services/partsService'
import { usePartsExchangeRate } from '@/hooks/usePartsExchangeRate'

interface CartItem {
  id: string
  name: string
  part_number?: string
  price: number
  currency: 'UAH' | 'USD'
  quantity: number
  maxQty: number
  vehicleInfo?: string  // e.g. "Tesla Model 3 2021 · AB1234"
}

export default function PartsCustomerProfile() {
  const { id } = useParams<{ id: string }>()
  const { data: profile } = useUserProfile()
  const partsCompanyId = profile?.parts_company_id
  const queryClient = useQueryClient()

  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false)
  const [cart, setCart] = useState<CartItem[]>([])
  const [orderNotes, setOrderNotes] = useState('')
  const [partsSearch, setPartsSearch] = useState('')
  const [selectedMake, setSelectedMake] = useState<string | null>(null)
  const [selectedModel, setSelectedModel] = useState<string | null>(null)
  const [mobileTab, setMobileTab] = useState<'parts' | 'cart'>('parts')

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

  // Vehicle filter derived data
  const makes = useMemo(() => {
    const vehicles: Record<string, Set<string>> = {}
    availableInventory.forEach((i: any) => {
      if (i.vehicle?.make && i.vehicle?.id) {
        if (!vehicles[i.vehicle.make]) vehicles[i.vehicle.make] = new Set()
        vehicles[i.vehicle.make].add(i.vehicle.id)
      }
    })
    return Object.entries(vehicles)
      .sort((a, b) => b[1].size - a[1].size)
      .map(([make, ids]) => ({ make, count: ids.size }))
  }, [availableInventory])

  const models = useMemo(() => {
    if (!selectedMake || selectedMake === '__all__') return []
    const vehicles: Record<string, Set<string>> = {}
    availableInventory
      .filter((i: any) => i.vehicle?.make === selectedMake)
      .forEach((i: any) => {
        if (i.vehicle?.model && i.vehicle?.id) {
          if (!vehicles[i.vehicle.model]) vehicles[i.vehicle.model] = new Set()
          vehicles[i.vehicle.model].add(i.vehicle.id)
        }
      })
    return Object.entries(vehicles)
      .sort((a, b) => b[1].size - a[1].size)
      .map(([model, ids]) => ({ model, count: ids.size }))
  }, [availableInventory, selectedMake])

  // Filter by selected make+model (strict equality — Model 3 never shown when Model Y selected)
  const vehicleFilteredInventory = useMemo(() => {
    if (selectedMake === null) return []
    if (selectedMake === '__all__') return availableInventory
    if (selectedModel === null) return []
    if (selectedModel === '__all__') return availableInventory.filter((i: any) => i.vehicle?.make === selectedMake)
    // Exact match: all parts from ALL vehicles of this make+model are shown as separate rows
    return availableInventory.filter((i: any) => i.vehicle?.make === selectedMake && i.vehicle?.model === selectedModel)
  }, [availableInventory, selectedMake, selectedModel])

  const filteredInventory = partsSearch.trim()
    ? vehicleFilteredInventory.filter((i: any) =>
        i.name?.toLowerCase().includes(partsSearch.toLowerCase()) ||
        i.part_number?.toLowerCase().includes(partsSearch.toLowerCase())
      )
    : vehicleFilteredInventory

  const { rate: usdRate } = usePartsExchangeRate()

  const cartTotalUAH = cart.reduce((s, i) => {
    const inUAH = i.currency === 'USD' ? i.price * usdRate : i.price
    return s + inUAH * i.quantity
  }, 0)
  const hasUSD = cart.some(i => i.currency === 'USD')
  const hasUAH = cart.some(i => i.currency === 'UAH')
  const mixedCurrencies = hasUSD && hasUAH

  const addToCart = (item: any) => {
    const vinShort = item.vehicle?.vin ? '·\u00a0' + item.vehicle.vin.slice(-6) : ''
    const vehicleInfo = item.vehicle
      ? `${item.vehicle.make} ${item.vehicle.model} ${item.vehicle.year ?? ''}${vinShort}`.trim()
      : undefined
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
        vehicleInfo,
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
      setSelectedMake(null)
      setSelectedModel(null)
      setPartsSearch('')
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
              onClick={() => { setCart([]); setPartsSearch(''); setSelectedMake(null); setSelectedModel(null); setMobileTab('parts'); setIsOrderModalOpen(true) }}
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
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsOrderModalOpen(false)} />
          <div className="relative w-full sm:max-w-4xl h-[96dvh] sm:h-[88vh] bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden">

            {/* ── Header ── */}
            <div className="flex items-center gap-3 px-4 py-3 border-b bg-white flex-shrink-0">
              {/* Mobile: tabs left, close right */}
              <div className="flex md:hidden bg-gray-100 rounded-xl p-0.5 flex-1">
                <button
                  onClick={() => setMobileTab('parts')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${mobileTab === 'parts' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
                >
                  Запчасти
                </button>
                <button
                  onClick={() => setMobileTab('cart')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${mobileTab === 'cart' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
                >
                  Корзина
                  {cart.length > 0 && (
                    <span className="bg-green-600 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5">
                      {cart.length}
                    </span>
                  )}
                </button>
              </div>
              {/* Desktop: title */}
              <div className="hidden md:flex flex-col">
                <span className="text-base font-semibold text-gray-900">Новый заказ</span>
                <span className="text-xs text-gray-400">{customer.full_name}</span>
              </div>
              <div className="hidden md:block ml-auto" />
              <button
                onClick={() => setIsOrderModalOpen(false)}
                className="flex-shrink-0 p-2 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="flex flex-1 min-h-0">

              {/* ══ LEFT PANEL: Vehicle wizard + parts list ══ */}
              <div className={`flex-1 min-h-0 flex flex-col ${mobileTab === 'cart' ? 'hidden md:flex' : 'flex'} md:border-r border-gray-100`}>

                {/* ── Step 1: Pick make ── */}
                {selectedMake === null && (
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Марка автомобиля</p>
                      {makes.length === 0 ? (
                        <div className="text-center py-12 text-gray-400 text-sm">Нет запчастей в наличии</div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2.5">
                          {makes.map(({ make, count }) => (
                            <button
                              key={make}
                              onClick={() => { setSelectedMake(make); setSelectedModel(null); setPartsSearch('') }}
                              className="group flex flex-col items-start gap-1 p-4 rounded-2xl border-2 border-gray-100 hover:border-primary hover:bg-primary/5 active:scale-[0.97] transition-all text-left"
                            >
                              <Car className="w-5 h-5 text-gray-300 group-hover:text-primary transition-colors mb-0.5" />
                              <span className="font-semibold text-gray-900 text-sm leading-tight">{make}</span>
                              <span className="text-xs text-gray-400">{count} авт.</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => { setSelectedMake('__all__'); setSelectedModel('__all__'); setPartsSearch('') }}
                      className="w-full py-3 rounded-2xl border-2 border-dashed border-gray-200 text-sm font-medium text-gray-500 hover:border-primary hover:text-primary hover:bg-primary/5 transition-all"
                    >
                      Показать все запчасти без фильтра
                    </button>
                  </div>
                )}

                {/* ── Step 2: Pick model ── */}
                {selectedMake !== null && selectedMake !== '__all__' && selectedModel === null && (
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {/* Breadcrumb */}
                    <div className="flex items-center gap-1.5 text-sm">
                      <button
                        onClick={() => { setSelectedMake(null); setSelectedModel(null) }}
                        className="text-primary hover:underline font-medium"
                      >
                        Марка
                      </button>
                      <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                      <span className="font-bold text-gray-900">{selectedMake}</span>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Модель</p>
                      <div className="grid grid-cols-2 gap-2.5">
                        {models.map(({ model, count }) => (
                          <button
                            key={model}
                            onClick={() => { setSelectedModel(model); setPartsSearch('') }}
                            className="group flex flex-col items-start gap-1 p-4 rounded-2xl border-2 border-gray-100 hover:border-primary hover:bg-primary/5 active:scale-[0.97] transition-all text-left"
                          >
                            <span className="font-semibold text-gray-900 text-sm leading-tight">{model}</span>
                            <span className="text-xs text-gray-400">{count} авт.</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={() => { setSelectedModel('__all__'); setPartsSearch('') }}
                      className="w-full py-3 rounded-2xl border-2 border-dashed border-gray-200 text-sm font-medium text-gray-500 hover:border-primary hover:text-primary hover:bg-primary/5 transition-all"
                    >
                      Все модели {selectedMake}
                    </button>
                  </div>
                )}

                {/* ── Step 3: Search + parts list ── */}
                {selectedMake !== null && (selectedMake === '__all__' || selectedModel !== null) && (
                  <div className="flex-1 min-h-0 flex flex-col">
                    {/* Breadcrumb + search */}
                    <div className="px-4 pt-3 pb-2 flex-shrink-0 space-y-2.5 border-b border-gray-50">
                      <div className="flex items-center gap-1.5 text-sm flex-wrap">
                        <button
                          onClick={() => { setSelectedMake(null); setSelectedModel(null); setPartsSearch('') }}
                          className="text-primary hover:underline font-medium"
                        >
                          Марка
                        </button>
                        {selectedMake !== '__all__' && (
                          <>
                            <ChevronRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                            <button
                              onClick={() => { setSelectedModel(null); setPartsSearch('') }}
                              className="text-primary hover:underline font-medium"
                            >
                              {selectedMake}
                            </button>
                            <ChevronRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                            <span className="font-bold text-gray-900 truncate">
                              {selectedModel === '__all__' ? 'Все модели' : selectedModel}
                            </span>
                          </>
                        )}
                        {selectedMake === '__all__' && (
                          <span className="font-bold text-gray-900">Все запчасти</span>
                        )}
                        <span className="ml-auto flex-shrink-0 text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5 font-medium">
                          {filteredInventory.length} шт.
                        </span>
                      </div>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          value={partsSearch}
                          onChange={e => setPartsSearch(e.target.value)}
                          placeholder="Поиск по названию или артикулу..."
                          className="w-full pl-9 pr-9 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-colors"
                          autoFocus
                        />
                        {partsSearch && (
                          <button
                            onClick={() => setPartsSearch('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Parts list */}
                    <div className="flex-1 min-h-0 overflow-y-auto p-3">
                      {filteredInventory.length === 0 ? (
                        <div className="text-center py-12 text-gray-400 text-sm">
                          {partsSearch ? 'Ничего не найдено' : 'Нет запчастей в наличии'}
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {filteredInventory.map((item: any) => {
                            const inCart = cart.find(c => c.id === item.id)
                            const vinShort = item.vehicle?.vin ? item.vehicle.vin.slice(-6) : null
                            const vehicleLabel = item.vehicle
                              ? `${item.vehicle.make} ${item.vehicle.model}${item.vehicle.year ? ' ' + item.vehicle.year : ''}${vinShort ? ' · ' + vinShort : ''}`
                              : null
                            return (
                              <div
                                key={item.id}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all ${
                                  inCart
                                    ? 'border-green-200 bg-green-50'
                                    : 'border-gray-100 bg-gray-50/60 hover:border-gray-200 hover:bg-white'
                                }`}
                              >
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm font-semibold leading-tight truncate ${inCart ? 'text-green-900' : 'text-gray-900'}`}>
                                    {item.name}
                                  </p>
                                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                    {vehicleLabel && (
                                      <span className="text-xs text-gray-400 truncate">
                                        {vehicleLabel}
                                      </span>
                                    )}
                                    {item.part_number && (
                                      <span className="text-xs text-gray-300">·</span>
                                    )}
                                    {item.part_number && (
                                      <span className="text-xs font-mono text-gray-400">{item.part_number}</span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2.5 flex-shrink-0">
                                  <span className="text-sm font-bold text-gray-800 whitespace-nowrap tabular-nums">
                                    {item.selling_price
                                      ? formatPrice(item.selling_price, (item.price_currency as 'UAH' | 'USD') || 'USD')
                                      : <span className="text-gray-300 font-normal text-xs">—</span>
                                    }
                                  </span>
                                  <button
                                    onClick={() => addToCart(item)}
                                    disabled={!!inCart && inCart.quantity >= inCart.maxQty}
                                    className={`w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0 transition-all ${
                                      inCart
                                        ? 'bg-green-600 text-white shadow-sm disabled:opacity-40'
                                        : 'bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-40'
                                    } disabled:cursor-not-allowed`}
                                  >
                                    <Plus className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* ══ RIGHT PANEL: Cart ══ */}
              <div className={`w-full md:w-[280px] md:flex flex-col flex-shrink-0 bg-gray-50/50 ${mobileTab === 'cart' ? 'flex' : 'hidden md:flex'}`}>
                {/* Cart items */}
                <div className="flex-1 min-h-0 overflow-y-auto p-3">
                  {cart.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center py-12 text-gray-400">
                      <ShoppingCart className="w-10 h-10 mb-3 opacity-20" />
                      <p className="text-sm">Добавьте запчасти<br/>из списка слева</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {cart.map((item) => (
                        <div key={item.id} className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-900 leading-tight">{item.name}</p>
                              {item.vehicleInfo && (
                                <p className="text-xs text-gray-400 mt-0.5 truncate">{item.vehicleInfo}</p>
                              )}
                            </div>
                            <button
                              onClick={() => removeFromCart(item.id)}
                              className="flex-shrink-0 p-1 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => updateCartQty(item.id, item.quantity - 1)}
                                className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
                              >
                                <Minus className="w-3 h-3 text-gray-600" />
                              </button>
                              <span className="text-sm font-bold w-7 text-center text-gray-900">{item.quantity}</span>
                              <button
                                onClick={() => updateCartQty(item.id, item.quantity + 1)}
                                disabled={item.quantity >= item.maxQty}
                                className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                              >
                                <Plus className="w-3 h-3 text-gray-600" />
                              </button>
                            </div>
                            <span className="text-sm font-bold text-primary">
                              {formatPrice(item.price * item.quantity, item.currency)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="p-3 border-t border-gray-200 flex-shrink-0 space-y-2.5">
                  <textarea
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    placeholder="Примечания к заказу..."
                    rows={2}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-primary resize-none placeholder:text-gray-400"
                  />
                  {cart.length > 0 && (
                    <div className="space-y-1 px-1">
                      {mixedCurrencies && (
                        <>
                          {hasUSD && (
                            <div className="flex justify-between items-center text-xs text-gray-400">
                              <span>Долларовые позиции ×{usdRate}</span>
                              <span>{formatCurrency(cart.filter(i => i.currency === 'USD').reduce((s, i) => s + i.price * i.quantity, 0) * usdRate)}</span>
                            </div>
                          )}
                          {hasUAH && (
                            <div className="flex justify-between items-center text-xs text-gray-400">
                              <span>Гривневые позиции</span>
                              <span>{formatCurrency(cart.filter(i => i.currency === 'UAH').reduce((s, i) => s + i.price * i.quantity, 0))}</span>
                            </div>
                          )}
                        </>
                      )}
                      <div className="flex justify-between items-center pt-1 border-t border-gray-200">
                        <span className="text-sm text-gray-500 font-medium">Итого</span>
                        <span className="text-lg font-bold text-primary">{formatCurrency(cartTotalUAH)}</span>
                      </div>
                    </div>
                  )}
                  <button
                    onClick={() => createOrderMutation.mutate()}
                    disabled={cart.length === 0 || createOrderMutation.isPending}
                    className="w-full py-3 bg-green-700 text-white rounded-xl text-sm font-semibold hover:bg-green-800 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
                  >
                    {createOrderMutation.isPending
                      ? 'Создание...'
                      : cart.length === 0
                        ? 'Корзина пуста'
                        : `Создать заказ · ${cart.length} поз.`
                    }
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
