import { useState } from 'react'
import { Spinner } from '@/components/ui/Spinner'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useUserProfile, useHasRole, useIsAdmin } from '@/hooks/useUserProfile'
import { PartsAccessDenied } from '@/components/parts/PartsAccessDenied'
import { formatDate } from '@/utils/date'
import { PartsOrder, CreatePartsOrderItemInput } from '@/types/parts'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Plus, Trash2, Edit2, Search, CheckCircle } from 'lucide-react'
import PartsPageHeader from '@/components/parts/PartsPageHeader'
import { formatCurrency, formatPrice } from '@/utils/currency'
import { getPartsOrderStatusColor, getPartsOrderStatusText } from '@/utils/status'
import { updatePartsOrderTotal, getAvailablePartsInventory, getPartsCustomersDropdown, updatePartsOrder, updatePartsOrderStatus, deletePartsOrder, deletePartsOrderItem, createPartsOrderItem } from '@/services/partsService'
import { usePartsExchangeRate } from '@/hooks/usePartsExchangeRate'
import { useConfirm } from '@/hooks/useConfirm'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { moveToTrash } from '@/services/trashService'

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

  // Получить заказ с деталями
  const { data: order, isLoading } = useQuery({
    queryKey: ['parts-order', id],
    queryFn: async () => {
      const { getPartsOrder } = await import('@/services/partsService')
      return getPartsOrder(id!)
    },
    enabled: !!id,
  })

  // Удалить позицию из заказа
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

  // Изменить статус заказа
  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
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

  // Удалить заказ целиком (только владелец)
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
      queryClient.invalidateQueries({ queryKey: ['parts-orders'] })
      queryClient.invalidateQueries({ queryKey: ['parts-inventory'] })
      queryClient.invalidateQueries({ queryKey: ['trash'] })
      navigate('/parts/orders')
    },
  })

  const canEdit = order && (order.status === 'new' || order.status === 'in_progress')
  const isAdmin = useIsAdmin()
  const isOwner = useHasRole('parts_owner') || isAdmin
  // Owner can always manage the order; workers only when new/in_progress
  const canManage = Boolean(order) && (!!canEdit || isOwner)

  // Compute total client-side so it's always correct regardless of DB stored value
  // Use price_at_sale_currency from order item; fall back to inventory item's price_currency
  const getItemCurrency = (item: any): 'UAH' | 'USD' =>
    item.price_at_sale_currency || item.inventory_item?.price_currency || 'USD'

  const computedTotalUAH = (order?.items ?? []).reduce((sum, item: any) => {
    const amount = (item.price_at_sale || 0) * (item.quantity || 1)
    return sum + (getItemCurrency(item) === 'USD' ? amount * (exchangeRate || 41) : amount)
  }, 0)
  const hasUSD = (order?.items ?? []).some((i: any) => getItemCurrency(i) === 'USD')
  const hasUAH = (order?.items ?? []).some((i: any) => getItemCurrency(i) === 'UAH')

  if (!partsCompanyId) {
    return <PartsAccessDenied />
  }

  if (isLoading) {
    return (
      <div className="min-h-dvh bg-gray-50 flex items-center justify-center">
        <Spinner size="md" className="inline-block" />
      </div>
    )
  }

  if (!order) {
    return (
      <div className="min-h-dvh bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-gray-600">Заказ не найден</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-gray-50 pb-20">
      <PartsPageHeader
        title={order.order_number}
        backPath="/parts/orders"
        actions={
          <>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getPartsOrderStatusColor(order.status)}`}>
              {getPartsOrderStatusText(order.status)}
            </span>
            {isOwner && (
              <button
                onClick={async () => {
                  const ok = await showConfirm({ message: `Удалить заказ ${order.order_number}? Забронированные запчасти вернутся в статус "В наличии".`, danger: true })
                  if (!ok) return
                  deleteOrderMutation.mutate()
                }}
                disabled={deleteOrderMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors text-sm font-medium"
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">Удалить</span>
              </button>
            )}
          </>
        }
      />

      {/* Content */}
      <div className="w-full py-4 sm:py-8 space-y-6">
        {/* Status Actions */}
        {canManage && (
          <div className="stat-card">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Статус заказа:
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => updateStatusMutation.mutate('new')}
                disabled={order.status === 'new'}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:cursor-not-allowed ${
                  order.status === 'new'
                    ? 'bg-blue-600 text-white opacity-60'
                    : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                }`}
              >
                Новый
              </button>
              <button
                onClick={() => updateStatusMutation.mutate('in_progress')}
                disabled={order.status === 'in_progress'}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:cursor-not-allowed ${
                  order.status === 'in_progress'
                    ? 'bg-yellow-500 text-white opacity-60'
                    : 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
                }`}
              >
                В работе
              </button>
              <button
                onClick={() => updateStatusMutation.mutate('cancelled')}
                className="px-4 py-2 text-sm font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Отменить
              </button>
            </div>
          </div>
        )}

        {/* Order Information */}
        <div className="bg-white rounded-lg shadow-sm p-3 sm:p-4 lg:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Информация о заказе</h2>
            {canManage && (
              <button
                onClick={() => setShowEditModal(true)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Edit2 className="w-5 h-5 text-gray-600" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-500">Дата заказа</p>
              <p className="text-base font-medium text-gray-900">{formatDate(order.order_date)}</p>
            </div>

            {order.customer && (
              <>
                <div>
                  <p className="text-sm text-gray-500">Клиент</p>
                  <p className="text-base font-medium text-gray-900">{order.customer.full_name}</p>
                </div>
                {order.customer.phone && (
                  <div>
                    <p className="text-sm text-gray-500">Телефон</p>
                    <p className="text-base font-medium text-gray-900">{order.customer.phone}</p>
                  </div>
                )}
              </>
            )}

            <div>
              <p className="text-sm text-gray-500">Общая сумма</p>
              <p className="text-2xl font-bold text-primary">{formatCurrency(computedTotalUAH)}</p>
              {hasUSD && hasUAH && (
                <p className="text-xs text-gray-400 mt-0.5">С курсом {exchangeRate || 41} ₴/$</p>
              )}
            </div>
          </div>

          {order.notes && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-sm text-gray-500 mb-1">Примечание</p>
              <p className="text-base text-gray-900">{order.notes}</p>
            </div>
          )}
        </div>

        {/* Order Items */}
        <div className="bg-white rounded-lg shadow-sm p-3 sm:p-4 lg:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Позиции заказа ({order.items?.length || 0})
            </h2>
            {canManage && (
              <button
                onClick={() => setShowAddItemModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Добавить</span>
              </button>
            )}
          </div>

          {!order.items || order.items.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>Нет позиций в заказе</p>
              {canManage && (
                <button
                  onClick={() => setShowAddItemModal(true)}
                  className="mt-2 text-primary hover:underline"
                >
                  Добавить первую позицию
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {order.items.map((item) => (
                <div
                  key={item.id}
                  className={`border rounded-lg p-4 transition-colors ${
                    item.inventory_item_id == null
                      ? 'border-gray-100 bg-gray-50 opacity-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 mb-1">
                        {item.inventory_item?.name ?? <span className="italic text-gray-400">Запчасть удалена</span>}
                      </h3>
                      <div className="text-sm text-gray-600 space-y-1">
                        {item.inventory_item?.part_number && (
                          <p>Артикул: {item.inventory_item.part_number}</p>
                        )}
                        {item.inventory_item?.category && (
                          <p>Категория: {item.inventory_item.category.name}</p>
                        )}
                        <p>Количество: {item.quantity} шт.</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <div className="text-right">
                        <p className="text-base font-semibold text-gray-500">
                          {formatPrice(item.price_at_sale, getItemCurrency(item))}
                        </p>
                        <p className="text-lg font-bold text-gray-900">
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
                          className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Complete Order Button */}
        {canManage && order.status !== 'completed' && order.items && order.items.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4 sm:static sm:bg-transparent sm:border-0 sm:shadow-none sm:p-0">
            <button
              onClick={() => setShowCompleteModal(true)}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-green-700 text-white rounded-lg hover:bg-green-800 transition-colors font-medium"
            >
              <CheckCircle className="w-5 h-5" />
              Завершить заказ
            </button>
          </div>
        )}
      </div>

      {/* Modals */}
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

