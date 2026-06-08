import { useParams, Link, useLocation, useNavigate } from 'react-router-dom'
import { Spinner } from '@/components/ui/Spinner'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Car, FileText, Phone, Mail, MapPin, Link2, Package, Plus, Pencil, Trash2, ChevronDown } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ru } from 'date-fns/locale'
import { toast } from 'sonner'
import { useState } from 'react'
import VehicleModal from '@/components/VehicleModal'
import { formatCurrency } from '@/utils/currency'
import { getStatusColor, getStatusText, getOrderStatusColor, getOrderStatusText } from '@/utils/status'
import { useConfirm } from '@/hooks/useConfirm'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { useUserProfile } from '@/hooks/useUserProfile'
import { moveToTrash } from '@/services/trashService'
import { fetchCustomerById, fetchCustomerAppointments, fetchCustomerPartsOrders, fetchVehicleAppointments } from '@/services/customersService'
import { fetchCustomerVehicles, fetchVehicleById, deleteVehicle } from '@/services/vehiclesService'

export default function CustomerProfile() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { confirm: showConfirm, dialogProps } = useConfirm()
  const { data: profile } = useUserProfile()
  const [showVehicleModal, setShowVehicleModal] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<any>(null)
  const [vehiclesMobileOpen, setVehiclesMobileOpen] = useState(false)

  const handleCopyPublicLink = async () => {
    const publicUrl = `${window.location.origin}/public/customer/${id}`
    try {
      await navigator.clipboard.writeText(publicUrl)
      toast.success('Публичная ссылка скопирована в буфер обмена', { duration: 2000 })
    } catch (err) {
      toast.error('Не удалось скопировать ссылку')
    }
  }

  // Получаем данные клиента
  const { data: customer, isLoading: customerLoading } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => fetchCustomerById(id!),
    enabled: !!id,
  })

  // Получаем автомобили клиента
  const { data: vehicles, isLoading: vehiclesLoading } = useQuery({
    queryKey: ['customer-vehicles', id],
    queryFn: () => fetchCustomerVehicles(id!),
    enabled: !!id,
  })

  // Получаем заявки клиента
  const { data: appointments, isLoading: appointmentsLoading } = useQuery({
    queryKey: ['customer-appointments', id],
    queryFn: () => fetchCustomerAppointments(id!),
    enabled: !!id,
  })

  // Получаем заказы запчастей клиента (через связь по телефону)
  const { data: partsOrders } = useQuery({
    queryKey: ['customer-parts-orders', customer?.phone],
    queryFn: () => fetchCustomerPartsOrders(customer!.phone),
    enabled: !!customer?.phone
  })

  const deleteVehicleMutation = useMutation({
    mutationFn: async (vehicleId: string) => {
      const vehicle = await fetchVehicleById(vehicleId)
      const appts = await fetchVehicleAppointments(vehicleId)
      if (vehicle) {
        await moveToTrash({
          entityType: 'vehicle',
          entityId: vehicleId,
          entityLabel: `${vehicle.brand || ''} ${vehicle.model || ''}`.trim() || 'Автомобиль',
          entityData: { vehicle, appointments: appts },
          stoCompanyId: profile?.sto_company_id,
        })
      }
      await deleteVehicle(vehicleId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-vehicles', id] })
      toast.success('Автомобиль удалён')
    },
    onError: () => toast.error('Ошибка при удалении'),
  })

  if (customerLoading) {
    return (
      <div className="flex justify-center items-center min-h-dvh">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Клиент не найден</p>
      </div>
    )
  }



  return (
    <div className="w-full">
      <div className="mb-6">
        <Link
          to="/customers"
          className="inline-flex items-center text-primary hover:text-primary/80"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Назад к клиентам
        </Link>
      </div>

      {/* Информация о клиенте */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-900">{customer.name}</h1>
          <button
            onClick={handleCopyPublicLink}
            className="flex items-center gap-2 px-4 py-2 bg-blue-700 text-white rounded-md hover:bg-blue-800 transition-colors"
          >
            <Link2 className="w-5 h-5" />
            Ссылка клиента
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {customer.phone && (
            <div className="flex items-center text-gray-600">
              <Phone className="w-5 h-5 mr-3 text-gray-400" />
              <span>{customer.phone}</span>
            </div>
          )}
          
          {customer.email && (
            <div className="flex items-center text-gray-600">
              <Mail className="w-5 h-5 mr-3 text-gray-400" />
              <span>{customer.email}</span>
            </div>
          )}
          
          {customer.address && (
            <div className="flex items-center text-gray-600 md:col-span-2">
              <MapPin className="w-5 h-5 mr-3 text-gray-400" />
              <span>{customer.address}</span>
            </div>
          )}
        </div>

        {customer.notes && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{customer.notes}</p>
          </div>
        )}
      </div>

      {/* Секция автомобилей */}
      <div className="bg-white rounded-lg shadow-sm mb-6">
        {/* Header — on mobile acts as toggle */}
        <div
          className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-100 sm:cursor-default cursor-pointer select-none"
          onClick={() => {
            // only toggle on mobile (no sm: equivalent clicks here)
            if (window.innerWidth < 640) setVehiclesMobileOpen(v => !v)
          }}
        >
          <div className="flex items-center gap-2">
            <Car className="w-5 h-5 text-primary" />
            <h2 className="text-base sm:text-lg font-bold text-gray-900">Автомобили</h2>
            {vehicles && vehicles.length > 0 && (
              <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full font-medium">
                {vehicles.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); setEditingVehicle(null); setShowVehicleModal(true) }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-sm rounded-lg hover:bg-primary/90 transition-colors font-medium"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Добавить авто</span>
              <span className="sm:hidden">Добавить</span>
            </button>
            {/* Chevron only on mobile */}
            <ChevronDown className={`w-4 h-4 text-gray-400 sm:hidden transition-transform ${vehiclesMobileOpen ? 'rotate-180' : ''}`} />
          </div>
        </div>

        {/* Vehicle list — always visible on sm+, toggleable on mobile */}
        <div className={`${vehiclesMobileOpen ? 'block' : 'hidden'} sm:block`}>
        {vehiclesLoading ? (
          <div className="flex justify-center py-8">
            <Spinner size="sm" />
          </div>
        ) : vehicles && vehicles.length > 0 ? (
          /* Mobile: compact list rows | Desktop: grid cards */
          <div className="divide-y divide-gray-100 sm:divide-y-0 sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:gap-3 sm:p-4">
            {vehicles.map((vehicle) => (
              <div
                key={vehicle.id}
                className={[
                  'group',
                  /* mobile row */
                  'flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors',
                  /* desktop card */
                  'sm:flex-col sm:items-start sm:px-4 sm:py-4 sm:rounded-xl sm:border sm:border-gray-200',
                  'sm:hover:border-primary/40 sm:hover:shadow-sm sm:bg-white sm:transition-all',
                ].join(' ')}
              >
                {/* Card top row: icon + actions */}
                <div className="shrink-0 sm:w-full sm:flex sm:items-center sm:justify-between sm:mb-3">
                  <Link
                    to={`/vehicle/${vehicle.id}/history`}
                    className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 hover:bg-primary/20 transition-colors"
                    title="История заявок"
                  >
                    <Car className="w-4 h-4 text-primary" />
                  </Link>
                  <div className="hidden sm:flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => navigate(`/vehicles/${vehicle.id}/edit`)}
                      className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"
                      title="Редактировать"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={async () => {
                        const ok = await showConfirm({ message: `Удалить ${vehicle.brand} ${vehicle.model} (${vehicle.license_plate})?`, danger: true })
                        if (!ok) return
                        deleteVehicleMutation.mutate(vehicle.id)
                      }}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                      title="Удалить"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Main info */}
                <div className="flex-1 min-w-0 sm:w-full">
                    <Link
                      to={`/vehicle/${vehicle.id}/history`}
                      className="block hover:text-primary transition-colors"
                    >
                      <p className="text-sm font-bold text-gray-900 truncate sm:text-base sm:mb-0.5 group-hover:text-primary transition-colors">
                        {vehicle.brand} {vehicle.model}
                      </p>
                    </Link>
                  {/* mobile: year+color inline | desktop: separate line */}
                  <p className="text-xs text-gray-400 sm:text-sm sm:mb-2">
                    {vehicle.year}
                  </p>
                  {/* VIN */}
                  {vehicle.vin && (
                    <p className="hidden sm:block text-xs font-mono text-gray-400 truncate mb-1">{vehicle.vin}</p>
                  )}
                  {/* Mileage */}
                  {vehicle.mileage && (
                    <p className="hidden sm:block text-xs text-gray-400">
                      {vehicle.mileage.toLocaleString('ru-RU')} км
                    </p>
                  )}
                  {/* Mobile: vin + mileage inline */}
                  <p className="text-xs text-gray-400 font-mono truncate sm:hidden">
                    {vehicle.vin && <span>{vehicle.vin}</span>}
                    {vehicle.vin && vehicle.mileage && <span> · </span>}
                    {vehicle.mileage && <span>{vehicle.mileage.toLocaleString('ru-RU')} км</span>}
                  </p>
                </div>

                {/* Mobile-only actions */}
                  <div className="flex items-center gap-1 shrink-0 sm:hidden">
                    <button
                      onClick={() => navigate(`/vehicles/${vehicle.id}/edit`)}
                      className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-500 hover:text-blue-600 transition-colors"
                      aria-label="Редактировать"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={async () => {
                      const ok = await showConfirm({ message: `Удалить ${vehicle.brand} ${vehicle.model} (${vehicle.license_plate})?`, danger: true })
                      if (!ok) return
                      deleteVehicleMutation.mutate(vehicle.id)
                    }}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                    title="Удалить"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center">
            <Car className="w-8 h-8 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-400">Автомобили не добавлены</p>
            <button
              onClick={() => { setEditingVehicle(null); setShowVehicleModal(true) }}
              className="mt-2 text-sm text-primary hover:underline"
            >
              Добавить первый
            </button>
          </div>
        )}
        </div>
      </div>

      {/* История заявок */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center mb-4">
          <FileText className="w-6 h-6 mr-2 text-primary" />
          <h2 className="text-xl font-bold text-gray-900">
            История заявок ({appointments?.length || 0})
          </h2>
        </div>

        {appointmentsLoading ? (
          <div className="flex justify-center py-8">
            <Spinner size="md" />
          </div>
        ) : appointments && appointments.length > 0 ? (
          (() => {
            const active = appointments.filter((a: any) => a.status !== 'archived')
            const archived = appointments.filter((a: any) => a.status === 'archived')
            const renderCard = (appointment: any) => (
              <Link
                key={appointment.id}
                to={`/sto/appointments/${appointment.id}`}
                state={{ from: location.pathname }}
                className="block border border-gray-200 rounded-lg p-4 hover:border-primary transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      Заявка <span className="text-gray-400 font-normal opacity-60">#{appointment.request_number}</span>
                    </h3>
                    <p className="text-sm text-gray-600">
                      {appointment.vehicles?.brand} {appointment.vehicles?.model}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(appointment.status)}`}>
                    {getStatusText(appointment.status)}
                  </span>
                </div>
                <p className="text-sm text-gray-700 mb-2">{appointment.description}</p>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{new Date(appointment.appointment_date).toLocaleDateString('ru-RU')}</span>
                  <span>{formatDistanceToNow(new Date(appointment.created_at), { addSuffix: true, locale: ru })}</span>
                </div>
              </Link>
            )
            return (
              <div className="space-y-4">
                {active.length > 0 && (
                  <div className="space-y-3">
                    {active.length > 0 && archived.length > 0 && (
                      <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Активные</p>
                    )}
                    {active.map(renderCard)}
                  </div>
                )}
                {archived.length > 0 && (
                  <div className="space-y-3">
                    {active.length > 0 && (
                      <p className="text-sm font-medium text-gray-400 uppercase tracking-wide mt-2">Архив</p>
                    )}
                    {archived.map(renderCard)}
                  </div>
                )}
              </div>
            )
          })()
        ) : (
          <p className="text-gray-500 text-center py-8">Заявки не найдены</p>
        )}
      </div>

      {/* Заказы запчастей */}
      {partsOrders && partsOrders.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center mb-4">
            <Package className="w-6 h-6 mr-2 text-primary" />
            <h2 className="text-xl font-bold text-gray-900">
              Заказы запчастей ({partsOrders.length})
            </h2>
          </div>

          <div className="space-y-4">
            {partsOrders.map((order: any) => (
              <div
                key={order.id}
                className="border border-gray-200 rounded-lg p-4"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-gray-900">
                        Заказ {order.order_number}
                      </h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getOrderStatusColor(order.status)}`}>
                        {getOrderStatusText(order.status)}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-primary">
                      {formatCurrency(order.total_amount)}
                    </div>
                  </div>
                </div>
                
                {/* Список позиций */}
                {order.items && order.items.length > 0 && (
                  <div className="mb-3 p-3 bg-gray-50 rounded">
                    <div className="space-y-2">
                      {order.items.map((item: any) => (
                        <div key={item.id} className="flex justify-between text-sm">
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">
                              {item.inventory_item?.name || 'Запчасть'}
                            </div>
                            {item.inventory_item?.part_number && (
                              <div className="text-xs text-gray-500">
                                Артикул: {item.inventory_item.part_number}
                              </div>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="text-gray-900">
                              {item.quantity} шт × {formatCurrency(item.price_at_sale)}
                            </div>
                            <div className="font-medium text-primary">
                              {formatCurrency(item.subtotal)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {order.notes && (
                  <div className="mb-2 p-2 bg-blue-50 rounded text-sm text-gray-700">
                    {order.notes}
                  </div>
                )}
                
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>
                    {new Date(order.order_date).toLocaleDateString('ru-RU')}
                  </span>
                  <span>
                    {formatDistanceToNow(new Date(order.created_at), { 
                      addSuffix: true,
                      locale: ru 
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Модалка добавления/редактирования автомобиля */}
      {showVehicleModal && (
        <VehicleModal
          onClose={() => { setShowVehicleModal(false); setEditingVehicle(null) }}
          customerId={id}
          customerName={customer.name}
          vehicle={editingVehicle}
        />
      )}
      <ConfirmDialog {...dialogProps} />
    </div>
  )
}
