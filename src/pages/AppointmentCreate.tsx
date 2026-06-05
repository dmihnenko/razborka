import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, useParams } from 'react-router-dom'
import { useQueryClient, useMutation, useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useUserProfile } from '@/hooks/useUserProfile'
import { toast } from 'sonner'
import {
  ArrowLeft, User, Car, Calendar, Wrench, Package,
  CheckCircle2, ChevronRight, ChevronDown,
} from 'lucide-react'
import type { AppointmentFormValues } from '@/types/appointments'
import ClientSelector from '@/components/appointments/ClientSelector'
import VehicleSelector from '@/components/appointments/VehicleSelector'
import DateTimePicker from '@/components/appointments/DateTimePicker'
import WorkItemsManager from '@/components/appointments/WorkItemsManager'
import PartItemsManager from '@/components/appointments/PartItemsManager'

// ─── helpers ──────────────────────────────────────────────────────────────────

const MONTHS_SHORT = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек']
const DAYS_SHORT   = ['вс','пн','вт','ср','чт','пт','сб']

function fmtDatetime(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/)
  if (!m) return ''
  const d = new Date(+m[1], +m[2]-1, +m[3])
  const time = m[4] ? ` · ${m[4]}:${m[5]}` : ''
  return `${DAYS_SHORT[d.getDay()]}, ${d.getDate()} ${MONTHS_SHORT[+m[2]-1]}${time}`
}

// ─── section types ────────────────────────────────────────────────────────────

type SectionId = 'client' | 'vehicle' | 'datetime' | 'works' | 'parts'

const SECTIONS: {
  id: SectionId
  label: string
  icon: React.ElementType
  optional?: boolean
}[] = [
  { id: 'client',   label: 'Клиент',      icon: User      },
  { id: 'vehicle',  label: 'Автомобиль',  icon: Car       },
  { id: 'datetime', label: 'Дата и время', icon: Calendar  },
  { id: 'works',    label: 'Работы',      icon: Wrench    },
  { id: 'parts',    label: 'Запчасти',    icon: Package, optional: true },
]

// ─── main page ────────────────────────────────────────────────────────────────