// Add Item Modal Component
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

  // Получить доступный инвентарь
  const { data: inventory = [] } = useQuery({
    queryKey: ['parts-inventory-for-order', partsCompanyId],
    queryFn: () => getAvailablePartsInventory(partsCompanyId),
  })

  const filteredInventory = inventory.filter(item => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      item.name.toLowerCase().includes(query) ||
      item.part_number?.toLowerCase().includes(query)
    )
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
      alert(`Недостаточно запчастей на складе. Доступно: ${selectedItem.quantity}`)
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
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-dvh items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />

        <div className="inline-block align-bottom bg-white rounded-t-2xl sm:rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Добавить позицию
            </h3>

            {/* Search */}
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Поиск запчасти..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            {/* Inventory List */}
            <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg mb-4">
              {filteredInventory.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  Запчасти не найдены
                </div>
              ) : (
                <div className="divide-y">
                  {filteredInventory.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleSelectItem(item)}
                      className={`w-full p-3 text-left hover:bg-gray-50 transition-colors ${
                        selectedItem?.id === item.id ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div className="font-medium text-gray-900">{item.name}</div>
                      <div className="text-sm text-gray-600">
                        {item.part_number && <span>Артикул: {item.part_number} • </span>}
                        {(item.category as any)?.name && <span>{(item.category as any).name} • </span>}
                        <span>В наличии: {item.quantity} шт. • </span>
                        <span className="font-medium">{formatPrice(item.selling_price || 0, (item.price_currency || 'USD') as 'UAH' | 'USD')}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Selected Item Details */}
            {selectedItem && (
              <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    Выбрано: {selectedItem.name}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Количество *
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={selectedItem.quantity}
                      value={quantity}
                      onChange={(e) => setQuantity(Number(e.target.value))}
                      className="w-full px-3 py-2 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Макс: {selectedItem.quantity}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Цена продажи *
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={price}
                        onChange={(e) => setPrice(Number(e.target.value))}
                        className="flex-1 min-w-0 px-3 py-2 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <div className="flex gap-1 flex-shrink-0">
                        {(['UAH', 'USD'] as const).map(c => (
                          <button
                            type="button"
                            key={c}
                            onClick={() => setCurrency(c)}
                            className={`px-2.5 py-2 rounded-md text-sm font-semibold transition-colors ${
                              currency === c
                                ? 'bg-primary text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            {c === 'UAH' ? '₴' : '$'}
                          </button>
                        ))}
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">Заполнено из прайса, можно изменить</p>
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-200">
                  <p className="text-lg font-semibold text-gray-900">
                    Итого: {formatPrice(quantity * price, currency)}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="bg-gray-50 px-4 py-3 sm:px-6 flex flex-col-reverse sm:flex-row gap-2 sm:gap-3">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1 sm:flex-none"
            >
              Отмена
            </button>
            <button
              onClick={handleAdd}
              disabled={!selectedItem || addItemMutation.isPending || quantity <= 0 || price <= 0}
              className="btn-primary flex-1 sm:flex-none disabled:opacity-50"
            >
              {addItemMutation.isPending ? 'Добавление...' : 'Добавить'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Edit Order Modal
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
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-dvh items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />

        <div className="inline-block align-bottom bg-white rounded-t-2xl sm:rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Редактировать заказ
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Клиент
                </label>
                <select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="w-full px-3 py-2 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Примечание
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>
            </div>
          </div>

          <div className="bg-gray-50 px-4 py-3 sm:px-6 flex flex-col-reverse sm:flex-row gap-2 sm:gap-3">
            <button
              onClick={onClose}
              className="btn-secondary flex-1 sm:flex-none"
            >
              Отмена
            </button>
            <button
              onClick={() => updateMutation.mutate()}
              disabled={updateMutation.isPending}
              className="btn-primary flex-1 sm:flex-none disabled:opacity-50"
            >
              {updateMutation.isPending ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Confirm Complete Modal
interface ConfirmCompleteModalProps {
  onConfirm: () => void
  onClose: () => void
  isLoading: boolean
}

function ConfirmCompleteModal({ onConfirm, onClose, isLoading }: ConfirmCompleteModalProps) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-dvh items-center justify-center px-4 text-center sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6">
            <div className="sm:flex sm:items-start">
              <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-green-100 sm:mx-0 sm:h-10 sm:w-10">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  Завершить заказ?
                </h3>
                <div className="mt-2">
                  <p className="text-sm text-gray-500">
                    При завершении заказа количество запчастей в инвентаре будет автоматически уменьшено. 
                    Это действие нельзя будет отменить.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse gap-2">
            <button
              onClick={onConfirm}
              disabled={isLoading}
              className="btn-success sm:ml-3 w-full sm:w-auto disabled:opacity-50"
            >
              {isLoading ? 'Завершение...' : 'Да, завершить'}
            </button>
            <button
              onClick={onClose}
              className="mt-3 sm:mt-0 btn-secondary w-full sm:w-auto"
            >
              Отмена
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
