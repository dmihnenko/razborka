import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Archive, Car, Edit } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { getPersonalVehicles } from '@/services/personalVehicles'
import { useUserProfile } from '@/hooks/useUserProfile'
import PersonalVehicleModal from '@/components/personal-vehicles/PersonalVehicleModal'
import ShareLinkModal from '@/components/personal-vehicles/ShareLinkModal'

const NO_IMAGE_URL = '/noimage_final.png'

export default function MyVehicles() {
  const navigate = useNavigate()
  const { data: profile } = useUserProfile()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [shareVehicleId, setShareVehicleId] = useState<string | null>(null)

  const { data: vehicles = [], isLoading } = useQuery({
    queryKey: ['personal-vehicles', profile?.id],
    queryFn: () => getPersonalVehicles(profile!.id, false),
    enabled: !!profile?.id
  })

  /* const deleteMutation = useMutation({
    mutationFn: deletePersonalVehicle,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personal-vehicles'] })
    },
    onError: (error) => {
      console.error('Failed to delete vehicle:', error)
      alert('Ошибка при удалении автомобиля')
    }
  }) */

  /* const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirm('Удалить этот автомобиль? Это действие нельзя отменить.')) {
      deleteMutation.mutate(id)
    }
  }

  const handleShare = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setShareVehicleId(id)
  } */

  const handleEdit = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    navigate(`/public/personal-vehicle/${id}`)
  }

  const handleCardClick = (id: string) => {
    navigate(`/public/personal-vehicle/${id}`)
  }

  const handleCreateSuccess = (vehicleId: string) => {
    navigate(`/public/personal-vehicle/${vehicleId}`)
  }

  const renderClassicCard = (vehicle: any) => {
    // Рассчитываем Grand Total так же как на детальной странице
    const usdRate = vehicle.usdRate || 1
    const allItems = [
      ...(vehicle.lotItems || []),
      ...(vehicle.partsItems || []),
      ...(vehicle.workItems || []),
      ...(vehicle.additionalItems || [])
    ]

    const totalUSD = allItems
      .filter(i => i.currency === 'USD')
      .reduce((s, i) => s + i.cost, 0)

    const totalUAH = allItems
      .filter(i => i.currency === 'UAH')
      .reduce((s, i) => s + i.cost, 0)

    const grandTotal = totalUSD + (totalUAH / usdRate)

    return (
      <div
        key={vehicle.id}
        onClick={() => handleCardClick(vehicle.id)}
        className="bg-white rounded-lg shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden cursor-pointer group"
      >
        {/* Классический дизайн (текущий) */}
        <div className="relative h-32 sm:h-40 md:h-48 overflow-hidden">
          <img
            src={vehicle.photoUrl || NO_IMAGE_URL}
            alt={vehicle.makeModel}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
          />
        </div>

        <div className="p-3 sm:p-4 md:p-5">
        <h3 className="text-base sm:text-lg md:text-xl font-bold text-gray-900 mb-2 truncate">
          {vehicle.makeModel}
        </h3>
        
        <div className="space-y-0.5 sm:space-y-1 mb-2.5 sm:mb-3 md:mb-4">
          <p className="text-gray-600 text-xs sm:text-sm">
            <span className="font-medium">Год:</span> {vehicle.year}
          </p>
          {vehicle.vin ? (
            <div className="flex items-center justify-between gap-2">
              <p className="text-gray-600 text-xs sm:text-sm font-mono truncate">
                <span className="font-medium font-sans">VIN:</span> {vehicle.vin}
              </p>
              
              {/* Стоимость */}
              <div className="bg-blue-50 rounded-lg px-2 py-0.5 sm:px-3 sm:py-1 border border-blue-200 flex-shrink-0">
                <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wide leading-tight text-right">Стоимость</p>
                <p className="text-sm sm:text-base md:text-lg font-bold text-blue-600 whitespace-nowrap leading-tight">
                  ${grandTotal.toFixed(2)}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex justify-end">
              <div className="bg-blue-50 rounded-lg px-2 py-0.5 sm:px-3 sm:py-1 border border-blue-200">
                <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wide leading-tight text-right">Стоимость</p>
                <p className="text-sm sm:text-base md:text-lg font-bold text-blue-600 whitespace-nowrap leading-tight">
                  ${grandTotal.toFixed(2)}
                </p>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={(e) => handleEdit(vehicle.id, e)}
          className="w-full flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-blue-700 text-white rounded-md hover:bg-blue-800 transition-colors text-xs sm:text-sm font-medium"
        >
          <Edit className="w-3 h-3 sm:w-4 sm:h-4" />
          Открыть
        </button>
      </div>
    </div>
    )
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Загрузка...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        {/* Заголовок с мягким оформлением */}
        <div className="mb-6 bg-white border border-gray-200 rounded-xl shadow-sm p-4 sm:p-6">
          <div className="flex flex-col gap-4">
            {/* Заголовок с иконкой */}
            <div className="flex items-center gap-3">
              <div className="p-2 sm:p-3 bg-blue-50 rounded-lg">
                <Car className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold text-gray-900">
                  Личные автомобили с аукционов США
                </h1>
                <p className="text-xs sm:text-sm text-gray-500 mt-0.5 sm:mt-1">
                  Отслеживайте расходы и историю ваших автомобилей
                </p>
              </div>
            </div>
            
            {/* Кнопки */}
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={() => navigate('/my-vehicles/archive')}
                className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-all duration-200 text-sm sm:text-base border border-gray-300 shadow-sm flex-1 sm:flex-none"
              >
                <Archive className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="sm:inline">Архив</span>
              </button>
              
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg transition-all duration-200 text-sm sm:text-base shadow-sm hover:shadow-md font-medium flex-1 sm:flex-none"
              >
                <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                <span>Добавить</span>
              </button>
            </div>
          </div>
        </div>

        {/* Список автомобилей */}
        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-gray-500">
              Загрузка автомобилей...
            </p>
          </div>
        ) : vehicles.length === 0 ? (
          <div className="rounded-lg shadow-sm border p-6 sm:p-8 md:p-12 text-center bg-white border-gray-200">
            <Car className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 text-gray-400" />
            <h3 className="text-lg sm:text-xl font-semibold mb-2 text-gray-900">
              У вас пока нет автомобилей
            </h3>
            <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6">
              Добавьте ваш первый автомобиль с аукциона
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-blue-700 text-white rounded-lg hover:bg-blue-800 transition-colors text-sm sm:text-base"
            >
              <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
              Добавить автомобиль
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {vehicles.map((vehicle) => renderClassicCard(vehicle))}
          </div>
        )}
      </div>

      {/* Модалки */}
      <PersonalVehicleModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleCreateSuccess}
        userId={profile.id}
      />

      {shareVehicleId && (
        <ShareLinkModal
          isOpen={true}
          onClose={() => setShareVehicleId(null)}
          vehicleId={shareVehicleId}
          userId={profile.id}
        />
      )}
    </div>
  )
}
