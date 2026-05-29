import { useState } from 'react'
import { Spinner } from '@/components/ui/Spinner'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Car, FileText, Clock, Package, ChevronDown, ChevronUp, CheckCircle, Archive, Phone, Wrench, DollarSign } from 'lucide-react'
import { PublicBrandHeader } from '@/components/PublicBrandHeader'
import { formatDistanceToNow } from 'date-fns'
import { ru } from 'date-fns/locale'
import { formatCurrency } from '@/utils/currency'
import { getAppointmentStatusColor, getAppointmentStatusText, getPartsOrderStatusColor, getPartsOrderStatusText } from '@/utils/status'

const ACTIVE_STATUSES = new Set(['pending', 'scheduled', 'in_progress'])
const DONE_STATUSES = new Set(['completed', 'cancelled', 'archived'])

export default function PublicCustomerView() {
  const { id } = useParams<{ id: string }>()
  const [vehiclesOpen, setVehiclesOpen] = useState(true)

  const { data: customer } = useQuery({
    queryKey: ['public-customer', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('customers').select('name, phone').eq('id', id).single()
      if (error) throw error
      return data
    },
  })

  const { data: vehicles, isLoading: vehiclesLoading } = useQuery({
    queryKey: ['public-customer-vehicles', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('vehicles').select('*').eq('customer_id', id).order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })

  const { data: appointments, isLoading: appointmentsLoading } = useQuery({
    queryKey: ['public-customer-appointments', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('appointments').select('*, vehicles(brand,model,license_plate,vin)').eq('customer_id', id).order('scheduled_date', { ascending: false })
      if (error) throw error
      return data
    },
  })

  const { data: partsOrders, isLoading: partsOrdersLoading } = useQuery({
    queryKey: ['public-customer-parts-orders', customer?.phone],
    queryFn: async () => {
      if (!customer?.phone) return []
      const { data: partsCustomers } = await supabase.from('parts_customers').select('id').eq('phone', customer.phone)
      if (!partsCustomers?.length) return []
      const { data, error } = await supabase.from('parts_orders').select('*, items:parts_order_items(id,quantity,price_at_sale,subtotal,inventory_item:parts_inventory(name,part_number))').in('customer_id', partsCustomers.map(c => c.id)).order('order_date', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!customer?.phone,
  })

  if (vehiclesLoading || appointmentsLoading || partsOrdersLoading) {
    return (
      <div className="min-h-dvh bg-[#F4F6FA] flex flex-col">
        <PublicBrandHeader subtitle="История обслуживания" />
        <div className="flex-1 flex justify-center items-center">
          <Spinner size="lg" />
        </div>
      </div>
    )
  }

  const activeAppointments = (appointments ?? []).filter(a => ACTIVE_STATUSES.has(a.status))
  const archivedAppointments = (appointments ?? []).filter(a => DONE_STATUSES.has(a.status))

  return (
    <div className="min-h-dvh bg-[#F4F6FA]">
      <PublicBrandHeader subtitle="История обслуживания" />

      <div className="max-w-2xl mx-auto px-4 py-5 pb-10">

        {/* Карточка клиента */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold flex-shrink-0 shadow-sm">
              {'*'}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold text-gray-900">Ваш профиль</h1>
              {customer?.phone && (
                <a href={`tel:${customer.phone}`} className="flex items-center gap-1.5 text-sm text-indigo-600 mt-0.5 hover:underline">
                  <Phone className="w-3.5 h-3.5" />
                  {customer.phone}
                </a>
              )}
            </div>
          </div>

          {/* Счётчики */}
          <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-gray-100">
            {[
              { label: 'Активных', value: activeAppointments.length, color: 'text-indigo-600', bg: 'bg-indigo-50' },
              { label: 'Завершённых', value: archivedAppointments.length, color: 'text-gray-500', bg: 'bg-gray-100' },
              { label: 'Автомобилей', value: vehicles?.length ?? 0, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            ].map(({ label, value, color, bg }) => (
              <div key={label} className={`${bg} rounded-xl p-3 text-center`}>
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Автомобили */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-4 overflow-hidden">
          <button onClick={() => setVehiclesOpen(v => !v)}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center">
                <Car className="w-4 h-4 text-emerald-600" strokeWidth={1.5} />
              </div>
              <span className="text-sm font-bold text-gray-800">Автомобили</span>
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-semibold">{vehicles?.length ?? 0}</span>
            </div>
            {vehiclesOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>

          {vehiclesOpen && (
            <div className="border-t border-gray-100">
              {vehicles && vehicles.length > 0 ? vehicles.map((v, i) => (
                <div key={v.id} className={`flex items-center gap-4 px-5 py-3.5 ${i < vehicles.length - 1 ? 'border-b border-gray-100' : ''}`}>
                  <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <Car className="w-4 h-4 text-gray-500" strokeWidth={1.5} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">
                      {v.brand} {v.model}
                      {v.year && <span className="text-gray-400 font-normal"> · {v.year}</span>}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {v.license_plate && <span className="text-xs font-mono font-semibold text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">{v.license_plate}</span>}
                      {v.color && <span className="text-xs text-gray-400">{v.color}</span>}
                    </div>
                  </div>
                </div>
              )) : (
                <div className="px-5 py-6 text-center text-sm text-gray-400">Автомобили не добавлены</div>
              )}
            </div>
          )}
        </div>

        {/* Активные заявки */}
        {activeAppointments.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-3 px-1">
              <div className="w-2 h-2 rounded-full bg-indigo-500" />
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Активные заявки · {activeAppointments.length}</h2>
            </div>
            <div className="space-y-3">
              {activeAppointments.map(a => <AppointmentCard key={a.id} appointment={a} />)}
            </div>
          </div>
        )}

        {/* Архив */}
        {archivedAppointments.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-3 px-1">
              <div className="w-2 h-2 rounded-full bg-gray-400" />
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide">История · {archivedAppointments.length}</h2>
            </div>
            <div className="space-y-3">
              {archivedAppointments.map(a => <AppointmentCard key={a.id} appointment={a} />)}
            </div>
          </div>
        )}

        {/* Нет заявок */}
        {activeAppointments.length === 0 && archivedAppointments.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center mb-4">
            <CheckCircle className="w-10 h-10 text-gray-200 mx-auto mb-3" strokeWidth={1.5} />
            <p className="text-sm font-medium text-gray-500">Заявок пока нет</p>
          </div>
        )}

        {/* Заказы запчастей */}
        {partsOrders && partsOrders.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-3 px-1">
              <div className="w-2 h-2 rounded-full bg-orange-400" />
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Заказы запчастей · {partsOrders.length}</h2>
            </div>
            <div className="space-y-3">
              {partsOrders.map((order) => (
                <div key={order.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${getPartsOrderStatusColor(order.status)}`}>
                      {getPartsOrderStatusText(order.status)}
                    </span>
                    <span className="text-base font-bold text-gray-900">{formatCurrency(order.total_amount)}</span>
                  </div>
                  {order.items?.map((item: any) => (
                    <div key={item.id} className="flex justify-between text-sm py-1.5 border-b border-gray-100 last:border-0">
                      <span className="text-gray-700 truncate mr-2">{item.inventory_item?.name || 'Запчасть'}</span>
                      <span className="text-gray-400 flex-shrink-0">{item.quantity} шт</span>
                    </div>
                  ))}
                  <p className="text-xs text-gray-400 mt-2.5 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(order.order_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-center text-xs text-gray-400 pt-2">Страница обновляется в реальном времени</p>
      </div>
    </div>
  )
}

function AppointmentCard({ appointment }: { appointment: any }) {
  const hasPayment = (appointment.parts_cost || appointment.total_parts_cost || 0) > 0 || (appointment.total_work_cost || 0) > 0
  const totalCost = (appointment.parts_cost || appointment.total_parts_cost || 0) + (appointment.total_work_cost || 0)
  const isActive = ACTIVE_STATUSES.has(appointment.status)

  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${isActive ? 'border-indigo-200' : 'border-gray-100'}`}>
      {/* Хедер */}
      <div className={`px-5 py-3.5 flex items-center justify-between gap-3 ${isActive ? 'bg-indigo-50/50' : ''}`}>
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${isActive ? 'bg-indigo-100' : 'bg-gray-100'}`}>
            <Wrench className={`w-4 h-4 ${isActive ? 'text-indigo-600' : 'text-gray-500'}`} strokeWidth={1.5} />
          </div>
          <div className="min-w-0">
            {appointment.vehicles && (
              <p className="text-sm font-bold text-gray-900 truncate">
                {appointment.vehicles.brand} {appointment.vehicles.model}
              </p>
            )}
            {appointment.vehicles?.license_plate && (
              <p className="text-xs font-mono text-gray-400">{appointment.vehicles.license_plate}</p>
            )}
          </div>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${getAppointmentStatusColor(appointment.status)}`}>
          {getAppointmentStatusText(appointment.status)}
        </span>
      </div>

      {/* Описание */}
      {appointment.description && (
        <div className="px-5 py-3 border-t border-gray-100">
          <p className="text-sm text-gray-700 leading-relaxed">{appointment.description}</p>
        </div>
      )}

      {/* Оплата + дата */}
      <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between gap-3">
        <span className="flex items-center gap-1 text-xs text-gray-400">
          <Clock className="w-3.5 h-3.5" />
          {new Date(appointment.scheduled_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
        {hasPayment && (
          <div className="flex items-center gap-3 text-xs">
            {(appointment.parts_cost || 0) > 0 && (
              <span className={appointment.parts_paid ? 'text-emerald-600 font-medium' : 'text-red-500'}>
                {appointment.parts_paid ? '✓ Запчасти' : '✗ Запчасти'}
              </span>
            )}
            {(appointment.total_work_cost || 0) > 0 && (
              <span className={appointment.work_paid ? 'text-emerald-600 font-medium' : 'text-red-500'}>
                {appointment.work_paid ? '✓ Работы' : '✗ Работы'}
              </span>
            )}
            {totalCost > 0 && (
              <span className="font-bold text-gray-700 flex items-center gap-0.5">
                <DollarSign className="w-3 h-3" />
                {formatCurrency(totalCost)}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
