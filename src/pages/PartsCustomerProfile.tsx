import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Spinner } from '@/components/ui/Spinner'
import PartsPageHeader from '@/components/parts/PartsPageHeader'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import {
  ArrowLeft, Package, Phone, Mail, Link2, ShoppingCart,
  Plus, Minus, X, Trash2, Search, ChevronRight, Car,
  MapPin, Truck, User,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ru } from 'date-fns/locale'
import { toast } from 'sonner'
import { formatCurrency, formatPrice } from '@/utils/currency'
import { statusBadgeClass, getPartsOrderStatusText } from '@/utils/status'
import { useUserProfile } from '@/hooks/useUserProfile'
import {
  getPartsInventory,
  createPartsOrder,
  createPartsOrderItem,
  updatePartsOrderTotal,
  updatePartsInventoryItem,
} from '@/services/partsService'
import { usePartsExchangeRate } from '@/hooks/usePartsExchangeRate'

interface CartItem {
  id: string
  name: string
  part_number?: string
  price: number
  currency: 'UAH' | 'USD'
  quantity: number
  maxQty: number
  vehicleInfo?: string
}

/** Инициалы для аватара */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

const AVATAR_COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-violet-100 text-violet-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
]
function avatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

export default function PartsCustomerProfile() {
  const { t } = useTranslation('cabinet')
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
      toast.success(t('customerProfilePage.linkCopied'), { duration: 2000 })
    } catch {
      toast.error(t('customerProfilePage.linkCopyError'))
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

  const vehicleFilteredInventory = useMemo(() => {
    if (selectedMake === null) return []
    if (selectedMake === '__all__') return availableInventory
    if (selectedModel === null) return []
    if (selectedModel === '__all__') return availableInventory.filter((i: any) => i.vehicle?.make === selectedMake)
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
    // USD-позиция без курса — пропускаем конвертацию (без NaN; пересчитается, когда курс придёт)
    const inUAH = i.currency === 'USD' ? (usdRate != null ? i.price * usdRate : 0) : i.price
    return s + inUAH * i.quantity
  }, 0)
  const hasUSD = cart.some(i => i.currency === 'USD')
  const hasUAH = cart.some(i => i.currency === 'UAH')
  const mixedCurrencies = hasUSD && hasUAH

  const addToCart = (item: any) => {
    const vinShort = item.vehicle?.vin ? '· ' + item.vehicle.vin.slice(-6) : ''
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
        await updatePartsInventoryItem(cartItem.id, { status: 'reserved' })
      }
      await updatePartsOrderTotal(order.id, usdRate)
      return order
    },
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: ['parts-inventory'] })
      queryClient.invalidateQueries({ queryKey: ['parts-customer-orders', id] })
      queryClient.invalidateQueries({ queryKey: ['parts-customer', id] })
      toast.success(t('customerProfilePage.orderCreated', { number: order.order_number }))
      setIsOrderModalOpen(false)
      setCart([])
      setOrderNotes('')
      setSelectedMake(null)
      setSelectedModel(null)
      setPartsSearch('')
    },
    onError: () => toast.error(t('customerProfilePage.orderCreateError')),
  })

  // ── Loading / not found ───────────────────────────────────────────────
  if (customerLoading) {
    return (
      <div className="flex justify-center items-center min-h-dvh bg-gray-50">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="empty-state py-24 min-h-dvh bg-gray-50">
        <div className="empty-state-icon">
          <User className="w-7 h-7 text-gray-400" />
        </div>
        <p className="empty-state-title">{t('customerProfilePage.notFoundTitle')}</p>
        <p className="empty-state-text">{t('customerProfilePage.notFoundText')}</p>
        <Link to="/parts/customers" className="cab-btn cab-btn-secondary cab-btn-sm mt-4">
          <ArrowLeft className="w-3.5 h-3.5" />
          {t('customerProfilePage.toCustomers')}
        </Link>
      </div>
    )
  }

  const initials = getInitials(customer.full_name)
  const avatarCls = avatarColor(customer.full_name)

  return (
    <div className="min-h-dvh bg-gray-50 animate-fade-in">

      {/* ── Sticky page header ─────────────────────────────────────────── */}
      <PartsPageHeader
        title={customer.full_name}
        subtitle={t('customerProfilePage.title')}
        backPath="/parts/customers"
        actions={
          <>
            <button
              onClick={handleCopyPublicLink}
              className="cab-btn cab-btn-secondary cab-btn-sm"
              title={t('customerProfilePage.copyPublicLink')}
            >
              <Link2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t('customerProfilePage.link')}</span>
            </button>
            <button
              onClick={() => {
                setCart([])
                setPartsSearch('')
                setSelectedMake(null)
                setSelectedModel(null)
                setMobileTab('parts')
                setIsOrderModalOpen(true)
              }}
              className="cab-btn cab-btn-success cab-btn-sm"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t('customerProfilePage.createOrder')}</span>
            </button>
          </>
        }
      />

      <div className="w-full py-5 sm:py-6">

      {/* ── Hero-карточка клиента ───────────────────────────────────────── */}
      <div className="cab-card p-4 mb-5">
        {/* Верхняя строка: аватар + имя + бейдж скидки */}
        <div className="flex items-start gap-4 mb-5">
          <div className={`avatar-lg flex-shrink-0 text-base font-bold ${avatarCls}`}>
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="heading-3 truncate">{customer.full_name}</h2>
            {customer.discount_percent > 0 && (
              <span className="cab-chip mt-1 bg-emerald-50 text-emerald-700 border-emerald-200/60">
                {t('customerProfilePage.discount', { percent: customer.discount_percent })}
              </span>
            )}
          </div>
        </div>

        {/* Контактные данные — icon-tile + значение, без kicker */}
        <div className="flex flex-wrap gap-x-4 gap-y-2 mb-3">
          {customer.phone && (
            <div className="flex items-center gap-2">
              <span className="icon-tile-sm bg-slate-100 text-slate-700 flex-shrink-0">
                <Phone className="w-3.5 h-3.5" />
              </span>
              <span className="text-sm font-medium text-gray-900">{customer.phone}</span>
            </div>
          )}
          {customer.email && (
            <div className="flex items-center gap-2">
              <span className="icon-tile-sm bg-slate-100 text-slate-700 flex-shrink-0">
                <Mail className="w-3.5 h-3.5" />
              </span>
              <span className="text-sm font-medium text-gray-900">{customer.email}</span>
            </div>
          )}
          {customer.city && (
            <div className="flex items-center gap-2">
              <span className="icon-tile-sm bg-slate-50 text-slate-500 flex-shrink-0">
                <MapPin className="w-3.5 h-3.5" />
              </span>
              <span className="text-sm font-medium text-gray-900">{customer.city}</span>
            </div>
          )}
          {customer.np_office && (
            <div className="flex items-center gap-2">
              <span className="icon-tile-sm bg-slate-50 text-slate-500 flex-shrink-0">
                <Truck className="w-3.5 h-3.5" />
              </span>
              <span className="text-sm font-medium text-gray-900">{customer.np_office}</span>
            </div>
          )}
        </div>

        {customer.notes && (
          <div className="alert alert-info text-xs mb-3">{customer.notes}</div>
        )}

        {/* Статистика — inline строка */}
        <div className="section-divider" />
        <p className="text-sm text-gray-600 tabular-nums">
          <span className="font-bold text-gray-900">{customer.total_orders || 0}</span>
          {' '}{(customer.total_orders || 0) === 1 ? t('customerProfilePage.orderOne') : (customer.total_orders || 0) < 5 ? t('customerProfilePage.orderFew') : t('customerProfilePage.orderMany')}
          {(customer.total_spent || 0) > 0 && (
            <>
              {' · '}
              <span className="font-bold text-primary">{formatCurrency(customer.total_spent || 0)}</span>
            </>
          )}
          {(customer.total_orders || 0) > 0 && (customer.total_spent || 0) > 0 && (
            <>
              {' · ' + t('customerProfilePage.avgPrefix') + ' '}
              <span className="font-bold text-gray-900">
                {formatCurrency((customer.total_spent || 0) / customer.total_orders)}
              </span>
            </>
          )}
        </p>
      </div>

      {/* ── Секция заказов ─────────────────────────────────────────────── */}
      <div className="cab-card p-4">
        {/* Заголовок секции */}
        <div className="flex items-center gap-3 mb-4">
          <span className="icon-tile bg-slate-100 text-slate-700">
            <Package className="w-5 h-5" />
          </span>
          <div>
            <h2 className="heading-3">{t('customerProfilePage.customerOrders')}</h2>
            <p className="page-subtitle">
              {ordersLoading ? '…' : t('customerProfilePage.recordsCount', { count: orders?.length || 0 })}
            </p>
          </div>
        </div>

        {ordersLoading ? (
          <div className="flex justify-center py-10">
            <Spinner size="md" />
          </div>
        ) : orders && orders.length > 0 ? (
          <>
            {/* Desktop — таблица */}
            <div className="hidden sm:block overflow-x-auto -mx-5">
              <table className="w-full min-w-[560px]">
                <thead>
                  <tr>
                    <th className="table-header-cell">{t('customerProfilePage.colOrder')}</th>
                    <th className="table-header-cell">{t('customerProfilePage.colDate')}</th>
                    <th className="table-header-cell">{t('customerProfilePage.colItems')}</th>
                    <th className="table-header-cell">{t('customerProfilePage.colStatus')}</th>
                    <th className="table-header-cell text-right">{t('customerProfilePage.colTotal')}</th>
                  </tr>
                </thead>
                <tbody className="grid-hairline">
                  {orders.map((order: any) => (
                    <tr key={order.id} className="table-row">
                      <td className="table-cell">
                        <Link
                          to={`/parts/orders/${order.id}`}
                          className="font-semibold text-primary hover:underline"
                        >
                          {order.order_number}
                        </Link>
                      </td>
                      <td className="table-cell text-gray-500">
                        {new Date(order.order_date).toLocaleDateString('ru-RU')}
                      </td>
                      <td className="table-cell text-gray-500">
                        {t('customerProfilePage.itemsPcs', { count: order.items?.length || 0 })}
                      </td>
                      <td className="table-cell">
                        <span className={statusBadgeClass(order.status)}>
                          {getPartsOrderStatusText(order.status)}
                        </span>
                      </td>
                      <td className="table-cell text-right font-bold text-primary tabular-nums">
                        {formatCurrency(order.total_amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile — карточки */}
            <div className="sm:hidden space-y-2">
              {orders.map((order: any) => (
                <Link
                  key={order.id}
                  to={`/parts/orders/${order.id}`}
                  className="block cab-card cab-card-hover p-3"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {order.order_number}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(order.order_date).toLocaleDateString('ru-RU')}
                        {' · '}
                        {formatDistanceToNow(new Date(order.created_at), { addSuffix: true, locale: ru })}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className="text-sm font-bold text-primary tabular-nums">
                        {formatCurrency(order.total_amount)}
                      </span>
                      <span className={statusBadgeClass(order.status)}>
                        {getPartsOrderStatusText(order.status)}
                      </span>
                    </div>
                  </div>

                  {/* Позиции заказа */}
                  {order.items && order.items.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-100 space-y-1.5">
                      {order.items.map((item: any) => (
                        <div key={item.id} className="flex justify-between text-xs text-gray-600">
                          <span className="truncate flex-1 mr-2">
                            {item.inventory_item?.name || t('customerProfilePage.part')}
                            {item.inventory_item?.part_number && (
                              <span className="text-gray-500 font-mono ml-1">
                                #{item.inventory_item.part_number}
                              </span>
                            )}
                          </span>
                          <span className="flex-shrink-0 tabular-nums">
                            {item.quantity} × {formatCurrency(item.price_at_sale)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {order.notes && (
                    <p className="mt-2 text-xs text-gray-500 italic truncate">{order.notes}</p>
                  )}
                </Link>
              ))}
            </div>
          </>
        ) : (
          <div className="empty-state py-12">
            <div className="empty-state-icon">
              <Package className="w-7 h-7 text-gray-400" />
            </div>
            <p className="empty-state-title">{t('customerProfilePage.emptyOrdersTitle')}</p>
            <p className="empty-state-text">{t('customerProfilePage.emptyOrdersText')}</p>
            <button
              onClick={() => {
                setCart([])
                setPartsSearch('')
                setSelectedMake(null)
                setSelectedModel(null)
                setMobileTab('parts')
                setIsOrderModalOpen(true)
              }}
              className="cab-btn cab-btn-primary cab-btn-sm mt-4"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              {t('customerProfilePage.createOrder')}
            </button>
          </div>
        )}
      </div>
      </div>

      {/* ── Модалка: новый заказ из склада ─────────────────────────────── */}
      {isOrderModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start sm:items-center justify-center px-3 py-3 sm:p-4"
          style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0px))' }}
        >
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-[2px]"
            onClick={() => setIsOrderModalOpen(false)}
          />
          <div className="relative w-full sm:max-w-4xl h-[calc(100dvh-1.5rem)] sm:h-[88vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-modal-pop">

            {/* Modal header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white flex-shrink-0">
              {/* Mobile: tabs */}
              <div className="flex md:hidden bg-gray-100 rounded-xl p-0.5 flex-1">
                <button
                  onClick={() => setMobileTab('parts')}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                    mobileTab === 'parts'
                      ? 'bg-white shadow-sm text-gray-900'
                      : 'text-gray-500'
                  }`}
                >
                  {t('customerProfilePage.tabParts')}
                </button>
                <button
                  onClick={() => setMobileTab('cart')}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${
                    mobileTab === 'cart'
                      ? 'bg-white shadow-sm text-gray-900'
                      : 'text-gray-500'
                  }`}
                >
                  {t('customerProfilePage.tabCart')}
                  {cart.length > 0 && (
                    <span className="cab-chip cab-chip-signal min-w-[20px] h-5 px-1.5">
                      {cart.length}
                    </span>
                  )}
                </button>
              </div>
              {/* Desktop: title */}
              <div className="hidden md:flex flex-col">
                <span className="text-sm font-bold text-gray-900">{t('customerProfilePage.newOrder')}</span>
                <span className="kicker">{customer.full_name}</span>
              </div>
              <div className="hidden md:block ml-auto" />
              <button
                onClick={() => setIsOrderModalOpen(false)}
                className="btn-icon flex-shrink-0"
                aria-label={t('customerProfilePage.close')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-1 min-h-0">

              {/* Left panel: vehicle wizard + parts */}
              <div className={`flex-1 min-h-0 flex flex-col ${mobileTab === 'cart' ? 'hidden md:flex' : 'flex'} md:border-r border-gray-100`}>

                {/* Step 1: Pick make */}
                {selectedMake === null && (
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    <div>
                      <p className="kicker mb-3">{t('customerProfilePage.carMake')}</p>
                      {makes.length === 0 ? (
                        <div className="empty-state py-10">
                          <p className="empty-state-text">{t('customerProfilePage.noPartsAvailable')}</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2.5">
                          {makes.map(({ make, count }) => (
                            <button
                              key={make}
                              onClick={() => { setSelectedMake(make); setSelectedModel(null); setPartsSearch('') }}
                              className="group flex flex-col items-start gap-1 p-4 rounded-xl border-2 border-gray-100 hover:border-primary hover:bg-primary/5 active:scale-[0.97] transition-all text-left"
                            >
                              <Car className="w-4 h-4 text-gray-300 group-hover:text-primary transition-colors mb-0.5" />
                              <span className="font-semibold text-gray-900 text-sm leading-tight">{make}</span>
                              <span className="kicker">{t('customerProfilePage.carsCount', { count })}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => { setSelectedMake('__all__'); setSelectedModel('__all__'); setPartsSearch('') }}
                      className="w-full py-3 rounded-xl border-2 border-dashed border-gray-200 text-sm font-semibold text-gray-500 hover:border-primary hover:text-primary hover:bg-primary/5 transition-all"
                    >
                      {t('customerProfilePage.showAllParts')}
                    </button>
                  </div>
                )}

                {/* Step 2: Pick model */}
                {selectedMake !== null && selectedMake !== '__all__' && selectedModel === null && (
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    <div className="flex items-center gap-1.5 text-sm">
                      <button
                        onClick={() => { setSelectedMake(null); setSelectedModel(null) }}
                        className="text-primary hover:underline font-semibold"
                      >
                        {t('customerProfilePage.crumbMake')}
                      </button>
                      <ChevronRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                      <span className="font-bold text-gray-900">{selectedMake}</span>
                    </div>
                    <div>
                      <p className="kicker mb-3">{t('customerProfilePage.model')}</p>
                      <div className="grid grid-cols-2 gap-2.5">
                        {models.map(({ model, count }) => (
                          <button
                            key={model}
                            onClick={() => { setSelectedModel(model); setPartsSearch('') }}
                            className="group flex flex-col items-start gap-1 p-4 rounded-xl border-2 border-gray-100 hover:border-primary hover:bg-primary/5 active:scale-[0.97] transition-all text-left"
                          >
                            <span className="font-semibold text-gray-900 text-sm leading-tight">{model}</span>
                            <span className="kicker">{t('customerProfilePage.carsCount', { count })}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={() => { setSelectedModel('__all__'); setPartsSearch('') }}
                      className="w-full py-3 rounded-xl border-2 border-dashed border-gray-200 text-sm font-semibold text-gray-500 hover:border-primary hover:text-primary hover:bg-primary/5 transition-all"
                    >
                      {t('customerProfilePage.allModels', { make: selectedMake })}
                    </button>
                  </div>
                )}

                {/* Step 3: Search + parts list */}
                {selectedMake !== null && (selectedMake === '__all__' || selectedModel !== null) && (
                  <div className="flex-1 min-h-0 flex flex-col">
                    <div className="px-4 pt-3 pb-2 flex-shrink-0 space-y-2.5 border-b border-gray-100">
                      <div className="flex items-center gap-1.5 text-sm flex-wrap">
                        <button
                          onClick={() => { setSelectedMake(null); setSelectedModel(null); setPartsSearch('') }}
                          className="text-primary hover:underline font-semibold"
                        >
                          {t('customerProfilePage.crumbMake')}
                        </button>
                        {selectedMake !== '__all__' && (
                          <>
                            <ChevronRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                            <button
                              onClick={() => { setSelectedModel(null); setPartsSearch('') }}
                              className="text-primary hover:underline font-semibold"
                            >
                              {selectedMake}
                            </button>
                            <ChevronRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                            <span className="font-bold text-gray-900 truncate">
                              {selectedModel === '__all__' ? t('customerProfilePage.allModelsShort') : selectedModel}
                            </span>
                          </>
                        )}
                        {selectedMake === '__all__' && (
                          <span className="font-bold text-gray-900">{t('customerProfilePage.allParts')}</span>
                        )}
                        <span className="ml-auto flex-shrink-0 cab-chip">
                          {t('customerProfilePage.itemsPcs', { count: filteredInventory.length })}
                        </span>
                      </div>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          value={partsSearch}
                          onChange={e => setPartsSearch(e.target.value)}
                          placeholder={t('customerProfilePage.searchPlaceholder')}
                          className="form-input pl-9 pr-9"
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

                    <div className="flex-1 min-h-0 overflow-y-auto p-3">
                      {filteredInventory.length === 0 ? (
                        <div className="empty-state py-10">
                          <p className="empty-state-text">
                            {partsSearch ? t('customerProfilePage.nothingFound') : t('customerProfilePage.noPartsAvailable')}
                          </p>
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
                                      <span className="text-xs text-gray-400 truncate">{vehicleLabel}</span>
                                    )}
                                    {item.part_number && (
                                      <span className="text-xs text-gray-300">·</span>
                                    )}
                                    {item.part_number && (
                                      <span className="text-xs font-mono text-gray-500">{item.part_number}</span>
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
                                    className={`w-9 h-9 flex items-center justify-center rounded-lg flex-shrink-0 transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                                      inCart
                                        ? 'bg-green-600 text-white shadow-sm'
                                        : 'bg-[var(--cab-ink)] text-white hover:bg-gray-700'
                                    }`}
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

              {/* Right panel: cart */}
              <div className={`w-full md:w-[280px] flex-col flex-shrink-0 bg-gray-50/50 ${mobileTab === 'cart' ? 'flex' : 'hidden md:flex'}`}>
                <div className="flex-1 min-h-0 overflow-y-auto p-3">
                  {cart.length === 0 ? (
                    <div className="empty-state h-full">
                      <div className="empty-state-icon">
                        <ShoppingCart className="w-6 h-6 text-gray-400" />
                      </div>
                      <p className="empty-state-text">{t('customerProfilePage.cartEmpty')}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {cart.map((item) => (
                        <div key={item.id} className="cab-card p-3 shadow-none">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-900 leading-tight">{item.name}</p>
                              {item.vehicleInfo && (
                                <p className="text-xs text-gray-500 mt-0.5 truncate">{item.vehicleInfo}</p>
                              )}
                            </div>
                            <button
                              onClick={() => removeFromCart(item.id)}
                              className="btn-icon-sm text-gray-300 hover:text-red-500 hover:bg-red-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => updateCartQty(item.id, item.quantity - 1)}
                                className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
                              >
                                <Minus className="w-3 h-3 text-gray-600" />
                              </button>
                              <span className="text-sm font-bold w-7 text-center text-gray-900 tabular-nums">
                                {item.quantity}
                              </span>
                              <button
                                onClick={() => updateCartQty(item.id, item.quantity + 1)}
                                disabled={item.quantity >= item.maxQty}
                                className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                              >
                                <Plus className="w-3 h-3 text-gray-600" />
                              </button>
                            </div>
                            <span className="text-sm font-bold text-primary tabular-nums">
                              {formatPrice(item.price * item.quantity, item.currency)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Cart footer */}
                <div className="p-3 border-t border-gray-200 flex-shrink-0 space-y-2.5" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}>
                  <textarea
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    placeholder={t('customerProfilePage.notesPlaceholder')}
                    rows={2}
                    className="form-input resize-none placeholder:text-gray-400"
                  />
                  {cart.length > 0 && (
                    <div className="space-y-1 px-1">
                      {mixedCurrencies && (
                        <>
                          {hasUSD && (
                            <div className="flex justify-between items-center text-xs text-gray-400">
                              <span>{t('customerProfilePage.usdItems', { rate: usdRate ?? '—' })}</span>
                              <span className="tabular-nums">
                                {usdRate != null ? formatCurrency(cart.filter(i => i.currency === 'USD').reduce((s, i) => s + i.price * i.quantity, 0) * usdRate) : '—'}
                              </span>
                            </div>
                          )}
                          {hasUAH && (
                            <div className="flex justify-between items-center text-xs text-gray-400">
                              <span>{t('customerProfilePage.uahItems')}</span>
                              <span className="tabular-nums">
                                {formatCurrency(cart.filter(i => i.currency === 'UAH').reduce((s, i) => s + i.price * i.quantity, 0))}
                              </span>
                            </div>
                          )}
                        </>
                      )}
                      <div className="flex justify-between items-center pt-1 border-t border-gray-200">
                        <span className="text-sm font-semibold text-gray-500">{t('customerProfilePage.total')}</span>
                        <span className="text-lg font-extrabold text-primary tabular-nums">
                          {formatCurrency(cartTotalUAH)}
                        </span>
                      </div>
                    </div>
                  )}
                  <button
                    onClick={() => createOrderMutation.mutate()}
                    disabled={cart.length === 0 || createOrderMutation.isPending}
                    className="cab-btn cab-btn-success w-full cab-btn-lg disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {createOrderMutation.isPending
                      ? t('customerProfilePage.creating')
                      : cart.length === 0
                        ? t('customerProfilePage.cartEmptyBtn')
                        : t('customerProfilePage.createOrderCount', { count: cart.length })
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
