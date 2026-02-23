import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useUserProfile } from '@/hooks/useUserProfile'
import { PartsOrder, CreatePartsOrderItemInput } from '@/types/parts'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, Edit2, Search, CheckCircle } from 'lucide-react'
import { formatCurrency, formatPrice } from '@/utils/currency'
import { getPartsOrderStatusColor, getPartsOrderStatusText } from '@/utils/status'

export default function PartsOrderDetails() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: profile } = useUserProfile()
  const partsCompanyId = profile?.parts_company_id
  const queryClient = useQueryClient()

  const [showAddItemModal, setShowAddItemModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showCompleteModal, setShowCompleteModal] = useState(false)

  // Получить заказ с деталями
  const { data: order, isLoading } = useQuery({
    queryKey: ['parts-order', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parts_orders')
        .select(`
          *,
          customer:parts_customers(*),
          items:parts_order_items(
            *,
            inventory_item:parts_inventory(
              id, name, part_number, category_id, quantity,
              category:parts_categories(name)
            )
          )
        `)
        .eq('id', id)
        .single()

      if (error) throw error
      return data as PartsOrder
    },
    enabled: !!id,
  })

  // Удалить позицию из заказа
  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase
        .from('parts_order_items')
        .delete()
        .eq('id', itemId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts-order', id] })
    },
  })

  // Изменить статус заказа
  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase
        .from('parts_orders')
        .update({ status })
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts-order', id] })
      queryClient.invalidateQueries({ queryKey: ['parts-orders'] })
      queryClient.invalidateQueries({ queryKey: ['parts-inventory'] })
      setShowCompleteModal(false)
    },
  })

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  const canEdit = order && (order.status === 'new' || order.status === 'in_progress')

  if (!partsCompanyId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-gray-600">У вас нет доступа к разборке</p>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-gray-600">Заказ не найден</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <button
                onClick={() => navigate('/parts/orders')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-lg sm:text-2xl font-bold text-gray-900 truncate">
                {order.order_number}
              </h1>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getPartsOrderStatusColor(order.status)}`}>
                {getPartsOrderStatusText(order.status)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-6">
        {/* Status Actions (only for non-completed/cancelled) */}
        {canEdit && (
          <div className="bg-white rounded-lg shadow-sm p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Статус заказа:
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => updateStatusMutation.mutate('new')}
                disabled={order.status === 'new'}
                className="px-4 py-2 bg-blue-100 text-blue-800 rounded-lg hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Новый
              </button>
              <button
                onClick={() => updateStatusMutation.mutate('in_progress')}
                disabled={order.status === 'in_progress'}
                className="px-4 py-2 bg-yellow-100 text-yellow-800 rounded-lg hover:bg-yellow-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                В работе
              </button>
              <button
                onClick={() => updateStatusMutation.mutate('cancelled')}
                className="px-4 py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 transition-colors"
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
            {canEdit && (
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
              <p className="text-2xl font-bold text-primary">{formatCurrency(order.total_amount)} ₴</p>
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
            {canEdit && (
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
              {canEdit && (
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
                  className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 mb-1">
                        {item.inventory_item?.name}
                      </h3>
                      <div className="text-sm text-gray-600 space-y-1">
                        {item.inventory_item?.part_number && (
                          <p>Артикул: {item.inventory_item.part_number}</p>
                        )}
                        {item.inventory_item?.category && (
                          <p>Категория: {item.inventory_item.category.name}</p>
                        )}
                        <p>Количество: {item.quantity} шт.</p>
                        <p>Цена: {formatPrice(item.price_at_sale, item.price_at_sale_currency as 'UAH' | 'USD')}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <div className="text-right">
                        <p className="text-lg font-bold text-gray-900">
                          {formatCurrency(item.subtotal)} ₴
                        </p>
                      </div>
                      {canEdit && (
                        <button
                          onClick={() => {
                            if (confirm('Удалить позицию из заказа?')) {
                              deleteItemMutation.mutate(item.id)
                            }
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
        {canEdit && order.items && order.items.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4 sm:static sm:bg-transparent sm:border-0 sm:shadow-none sm:p-0">
            <button
              onClick={() => setShowCompleteModal(true)}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
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
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedItem, setSelectedItem] = useState<any>(null)
  const [quantity, setQuantity] = useState(1)
  const [price, setPrice] = useState(0)
  const [currency, setCurrency] = useState<'UAH' | 'USD'>('UAH')

  // Получить доступный инвентарь
  const { data: inventory = [] } = useQuery({
    queryKey: ['parts-inventory-for-order', partsCompanyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parts_inventory')
        .select(`
          id, name, part_number, quantity, selling_price, price_currency,
          category:parts_categories(name)
        `)
        .eq('parts_company_id', partsCompanyId)
        .gt('quantity', 0)
        .order('name')

      if (error) throw error
      return data
    },
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
    mutationFn: async (input: CreatePartsOrderItemInput) => {
      const { error } = await supabase
        .from('parts_order_items')
        .insert({
          order_id: orderId,
          inventory_item_id: input.inventory_item_id,
          quantity: input.quantity,
          price_at_sale: input.price_at_sale,
          price_at_sale_currency: input.price_at_sale_currency || 'UAH',
        })

      if (error) throw error
    },
    onSuccess: () => {
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
      <div className="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
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
                        {item.category?.[0]?.name && <span>{item.category[0].name} • </span>}
                        <span>В наличии: {item.quantity} шт. • </span>
                        <span className="font-medium">{formatPrice(item.selling_price || 0, item.price_currency || 'UAH')}</span>
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
                    Итого: {(quantity * price).toFixed(2)} ₴
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="bg-gray-50 px-4 py-3 sm:px-6 flex flex-col-reverse sm:flex-row gap-2 sm:gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2 bg-white border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Отмена
            </button>
            <button
              onClick={handleAdd}
              disabled={!selectedItem || addItemMutation.isPending || quantity <= 0 || price <= 0}
              className="flex-1 sm:flex-none px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
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
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parts_customers')
        .select('id, full_name, phone')
        .eq('parts_company_id', partsCompanyId)
        .order('full_name')

      if (error) throw error
      return data
    },
  })

  const updateMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('parts_orders')
        .update({
          customer_id: customerId || null,
          notes: notes || null,
        })
        .eq('id', order.id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts-order', order.id] })
      onClose()
    },
  })

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
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
              className="flex-1 sm:flex-none px-4 py-2 bg-white border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Отмена
            </button>
            <button
              onClick={() => updateMutation.mutate()}
              disabled={updateMutation.isPending}
              className="flex-1 sm:flex-none px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
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
      <div className="flex min-h-screen items-center justify-center px-4 text-center sm:p-0">
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
              className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
            >
              {isLoading ? 'Завершение...' : 'Да, завершить'}
            </button>
            <button
              onClick={onClose}
              className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary sm:mt-0 sm:w-auto sm:text-sm"
            >
              Отмена
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
