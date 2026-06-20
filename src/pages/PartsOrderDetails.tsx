import { useState, useEffect, useRef } from 'react'
import { Spinner } from '@/components/ui/Spinner'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useUserProfile, useHasRole, useIsAdmin } from '@/hooks/useUserProfile'
import { PartsAccessDenied } from '@/components/parts/PartsAccessDenied'
import { formatDate } from '@/utils/date'
import { PartsOrder, CreatePartsOrderItemInput } from '@/types/parts'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  ArrowLeft, Plus, Trash2, Edit2, Search,
  CheckCircle, MapPin, Truck, Package, X, Copy, ExternalLink,
} from 'lucide-react'
import { getNpApiKey } from '@/utils/npApiKey'
import { searchCities, searchWarehouses, NpCity, NpWarehouse, createTtn } from '@/services/npService'
import { formatCurrency, formatPrice } from '@/utils/currency'
import { getPartsOrderStatusText } from '@/utils/status'
import {
  updatePartsOrderTotal, getAvailablePartsInventory,
  getPartsCustomersDropdown, updatePartsOrder, updatePartsOrderStatus,
  deletePartsOrder, deletePartsOrderItem, createPartsOrderItem,
  createPartsCustomer, updatePartsCustomer,
} from '@/services/partsService'
import { usePartsExchangeRate } from '@/hooks/usePartsExchangeRate'
import { useHydrateNpSettings } from '@/hooks/useHydrateNpSettings'
import { createShipment } from '@/services/shipmentsService'
import { useConfirm } from '@/hooks/useConfirm'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { moveToTrash } from '@/services/trashService'

/* ── локальная карта статус → badge-класс ────────────────────── */
const STATUS_BADGE: Record<string, string> = {
  new:         'badge badge-blue',
  in_progress: 'badge badge-yellow',
  completed:   'badge badge-green',
  cancelled:   'badge badge-gray',
}

