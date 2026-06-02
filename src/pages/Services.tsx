import { useState, useMemo } from 'react'
import { Spinner } from '@/components/ui/Spinner'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Search, X } from 'lucide-react'
import { useBlockScroll } from '@/hooks/useBlockScroll'
import { useConfirm } from '@/hooks/useConfirm'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { useUserProfile } from '@/hooks/useUserProfile'
import { moveToTrash } from '@/services/trashService'
import {
  fetchServices,
  fetchServiceCategories,
  fetchServiceRaw,
  deleteService,
  createService,
  updateService,
} from '@/services/servicesService'

export default function Services() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingService, setEditingService] = useState<any>(null)
  const [categoryFilter, setCategoryFilter] = useState('')
  const [categorySearch, setCategorySearch] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false)
  const queryClient = useQueryClient()
  const { confirm: showConfirm, dialogProps } = useConfirm()
  const { data: profile } = useUserProfile()

  const stoCompanyId = profile?.sto_company_id

  const { data: services, isLoading } = useQuery({
    queryKey: ['services', stoCompanyId],
    queryFn: () => fetchServices(stoCompanyId!),
    enabled: !!stoCompanyId,
  })

  const { data: categories } = useQuery({
    queryKey: ['service-categories', stoCompanyId],
    queryFn: () => fetchServiceCategories(stoCompanyId!),
    enabled: !!stoCompanyId,
  })

  // Фильтрация услуг
  const filteredServices = useMemo(() => {
    if (!services) return []
    
    return services.filter((service) => {
      const matchesSearch = !searchQuery || 
        service.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        service.description?.toLowerCase().includes(searchQuery.toLowerCase())
      
      const matchesCategory = !categoryFilter || service.category_id === categoryFilter
      
      return matchesSearch && matchesCategory
    })
  }, [services, searchQuery, categoryFilter])

  // Фильтрация категорий для выпадающего списка
  const filteredCategories = useMemo(() => {
    if (!categories) return []
    if (!categorySearch) return categories
    
    return categories.filter((cat: any) =>
      cat.name?.toLowerCase().includes(categorySearch.toLowerCase())
    )
  }, [categories, categorySearch])

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const service = await fetchServiceRaw(id)
      if (service) {
        await moveToTrash({
          entityType: 'service',
          entityId: id,
          entityLabel: service.name || 'Услуга',
          entityData: service,
          stoCompanyId: profile?.sto_company_id,
        })
      }
      await deleteService(id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] })
      toast.success('Услуга удалена')
    },
  })

  const selectedCategory = categories?.find((cat: any) => cat.id === categoryFilter)

  return (
    <div className="container-mobile">
      <div className="flex items-center justify-between mb-4 sm:mb-6 gap-3">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Услуги</h1>
        <button
          onClick={() => {
            setEditingService(null)
            setIsModalOpen(true)
          }}
          className="btn-touch-sm bg-primary text-white hover:bg-primary/90 flex items-center gap-1.5 whitespace-nowrap flex-shrink-0"
        >
          <Plus className="w-4 h-4 flex-shrink-0" />
          <span className="hidden sm:inline">Добавить</span>
          <span className="sm:hidden">Услуга</span>
        </button>
      </div>

      {/* Фильтры */}
      <div className="bg-white rounded-lg shadow p-3 sm:p-4 mb-4 sm:mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          {/* Поиск по названию */}
          <div className="relative">
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Поиск по названию</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Введите название услуги..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-10 py-2 w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>

          {/* Фильтр по категории */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">Категория</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Выберите категорию..."
                value={selectedCategory ? selectedCategory.name : categorySearch}
                onChange={(e) => {
                  setCategorySearch(e.target.value)
                  if (!e.target.value) {
                    setCategoryFilter('')
                  }
                  setShowCategoryDropdown(true)
                }}
                onFocus={() => setShowCategoryDropdown(true)}
                className="pl-3 pr-10 py-2 w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {(categoryFilter || categorySearch) && (
                <button
                  onClick={() => {
                    setCategoryFilter('')
                    setCategorySearch('')
                    setShowCategoryDropdown(false)
                  }}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
              
              {showCategoryDropdown && filteredCategories.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                  {filteredCategories.map((cat: any) => (
                    <div
                      key={cat.id}
                      onClick={() => {
                        setCategoryFilter(cat.id)
                        setCategorySearch('')
                        setShowCategoryDropdown(false)
                      }}
                      className="px-3 py-2 cursor-pointer hover:bg-gray-100 flex items-center gap-2"
                    >
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span>{cat.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Активные фильтры */}
        {(categoryFilter || searchQuery) && (
          <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
            <span>Активные фильтры:</span>
            {categoryFilter && selectedCategory && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded">
                {selectedCategory.name}
                <button
                  onClick={() => {
                    setCategoryFilter('')
                    setCategorySearch('')
                  }}
                  className="hover:text-gray-800"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {searchQuery && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded">
                Поиск: "{searchQuery}"
                <button
                  onClick={() => setSearchQuery('')}
                  className="hover:text-gray-800"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            <button
              onClick={() => {
                setCategoryFilter('')
                setCategorySearch('')
                setSearchQuery('')
              }}
              className="text-primary hover:text-primary/80 ml-2"
            >
              Очистить все
            </button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center">
          <Spinner size="lg" />
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Название услуги
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Категория
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Описание
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Цена
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Длительность
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredServices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    {searchQuery || categoryFilter ? 'Услуги не найдены' : 'Нет услуг'}
                  </td>
                </tr>
              ) : (
                filteredServices.map((service) => (
                  <tr key={service.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{service.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {service.service_categories ? (
                        <span
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white"
                          style={{ backgroundColor: service.service_categories.color }}
                        >
                          {service.service_categories.name}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-600 max-w-xs truncate">
                        {service.description || '—'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-primary">
                        {service.price.toLocaleString('ru-RU')} ₴
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600">
                        {service.duration_minutes ? `${service.duration_minutes} мин` : '—'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => {
                          setEditingService(service)
                          setIsModalOpen(true)
                        }}
                        className="text-primary hover:text-primary/80 mr-3"
                      >
                        <Pencil className="w-4 h-4 inline" />
                      </button>
                      <button
                        onClick={async () => {
                          const ok = await showConfirm({ message: 'Удалить эту услугу?', danger: true })
                          if (!ok) return
                          deleteMutation.mutate(service.id)
                        }}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="w-4 h-4 inline" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {isModalOpen && (
        <ServiceModal
          service={editingService}
          onClose={() => setIsModalOpen(false)}
        />
      )}
      <ConfirmDialog {...dialogProps} />
    </div>
  )
}

function ServiceModal({ service, onClose }: { service: any; onClose: () => void }) {
  const [formData, setFormData] = useState({
    name: service?.name || '',
    description: service?.description || '',
    price: service?.price || '',
    duration_minutes: service?.duration_minutes || '',
    category_id: service?.category_id || '',
  })
  const [categorySearch, setCategorySearch] = useState('')
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false)

  useBlockScroll(true)

  const queryClient = useQueryClient()
  const { data: profile } = useUserProfile()
  const stoCompanyId = profile?.sto_company_id

  const { data: categories } = useQuery({
    queryKey: ['service-categories', stoCompanyId],
    queryFn: () => fetchServiceCategories(stoCompanyId!),
    enabled: !!stoCompanyId,
  })

  const filteredCategories = useMemo(() => {
    if (!categories) return []
    if (!categorySearch) return categories
    
    return categories.filter((cat: any) =>
      cat.name?.toLowerCase().includes(categorySearch.toLowerCase())
    )
  }, [categories, categorySearch])

  const selectedCategory = categories?.find((cat: any) => cat.id === formData.category_id)

  const mutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const serviceData = {
        name: data.name,
        description: data.description || null,
        price: Number(data.price),
        duration_minutes: data.duration_minutes ? Number(data.duration_minutes) : null,
        category_id: data.category_id || null,
      }

      if (service) {
        await updateService(service.id, serviceData)
      } else {
        if (!stoCompanyId) throw new Error('sto_company_id not found')
        await createService({ ...serviceData, sto_company_id: stoCompanyId })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] })
      toast.success(service ? 'Услуга обновлена' : 'Услуга добавлена')
      onClose()
    },
    onError: () => {
      toast.error('Ошибка при сохранении')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    mutation.mutate(formData)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">
          {service ? 'Редактировать услугу' : 'Добавить услугу'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Название *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700">Категория</label>
            <input
              type="text"
              placeholder="Выберите категорию..."
              value={selectedCategory ? selectedCategory.name : categorySearch}
              onChange={(e) => {
                setCategorySearch(e.target.value)
                if (!e.target.value) {
                  setFormData({ ...formData, category_id: '' })
                }
                setShowCategoryDropdown(true)
              }}
              onFocus={() => setShowCategoryDropdown(true)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {(formData.category_id || categorySearch) && (
              <button
                type="button"
                onClick={() => {
                  setFormData({ ...formData, category_id: '' })
                  setCategorySearch('')
                  setShowCategoryDropdown(false)
                }}
                className="absolute right-3 top-9 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            
            {showCategoryDropdown && filteredCategories.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-auto">
                {filteredCategories.map((cat: any) => (
                  <div
                    key={cat.id}
                    onClick={() => {
                      setFormData({ ...formData, category_id: cat.id })
                      setCategorySearch('')
                      setShowCategoryDropdown(false)
                    }}
                    className="px-3 py-2 cursor-pointer hover:bg-gray-100 flex items-center gap-2"
                  >
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span>{cat.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">Описание</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">Цена (₴) *</label>
            <input
              type="number"
              required
              min="0"
              step="0.01"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">Длительность (минут)</label>
            <input
              type="number"
              min="0"
              value={formData.duration_minutes}
              onChange={(e) => setFormData({ ...formData, duration_minutes: e.target.value })}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          
          <div className="flex justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50"
            >
              {mutation.isPending ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
