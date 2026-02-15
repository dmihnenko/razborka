import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Search } from 'lucide-react'
import { useSearchParams, Link } from 'react-router-dom'
import { useUserProfile } from '@/hooks/useUserProfile'

interface VehicleModalProps {
  vehicle: any
  onClose: () => void
  customerSearch: string
  setCustomerSearch: (value: string) => void
  showCustomerDropdown: boolean
  setShowCustomerDropdown: (value: boolean) => void
}

export default function Vehicles() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<any>(null)
  const [searchParams] = useSearchParams()
  const customerId = searchParams.get('customer_id')
  const queryClient = useQueryClient()
  const [customerSearch, setCustomerSearch] = useState('')
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const { data: profile } = useUserProfile()
  
  // Проверка роли владельца
  const isStoOwner = profile?.roles?.some((r: any) => r.name === 'sto_owner')

  const { data: vehicles, isLoading } = useQuery({
    queryKey: ['vehicles', customerId],
    queryFn: async () => {
      let query = supabase
        .from('vehicles')
        .select('*, customers(name, id)')
        .order('created_at', { ascending: false })
      
      // Если передан customer_id - фильтруем
      if (customerId) {
        query = query.eq('customer_id', customerId)
      }
      
      const { data, error } = await query
      
      if (error) throw error
      return data
    },
  })

  // Фильтрация автомобилей по поисковому запросу
  const filteredVehicles = useMemo(() => {
    if (!vehicles) return []
    if (!searchQuery.trim()) return vehicles

    const query = searchQuery.toLowerCase().trim()
    return vehicles.filter((vehicle) => {
      const brand = vehicle.brand?.toLowerCase() || ''
      const model = vehicle.model?.toLowerCase() || ''
      const plate = vehicle.license_plate?.toLowerCase() || ''
      const vin = vehicle.vin?.toLowerCase() || ''
      const customer = vehicle.customers?.name?.toLowerCase() || ''
      
      return brand.includes(query) || 
             model.includes(query) || 
             plate.includes(query) || 
             vin.includes(query) ||
             customer.includes(query)
    })
  }, [vehicles, searchQuery])

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('vehicles').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] })
      toast.success('Автомобиль удален')
    },
    onError: () => {
      toast.error('Ошибка при удалении')
    },
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Автомобили</h1>
          {customerId && vehicles && vehicles.length > 0 && (
            <p className="text-sm text-gray-600 mt-1">
              Клиент: <Link to="/customers" className="text-primary hover:underline">{vehicles[0].customers?.name}</Link>
            </p>
          )}
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Поиск по марке, модели, номеру, VIN..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent w-80"
            />
          </div>
          <button
            onClick={() => {
              setEditingVehicle(null)
              setCustomerSearch('')
              setIsModalOpen(true)
            }}
            className="flex items-center px-4 py-2 text-white bg-primary rounded-md hover:bg-primary/90"
          >
            <Plus className="w-5 h-5 mr-2" />
            Добавить автомобиль
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Владелец
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Автомобиль
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Гос. номер
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  VIN
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Пробег
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredVehicles?.map((vehicle: any) => (
                <tr key={vehicle.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {vehicle.customers?.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {vehicle.brand} {vehicle.model}
                    </div>
                    <div className="text-sm text-gray-500">{vehicle.year} г., {vehicle.color}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {vehicle.license_plate}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {vehicle.vin || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {vehicle.mileage ? `${vehicle.mileage.toLocaleString()} км` : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => {
                        setEditingVehicle(vehicle)
                        setCustomerSearch(vehicle.customers?.name || '')
                        setIsModalOpen(true)
                      }}
                      className="text-primary hover:text-primary/80 mr-3"
                    >
                      <Pencil className="w-5 h-5" />
                    </button>
                    {isStoOwner && (
                      <button
                        onClick={() => {
                          if (confirm('Удалить этот автомобиль?')) {
                            deleteMutation.mutate(vehicle.id)
                          }
                        }}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isModalOpen && (
        <VehicleModal
          vehicle={editingVehicle}
          onClose={() => setIsModalOpen(false)}
          customerSearch={customerSearch}
          setCustomerSearch={setCustomerSearch}
          showCustomerDropdown={showCustomerDropdown}
          setShowCustomerDropdown={setShowCustomerDropdown}
        />
      )}
    </div>
  )
}

function VehicleModal({ 
  vehicle, 
  onClose,
  customerSearch,
  setCustomerSearch,
  showCustomerDropdown,
  setShowCustomerDropdown
}: VehicleModalProps) {
  const [formData, setFormData] = useState({
    customer_id: vehicle?.customer_id || '',
    brand: vehicle?.brand || '',
    model: vehicle?.model || '',
    year: vehicle?.year || new Date().getFullYear(),
    license_plate: vehicle?.license_plate || '',
    vin: vehicle?.vin || '',
    color: vehicle?.color || '',
    mileage: vehicle?.mileage || '',
  })

  const queryClient = useQueryClient()

  const { data: customers } = useQuery({
    queryKey: ['customers-list'],
    queryFn: async () => {
      const { data } = await supabase.from('customers').select('id, name').order('name')
      return data || []
    },
  })

  const mutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const vehicleData = {
        ...data,
        mileage: data.mileage ? Number(data.mileage) : null,
      }

      if (vehicle) {
        const { error } = await supabase
          .from('vehicles')
          .update(vehicleData)
          .eq('id', vehicle.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('vehicles').insert([vehicleData])
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] })
      toast.success(vehicle ? 'Автомобиль обновлен' : 'Автомобиль добавлен')
      onClose()
    },
    onError: () => {
      toast.error('Ошибка при сохранении')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Проверка VIN
    if (formData.vin) {
      const vinRegex = /^[A-HJ-NPR-Z0-9]{17}$/
      const vinUpper = formData.vin.toUpperCase()
      
      if (!vinRegex.test(vinUpper)) {
        toast.error('VIN должен содержать 17 символов (латинские буквы и цифры, кроме I, O, Q)')
        return
      }
      
      // Проверка на запрещенные символы
      if (/[IOQ]/.test(vinUpper)) {
        toast.error('VIN не может содержать буквы I, O, Q')
        return
      }
    }
    
    mutation.mutate(formData)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">
          {vehicle ? 'Редактировать автомобиль' : 'Добавить автомобиль'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700">Владелец *</label>
            <input
              type="text"
              required
              value={customerSearch}
              onChange={(e) => {
                setCustomerSearch(e.target.value)
                setShowCustomerDropdown(true)
              }}
              onFocus={() => setShowCustomerDropdown(true)}
              placeholder="Введите имя клиента..."
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
            />
            {showCustomerDropdown && customerSearch && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                {customers
                  ?.filter((c: any) => 
                    c.name.toLowerCase().includes(customerSearch.toLowerCase())
                  )
                  .map((customer: any) => (
                    <div
                      key={customer.id}
                      onClick={() => {
                        setFormData({ ...formData, customer_id: customer.id })
                        setCustomerSearch(customer.name)
                        setShowCustomerDropdown(false)
                      }}
                      className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                    >
                      {customer.name}
                    </div>
                  ))}
                {customers?.filter((c: any) => 
                  c.name.toLowerCase().includes(customerSearch.toLowerCase())
                ).length === 0 && (
                  <div className="px-3 py-2 text-gray-500">Клиент не найден</div>
                )}
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Марка *</label>
            <input
              type="text"
              required
              value={formData.brand}
              onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Модель *</label>
            <input
              type="text"
              required
              value={formData.model}
              onChange={(e) => setFormData({ ...formData, model: e.target.value })}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Год выпуска *</label>
            <input
              type="number"
              required
              min="1900"
              max={new Date().getFullYear() + 1}
              value={formData.year}
              onChange={(e) => setFormData({ ...formData, year: Number(e.target.value) })}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">VIN *</label>
            <input
              type="text"
              required
              value={formData.vin}
              onChange={(e) => setFormData({ ...formData, vin: e.target.value })}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Пробег (км)</label>
            <input
              type="number"
              value={formData.mileage}
              onChange={(e) => setFormData({ ...formData, mileage: e.target.value })}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
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
              className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
            >
              {mutation.isPending ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