export default function PartsOrderDetails() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: profile } = useUserProfile()
  const partsCompanyId = profile?.parts_company_id
  const queryClient = useQueryClient()

  const [showAddItemModal, setShowAddItemModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showCompleteModal, setShowCompleteModal] = useState(false)
  const { confirm: showConfirm, dialogProps } = useConfirm()

  const { rate: exchangeRate } = usePartsExchangeRate()
  // НП-настройки разборки из БД → localStorage (ключ общий для всех сотрудников)
  useHydrateNpSettings(partsCompanyId)

  /* ── поля «Клиент и доставка» ───────────────────────────────── */
  const [customerFullName, setCustomerFullName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerCity, setCustomerCity] = useState('')
  const [customerNpOffice, setCustomerNpOffice] = useState('')
  /* рефы для НП ТТН */
  const [npCityRef, setNpCityRef] = useState('')
  const [npWarehouseRef, setNpWarehouseRef] = useState('')

  /* ── Новая почта автокомплит ─────────────────────────────────── */
  const npApiKeySet = Boolean(getNpApiKey())
  const [cityInputValue, setCityInputValue] = useState('')
  const [cityRef, setCityRef] = useState('')
  const [cityDebounced, setCityDebounced] = useState('')
  const [warehouseInputValue, setWarehouseInputValue] = useState('')
  const [warehouseDebounced, setWarehouseDebounced] = useState('')
  const [showCityList, setShowCityList] = useState(false)
  const [showWarehouseList, setShowWarehouseList] = useState(false)

  /* ── Создание ТТН ───────────────────────────────────────────── */
  const [showTtnForm, setShowTtnForm] = useState(false)
  const [ttnWeight, setTtnWeight] = useState('1')
  const [ttnDescription, setTtnDescription] = useState('Автозапчастини')
  const [ttnCost, setTtnCost] = useState('')
  const [ttnCreating, setTtnCreating] = useState(false)

  /* ── запрос заказа ──────────────────────────────────────────── */
  const { data: order, isLoading } = useQuery({
    queryKey: ['parts-order', id],
    queryFn: async () => {
      const { getPartsOrder } = await import('@/services/partsService')
      return getPartsOrder(id!)
    },
    enabled: !!id,
  })

  /* ── удалить позицию ────────────────────────────────────────── */
  const deleteItemMutation = useMutation({
    mutationFn: ({ itemId, inventoryItemId }: { itemId: string; inventoryItemId: string }) =>
      deletePartsOrderItem(itemId, inventoryItemId),
    onSuccess: async () => {
      if (id) await updatePartsOrderTotal(id, exchangeRate)
      queryClient.invalidateQueries({ queryKey: ['parts-order', id] })
      queryClient.invalidateQueries({ queryKey: ['parts-inventory'] })
      toast.success('Позиция удалена')
    },
    onError: () => toast.error('Ошибка при удалении позиции'),
  })

  /* ── изменить статус ────────────────────────────────────────── */
  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      if ((status === 'in_progress' || status === 'completed') && !order?.customer_id) {
        await createAndAttachCustomer(id!)
      }
      const inventoryIds = (order?.items ?? []).map((i: any) => i.inventory_item_id).filter(Boolean)
      await updatePartsOrderStatus(id!, status, inventoryIds, exchangeRate)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts-order', id] })
      queryClient.invalidateQueries({ queryKey: ['parts-orders'] })
      queryClient.invalidateQueries({ queryKey: ['parts-inventory'] })
      setShowCompleteModal(false)
      toast.success('Статус обновлён')
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Ошибка обновления статуса')
    },
  })

  /* ── удалить заказ целиком (только владелец) ────────────────── */
  const deleteOrderMutation = useMutation({
    mutationFn: async () => {
      if (!id) return
      const inventoryIds = (order?.items ?? []).map((i: any) => i.inventory_item_id).filter(Boolean)
      await moveToTrash({
        entityType: 'parts_order',
        entityId: id,
        entityLabel: `Заказ разборки: ${order?.customer?.full_name || id}`,
        entityData: { order, items: order?.items ?? [] },
        partsCompanyId: partsCompanyId,
      })
      await deletePartsOrder(id, inventoryIds)
    },
    onSuccess: () => {
      queryClient.setQueriesData({ queryKey: ['parts-orders'] }, (old: any) =>
        Array.isArray(old) ? old.filter((o: any) => o?.id !== id) : old
      )
      queryClient.removeQueries({ queryKey: ['parts-order', id] })
      queryClient.invalidateQueries({ queryKey: ['parts-orders'] })
      queryClient.invalidateQueries({ queryKey: ['parts-recent-activity'] })
      queryClient.invalidateQueries({ queryKey: ['parts-orders-stats'] })
      queryClient.invalidateQueries({ queryKey: ['parts-inventory'] })
      queryClient.invalidateQueries({ queryKey: ['trash'] })
      toast.success('Заказ перемещён в корзину')
      navigate('/parts/orders')
    },
  })

  const canEdit   = order && (order.status === 'new' || order.status === 'in_progress')
  const isAdmin   = useIsAdmin()
  const isOwner   = useHasRole('parts_owner') || isAdmin
  const canManage = Boolean(order) && (!!canEdit || isOwner)

   
  useEffect(() => {
    if (order?.customer) {
      setCustomerFullName(order.customer.full_name || '')
      setCustomerPhone(order.customer.phone || '')
      const city = (order.customer as any).city || ''
      const npOffice = (order.customer as any).np_office || ''
      setCustomerCity(city)
      setCustomerNpOffice(npOffice)
      if (npApiKeySet) {
        setCityInputValue(city)
        setWarehouseInputValue(npOffice)
      }
      // префилл рефов из клиента
      setNpCityRef((order.customer as any).np_city_ref || '')
      setNpWarehouseRef((order.customer as any).np_warehouse_ref || '')
    }
  }, [order?.customer?.id])  

  /* ── вычисляем итог на клиенте ──────────────────────────────── */
  const getItemCurrency = (item: any): 'UAH' | 'USD' =>
    item.price_at_sale_currency || item.inventory_item?.price_currency || 'USD'

  const computedTotalUAH = (order?.items ?? []).reduce((sum, item: any) => {
    const amount = (item.price_at_sale || 0) * (item.quantity || 1)
    return sum + (getItemCurrency(item) === 'USD' ? amount * (exchangeRate || 41) : amount)
  }, 0)

  /* ── Префилл стоимости ТТН из итога заказа ─────────────────── */
  useEffect(() => {
    if (computedTotalUAH > 0) {
      setTtnCost(String(Math.round(computedTotalUAH)))
    }
  }, [computedTotalUAH])

  /* ── debounce для НП-поиска ─────────────────────────────────── */
  useEffect(() => {
    const t = setTimeout(() => setCityDebounced(cityInputValue), 350)
    return () => clearTimeout(t)
  }, [cityInputValue])

  useEffect(() => {
    const t = setTimeout(() => setWarehouseDebounced(warehouseInputValue), 350)
    return () => clearTimeout(t)
  }, [warehouseInputValue])

  /* ── НП: города ─────────────────────────────────────────────── */
  const { data: npCities = [] } = useQuery<NpCity[]>({
    queryKey: ['np-cities', cityDebounced],
    queryFn: () => searchCities(cityDebounced),
    enabled: npApiKeySet && cityDebounced.length >= 2,
    staleTime: 60_000,
  })

  /* ── НП: отделения ──────────────────────────────────────────── */
  const { data: npWarehouses = [] } = useQuery<NpWarehouse[]>({
    queryKey: ['np-warehouses', cityRef, warehouseDebounced],
    queryFn: () => searchWarehouses(cityRef, warehouseDebounced),
    enabled: npApiKeySet && Boolean(cityRef),
    staleTime: 60_000,
  })

  /* ── вспомогательная: создать клиента и привязать ───────────── */
  const createAndAttachCustomer = async (orderId: string) => {
    if (!partsCompanyId) return null
    if (!customerFullName.trim() && !customerPhone.trim()) return null
    const created = await createPartsCustomer(
      {
        full_name: customerFullName.trim() || 'Клиент',
        phone: customerPhone.trim() || undefined,
        city: customerCity.trim() || undefined,
        np_office: customerNpOffice.trim() || undefined,
        np_city_ref: npCityRef || undefined,
        np_warehouse_ref: npWarehouseRef || undefined,
      },
      partsCompanyId
    )
    await updatePartsOrder(orderId, { customer_id: created.id })
    return created
  }

  /* ── сохранение данных клиента ──────────────────────────────── */
  const saveCustomerMutation = useMutation({
    mutationFn: async () => {
      if (!order) throw new Error('Нет заказа')
      if (order.customer_id) {
        const phoneUpdate = customerPhone.trim() ? { phone: customerPhone.trim() } : {}
        await updatePartsCustomer(order.customer_id, {
          full_name: customerFullName.trim() || undefined,
          city: customerCity.trim() || undefined,
          np_office: customerNpOffice.trim() || undefined,
          np_city_ref: npCityRef || undefined,
          np_warehouse_ref: npWarehouseRef || undefined,
          ...phoneUpdate,
        })
      } else {
        await createAndAttachCustomer(order.id)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts-order', id] })
      queryClient.invalidateQueries({ queryKey: ['parts-orders'] })
      queryClient.invalidateQueries({ queryKey: ['parts-customers'] })
      queryClient.invalidateQueries({ queryKey: ['parts-customers-dropdown'] })
      toast.success('Данные клиента сохранены')
    },
    onError: (err: any) => toast.error(err?.message || 'Ошибка сохранения данных клиента'),
  })

  /* ── guard: нет компании ────────────────────────────────────── */
  if (!partsCompanyId) return <PartsAccessDenied />

  /* ── loading ────────────────────────────────────────────────── */
  if (isLoading) {
    return (
      <div className="min-h-dvh bg-gray-50 flex items-center justify-center">
        <Spinner size="md" />
      </div>
    )
  }

  /* ── not found ──────────────────────────────────────────────── */
  if (!order) {
    return (
      <div className="min-h-dvh bg-gray-50 flex flex-col items-center justify-center gap-3 p-4">
        <Package className="w-12 h-12 text-gray-300" />
        <p className="text-gray-500">Заказ не найден</p>
        <button
          onClick={() => navigate('/parts/orders')}
          className="text-primary text-sm hover:underline"
        >
          Вернуться к заказам
        </button>
      </div>
    )
  }

  const statusBadgeCls = STATUS_BADGE[order.status] ?? 'badge badge-gray'

  return (
    <div className="min-h-dvh bg-gray-50 pb-[calc(64px+env(safe-area-inset-bottom,0px))] sm:pb-6">

      {/* ── sticky шапка (вид как PartsPageHeader; действий много — оставляем перенос) ── */}
      <div className="bg-white border-b sticky top-0 z-20">
        <div className="w-full">
          <div className="h-14 sm:h-16 flex items-center justify-between gap-3">

            {/* back + заголовок */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <button
                onClick={() => navigate('/parts/orders')}
                className="btn-icon flex-shrink-0"
                aria-label="Назад"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="min-w-0">
                <h1 className="page-title truncate">{order.order_number}</h1>
                <p className="text-xs text-gray-400 hidden sm:block">
                  {formatDate(order.order_date)}
                </p>
              </div>
            </div>

            {/* статус-бейдж + кнопки статуса + действия */}
            <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
              <span className={statusBadgeCls}>
                {getPartsOrderStatusText(order.status)}
              </span>

              {canManage && (
                <div className="flex items-center gap-1.5">
                  {/* Один шаг вперёд: новый → в работе → завершён (не показываем все статусы сразу) */}
                  {order.status === 'new' && (
                    <button
                      onClick={() => updateStatusMutation.mutate('in_progress')}
                      disabled={updateStatusMutation.isPending}
                      className="cab-btn cab-btn-sm cab-btn-primary"
                    >
                      В работу
                    </button>
                  )}
                  {order.status === 'in_progress' && (
                    <button
                      onClick={() => setShowCompleteModal(true)}
                      disabled={updateStatusMutation.isPending}
                      className="cab-btn cab-btn-sm cab-btn-primary"
                    >
                      Завершить
                    </button>
                  )}
                  {(order.status === 'new' || order.status === 'in_progress') && (
                    <button
                      onClick={() => updateStatusMutation.mutate('cancelled')}
                      disabled={updateStatusMutation.isPending}
                      className="cab-btn cab-btn-sm cab-btn-secondary"
                      style={{ color: '#B91C1C' }}
                    >
                      Отменить
                    </button>
                  )}
                </div>
              )}

              {canManage && (
                <button
                  onClick={() => setShowEditModal(true)}
                  className="btn-icon"
                  aria-label="Редактировать"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              )}

              {isOwner && (
                <button
                  onClick={async () => {
                    const ok = await showConfirm({
                      message: `Удалить заказ ${order.order_number}? Забронированные запчасти вернутся в статус «В наличии».`,
                      danger: true,
                    })
                    if (!ok) return
                    deleteOrderMutation.mutate()
                  }}
                  disabled={deleteOrderMutation.isPending}
                  className="btn-icon text-red-500 hover:bg-red-50"
                  aria-label="Удалить заказ"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── основной контент ─────────────────────────────────────── */}
      <div className="w-full py-5 sm:py-6 space-y-5">

        {/* ── дата + примечание ────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 px-1 text-sm">
          <span className="text-gray-400">{formatDate(order.order_date)}</span>
          {order.notes && (
            <span className="text-gray-600 line-clamp-1">{order.notes}</span>
          )}
        </div>

        {/* ── блок «Клиент и доставка» (редактирование) ─────────────── */}
        {canManage && (
          <div className="cab-card p-4">
            <div className="flex items-center gap-2 mb-4">
              <span className="icon-tile-sm bg-slate-100 text-slate-700">
                <Truck className="w-4 h-4" />
              </span>
              <h2 className="heading-3">Клиент и доставка</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="form-label">ФИО клиента</label>
                <input
                  type="text"
                  value={customerFullName}
                  onChange={(e) => setCustomerFullName(e.target.value)}
                  placeholder="Иванов Иван Иванович"
                  className="form-input"
                />
              </div>
              <div>
                <label className="form-label">Телефон</label>
                {order.customer?.phone && !customerPhone ? (
                  <input
                    type="tel"
                    value={order.customer.phone}
                    readOnly
                    className="form-input opacity-60 cursor-not-allowed"
                  />
                ) : (
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="+38 (067) 000-00-00"
                    className="form-input"
                  />
                )}
              </div>
              <div>
                <label className="form-label">Город</label>
                {npApiKeySet ? (
                  <NpCombobox
                    value={cityInputValue}
                    onChange={setCityInputValue}
                    placeholder="Введите город..."
                    items={npCities.map(c => ({ value: c.ref, label: c.name }))}
                    open={showCityList}
                    onOpen={() => setShowCityList(true)}
                    onClose={() => setShowCityList(false)}
                    onSelect={(item) => {
                      setCityInputValue(item.label)
                      setCustomerCity(item.label)
                      setCityRef(item.value)
                      setNpCityRef(item.value)
                      setShowCityList(false)
                      setWarehouseInputValue('')
                      setCustomerNpOffice('')
                      setNpWarehouseRef('')
                      setCityDebounced('')
                    }}
                  />
                ) : (
                  <input
                    type="text"
                    value={customerCity}
                    onChange={(e) => setCustomerCity(e.target.value)}
                    placeholder="Киев"
                    className="form-input"
                  />
                )}
              </div>
              <div>
                <label className="form-label">Отделение Новой почты</label>
                {npApiKeySet ? (
                  <NpCombobox
                    value={warehouseInputValue}
                    onChange={setWarehouseInputValue}
                    placeholder={cityRef ? 'Введите отделение...' : 'Сначала выберите город'}
                    disabled={!cityRef}
                    items={npWarehouses.map(w => ({ value: w.ref, label: w.description }))}
                    open={showWarehouseList}
                    onOpen={() => { if (cityRef) setShowWarehouseList(true) }}
                    onClose={() => setShowWarehouseList(false)}
                    onSelect={(item) => {
                      setWarehouseInputValue(item.label)
                      setCustomerNpOffice(item.label)
                      setNpWarehouseRef(item.value)
                      setShowWarehouseList(false)
                    }}
                  />
                ) : (
                  <input
                    type="text"
                    value={customerNpOffice}
                    onChange={(e) => setCustomerNpOffice(e.target.value)}
                    placeholder="Відділення №1"
                    className="form-input"
                  />
                )}
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => saveCustomerMutation.mutate()}
                disabled={
                  saveCustomerMutation.isPending ||
                  (!customerFullName.trim() && !customerPhone.trim() && !customerCity.trim() && !customerNpOffice.trim())
                }
                className="cab-btn cab-btn-primary disabled:opacity-50"
              >
                {saveCustomerMutation.isPending ? 'Сохранение…' : 'Сохранить данные клиента'}
              </button>
            </div>
          </div>
        )}

        {/* ── позиции заказа ─────────────────────────────────────────── */}
        <div className="cab-card p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="icon-tile-sm bg-slate-100 text-slate-600">
                <Package className="w-4 h-4" />
              </span>
              <h2 className="heading-3">
                Позиции
                <span className="ml-1.5 text-gray-400 font-normal text-base">
                  ({order.items?.length || 0})
                </span>
              </h2>
            </div>
            {canManage && (
              <button
                onClick={() => setShowAddItemModal(true)}
                className="cab-btn cab-btn-primary cab-btn-sm gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" strokeWidth={2} />
                <span className="hidden sm:inline">Добавить</span>
              </button>
            )}
          </div>

          {!order.items || order.items.length === 0 ? (
            <div className="empty-state py-10">
              <div className="empty-state-icon">
                <Package className="w-7 h-7 text-gray-400" />
              </div>
              <p className="empty-state-title">Нет позиций</p>
              <p className="empty-state-text">Добавьте первую позицию в заказ</p>
              {canManage && (
                <button
                  onClick={() => setShowAddItemModal(true)}
                  className="mt-3 cab-btn cab-btn-primary cab-btn-sm"
                >
                  <Plus className="w-3.5 h-3.5" strokeWidth={2} />
                  Добавить позицию
                </button>
              )}
            </div>
          ) : (
            <div className="grid-hairline rounded-lg overflow-hidden border border-gray-100">
              {order.items.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-start justify-between gap-4 px-4 py-3.5 bg-white hover:bg-gray-50 transition-colors ${
                    item.inventory_item_id == null ? 'opacity-50' : ''
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 leading-snug">
                      {item.inventory_item?.name ?? (
                        <span className="italic text-gray-400">Запчасть удалена</span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {item.inventory_item?.part_number && (
                        <span>{item.inventory_item.part_number} · </span>
                      )}
                      {item.inventory_item?.category && (
                        <span>{item.inventory_item.category.name} · </span>
                      )}
                      <span>{item.quantity} шт.</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-xs text-gray-400 tabular">
                        {formatPrice(item.price_at_sale, getItemCurrency(item))} / шт.
                      </p>
                      <p className="text-sm font-bold text-gray-900 tabular">
                        {formatPrice(
                          (item.price_at_sale || 0) * (item.quantity || 1),
                          getItemCurrency(item)
                        )}
                      </p>
                    </div>
                    {canManage && (
                      <button
                        onClick={async () => {
                          const ok = await showConfirm({ message: 'Удалить позицию из заказа?', danger: true })
                          if (!ok) return
                          deleteItemMutation.mutate({
                            itemId: item.id,
                            inventoryItemId: item.inventory_item_id,
                          })
                        }}
                        className="btn-icon-sm text-red-400 hover:text-red-600 hover:bg-red-50"
                        aria-label="Удалить позицию"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {/* строка итого */}
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t border-gray-100">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Итого</span>
                <span className="text-base font-extrabold text-primary tabular">
                  {formatCurrency(computedTotalUAH)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ── блок «Доставка Новой почты» ─────────────────────────────── */}
        <NpTtnBlock
          order={order}
          npCityRef={npCityRef}
          npWarehouseRef={npWarehouseRef}
          customerFullName={customerFullName}
          customerPhone={customerPhone}
          computedTotalUAH={computedTotalUAH}
          showTtnForm={showTtnForm}
          setShowTtnForm={setShowTtnForm}
          ttnWeight={ttnWeight}
          setTtnWeight={setTtnWeight}
          ttnDescription={ttnDescription}
          setTtnDescription={setTtnDescription}
          ttnCost={ttnCost}
          setTtnCost={setTtnCost}
          ttnCreating={ttnCreating}
          setTtnCreating={setTtnCreating}
          onTtnCreated={(ttn) => {
            queryClient.invalidateQueries({ queryKey: ['parts-order', id] })
            // Регистрируем посылку для трекинга (раздел «Доставка»)
            if (partsCompanyId) {
              createShipment({
                parts_company_id: partsCompanyId,
                order_id: order.id,
                ttn,
                np_ref: null,
                recipient_name: order.customer?.full_name ?? customerFullName ?? null,
                recipient_phone: order.customer?.phone ?? customerPhone ?? null,
                recipient_city: customerCity || null,
                recipient_warehouse: customerNpOffice || null,
                status: null,
                status_code: null,
                cod_amount: null,
              }).catch(() => { /* трекинг опционален */ })
            }
            queryClient.invalidateQueries({ queryKey: ['parts-shipments', partsCompanyId] })
            toast.success(`ТТН создана: ${ttn}`)
          }}
          orderId={order.id}
        />

        {/* ── кнопка «Завершить» ────────────────────────────────────── */}
        {canManage && order.status !== 'completed' && order.items && order.items.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-sm border-t border-gray-100 px-4 py-3 sm:static sm:bg-transparent sm:border-0 sm:backdrop-blur-none sm:px-0 sm:py-0 sm:flex sm:justify-end"
               style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
          >
            <button
              onClick={() => setShowCompleteModal(true)}
              className="cab-btn cab-btn-success cab-btn-lg gap-2 w-full sm:w-auto"
            >
              <CheckCircle className="w-5 h-5" />
              Завершить заказ
            </button>
          </div>
        )}
      </div>

      {/* ── модалки ─────────────────────────────────────────────────── */}
      {showAddItemModal && (
        <AddItemModal
          orderId={order.id}
          partsCompanyId={partsCompanyId}
          onClose={() => setShowAddItemModal(false)}
        />
      )}

      {showEditModal && (
        <EditOrderModal
          order={order}
          partsCompanyId={partsCompanyId}
          onClose={() => setShowEditModal(false)}
        />
      )}

      {showCompleteModal && (
        <ConfirmCompleteModal
          onConfirm={() => updateStatusMutation.mutate('completed')}
          onClose={() => setShowCompleteModal(false)}
          isLoading={updateStatusMutation.isPending}
        />
      )}

      <ConfirmDialog {...dialogProps} />
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════
   NpCombobox — инлайн-комбобокс для поиска городов/отделений НП
══════════════════════════════════════════════════════════════════ */
interface NpComboboxItem {
  value: string
  label: string
}

interface NpComboboxProps {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  disabled?: boolean
  items: NpComboboxItem[]
  open: boolean
  onOpen: () => void
  onClose: () => void
  onSelect: (item: NpComboboxItem) => void
}

function NpCombobox({
  value, onChange, placeholder, disabled,
  items, open, onOpen, onClose, onSelect,
}: NpComboboxProps) {
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, onClose])

  return (
    <div ref={wrapRef} className="relative">
      <input
        type="text"
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        className="form-input w-full disabled:opacity-50 disabled:cursor-not-allowed"
        onChange={e => { onChange(e.target.value); onOpen() }}
        onFocus={onOpen}
        onKeyDown={e => { if (e.key === 'Escape') onClose() }}
      />
      {open && items.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 top-full mt-1 max-h-56 overflow-y-auto rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg">
          {items.map(item => (
            <li key={item.value}>
              <button
                type="button"
                className="w-full text-left px-4 py-2.5 text-sm text-gray-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                onMouseDown={e => { e.preventDefault(); onSelect(item) }}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════
   AddItemModal
══════════════════════════════════════════════════════════════════ */
interface AddItemModalProps {
  orderId: string
  partsCompanyId: string
  onClose: () => void
}

function AddItemModal({ orderId, partsCompanyId, onClose }: AddItemModalProps) {
  const queryClient = useQueryClient()
  const { rate: exchangeRate } = usePartsExchangeRate()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedItem, setSelectedItem] = useState<any>(null)
  const [quantity, setQuantity] = useState(1)
  const [price, setPrice] = useState(0)
  const [currency, setCurrency] = useState<'UAH' | 'USD'>('UAH')

  const { data: inventory = [] } = useQuery({
    queryKey: ['parts-inventory-for-order', partsCompanyId],
    queryFn: () => getAvailablePartsInventory(partsCompanyId),
  })

  const filteredInventory = inventory.filter(item => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return item.name.toLowerCase().includes(q) || item.part_number?.toLowerCase().includes(q)
  })

  const addItemMutation = useMutation({
    mutationFn: (input: CreatePartsOrderItemInput) =>
      createPartsOrderItem(orderId, {
        inventory_item_id: input.inventory_item_id,
        quantity: input.quantity,
        price_at_sale: input.price_at_sale,
        price_at_sale_currency: input.price_at_sale_currency || 'USD',
      }),
    onSuccess: async () => {
      await updatePartsOrderTotal(orderId, exchangeRate)
      queryClient.invalidateQueries({ queryKey: ['parts-order', orderId] })
      onClose()
    },
  })

  const handleSelectItem = (item: any) => {
    setSelectedItem(item)
    setPrice(item.selling_price || 0)
    setCurrency((item.price_currency as 'UAH' | 'USD') || 'UAH')
    setQuantity(1)
  }

  const handleAdd = () => {
    if (!selectedItem || quantity <= 0 || price <= 0) return
    if (quantity > selectedItem.quantity) {
      toast.error(`Недостаточно запчастей. Доступно: ${selectedItem.quantity}`)
      return
    }
    addItemMutation.mutate({
      inventory_item_id: selectedItem.id,
      quantity,
      price_at_sale: price,
      price_at_sale_currency: currency,
    })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-sheet sm:max-w-2xl animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-handle" />

        <div className="modal-header">
          <h3 className="heading-3">Добавить позицию</h3>
          <button onClick={onClose} className="btn-icon-sm" aria-label="Закрыть"><X className="w-4 h-4" /></button>
        </div>

        <div className="modal-body space-y-4">
          {/* поиск */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Поиск запчасти…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="modal-input pl-9"
            />
          </div>

          {/* список инвентаря */}
          <div className="max-h-56 overflow-y-auto rounded-lg border border-gray-100 grid-hairline">
            {filteredInventory.length === 0 ? (
              <div className="py-6 text-center text-sm text-gray-500">Запчасти не найдены</div>
            ) : (
              filteredInventory.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleSelectItem(item)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                    selectedItem?.id === item.id ? 'bg-slate-100' : 'bg-white'
                  }`}
                >
                  <p className="text-sm font-semibold text-gray-900">{item.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {item.part_number && <span>{item.part_number} · </span>}
                    {(item.category as any)?.name && <span>{(item.category as any).name} · </span>}
                    <span>В наличии: {item.quantity} шт. · </span>
                    <span className="font-semibold text-gray-700">
                      {formatPrice(item.selling_price || 0, (item.price_currency || 'USD') as 'UAH' | 'USD')}
                    </span>
                  </p>
                </button>
              ))
            )}
          </div>

          {/* выбранный товар: кол-во + цена */}
          {selectedItem && (
            <div className="rounded-xl bg-slate-100/70 border border-slate-200 p-4 space-y-4">
              <p className="text-sm font-semibold text-gray-800">
                Выбрано: {selectedItem.name}
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Количество *</label>
                  <input
                    type="number"
                    min="1"
                    max={selectedItem.quantity}
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className="form-input"
                  />
                  <p className="text-xs text-gray-400 mt-1">Макс: {selectedItem.quantity}</p>
                </div>

                <div>
                  <label className="form-label">Цена продажи *</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={price}
                      onChange={(e) => setPrice(Number(e.target.value))}
                      className="form-input flex-1 min-w-0"
                    />
                    <div className="flex gap-1 flex-shrink-0">
                      {(['UAH', 'USD'] as const).map(c => (
                        <button
                          type="button"
                          key={c}
                          onClick={() => setCurrency(c)}
                          className={`px-2.5 rounded-md text-sm font-bold transition-colors min-h-[38px] ${
                            currency === c
                              ? 'text-white'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                          style={currency === c ? { background: 'var(--cab-signal)' } : undefined}
                        >
                          {c === 'UAH' ? '₴' : '$'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Из прайса, можно изменить</p>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200">
                <p className="text-sm text-gray-500">
                  Итого:{' '}
                  <span className="text-base font-bold text-gray-900 tabular">
                    {formatPrice(quantity * price, currency)}
                  </span>
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" onClick={onClose} className="modal-btn-cancel">
            Отмена
          </button>
          <button
            onClick={handleAdd}
            disabled={!selectedItem || addItemMutation.isPending || quantity <= 0 || price <= 0}
            className="cab-btn cab-btn-primary disabled:opacity-50"
          >
            {addItemMutation.isPending ? 'Добавление…' : 'Добавить'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════
   EditOrderModal
══════════════════════════════════════════════════════════════════ */
interface EditOrderModalProps {
  order: PartsOrder
  partsCompanyId: string
  onClose: () => void
}

function EditOrderModal({ order, partsCompanyId, onClose }: EditOrderModalProps) {
  const queryClient = useQueryClient()
  const [customerId, setCustomerId] = useState(order.customer_id || '')
  const [notes, setNotes] = useState(order.notes || '')

  const { data: customers = [] } = useQuery({
    queryKey: ['parts-customers-dropdown', partsCompanyId],
    queryFn: () => getPartsCustomersDropdown(partsCompanyId),
  })

  const updateMutation = useMutation({
    mutationFn: () =>
      updatePartsOrder(order.id, { customer_id: customerId || null, notes: notes || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts-order', order.id] })
      onClose()
    },
  })

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-sheet animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-handle" />

        <div className="modal-header">
          <h3 className="heading-3">Редактировать заказ</h3>
          <button onClick={onClose} className="btn-icon-sm" aria-label="Закрыть"><X className="w-4 h-4" /></button>
        </div>

        <div className="modal-body space-y-4">
          <div>
            <label className="form-label">Клиент</label>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="form-select"
            >
              <option value="">Без клиента</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.full_name}
                  {customer.phone && ` (${customer.phone})`}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">Примечание</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="form-input resize-none"
            />
          </div>
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="modal-btn-cancel">
            Отмена
          </button>
          <button
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending}
            className="cab-btn cab-btn-primary disabled:opacity-50"
          >
            {updateMutation.isPending ? 'Сохранение…' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════
   ConfirmCompleteModal
══════════════════════════════════════════════════════════════════ */
interface ConfirmCompleteModalProps {
  onConfirm: () => void
  onClose: () => void
  isLoading: boolean
}

function ConfirmCompleteModal({ onConfirm, onClose, isLoading }: ConfirmCompleteModalProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-sheet animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-handle" />

        <div className="modal-header">
          <div className="flex items-center gap-3">
            <span className="icon-tile bg-green-100 text-green-700">
              <CheckCircle className="w-5 h-5" />
            </span>
            <h3 className="heading-3">Завершить заказ?</h3>
          </div>
        </div>

        <div className="modal-body">
          <div className="alert alert-warning">
            <p>
              При завершении заказа количество запчастей в инвентаре будет автоматически уменьшено.
              Это действие нельзя отменить.
            </p>
          </div>
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="modal-btn-cancel">
            Отмена
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 py-3 text-sm font-semibold text-white rounded-lg disabled:opacity-50 transition-all cab-btn cab-btn-success"
            style={{ backgroundImage: 'linear-gradient(180deg, #16A34A 0%, #15803D 100%)' }}
          >
            {isLoading ? 'Завершение…' : 'Да, завершить'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════
   NpTtnBlock — блок «Доставка Новой почты»
══════════════════════════════════════════════════════════════════ */
interface NpTtnBlockProps {
  order: any
  npCityRef: string
  npWarehouseRef: string
  customerFullName: string
  customerPhone: string
  computedTotalUAH: number
  showTtnForm: boolean
  setShowTtnForm: (v: boolean) => void
  ttnWeight: string
  setTtnWeight: (v: string) => void
  ttnDescription: string
  setTtnDescription: (v: string) => void
  ttnCost: string
  setTtnCost: (v: string) => void
  ttnCreating: boolean
  setTtnCreating: (v: boolean) => void
  onTtnCreated: (ttn: string) => void
  orderId: string
}

function NpTtnBlock({
  order,
  npCityRef,
  npWarehouseRef,
  customerFullName,
  customerPhone,
  showTtnForm,
  setShowTtnForm,
  ttnWeight,
  setTtnWeight,
  ttnDescription,
  setTtnDescription,
  ttnCost,
  setTtnCost,
  ttnCreating,
  setTtnCreating,
  onTtnCreated,
  orderId,
}: NpTtnBlockProps) {
  const npApiKeySet = Boolean(getNpApiKey())

  const hasTtn = Boolean(order.np_ttn)

  // Условие для показа кнопки создания ТТН
  const customerNpCityRef = (order.customer as any)?.np_city_ref || npCityRef
  const customerNpWarehouseRef = (order.customer as any)?.np_warehouse_ref || npWarehouseRef
  const customerName = order.customer?.full_name || customerFullName
  const customerPhone_ = order.customer?.phone || customerPhone

  const canCreateTtn = npApiKeySet &&
    Boolean(customerNpCityRef) &&
    Boolean(customerNpWarehouseRef) &&
    Boolean(customerPhone_) &&
    Boolean(customerName)

  const handleCreateTtn = async () => {
    setTtnCreating(true)
    try {
      const result = await createTtn({
        recipientCityRef: customerNpCityRef,
        recipientWarehouseRef: customerNpWarehouseRef,
        recipientName: customerName,
        recipientPhone: customerPhone_,
        description: ttnDescription || undefined,
        cost: ttnCost ? Number(ttnCost) : undefined,
        weight: ttnWeight ? Number(ttnWeight) : undefined,
      })
      // Сохраняем ТТН в заказе
      const { supabase } = await import('@/lib/supabase')
      const { error } = await supabase
        .from('parts_orders')
        .update({ np_ttn: result.ttn })
        .eq('id', orderId)
      if (error) throw error
      setShowTtnForm(false)
      onTtnCreated(result.ttn)
    } catch (err: any) {
      toast.error(err?.message || 'Помилка створення ТТН')
    } finally {
      setTtnCreating(false)
    }
  }

  return (
    <div className="cab-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="icon-tile-sm bg-red-50 text-red-600">
          <Truck className="w-4 h-4" />
        </span>
        <h2 className="heading-3">Доставка Новою поштою</h2>
      </div>

      {hasTtn ? (
        /* ── ТТН вже є ── */
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800">
            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-green-700 dark:text-green-400 font-medium">Номер ТТН</p>
              <p className="text-base font-bold text-green-900 dark:text-green-300 tabular tracking-wide">
                {order.np_ttn}
              </p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => {
                navigator.clipboard.writeText(order.np_ttn)
                toast.success('ТТН скопійовано')
              }}
              className="cab-btn cab-btn-secondary cab-btn-sm gap-1.5"
            >
              <Copy className="w-3.5 h-3.5" />
              Копировать
            </button>
            <a
              href={`https://novaposhta.ua/tracking/?cargo_number=${order.np_ttn}`}
              target="_blank"
              rel="noopener noreferrer"
              className="cab-btn cab-btn-ghost cab-btn-sm gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Відстежити
            </a>
          </div>
        </div>
      ) : canCreateTtn ? (
        /* ── Создать ТТН ── */
        <div>
          {!showTtnForm ? (
            <button
              onClick={() => setShowTtnForm(true)}
              className="cab-btn cab-btn-primary gap-1.5"
            >
              <Truck className="w-4 h-4" />
              Создать ТТН
            </button>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Вес (кг)</label>
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={ttnWeight}
                    onChange={e => setTtnWeight(e.target.value)}
                    className="form-input"
                    placeholder="1"
                  />
                </div>
                <div>
                  <label className="form-label">Оценочная стоимость (₴)</label>
                  <input
                    type="number"
                    min="0"
                    value={ttnCost}
                    onChange={e => setTtnCost(e.target.value)}
                    className="form-input"
                    placeholder="500"
                  />
                </div>
              </div>
              <div>
                <label className="form-label">Описание груза</label>
                <input
                  type="text"
                  value={ttnDescription}
                  onChange={e => setTtnDescription(e.target.value)}
                  className="form-input"
                  placeholder="Автозапчастини"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleCreateTtn}
                  disabled={ttnCreating}
                  className="cab-btn cab-btn-primary gap-1.5 disabled:opacity-60"
                >
                  {ttnCreating ? 'Создание…' : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Підтвердити
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowTtnForm(false)}
                  className="cab-btn cab-btn-ghost"
                  disabled={ttnCreating}
                >
                  Скасувати
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ── Нет данных ── */
        <div className="flex items-start gap-2">
          <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-gray-500 dark:text-slate-400">
            {!npApiKeySet
              ? 'Укажите API-ключ Новой почты в Настройках'
              : 'Сохраните город, отделение и телефон клиента для создания ТТН'}
          </p>
        </div>
      )}
    </div>
  )
}
