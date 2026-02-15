import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Car, FileText, Phone, Mail, MapPin, Link2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ru } from 'date-fns/locale'
import { toast } from 'sonner'

export default function CustomerProfile() {
  const { id } = useParams<{ id: string }>()

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
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', id)
        .single()
      
      if (error) throw error
      return data
    },
  })

  // Получаем автомобили клиента
  const { data: vehicles, isLoading: vehiclesLoading } = useQuery({
    queryKey: ['customer-vehicles', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .eq('customer_id', id)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      return data
    },
  })

  // Получаем заявки клиента
  const { data: appointments, isLoading: appointmentsLoading } = useQuery({
    queryKey: ['customer-appointments', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select('*, vehicles(brand, model, license_plate)')
        .eq('customer_id', id)
        .order('scheduled_date', { ascending: false })
      
      if (error) throw error
      return data
    },
  })

  if (customerLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
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

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      in_progress: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
      archived: 'bg-gray-100 text-gray-800',
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  const getStatusText = (status: string) => {
    const statuses: Record<string, string> = {
      pending: 'Ожидает',
      in_progress: 'В работе',
      completed: 'Завершено',
      cancelled: 'Отменено',
      archived: 'Архив',
    }
    return statuses[status] || status
  }

  return (
    <div className="max-w-7xl mx-auto">
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
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
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

      {/* Автомобили */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="flex items-center mb-4">
          <Car className="w-6 h-6 mr-2 text-primary" />
          <h2 className="text-xl font-bold text-gray-900">
            Автомобили ({vehicles?.length || 0})
          </h2>
        </div>

        {vehiclesLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : vehicles && vehicles.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {vehicles.map((vehicle) => (
              <div key={vehicle.id} className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-2">
                  {vehicle.brand} {vehicle.model}
                </h3>
                <div className="space-y-1 text-sm text-gray-600">
                  <p>Номер: <span className="font-medium">{vehicle.license_plate}</span></p>
                  {vehicle.year && <p>Год: {vehicle.year}</p>}
                  {vehicle.vin && <p>VIN: {vehicle.vin}</p>}
                  {vehicle.color && <p>Цвет: {vehicle.color}</p>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">Автомобили не добавлены</p>
        )}
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
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : appointments && appointments.length > 0 ? (
          <div className="space-y-4">
            {appointments.map((appointment) => (
              <Link
                key={appointment.id}
                to={`/sto/appointments/${appointment.id}`}
                className="block border border-gray-200 rounded-lg p-4 hover:border-primary transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      Заявка #{appointment.request_number}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {appointment.vehicles?.brand} {appointment.vehicles?.model} • {appointment.vehicles?.license_plate}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(appointment.status)}`}>
                    {getStatusText(appointment.status)}
                  </span>
                </div>
                
                <p className="text-sm text-gray-700 mb-2">{appointment.description}</p>
                
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>
                    {new Date(appointment.appointment_date).toLocaleDateString('ru-RU')}
                  </span>
                  <span>
                    {formatDistanceToNow(new Date(appointment.created_at), { 
                      addSuffix: true,
                      locale: ru 
                    })}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">Заявки не найдены</p>
        )}
      </div>
    </div>
  )
}
