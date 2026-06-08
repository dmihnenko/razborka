import React from 'react'
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom'
import { Spinner } from '@/components/ui/Spinner'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useUserProfile } from '@/hooks/useUserProfile'
import {
  ArrowLeft, ArrowRight, Calendar, User, Car, Phone, FileText,
  Package, Wrench, DollarSign, UserCog, History,
  CheckCircle2, Clock, Archive, Trash2,
  AlertTriangle, Pencil, Check, X,
} from 'lucide-react'
import AppointmentModal from '@/components/appointments/AppointmentModal'
import ReassignWorkerModal from '@/components/appointments/ReassignWorkerModal'
import AppointmentComments from '@/components/appointments/AppointmentComments'
import { toast } from 'sonner'
import { STATUS_CFG, STATUS_FLOW } from '@/constants/appointmentStatus'
import { fmtMoney } from '@/utils/money'

// Заголовок/описание подтверждения для конкретного перехода статуса
const TRANSITION_META: Record<string, { title: string; description: string; confirm: string }> = {
  'scheduled→in_progress':   { title: 'Начать работу?',       description: 'Заявка перейдёт в статус «В работе».', confirm: 'Начать работу' },
  'in_progress→completed':   { title: 'Завершить работу?',    description: 'Работы завершены, автомобиль готов к выдаче клиенту.', confirm: 'Отметить готовым' },
  'completed→in_progress':   { title: 'Вернуть в работу?',    description: 'Заявка вернётся в статус «В работе».', confirm: 'Вернуть в работу' },
  'in_progress→scheduled':   { title: 'Вернуть в план?',      description: 'Заявка вернётся в статус «Запланирована».', confirm: 'Вернуть в план' },
  'pending_deletion':        { title: 'Запросить удаление?',  description: 'Будет отправлен запрос на удаление заявки. Владелец СТО подтвердит или отклонит его.', confirm: 'Запросить удаление' },
}
function getTransitionMeta(from: string, to: string) {
  return TRANSITION_META[`${from}→${to}`] ?? TRANSITION_META[to] ?? {
    title:       'Изменить статус?',
    description: `Статус заявки будет изменён на «${STATUS_CFG[to]?.label ?? to}».`,
    confirm:     STATUS_CFG[to]?.label ?? 'Подтвердить',
  }
}

