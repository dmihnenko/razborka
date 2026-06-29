import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
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
  CheckCircle, MapPin, Truck, Package, X, Copy, ExternalLink, AlertTriangle,
} from 'lucide-react'
import { getNpApiKey } from '@/utils/npApiKey'
import { searchCities, searchWarehouses, NpCity, NpWarehouse, createTtn } from '@/services/npService'
import { formatCurrency, formatPrice } from '@/utils/currency'
import { getPartsOrderStatusText, statusBadgeClass } from '@/utils/status'
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
import { getEntityActivity } from '@/services/activityLogService'
import { History } from 'lucide-react'

export default function PartsOrderDetails() {
  const { t } = useTranslation('cabinet')
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

  /* ── история заказа (таймлайн статусов/событий) ─────────────── */
  const { data: timeline = [] } = useQuery({
    queryKey: ['parts-order-activity', id],
    queryFn: () => getEntityActivity(partsCompanyId!, 'order', id!),
    enabled: !!id && !!partsCompanyId,
  })

  /* ── удалить позицию ────────────────────────────────────────── */
  const deleteItemMutation = useMutation({
    mutationFn: ({ itemId, inventoryItemId }: { itemId: string; inventoryItemId: string }) =>
      deletePartsOrderItem(itemId, inventoryItemId),
    onSuccess: async () => {
      if (id) await updatePartsOrderTotal(id, exchangeRate)
      queryClient.invalidateQueries({ queryKey: ['parts-order', id] })
      queryClient.invalidateQueries({ queryKey: ['parts-inventory'] })
      toast.success(t('orderDetailsPage.itemDeleted'))
    },
    onError: () => toast.error(t('orderDetailsPage.itemDeleteError')),
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
      queryClient.invalidateQueries({ queryKey: ['parts-order-activity', id] })
      queryClient.invalidateQueries({ queryKey: ['parts-orders'] })
      queryClient.invalidateQueries({ queryKey: ['parts-inventory'] })
      setShowCompleteModal(false)
      toast.success(t('orderDetailsPage.statusUpdated'))
    },
    onError: (err: any) => {
      toast.error(err?.message || t('orderDetailsPage.statusUpdateError'))
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
      // Заявка с маркета теряет ссылку на заказ (FK SET NULL) → вернётся в «Активные»
      queryClient.invalidateQueries({ queryKey: ['marketplace-orders'] })
      queryClient.invalidateQueries({ queryKey: ['parts-inventory'] })
      queryClient.invalidateQueries({ queryKey: ['parts-inventory'] })
      queryClient.invalidateQueries({ queryKey: ['trash'] })
      toast.success(t('orderDetailsPage.orderMovedToTrash'))
      navigate('/parts/orders')
    },
  })

  const canEdit   = order && (order.status === 'new' || order.status === 'assembling' || order.status === 'in_progress')
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
    if (getItemCurrency(item) !== 'USD') return sum + amount
    // USD → грн: курс ещё не загружен — пропускаем (без NaN; пересчитается, когда курс придёт)
    return exchangeRate != null ? sum + amount * exchangeRate : sum
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
      if (!order) throw new Error(t('orderDetailsPage.noOrderError'))
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
      toast.success(t('orderDetailsPage.customerSaved'))
    },
    onError: (err: any) => toast.error(err?.message || t('orderDetailsPage.customerSaveError')),
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
        <p className="text-gray-500">{t('orderDetailsPage.orderNotFound')}</p>
        <button
          onClick={() => navigate('/parts/orders')}
          className="text-primary text-sm hover:underline"
        >
          {t('orderDetailsPage.backToOrders')}
        </button>
      </div>
    )
  }

  const statusBadgeCls = statusBadgeClass(order.status)

  // Таймлайн + синтетическое событие «Заказ создан» (старейшее, в самом низу).
  const timelineFull = [
    ...timeline,
    { id: '__created', detail: t('orderDetailsPage.created', { defaultValue: 'Заказ создан' }), action: 'created', created_at: order.created_at, user_name: null as string | null },
  ]

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
                aria-label={t('orderDetailsPage.back')}
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
                  {/* Цепочка: Новый → Сборка → Отправлен → Завершён. Каждый этап — один шаг вперёд. */}
                  {order.status === 'new' && (
                    <button
                      onClick={() => updateStatusMutation.mutate('assembling')}
                      disabled={updateStatusMutation.isPending}
                      className="cab-btn cab-btn-sm cab-btn-primary"
                    >
                      {t('orderDetailsPage.toAssembling')}
                    </button>
                  )}
                  {(order.status === 'assembling' || order.status === 'in_progress') && (
                    <button
                      onClick={() => updateStatusMutation.mutate('shipped')}
                      disabled={updateStatusMutation.isPending}
                      className="cab-btn cab-btn-sm cab-btn-secondary"
                    >
                      {t('orderDetailsPage.toShipped')}
                    </button>
                  )}
                  {/* Завершить — из «Сборки» (самовывоз) и из «Отправлен» */}
                  {(order.status === 'assembling' || order.status === 'shipped' || order.status === 'in_progress') && (
                    <button
                      onClick={() => setShowCompleteModal(true)}
                      disabled={updateStatusMutation.isPending}
                      className="cab-btn cab-btn-sm cab-btn-primary"
                    >
                      {t('orderDetailsPage.complete')}
                    </button>
                  )}
                  {order.status !== 'completed' && order.status !== 'cancelled' && (
                    <button
                      onClick={() => updateStatusMutation.mutate('cancelled')}
                      disabled={updateStatusMutation.isPending}
                      className="cab-btn cab-btn-sm cab-btn-danger"
                    >
                      {t('orderDetailsPage.cancel')}
                    </button>
                  )}
                </div>
              )}

              {canManage && (
                <button
                  onClick={() => setShowEditModal(true)}
                  className="btn-icon"
                  aria-label={t('orderDetailsPage.edit')}
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              )}

              {isOwner && (
                <button
                  onClick={async () => {
                    const ok = await showConfirm({
                      message: t('orderDetailsPage.deleteOrderConfirm', { num: order.order_number }),
                      danger: true,
                    })
                    if (!ok) return
                    deleteOrderMutation.mutate()
                  }}
                  disabled={deleteOrderMutation.isPending}
                  className="btn-icon text-red-500 hover:bg-red-50"
                  aria-label={t('orderDetailsPage.deleteOrder')}
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
              <h2 className="heading-3">{t('orderDetailsPage.customerAndDelivery')}</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="form-label">{t('orderDetailsPage.customerFullName')}</label>
                <input
                  type="text"
                  value={customerFullName}
                  onChange={(e) => setCustomerFullName(e.target.value)}
                  placeholder={t('orderDetailsPage.customerFullNamePlaceholder')}
                  className="form-input"
                />
              </div>
              <div>
                <label className="form-label">{t('orderDetailsPage.phone')}</label>
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
                <label className="form-label">{t('orderDetailsPage.city')}</label>
                {npApiKeySet ? (
                  <NpCombobox
                    value={cityInputValue}
                    onChange={setCityInputValue}
                    placeholder={t('orderDetailsPage.cityPlaceholder')}
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
                    placeholder={t('orderDetailsPage.cityExample')}
                    className="form-input"
                  />
                )}
              </div>
              <div>
                <label className="form-label">{t('orderDetailsPage.npOffice')}</label>
                {npApiKeySet ? (
                  <NpCombobox
                    value={warehouseInputValue}
                    onChange={setWarehouseInputValue}
                    placeholder={cityRef ? t('orderDetailsPage.warehousePlaceholder') : t('orderDetailsPage.selectCityFirst')}
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
                {saveCustomerMutation.isPending ? t('orderDetailsPage.saving') : t('orderDetailsPage.saveCustomer')}
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
                {t('orderDetailsPage.items')}
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
                <span className="hidden sm:inline">{t('orderDetailsPage.add')}</span>
              </button>
            )}
          </div>

          {!order.items || order.items.length === 0 ? (
            <div className="empty-state py-10">
              <div className="empty-state-icon">
                <Package className="w-7 h-7 text-gray-400" />
              </div>
              <p className="empty-state-title">{t('orderDetailsPage.noItems')}</p>
              <p className="empty-state-text">{t('orderDetailsPage.noItemsHint')}</p>
              {canManage && (
                <button
                  onClick={() => setShowAddItemModal(true)}
                  className="mt-3 cab-btn cab-btn-primary cab-btn-sm"
                >
                  <Plus className="w-3.5 h-3.5" strokeWidth={2} />
                  {t('orderDetailsPage.addItem')}
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
                        <span className="italic text-gray-400">{t('orderDetailsPage.partDeleted')}</span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {item.inventory_item?.part_number && (
                        <span>{item.inventory_item.part_number} · </span>
                      )}
                      {item.inventory_item?.category && (
                        <span>{item.inventory_item.category.name} · </span>
                      )}
                      <span>{t('orderDetailsPage.pcs', { n: item.quantity })}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-xs text-gray-400 tabular">
                        {formatPrice(item.price_at_sale, getItemCurrency(item))} {t('orderDetailsPage.perPcs')}
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
                          const ok = await showConfirm({ message: t('orderDetailsPage.deleteItemConfirm'), danger: true })
                          if (!ok) return
                          deleteItemMutation.mutate({
                            itemId: item.id,
                            inventoryItemId: item.inventory_item_id,
                          })
                        }}
                        className="btn-icon-sm text-red-400 hover:text-red-600 hover:bg-red-50"
                        aria-label={t('orderDetailsPage.deleteItem')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {/* строка итого */}
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t border-gray-100">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('orderDetailsPage.total')}</span>
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
            // Авто-переход в «Отправлен» при создании ТТН (если заказ ещё не завершён/отменён)
            if (order.status !== 'completed' && order.status !== 'cancelled' && order.status !== 'shipped') {
              const invIds = (order.items ?? []).map((i: any) => i.inventory_item_id).filter(Boolean)
              updatePartsOrderStatus(order.id, 'shipped', invIds).catch(() => { /* не блокируем ТТН */ })
            }
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
            toast.success(t('orderDetailsPage.ttnCreated', { ttn }))
          }}
          orderId={order.id}
        />

        {/* ── таймлайн заказа (история статусов/событий) ──────────────── */}
        {timelineFull.length > 0 && (
          <div className="cab-card p-4">
            <div className="flex items-center gap-2 mb-4">
              <span className="icon-tile-sm bg-slate-100 text-slate-600">
                <History className="w-4 h-4" />
              </span>
              <h2 className="heading-3">{t('orderDetailsPage.timeline')}</h2>
            </div>
            <ol className="relative border-l border-gray-200 ml-2 space-y-4">
              {timelineFull.map((e) => (
                <li key={e.id} className="ml-4">
                  <span className="absolute -left-[5px] w-2.5 h-2.5 rounded-full bg-primary mt-1.5" />
                  <p className="text-sm text-gray-800">{e.detail || e.action}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {formatDate(e.created_at)}{e.user_name ? ` · ${e.user_name}` : ''}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* ── кнопка «Завершить» ────────────────────────────────────── */}
        {canManage && order.status !== 'completed' && order.status !== 'cancelled' && order.items && order.items.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-sm border-t border-gray-100 px-4 py-3 sm:static sm:bg-transparent sm:border-0 sm:backdrop-blur-none sm:px-0 sm:py-0 sm:flex sm:justify-end"
               style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
          >
            <button
              onClick={() => setShowCompleteModal(true)}
              className="cab-btn cab-btn-success cab-btn-lg gap-2 w-full sm:w-auto"
            >
              <CheckCircle className="w-5 h-5" />
              {t('orderDetailsPage.completeOrder')}
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
        <ul className="absolute z-50 left-0 right-0 top-full mt-1 max-h-56 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
          {items.map(item => (
            <li key={item.value}>
              <button
                type="button"
                className="w-full text-left px-4 py-2.5 text-sm text-gray-800 hover:bg-slate-100 transition-colors"
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
  const { t } = useTranslation('cabinet')
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
      toast.error(t('orderDetailsPage.notEnoughParts', { n: selectedItem.quantity }))
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
    <div className="modal-overlay">
      <div
        className="modal-sheet sm:max-w-2xl animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-handle" />

        <div className="modal-header">
          <h3 className="heading-3">{t('orderDetailsPage.addItemModalTitle')}</h3>
          <button onClick={onClose} className="btn-icon-sm" aria-label={t('orderDetailsPage.close')}><X className="w-4 h-4" /></button>
        </div>

        <div className="modal-body space-y-4">
          {/* поиск */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder={t('orderDetailsPage.searchPartPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="modal-input pl-9"
            />
          </div>

          {/* список инвентаря */}
          <div className="max-h-56 overflow-y-auto rounded-lg border border-gray-100 grid-hairline">
            {filteredInventory.length === 0 ? (
              <div className="py-6 text-center text-sm text-gray-500">{t('orderDetailsPage.partsNotFound')}</div>
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
                    <span>{t('orderDetailsPage.inStock', { n: item.quantity })} · </span>
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
                {t('orderDetailsPage.selected')} {selectedItem.name}
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">{t('orderDetailsPage.quantity')}</label>
                  <input
                    type="number"
                    min="1"
                    max={selectedItem.quantity}
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className="form-input"
                  />
                  <p className="text-xs text-gray-400 mt-1">{t('orderDetailsPage.max', { n: selectedItem.quantity })}</p>
                </div>

                <div>
                  <label className="form-label">{t('orderDetailsPage.sellingPrice')}</label>
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
                          {c === 'UAH' ? 'грн' : '$'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{t('orderDetailsPage.fromPriceHint')}</p>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200">
                <p className="text-sm text-gray-500">
                  {t('orderDetailsPage.totalLabel')}{' '}
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
            {t('orderDetailsPage.cancelBtn')}
          </button>
          <button
            onClick={handleAdd}
            disabled={!selectedItem || addItemMutation.isPending || quantity <= 0 || price <= 0}
            className="cab-btn cab-btn-primary disabled:opacity-50"
          >
            {addItemMutation.isPending ? t('orderDetailsPage.adding') : t('orderDetailsPage.add')}
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
  const { t } = useTranslation('cabinet')
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
    <div className="modal-overlay">
      <div
        className="modal-sheet animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-handle" />

        <div className="modal-header">
          <h3 className="heading-3">{t('orderDetailsPage.editOrderTitle')}</h3>
          <button onClick={onClose} className="btn-icon-sm" aria-label={t('orderDetailsPage.close')}><X className="w-4 h-4" /></button>
        </div>

        <div className="modal-body space-y-4">
          <div>
            <label className="form-label">{t('orderDetailsPage.customer')}</label>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="form-select"
            >
              <option value="">{t('orderDetailsPage.noCustomer')}</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.full_name}
                  {customer.phone && ` (${customer.phone})`}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">{t('orderDetailsPage.notes')}</label>
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
            {t('orderDetailsPage.cancelBtn')}
          </button>
          <button
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending}
            className="cab-btn cab-btn-primary disabled:opacity-50"
          >
            {updateMutation.isPending ? t('orderDetailsPage.saving') : t('orderDetailsPage.save')}
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
  const { t } = useTranslation('cabinet')
  return (
    <div className="modal-overlay">
      <div
        className="modal-sheet animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-handle" />

        <div className="modal-header">
          <div className="flex items-center gap-3">
            <span className="icon-tile bg-emerald-100 text-emerald-700">
              <CheckCircle className="w-5 h-5" />
            </span>
            <h3 className="heading-3">{t('orderDetailsPage.completeOrderQuestion')}</h3>
          </div>
        </div>

        <div className="modal-body">
          <div className="alert alert-warning">
            <p>
              {t('orderDetailsPage.completeWarning')}
            </p>
          </div>
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="modal-btn-cancel">
            {t('orderDetailsPage.cancelBtn')}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="cab-btn cab-btn-success flex-1 disabled:opacity-50"
          >
            {isLoading ? t('orderDetailsPage.completing') : t('orderDetailsPage.yesComplete')}
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
  const { t } = useTranslation('cabinet')
  const npApiKeySet = Boolean(getNpApiKey())

  const hasTtn = Boolean(order.np_ttn)

  // Условие для показа кнопки создания ТТН
  const customerNpCityRef = (order.customer as any)?.np_city_ref || npCityRef
  const customerNpWarehouseRef = (order.customer as any)?.np_warehouse_ref || npWarehouseRef
  const customerName = order.customer?.full_name || customerFullName
  const customerPhone_ = order.customer?.phone || customerPhone

  // Для ТТН обязательны: имя И фамилия (2 слова), телефон, город + отделение НП
  const hasFullName = (customerName || '').trim().split(/\s+/).filter(Boolean).length >= 2
  const hasNp = Boolean(customerNpCityRef) && Boolean(customerNpWarehouseRef)
  const hasPhone = Boolean(customerPhone_)

  const canCreateTtn = npApiKeySet && hasFullName && hasPhone && hasNp

  // Список незаполненных обязательных полей — показываем работнику
  const ttnMissing = [
    !hasFullName && t('orderDetailsPage.reqName'),
    !hasPhone && t('orderDetailsPage.reqPhone'),
    !hasNp && t('orderDetailsPage.reqNp'),
  ].filter(Boolean) as string[]

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
      toast.error(err?.message || t('orderDetailsPage.ttnCreateError'))
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
        <h2 className="heading-3">{t('orderDetailsPage.npDelivery')}</h2>
      </div>

      {hasTtn ? (
        /* ── ТТН вже є ── */
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50 border border-emerald-100">
            <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-emerald-700 font-medium">{t('orderDetailsPage.ttnNumber')}</p>
              <p className="text-base font-bold text-emerald-900 tabular tracking-wide">
                {order.np_ttn}
              </p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => {
                navigator.clipboard.writeText(order.np_ttn)
                toast.success(t('orderDetailsPage.ttnCopied'))
              }}
              className="cab-btn cab-btn-secondary cab-btn-sm gap-1.5"
            >
              <Copy className="w-3.5 h-3.5" />
              {t('orderDetailsPage.copy')}
            </button>
            <a
              href={`https://novaposhta.ua/tracking/?cargo_number=${order.np_ttn}`}
              target="_blank"
              rel="noopener noreferrer"
              className="cab-btn cab-btn-ghost cab-btn-sm gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              {t('orderDetailsPage.track')}
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
              {t('orderDetailsPage.createTtn')}
            </button>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">{t('orderDetailsPage.weight')}</label>
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
                  <label className="form-label">{t('orderDetailsPage.estimatedCost')}</label>
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
                <label className="form-label">{t('orderDetailsPage.cargoDescription')}</label>
                <input
                  type="text"
                  value={ttnDescription}
                  onChange={e => setTtnDescription(e.target.value)}
                  className="form-input"
                  placeholder={t('orderDetailsPage.cargoDescriptionPlaceholder')}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleCreateTtn}
                  disabled={ttnCreating}
                  className="cab-btn cab-btn-primary gap-1.5 disabled:opacity-60"
                >
                  {ttnCreating ? t('orderDetailsPage.creating') : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      {t('orderDetailsPage.confirm')}
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowTtnForm(false)}
                  className="cab-btn cab-btn-ghost"
                  disabled={ttnCreating}
                >
                  {t('orderDetailsPage.cancelBtn2')}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : !npApiKeySet ? (
        /* ── Нет API-ключа НП ── */
        <div className="flex items-start gap-2">
          <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-gray-500">{t('orderDetailsPage.noApiKeyHint')}</p>
        </div>
      ) : (
        /* ── Не заполнены обязательные поля для ТТН ── */
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
          <p className="text-sm font-semibold text-amber-800">{t('orderDetailsPage.reqIntro')}</p>
          <ul className="mt-1.5 space-y-1">
            {ttnMissing.map((m) => (
              <li key={m} className="flex items-center gap-1.5 text-sm text-amber-700">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.8} />
                {m}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
