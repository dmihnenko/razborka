import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Edit, TrendingUp, TrendingDown, Plus, X, Package, Settings } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useUserProfile } from '@/hooks/useUserProfile'
import { usePartsExchangeRate } from '@/hooks/usePartsExchangeRate'
import { toast } from 'sonner'
import type { PartsVehicle, PartsVehicleStatus } from '@/types/parts'
import PartsVehicleModal from '@/components/parts/PartsVehicleModal'

const statusColors = {
  awaiting: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-blue-100 text-blue-800',
  dismantled: 'bg-green-100 text-green-800',
  disposed: 'bg-gray-100 text-gray-800'
}

const statusLabels = {
  awaiting: 'Ожидает',
  in_progress: 'В процессе',
  dismantled: 'Разобран',
  disposed: 'Утилизирован'
}

export default function PartsVehicleDetails() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isAddPartOpen, setIsAddPartOpen] = useState(false)
  const { rate: globalRate, isStale: rateIsStale } = usePartsExchangeRate()

  const { data: profile } = useUserProfile()
  const partsCompanyId = profile?.parts_company_id

  // Fetch vehicle
  const { data: vehicle, isLoading } = useQuery({
    queryKey: ['parts-vehicle', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parts_vehicles')
        .select('*')
        .eq('id', id)
        .single()
      
      if (error) throw error
      return data as PartsVehicle
    },
    enabled: !!id
  })

  // Fetch categories for add-part modal
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
    enabled: !!partsCompanyId && isAddPartOpen
  })

  // Add part mutation
  const addPartMutation = useMutation({
    mutationFn: async (data: {
      name: string
      part_number: string
      condition: string
      quantity: number
      selling_price?: number
      price_currency?: 'UAH' | 'USD'
      category_id?: string
      notes: string
    }) => {
      const { error } = await supabase
        .from('parts_inventory')
        .insert({
          ...data,
          vehicle_id: id,
          parts_company_id: partsCompanyId,
          status: 'available',
          reserved_quantity: 0,
          category_id: data.category_id || null,
          selling_price: data.selling_price || 0,
          price_currency: data.price_currency || 'UAH',
        })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicle-parts', id] })
      toast.success('Запчасть добавлена')
      setIsAddPartOpen(false)
    },
    onError: () => toast.error('Ошибка при добавлении')
  })

  // Fetch parts for this vehicle
  const { data: parts = [] } = useQuery({
    queryKey: ['vehicle-parts', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parts_inventory')
        .select('*')
        .eq('vehicle_id', id)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      return data
    },
    enabled: !!id
  })

  // Update status
  const statusMutation = useMutation({
    mutationFn: async (status: PartsVehicleStatus) => {
      const { error } = await supabase
        .from('parts_vehicles')
        .update({ status })
        .eq('id', id)
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts-vehicle', id] })
      queryClient.invalidateQueries({ queryKey: ['parts-vehicles'] })
    }
  })

  // Update vehicle
  const updateMutation = useMutation({
    mutationFn: async (updates: any) => {
      const { error } = await supabase
        .from('parts_vehicles')
        .update(updates)
        .eq('id', id)
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts-vehicle', id] })
      queryClient.invalidateQueries({ queryKey: ['parts-vehicles'] })
      setIsEditModalOpen(false)
    }
  })

  // Calculate profitability
  // Приоритет: курс авто → глобальный курс из настроек → 41
  const exchangeRate = vehicle?.exchange_rate || globalRate || 41
  const purchasePrice = vehicle?.purchase_price || 0
  const purchasePriceUSD = purchasePrice / exchangeRate
  const totalRevenue = parts.reduce((sum: number, part: any) => sum + (part.sold_price || 0), 0)
  const totalRevenueUSD = totalRevenue / exchangeRate
  const profit = totalRevenue - purchasePrice
  const profitUSD = profit / exchangeRate
  const isProfitable = profit > 0

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!vehicle) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">Автомобиль не найден</p>
        <button onClick={() => navigate('/parts/vehicles')} className="mt-4 text-primary">
          Вернуться к списку
        </button>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/parts/vehicles')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft size={20} />
          <span>Назад к списку</span>
        </button>
        
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
              {vehicle.make} {vehicle.model} {vehicle.year && `(${vehicle.year})`}
            </h1>
            {vehicle.vin && (
              <p className="text-gray-600 mt-1 text-sm md:text-base">VIN: {vehicle.vin}</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Vehicle details with status */}
          <div className="bg-white rounded-lg shadow p-4 md:p-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-6">
              <h2 className="text-lg font-semibold">Информация об автомобиле</h2>
              <button
                onClick={() => setIsEditModalOpen(true)}
                className="flex items-center justify-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Edit size={16} />
                Редактировать
              </button>
            </div>

            {/* Status buttons */}
            <div className="mb-6 pb-6 border-b border-gray-200">
              <label className="block text-sm font-medium text-gray-700 mb-3">Статус разборки:</label>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(statusLabels) as PartsVehicleStatus[]).map((status) => (
                  <button
                    key={status}
                    onClick={() => statusMutation.mutate(status)}
                    disabled={statusMutation.isPending}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      vehicle.status === status
                        ? statusColors[status]
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 active:bg-gray-300'
                    }`}
                  >
                    {statusLabels[status]}
                  </button>
                ))}
              </div>
            </div>

            {/* Vehicle info grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              {vehicle.make && vehicle.model && (
                <div>
                  <span className="text-gray-600">Марка и модель:</span>
                  <span className="ml-2 font-medium">{vehicle.make} {vehicle.model}</span>
                </div>
              )}
              {vehicle.year && (
                <div>
                  <span className="text-gray-600">Год выпуска:</span>
                  <span className="ml-2 font-medium">{vehicle.year}</span>
                </div>
              )}
              {vehicle.vin && (
                <div className="sm:col-span-2">
                  <span className="text-gray-600">VIN:</span>
                  <span className="ml-2 font-medium break-all">{vehicle.vin}</span>
                </div>
              )}
              {vehicle.color && (
                <div>
                  <span className="text-gray-600">Цвет:</span>
                  <span className="ml-2 font-medium">{vehicle.color}</span>
                </div>
              )}
              {vehicle.mileage && (
                <div>
                  <span className="text-gray-600">Пробег:</span>
                  <span className="ml-2 font-medium">{vehicle.mileage.toLocaleString()} км</span>
                </div>
              )}
              {vehicle.license_plate && (
                <div>
                  <span className="text-gray-600">Гос. номер:</span>
                  <span className="ml-2 font-medium">{vehicle.license_plate}</span>
                </div>
              )}
              {vehicle.purchase_price && (
                <div>
                  <span className="text-gray-600">Цена покупки:</span>
                  <span className="ml-2 font-medium">${purchasePriceUSD.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                </div>
              )}
              {vehicle.purchase_date && (
                <div>
                  <span className="text-gray-600">Дата покупки:</span>
                  <span className="ml-2 font-medium">
                    {new Date(vehicle.purchase_date).toLocaleDateString('ru-RU')}
                  </span>
                </div>
              )}
            </div>
            {vehicle.notes && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <span className="text-gray-600 text-sm font-medium">Примечания:</span>
                <p className="mt-2 text-gray-900">{vehicle.notes}</p>
              </div>
            )}
          </div>

          {/* Parts list */}
          <div className="bg-white rounded-lg shadow p-4 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Запчасти ({parts.length})</h2>
              <button
                onClick={() => setIsAddPartOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm"
              >
                <Plus size={16} />
                Добавить
              </button>
            </div>
            {parts.length === 0 ? (
              <p className="text-gray-500 text-center py-8">Запчастей пока нет</p>
            ) : (
              <div className="space-y-3">
                {parts.map((part: any) => (
                  <div
                    key={part.id}
                    className="border border-gray-200 rounded-lg p-3 hover:shadow-sm transition-shadow"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-medium">{part.name}</h3>
                        {part.part_number && (
                          <p className="text-sm text-gray-600">№ {part.part_number}</p>
                        )}
                      </div>
                      <div className="text-right">
                        {part.status === 'sold' ? (
                          <div className="text-green-600 font-medium">
                            {part.sold_price} ₴
                          </div>
                        ) : (
                          <div className="text-gray-600">
                            {part.price} ₴
                          </div>
                        )}
                        <div className={`text-xs ${
                          part.status === 'available' ? 'text-green-600' :
                          part.status === 'sold' ? 'text-gray-500' :
                          'text-yellow-600'
                        }`}>
                          {part.status === 'available' ? 'В наличии' :
                           part.status === 'sold' ? 'Продано' : 'Зарезервировано'}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar - Profitability */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-4 md:p-6">
            <h2 className="text-lg font-semibold mb-4">Окупаемость</h2>
            
            {/* Предупреждение о курсе */}
            {!vehicle?.exchange_rate && rateIsStale && (
              <div className="mb-3 flex items-center justify-between text-xs bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
                <span className="text-yellow-700">Курс не обновлён сегодня</span>
                <button
                  onClick={() => navigate('/parts/settings')}
                  className="flex items-center gap-1 text-yellow-700 font-medium hover:underline"
                >
                  <Settings size={12} />
                  Обновить
                </button>
              </div>
            )}
            
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Цена покупки:</span>
                <div className="text-right">
                  <div className="font-semibold text-red-600">
                    ${purchasePriceUSD.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </div>
                  {purchasePrice > 0 && (
                    <div className="text-xs text-gray-500">
                      {purchasePrice.toLocaleString()} ₴ (курс {exchangeRate})
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Доход от продаж:</span>
                <div className="text-right">
                  <div className="font-semibold text-green-600">
                    ${totalRevenueUSD.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </div>
                  {totalRevenue > 0 && (
                    <div className="text-xs text-gray-500">
                      {totalRevenue.toLocaleString()} ₴
                    </div>
                  )}
                </div>
              </div>
              
              <div className="pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Итого:</span>
                  <div className="flex items-center gap-2">
                    {isProfitable ? (
                      <TrendingUp className="text-green-600" size={20} />
                    ) : (
                      <TrendingDown className="text-red-600" size={20} />
                    )}
                    <div className="text-right">
                      <div className={`text-xl font-bold ${
                        isProfitable ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {profitUSD > 0 ? '+' : ''}${profitUSD.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </div>
                      <div className={`text-sm font-medium ${
                        isProfitable ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {profit > 0 ? '+' : ''}{profit.toLocaleString()} ₴
                      </div>
                    </div>
                  </div>
                </div>
                
                {purchasePrice > 0 && (
                  <div className="text-sm text-gray-600 text-right">
                    {((totalRevenue / purchasePrice) * 100).toFixed(1)}% окупаемости
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick stats */}
          <div className="bg-white rounded-lg shadow p-4 md:p-6">
            <h2 className="text-lg font-semibold mb-4">Статистика</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Всего запчастей:</span>
                <span className="font-medium">{parts.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Продано:</span>
                <span className="font-medium text-green-600">
                  {parts.filter((p: any) => p.status === 'sold').length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">В наличии:</span>
                <span className="font-medium text-blue-600">
                  {parts.filter((p: any) => p.status === 'available').length}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <PartsVehicleModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSubmit={async (data) => {
          await updateMutation.mutateAsync(data)
        }}
        vehicle={vehicle}
      />

      {/* Add Part Modal */}
      {isAddPartOpen && (
        <AddPartModal
          vehicleName={`${vehicle.make} ${vehicle.model}${vehicle.year ? ` (${vehicle.year})` : ''}`}
          categories={categories}
          onClose={() => setIsAddPartOpen(false)}
          onSave={(data) => addPartMutation.mutate(data)}
          loading={addPartMutation.isPending}
        />
      )}
    </div>
  )
}

interface AddPartModalProps {
  vehicleName: string
  categories: { id: string; name: string }[]
  onClose: () => void
  onSave: (data: {
    name: string
    part_number: string
    condition: string
    quantity: number
    selling_price?: number
    price_currency?: 'UAH' | 'USD'
    category_id?: string
    notes: string
  }) => void
  loading: boolean
}

function AddPartModal({ vehicleName, categories, onClose, onSave, loading }: AddPartModalProps) {
  const [form, setForm] = useState({
    name: '',
    part_number: '',
    condition: 'used',
    quantity: 1,
    selling_price: '' as string | number,
    price_currency: 'UAH' as 'UAH' | 'USD',
    category_id: '',
    notes: '',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      name: form.name,
      part_number: form.part_number,
      condition: form.condition,
      quantity: form.quantity,
      selling_price: form.selling_price ? Number(form.selling_price) : undefined,
      price_currency: form.price_currency,
      category_id: form.category_id || undefined,
      notes: form.notes,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-xl w-full sm:max-w-lg max-h-[95vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">Добавить запчасть</h2>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">{vehicleName}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Название */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Название *</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-base"
              placeholder="Например: Головка блока"
            />
          </div>

          {/* Категория + Артикул */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Категория</label>
              <select
                value={form.category_id}
                onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary text-base"
              >
                <option value="">Без категории</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Артикул</label>
              <input
                type="text"
                value={form.part_number}
                onChange={e => setForm(f => ({ ...f, part_number: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary text-base"
                placeholder="OEM…"
              />
            </div>
          </div>

          {/* Состояние + Количество */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Состояние *</label>
              <select
                value={form.condition}
                onChange={e => setForm(f => ({ ...f, condition: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary text-base"
              >
                <option value="new">Новая</option>
                <option value="used">Б/У хорошее</option>
                <option value="damaged">Повреждена</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Количество</label>
              <input
                type="number"
                min={1}
                value={form.quantity}
                onChange={e => setForm(f => ({ ...f, quantity: Number(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary text-base"
              />
            </div>
          </div>

          {/* Цена */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Цена</label>
            <div className="flex gap-2">
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.selling_price}
                onChange={e => setForm(f => ({ ...f, selling_price: e.target.value }))}
                className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary text-base"
                placeholder="0"
              />
              <div className="flex gap-1 flex-shrink-0">
                {(['UAH', 'USD'] as const).map(c => (
                  <button
                    type="button"
                    key={c}
                    onClick={() => setForm(f => ({ ...f, price_currency: c }))}
                    className={`px-2.5 py-2 rounded-lg text-sm font-semibold transition-colors ${
                      form.price_currency === c
                        ? 'bg-primary text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {c === 'UAH' ? '₴' : '$'}
                  </button>
                ))}
              </div>
            </div>
            <p className="mt-1 text-xs text-gray-500">Прайс-цена. При продаже можно указать фактическую цену</p>
          </div>

          {/* Примечания */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Примечания</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary text-base resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 font-medium"
            >
              {loading ? 'Добавление...' : 'Добавить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
