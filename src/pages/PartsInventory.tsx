import { useState } from 'react'
import { Plus, Search, Package, Grid, List, ArrowLeft, AlertTriangle, TrendingDown, Box } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useUserProfile } from '@/hooks/useUserProfile'
import { getPartsInventory, createPartsInventoryItem, updatePartsInventoryItem, deletePartsInventoryItem } from '@/services/partsService'
import type { PartsInventoryItem, CreatePartsInventoryInput, PartsInventoryStatus } from '@/types/parts'
import { supabase } from '@/lib/supabase'

type ViewMode = 'grid' | 'list'

const statusLabels: Record<PartsInventoryStatus, string> = {
  available: 'В наличии',
  reserved: 'Зарезервировано',
  sold: 'Продано'
}

const statusColors: Record<PartsInventoryStatus, string> = {
  available: 'bg-green-100 text-green-800 border-green-200',
  reserved: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  sold: 'bg-gray-100 text-gray-800 border-gray-200'
}

const conditionLabels = {
  new: 'Новая',
  used: 'Б/У хорошее',
  damaged: 'Повреждена'
}

export default function PartsInventory() {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<PartsInventoryItem | null>(null)
  
  const { data: profile } = useUserProfile()
  const queryClient = useQueryClient()
  const partsCompanyId = profile?.parts_company_id

  const { data: inventory = [], isLoading } = useQuery({
    queryKey: ['parts-inventory', partsCompanyId],
    queryFn: () => getPartsInventory(partsCompanyId!),
    enabled: !!partsCompanyId
  })

  // Get categories for dropdown
  const { data: categories = [] } = useQuery({
    queryKey: ['parts-categories', partsCompanyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parts_categories')
        .select('id, name')
        .eq('parts_company_id', partsCompanyId)
        .order('name')
      if (error) throw error
      return data
    },
    enabled: !!partsCompanyId
  })

  // Get vehicles for dropdown in modal
  const { data: vehicles = [] } = useQuery({
    queryKey: ['parts-vehicles-dropdown', partsCompanyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parts_vehicles')
        .select('id, make, model, year')
        .eq('parts_company_id', partsCompanyId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!partsCompanyId && isModalOpen
  })

  const saveMutation = useMutation({
    mutationFn: async (data: CreatePartsInventoryInput) => {
      if (editingItem) {
        return updatePartsInventoryItem(editingItem.id, data)
      } else {
        return createPartsInventoryItem(data, partsCompanyId!)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts-inventory'] })
      toast.success(editingItem ? 'Запчасть обновлена' : 'Запчасть добавлена')
      setIsModalOpen(false)
      setEditingItem(null)
    },
    onError: () => {
      toast.error('Ошибка при сохранении')
    }
  })

  const deleteMutation = useMutation({
    mutationFn: deletePartsInventoryItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts-inventory'] })
      toast.success('Запчасть удалена')
    },
    onError: () => {
      toast.error('Ошибка при удалении')
    }
  })

  // Filter inventory
  const filteredInventory = inventory.filter((item: PartsInventoryItem) => {
    const matchesSearch = searchQuery === '' ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.part_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter
    
    return matchesSearch && matchesStatus
  })

  // Statistics
  const stats = {
    total: inventory.length,
    totalQuantity: inventory.reduce((sum: number, item: PartsInventoryItem) => sum + item.quantity, 0),
    available: inventory.filter((i: PartsInventoryItem) => i.status === 'available').length,
    reserved: inventory.filter((i: PartsInventoryItem) => i.status === 'reserved').length,
    sold: inventory.filter((i: PartsInventoryItem) => i.status === 'sold').length,
    lowStock: inventory.filter((i: PartsInventoryItem) => i.quantity <= 2 && i.status === 'available').length,
    totalValue: inventory.reduce((sum: number, item: PartsInventoryItem) => 
      sum + (item.selling_price || 0) * item.quantity, 0
    )
  }

  const formatCurrency = (amount?: number) => {
    if (!amount) return '—'
    return new Intl.NumberFormat('ru-RU', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount) + ' ₴'
  }

  const handleEdit = (item: PartsInventoryItem, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingItem(item)
    setIsModalOpen(true)
  }

  const handleDelete = (itemId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirm('Удалить запчасть? Это действие нельзя отменить.')) {
      deleteMutation.mutate(itemId)
    }
  }

  if (!partsCompanyId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">У вас нет доступа к разборке</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4 flex-1">
              <button
                onClick={() => navigate('/parts')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Склад запчастей</h1>
                <p className="text-sm text-gray-500 hidden sm:block">Всего: {stats.total} позиций</p>
              </div>
            </div>
            <button
              onClick={() => {
                setEditingItem(null)
                setIsModalOpen(true)
              }}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-5 h-5" />
              <span className="hidden sm:inline">Добавить</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-4 sm:mb-6">
          <button
            onClick={() => setStatusFilter('all')}
            className={`bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-all text-left ${
              statusFilter === 'all' ? 'ring-2 ring-primary' : ''
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs sm:text-sm text-gray-600">Всего</p>
              <Box className="w-4 h-4 text-gray-400" />
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-gray-900">{stats.totalQuantity}</p>
            <p className="text-xs text-gray-500 mt-1">{stats.total} наименований</p>
          </button>

          <button
            onClick={() => setStatusFilter('available')}
            className={`bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-all text-left ${
              statusFilter === 'available' ? 'ring-2 ring-green-500' : ''
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs sm:text-sm text-gray-600">В наличии</p>
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-green-600">{stats.available}</p>
          </button>

          <button
            onClick={() => setStatusFilter('reserved')}
            className={`bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-all text-left ${
              statusFilter === 'reserved' ? 'ring-2 ring-yellow-500' : ''
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs sm:text-sm text-gray-600">Зарезервировано</p>
              <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-yellow-600">{stats.reserved}</p>
          </button>

          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs sm:text-sm text-gray-600">Низкий остаток</p>
              <AlertTriangle className="w-4 h-4 text-red-500" />
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-red-600">{stats.lowStock}</p>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs sm:text-sm text-gray-600">Стоимость</p>
              <TrendingDown className="w-4 h-4 text-blue-500" />
            </div>
            <p className="text-lg sm:text-xl font-bold text-blue-600">{formatCurrency(stats.totalValue)}</p>
          </div>
        </div>

        {/* Search & View Controls */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Поиск по названию, артикулу, описанию..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            <div className="flex gap-2 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded ${viewMode === 'grid' ? 'bg-white shadow-sm' : 'text-gray-600'}`}
              >
                <Grid className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded ${viewMode === 'list' ? 'bg-white shadow-sm' : 'text-gray-600'}`}
              >
                <List className="w-5 h-5" />
              </button>
            </div>
          </div>

          {statusFilter !== 'all' && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-sm text-gray-600">
                Фильтр: <span className="font-medium">{statusLabels[statusFilter as PartsInventoryStatus]}</span>
              </span>
              <button
                onClick={() => setStatusFilter('all')}
                className="ml-2 text-sm text-primary hover:underline"
              >
                Сбросить
              </button>
            </div>
          )}
        </div>

        {/* Inventory List/Grid */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : filteredInventory.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-2">
              {searchQuery || statusFilter !== 'all' ? 'Запчасти не найдены' : 'Нет запчастей'}
            </p>
            {!searchQuery && statusFilter === 'all' && (
              <button
                onClick={() => setIsModalOpen(true)}
                className="mt-4 text-primary hover:underline"
              >
                Добавить первую запчасть
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredInventory.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-lg shadow-sm hover:shadow-md transition-all overflow-hidden group"
              >
                <div className="p-5">
                  {/* Status & Low Stock Warning */}
                  <div className="flex items-center justify-between mb-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${statusColors[item.status]}`}>
                      {statusLabels[item.status]}
                    </span>
                    {item.quantity <= 2 && item.status === 'available' && (
                      <div className="flex items-center gap-1 text-red-600">
                        <AlertTriangle className="w-4 h-4" />
                        <span className="text-xs font-medium">Мало</span>
                      </div>
                    )}
                  </div>

                  {/* Part Info */}
                  <div className="mb-4">
                    <h3 className="text-lg font-bold text-gray-900 mb-1 group-hover:text-primary transition-colors line-clamp-2">
                      {item.name}
                    </h3>
                    {item.part_number && (
                      <p className="text-sm text-gray-600">Арт: {item.part_number}</p>
                    )}
                    {item.category && (
                      <p className="text-xs text-gray-500 mt-1">{item.category.name}</p>
                    )}
                  </div>

                  {/* Details */}
                  <div className="space-y-2 text-sm mb-4">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Состояние:</span>
                      <span className="font-medium">{conditionLabels[item.condition as keyof typeof conditionLabels]}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Количество:</span>
                      <span className={`font-bold ${item.quantity <= 2 ? 'text-red-600' : 'text-gray-900'}`}>
                        {item.quantity} шт
                      </span>
                    </div>
                    {item.selling_price && (
                      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                        <span className="text-gray-600">Цена продажи:</span>
                        <span className="font-bold text-primary text-lg">{formatCurrency(item.selling_price)}</span>
                      </div>
                    )}
                  </div>

                  {item.location && (
                    <div className="text-xs text-gray-500 mb-3">
                      📍 {item.location}
                    </div>
                  )}

                  {item.description && (
                    <div className="pt-3 border-t border-gray-100">
                      <p className="text-sm text-gray-600 line-clamp-2">{item.description}</p>
                    </div>
                  )}
                </div>

                {/* Actions Footer */}
                <div className="bg-gray-50 px-4 py-3 flex gap-2">
                  <button
                    onClick={(e) => handleEdit(item, e)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Редактировать
                  </button>
                  <button
                    onClick={(e) => handleDelete(item.id, e)}
                    className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    Удалить
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Запчасть
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                      Артикул
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                      Статус
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Кол-во
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                      Цена
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Действия
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredInventory.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-4">
                        <div>
                          <div className="font-medium text-gray-900">{item.name}</div>
                          {item.category && (
                            <div className="text-xs text-gray-500">{item.category.name}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600 font-mono hidden lg:table-cell">
                        {item.part_number || '—'}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap hidden md:table-cell">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${statusColors[item.status]}`}>
                          {statusLabels[item.status]}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-bold ${item.quantity <= 2 ? 'text-red-600' : 'text-gray-900'}`}>
                            {item.quantity}
                          </span>
                          {item.quantity <= 2 && item.status === 'available' && (
                            <AlertTriangle className="w-4 h-4 text-red-600" />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-primary hidden sm:table-cell">
                        {formatCurrency(item.selling_price)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right text-sm">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={(e) => handleEdit(item, e)}
                            className="text-primary hover:text-primary/80"
                          >
                            Изменить
                          </button>
                          <button
                            onClick={(e) => handleDelete(item.id, e)}
                            className="text-red-600 hover:text-red-800"
                          >
                            Удалить
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <PartsInventoryModal
          item={editingItem}
          categories={categories}
          vehicles={vehicles}
          partsCompanyId={partsCompanyId}
          onClose={() => {
            setIsModalOpen(false)
            setEditingItem(null)
          }}
          onSave={(data) => saveMutation.mutate(data)}
        />
      )}
    </div>
  )
}

// Modal Component
interface PartsInventoryModalProps {
  item: PartsInventoryItem | null
  categories: any[]
  vehicles: any[]
  partsCompanyId: string
  onClose: () => void
  onSave: (data: CreatePartsInventoryInput) => void
}

function PartsInventoryModal({ item, categories, vehicles, partsCompanyId, onClose, onSave }: PartsInventoryModalProps) {
  const [formData, setFormData] = useState<CreatePartsInventoryInput>({
    category_id: item?.category_id || '',
    vehicle_id: item?.vehicle_id || '',
    name: item?.name || '',
    part_number: item?.part_number || '',
    description: item?.description || '',
    condition: item?.condition || 'used',
    quantity: item?.quantity || 1,
    selling_price: item?.selling_price || undefined,
    location: item?.location || '',
    shelf: item?.shelf || '',
    bin: item?.bin || '',
    notes: item?.notes || '',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />

        <div className="inline-block align-bottom bg-white rounded-t-2xl sm:rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
          <form onSubmit={handleSubmit}>
            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 max-h-[80vh] overflow-y-auto">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {item ? 'Редактировать запчасть' : 'Добавить запчасть'}
              </h3>

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Категория
                    </label>
                    <select
                      value={formData.category_id}
                      onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                      className="w-full px-3 py-2 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="">Без категории</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Автомобиль-источник
                    </label>
                    <select
                      value={formData.vehicle_id || ''}
                      onChange={(e) => setFormData({ ...formData, vehicle_id: e.target.value || undefined })}
                      className="w-full px-3 py-2 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="">Не привязано к автомобилю</option>
                      {vehicles.map((vehicle) => (
                        <option key={vehicle.id} value={vehicle.id}>
                          {vehicle.make} {vehicle.model} {vehicle.year}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-gray-500">
                      Укажите автомобиль, из которого снята эта запчасть
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Название *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Артикул
                    </label>
                    <input
                      type="text"
                      value={formData.part_number}
                      onChange={(e) => setFormData({ ...formData, part_number: e.target.value })}
                      className="w-full px-3 py-2 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Состояние *
                    </label>
                    <select
                      required
                      value={formData.condition}
                      onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
                      className="w-full px-3 py-2 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="new">Новая</option>
                      <option value="used">Б/У хорошее</option>
                      <option value="damaged">Повреждена</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Описание
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Количество</label>
                    <input
                      type="number"
                      min="1"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                      className="w-full px-3 py-2 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Цена продажи (₴) *</label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      value={formData.selling_price || ''}
                      onChange={(e) => setFormData({ ...formData, selling_price: e.target.value ? Number(e.target.value) : undefined })}
                      className="w-full px-3 py-2 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Место хранения</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-3 py-2 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Примечания</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  />
                </div>
              </div>
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
                type="submit"
                className="flex-1 sm:flex-none px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
              >
                {item ? 'Сохранить' : 'Добавить'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