export default function AppointmentCreate() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const queryClient  = useQueryClient()
  const { data: profile } = useUserProfile()

  const { appointmentId } = useParams()
  const isEdit = !!appointmentId
  const prefilledDate = searchParams.get('date')

  const [openSection, setOpenSection] = useState<SectionId>(isEdit ? 'works' : 'client')

  const [form, setForm] = useState<AppointmentFormValues>(() => {
    const now = new Date()
    const p   = (n: number) => String(n).padStart(2, '0')
    const defaultDate = prefilledDate
      ? `${prefilledDate}T09:00`
      : `${now.getFullYear()}-${p(now.getMonth()+1)}-${p(now.getDate())}T09:00`
    return {
      customer_id:     '',
      vehicle_id:      '',
      scheduledDate:   defaultDate,
      scheduledEndDate: null,
      status:          'in_progress',
      notes:           '',
      workItems:       [],
      partItems:       [],
      parts_paid:      false,
      work_paid:       false,
    }
  })

  // ── Загрузка заявки для редактирования ──────────────────────────────────────
  const { data: existing } = useQuery({
    queryKey: ['appointment', appointmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select('*, customers(*), vehicles(*)')
        .eq('id', appointmentId)
        .single()
      if (error) throw error
      return data
    },
    enabled: isEdit,
  })

  useEffect(() => {
    if (!existing) return
    const pad = (n: number) => String(n).padStart(2, '0')
    const toLocalISO = (d: Date) =>
      `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
    const parseLocal = (s: string) => {
      const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/)
      if (m) return new Date(+m[1], +m[2]-1, +m[3], +(m[4] ?? 9), +(m[5] ?? 0))
      return new Date(s)
    }
    let sd: string = existing.scheduled_date
    if (!sd || isNaN(new Date(sd).getTime())) sd = existing.created_at || existing.updated_at
    const scheduledDate = toLocalISO(new Date(sd))
    let scheduledEndDate: string | null = null
    if (existing.duration_minutes && existing.duration_minutes > 0) {
      const end = parseLocal(scheduledDate)
      end.setMinutes(end.getMinutes() + existing.duration_minutes)
      scheduledEndDate = toLocalISO(end)
    }
    setForm({
      customer_id:      existing.customer_id,
      vehicle_id:       existing.vehicle_id,
      scheduledDate,
      scheduledEndDate,
      status:           existing.status,
      notes:            existing.notes || '',
      workItems:        existing.work_items || [],
      partItems:        existing.part_items || [],
      selectedClient:   existing.customers,
      selectedVehicle:  existing.vehicles,
      assigned_to:      existing.assigned_to,
      parts_paid:       existing.parts_paid || false,
      work_paid:        existing.work_paid || false,
    })
  }, [existing])

  const goNext = (current: SectionId) => {
    const idx = SECTIONS.findIndex(s => s.id === current)
    if (idx < SECTIONS.length - 1) setOpenSection(SECTIONS[idx + 1].id)
  }

  const isComplete = (id: SectionId): boolean => {
    if (id === 'client')   return !!form.customer_id
    if (id === 'vehicle')  return !!form.vehicle_id
    if (id === 'datetime') return !!form.scheduledDate
    return true
  }

  const canSubmit = form.customer_id && form.vehicle_id && form.scheduledDate

  const totalWork  = form.workItems.reduce((s, i) => s + i.price,      0)
  const totalParts = form.partItems.reduce((s, i) => s + i.totalPrice, 0)
  const totalCost  = totalWork + totalParts

  const createMutation = useMutation({
    mutationFn: async () => {
      if (isEdit) {
        const { data, error } = await supabase
          .from('appointments')
          .update({
            customer_id:      form.customer_id,
            vehicle_id:       form.vehicle_id,
            scheduled_date:   form.scheduledDate,
            status:           form.status,
            notes:            form.notes || null,
            work_items:       form.workItems,
            part_items:       form.partItems,
            total_work_cost:  totalWork,
            total_parts_cost: totalParts,
            total_cost:       totalCost,
            assigned_to:      form.assigned_to || null,
            parts_paid:       form.parts_paid || false,
            work_paid:        form.work_paid || false,
          })
          .eq('id', appointmentId)
          .select()
          .single()
        if (error) throw error
        return data
      }
      const { data, error } = await supabase
        .from('appointments')
        .insert({
          customer_id:      form.customer_id,
          vehicle_id:       form.vehicle_id,
          scheduled_date:   form.scheduledDate,
          status:           'in_progress',
          notes:            form.notes || null,
          work_items:       form.workItems,
          part_items:       form.partItems,
          total_work_cost:  totalWork,
          total_parts_cost: totalParts,
          total_cost:       totalCost,
          sto_company_id:   profile?.sto_company_id,
          created_by:       profile?.id,
          assigned_to:      form.assigned_to || profile?.id,
          parts_paid: false,
          work_paid:  false,
        })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (appt) => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
      queryClient.invalidateQueries({ queryKey: ['board-kanban'] })
      if (isEdit) queryClient.invalidateQueries({ queryKey: ['appointment', appointmentId] })
      toast.success(isEdit ? 'Запись обновлена!' : 'Запись создана!')
      navigate(`/sto/appointments/${appt.id}`)
    },
    onError: (err: any) => toast.error(`Ошибка: ${err.message}`),
  })

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Sticky header ──────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 shadow-sm">
        <div className="w-full px-4 sm:px-6 h-14 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-gray-500 hover:text-gray-900 transition-colors p-1 rounded-lg hover:bg-gray-100 -ml-1 flex-shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="hidden sm:inline text-sm font-medium">Назад</span>
          </button>

          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-gray-900 text-base leading-tight">{isEdit ? 'Редактирование записи' : 'Новая запись'}</h1>
            {form.selectedClient && (
              <p className="text-xs text-gray-400 leading-none mt-0.5 truncate">
                {(form.selectedClient as any).name}
                {form.selectedVehicle && ` · ${(form.selectedVehicle as any).brand} ${(form.selectedVehicle as any).model}`}
              </p>
            )}
          </div>

          <button
            onClick={() => createMutation.mutate()}
            disabled={!canSubmit || createMutation.isPending}
            className="px-4 py-1.5 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-40 transition-colors flex-shrink-0"
          >
            {createMutation.isPending ? 'Сохранение…' : isEdit ? 'Сохранить' : 'Создать'}
          </button>
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div className="w-full px-4 sm:px-6 py-5">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">

          {/* ── Form sections ────────────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-2.5">

            {SECTIONS.map((section, sIdx) => {
              const Icon    = section.icon
              const isOpen  = openSection === section.id
              const done    = isComplete(section.id) && openSection !== section.id

              return (
                <div
                  key={section.id}
                  className={`bg-white rounded-xl border overflow-hidden transition-shadow
                    ${isOpen ? 'border-primary/30 shadow-sm' : 'border-gray-200'}`}
                >
                  {/* Section header */}
                  <button
                    type="button"
                    onClick={() => setOpenSection(section.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors
                      ${isOpen ? 'bg-primary/5' : 'hover:bg-gray-50/80'}`}
                  >
                    {/* Icon / done indicator */}
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors
                      ${isOpen   ? 'bg-primary text-white' :
                        done     ? 'bg-green-500 text-white' :
                                   'bg-gray-100 text-gray-400'}`}
                    >
                      {done ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold leading-tight
                        ${isOpen ? 'text-primary' : done ? 'text-gray-900' : 'text-gray-500'}`}>
                        {section.label}
                        {section.optional && (
                          <span className="ml-2 text-xs font-normal text-gray-400">необязательно</span>
                        )}
                      </p>

                      {/* Collapsed summary */}
                      {!isOpen && (
                        <p className="text-xs text-gray-500 mt-0.5 truncate">
                          {section.id === 'client' && (
                            done ? (form.selectedClient as any)?.name : 'Выберите клиента'
                          )}
                          {section.id === 'vehicle' && (
                            done
                              ? `${(form.selectedVehicle as any)?.brand} ${(form.selectedVehicle as any)?.model}`
                              : form.customer_id ? 'Выберите автомобиль' : '—'
                          )}
                          {section.id === 'datetime' && fmtDatetime(form.scheduledDate)}
                          {section.id === 'works' && (
                            form.workItems.length > 0
                              ? `${form.workItems.length} позиций · ₴${totalWork.toLocaleString()}`
                              : 'Работы не добавлены'
                          )}
                          {section.id === 'parts' && (
                            form.partItems.length > 0
                              ? `${form.partItems.length} позиций · ₴${totalParts.toLocaleString()}`
                              : 'Запчасти не добавлены'
                          )}
                        </p>
                      )}
                    </div>

                    {isOpen
                      ? <ChevronDown className="w-4 h-4 text-primary flex-shrink-0" />
                      : <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                    }
                  </button>

                  {/* Section body */}
                  {isOpen && (
                    <div className="border-t border-gray-100 px-4 pb-4 pt-4">
                      {section.id === 'client' && (
                        <ClientSelector
                          selectedId={form.customer_id}
                          onSelect={(id, customer) => {
                            setForm(p => ({ ...p, customer_id: id, vehicle_id: '', selectedClient: customer }))
                            if (id) setTimeout(() => goNext('client'), 150)
                          }}
                        />
                      )}

                      {section.id === 'vehicle' && (
                        <VehicleSelector
                          customerId={form.customer_id}
                          selectedId={form.vehicle_id}
                          onSelect={(id, vehicle) => {
                            setForm(p => ({ ...p, vehicle_id: id, selectedVehicle: vehicle }))
                            if (id) setTimeout(() => goNext('vehicle'), 150)
                          }}
                        />
                      )}

                      {section.id === 'datetime' && (
                        <DateTimePicker
                          value={form.scheduledDate}
                          onChange={val => setForm(p => ({ ...p, scheduledDate: val }))}
                          endValue={form.scheduledEndDate}
                          onEndChange={val => setForm(p => ({ ...p, scheduledEndDate: val }))}
                          stoCompanyId={profile?.sto_company_id}
                        />
                      )}

                      {section.id === 'works' && (
                        <WorkItemsManager
                          items={form.workItems}
                          onChange={items => setForm(p => ({ ...p, workItems: items }))}
                        />
                      )}

                      {section.id === 'parts' && (
                        <PartItemsManager
                          items={form.partItems}
                          onChange={items => setForm(p => ({ ...p, partItems: items }))}
                        />
                      )}

                      {/* Next button (except last section) */}
                      {sIdx < SECTIONS.length - 1 && (
                        <div className="mt-4 flex justify-end">
                          <button
                            type="button"
                            onClick={() => goNext(section.id)}
                            className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors"
                          >
                            Далее
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Mobile submit */}
            <div className="lg:hidden pt-1">
              <button
                onClick={() => createMutation.mutate()}
                disabled={!canSubmit || createMutation.isPending}
                className="w-full py-3 bg-primary text-white font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-40 transition-colors text-sm"
              >
                {createMutation.isPending ? 'Сохранение…' : isEdit ? 'Сохранить' : 'Создать запись'}
              </button>
            </div>
          </div>

          {/* ── Sidebar summary ──────────────────────────────────────────── */}
          <div className="hidden lg:block">
            <div className="sticky top-20 space-y-3">

              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h2 className="text-sm font-bold text-gray-900 mb-3 pb-2 border-b border-gray-100">Сводка</h2>

                <div className="space-y-2">
                  {form.selectedClient ? (
                    <div className="flex items-start gap-2">
                      <User className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 leading-tight truncate">
                          {(form.selectedClient as any).name}
                        </p>
                        {(form.selectedClient as any).phone && (
                          <p className="text-xs text-gray-500">{(form.selectedClient as any).phone}</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 flex items-center gap-2">
                      <User className="w-4 h-4" /> Клиент не выбран
                    </p>
                  )}

                  {form.selectedVehicle ? (
                    <div className="flex items-center gap-2">
                      <Car className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <p className="text-sm text-gray-700 truncate">
                        {(form.selectedVehicle as any).brand} {(form.selectedVehicle as any).model}
                        {(form.selectedVehicle as any).license_plate && (
                          <span className="ml-1.5 text-xs font-mono bg-gray-100 px-1 py-px rounded">
                            {(form.selectedVehicle as any).license_plate}
                          </span>
                        )}
                      </p>
                    </div>
                  ) : null}

                  {form.scheduledDate && (
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <p className="text-sm text-gray-700">{fmtDatetime(form.scheduledDate)}</p>
                    </div>
                  )}
                </div>

                {/* Works */}
                {form.workItems.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Работы</p>
                    <div className="space-y-1">
                      {form.workItems.map(w => (
                        <div key={w.id} className="flex justify-between text-xs">
                          <span className="text-gray-700 truncate flex-1 mr-2">{w.name}</span>
                          <span className="font-semibold text-gray-900 flex-shrink-0">
                            ₴{w.price.toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Parts */}
                {form.partItems.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Запчасти</p>
                    <div className="space-y-1">
                      {form.partItems.map(p => (
                        <div key={p.id} className="flex justify-between text-xs">
                          <span className="text-gray-700 truncate flex-1 mr-2">{p.name}</span>
                          <span className="font-semibold text-gray-900 flex-shrink-0">
                            ₴{p.totalPrice.toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Total */}
                {totalCost > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-baseline">
                    <span className="text-sm font-semibold text-gray-600">Итого:</span>
                    <span className="text-xl font-bold text-primary tabular-nums">
                      ₴{totalCost.toLocaleString()}
                    </span>
                  </div>
                )}
              </div>

              <button
                onClick={() => createMutation.mutate()}
                disabled={!canSubmit || createMutation.isPending}
                className="w-full py-3 bg-primary text-white font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-40 transition-colors text-sm"
              >
                {createMutation.isPending ? 'Сохранение…' : isEdit ? 'Сохранить' : 'Создать запись'}
              </button>

              {!canSubmit && (
                <p className="text-xs text-gray-400 text-center">
                  {!form.customer_id ? 'Выберите клиента' :
                   !form.vehicle_id  ? 'Выберите автомобиль' :
                                       'Укажите дату и время'}
                </p>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
