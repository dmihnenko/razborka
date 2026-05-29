import { useState, useMemo } from 'react'
import { Spinner } from '@/components/ui/Spinner'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Search } from 'lucide-react'
import { useSearchParams, Link, useNavigate } from 'react-router-dom'
import { useUserProfile } from '@/hooks/useUserProfile'
import { useBlockScroll } from '@/hooks/useBlockScroll'
import { useConfirm } from '@/hooks/useConfirm'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { moveToTrash } from '@/services/trashService'
import {
  fetchVehicles,
  fetchVehicleById,
  deleteVehicle,
  fetchVehicleAppointments,
  createVehicle,
  updateVehicle,
  fetchCustomerOptions,
} from '@/services/vehiclesService'

interface VehicleModalProps {
  vehicle: any
  onClose: () => void
  customerSearch: string
  setCustomerSearch: (value: string) => void
  showCustomerDropdown: boolean
  setShowCustomerDropdown: (value: boolean) => void
}

export default function Vehicles() {
  const navigate = useNavigate()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<any>(null)
  const [searchParams] = useSearchParams()
  const customerId = searchParams.get('customer_id')
  const queryClient = useQueryClient()
  const { confirm: showConfirm, dialogProps } = useConfirm()
  const [customerSearch, setCustomerSearch] = useState('')
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const { data: profile } = useUserProfile()
  
  // Проверка роли владельца
  const isStoOwner = profile?.roles?.some((r: any) => r.name === 'sto_owner')

  const stoCompanyId = profile?.sto_company_id

  const { data: vehicles, isLoading } = useQuery({
    queryKey: ['vehicles', customerId, stoCompanyId],
    // Ждём загрузки профиля — НИКОГДА не грузим без фильтра
    enabled: !!profile && !!stoCompanyId,
    queryFn: () =>
      fetchVehicles({
        stoCompanyId: stoCompanyId, // всегда фильтруем по компании
        customerId,
      }),
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
      const vehicle = await fetchVehicleById(id)
      const appts = await fetchVehicleAppointments(id)
      if (vehicle) {
        await moveToTrash({
          entityType: 'vehicle',
          entityId: id,
          entityLabel: `${vehicle.brand || ''} ${vehicle.model || ''}`.trim() || 'Автомобиль',
          entityData: { vehicle, appointments: appts || [] },
          stoCompanyId: profile?.sto_company_id,
        })
      }
      await deleteVehicle(id)
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
    <div className="container-mobile">
      {customerId && vehicles && vehicles.length > 0 && (
        <p className="text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4">
          Клиент: <Link to="/customers" className="text-primary hover:underline font-medium">{vehicles[0].customers?.name}</Link>
        </p>
      )}

      {/* Search and Actions */}
      <div className="flex justify-end gap-3 mb-4 sm:mb-6 flex-wrap">
        <div className="relative flex-1 sm:flex-initial">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Поиск по марке, модели, VIN..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:w-80 pl-9 sm:pl-10 pr-4 py-2 text-mobile-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>
        <button
          onClick={() => {
            setEditingVehicle(null)
            setCustomerSearch('')
            setIsModalOpen(true)
          }}
          className="btn-touch-sm bg-primary text-white hover:bg-primary/90 flex items-center gap-1.5 whitespace-nowrap"
        >
          <Plus className="w-4 h-4 flex-shrink-0" />
          <span className="hidden sm:inline">Добавить</span>
          <span className="sm:hidden">Авто</span>
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center">
          <Spinner size="lg" />
        </div>
      ) : (
        <>
          {/* Десктопная таблица */}
          <div className="hidden md:block bg-white rounded-lg shadow overflow-hidden">
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
                        onClick={async () => {
                          const ok = await showConfirm({ message: 'Удалить этот автомобиль?', danger: true })
                          if (!ok) return
                          deleteMutation.mutate(vehicle.id)
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

        {/* Мобильные карточки */}
        <div className="md:hidden space-y-3">
          {filteredVehicles?.map((vehicle: any) => (
            <div key={vehicle.id} className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              {/* Заголовок карточки - кликабельный */}
              <div 
                onClick={() => navigate(`/appointments?vehicle_id=${vehicle.id}`)}
                className="bg-gradient-to-r from-indigo-50 to-white px-3 py-2 border-b border-gray-100 cursor-pointer hover:from-indigo-100 hover:to-blue-50 transition-colors"
              >
                <div className="text-base font-semibold text-gray-900">
                  {vehicle.brand} {vehicle.model}
                </div>
                <div className="text-sm text-gray-500 mt-0.5">
                  {vehicle.year} г. • {vehicle.color}
                </div>
              </div>

              {/* Основная информация */}
              <div className="p-3 space-y-2.5">
                {/* Владелец */}
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-purple-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <Link 
                    to={`/appointments?vehicle_id=${vehicle.id}`}
                    className="text-sm text-gray-700 font-medium hover:text-primary flex items-center"
                  >
                    {vehicle.customers?.name}
                  </Link>
                </div>

                {/* Номер и VIN */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-gray-900">{vehicle.license_plate}</div>
                      {vehicle.vin && (
                        <div className="text-xs text-gray-500">VIN: {vehicle.vin}</div>
                      )}
                    </div>
                  </div>
                  {vehicle.mileage && (
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">{vehicle.mileage.toLocaleString()}</span> км
                    </div>
                  )}
                </div>
              </div>

              {/* Кнопки действий */}
              <div className="px-3 py-2 bg-gray-50 flex items-center justify-end gap-2 border-t border-gray-100">
                <button
                  onClick={() => {
                    setEditingVehicle(vehicle)
                    setCustomerSearch(vehicle.customers?.name || '')
                    setIsModalOpen(true)
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-primary hover:bg-blue-50 rounded transition-colors font-medium"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Изменить</span>
                </button>
                {isStoOwner && (
                  <button
                    onClick={async () => {
                      const ok = await showConfirm({ message: 'Удалить этот автомобиль?', danger: true })
                      if (!ok) return
                      deleteMutation.mutate(vehicle.id)
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded transition-colors font-medium"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Удалить</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </>
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
      <ConfirmDialog {...dialogProps} />
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

  const { data: profile } = useUserProfile()
  useBlockScroll(true)

  const queryClient = useQueryClient()

  const { data: customers = [] } = useQuery({
    queryKey: ['customers-list', profile?.sto_company_id],
    enabled: !!profile?.sto_company_id,
    queryFn: () => fetchCustomerOptions(profile?.sto_company_id),
  })

  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return []
    const q = customerSearch.toLowerCase()
    const digits = q.replace(/\D/g, '')
    return customers.filter((c: any) =>
      c.name.toLowerCase().includes(q) ||
      (digits.length >= 3 && c.phone && c.phone.replace(/\D/g, '').includes(digits))
    )
  }, [customers, customerSearch])

  const mutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const vehicleData = {
        ...data,
        mileage: data.mileage ? Number(data.mileage) : null,
      }

      if (vehicle) {
        await updateVehicle(vehicle.id, vehicleData)
      } else {
        await createVehicle(vehicleData, profile?.sto_company_id)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] })
      toast.success(vehicle ? 'Автомобиль обновлен' : 'Автомобиль добавлен')
      onClose()
    },
    onError: (error: any) => {
      const msg = error?.message || ''
      if (msg.includes('409') || msg.includes('conflict') || msg.includes('unique') || 
          msg.includes('vehicles_vin_key') || error?.code === '23505') {
        toast.error('Автомобиль с таким VIN уже есть в системе', { duration: 3000 })
      } else if (msg.includes('license_plate')) {
        toast.error('Автомобиль с таким номером уже существует', { duration: 3000 })
      } else {
        toast.error('Ошибка при сохранении автомобиля')
      }
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto relative">
        <div className="sticky top-0 bg-white px-4 sm:px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg sm:text-xl font-bold">
            {vehicle ? 'Редактировать автомобиль' : 'Добавить автомобиль'}
          </h2>
        </div>
        <form onSubmit={handleSubmit} className="px-4 sm:px-6 py-4 space-y-4">
          <div className="relative">
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Владелец *</label>
            <input
              type="text"
              required
              value={customerSearch}
              onChange={(e) => {
                setCustomerSearch(e.target.value)
                setShowCustomerDropdown(true)
              }}
              onFocus={() => setShowCustomerDropdown(true)}
              placeholder="Имя или телефон клиента..."
              className="block w-full px-3 py-2.5 sm:py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
            {showCustomerDropdown && customerSearch && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-xl max-h-56 overflow-auto">
                {filteredCustomers.length > 0 ? filteredCustomers.map((customer: any) => (
                  <div key={customer.id}
                    onClick={() => {
                      setFormData({ ...formData, customer_id: customer.id })
                      setCustomerSearch(customer.name)
                      setShowCustomerDropdown(false)
                    }}
                    className="px-4 py-3 hover:bg-gray-50 cursor-pointer flex items-center justify-between gap-2 border-b border-gray-100 last:border-0"
                  >
                    <span className="text-sm font-semibold text-gray-800">{customer.name}</span>
                    {customer.phone && <span className="text-xs text-gray-400 font-mono flex-shrink-0">{customer.phone}</span>}
                  </div>
                )) : (
                  <div className="px-4 py-3 text-sm text-gray-400">Клиент не найден</div>
                )}
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Марка *</label>
            <input
              type="text"
              required
              value={formData.brand}
              onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
              className="block w-full px-3 py-2.5 sm:py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Модель *</label>
            <input
              type="text"
              required
              value={formData.model}
              onChange={(e) => setFormData({ ...formData, model: e.target.value })}
              className="block w-full px-3 py-2.5 sm:py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Год выпуска *</label>
            <input
              type="number"
              required
              min="1900"
              max={new Date().getFullYear() + 1}
              value={formData.year}
              onChange={(e) => setFormData({ ...formData, year: Number(e.target.value) })}
              className="block w-full px-3 py-2.5 sm:py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Гос. номер</label>
            <input
              type="text"
              value={formData.license_plate}
              onChange={(e) => setFormData({ ...formData, license_plate: e.target.value.toUpperCase() })}
              placeholder="АА1234ВВ"
              className="block w-full px-3 py-2.5 sm:py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent font-mono tracking-widest uppercase"
            />
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">VIN</label>
            <input
              type="text"
              value={formData.vin}
              onChange={(e) => setFormData({ ...formData, vin: e.target.value })}
              className="block w-full px-3 py-2.5 sm:py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Пробег (км)</label>
            <input
              type="number"
              value={formData.mileage}
              onChange={(e) => setFormData({ ...formData, mileage: e.target.value })}
              className="block w-full px-3 py-2.5 sm:py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
        </form>
        <div className="sticky bottom-0 bg-white px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-200 flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 sm:py-3 text-sm sm:text-base text-gray-700 hover:bg-gray-100 rounded-lg transition-colors font-medium border-2 border-gray-300"
          >
            Отмена
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={mutation.isPending}
            className="flex-1 px-4 py-2.5 sm:py-3 text-sm sm:text-base text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors font-medium"
          >
            {mutation.isPending ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  )
}
