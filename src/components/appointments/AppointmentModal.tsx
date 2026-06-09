import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { X, Check, ChevronLeft, Clock } from 'lucide-react'
import { AppointmentFormValues } from '@/types/appointments'
import { useQueryClient, useMutation, useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useUserProfile } from '@/hooks/useUserProfile'
import { toast } from 'sonner'
import { useBlockScroll } from '@/hooks/useBlockScroll'
import { useConfirm } from '@/hooks/useConfirm'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { moveToTrash } from '@/services/trashService'
import { fetchStoLaborRate } from '@/services/stoService'
import ClientSelector from './ClientSelector'
import VehicleSelector from './VehicleSelector'
import WorkItemsManager from './WorkItemsManager'
import PartItemsManager from './PartItemsManager'
import AppointmentSummary from './AppointmentSummary'
import DateTimePicker from './DateTimePicker'

interface Props {
  isOpen: boolean
  onClose: () => void
  appointmentId?: string
  onSuccess?: (id: string) => void
  prefilledDate?: string // ISO date string YYYY-MM-DD, skips date step
}

function fmtHours(h: number): string {
  return Number.isInteger(h) ? String(h) : h.toFixed(1)
}

// Порядок: Клиент → Авто → Запчасти → Работы → Время и мастер → Итог
const STEPS = [
  { id: 1, name: 'Клиент',   description: 'Выбор клиента' },
  { id: 2, name: 'Авто',     description: 'Выбор транспорта' },
  { id: 3, name: 'Запчасти', description: 'Список запчастей' },
  { id: 4, name: 'Работы',   description: 'Список работ' },
  { id: 5, name: 'Время',    description: 'Нормо-часы, время и мастер' },
  { id: 6, name: 'Итог',     description: 'Проверка и сохранение' },
]