function StatusChip({ status, size = 'md' }: { status: string; size?: 'sm' | 'md' }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.archived
  const Icon = cfg.icon || Clock
  const sm = size === 'sm'
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-semibold rounded-md border ${sm ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1'}`}
      style={{ color: cfg.color, backgroundColor: cfg.bg, borderColor: cfg.border }}
    >
      <Icon className={sm ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      {cfg.label}
    </span>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AppointmentDetails() {
  const { appointmentId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [showStatusDropdown, setShowStatusDropdown] = useState(false) // kept for compat
  const [paymentConfirmModal, setPaymentConfirmModal] = useState<{
    isOpen: boolean; type: 'parts' | 'work'; currentValue: boolean
  } | null>(null)
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false)
  const [statusConfirm, setStatusConfirm] = useState<string | null>(null)
  const [reassignModal, setReassignModal] = useState<{
    isOpen: boolean; appointmentId: string; currentWorkerId: string | null
    customerName: string; vehicleName: string
  } | null>(null)
  const { data: profile } = useUserProfile()
  const isStoOwner = profile?.roles?.some((r: any) => r.name === 'sto_owner')

  const { data: workersCount = 0 } = useQuery({
    queryKey: ['sto_workers_count', profile?.sto_company_id],
    queryFn: async () => {
      const { data: workerRole } = await supabase.from('roles').select('id').eq('name', 'sto_worker').single()
      if (!workerRole) return 0
      const { data: userRoles } = await supabase.from('user_roles').select('user_id').eq('role_id', workerRole.id)
      if (!userRoles) return 0
      const { count } = await supabase.from('user_profiles').select('id', { count: 'exact', head: true })
        .eq('sto_company_id', profile?.sto_company_id).eq('is_active', true)
        .in('id', userRoles.map(ur => ur.user_id))
      return count || 0
    },
    enabled: !!profile?.sto_company_id && !!isStoOwner,
  })

  const { data: appointment, isLoading } = useQuery({
    queryKey: ['appointment', appointmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select(`*, customers(name, phone), vehicles(brand, model, license_plate, vin),
          appointment_parts(id, description, quantity, store_cost, client_cost, created_at),
          appointment_services(id, description, cost, created_at),
          created_by_profile:user_profiles!created_by(full_name, email),
          assigned_to_profile:user_profiles!assigned_to(full_name, email)`)
        .eq('id', appointmentId).single()
      if (error) throw error
      return data
    },
    enabled: !!appointmentId,
  })

  const { data: vehicleHistory = [] } = useQuery({
    queryKey: ['vehicle-service-history', appointment?.vehicle_id, appointmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select('id, scheduled_date, status, total_work_cost, total_parts_cost, total_cost, work_items, part_items')
        .eq('vehicle_id', appointment!.vehicle_id).neq('id', appointmentId!)
        .not('status', 'in', '("deleted","pending_deletion")')
        .order('scheduled_date', { ascending: false }).limit(20)
      if (error) throw error
      return data
    },
    enabled: !!appointment?.vehicle_id,
  })

  const updatePaymentMutation = useMutation({
    mutationFn: async ({ type, value }: { type: 'parts' | 'work'; value: boolean }) => {
      const field = type === 'parts' ? 'parts_paid' : 'work_paid'
      const { data: current } = await supabase.from('appointments')
        .select('parts_paid, work_paid, parts_cost, total_parts_cost, total_work_cost, status')
        .eq('id', appointmentId).single()
      if (!current) throw new Error('Appointment not found')
      const updatedData: any = { [field]: value }
      const hasParts = ((current.parts_cost || current.total_parts_cost) || 0) > 0
      const hasWork = (current.total_work_cost || 0) > 0
      const willBePartsPaid = type === 'parts' ? value : current.parts_paid
      const willBeWorkPaid = type === 'work' ? value : current.work_paid
      const shouldArchive = (current.status === 'completed' || current.status === 'ready')
        && (!hasParts || willBePartsPaid) && (!hasWork || willBeWorkPaid)
      if (shouldArchive) {
        updatedData.status = 'archived'
        updatedData.closed_date = new Date().toISOString()
        if (!hasParts) updatedData.parts_paid = true
        if (!hasWork) updatedData.work_paid = true
      }
      const { error } = await supabase.from('appointments').update(updatedData).eq('id', appointmentId)
      if (error) throw error
      return { archived: shouldArchive }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['appointment', appointmentId] })
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-monthly-revenue'] })
      toast.success(result.archived ? 'Оплата подтверждена. Заявка отправлена в архив' : 'Статус оплаты обновлён')
    },
    onError: () => toast.error('Ошибка при обновлении статуса оплаты'),
  })

  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      const isUnarchiving = appointment?.status === 'archived'
      const isArchiving = status === 'archived'
      const updateData: any = { status }
      if (isUnarchiving) { updateData.closed_date = null; updateData.parts_paid = false; updateData.work_paid = false }
      if (isArchiving) {
        const hasParts = ((appointment?.parts_cost || appointment?.total_parts_cost) || 0) > 0
        const hasWork = (appointment?.total_work_cost || 0) > 0
        // Архивировать можно только при полной оплате
        if ((hasParts && !appointment?.parts_paid) || (hasWork && !appointment?.work_paid)) {
          throw new Error('В архив можно перенести только после полной оплаты работ и запчастей')
        }
        updateData.closed_date = new Date().toISOString()
        if (!hasParts) updateData.parts_paid = true
        if (!hasWork) updateData.work_paid = true
      }
      const { error } = await supabase.from('appointments').update(updateData).eq('id', appointmentId).select()
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointment', appointmentId] })
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-monthly-revenue'] })
      toast.success('Статус обновлён')
      setShowStatusDropdown(false)
    },
    onError: (e: any) => toast.error(`Ошибка: ${e.message || 'Неизвестная ошибка'}`),
  })

  const updateExcludeMutation = useMutation({
    mutationFn: async (value: boolean) => {
      const { error } = await supabase.from('appointments').update({ exclude_from_stats: value }).eq('id', appointmentId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointment', appointmentId] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-monthly-revenue'] })
      toast.success(appointment?.exclude_from_stats ? 'Включена в статистику' : 'Исключена из статистики')
    },
    onError: () => toast.error('Ошибка при обновлении'),
  })

  const handleStatusChange = (newStatus: string) => {
    setShowStatusDropdown(false)
    if (newStatus === 'archived') {
      // В архив — только при полной оплате работ и запчастей
      const needParts = partsCost > 0 && !appointment?.parts_paid
      const needWork  = workCost  > 0 && !appointment?.work_paid
      if (needParts || needWork) {
        toast.error('В архив можно перенести только после полной оплаты работ и запчастей')
        return
      }
      setShowArchiveConfirm(true)
      return
    }
    setStatusConfirm(newStatus)
  }

  const availableStatuses = appointment?.status === 'archived'
    ? (isStoOwner ? [{ value: 'in_progress', label: 'В работе' }, { value: 'completed', label: 'Готова' }] : [])
    : appointment?.status === 'pending_deletion'
    ? (isStoOwner ? [{ value: 'in_progress', label: 'Отклонить удаление' }] : [])
    : [
        { value: 'scheduled', label: 'Запланирована' },
        { value: 'in_progress', label: 'В работе' },
        { value: 'completed', label: 'Готова' },
        ...(!isStoOwner ? [{ value: 'pending_deletion', label: 'Запрос на удаление' }] : []),
        ...(isStoOwner ? [{ value: 'archived', label: 'В архив' }] : []),
      ]

  // ── Derived values ──────────────────────────────────────────────────────────

  const hasOldParts = appointment?.appointment_parts?.length > 0
  const hasNewParts = appointment?.part_items?.length > 0
  const hasParts = hasOldParts || hasNewParts
  const partsCost = appointment?.parts_cost || appointment?.total_parts_cost
    || (hasOldParts ? appointment.appointment_parts.reduce((s: number, p: any) => s + (p.store_cost || 0) * (p.quantity || 1), 0) : 0)
    || (hasNewParts ? appointment?.part_items.reduce((s: number, p: any) => s + (p.totalPrice || 0), 0) : 0) || 0

  const hasOldServices = appointment?.appointment_services?.length > 0
  const hasNewServices = appointment?.work_items?.length > 0
  const hasWork = hasOldServices || hasNewServices
  const workCost = appointment?.total_work_cost
    || (hasOldServices ? appointment.appointment_services.reduce((s: number, sv: any) => s + (sv.cost || 0), 0) : 0)
    || (hasNewServices ? appointment?.work_items.reduce((s: number, w: any) => s + (w.price || 0), 0) : 0) || 0

  const totalCost = partsCost + workCost

  const workerName = appointment?.assigned_to_name
    || appointment?.assigned_to_profile?.full_name
    || appointment?.assigned_to_profile?.email

  const shortId = appointmentId ? `#${appointmentId.slice(-6).toUpperCase()}` : ''

  // ── Loading / not found ─────────────────────────────────────────────────────

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Spinner size="lg" />
    </div>
  )

  if (!appointment) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-8">
      <FileText className="w-12 h-12 text-gray-300" />
      <p className="text-gray-500 font-medium">Заявка не найдена</p>
      <button onClick={() => navigate('/appointments')} className="text-primary text-sm hover:underline">
        Вернуться к списку
      </button>
    </div>
  )

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Sticky page header ─────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
        <div className="w-full px-3 sm:px-6 min-h-14 py-2 sm:py-0 flex flex-wrap items-center gap-x-3 gap-y-2">
          {/* Back */}
          <button
            onClick={() => location.state?.from ? navigate(location.state.from) : navigate(-1)}
            className="flex items-center gap-1.5 text-gray-500 hover:text-gray-900 transition-colors flex-shrink-0 -ml-1 p-1 rounded-lg hover:bg-gray-100"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="hidden sm:inline text-sm font-medium">Назад</span>
          </button>

          {/* Title */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-bold text-gray-900 text-sm sm:text-base truncate">
                {appointment.customers?.name || 'Заявка'}
              </span>
              <span className="text-xs text-gray-400 font-mono flex-shrink-0 hidden sm:block">{shortId}</span>
            </div>
            <p className="text-xs text-gray-400 leading-none mt-0.5">
              {new Date(appointment.created_at).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
          </div>

          {/* Status flow — на мобиле отдельной строкой во всю ширину со скроллом */}
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none w-full sm:w-auto order-last sm:order-none min-w-0">
            {STATUS_FLOW.map(s => {
              const scfg  = STATUS_CFG[s]
              const isActive = appointment.status === s || (s === 'completed' && appointment.status === 'ready')
              const canClick = !isActive && availableStatuses.some(a => a.value === s)
              return (
                <button
                  key={s}
                  onClick={() => canClick && handleStatusChange(s)}
                  disabled={!canClick}
                  className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-all
                    ${isActive ? 'shadow-sm' : canClick ? 'hover:opacity-80 cursor-pointer' : 'opacity-35 cursor-default'}`}
                  style={isActive
                    ? { color: '#fff', backgroundColor: scfg.color, borderColor: scfg.color }
                    : { color: scfg.color, backgroundColor: scfg.bg, borderColor: scfg.border }
                  }
                >
                  {React.createElement(scfg.icon || Clock, {
                    className: 'w-3 h-3 flex-shrink-0 hidden sm:block',
                  })}
                  <span className="whitespace-nowrap">{scfg.label}</span>
                </button>
              )
            })}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {isStoOwner && workersCount > 1 && (
              <button
                onClick={() => setReassignModal({
                  isOpen: true, appointmentId: appointment.id,
                  currentWorkerId: appointment.assigned_to,
                  customerName: appointment.customers?.name || '',
                  vehicleName: `${appointment.vehicles?.brand || ''} ${appointment.vehicles?.model || ''}`.trim(),
                })}
                className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                title="Переназначить работника"
              >
                <UserCog className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => {
                // Десктоп — редактирование на отдельной странице; мобайл — модалка (bottom-sheet)
                if (window.matchMedia('(min-width: 1024px)').matches) {
                  navigate(`/sto/appointments/${appointment.id}/edit`)
                } else {
                  setIsEditModalOpen(true)
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Изменить</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Page body ──────────────────────────────────────────────────────── */}
      <div className="w-full px-3 sm:px-6 py-4 sm:py-6 space-y-4">

        {/* ── Customer + vehicle hero ──────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:divide-x divide-gray-100">
            {/* Customer */}
            <div className="flex items-start gap-3 p-4 sm:p-5 flex-1">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: 'rgba(37,99,235,0.1)' }}>
                <User className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-400 mb-1">Клиент</p>
                <p className="text-sm font-semibold text-gray-900 leading-tight">{appointment.customers?.name || '—'}</p>
                {appointment.customers?.phone && (
                  <a href={`tel:${appointment.customers.phone}`}
                    className="text-sm text-primary hover:underline flex items-center gap-1 mt-1">
                    <Phone className="w-3 h-3" />{appointment.customers.phone}
                  </a>
                )}
              </div>
            </div>

            {/* Vehicle */}
            <div className="flex items-start gap-3 p-4 sm:p-5 flex-1 border-t sm:border-t-0 border-gray-100">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: 'rgba(217,119,6,0.1)' }}>
                <Car className="w-5 h-5 text-amber-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-400 mb-1">Автомобиль</p>
                <p className="text-sm font-semibold text-gray-900 leading-tight">
                  {appointment.vehicles?.brand} {appointment.vehicles?.model}
                </p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                  {appointment.vehicles?.license_plate && (
                    <span className="text-xs font-mono bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                      {appointment.vehicles.license_plate}
                    </span>
                  )}
                  {appointment.vehicles?.vin && (
                    <button
                      onClick={() => { navigator.clipboard.writeText(appointment.vehicles.vin); toast.success('VIN скопирован', { duration: 1200 }) }}
                      className="text-xs font-mono text-gray-400 hover:text-primary transition-colors truncate max-w-[140px]"
                      title="Нажмите чтобы скопировать"
                    >
                      {appointment.vehicles.vin}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Date + worker compact */}
            <div className="flex flex-row sm:flex-col justify-start sm:justify-start gap-6 sm:gap-4 p-4 sm:p-5 sm:w-44 border-t sm:border-t-0 border-gray-100">
              <div>
                <p className="text-xs font-medium text-gray-400 mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3 flex-shrink-0" />
                  <span>Запись</span>
                </p>
                <p className="text-sm font-semibold text-gray-800 leading-tight">
                  {new Date(appointment.scheduled_date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </p>
                {appointment.scheduled_time && (
                  <p className="text-xs text-gray-500 mt-0.5">{appointment.scheduled_time}</p>
                )}
              </div>
              {workerName && (
                <div>
                  <p className="text-xs font-medium text-gray-400 mb-1 flex items-center gap-1">
                    <UserCog className="w-3 h-3 flex-shrink-0" />
                    <span>Работник</span>
                  </p>
                  <p className="text-sm font-semibold text-gray-800 leading-tight truncate">{workerName}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Main grid ────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Left column — works, parts, comments */}
          <div className="lg:col-span-2 space-y-4">

            {/* Works */}
            {hasWork && (
              <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="flex items-center gap-2.5 px-4 sm:px-5 py-3.5 border-b border-gray-100">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(124,58,237,0.1)' }}>
                    <Wrench className="w-4 h-4 text-violet-600" />
                  </div>
                  <h2 className="font-semibold text-gray-900 text-sm sm:text-base">Работы</h2>
                  {(hasOldServices || hasNewServices) && (
                    <span className="ml-1 text-xs text-gray-400">
                      {(appointment.appointment_services?.length || 0) + (appointment.work_items?.length || 0)} позиций
                    </span>
                  )}
                </div>
                <div className="divide-y divide-gray-50">
                  {hasOldServices && appointment.appointment_services.map((s: any) => (
                    <div key={s.id} className="flex items-start justify-between px-4 sm:px-5 py-3.5 gap-4">
                      <p className="text-sm text-gray-800 flex-1 leading-snug">{s.description}</p>
                      {s.cost > 0 && <span className="text-sm font-semibold text-gray-900 flex-shrink-0 tabular-nums">₴{s.cost.toLocaleString()}</span>}
                    </div>
                  ))}
                  {hasNewServices && appointment.work_items.map((w: any, i: number) => (
                    <div key={i} className="flex items-start justify-between px-4 sm:px-5 py-3.5 gap-4">
                      <p className="text-sm text-gray-800 flex-1 leading-snug">{w.name}</p>
                      <span className="text-sm font-semibold text-gray-900 flex-shrink-0 tabular-nums">₴{Number(w.price).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
                {workCost > 0 && (
                  <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-t border-gray-100 bg-gray-50/60">
                    <span className="text-sm font-medium text-gray-500">Итого работы</span>
                    <span className="text-sm font-bold text-gray-900 tabular-nums">₴{workCost.toLocaleString()}</span>
                  </div>
                )}
              </section>
            )}

            {/* Parts */}
            {hasParts && (
              <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="flex items-center gap-2.5 px-4 sm:px-5 py-3.5 border-b border-gray-100">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(22,163,74,0.1)' }}>
                    <Package className="w-4 h-4 text-green-600" />
                  </div>
                  <h2 className="font-semibold text-gray-900 text-sm sm:text-base">Запчасти</h2>
                  {(hasOldParts || hasNewParts) && (
                    <span className="ml-1 text-xs text-gray-400">
                      {(appointment.appointment_parts?.length || 0) + (appointment.part_items?.length || 0)} позиций
                    </span>
                  )}
                </div>
                <div className="divide-y divide-gray-50">
                  {hasOldParts && appointment.appointment_parts.map((p: any) => (
                    <div key={p.id} className="flex items-start justify-between px-4 sm:px-5 py-3.5 gap-4">
                      <p className="text-sm text-gray-800 flex-1 leading-snug">{p.description}</p>
                      {p.store_cost > 0 && (
                        <span className="text-sm font-semibold text-gray-900 flex-shrink-0 tabular-nums">
                          ₴{(p.store_cost * (p.quantity || 1)).toLocaleString()}
                        </span>
                      )}
                    </div>
                  ))}
                  {hasNewParts && appointment.part_items.map((p: any, i: number) => (
                    <div key={i} className="flex items-start justify-between px-4 sm:px-5 py-3.5 gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800 leading-snug">{p.name}</p>
                        {p.quantity > 1 && <p className="text-xs text-gray-400 mt-0.5">{p.quantity} шт.</p>}
                      </div>
                      <span className="text-sm font-semibold text-gray-900 flex-shrink-0 tabular-nums">₴{Number(p.totalPrice).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
                {partsCost > 0 && (
                  <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-t border-gray-100 bg-gray-50/60">
                    <span className="text-sm font-medium text-gray-500">Итого запчасти</span>
                    <span className="text-sm font-bold text-gray-900 tabular-nums">₴{partsCost.toLocaleString()}</span>
                  </div>
                )}
              </section>
            )}

            {/* Comments */}
            <AppointmentComments appointmentId={appointment.id} stoCompanyId={appointment.sto_company_id} />
          </div>

          {/* Right sidebar */}
          <div className="space-y-4">

            {/* Payment card */}
            {(hasParts || hasWork) && (
              <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="flex items-center gap-2.5 px-4 sm:px-5 py-3.5 border-b border-gray-100">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(37,99,235,0.1)' }}>
                    <DollarSign className="w-4 h-4 text-primary" />
                  </div>
                  <h2 className="font-semibold text-gray-900">Оплата</h2>
                </div>

                <div className="p-4 sm:p-5 space-y-3">
                  {/* Parts payment row */}
                  {hasParts && partsCost > 0 && (
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-700 leading-tight">Запчасти</p>
                        <p className="text-xs text-gray-400 mt-0.5 tabular-nums">₴{partsCost.toLocaleString()}</p>
                      </div>
                      {isStoOwner ? (
                        <button
                          onClick={() => setPaymentConfirmModal({ isOpen: true, type: 'parts', currentValue: appointment.parts_paid })}
                          disabled={updatePaymentMutation.isPending}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex-shrink-0 ${
                            appointment.parts_paid
                              ? 'bg-green-100 text-green-700 hover:bg-green-200'
                              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                          {appointment.parts_paid ? 'Оплачено' : 'Не оплачено'}
                        </button>
                      ) : (
                        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg flex-shrink-0 ${appointment.parts_paid ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-600'}`}>
                          <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                          {appointment.parts_paid ? 'Оплачено' : 'Не оплачено'}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Work payment row */}
                  {hasWork && workCost > 0 && (
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-700 leading-tight">Работы</p>
                        <p className="text-xs text-gray-400 mt-0.5 tabular-nums">₴{workCost.toLocaleString()}</p>
                      </div>
                      {isStoOwner ? (
                        <button
                          onClick={() => setPaymentConfirmModal({ isOpen: true, type: 'work', currentValue: appointment.work_paid })}
                          disabled={updatePaymentMutation.isPending}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex-shrink-0 ${
                            appointment.work_paid
                              ? 'bg-green-100 text-green-700 hover:bg-green-200'
                              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                          {appointment.work_paid ? 'Оплачено' : 'Не оплачено'}
                        </button>
                      ) : (
                        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg flex-shrink-0 ${appointment.work_paid ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-600'}`}>
                          <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                          {appointment.work_paid ? 'Оплачено' : 'Не оплачено'}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Total */}
                  {totalCost > 0 && (
                    <div className="pt-3 border-t border-gray-100">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-semibold text-gray-700">Итого</span>
                        <span className="text-2xl font-bold text-primary tabular-nums" style={{ letterSpacing: '-0.02em' }}>
                          ₴{totalCost.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Vehicle history */}
            {vehicleHistory.length > 0 && (
              <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="flex items-center gap-2.5 px-4 sm:px-5 py-3.5 border-b border-gray-100">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(100,116,139,0.1)' }}>
                    <History className="w-4 h-4 text-slate-500" />
                  </div>
                  <h2 className="font-semibold text-gray-900">История авто</h2>
                  <span className="text-xs text-gray-400">{vehicleHistory.length}</span>
                </div>
                <div className="divide-y divide-gray-50">
                  {(vehicleHistory as any[]).map((h) => {
                    const cfg = STATUS_CFG[h.status] || STATUS_CFG.archived
                    const total = h.total_cost || (h.total_work_cost || 0) + (h.total_parts_cost || 0)
                    return (
                      <Link key={h.id} to={`/sto/appointments/${h.id}`}
                        className="flex items-center gap-3 px-4 sm:px-5 py-3 hover:bg-gray-50 transition-colors group">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                            {new Date(h.scheduled_date).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs px-1.5 py-0.5 rounded-md font-medium" style={{ color: cfg.color, backgroundColor: cfg.bg }}>
                              {cfg.label}
                            </span>
                            {((h.work_items?.length || 0) + (h.part_items?.length || 0)) > 0 && (
                              <span className="text-xs text-gray-400">
                                {h.work_items?.length > 0 && `${h.work_items.length} раб.`}
                                {h.work_items?.length > 0 && h.part_items?.length > 0 && ' · '}
                                {h.part_items?.length > 0 && `${h.part_items.length} зап.`}
                              </span>
                            )}
                          </div>
                        </div>
                        {total > 0 && (
                          <span className="text-sm font-bold text-gray-700 flex-shrink-0">₴{Math.round(total).toLocaleString()}</span>
                        )}
                      </Link>
                    )
                  })}
                </div>
              </section>
            )}

            {/* Exclude from stats */}
            {isStoOwner && appointment.status === 'archived' && (
              <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
                <label className="flex items-start gap-3 cursor-pointer group">
                  <div className="relative mt-0.5 flex-shrink-0">
                    <input type="checkbox" checked={!!appointment.exclude_from_stats}
                      onChange={() => updateExcludeMutation.mutate(!appointment.exclude_from_stats)}
                      className="sr-only peer" />
                    <div className="w-5 h-5 border-2 rounded border-gray-300 peer-checked:bg-orange-500 peer-checked:border-orange-500 transition-all flex items-center justify-center">
                      {appointment.exclude_from_stats && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Исключить из статистики</p>
                    <p className="text-xs text-gray-400 mt-0.5">Не учитывать в отчётах за месяц</p>
                  </div>
                </label>
              </section>
            )}

            {/* Ready for pickup */}
            {appointment.ready_for_pickup && (
              <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-2xl text-sm font-medium text-green-700">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                Готово к выдаче
              </div>
            )}

            {/* Pending deletion (owner) */}
            {isStoOwner && appointment.status === 'pending_deletion' && (
              <section className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 sm:p-5">
                <div className="flex items-start gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-red-900">Работник запросил удаление</p>
                    <p className="text-xs text-red-600 mt-0.5">Действие необратимо</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => updateStatusMutation.mutate('deleted')}
                    disabled={updateStatusMutation.isPending}
                    className="flex-1 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors">
                    Удалить
                  </button>
                  <button onClick={() => updateStatusMutation.mutate('in_progress')}
                    disabled={updateStatusMutation.isPending}
                    className="flex-1 py-2 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 transition-colors">
                    Отклонить
                  </button>
                </div>
              </section>
            )}

          </div>
        </div>
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────────── */}

      <AppointmentModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} appointmentId={appointment.id} />

      {reassignModal && (
        <ReassignWorkerModal isOpen={reassignModal.isOpen} onClose={() => setReassignModal(null)}
          appointmentId={reassignModal.appointmentId} currentWorkerId={reassignModal.currentWorkerId}
          appointmentInfo={{ customerName: reassignModal.customerName, vehicleName: reassignModal.vehicleName }}
        />
      )}

      {/* Archive confirm */}
      {showArchiveConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                <Archive className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Перенести в архив?</h3>
                <p className="text-sm text-gray-500 mt-1">Заявка попадёт в статистику месяца. Вернуть из архива можно позже.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowArchiveConfirm(false)}
                className="flex-1 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                Отмена
              </button>
              <button onClick={() => { updateStatusMutation.mutate('archived'); setShowArchiveConfirm(false) }}
                disabled={updateStatusMutation.isPending}
                className="flex-1 py-2.5 text-sm font-medium text-white bg-gray-800 hover:bg-gray-900 rounded-lg disabled:opacity-50 transition-colors">
                {updateStatusMutation.isPending ? 'Обновление...' : 'В архив'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status change confirm */}
      {statusConfirm && (() => {
        const fromCfg = STATUS_CFG[appointment.status] ?? STATUS_CFG.scheduled
        const toCfg   = STATUS_CFG[statusConfirm] ?? STATUS_CFG.scheduled
        const meta    = getTransitionMeta(appointment.status, statusConfirm)
        return (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
            <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden">
              <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3 mb-1 sm:hidden" />

              <div className="px-5 pt-4 pb-3 border-b border-gray-100">
                <h3 className="text-base font-bold text-gray-900">{meta.title}</h3>
              </div>

              <div className="px-5 py-4 space-y-4">
                {/* Клиент / авто */}
                <div className="bg-gray-50 rounded-lg px-3.5 py-2.5">
                  <p className="text-sm font-semibold text-gray-900 leading-tight">
                    {appointment.customers?.name || 'Клиент не указан'}
                  </p>
                  {appointment.vehicles && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      {appointment.vehicles.brand} {appointment.vehicles.model}
                    </p>
                  )}
                </div>

                {/* Переход статуса */}
                <div className="flex items-center gap-2">
                  <span className="flex-1 text-center text-xs font-semibold px-3 py-2 rounded-lg border"
                    style={{ color: fromCfg.color, backgroundColor: fromCfg.bg, borderColor: fromCfg.border }}>
                    {fromCfg.label}
                  </span>
                  <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="flex-1 text-center text-xs font-semibold px-3 py-2 rounded-lg border"
                    style={{ color: toCfg.color, backgroundColor: toCfg.bg, borderColor: toCfg.border }}>
                    {toCfg.label}
                  </span>
                </div>

                <p className="text-sm text-gray-600 leading-relaxed">{meta.description}</p>
              </div>

              <div className="px-5 pb-5 flex gap-2" style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))' }}>
                <button onClick={() => setStatusConfirm(null)} disabled={updateStatusMutation.isPending}
                  className="flex-1 py-2.5 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50">
                  Отмена
                </button>
                <button
                  onClick={() => { updateStatusMutation.mutate(statusConfirm); setStatusConfirm(null) }}
                  disabled={updateStatusMutation.isPending}
                  className="flex-1 py-2.5 text-sm font-semibold text-white rounded-lg transition-colors disabled:opacity-50"
                  style={{ backgroundColor: toCfg.color }}>
                  {updateStatusMutation.isPending ? 'Сохраняем…' : meta.confirm}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Payment confirm */}
      {paymentConfirmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${paymentConfirmModal.currentValue ? 'bg-red-100' : 'bg-green-100'}`}>
                <DollarSign className={`w-5 h-5 ${paymentConfirmModal.currentValue ? 'text-red-600' : 'text-green-600'}`} />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Подтверждение оплаты</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {paymentConfirmModal.currentValue
                    ? `Отметить ${paymentConfirmModal.type === 'parts' ? 'запчасти' : 'работы'} как неоплаченные?`
                    : `Отметить ${paymentConfirmModal.type === 'parts' ? 'запчасти' : 'работы'} как оплаченные?`
                  }
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setPaymentConfirmModal(null)}
                className="flex-1 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                Отмена
              </button>
              <button
                onClick={() => {
                  updatePaymentMutation.mutate({ type: paymentConfirmModal.type, value: !paymentConfirmModal.currentValue })
                  setPaymentConfirmModal(null)
                }}
                disabled={updatePaymentMutation.isPending}
                className="flex-1 py-2.5 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg disabled:opacity-50 transition-colors">
                Подтвердить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

