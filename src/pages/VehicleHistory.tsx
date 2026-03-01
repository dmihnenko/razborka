import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Car, Calendar, Wrench, Package, Clock } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ru } from 'date-fns/locale'
import { formatCurrency } from '@/utils/currency'
import { getStatusColor, getStatusText } from '@/utils/status'

export default function VehicleHistory() {
  const { vehicleId } = useParams<{ vehicleId: string }>()

  const { data: vehicle, isLoading: vehicleLoading } = useQuery({
    queryKey: ['vehicle', vehicleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vehicles')
        .select('*, customers(id, name)')
        .eq('id', vehicleId!)
        .single()
      if (error) throw error
      return data
    },
  })

  const { data: appointments, isLoading: appointmentsLoading } = useQuery({
    queryKey: ['vehicle-appointments', vehicleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select('*, appointment_services(id, cost), appointment_parts(id, store_cost, quantity)')
        .eq('vehicle_id', vehicleId!)
        .order('scheduled_date', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })

  const isLoading = vehicleLoading || appointmentsLoading

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    )
  }

  if (!vehicle) {
    return (
      <div className="text-center py-16 text-gray-500">Автомобиль не найден</div>
    )
  }

  // ── Статистика ──
  const allAppts = appointments ?? []

  const calcWorkCost = (a: any) => {
    const fromField = a.total_work_cost || 0
    const fromWorkItems = (a.work_items ?? []).reduce((s: number, w: any) => s + (w.price || 0), 0)
    const fromOldServices = (a.appointment_services ?? []).reduce((s: number, w: any) => s + (w.cost || 0), 0)
    return fromField || fromOldServices || fromWorkItems
  }

  const calcPartsCost = (a: any) => {
    const fromField = a.total_parts_cost || a.parts_cost || 0
    const fromPartItems = (a.part_items ?? []).reduce((s: number, p: any) => s + (p.totalPrice || 0), 0)
    const fromOldParts = (a.appointment_parts ?? []).reduce((s: number, p: any) => s + ((p.store_cost || 0) * (p.quantity || 1)), 0)
    return fromField || fromOldParts || fromPartItems
  }

  const totalWork = allAppts.reduce((s, a) => s + calcWorkCost(a), 0)
  const totalParts = allAppts.reduce((s, a) => s + calcPartsCost(a), 0)

  return (
    <div className="max-w-3xl mx-auto">
      {/* Back */}
      <div className="mb-5">
        {vehicle.customers?.id ? (
          <Link
            to={`/customer/${vehicle.customers.id}`}
            className="inline-flex items-center gap-1.5 text-primary hover:text-primary/80 text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            {vehicle.customers.name}
          </Link>
        ) : (
          <Link to="/vehicles" className="inline-flex items-center gap-1.5 text-primary hover:text-primary/80 text-sm">
            <ArrowLeft className="w-4 h-4" />
            Автомобили
          </Link>
        )}
      </div>

      {/* Vehicle card */}
      <div className="bg-white rounded-xl shadow-sm p-5 mb-5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Car className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
              {vehicle.brand} {vehicle.model}
            </h1>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-gray-500">
              {vehicle.year && <span>{vehicle.year} г.</span>}
              {vehicle.license_plate && (
                <span className="font-mono font-semibold text-gray-700 tracking-widest">
                  {vehicle.license_plate}
                </span>
              )}
              {vehicle.vin && (
                <span className="font-mono text-xs text-gray-400">{vehicle.vin}</span>
              )}
              {vehicle.mileage && (
                <span>{vehicle.mileage.toLocaleString('ru-RU')} км</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-white rounded-xl shadow-sm p-4 text-center">
          <Calendar className="w-5 h-5 text-blue-500 mx-auto mb-1" />
          <p className="text-2xl font-bold text-gray-900">{appointments?.length ?? 0}</p>
          <p className="text-xs text-gray-400">Всего заявок</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 text-center">
          <Package className="w-5 h-5 text-purple-500 mx-auto mb-1" />
          <p className="text-lg font-bold text-gray-900">{formatCurrency(totalParts)}</p>
          <p className="text-xs text-gray-400">Итого запчасти</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 text-center">
          <Wrench className="w-5 h-5 text-orange-500 mx-auto mb-1" />
          <p className="text-lg font-bold text-gray-900">{formatCurrency(totalWork)}</p>
          <p className="text-xs text-gray-400">На работы</p>
        </div>
      </div>

      {/* Appointments list */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" />
          <h2 className="font-bold text-gray-900">История заявок</h2>
          <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full font-medium">
            {appointments?.length ?? 0}
          </span>
        </div>

        {appointments && appointments.length > 0 ? (
          <ul className="divide-y divide-gray-100">
            {appointments.map((appt) => {
              const workCost = calcWorkCost(appt)

              return (
                <li key={appt.id}>
                  <Link
                    to={`/sto/appointments/${appt.id}`}
                    className="flex items-start gap-3 px-4 sm:px-6 py-3 hover:bg-gray-50 transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      {/* Status + date line */}
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(appt.status)}`}>
                          {getStatusText(appt.status)}
                        </span>
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(appt.scheduled_date).toLocaleDateString('ru-RU', {
                            day: 'numeric', month: 'short', year: 'numeric',
                          })}
                        </span>
                        <span className="text-xs text-gray-300">
                          {formatDistanceToNow(new Date(appt.created_at), { addSuffix: true, locale: ru })}
                        </span>
                      </div>

                      {/* Description */}
                      {appt.description && (
                        <p className="text-sm text-gray-600 truncate">{appt.description}</p>
                      )}

                      {/* Costs breakdown */}
                      {workCost > 0 && (
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                          <span className="text-xs text-orange-600 flex items-center gap-1">
                            <Wrench className="w-3 h-3" />
                            {formatCurrency(workCost)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Total */}
                    {workCost > 0 && (
                      <div className="text-right shrink-0">
                        <p className="font-bold text-primary text-sm">{formatCurrency(workCost)}</p>
                      </div>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        ) : (
          <div className="py-12 text-center">
            <Calendar className="w-8 h-8 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-400">Заявок по этому автомобилю нет</p>
          </div>
        )}
      </div>
    </div>
  )
}
