import { useState } from 'react'
import { Spinner } from '@/components/ui/Spinner'
import { Plus, Search, Car, Filter, Grid, List } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useUserProfile } from '@/hooks/useUserProfile'
import { PartsAccessDenied } from '@/components/parts/PartsAccessDenied'
import { usePartsExchangeRate } from '@/hooks/usePartsExchangeRate'
import { getPartsVehicles, createPartsVehicle, updatePartsVehicle, deletePartsVehicle, getPartsCategoryTemplates, getPartsInventoryByVehicle } from '@/services/partsService'
import { moveToTrash } from '@/services/trashService'
import PartsPageHeader from '@/components/parts/PartsPageHeader'
import PartsVehicleModal from '@/components/parts/PartsVehicleModal'
import { useConfirm } from '@/hooks/useConfirm'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import type { PartsVehicle, CreatePartsVehicleInput, PartsVehicleStatus } from '@/types/parts'

const statusLabels: Record<PartsVehicleStatus, string> = {
  awaiting: 'Ожидает разборки',
  in_progress: 'В процессе',
  dismantled: 'Разобран',
}

const statusColors: Record<PartsVehicleStatus, string> = {
  awaiting: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  in_progress: 'bg-blue-100 text-blue-800 border-blue-200',
  dismantled: 'bg-green-100 text-green-800 border-green-200',
}

type ViewMode = 'grid' | 'list'

