import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Car, TrendingUp, TrendingDown } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { getPersonalVehicles } from '@/services/personalVehicles'
import { useUserProfile } from '@/hooks/useUserProfile'

const NO_IMAGE_URL = '/noimage_final.png'

export default function MyVehiclesArchive() {
  const navigate = useNavigate()
  const { data: profile } = useUserProfile()

  const { data: vehicles = [], isLoading } = useQuery({
    queryKey: ['personal-vehicles-archive', profile?.id],
    queryFn: () => getPersonalVehicles(profile!.id, true),
    enabled: !!profile?.id,
    select: (data) => data.filter(v => v.isSold)
  })

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const calculateProfit = (salePrice?: number, totalCost?: number) => {
    if (!salePrice || !totalCost) return 0
    return salePrice - totalCost
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
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Заголовок */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/my-vehicles')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Назад к активным
          </button>
          
          <div className="flex items-center gap-3">
            <Car className="w-8 h-8 text-gray-700" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Архив автомобилей</h1>
              <p className="text-gray-600 mt-1">Проданные автомобили</p>
            </div>
          </div>
        </div>

        {/* Список */}
        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Загрузка архива...</p>
          </div>
        ) : vehicles.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <Car className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Архив пуст
            </h3>
            <p className="text-gray-600">
              Здесь будут отображаться проданные автомобили
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {vehicles.map((vehicle) => {
              const profit = calculateProfit(vehicle.salePrice, vehicle.totalCost)
              const isProfitable = profit > 0
              
              return (
                <div
                  key={vehicle.id}
                  onClick={() => navigate(`/public/personal-vehicle/${vehicle.id}`)}
                  className="bg-white rounded-lg shadow-md overflow-hidden cursor-pointer transform transition-all hover:shadow-xl hover:-translate-y-1"
                >
                  {/* Метка "ПРОДАН" */}
                  <div className="relative">
                    <div className="aspect-video bg-gray-200 relative overflow-hidden">
                      <img
                        src={vehicle.photoUrl || NO_IMAGE_URL}
                        alt={vehicle.makeModel}
                        className="w-full h-full object-cover opacity-75"
                      />
                    </div>
                    <div className="absolute top-4 right-4">
                      <span className="px-4 py-2 bg-red-700 text-white font-bold rounded-lg shadow-lg">
                        ПРОДАН
                      </span>
                    </div>
                  </div>

                  {/* Информация */}
                  <div className="p-5">
                    <h3 className="text-xl font-bold text-gray-900 mb-3 truncate">
                      {vehicle.makeModel}
                    </h3>

                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Дата продажи:</span>
                        <span className="font-medium text-gray-900">
                          {formatDate(vehicle.soldAt)}
                        </span>
                      </div>
                      
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Цена покупки:</span>
                        <span className="font-medium text-gray-900">
                          ${vehicle.totalCost.toFixed(2)}
                        </span>
                      </div>
                      
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Цена продажи:</span>
                        <span className="font-medium text-gray-900">
                          ${vehicle.salePrice?.toFixed(2) || '0.00'}
                        </span>
                      </div>
                    </div>

                    {/* Прибыль/убыток */}
                    <div className={`rounded-lg p-3 ${
                      isProfitable ? 'bg-green-50' : 'bg-red-50'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {isProfitable ? (
                            <TrendingUp className="w-5 h-5 text-green-600" />
                          ) : (
                            <TrendingDown className="w-5 h-5 text-red-600" />
                          )}
                          <span className="text-sm font-medium text-gray-700">
                            {isProfitable ? 'Прибыль' : 'Убыток'}
                          </span>
                        </div>
                        <span className={`text-xl font-bold ${
                          isProfitable ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {isProfitable ? '+' : ''}${profit.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
