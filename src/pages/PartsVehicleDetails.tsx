import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Edit, DollarSign, TrendingUp, TrendingDown } from 'lucide-react'
import { supabase } from '@/lib/supabase'
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
  const purchasePrice = vehicle?.purchase_price || 0
  const totalRevenue = parts.reduce((sum, part) => sum + (part.sold_price || 0), 0)
  const profit = totalRevenue - purchasePrice
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
                  <span className="ml-2 font-medium">{vehicle.purchase_price.toLocaleString()} ₴</span>
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
            <h2 className="text-lg font-semibold mb-4">Запчасти ({parts.length})</h2>
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
            
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Цена покупки:</span>
                <span className="font-semibold text-red-600">
                  {purchasePrice.toLocaleString()} ₴
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Доход от продаж:</span>
                <span className="font-semibold text-green-600">
                  {totalRevenue.toLocaleString()} ₴
                </span>
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
                    <span className={`text-xl font-bold ${
                      isProfitable ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {profit > 0 ? '+' : ''}{profit.toLocaleString()} ₴
                    </span>
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
    </div>
  )
}