export default function AppointmentModal({ isOpen, onClose, appointmentId, onSuccess, prefilledDate }: Props) {
  const queryClient = useQueryClient()
  const { data: profile } = useUserProfile()
  const { confirm: showConfirm, dialogProps } = useConfirm()
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState<AppointmentFormValues>({
    customer_id: '',
    vehicle_id: '',
    scheduledDate: (() => {
      const now = new Date()
      const pad = (n: number) => String(n).padStart(2, '0')
      return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T09:00`
    })(),
    scheduledEndDate: null,
    status: 'in_progress',
    notes: '',
    workItems: [],
    partItems: [],
    extraHours: 0,
    parts_paid: false,
    work_paid: false,
  })

  useBlockScroll(isOpen)

  // Проверка роли работника
  const isStoWorker = profile?.roles?.some((r: any) => r.name === 'sto_worker')
  const isStoOwner = profile?.roles?.some((r: any) => r.name === 'sto_owner')

  const steps = STEPS

  // Работник (не владелец) при редактировании не видит шаги Клиент/Авто
  const minStep = (isStoWorker && !isStoOwner && appointmentId) ? 3 : 1

  // Ставка нормо-часа компании
  const { data: laborRate = 0 } = useQuery({
    queryKey: ['sto-labor-rate', profile?.sto_company_id],
    queryFn: () => fetchStoLaborRate(profile!.sto_company_id!),
    enabled: !!profile?.sto_company_id && isOpen,
    staleTime: 60_000,
  })

  // Загрузка существующей заявки для редактирования
  const { data: existingAppointment } = useQuery({
    queryKey: ['appointment', appointmentId],
    queryFn: async () => {
      if (!appointmentId) return null
      const { data, error } = await supabase
        .from('appointments')
        .select('*, customers(*), vehicles(*)')
        .eq('id', appointmentId)
        .single()

      if (error) throw error
      return data
    },
    enabled: !!appointmentId && isOpen,
  })

  // Загрузка данных при редактировании
  useEffect(() => {
    if (existingAppointment && appointmentId) {
      // Обработка даты: если Invalid Date, используем created_at или updated_at
      let scheduledDate = existingAppointment.scheduled_date
      if (!scheduledDate || isNaN(new Date(scheduledDate).getTime())) {
        const now = new Date()
        const pad = (n: number) => String(n).padStart(2, '0')
        scheduledDate = existingAppointment.created_at || existingAppointment.updated_at ||
          `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T09:00`
      }
      // Преобразуем в локальный формат datetime-local (без UTC-конвертации)
      const pad = (n: number) => String(n).padStart(2, '0')
      const toLocalISO = (d: Date) =>
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
      // new Date() для строки с зоной (из Supabase) всегда корректен; для строки без зоны — парсим вручную
      const parseLocal = (s: string) => {
        const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/)
        if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] ?? 9), Number(m[5] ?? 0), 0, 0)
        return new Date(s)
      }
      scheduledDate = toLocalISO(new Date(scheduledDate)) // scheduledDate из Supabase содержит TZ → safe
      
      // Восстанавливаем время окончания из duration_minutes
      let scheduledEndDate: string | null = null
      if (existingAppointment.duration_minutes && existingAppointment.duration_minutes > 0) {
        const endDate = parseLocal(scheduledDate) // теперь парсим локальную строку безопасно
        endDate.setMinutes(endDate.getMinutes() + existingAppointment.duration_minutes)
        scheduledEndDate = toLocalISO(endDate)
      }

      setFormData({
        customer_id: existingAppointment.customer_id,
        vehicle_id: existingAppointment.vehicle_id,
        scheduledDate,
        scheduledEndDate,
        status: existingAppointment.status,
        notes: existingAppointment.notes || '',
        workItems: existingAppointment.work_items || [],
        partItems: existingAppointment.part_items || [],
        extraHours: existingAppointment.extra_hours ?? 0,
        selectedClient: existingAppointment.customers,
        selectedVehicle: existingAppointment.vehicles,
        assigned_to: existingAppointment.assigned_to,
        parts_paid: existingAppointment.parts_paid || false,
        work_paid: existingAppointment.work_paid || false,
      })
      // При редактировании начинаем с шага 4 (работы)
      setCurrentStep(4)
    } else {
      // Сбросить форму при создании новой заявки
      const pad = (n: number) => String(n).padStart(2, '0')
      const defaultDate = prefilledDate
        ? `${prefilledDate}T09:00`
        : (() => {
            const now = new Date()
            return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T09:00`
          })()
      setFormData({
        customer_id: '',
        vehicle_id: '',
        scheduledDate: defaultDate,
        scheduledEndDate: null,
        status: 'in_progress',
        notes: '',
        workItems: [],
        partItems: [],
        extraHours: 0,
        parts_paid: false,
        work_paid: false,
      })
      setCurrentStep(1)
    }
  }, [existingAppointment, appointmentId, isOpen, isStoWorker, isStoOwner])

  const createMutation = useMutation({
    mutationFn: async (data: AppointmentFormValues) => {
      // Нормо-часы из каталога + доп. время × ставку; ручные работы — по своей цене
      const extraHours = data.extraHours ?? 0
      const catalogNormHours = data.workItems.reduce((s, i) => s + (i.normHours ?? 0), 0)
      const totalNormHours = catalogNormHours
      const sumWorkPrices = data.workItems.reduce((s, i) => s + (i.price || 0), 0)
      const totalWork = Math.round((sumWorkPrices + extraHours * laborRate) * 100) / 100
      const totalParts = data.partItems.reduce((sum, item) => sum + item.totalPrice, 0)

      if (appointmentId) {
        // Обновление существующей заявки
        const { data: appointment, error } = await supabase
          .from('appointments')
          .update({
            customer_id: data.customer_id,
            vehicle_id: data.vehicle_id,
            scheduled_date: data.scheduledDate,
            status: data.status,
            notes: data.notes || null,
            work_items: data.workItems,
            part_items: data.partItems,
            total_work_cost: totalWork,
            total_parts_cost: totalParts,
            total_cost: totalWork + totalParts,
            extra_hours: extraHours,
            total_norm_hours: totalNormHours,
            labor_rate: laborRate,
            assigned_to: data.assigned_to || null,
            parts_paid: data.parts_paid || false,
            work_paid: data.work_paid || false,
          })
          .eq('id', appointmentId)
          .select()
          .single()

        if (error) {
          console.error('Supabase update error:', error)
          throw error
        }
        return appointment
      } else {
        // Создание новой заявки
        const { data: appointment, error } = await supabase
          .from('appointments')
          .insert({
            customer_id: data.customer_id,
            vehicle_id: data.vehicle_id,
            scheduled_date: data.scheduledDate,
            status: 'in_progress',
            notes: data.notes,
            work_items: data.workItems,
            part_items: data.partItems,
            total_work_cost: totalWork,
            total_parts_cost: totalParts,
            total_cost: totalWork + totalParts,
            extra_hours: extraHours,
            total_norm_hours: totalNormHours,
            labor_rate: laborRate,
            sto_company_id: profile?.sto_company_id,
            created_by: profile?.id,
            assigned_to: data.assigned_to || profile?.id,
            parts_paid: false,
            work_paid: false,
          })
          .select()
          .single()

        if (error) throw error
        return appointment
      }
    },
    onSuccess: (appointment) => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      queryClient.invalidateQueries({ queryKey: ['worker_appointments'] })
      queryClient.invalidateQueries({ queryKey: ['board-kanban'] })
      queryClient.invalidateQueries({ queryKey: ['appts-month'] })
      toast.success(appointmentId ? 'Запись успешно обновлена!' : 'Запись успешно создана!')
      onSuccess?.(appointment.id)
      onClose()
    },
    onError: (error: any) => {
      console.error('Save mutation error:', error)
      console.error('Error details:', JSON.stringify(error, null, 2))
      toast.error(`Ошибка: ${error.message}`)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!appointmentId) throw new Error('No appointment ID')
      
      // Работник помечает заявку как удаленную (статус deleted)
      if (isStoWorker && !isStoOwner) {
        const currentNotes = formData.notes || ''
        const updatedNotes = currentNotes + (currentNotes ? '\n' : '') + '[Работник запросил удаление]'
        
        const { error } = await supabase
          .from('appointments')
          .update({ 
            status: 'deleted',
            notes: updatedNotes
          })
          .eq('id', appointmentId)

        if (error) {
          console.error('Delete mutation error (worker):', error)
          throw error
        }
      } else {
        // Владелец перемещает заявку в корзину
        await moveToTrash({
          entityType: 'appointment',
          entityId: appointmentId,
          entityLabel: `Заявка: ${existingAppointment?.customers?.name || existingAppointment?.customer_id || ''}`,
          entityData: existingAppointment,
          stoCompanyId: profile?.sto_company_id,
        })
        const { error } = await supabase
          .from('appointments')
          .delete()
          .eq('id', appointmentId)

        if (error) {
          console.error('Delete mutation error (owner):', error)
          throw error
        }
      }
    },
    onSuccess: () => {
      // Инвалидируем все queries связанные с appointments
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      queryClient.invalidateQueries({ queryKey: ['worker_appointments'] })
      queryClient.invalidateQueries({ queryKey: ['trash'] })
      // Принудительно рефетчим данные
      queryClient.refetchQueries({ queryKey: ['appointments'] })
      toast.success(
        isStoWorker && !isStoOwner 
          ? 'Заявка отправлена на удаление' 
          : 'Заявка перемещена в корзину'
      )
      onClose()
    },
    onError: (error: any) => {
      toast.error(`Ошибка удаления: ${error.message}`)
    },
  })

  if (!isOpen) return null

  const handleNext = () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > minStep) {
      setCurrentStep(currentStep - 1)
    }
  }

  const canProceed = () => {
    switch (currentStep) {
      case 1: return formData.customer_id !== ''
      case 2: return formData.vehicle_id !== ''
      case 3: case 4: case 5: return true
      default: return false
    }
  }

  const handleDelete = async () => {
    if (!appointmentId) return
    
    const confirmMessage = isStoWorker && !isStoOwner
      ? 'Отправить заявку на удаление? Она будет отправлена владельцу на подтверждение.'
      : 'Вы уверены, что хотите удалить эту заявку?'
    
    const ok = await showConfirm({
      message: confirmMessage,
      confirmText: isStoWorker && !isStoOwner ? 'Отправить' : 'Удалить',
      cancelText: 'Отмена',
      danger: true,
    })
    if (ok) deleteMutation.mutate()
  }

  const progress = ((currentStep - 1) / (steps.length - 1)) * 100
  const stepInfo = steps[currentStep - 1]
  const isLastStep = currentStep === steps.length
  const showBack = currentStep > minStep

  // Нормо-часы и стоимость для финального шага
  const extraHoursVal    = formData.extraHours ?? 0
  const catalogNormHours = formData.workItems.reduce((s, i) => s + (i.normHours ?? 0), 0)
  const billableHours    = catalogNormHours + extraHoursVal
  const sumWorkPricesVal = formData.workItems.reduce((s, i) => s + (i.price || 0), 0)
  const extraCostVal     = Math.round(extraHoursVal * laborRate * 100) / 100
  const totalWorkVal     = Math.round((sumWorkPricesVal + extraCostVal) * 100) / 100

  return (
    <div className="modal-overlay">
      {/* Bottom-sheet mobile / centered dialog desktop */}
      <div className="modal-sheet sm:max-w-xl">

        {/* Ручка (только мобиль) */}
        <div className="modal-handle" />

        {/* ── Шапка ──────────────────────────────────────────────────── */}
        <div className="modal-header">
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-gray-900 leading-tight">
              {appointmentId ? 'Редактировать запись' : 'Новая запись'}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {stepInfo.description} · шаг {currentStep} из {steps.length}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors flex-shrink-0"
            aria-label="Закрыть"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Прогресс шагов ─────────────────────────────────────────── */}
        <div className="px-5 pt-3 pb-2 border-b border-gray-100">
          {/* Полоска */}
          <div className="h-1 bg-gray-100 rounded-sm mb-3 overflow-hidden">
            <div
              className="h-1 bg-primary transition-all duration-300 rounded-sm"
              style={{ width: `${progress}%` }}
            />
          </div>
          {/* Шаги */}
          <div className="flex items-start gap-1">
            {steps.map((step) => {
              const done   = step.id < currentStep
              const active = step.id === currentStep
              const canJump = !!appointmentId && step.id >= minStep
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => canJump && setCurrentStep(step.id)}
                  disabled={!canJump && !active}
                  className="flex-1 flex flex-col items-center gap-1 group"
                >
                  <span
                    className={`w-7 h-7 flex items-center justify-center text-xs font-bold rounded-lg transition-all
                      ${done
                        ? 'bg-green-500 text-white'
                        : active
                          ? 'bg-primary text-white ring-2 ring-primary/20'
                          : 'bg-gray-100 text-gray-400 ' + (canJump ? 'group-hover:bg-gray-200' : '')
                      }`}
                  >
                    {done ? <Check className="w-3.5 h-3.5" /> : step.id}
                  </span>
                  <span
                    className={`text-[10px] font-medium leading-none hidden xs:block
                      ${active ? 'text-primary' : done ? 'text-green-600' : 'text-gray-400'}`}
                  >
                    {step.name}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Тело формы ─────────────────────────────────────────────── */}
        <div className="modal-body">
          {currentStep === 1 && (
            <ClientSelector
              selectedId={formData.customer_id}
              onSelect={(id, customer) => setFormData({ ...formData, customer_id: id, vehicle_id: '', selectedClient: customer })}
            />
          )}

          {currentStep === 2 && (
            <VehicleSelector
              customerId={formData.customer_id}
              selectedId={formData.vehicle_id}
              onSelect={(id, vehicle) => setFormData({ ...formData, vehicle_id: id, selectedVehicle: vehicle })}
            />
          )}

          {currentStep === 3 && (
            <PartItemsManager
              items={formData.partItems}
              onChange={(items) => setFormData({ ...formData, partItems: items })}
            />
          )}

          {currentStep === 4 && (
            <WorkItemsManager
              items={formData.workItems}
              onChange={(items) => setFormData({ ...formData, workItems: items })}
            />
          )}

          {currentStep === 5 && (
            <div className="space-y-4">
              {/* Нормо-часы */}
              <div className="rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-4 h-4 text-violet-500" />
                  <h3 className="text-sm font-bold text-gray-900">Нормо-часы</h3>
                </div>

                {formData.workItems.length === 0 ? (
                  <p className="text-sm text-gray-400">Работы не добавлены — добавьте на шаге «Работы».</p>
                ) : (
                  <div className="space-y-1.5 mb-3">
                    {formData.workItems.map(w => (
                      <div key={w.id} className="flex justify-between text-sm">
                        <span className="text-gray-700 truncate flex-1 mr-2">{w.name}</span>
                        <span className="text-gray-500 tabular-nums flex-shrink-0">
                          {(w.normHours ?? 0) > 0 ? `${fmtHours(w.normHours ?? 0)} н·ч` : '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between text-sm pt-2 border-t border-gray-100">
                  <span className="text-gray-500">Из каталога</span>
                  <span className="font-semibold text-gray-900 tabular-nums">{fmtHours(catalogNormHours)} н·ч</span>
                </div>

                <div className="flex items-center justify-between gap-3 mt-3">
                  <label className="text-sm text-gray-600">Доп. время для работы с авто</label>
                  <div className="relative w-28">
                    <input
                      type="number" min="0" step="0.5" inputMode="decimal"
                      value={formData.extraHours ?? 0}
                      onChange={e => setFormData(p => ({ ...p, extraHours: Number(e.target.value) || 0 }))}
                      className="form-input pr-10 text-right"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">н·ч</span>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                  <span className="text-sm font-semibold text-gray-600">Итого</span>
                  <span className="text-sm font-bold text-gray-900 tabular-nums">{fmtHours(billableHours)} н·ч</span>
                </div>
                {(laborRate > 0 || sumWorkPricesVal > 0) ? (
                  <div className="mt-1 space-y-0.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-400">Работы</span>
                      <span className="text-gray-700 tabular-nums">₴{sumWorkPricesVal.toLocaleString()}</span>
                    </div>
                    {extraHoursVal > 0 && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-400">Доп. время · {fmtHours(extraHoursVal)} н·ч × {laborRate.toLocaleString()}</span>
                        <span className="text-gray-700 tabular-nums">₴{extraCostVal.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-1.5 mt-1 border-t border-gray-100">
                      <span className="text-xs font-semibold text-gray-500">Стоимость работ</span>
                      <span className="text-base font-bold text-primary tabular-nums">₴{totalWorkVal.toLocaleString()}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-amber-600 mt-2">
                    Ставка нормо-часа не задана. Задайте её в{' '}
                    <Link to="/sto/settings" className="underline" onClick={onClose}>Настройках СТО</Link>.
                  </p>
                )}
              </div>

              {/* Дата/время + мастер */}
              <div>
                <div className="mb-3">
                  <h3 className="text-sm font-bold text-gray-900">Дата, время и мастер</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Выберите слот и исполнителя</p>
                </div>
                <DateTimePicker
                  value={formData.scheduledDate}
                  onChange={(val) => setFormData(prev => ({ ...prev, scheduledDate: val }))}
                  stoCompanyId={profile?.sto_company_id}
                  excludeAppointmentId={appointmentId}
                  workerId={formData.assigned_to ?? null}
                  onWorkerChange={(id) => setFormData(prev => ({ ...prev, assigned_to: id ?? undefined }))}
                  showDuration={false}
                />
              </div>
            </div>
          )}

          {currentStep === 6 && (
            <AppointmentSummary
              formData={formData}
              onUpdate={(data) => setFormData({ ...formData, ...data })}
              isEditing={!!appointmentId}
            />
          )}
        </div>

        {/* ── Подвал ─────────────────────────────────────────────────── */}
        <div className="modal-footer">
          <div className="flex items-center gap-2">

            {/* Назад */}
            {showBack ? (
              <button
                type="button"
                onClick={handleBack}
                className="flex items-center gap-1.5 px-3 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Назад
              </button>
            ) : (
              /* Удалить (только при редактировании, на шаге 1 / если нет Назад) */
              appointmentId && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending}
                  className="px-3 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                >
                  {deleteMutation.isPending ? 'Удаление…' : 'Удалить'}
                </button>
              )
            )}

            <div className="flex-1" />

            {/* Отмена */}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Отмена
            </button>

            {/* Далее / Сохранить */}
            {isLastStep ? (
              <button
                type="button"
                onClick={() => createMutation.mutate(formData)}
                disabled={createMutation.isPending}
                className="px-5 py-2.5 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-lg transition-colors"
              >
                {createMutation.isPending ? 'Сохранение…' : appointmentId ? 'Сохранить' : 'Создать запись'}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleNext}
                disabled={!canProceed()}
                className="px-5 py-2.5 text-sm font-semibold text-white bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-all"
              >
                Далее
              </button>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog {...dialogProps} />
    </div>
  )
}
