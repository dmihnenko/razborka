import { useState } from 'react'
import { Plus, Search, Car, Calendar, DollarSign, Trash2, Edit } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useUserProfile } from '@/hooks/useUserProfile'
import { getPartsVehicles, createPartsVehicle, updatePartsVehicle, updateVehicleStatus, deletePartsVehicle } from '@/services/partsService'
import PartsVehicleModal from '@/components/parts/PartsVehicleModal'
import type { PartsVehicle, CreatePartsVehicleInput, PartsVehicleStatus } from '@/types/parts'

const statusLabels: Record<PartsVehicleStatus, string> = {
  awaiting: 'Ожидает разборки',
  in_progress: 'В процессе',
  dismantled: 'Разобран',
  disposed: 'Утилизирован'
}

const statusColors: Record<PartsVehicleStatus, string> = {
  awaiting: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-blue-100 text-blue-800',
  dismantled: 'bg-green-100 text-green-800',
  disposed: 'bg-gray-100 text-gray-800'
}

export default function PartsVehicles() {
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedVehicle, setSelectedVehicle] = useState<PartsVehicle | null>(null)
  
  const queryClient = useQueryClient()
  const { data: profile } = useUserProfile()
  const partsCompanyId = profile?.parts_company_id

  // Fetch vehicles
  const { data: vehicles = [], isLoading } = useQuery({
    queryKey: ['parts-vehicles', partsCompanyId],
    queryFn: () => getPartsVehicles(partsCompanyId!),
    enabled: !!partsCompanyId
  })

  // Create/Update vehicle
  const saveMutation = useMutation({
    mutationFn: async (data: CreatePartsVehicleInput) => {
      if (selectedVehicle) {
        return updatePartsVehicle(selectedVehicle.id, data)
      } else {
        return createPartsVehicle(data, partsCompanyId!)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts-vehicles'] })
      toast.success(selectedVehicle ? 'Автомобиль обновлён' : 'Автомобиль добавлен')
      setIsModalOpen(false)
      setSelectedVehicle(null)
    },
    onError: (error) => {
      toast.error('Ошибка при сохранении')
      console.error(error)
    }
  })

  // Update status
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: PartsVehicleStatus }) => 
      updateVehicleStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts-vehicles'] })
      toast.success('Статус обновлён')
    },
    onError: () => {
      toast.error('Ошибка при обновлении статуса')
    }
  })

  // Delete vehicle
  const deleteMutation = useMutation({
    mutationFn: deletePartsVehicle,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts-vehicles'] })
      toast.success('Автомобиль удалён')
    },
    onError: () => {
      toast.error('Ошибка при удалении')
    }
  })

  // Filter vehicles
  const filteredVehicles = vehicles.filter(vehicle => {
    const matchesSearch = searchQuery === '' || 
      vehicle.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vehicle.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vehicle.vin?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vehicle.license_plate?.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || vehicle.status === statusFilter
    
    return matchesSearch && matchesStatus
  })

  const handleDelete = (vehicle: PartsVehicle) => {
    if (confirm(`Удалить ${vehicle.brand} ${vehicle.model}?`)) {
      deleteMutation.mutate(vehicle.id)
    }
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Автомобили на разборке</h1>
          <p className="text-gray-600 mt-2">Управление автомобилями для разборки</p>
        </div>
        <button 
          onClick={() => {
            setSelectedVehicle(null)
            setIsModalOpen(true)
          }}
          className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90 flex items-center gap-2"
        >
          <Plus size={20} />
          Добавить авто
        </button>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Поиск по VIN, марке, модели..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="all">Все статусы</option>
              <option value="awaiting">Ожидает разборки</option>
              <option value="in_progress">В процессе</option>
              <option value="dismantled">Разобран</option>
              <option value="disposed">Утилизирован</option>
            </select>
          </div>
        </div>

        <div className="p-6">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            </div>
          ) : filteredVehicles.length === 0 ? (
            <div className="text-center text-gray-500 py-12">
              <Car className="mx-auto mb-4 text-gray-400" size={48} />
              <p className="text-lg">Нет автомобилей</p>
              <p className="text-sm mt-2">Добавьте первый автомобиль для разборки</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredVehicles.map((vehicle) => (
                <div key={vehicle.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold">
                          {vehicle.brand} {vehicle.model} {vehicle.year && `(${vehicle.year})`}
                        </h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[vehicle.status]}`}>
                          {statusLabels[vehicle.status]}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                        {vehicle.vin && (
                          <div>
                            <span className="font-medium">VIN:</span> {vehicle.vin}
                          </div>
                        )}
                        {vehicle.license_plate && (
                          <div>
                            <span className="font-medium">Номер:</span> {vehicle.license_plate}
                          </div>
                        )}
                        {vehicle.purchase_price && (
                          <div className="flex items-center gap-1">
                            <DollarSign size={14} />
                            <span>{vehicle.purchase_price} ₴</span>
                          </div>
                        )}
                        {vehicle.purchase_date && (
                          <div className="flex items-center gap-1">
                            <Calendar size={14} />
                            <span>{new Date(vehicle.purchase_date).toLocaleDateString('ru-RU')}</span>
                          </div>
                        )}
                      </div>

                      {vehicle.notes && (
                        <p className="mt-2 text-sm text-gray-500">{vehicle.notes}</p>
                      )}
                    </div>

                    <div className="flex gap-2 ml-4">
                      {/* Status dropdown */}
                      <select
                        value={vehicle.status}
                        onChange={(e) => statusMutation.mutate({ 
                          id: vehicle.id, 
                          status: e.target.value as PartsVehicleStatus 
                        })}
                        className="px-3 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                      >
                        <option value="awaiting">Ожидает</option>
                        <option value="in_progress">В процессе</option>
                        <option value="dismantled">Разобран</option>
                        <option value="disposed">Утилизирован</option>
                      </select>

                      <button
                        onClick={() => {
                          setSelectedVehicle(vehicle)
                          setIsModalOpen(true)
                        }}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                        title="Редактировать"
                      >
                        <Edit size={18} />
                      </button>

                      <button
                        onClick={() => handleDelete(vehicle)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded"
                        title="Удалить"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <PartsVehicleModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setSelectedVehicle(null)
        }}
        onSubmit={async (data) => {
          await saveMutation.mutateAsync(data)
        }}
        vehicle={selectedVehicle}
      />
    </div>
  )
}