export default function PartsVehicles() {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const { rate: globalRate } = usePartsExchangeRate()

  const formatPriceUSD = (vehicle: PartsVehicle) => {
    if (!vehicle.purchase_price) return '—'
    const rate = vehicle.exchange_rate || globalRate || 41
    const usd = vehicle.purchase_price / rate
    return '$' + usd.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  }
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedVehicle, setSelectedVehicle] = useState<PartsVehicle | null>(null)
  
  const queryClient = useQueryClient()
  const { confirm: showConfirm, dialogProps } = useConfirm()
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
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['parts-vehicles'] })
      toast.success(selectedVehicle ? 'Автомобиль обновлён' : 'Автомобиль добавлен')
      setIsModalOpen(false)
      // Check for brand templates when creating new vehicle
      if (!selectedVehicle && data?.make) {
        const make = data.make
        getPartsCategoryTemplates(make).then(templates => {
          if (templates.length > 0) {
            toast(`${templates.length} стандартных категорий для ${make}`, {
              description: 'Импортируйте или создайте свои — удобнее сортировать запчасти',
              action: {
                label: 'Открыть',
                onClick: () => navigate(`/parts/categories?tab=templates&brand=${encodeURIComponent(make)}`),
              },
              duration: 9000,
            })
          }
        }).catch(() => {})
      }
      setSelectedVehicle(null)
    },
    onError: (error: any) => {
      const msg = error?.message || error?.details || 'Ошибка при сохранении'
      toast.error(msg)
      console.error(error)
    }
  })

  // Delete vehicle
  const deleteMutation = useMutation({
    mutationFn: async (vehicleId: string) => {
      const vehicle = await import('@/services/partsService').then(m => m.getPartsVehicle(vehicleId).catch(() => null))
      const parts = await getPartsInventoryByVehicle(vehicleId)
      if (vehicle) {
        await moveToTrash({
          entityType: 'parts_vehicle',
          entityId: vehicleId,
          entityLabel: `${vehicle.make || ''} ${vehicle.model || ''}`.trim() || 'Авто',
          entityData: { vehicle, parts: parts || [] },
          partsCompanyId,
        })
      }
      await deletePartsVehicle(vehicleId)
    },
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
      vehicle.make.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vehicle.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vehicle.vin?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vehicle.license_plate?.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || vehicle.status === statusFilter
    
    return matchesSearch && matchesStatus
  })

  // Group by status for statistics
  const stats = {
    total: vehicles.length,
    awaiting: vehicles.filter(v => v.status === 'awaiting').length,
    in_progress: vehicles.filter(v => v.status === 'in_progress').length,
    dismantled: vehicles.filter(v => v.status === 'dismantled').length,
  }

  const handleEdit = (vehicle: PartsVehicle, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedVehicle(vehicle)
    setIsModalOpen(true)
  }

  const handleDelete = async (vehicleId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const ok = await showConfirm({ message: 'Удалить автомобиль? Это действие нельзя отменить.', danger: true })
    if (!ok) return
    deleteMutation.mutate(vehicleId)
  }

  if (!partsCompanyId) {
    return <PartsAccessDenied />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <PartsPageHeader
        title="Автомобили"
        subtitle={`Всего: ${stats.total}`}
        backPath="/parts/dashboard"
        actions={
          <button
            onClick={() => {
              setSelectedVehicle(null)
              setIsModalOpen(true)
            }}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span className="hidden sm:inline">Добавить</span>
          </button>
        }
      />

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
          {[
            { key: 'all', label: 'Всего', value: stats.total, color: 'gray', ring: 'ring-primary', dot: 'bg-gray-400' },
            { key: 'awaiting', label: 'Ожидают', value: stats.awaiting, color: 'yellow', ring: 'ring-yellow-500', dot: 'bg-yellow-500' },
            { key: 'in_progress', label: 'В работе', value: stats.in_progress, color: 'blue', ring: 'ring-blue-500', dot: 'bg-blue-500' },
            { key: 'dismantled', label: 'Разобраны', value: stats.dismantled, color: 'green', ring: 'ring-green-500', dot: 'bg-green-500' },
          ].map(({ key, label, value, ring, dot, color }) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key as any)}
              className={`bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-all flex flex-col ${
                statusFilter === key ? `ring-2 ${ring}` : ''
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs sm:text-sm font-medium text-gray-500">{label}</p>
                <span className={`w-2.5 h-2.5 rounded-full ${dot} flex-shrink-0`} />
              </div>
              <p className={`text-2xl sm:text-3xl font-bold ${
                color === 'gray' ? 'text-gray-900' :
                color === 'yellow' ? 'text-yellow-600' :
                color === 'blue' ? 'text-blue-600' : 'text-green-600'
              }`}>{value}</p>
            </button>
          ))}
        </div>

        {/* Filters & View Controls */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-4">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Поиск по марке, модели, VIN, номеру..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            {/* View Mode Toggle */}
            <div className="flex gap-2 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <Grid className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <List className="w-5 h-5" />
              </button>
            </div>
          </div>

          {statusFilter !== 'all' && (
            <div className="mt-3 flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-600">
                Фильтр: <span className="font-medium">{statusLabels[statusFilter as PartsVehicleStatus]}</span>
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

        {/* Vehicles List/Grid */}
        {isLoading ? (
          <div className="text-center py-12">
            <Spinner size="md" className="inline-block" />
          </div>
        ) : filteredVehicles.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <Car className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-2">
              {searchQuery || statusFilter !== 'all' ? 'Автомобили не найдены' : 'Нет автомобилей'}
            </p>
            {!searchQuery && statusFilter === 'all' && (
              <button
                onClick={() => setIsModalOpen(true)}
                className="mt-4 text-primary hover:underline"
              >
                Добавить первый автомобиль
              </button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredVehicles.map((vehicle) => (
              <div
                key={vehicle.id}
                onClick={() => navigate(`/parts/vehicles/${vehicle.id}`)}
                className="bg-white rounded-lg shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden group flex flex-col"
              >
                <div className="p-3 sm:p-4 flex-1">
                  {/* Status Badge */}
                  <div className="flex items-center justify-between mb-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${statusColors[vehicle.status]}`}>
                      {statusLabels[vehicle.status]}
                    </span>
                  </div>

                  {/* Vehicle Info */}
                  <div className="mb-4">
                    <h3 className="text-lg font-bold text-gray-900 mb-1 group-hover:text-primary transition-colors">
                      {vehicle.make} {vehicle.model}
                    </h3>
                    {vehicle.year && (
                      <p className="text-sm text-gray-600">{vehicle.year} год</p>
                    )}
                  </div>

                  {/* Details */}
                  <div className="space-y-2 text-sm">
                    {vehicle.vin && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <span className="font-medium">VIN:</span>
                        <span className="truncate font-mono text-xs">{vehicle.vin}</span>
                      </div>
                    )}
                    {vehicle.color && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <span className="font-medium">Цвет:</span>
                        <span>{vehicle.color}</span>
                      </div>
                    )}
                    {vehicle.purchase_price && (
                      <div className="flex items-center gap-2 text-gray-900 font-medium">
                        <span className="text-gray-600 font-normal">Покупка:</span>
                        <span>{formatPriceUSD(vehicle)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="bg-gray-50 px-4 py-3 flex gap-2">
                  <button
                    onClick={(e) => handleEdit(vehicle, e)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors font-medium text-gray-700"
                  >
                    Редактировать
                  </button>
                  <button
                    onClick={(e) => handleDelete(vehicle.id, e)}
                    className="px-3 py-2 text-sm font-medium text-red-600 bg-white border border-red-100 hover:bg-red-50 hover:border-red-200 rounded-lg transition-colors"
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
                      Автомобиль
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                      VIN
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                      Статус
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                      Цена покупки
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Действия
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredVehicles.map((vehicle) => (
                    <tr
                      key={vehicle.id}
                      onClick={() => navigate(`/parts/vehicles/${vehicle.id}`)}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div>
                          <div className="font-medium text-gray-900">
                            {vehicle.make} {vehicle.model}
                          </div>
                          {vehicle.year && (
                            <div className="text-sm text-gray-500">{vehicle.year} • {vehicle.color}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600 font-mono hidden lg:table-cell">
                        {vehicle.vin ? (
                          <span className="truncate max-w-[150px] inline-block">{vehicle.vin}</span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap hidden md:table-cell">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${statusColors[vehicle.status]}`}>
                          {statusLabels[vehicle.status]}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900 hidden sm:table-cell">
                        {formatPriceUSD(vehicle)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right text-sm">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={(e) => handleEdit(vehicle, e)}
                            className="px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors"
                          >
                            Изменить
                          </button>
                          <button
                            onClick={(e) => handleDelete(vehicle.id, e)}
                            className="px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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
        <PartsVehicleModal
          isOpen={isModalOpen}
          vehicle={selectedVehicle}
          onClose={() => {
            setIsModalOpen(false)
            setSelectedVehicle(null)
          }}
          onSubmit={async (data) => {
            await saveMutation.mutateAsync(data)
          }}
        />
      )}
      <ConfirmDialog {...dialogProps} />
    </div>
  )
}
