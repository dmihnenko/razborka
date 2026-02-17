import { useState } from 'react'
import { Plus, Search, Package, Edit, Trash2, AlertTriangle } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useUserProfile } from '@/hooks/useUserProfile'
import { getPartsInventory, createPartsInventoryItem, updatePartsInventoryItem, deletePartsInventoryItem } from '@/services/partsService'
import type { PartsInventoryItem, CreatePartsInventoryInput } from '@/types/parts'

export default function PartsInventory() {
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<PartsInventoryItem | null>(null)
  
  const { data: profile } = useUserProfile()
  const queryClient = useQueryClient()

  const { data: inventory = [], isLoading } = useQuery({
    queryKey: ['parts-inventory', profile?.parts_company_id],
    queryFn: () => getPartsInventory(profile!.parts_company_id!),
    enabled: !!profile?.parts_company_id
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

  const handleDelete = (id: string) => {
    if (confirm('Удалить эту запчасть?')) {
      deleteMutation.mutate(id)
    }
  }

  const filteredInventory = inventory.filter((item: PartsInventoryItem) => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         item.part_number?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = categoryFilter === 'all' || item.category_id === categoryFilter
    return matchesSearch && matchesCategory
  })

  const totalItems = inventory.reduce((sum: number, item: PartsInventoryItem) => sum + item.quantity, 0)
  const availableItems = inventory.filter((i: PartsInventoryItem) => i.status === 'available').reduce((sum: number, item: PartsInventoryItem) => sum + item.quantity, 0)
  const reservedItems = inventory.filter((i: PartsInventoryItem) => i.status === 'reserved').reduce((sum: number, item: PartsInventoryItem) => sum + item.reserved_quantity, 0)
  const soldItems = inventory.filter((i: PartsInventoryItem) => i.status === 'sold').length

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Склад запчастей</h1>
          <p className="text-gray-600 mt-1 sm:mt-2 text-sm sm:text-base">Управление складом и запасами</p>
        </div>
        <button 
          onClick={() => {
            setEditingItem(null)
            setIsModalOpen(true)
          }}
          className="w-full sm:w-auto bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90 flex items-center justify-center gap-2 text-sm sm:text-base"
        >
          <Plus size={20} />
          Добавить запчасть
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 mb-6 sm:mb-8">
        <div className="bg-white rounded-lg shadow p-3 sm:p-4 lg:p-6">
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="bg-blue-100 p-2 sm:p-3 rounded-full">
              <Package className="text-blue-600" size={20} />
            </div>
            <div>
              <p className="text-[10px] sm:text-xs lg:text-sm text-gray-600">Всего позиций</p>
              <p className="text-lg sm:text-xl lg:text-2xl font-bold">{totalItems}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-3 sm:p-4 lg:p-6">
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="bg-green-100 p-2 sm:p-3 rounded-full">
              <Package className="text-green-600" size={20} />
            </div>
            <div>
              <p className="text-[10px] sm:text-xs lg:text-sm text-gray-600">В наличии</p>
              <p className="text-lg sm:text-xl lg:text-2xl font-bold">{availableItems}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-3 sm:p-4 lg:p-6">
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="bg-yellow-100 p-2 sm:p-3 rounded-full">
              <Package className="text-yellow-600" size={20} />
            </div>
            <div>
              <p className="text-[10px] sm:text-xs lg:text-sm text-gray-600">Зарезервировано</p>
              <p className="text-lg sm:text-xl lg:text-2xl font-bold">{reservedItems}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-3 sm:p-4 lg:p-6">
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="bg-red-100 p-2 sm:p-3 rounded-full">
              <Package className="text-red-600" size={20} />
            </div>
            <div>
              <p className="text-[10px] sm:text-xs lg:text-sm text-gray-600">Продано</p>
              <p className="text-lg sm:text-xl lg:text-2xl font-bold">{soldItems}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-3 sm:p-4 lg:p-6 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Поиск по названию, коду..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 sm:px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="all">Все категории</option>
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : filteredInventory.length === 0 ? (
          <div className="p-6">
            <div className="text-center text-gray-500 py-12">
              <Package className="mx-auto mb-4 text-gray-400" size={48} />
              <p className="text-lg">Склад пуст</p>
              <p className="text-sm mt-2">Добавьте запчасти со склада или из разборки автомобилей</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Название
                  </th>
                  <th className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Артикул
                  </th>
                  <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Количество
                  </th>
                  <th className="hidden lg:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Состояние
                  </th>
                  <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Цена
                  </th>
                  <th className="px-3 sm:px-6 py-2 sm:py-3 text-right text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredInventory.map((item: PartsInventoryItem) => {
                  const isLowStock = item.quantity <= 1
                  return (
                    <tr key={item.id} className={isLowStock ? 'bg-yellow-50' : ''}>
                      <td className="px-3 sm:px-6 py-2 sm:py-4">
                        <div className="flex items-center">
                          {isLowStock && (
                            <AlertTriangle className="w-4 h-4 text-yellow-500 mr-2 flex-shrink-0" />
                          )}
                          <div className="min-w-0">
                            <div className="text-xs sm:text-sm font-medium text-gray-900 truncate">{item.name}</div>
                            {item.category && (
                              <div className="text-[10px] sm:text-xs text-gray-500 truncate">{item.category.name}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {item.part_number || '-'}
                      </td>
                      <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap">
                        <div className="text-xs sm:text-sm text-gray-900">{item.quantity} шт</div>
                        {item.reserved_quantity > 0 && (
                          <div className="text-[10px] sm:text-xs text-yellow-600">рез: {item.reserved_quantity}</div>
                        )}
                      </td>
                      <td className="hidden lg:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {item.condition}
                      </td>
                      <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900">
                        {item.selling_price ? `${item.selling_price.toLocaleString('ru-RU')} ₴` : '-'}
                      </td>
                      <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-1 sm:gap-2">
                          <button
                            onClick={() => {
                              setEditingItem(item)
                              setIsModalOpen(true)
                            }}
                            className="text-primary hover:text-primary/80 p-1"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="text-red-600 hover:text-red-800 p-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen && (
        <PartsInventoryModal
          item={editingItem}
          partsCompanyId={profile?.parts_company_id!}
          onClose={() => {
            setIsModalOpen(false)
            setEditingItem(null)
          }}
        />
      )}
    </div>
  )
}

interface ModalProps {
  item: PartsInventoryItem | null
  partsCompanyId: string
  onClose: () => void
}

function PartsInventoryModal({ item, partsCompanyId, onClose }: ModalProps) {
  const [formData, setFormData] = useState<CreatePartsInventoryInput>({
    category_id: item?.category_id || '',
    name: item?.name || '',
    part_number: item?.part_number || '',
    description: item?.description || '',
    condition: item?.condition || 'used',
    quantity: item?.quantity || 1,
    purchase_price: item?.purchase_price || undefined,
    selling_price: item?.selling_price || undefined,
    location: item?.location || '',
    notes: item?.notes || ''
  })

  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async (data: CreatePartsInventoryInput) => {
      if (item) {
        return updatePartsInventoryItem(item.id, data)
      } else {
        return createPartsInventoryItem(data, partsCompanyId)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts-inventory'] })
      toast.success(item ? 'Запчасть обновлена' : 'Запчасть добавлена')
      onClose()
    },
    onError: () => {
      toast.error('Ошибка при сохранении')
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    mutation.mutate(formData)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[95vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
          <h2 className="text-lg sm:text-xl font-bold">
            {item ? 'Редактировать запчасть' : 'Добавить запчасть'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Название *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Название запчасти"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Артикул</label>
              <input
                type="text"
                value={formData.part_number}
                onChange={(e) => setFormData({ ...formData, part_number: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Состояние *</label>
              <select
                required
                value={formData.condition}
                onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="new">Новая</option>
                <option value="used">Б/У</option>
                <option value="refurbished">Восстановленная</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Описание</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Количество *</label>
              <input
                type="number"
                required
                min="0"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Цена покупки (₴)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.purchase_price || ''}
                onChange={(e) => setFormData({ ...formData, purchase_price: e.target.value ? Number(e.target.value) : undefined })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Цена продажи (₴)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.selling_price || ''}
                onChange={(e) => setFormData({ ...formData, selling_price: e.target.value ? Number(e.target.value) : undefined })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Место хранения</label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Полка, ячейка..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Примечания</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 text-sm font-medium"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50 text-sm font-medium"
            >
              {mutation.isPending ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

