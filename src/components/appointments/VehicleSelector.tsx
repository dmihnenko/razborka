import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { Plus, Car } from 'lucide-react'
import { useUserProfile } from '@/hooks/useUserProfile'

interface Props {
  customerId: string
  selectedId: string
  onSelect: (id: string, vehicle: any) => void
}

export default function VehicleSelector({ customerId, selectedId, onSelect }: Props) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [newVehicleData, setNewVehicleData] = useState({
    brand: '',
    model: '',
    year: new Date().getFullYear(),
    vin: '',
  })
  const [existingVehicle, setExistingVehicle] = useState<any>(null)
  const { data: profile } = useUserProfile()
  const queryClient = useQueryClient()

  const { data: vehicles, isLoading } = useQuery({
    queryKey: ['customer-vehicles', customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      return data
    },
    enabled: !!customerId,
  })

  const createMutation = useMutation({
    mutationFn: async (data: typeof newVehicleData) => {
      const { data: vehicle, error } = await supabase
        .from('vehicles')
        .insert([{
          ...data,
          customer_id: customerId,
          sto_company_id: profile?.sto_company_id,
        }])
        .select()
        .single()
      
      if (error) throw error
      return vehicle
    },
    onSuccess: (vehicle) => {
      queryClient.invalidateQueries({ queryKey: ['customer-vehicles'] })
      toast.success('Автомобиль добавлен')
      onSelect(vehicle.id, vehicle)
      setShowAddForm(false)
      setNewVehicleData({
        brand: '',
        model: '',
        year: new Date().getFullYear(),
        vin: '',
      })
      setExistingVehicle(null)
    },
    onError: () => {
      toast.error('Ошибка при добавлении автомобиля')
    },
  })

  // Проверка VIN в базе данных
  const checkVinMutation = useMutation({
    mutationFn: async (vin: string) => {
      const { data, error } = await supabase
        .from('vehicles')
        .select(`
          *,
          customer:customers(id, full_name, phone)
        `)
        .eq('vin', vin.toUpperCase())
        .eq('sto_company_id', profile?.sto_company_id)
        .single()
      
      if (error && error.code !== 'PGRST116') throw error // PGRST116 = not found
      return data
    },
    onSuccess: (data) => {
      setExistingVehicle(data)
    },
  })

  const handleVinChange = (vin: string) => {
    const vinUpper = vin.toUpperCase()
    setNewVehicleData({ ...newVehicleData, vin: vinUpper })
    
    // Проверяем VIN если введено 17 символов
    if (vinUpper.length === 17) {
      checkVinMutation.mutate(vinUpper)
    } else {
      setExistingVehicle(null)
    }
  }

  const handleUseExisting = () => {
    if (existingVehicle) {
      onSelect(existingVehicle.id, existingVehicle)
      setShowAddForm(false)
      setNewVehicleData({
        brand: '',
        model: '',
        year: new Date().getFullYear(),
        vin: '',
      })
      setExistingVehicle(null)
      toast.success('Автомобиль выбран')
    }
  }

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Проверка VIN
    if (newVehicleData.vin) {
      const vinRegex = /^[A-HJ-NPR-Z0-9]{17}$/
      const vinUpper = newVehicleData.vin.toUpperCase()
      
      if (!vinRegex.test(vinUpper)) {
        toast.error('VIN должен содержать 17 символов (латинские буквы и цифры, кроме I, O, Q)')
        return
      }
      
      if (/[IOQ]/.test(vinUpper)) {
        toast.error('VIN не может содержать буквы I, O, Q')
        return
      }
    }
    
    createMutation.mutate(newVehicleData)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          Выберите автомобиль клиента
        </h3>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Добавить автомобиль
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleCreate} className="p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
          <h3 className="font-semibold text-gray-900 mb-3">Добавить автомобиль</h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Марка *
              </label>
              <input
                type="text"
                required
                value={newVehicleData.brand}
                onChange={(e) => setNewVehicleData({ ...newVehicleData, brand: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Toyota"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Модель *
              </label>
              <input
                type="text"
                required
                value={newVehicleData.model}
                onChange={(e) => setNewVehicleData({ ...newVehicleData, model: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Camry"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Год *
              </label>
              <input
                type="number"
                required
                min="1900"
                max={new Date().getFullYear() + 1}
                value={newVehicleData.year}
                onChange={(e) => setNewVehicleData({ ...newVehicleData, year: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                VIN *
              </label>
              <input
                type="text"
                required
                value={newVehicleData.vin}
                onChange={(e) => handleVinChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="17 символов"
                maxLength={17}
              />
              {checkVinMutation.isPending && (
                <p className="text-sm text-gray-500 mt-1">Проверка VIN...</p>
              )}
            </div>
          </div>
          
          {existingVehicle && (
            <div className="mb-3 p-4 bg-yellow-50 border-2 border-yellow-300 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <Car className="w-6 h-6 text-yellow-600" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900 mb-1">
                    Автомобиль с таким VIN уже есть в базе
                  </h4>
                  <div className="text-sm text-gray-700 space-y-1">
                    <p><strong>Марка/Модель:</strong> {existingVehicle.brand} {existingVehicle.model}</p>
                    <p><strong>Год:</strong> {existingVehicle.year}</p>
                    <p><strong>Владелец:</strong> {existingVehicle.customer?.full_name || 'Не указан'}</p>
                    {existingVehicle.customer?.phone && (
                      <p><strong>Телефон:</strong> {existingVehicle.customer.phone}</p>
                    )}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={handleUseExisting}
                      className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 text-sm font-medium"
                    >
                      Использовать существующий
                    </button>
                    <button
                      type="button"
                      onClick={() => setExistingVehicle(null)}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 text-sm"
                    >
                      Продолжить создание
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50"
            >
              {createMutation.isPending ? 'Сохранение...' : 'Создать'}
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md"
            >
              Отмена
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
          {vehicles?.map((vehicle) => (
            <button
              key={vehicle.id}
              onClick={() => onSelect(vehicle.id, vehicle)}
              className={`p-4 text-left rounded-lg border-2 transition-all ${
                selectedId === vehicle.id
                  ? 'border-primary bg-blue-50 ring-2 ring-primary/20'
                  : 'border-gray-200 hover:border-primary hover:shadow-md'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${selectedId === vehicle.id ? 'bg-primary/10' : 'bg-gray-100'}`}>
                  <Car className={`w-5 h-5 ${selectedId === vehicle.id ? 'text-primary' : 'text-gray-600'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900 truncate">
                    {vehicle.brand} {vehicle.model}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    {vehicle.year} • VIN: {vehicle.vin}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {!isLoading && vehicles?.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          У этого клиента пока нет автомобилей. Добавьте первый.
        </div>
      )}
    </div>
  )
}
